/**
 * Security Configuration
 * Enterprise-grade security setup for the Medical Store POS System
 */

const rateLimit = require('express-rate-limit');
const { logSecurityEvent, securityLogger } = require('./logging');

/**
 * Setup comprehensive security configurations
 * @param {Express} app - Express application instance
 */
const setupSecurity = (app) => {
  // Security headers middleware
  app.use((req, res, next) => {
    // Remove server signature
    res.removeHeader('X-Powered-By');

    // Add security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader(
      'Permissions-Policy',
      'geolocation=(), microphone=(), camera=()',
    );

    next();
  });

  // Request size limits
  app.use((req, res, next) => {
    const maxSize = parseInt(process.env.MAX_REQUEST_SIZE) || 10485760; // 10MB

    if (
      req.headers['content-length'] &&
      parseInt(req.headers['content-length']) > maxSize
    ) {
      logSecurityEvent('request_too_large', {
        ip: req.ip,
        size: req.headers['content-length'],
        maxSize,
        url: req.url,
      });

      return res.status(413).json({
        success: false,
        message: 'Request entity too large',
      });
    }

    next();
  });

  // IP whitelist/blacklist middleware (only in production)
  if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
      const clientIP = req.ip || req.socket?.remoteAddress;
      const blacklistedIPs =
        process.env.BLACKLISTED_IPS?.split(',').filter((ip) => ip.trim()) || [];
      const whitelistedIPs =
        process.env.WHITELISTED_IPS?.split(',').filter((ip) => ip.trim()) || [];

      // Check blacklist
      if (blacklistedIPs.length > 0 && blacklistedIPs.includes(clientIP)) {
        logSecurityEvent('blacklisted_ip_access', {
          ip: clientIP,
          url: req.url,
          userAgent: req.get('User-Agent'),
        });

        return res.status(403).json({
          success: false,
          message: 'Access denied',
        });
      }

      // Check whitelist (only if explicitly configured with valid IPs)
      if (whitelistedIPs.length > 0 && !whitelistedIPs.includes(clientIP)) {
        logSecurityEvent('non_whitelisted_ip_access', {
          ip: clientIP,
          url: req.url,
          userAgent: req.get('User-Agent'),
        });

        return res.status(403).json({
          success: false,
          message: 'Access denied',
        });
      }

      next();
    });
  }

  securityLogger.info('Security middleware configured successfully');
};

/**
 * Enhanced rate limiting configurations
 */
const createRateLimiters = () => {
  // NOTE: the general /api rate limiter is defined inline in server.js — the
  // single source of truth — so requests aren't counted by two independent
  // express-rate-limit instances.

  // Strict rate limiter for authentication endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 5 : 1000, // Strict in production only (relaxed in dev/test)
    message: {
      success: false,
      message: 'Too many login attempts from this IP, please try again later.',
      retryAfter: 900,
    },
    skipSuccessfulRequests: true,
    skip: (_req) => {
      // Skip rate limiting outside production
      return process.env.NODE_ENV !== 'production';
    },
    handler: (req, res) => {
      logSecurityEvent('auth_rate_limit_exceeded', {
        ip: req.ip,
        url: req.url,
        email: req.body?.email,
        userAgent: req.get('User-Agent'),
      });

      res.status(429).json({
        success: false,
        message:
          'Too many login attempts from this IP, please try again later.',
        retryAfter: 900,
      });
    },
  });

  // Password reset rate limiter
  const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: process.env.NODE_ENV === 'production' ? 3 : 1000, // Strict in production only (relaxed in dev/test)
    message: {
      success: false,
      message: 'Too many password reset attempts, please try again later.',
      retryAfter: 3600,
    },
    skip: (_req) => {
      // Skip rate limiting outside production
      return process.env.NODE_ENV !== 'production';
    },
  });

  return {
    authLimiter,
    passwordResetLimiter,
  };
};

/**
 * XSS protection
 */
const xssProtection = (req, res, next) => {
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
  ];

  const sanitizeString = (str) => {
    if (typeof str !== 'string') {return str;}

    for (const pattern of xssPatterns) {
      // Global-flag regexes keep state in lastIndex — reset it before every
      // test, otherwise alternate calls start matching mid-string and
      // malicious payloads slip through unsanitized.
      pattern.lastIndex = 0;
      if (pattern.test(str)) {
        pattern.lastIndex = 0;
        logSecurityEvent('xss_attempt', {
          ip: req.ip,
          url: req.url,
          value: str,
          userAgent: req.get('User-Agent'),
        });

        return str.replace(pattern, '');
      }
    }

    return str;
  };

  const sanitizeObject = (obj) => {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (typeof obj[key] === 'string') {
          obj[key] = sanitizeString(obj[key]);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitizeObject(obj[key]);
        }
      }
    }
  };

  if (req.body) {sanitizeObject(req.body);}
  if (req.query) {sanitizeObject(req.query);}

  next();
};

module.exports = {
  setupSecurity,
  createRateLimiters,
  xssProtection,
};
