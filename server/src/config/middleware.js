/**
 * Middleware Configuration
 * Centralized middleware setup for the Medical Store POS System
 */

const { authenticate } = require('../middleware/auth-multi-tenant');
const {
  createRateLimiters,
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
  const { authLimiter, passwordResetLimiter } =
    createRateLimiters();

  // Apply rate limiters to specific routes
  app.use(['/api/auth/login', '/api/auth/firebase-login'], authLimiter);
  app.use('/api/auth/request-password-reset', passwordResetLimiter);
  // NOTE: the global /api rate limiter is applied in server.js so requests
  // are not counted TWICE (server.js global limiter + this one). server.js's
  // limiter skips development and /auth/* paths (authLimiter covers those).

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

module.exports = {
  setupMiddleware,
  authenticate,
};
