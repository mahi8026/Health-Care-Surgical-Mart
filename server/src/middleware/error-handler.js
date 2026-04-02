/**
 * Global Error Handler Middleware
 * Catches and formats all errors in the application
 */

const { logger } = require("../config/logging");
const { AppError } = require("../utils/errors");

/**
 * Error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  // Log error
  logger.error("Error occurred:", {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    user: req.user?._id || "unauthenticated",
  });

  // Default error values
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal server error";
  let errors = err.errors || undefined;

  // Handle specific error types
  if (err.name === "ValidationError" && err.errors) {
    // Mongoose validation error
    statusCode = 422;
    message = "Validation failed";
    errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
  } else if (err.name === "CastError") {
    // MongoDB cast error (invalid ObjectId)
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  } else if (err.code === 11000) {
    // MongoDB duplicate key error
    statusCode = 409;
    const field = Object.keys(err.keyPattern)[0];
    message = `Duplicate value for field: ${field}`;
  } else if (err.name === "JsonWebTokenError") {
    // JWT error
    statusCode = 401;
    message = "Invalid token";
  } else if (err.name === "TokenExpiredError") {
    // JWT expired
    statusCode = 401;
    message = "Token expired";
  } else if (err.name === "MulterError") {
    // File upload error
    statusCode = 400;
    message = `File upload error: ${err.message}`;
  }

  // Build error response
  const errorResponse = {
    success: false,
    message,
    statusCode,
    timestamp: new Date().toISOString(),
  };

  // Add errors array if present (validation errors)
  if (errors) {
    errorResponse.errors = errors;
  }

  // Add stack trace in development
  if (process.env.NODE_ENV === "development") {
    errorResponse.stack = err.stack;
    errorResponse.error = err;
  }

  // Add request info in development
  if (process.env.NODE_ENV === "development") {
    errorResponse.request = {
      method: req.method,
      path: req.path,
      query: req.query,
      body: req.body,
    };
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
};

/**
 * 404 Not Found handler
 */
const notFoundHandler = (req, res, next) => {
  const error = new AppError(`Route not found: ${req.originalUrl}`, 404);
  next(error);
};

/**
 * Async handler wrapper
 * Catches async errors and passes to error handler
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
};
