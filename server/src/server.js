/**
 * Medical Store POS System - Production Server
 * Multi-tenant architecture with enterprise-grade security and performance
 *
 * @version 2.0.0
 * @author Medical Store POS Team
 */

const express = require("express");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");

// Load environment configuration
require("dotenv").config();

// Import configurations and utilities
const {
  connectToDatabase,
  closeDatabaseConnection,
} = require("./config/database");
const { setupLogging, logger } = require("./config/logging");
const { setupSecurity } = require("./config/security");
const { setupMiddleware } = require("./config/middleware");
const { setupRoutes } = require("./config/routes");
const { setupErrorHandling } = require("./config/error-handling");
const { validateEnvironment } = require("./utils/environment-validator");
const {
  startRecurringExpenseScheduler,
} = require("./services/recurring-expense-scheduler");

// Validate environment variables
validateEnvironment();

// Initialize Express application
const app = express();

// Setup logging
setupLogging();

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdnjs.cloudflare.com",
          "https://fonts.googleapis.com",
        ],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          "https://cdnjs.cloudflare.com",
          "https://unpkg.com",
        ],
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: [
          "'self'",
          "https://cdnjs.cloudflare.com",
          "https://fonts.gstatic.com",
        ],
        connectSrc: [
          "'self'",
          "https://cdnjs.cloudflare.com",
          "https://unpkg.com",
        ],
      },
    },
  }),
);

// Compression middleware
app.use(
  compression({
    level: 6,
    threshold: 1024,
  }),
);

// Rate limiting - Increased limits for development
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000, // Increased to 1000 requests per windowMs
  message: {
    error: "Too many requests from this IP, please try again later.",
    retryAfter: Math.ceil(
      (parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000) / 1000,
    ),
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for development
    return process.env.NODE_ENV === "development";
  },
});

app.use("/api/", limiter);

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }

    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:5000",
      "http://localhost:5173", // Vite default port
    ];

    // In development, allow all localhost origins
    if (process.env.NODE_ENV === "development") {
      const isLocalhost =
        origin.includes("localhost") || origin.includes("127.0.0.1");
      if (isLocalhost) {
        return callback(null, true);
      }
    }

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  exposedHeaders: ["Content-Range", "X-Content-Range"],
  optionsSuccessStatus: 200,
  maxAge: 86400, // 24 hours
};

app.use(cors(corsOptions));

// Request logging
if (process.env.NODE_ENV === "production") {
  app.use(
    morgan("combined", {
      stream: { write: (message) => logger.info(message.trim()) },
    }),
  );
} else {
  app.use(morgan("dev"));
}

// Body parsing middleware
app.use(
  express.json({
    limit: "10mb",
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Static file serving with caching
app.use(
  express.static(path.join(__dirname, "../../client/dist"), {
    maxAge: process.env.NODE_ENV === "production" ? "1d" : "0",
    etag: true,
    lastModified: true,
  }),
);

// Setup additional middleware
setupMiddleware(app);

// Setup security configurations
setupSecurity(app);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "2.0.0",
    environment: process.env.NODE_ENV || "development",
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

// API routes
setupRoutes(app);

// Serve React application
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../../client/dist/index.html"));
});

// Error handling
setupErrorHandling(app);

// Server configuration
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || "0.0.0.0";

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  try {
    // Close database connections
    await closeDatabaseConnection();
    logger.info("Database connections closed.");

    // Close server
    server.close(() => {
      logger.info("HTTP server closed.");
      process.exit(0);
    });

    // Force close after 30 seconds
    setTimeout(() => {
      logger.error(
        "Could not close connections in time, forcefully shutting down",
      );
      process.exit(1);
    }, 30000);
  } catch (error) {
    logger.error("Error during graceful shutdown:", error);
    process.exit(1);
  }
};

// Start server
let server;

const startServer = async () => {
  try {
    // Connect to database
    await connectToDatabase();
    logger.info("Database connected successfully");

    // Start HTTP server
    server = app.listen(PORT, HOST, () => {
      logger.info(`🚀 Medical Store POS Server running on ${HOST}:${PORT}`);
      logger.info(`📍 Environment: ${process.env.NODE_ENV || "development"}`);
      logger.info(`📍 Health check: http://${HOST}:${PORT}/health`);
      logger.info(`📍 API Base URL: http://${HOST}:${PORT}/api`);

      if (process.env.NODE_ENV !== "production") {
        logger.info('💡 Run "npm run seed" to initialize sample data');
      }
    });

    // Start recurring expense scheduler
    startRecurringExpenseScheduler();
    logger.info("Recurring expense scheduler initialized");

    // Handle server errors
    server.on("error", (error) => {
      if (error.syscall !== "listen") {
        throw error;
      }

      const bind = typeof PORT === "string" ? "Pipe " + PORT : "Port " + PORT;

      switch (error.code) {
        case "EACCES":
          logger.error(`${bind} requires elevated privileges`);
          process.exit(1);
          break;
        case "EADDRINUSE":
          logger.error(`${bind} is already in use`);
          process.exit(1);
          break;
        default:
          throw error;
      }
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

// Process event handlers
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", error);
  gracefulShutdown("uncaughtException");
});
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at:", promise, "reason:", reason);
  gracefulShutdown("unhandledRejection");
});

// Start the server
startServer();

module.exports = app;
