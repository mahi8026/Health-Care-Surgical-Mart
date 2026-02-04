/**
 * Logging Configuration
 * Professional logging setup with Winston for production-ready applications
 */

const winston = require("winston");
const DailyRotateFile = require("winston-daily-rotate-file");
const path = require("path");

// Ensure logs directory exists
const logsDir = path.join(__dirname, "../../logs");

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: "YYYY-MM-DD HH:mm:ss",
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint(),
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: "HH:mm:ss",
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  }),
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: logFormat,
  defaultMeta: {
    service: "medical-store-pos",
    version: process.env.npm_package_version || "2.0.0",
  },
  transports: [
    // Error log file (errors only)
    new DailyRotateFile({
      filename: path.join(logsDir, "error-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      level: "error",
      maxSize: "20m",
      maxFiles: "14d",
      zippedArchive: true,
    }),

    // Combined log file (all levels)
    new DailyRotateFile({
      filename: path.join(logsDir, "combined-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      maxSize: "20m",
      maxFiles: "30d",
      zippedArchive: true,
    }),

    // Application log file
    new DailyRotateFile({
      filename: path.join(logsDir, "app-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      level: "info",
      maxSize: "20m",
      maxFiles: "30d",
      zippedArchive: true,
    }),
  ],

  // Handle exceptions and rejections
  exceptionHandlers: [
    new DailyRotateFile({
      filename: path.join(logsDir, "exceptions-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      maxSize: "20m",
      maxFiles: "30d",
      zippedArchive: true,
    }),
  ],

  rejectionHandlers: [
    new DailyRotateFile({
      filename: path.join(logsDir, "rejections-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      maxSize: "20m",
      maxFiles: "30d",
      zippedArchive: true,
    }),
  ],
});

// Add console transport for development
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
      level: "debug",
    }),
  );
}

// Create specialized loggers for different components
const createComponentLogger = (component) => {
  return logger.child({ component });
};

// Database logger
const dbLogger = createComponentLogger("database");

// Authentication logger
const authLogger = createComponentLogger("auth");

// API logger
const apiLogger = createComponentLogger("api");

// Security logger
const securityLogger = createComponentLogger("security");

// Performance logger
const performanceLogger = createComponentLogger("performance");

// Audit logger for sensitive operations
const auditLogger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [
    new DailyRotateFile({
      filename: path.join(logsDir, "audit-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      maxSize: "20m",
      maxFiles: "365d", // Keep audit logs for 1 year
      zippedArchive: true,
    }),
  ],
});

// Request logging middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();

  // Log request
  apiLogger.info("Incoming request", {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    userId: req.user?.id,
    shopId: req.user?.shopId,
  });

  // Log response
  res.on("finish", () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? "warn" : "info";

    apiLogger.log(logLevel, "Request completed", {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userId: req.user?.id,
      shopId: req.user?.shopId,
    });

    // Log slow requests
    if (duration > 1000) {
      performanceLogger.warn("Slow request detected", {
        method: req.method,
        url: req.url,
        duration: `${duration}ms`,
        userId: req.user?.id,
      });
    }
  });

  next();
};

// Security event logger
const logSecurityEvent = (event, details = {}) => {
  securityLogger.warn("Security event", {
    event,
    timestamp: new Date().toISOString(),
    ...details,
  });

  // Also log to audit log for critical security events
  if (
    ["failed_login", "unauthorized_access", "privilege_escalation"].includes(
      event,
    )
  ) {
    auditLogger.warn("Critical security event", {
      event,
      timestamp: new Date().toISOString(),
      ...details,
    });
  }
};

// Audit logging for sensitive operations
const logAuditEvent = (action, details = {}) => {
  auditLogger.info("Audit event", {
    action,
    timestamp: new Date().toISOString(),
    ...details,
  });
};

// Performance monitoring
const logPerformance = (operation, duration, details = {}) => {
  performanceLogger.info("Performance metric", {
    operation,
    duration: `${duration}ms`,
    timestamp: new Date().toISOString(),
    ...details,
  });
};

// Setup logging configuration
const setupLogging = () => {
  // Create logs directory if it doesn't exist
  const fs = require("fs");
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  logger.info("Logging system initialized", {
    logLevel: process.env.LOG_LEVEL || "info",
    environment: process.env.NODE_ENV || "development",
    logsDirectory: logsDir,
  });
};

module.exports = {
  logger,
  dbLogger,
  authLogger,
  apiLogger,
  securityLogger,
  performanceLogger,
  auditLogger,
  requestLogger,
  logSecurityEvent,
  logAuditEvent,
  logPerformance,
  setupLogging,
  createComponentLogger,
};
