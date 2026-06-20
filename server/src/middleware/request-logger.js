/**
 * Request Logger Middleware
 * Logs all incoming requests with details
 */

const { logger } = require('../config/logging');

/**
 * Log incoming requests
 */
const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  // Log request
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    user: req.user?._id || 'unauthenticated',
  });

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info';

    logger[logLevel]('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      user: req.user?._id || 'unauthenticated',
    });
  });

  next();
};

/**
 * Log only errors (lighter logging)
 */
const errorOnlyLogger = (req, res, next) => {
  res.on('finish', () => {
    if (res.statusCode >= 400) {
      logger.warn('Request failed', {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        user: req.user?._id || 'unauthenticated',
      });
    }
  });

  next();
};

module.exports = {
  requestLogger,
  errorOnlyLogger,
};
