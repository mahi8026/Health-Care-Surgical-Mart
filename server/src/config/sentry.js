/**
 * Sentry Configuration for Backend Error Tracking
 * Captures and reports errors to Sentry for monitoring and debugging
 * 
 * @version 1.0.0
 */

const Sentry = require("@sentry/node");
// Profiling disabled due to C++ binding compatibility issues
// const { ProfilingIntegration } = require("@sentry/profiling-node");
const { logger } = require("./logging");

/**
 * Initialize Sentry for error tracking
 * @param {Express} app - Express application instance
 */
const initializeSentry = (app) => {
  // Only initialize if DSN is provided
  if (!process.env.SENTRY_DSN) {
    logger.warn("Sentry DSN not configured - error tracking disabled");
    return;
  }

  try {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      
      // Environment configuration
      environment: process.env.NODE_ENV || "development",
      
      // Release tracking (use git commit hash or version)
      release: process.env.SENTRY_RELEASE || `medical-store-pos@${process.env.npm_package_version || "2.0.0"}`,
      
      // Performance monitoring
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0, // 10% in production, 100% in dev
      
      // Profiling disabled due to compatibility issues
      // profilesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
      
      integrations: [
        // Enable HTTP instrumentation
        new Sentry.Integrations.Http({ tracing: true }),
        
        // Enable Express instrumentation
        new Sentry.Integrations.Express({ app }),
        
        // Enable MongoDB instrumentation
        new Sentry.Integrations.Mongo({
          useMongoose: false, // We use native MongoDB driver
        }),
        
        // Profiling disabled due to compatibility issues
        // new ProfilingIntegration(),
      ],
      
      // Filter out sensitive data
      beforeSend(event, hint) {
        // Remove sensitive headers
        if (event.request?.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
        }
        
        // Remove sensitive query parameters
        if (event.request?.query_string) {
          const sensitiveParams = ["token", "password", "secret", "api_key"];
          sensitiveParams.forEach(param => {
            if (event.request.query_string.includes(param)) {
              event.request.query_string = event.request.query_string.replace(
                new RegExp(`${param}=[^&]*`, "gi"),
                `${param}=[REDACTED]`
              );
            }
          });
        }
        
        // Remove sensitive data from request body
        if (event.request?.data) {
          const data = typeof event.request.data === "string" 
            ? JSON.parse(event.request.data) 
            : event.request.data;
          
          const sensitiveFields = [
            "password",
            "token",
            "secret",
            "apiKey",
            "api_key",
            "creditCard",
            "ssn",
            "firebaseServiceAccount",
          ];
          
          sensitiveFields.forEach(field => {
            if (data && data[field]) {
              data[field] = "[REDACTED]";
            }
          });
          
          event.request.data = JSON.stringify(data);
        }
        
        return event;
      },
      
      // Ignore specific errors
      ignoreErrors: [
        // Browser/network errors
        "Network request failed",
        "NetworkError",
        "Failed to fetch",
        
        // Expected validation errors
        "ValidationError",
        
        // Rate limiting (expected behavior)
        "Too many requests",
        
        // CORS (handled separately)
        "CORS",
      ],
      
      // Don't report errors from these URLs
      denyUrls: [
        // Browser extensions
        /extensions\//i,
        /^chrome:\/\//i,
        /^moz-extension:\/\//i,
      ],
    });

    logger.info("Sentry initialized successfully", {
      environment: process.env.NODE_ENV,
      release: process.env.SENTRY_RELEASE || `medical-store-pos@${process.env.npm_package_version || "2.0.0"}`,
    });
  } catch (error) {
    logger.error("Failed to initialize Sentry:", error);
  }
};

/**
 * Setup Sentry request handler (must be first middleware)
 */
const setupSentryRequestHandler = (app) => {
  if (process.env.SENTRY_DSN) {
    app.use(Sentry.Handlers.requestHandler());
    app.use(Sentry.Handlers.tracingHandler());
  }
};

/**
 * Setup Sentry error handler (must be before other error handlers)
 */
const setupSentryErrorHandler = (app) => {
  if (process.env.SENTRY_DSN) {
    app.use(Sentry.Handlers.errorHandler({
      shouldHandleError(error) {
        // Only send errors with status code >= 500 to Sentry
        // Client errors (4xx) are logged but not sent to Sentry
        if (error.statusCode && error.statusCode < 500) {
          return false;
        }
        return true;
      },
    }));
  }
};

/**
 * Manually capture an exception
 * @param {Error} error - Error object
 * @param {Object} context - Additional context
 */
const captureException = (error, context = {}) => {
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error, {
      extra: context,
    });
  }
  
  // Always log to Winston as well
  logger.error("Exception captured:", {
    error: error.message,
    stack: error.stack,
    ...context,
  });
};

/**
 * Manually capture a message
 * @param {string} message - Message to capture
 * @param {string} level - Severity level (info, warning, error)
 * @param {Object} context - Additional context
 */
const captureMessage = (message, level = "info", context = {}) => {
  if (process.env.SENTRY_DSN) {
    Sentry.captureMessage(message, {
      level,
      extra: context,
    });
  }
  
  logger[level](message, context);
};

/**
 * Set user context for error tracking
 * @param {Object} user - User object
 */
const setUserContext = (user) => {
  if (process.env.SENTRY_DSN && user) {
    Sentry.setUser({
      id: user._id?.toString() || user.id,
      email: user.email,
      username: user.name,
      role: user.role,
      shopId: user.shopId,
    });
  }
};

/**
 * Clear user context (on logout)
 */
const clearUserContext = () => {
  if (process.env.SENTRY_DSN) {
    Sentry.setUser(null);
  }
};

/**
 * Add breadcrumb for debugging
 * @param {Object} breadcrumb - Breadcrumb data
 */
const addBreadcrumb = (breadcrumb) => {
  if (process.env.SENTRY_DSN) {
    Sentry.addBreadcrumb(breadcrumb);
  }
};

/**
 * Flush Sentry events (useful before shutdown)
 * @param {number} timeout - Timeout in milliseconds
 */
const flush = async (timeout = 2000) => {
  if (process.env.SENTRY_DSN) {
    try {
      await Sentry.close(timeout);
      logger.info("Sentry events flushed");
    } catch (error) {
      logger.error("Failed to flush Sentry events:", error);
    }
  }
};

module.exports = {
  initializeSentry,
  setupSentryRequestHandler,
  setupSentryErrorHandler,
  captureException,
  captureMessage,
  setUserContext,
  clearUserContext,
  addBreadcrumb,
  flush,
  Sentry, // Export for direct access if needed
};
