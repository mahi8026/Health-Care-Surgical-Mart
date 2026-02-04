/**
 * Security Configuration
 * Enterprise-grade security setup for the Medical Store POS System
 */

const rateLimit = require("express-rate-limit");
const { body, validationResult } = require("express-validator");
const { logSecurityEvent, securityLogger } = require("./logging");

/**
 * Setup comprehensive security configurations
 * @param {Express} app - Express application instance
 */
const setupSecurity = (app) => {
  // Security headers middleware
  app.use((req, res, next) => {
    // Remove server signature
    res.removeHeader("X-Powered-By");

    // Add security headers
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader(
      "Permissions-Policy",
      "geolocation=(), microphone=(), camera=()",
    );

    next();
  });

  // Request size limits
  app.use((req, res, next) => {
    const maxSize = parseInt(process.env.MAX_REQUEST_SIZE) || 10485760; // 10MB

    if (
      req.headers["content-length"] &&
      parseInt(req.headers["content-length"]) > maxSize
    ) {
      logSecurityEvent("request_too_large", {
        ip: req.ip,
        size: req.headers["content-length"],
        maxSize,
        url: req.url,
      });

      return res.status(413).json({
        success: false,
        message: "Request entity too large",
      });
    }

    next();
  });

  // IP whitelist/blacklist middleware (only in production)
  if (process.env.NODE_ENV === "production") {
    app.use((req, res, next) => {
      const clientIP = req.ip || req.connection.remoteAddress;
      const blacklistedIPs =
        process.env.BLACKLISTED_IPS?.split(",").filter((ip) => ip.trim()) || [];
      const whitelistedIPs =
        process.env.WHITELISTED_IPS?.split(",").filter((ip) => ip.trim()) || [];

      // Check blacklist
      if (blacklistedIPs.length > 0 && blacklistedIPs.includes(clientIP)) {
        logSecurityEvent("blacklisted_ip_access", {
          ip: clientIP,
          url: req.url,
          userAgent: req.get("User-Agent"),
        });

        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      // Check whitelist (only if explicitly configured with valid IPs)
      if (whitelistedIPs.length > 0 && !whitelistedIPs.includes(clientIP)) {
        logSecurityEvent("non_whitelisted_ip_access", {
          ip: clientIP,
          url: req.url,
          userAgent: req.get("User-Agent"),
        });

        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      next();
    });
  }

  securityLogger.info("Security middleware configured successfully");
};

/**
 * Enhanced rate limiting configurations
 */
const createRateLimiters = () => {
  // General API rate limiter
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
      success: false,
      message: "Too many requests from this IP, please try again later.",
      retryAfter: 900, // 15 minutes in seconds
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logSecurityEvent("rate_limit_exceeded", {
        ip: req.ip,
        url: req.url,
        userAgent: req.get("User-Agent"),
      });

      res.status(429).json({
        success: false,
        message: "Too many requests from this IP, please try again later.",
        retryAfter: 900,
      });
    },
  });

  // Strict rate limiter for authentication endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === "development" ? 1000 : 5, // Relaxed in development
    message: {
      success: false,
      message: "Too many login attempts from this IP, please try again later.",
      retryAfter: 900,
    },
    skipSuccessfulRequests: true,
    skip: (req) => {
      // Skip rate limiting in development
      return process.env.NODE_ENV === "development";
    },
    handler: (req, res) => {
      logSecurityEvent("auth_rate_limit_exceeded", {
        ip: req.ip,
        url: req.url,
        email: req.body?.email,
        userAgent: req.get("User-Agent"),
      });

      res.status(429).json({
        success: false,
        message:
          "Too many login attempts from this IP, please try again later.",
        retryAfter: 900,
      });
    },
  });

  // Password reset rate limiter
  const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: process.env.NODE_ENV === "development" ? 1000 : 3, // Relaxed in development
    message: {
      success: false,
      message: "Too many password reset attempts, please try again later.",
      retryAfter: 3600,
    },
    skip: (req) => {
      // Skip rate limiting in development
      return process.env.NODE_ENV === "development";
    },
  });

  return {
    apiLimiter,
    authLimiter,
    passwordResetLimiter,
  };
};

/**
 * Input validation and sanitization
 */
const createValidators = () => {
  // Login validation
  const validateLogin = [
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Valid email is required"),
    body("password")
      .isLength({ min: 6, max: 128 })
      .withMessage("Password must be between 6 and 128 characters"),
    body("shopId")
      .optional()
      .isAlphanumeric()
      .isLength({ min: 3, max: 50 })
      .withMessage("Shop ID must be alphanumeric and between 3-50 characters"),
  ];

  // Product validation
  const validateProduct = [
    body("name")
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage(
        "Product name is required and must be less than 200 characters",
      ),
    body("sku")
      .trim()
      .isAlphanumeric("en-US", { ignore: "-_" })
      .isLength({ min: 3, max: 50 })
      .withMessage("SKU must be alphanumeric and between 3-50 characters"),
    body("purchasePrice")
      .isFloat({ min: 0 })
      .withMessage("Purchase price must be a positive number"),
    body("sellingPrice")
      .isFloat({ min: 0 })
      .withMessage("Selling price must be a positive number"),
    body("category")
      .isIn(["Medical", "Lab", "Surgical"])
      .withMessage("Category must be Medical, Lab, or Surgical"),
    body("unit")
      .isIn(["pcs", "box", "pack", "bottle", "strip", "vial"])
      .withMessage("Invalid unit type"),
    body("minStockLevel")
      .isInt({ min: 0 })
      .withMessage("Minimum stock level must be a non-negative integer"),
  ];

  // Sale validation
  const validateSale = [
    body("items")
      .isArray({ min: 1 })
      .withMessage("Sale must have at least one item"),
    body("items.*.productId").isMongoId().withMessage("Invalid product ID"),
    body("items.*.qty")
      .isInt({ min: 1 })
      .withMessage("Quantity must be a positive integer"),
    body("grandTotal")
      .isFloat({ min: 0 })
      .withMessage("Grand total must be a positive number"),
    body("cashPaid")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Cash paid must be a non-negative number"),
    body("bankPaid")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Bank paid must be a non-negative number"),
  ];

  return {
    validateLogin,
    validateProduct,
    validateSale,
  };
};

/**
 * Validation error handler
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    logSecurityEvent("validation_failed", {
      ip: req.ip,
      url: req.url,
      errors: errors.array(),
      body: req.body,
    });

    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array(),
    });
  }

  next();
};

/**
 * SQL injection protection
 */
const sqlInjectionProtection = (req, res, next) => {
  const suspiciousPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
    /(--|\/\*|\*\/|;|'|"|`)/,
    /(\b(OR|AND)\b.*=.*)/i,
  ];

  const checkForSQLInjection = (obj, path = "") => {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];
        const currentPath = path ? `${path}.${key}` : key;

        if (typeof value === "string") {
          for (const pattern of suspiciousPatterns) {
            if (pattern.test(value)) {
              logSecurityEvent("sql_injection_attempt", {
                ip: req.ip,
                url: req.url,
                field: currentPath,
                value: value,
                userAgent: req.get("User-Agent"),
              });

              return res.status(400).json({
                success: false,
                message: "Invalid input detected",
              });
            }
          }
        } else if (typeof value === "object" && value !== null) {
          const result = checkForSQLInjection(value, currentPath);
          if (result) return result;
        }
      }
    }
    return null;
  };

  // Check request body
  if (req.body) {
    const result = checkForSQLInjection(req.body);
    if (result) return result;
  }

  // Check query parameters
  if (req.query) {
    const result = checkForSQLInjection(req.query);
    if (result) return result;
  }

  next();
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
    if (typeof str !== "string") return str;

    for (const pattern of xssPatterns) {
      if (pattern.test(str)) {
        logSecurityEvent("xss_attempt", {
          ip: req.ip,
          url: req.url,
          value: str,
          userAgent: req.get("User-Agent"),
        });

        return str.replace(pattern, "");
      }
    }

    return str;
  };

  const sanitizeObject = (obj) => {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (typeof obj[key] === "string") {
          obj[key] = sanitizeString(obj[key]);
        } else if (typeof obj[key] === "object" && obj[key] !== null) {
          sanitizeObject(obj[key]);
        }
      }
    }
  };

  if (req.body) sanitizeObject(req.body);
  if (req.query) sanitizeObject(req.query);

  next();
};

module.exports = {
  setupSecurity,
  createRateLimiters,
  createValidators,
  handleValidationErrors,
  sqlInjectionProtection,
  xssProtection,
};
