/**
 * Advanced Security Headers Middleware
 * Implements comprehensive security headers for production
 */

const crypto = require('crypto');
const { securityLogger } = require('../config/logging');

/**
 * Generate Content Security Policy nonce for inline scripts
 */
function generateNonce() {
  return crypto.randomBytes(16).toString('base64');
}

/**
 * Advanced security headers middleware
 */
function advancedSecurityHeaders(req, res, next) {
  // Generate nonce for CSP
  const nonce = generateNonce();
  req.nonce = nonce;

  // Strict Transport Security (HSTS)
  // Force HTTPS for 1 year, include subdomains
  res.setHeader(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  );

  // Content Security Policy (CSP)
  // Prevent XSS, clickjacking, and other code injection attacks
  const cspDirectives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://cdnjs.cloudflare.com https://unpkg.com`,
    "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com",
    "img-src 'self' data: https: blob:",
    "font-src 'self' https://cdnjs.cloudflare.com https://fonts.gstatic.com",
    "connect-src 'self' https://firebaseapp.com https://*.firebaseio.com https://*.googleapis.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests"
  ];
  
  res.setHeader('Content-Security-Policy', cspDirectives.join('; '));

  // X-Content-Type-Options
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // X-Frame-Options
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // X-XSS-Protection
  // Enable browser XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer-Policy
  // Control referrer information
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions-Policy (formerly Feature-Policy)
  // Disable unnecessary browser features
  const permissionsPolicy = [
    'geolocation=()',
    'microphone=()',
    'camera=()',
    'payment=()',
    'usb=()',
    'magnetometer=()',
    'gyroscope=()',
    'accelerometer=()'
  ];
  res.setHeader('Permissions-Policy', permissionsPolicy.join(', '));

  // X-Permitted-Cross-Domain-Policies
  // Restrict Adobe Flash and PDF cross-domain requests
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

  // X-Download-Options
  // Prevent IE from executing downloads in site's context
  res.setHeader('X-Download-Options', 'noopen');

  // X-DNS-Prefetch-Control
  // Control DNS prefetching
  res.setHeader('X-DNS-Prefetch-Control', 'off');

  // Remove server signature
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');

  // Cache-Control for sensitive endpoints
  if (req.path.includes('/api/auth') || req.path.includes('/api/users')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  next();
}

/**
 * Request sanitization middleware
 * Prevents common injection attacks
 */
function sanitizeRequest(req, res, next) {
  // Detect and block NoSQL injection attempts
  const noSqlInjectionPatterns = [
    /\$where/i,
    /\$ne/i,
    /\$gt/i,
    /\$lt/i,
    /\$or/i,
    /\$and/i,
    /\$regex/i,
    /\$exists/i
  ];

  const checkForInjection = (obj, path = '') => {
    if (typeof obj === 'string') {
      for (const pattern of noSqlInjectionPatterns) {
        if (pattern.test(obj)) {
          securityLogger.warn('NoSQL injection attempt detected', {
            ip: req.ip,
            path: req.path,
            field: path,
            value: obj,
            userAgent: req.get('User-Agent')
          });
          return true;
        }
      }
    } else if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        // Check key names for injection patterns
        for (const pattern of noSqlInjectionPatterns) {
          if (pattern.test(key)) {
            securityLogger.warn('NoSQL injection attempt in key', {
              ip: req.ip,
              path: req.path,
              key: key,
              userAgent: req.get('User-Agent')
            });
            return true;
          }
        }
        // Recursively check values
        if (checkForInjection(obj[key], `${path}.${key}`)) {
          return true;
        }
      }
    }
    return false;
  };

  // Check request body
  if (req.body && checkForInjection(req.body)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid request: potential injection detected'
    });
  }

  // Check query parameters
  if (req.query && checkForInjection(req.query)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid request: potential injection detected'
    });
  }

  next();
}

/**
 * Timing attack prevention for authentication
 * Ensures constant-time comparison
 */
function constantTimeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

  const aLen = Buffer.byteLength(a);
  const bLen = Buffer.byteLength(b);
  
  // Use crypto.timingSafeEqual for constant-time comparison
  const bufA = Buffer.alloc(Math.max(aLen, bLen), 0, 'utf8');
  bufA.write(a);
  
  const bufB = Buffer.alloc(Math.max(aLen, bLen), 0, 'utf8');
  bufB.write(b);

  return crypto.timingSafeEqual(bufA, bufB) && aLen === bLen;
}

/**
 * Session fixation prevention
 * Regenerate session ID after authentication
 */
function preventSessionFixation(req, res, next) {
  // Add session regeneration flag
  req.regenerateSession = () => {
    // This will be used in auth routes to regenerate JWT
    req.sessionRegenerated = true;
  };
  next();
}

/**
 * Brute force protection with exponential backoff and account lockout
 */
const loginAttempts = new Map();
const ACCOUNT_LOCKOUT_THRESHOLD = 10; // Lock account after 10 failed attempts
const ACCOUNT_LOCKOUT_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds

function bruteForceProtection(req, res, next) {
  const identifier = req.body.email || req.ip;
  const now = Date.now();
  
  if (!loginAttempts.has(identifier)) {
    loginAttempts.set(identifier, { count: 0, lastAttempt: now, lockedUntil: null });
    return next();
  }

  const attempts = loginAttempts.get(identifier);
  
  // Check if account is locked
  if (attempts.lockedUntil && now < attempts.lockedUntil) {
    const remainingTime = Math.ceil((attempts.lockedUntil - now) / 1000 / 60); // minutes
    
    securityLogger.warn('Account lockout - login attempt during lockout period', {
      ip: req.ip,
      identifier,
      attempts: attempts.count,
      remainingTime: `${remainingTime} minutes`
    });

    return res.status(423).json({ // 423 Locked
      success: false,
      message: `Account temporarily locked due to too many failed login attempts. Please try again in ${remainingTime} minutes or contact support.`,
      retryAfter: Math.ceil((attempts.lockedUntil - now) / 1000),
      lockedUntil: new Date(attempts.lockedUntil).toISOString()
    });
  }
  
  // If lockout period expired, reset attempts
  if (attempts.lockedUntil && now >= attempts.lockedUntil) {
    loginAttempts.set(identifier, { count: 0, lastAttempt: now, lockedUntil: null });
    return next();
  }
  
  const timeSinceLastAttempt = now - attempts.lastAttempt;
  
  // Exponential backoff: 2^(attempts-5) seconds after 5 failed attempts (before lockout)
  if (attempts.count >= 5 && attempts.count < ACCOUNT_LOCKOUT_THRESHOLD) {
    const backoffTime = Math.pow(2, attempts.count - 5) * 1000; // milliseconds
    
    if (timeSinceLastAttempt < backoffTime) {
      const waitTime = Math.ceil((backoffTime - timeSinceLastAttempt) / 1000);
      
      securityLogger.warn('Brute force attempt detected', {
        ip: req.ip,
        identifier,
        attempts: attempts.count,
        waitTime
      });

      return res.status(429).json({
        success: false,
        message: `Too many failed attempts. Please wait ${waitTime} seconds before trying again.`,
        retryAfter: waitTime
      });
    }
  }

  // Update last attempt time
  attempts.lastAttempt = now;
  loginAttempts.set(identifier, attempts);

  // Attach function to increment attempts on auth failure
  req.incrementLoginAttempts = () => {
    attempts.count++;
    
    // Lock account after threshold reached
    if (attempts.count >= ACCOUNT_LOCKOUT_THRESHOLD) {
      attempts.lockedUntil = now + ACCOUNT_LOCKOUT_DURATION;
      
      securityLogger.error('Account locked due to excessive failed login attempts', {
        ip: req.ip,
        identifier,
        attempts: attempts.count,
        lockoutDuration: `${ACCOUNT_LOCKOUT_DURATION / 1000 / 60} minutes`,
        lockedUntil: new Date(attempts.lockedUntil).toISOString()
      });
    }
    
    loginAttempts.set(identifier, attempts);
  };

  // Attach function to reset attempts on auth success
  req.resetLoginAttempts = () => {
    loginAttempts.delete(identifier);
  };

  // Clean up old entries (older than 1 hour)
  for (const [key, value] of loginAttempts.entries()) {
    if (now - value.lastAttempt > 3600000 && (!value.lockedUntil || now > value.lockedUntil)) {
      loginAttempts.delete(key);
    }
  }

  next();
}

/**
 * API key validation for external integrations
 */
function validateApiKey(req, res, next) {
  // Skip if not an API key endpoint
  if (!req.path.startsWith('/api/external')) {
    return next();
  }

  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      message: 'API key required'
    });
  }

  // Validate API key format (should be 64 hex characters)
  if (!/^[a-f0-9]{64}$/i.test(apiKey)) {
    securityLogger.warn('Invalid API key format', {
      ip: req.ip,
      path: req.path
    });

    return res.status(401).json({
      success: false,
      message: 'Invalid API key format'
    });
  }

  // TODO: Validate against database of API keys
  // For now, just check if it matches environment variable
  const validApiKey = process.env.EXTERNAL_API_KEY;
  
  if (!validApiKey || !constantTimeCompare(apiKey, validApiKey)) {
    securityLogger.warn('Invalid API key attempt', {
      ip: req.ip,
      path: req.path
    });

    return res.status(401).json({
      success: false,
      message: 'Invalid API key'
    });
  }

  next();
}

module.exports = {
  advancedSecurityHeaders,
  sanitizeRequest,
  constantTimeCompare,
  preventSessionFixation,
  bruteForceProtection,
  validateApiKey,
  generateNonce
};
