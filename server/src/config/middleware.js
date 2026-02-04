/**
 * Middleware Configuration
 * Centralized middleware setup for the Medical Store POS System
 */

const { requestLogger } = require("./logging");
const { authenticate } = require("../middleware/auth-multi-tenant");
const {
  createRateLimiters,
  createValidators,
  handleValidationErrors,
  sqlInjectionProtection,
  xssProtection,
} = require("./security");

/**
 * Setup application middleware
 * @param {Express} app - Express application instance
 */
const setupMiddleware = (app) => {
  // Request logging
  app.use(requestLogger);

  // Security middleware
  app.use(sqlInjectionProtection);
  app.use(xssProtection);

  // Rate limiters
  const { apiLimiter, authLimiter, passwordResetLimiter } =
    createRateLimiters();

  // Apply rate limiters to specific routes
  app.use("/api/auth/login", authLimiter);
  app.use("/api/auth/forgot-password", passwordResetLimiter);
  app.use("/api/", apiLimiter);

  // Request ID middleware for tracking
  app.use((req, res, next) => {
    req.id = Math.random().toString(36).substr(2, 9);
    res.setHeader("X-Request-ID", req.id);
    next();
  });

  // Shop context middleware (for multi-tenant operations)
  app.use("/api/", (req, res, next) => {
    // Skip auth routes and public endpoints
    if (
      req.path.startsWith("/auth/") ||
      req.path === "/health" ||
      req.path === "/test"
    ) {
      return next();
    }

    // Add shop context to request
    if (req.user && req.user.shopId) {
      req.shopId = req.user.shopId;
    }

    next();
  });
};

/**
 * Get validation middleware for different entities
 */
const getValidators = () => {
  return createValidators();
};

module.exports = {
  setupMiddleware,
  getValidators,
  handleValidationErrors,
  authenticate,
};
