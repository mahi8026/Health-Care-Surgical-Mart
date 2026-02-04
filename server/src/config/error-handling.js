/**
 * Error Handling Configuration
 * Centralized error handling for the Medical Store POS System
 */

const { logger, logSecurityEvent } = require("./logging");

/**
 * Setup comprehensive error handling
 * @param {Express} app - Express application instance
 */
const setupErrorHandling = (app) => {
  // 404 handler for API routes
  app.use("/api/*", (req, res) => {
    logger.warn(`API endpoint not found: ${req.method} ${req.originalUrl}`, {
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      userId: req.user?.id,
    });

    res.status(404).json({
      success: false,
      message: "API endpoint not found",
      path: req.originalUrl,
      method: req.method,
    });
  });

  // Global error handler
  app.use((error, req, res, next) => {
    // Log the error
    logger.error("Unhandled error:", {
      error: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      userId: req.user?.id,
      shopId: req.user?.shopId,
    });

    // Handle specific error types
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: Object.values(error.errors).map((err) => err.message),
      });
    }

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid ID format",
      });
    }

    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(409).json({
        success: false,
        message: `${field} already exists`,
      });
    }

    if (error.name === "JsonWebTokenError") {
      logSecurityEvent("invalid_token", {
        ip: req.ip,
        url: req.url,
        error: error.message,
      });

      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired",
      });
    }

    if (error.name === "MongoError" || error.name === "MongoServerError") {
      logger.error("Database error:", error);
      return res.status(500).json({
        success: false,
        message: "Database error occurred",
      });
    }

    // Handle CORS errors
    if (error.message && error.message.includes("CORS")) {
      logSecurityEvent("cors_violation", {
        ip: req.ip,
        origin: req.get("Origin"),
        url: req.url,
      });

      return res.status(403).json({
        success: false,
        message: "CORS policy violation",
      });
    }

    // Handle rate limit errors
    if (error.message && error.message.includes("rate limit")) {
      return res.status(429).json({
        success: false,
        message: "Rate limit exceeded",
      });
    }

    // Default error response
    const statusCode = error.statusCode || error.status || 500;
    const message =
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : error.message;

    res.status(statusCode).json({
      success: false,
      message,
      ...(process.env.NODE_ENV !== "production" && {
        stack: error.stack,
        error: error.name,
      }),
    });
  });
};

/**
 * Create standardized error objects
 */
class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.name = this.constructor.name;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Async error wrapper to catch async errors
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Create specific error types
 */
const createError = {
  badRequest: (message = "Bad request") => new AppError(message, 400),
  unauthorized: (message = "Unauthorized") => new AppError(message, 401),
  forbidden: (message = "Forbidden") => new AppError(message, 403),
  notFound: (message = "Not found") => new AppError(message, 404),
  conflict: (message = "Conflict") => new AppError(message, 409),
  validation: (message = "Validation failed") => new AppError(message, 422),
  internal: (message = "Internal server error") => new AppError(message, 500),
  database: (message = "Database error") => new AppError(message, 500),
};

module.exports = {
  setupErrorHandling,
  AppError,
  asyncHandler,
  createError,
};
