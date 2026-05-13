/**
 * Sentry Configuration for Frontend Error Tracking
 * Captures and reports errors to Sentry for monitoring and debugging
 *
 * @version 2.0.0 - Updated for @sentry/react v8 API
 */

import * as Sentry from "@sentry/react";
import {
  useLocation,
  useNavigationType,
  createRoutesFromChildren,
  matchRoutes,
} from "react-router-dom";

/**
 * Initialize Sentry for error tracking
 */
export const initializeSentry = () => {
  // Only initialize if DSN is provided
  if (!import.meta.env.VITE_SENTRY_DSN) {
    console.warn("Sentry DSN not configured - error tracking disabled");
    return;
  }

  try {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,

      // Environment configuration
      environment: import.meta.env.MODE || "development",

      // Release tracking (use git commit hash or version)
      release:
        import.meta.env.VITE_SENTRY_RELEASE ||
        `medical-store-pos-client@${import.meta.env.VITE_APP_VERSION || "2.0.0"}`,

      // Performance monitoring integrations (v8 API)
      integrations: [
        // React Router v6 integration for route-based tracing
        Sentry.reactRouterV6BrowserTracingIntegration({
          useEffect: Sentry.reactRouterV6BrowserTracingIntegration,
          useLocation,
          useNavigationType,
          createRoutesFromChildren,
          matchRoutes,
        }),

        // Replay integration for session replay (optional)
        Sentry.replayIntegration({
          maskAllText: true, // Mask all text for privacy
          blockAllMedia: true, // Block all media for privacy
        }),
      ],
      
      // Performance monitoring sample rate
      tracesSampleRate: import.meta.env.MODE === "production" ? 0.1 : 1.0, // 10% in production, 100% in dev
      
      // Session replay sample rate
      replaysSessionSampleRate: 0.1, // 10% of sessions
      replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors
      
      // Filter out sensitive data
      beforeSend(event, hint) {
        // Remove sensitive data from request
        if (event.request) {
          // Remove authorization headers
          if (event.request.headers) {
            delete event.request.headers.Authorization;
            delete event.request.headers.authorization;
            delete event.request.headers.Cookie;
            delete event.request.headers.cookie;
          }
          
          // Remove sensitive query parameters
          if (event.request.query_string) {
            const sensitiveParams = ["token", "password", "secret", "api_key", "apiKey"];
            sensitiveParams.forEach(param => {
              if (event.request.query_string.includes(param)) {
                event.request.query_string = event.request.query_string.replace(
                  new RegExp(`${param}=[^&]*`, "gi"),
                  `${param}=[REDACTED]`
                );
              }
            });
          }
        }
        
        // Remove sensitive data from breadcrumbs
        if (event.breadcrumbs) {
          event.breadcrumbs = event.breadcrumbs.map(breadcrumb => {
            if (breadcrumb.data) {
              const sensitiveKeys = ["password", "token", "secret", "apiKey", "api_key"];
              sensitiveKeys.forEach(key => {
                if (breadcrumb.data[key]) {
                  breadcrumb.data[key] = "[REDACTED]";
                }
              });
            }
            return breadcrumb;
          });
        }
        
        // Remove sensitive data from extra context
        if (event.extra) {
          const sensitiveKeys = ["password", "token", "secret", "apiKey", "api_key", "firebaseConfig"];
          sensitiveKeys.forEach(key => {
            if (event.extra[key]) {
              event.extra[key] = "[REDACTED]";
            }
          });
        }
        
        return event;
      },
      
      // Ignore specific errors
      ignoreErrors: [
        // Browser/network errors
        "Network request failed",
        "NetworkError",
        "Failed to fetch",
        "Load failed",
        
        // ResizeObserver errors (common and harmless)
        "ResizeObserver loop limit exceeded",
        "ResizeObserver loop completed with undelivered notifications",
        
        // Firebase errors that are expected
        "Firebase: Error (auth/popup-closed-by-user)",
        "Firebase: Error (auth/cancelled-popup-request)",
        
        // React errors that are expected
        "Minified React error",
        
        // Browser extension errors
        "Extension context invalidated",
        "chrome-extension://",
        "moz-extension://",
      ],
      
      // Don't report errors from these URLs
      denyUrls: [
        // Browser extensions
        /extensions\//i,
        /^chrome:\/\//i,
        /^moz-extension:\/\//i,
        /^chrome-extension:\/\//i,
      ],
    });

    console.log("Sentry initialized successfully", {
      environment: import.meta.env.MODE,
      release: import.meta.env.VITE_SENTRY_RELEASE || `medical-store-pos-client@${import.meta.env.VITE_APP_VERSION || "2.0.0"}`,
    });
  } catch (error) {
    console.error("Failed to initialize Sentry:", error);
  }
};

/**
 * Set user context for error tracking
 * @param {Object} user - User object
 */
export const setUserContext = (user) => {
  if (import.meta.env.VITE_SENTRY_DSN && user) {
    Sentry.setUser({
      id: user._id || user.id,
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
export const clearUserContext = () => {
  if (import.meta.env.VITE_SENTRY_DSN) {
    Sentry.setUser(null);
  }
};

/**
 * Manually capture an exception
 * @param {Error} error - Error object
 * @param {Object} context - Additional context
 */
export const captureException = (error, context = {}) => {
  if (import.meta.env.VITE_SENTRY_DSN) {
    Sentry.captureException(error, {
      extra: context,
    });
  }
  
  // Always log to console as well
  console.error("Exception captured:", error, context);
};

/**
 * Manually capture a message
 * @param {string} message - Message to capture
 * @param {string} level - Severity level (info, warning, error)
 * @param {Object} context - Additional context
 */
export const captureMessage = (message, level = "info", context = {}) => {
  if (import.meta.env.VITE_SENTRY_DSN) {
    Sentry.captureMessage(message, {
      level,
      extra: context,
    });
  }
  
  console[level](message, context);
};

/**
 * Add breadcrumb for debugging
 * @param {Object} breadcrumb - Breadcrumb data
 */
export const addBreadcrumb = (breadcrumb) => {
  if (import.meta.env.VITE_SENTRY_DSN) {
    Sentry.addBreadcrumb(breadcrumb);
  }
};

// Export Sentry for direct access
export { Sentry };
