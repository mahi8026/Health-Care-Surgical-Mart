/**
 * Medical Store POS System - Production Server
 * Multi-tenant architecture with enterprise-grade security and performance
 *
 * @version 2.0.0
 * @author Medical Store POS Team
 * @updated 2026-05-13 - Fixed trust proxy for Render deployment
 */

const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const cookieParser = require('cookie-parser');

// Load environment configuration
require('dotenv').config();

// Import configurations and utilities
const {
  connectToDatabase,
  closeDatabaseConnection,
} = require('./config/database');
const { setupLogging, logger } = require('./config/logging');
const { setupSecurity } = require('./config/security');
const { setupMiddleware } = require('./config/middleware');
const { setupRoutes } = require('./config/routes');
const { setupErrorHandling } = require('./config/error-handling');
const { setupSwagger } = require('./config/swagger');
const { validateEnvironment } = require('./utils/environment-validator');
const {
  validateOrExit: validateProductionEnvironment,
} = require('./utils/production-env-validator');
const {
  startRecurringExpenseScheduler,
} = require('./services/recurring-expense-scheduler');
const { startKeepAlive, stopKeepAlive } = require('./services/keep-alive.service');
const {
  initializeSentry,
  setupSentryRequestHandler,
  setupSentryErrorHandler,
  flush: flushSentry,
} = require('./config/sentry');

// Validate environment variables
validateEnvironment();

// SECURITY FIX: Validate JWT_SECRET at startup (CRITICAL)
// This must happen BEFORE any middleware that uses JWT
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  logger.error(
    'FATAL: JWT_SECRET environment variable is missing or too short. ' +
    'JWT_SECRET must be at least 32 characters. ' +
    "Generate a secure secret using: node -e \"require('crypto').randomBytes(32, (err, buf) => { if (err) throw err; process.stdout.write(buf.toString('hex')); })\""
  );
  process.exit(1);
}
logger.info('? JWT_SECRET validated successfully');

// Additional production validation (warnings only in development)
if (process.env.NODE_ENV === 'production') {
  validateProductionEnvironment();
} else {
  logger.info('Skipping production environment validation (development mode)');
}

// Initialize Express application
const app = express();

// Trust proxy - Required for Render and other reverse proxies
// This allows express-rate-limit to correctly identify users
app.set('trust proxy', 1);

// Setup logging
setupLogging();

// Initialize Sentry (must be first)
initializeSentry(app);

// Setup Sentry request handler (must be before other middleware)
setupSentryRequestHandler(app);

// Advanced security headers (must be early in middleware chain)
const { advancedSecurityHeaders, sanitizeRequest } = require('./middleware/security-headers');
app.use(advancedSecurityHeaders);
app.use(sanitizeRequest);

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://cdnjs.cloudflare.com',
          'https://fonts.googleapis.com',
        ],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          'https://cdnjs.cloudflare.com',
          'https://unpkg.com',
        ],
        imgSrc: ["'self'", 'data:', 'https:'],
        fontSrc: [
          "'self'",
          'https://cdnjs.cloudflare.com',
          'https://fonts.gstatic.com',
        ],
        connectSrc: [
          "'self'",
          'https://cdnjs.cloudflare.com',
          'https://unpkg.com',
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
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil(
      (parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000) / 1000,
    ),
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (_req) => {
    // Skip rate limiting for development
    return process.env.NODE_ENV === 'development';
  },
});

app.use('/api', limiter);

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, file:// URLs, etc.)
    if (!origin) {
      return callback(null, true);
    }

    // Parse allowed origins and trim whitespace
    const allowedOrigins = (process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5000',
      'http://localhost:5173', // Vite default port
    ]).map(origin => origin.trim());

    // In development, allow all localhost origins and null origin (file://)
    if (process.env.NODE_ENV === 'development') {
      const isLocalhost =
        origin.includes('localhost') || origin.includes('127.0.0.1') || origin === 'null';
      if (isLocalhost) {
        return callback(null, true);
      }
    }

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked origin: ${origin}`, {
        requestedOrigin: origin,
        allowedOrigins: allowedOrigins
      });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  optionsSuccessStatus: 200,
  maxAge: 86400, // 24 hours
};

app.use(cors(corsOptions));

// Request logging
if (process.env.NODE_ENV === 'production') {
  app.use(
    morgan('combined', {
      stream: { write: (message) => logger.info(message.trim()) },
    }),
  );
} else {
  app.use(morgan('dev'));
}

// Body parsing middleware
app.use(
  express.json({
    limit: '10mb',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser middleware (for httpOnly JWT cookies)
app.use(cookieParser());

// Static file serving with caching (only in production with built client)
if (process.env.NODE_ENV === 'production') {
  const clientPath = path.join(__dirname, '../../client/dist');
  const fs = require('fs');

  // Only serve static files if client/dist exists
  if (fs.existsSync(clientPath)) {
    app.use(
      express.static(clientPath, {
        maxAge: '1d',
        etag: true,
        lastModified: true,
      }),
    );
    logger.info('Serving static files from client/dist');
  } else {
    logger.warn('Client dist folder not found - API only mode');
  }
}

// Setup additional middleware
setupMiddleware(app);

// Setup security configurations
setupSecurity(app);

// Request logging middleware (optional - for debugging)
if (process.env.ENABLE_REQUEST_LOGGING === 'true') {
  const { requestLogger } = require('./middleware/request-logger');
  app.use(requestLogger);
  logger.info('Request logging enabled');
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '2.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

// API routes
setupRoutes(app);

// Setup Swagger API documentation (after routes)
setupSwagger(app);

// Setup Sentry error handler (must be after routes, before other error handlers)
setupSentryErrorHandler(app);

// Serve React application (only if client/dist exists)
if (process.env.NODE_ENV === 'production') {
  const clientIndexPath = path.join(__dirname, '../../client/dist/index.html');
  const fs = require('fs');

  if (fs.existsSync(clientIndexPath)) {
    app.get('*', (req, res) => {
      res.sendFile(clientIndexPath);
    });
  } else {
    // API-only mode - return 404 for non-API routes
    app.get('*', (req, res) => {
      res.status(404).json({
        success: false,
        message: 'API endpoint not found',
        hint: 'This is an API-only server. Frontend is deployed separately.',
      });
    });
  }
} else {
  // Development mode - serve client if exists
  const clientIndexPath = path.join(__dirname, '../../client/dist/index.html');
  const fs = require('fs');

  if (fs.existsSync(clientIndexPath)) {
    app.get('*', (req, res) => {
      res.sendFile(clientIndexPath);
    });
  }
}

// Error handling
setupErrorHandling(app);

// Server configuration
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  try {
    // Stop keep-alive cron
    stopKeepAlive();

    // Flush Sentry events
    await flushSentry(2000);

    // Close Redis connection
    try {
      const { closeRedis } = require('./config/redis');
      await closeRedis();
      logger.info('Redis connection closed');
    } catch (error) {
      logger.warn('Error closing Redis:', error.message);
    }

    // Close email queue
    try {
      const emailService = require('./services/email/email.service');
      if (emailService._queue) {
        await emailService.queue.close();
        logger.info('Email queue closed');
      }
    } catch (error) {
      logger.error('Error closing email queue:', error);
    }

    // Close database connections
    await closeDatabaseConnection();
    logger.info('Database connections closed.');

    // Close server
    server.close(() => {
      logger.info('HTTP server closed.');
      process.exit(0);
    });

    // Force close after 30 seconds
    setTimeout(() => {
      logger.error(
        'Could not close connections in time, forcefully shutting down',
      );
      process.exit(1);
    }, 30000);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// Start server
let server;

const startServer = async () => {
  // Start HTTP server first � always, regardless of DB status
  server = app.listen(PORT, HOST, () => {
    logger.info(`?? Medical Store POS Server running on ${HOST}:${PORT}`);
    logger.info(`?? Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`?? Health check: http://${HOST}:${PORT}/health`);
    logger.info(`?? API Base URL: http://${HOST}:${PORT}/api`);
    logger.info(`?? Swagger UI:   http://${HOST}:${PORT}/api/docs`);

    if (process.env.NODE_ENV !== 'production') {
      logger.info('?? Run "npm run seed" to initialize sample data');
    }
  });

  // Handle server bind errors
  server.on('error', (error) => {
    if (error.syscall !== 'listen') {throw error;}
    const bind = typeof PORT === 'string' ? 'Pipe ' + PORT : 'Port ' + PORT;
    switch (error.code) {
      case 'EACCES':
        logger.error(`${bind} requires elevated privileges`);
        process.exit(1);
        break;
      case 'EADDRINUSE':
        logger.error(`${bind} is already in use`);
        process.exit(1);
        break;
      default:
        throw error;
    }
  });

  // Connect to database after server is listening
  // In development, a failed DB connection is non-fatal � server keeps running
  try {
    await connectToDatabase();
    logger.info('Database connected successfully');

    // Create system indexes
    const { createSystemIndexes, getSystemDatabase } = require('./config/database');
    try {
      await createSystemIndexes();
      logger.info('System indexes verified');
    } catch (indexError) {
      logger.warn('Failed to create system indexes (non-fatal):', indexError.message);
    }

    // Initialize Redis (optional, non-blocking)
    let redisClient = null;
    try {
      const { initializeRedis } = require('./config/redis');
      redisClient = await initializeRedis();
      if (redisClient) {
        logger.info('Redis connected successfully - using for token blacklist');
      } else {
        logger.info('Redis not configured - using MongoDB for token blacklist');
      }
    } catch (redisError) {
      logger.warn('Redis connection failed, falling back to MongoDB:', redisError.message);
    }

    // Initialize TokenBlacklistService with Redis (if available) and MongoDB
    const { initializeTokenBlacklistService } = require('./middleware/auth-multi-tenant');
    const systemDb = getSystemDatabase();
    initializeTokenBlacklistService(redisClient, systemDb);
    logger.info('TokenBlacklistService initialized');

    // Initialize audit log indexes (non-blocking, fire-and-forget)
    const auditLogService = require('./services/audit-log.service');
    auditLogService.ensureIndexes().catch(() => {});

    // Start recurring expense scheduler only after DB is ready
    startRecurringExpenseScheduler();
    logger.info('Recurring expense scheduler initialized');

    // Start expiry alert cron job (Phase 3: FEFO Batch Tracking)
    require('./jobs/expiry-alert.job');
    logger.info('Expiry alert cron job initialized');

    // Start daily backup job (runs 2:00 AM Bangladesh time)
    const { startBackupJob } = require('./jobs/backup.job');
    startBackupJob();
    logger.info('Daily backup cron job initialized');

    // Start keep-alive cron to prevent Render free-tier cold starts
    startKeepAlive();
  } catch (error) {
    if (process.env.NODE_ENV === 'production') {
      logger.error('Database connection failed in production � shutting down:', error.message);
      process.exit(1);
    } else {
      logger.warn(
        '??  Database connection failed � server is running WITHOUT database. ' +
        'API endpoints requiring DB will return 503. Swagger UI is available at ' +
        `http://${HOST}:${PORT}/api/docs`,
        { error: error.message }
      );
    }
  }
};

// Process event handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);

  // Capture in Sentry
  const { captureException } = require('./config/sentry');
  captureException(error, { type: 'uncaughtException' });

  gracefulShutdown('uncaughtException');
});
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);

  // Capture in Sentry
  const { captureException } = require('./config/sentry');
  captureException(reason, { type: 'unhandledRejection', promise: promise.toString() });

  gracefulShutdown('unhandledRejection');
});

// Start the server (not in test mode — tests import the app directly)
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = app;
