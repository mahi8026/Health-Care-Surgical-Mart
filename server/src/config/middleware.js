/**
 * Middleware Configuration
 * Centralized middleware setup for the Medical Store POS System
 */

const { authenticate } = require('../middleware/auth-multi-tenant');
const {
  createRateLimiters,
  createValidators,
  handleValidationErrors,
  xssProtection,
} = require('./security');
const {
  preventSessionFixation,
} = require('../middleware/security-headers');

/**
 * Setup application middleware
 * @param {Express} app - Express application instance
 */
const setupMiddleware = (app) => {
  // Session fixation prevention
  app.use(preventSessionFixation);

  // NOTE: per-request logging is opt-in (ENABLE_REQUEST_LOGGING=true in
  // server.js) — it writes 4+ winston log lines to disk per request in prod.

  // Security middleware
  app.use(xssProtection);

  // Rate limiters
  const { apiLimiter, authLimiter, passwordResetLimiter } =
    createRateLimiters();

  // Apply rate limiters to specific routes
  app.use(['/api/auth/login', '/api/auth/firebase-login'], authLimiter);
  app.use('/api/auth/request-password-reset', passwordResetLimiter);
  // Global API limiter — skip auth paths so login attempts are not
  // double-counted (authLimiter already covers them)
  app.use('/api', (req, res, next) => {
    if (req.path.startsWith('/auth/')) {
      return next();
    }
    return apiLimiter(req, res, next);
  });

  // Request ID middleware for tracking
  app.use((req, res, next) => {
    req.id = Math.random().toString(36).slice(2, 11);
    res.setHeader('X-Request-ID', req.id);
    next();
  });

  // Shop context middleware (for multi-tenant operations)
  app.use('/api', (req, res, next) => {
    // Skip auth routes and public endpoints
    if (
      req.path.startsWith('/auth/') ||
      req.path === '/health'
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
