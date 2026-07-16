/**
 * Error Boundary Component
 * Catches React errors and displays a fallback UI
 * Integrates with Sentry for error reporting
 * 
 * @version 1.0.0
 */

import React from "react";
import * as Sentry from "@sentry/react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

/**
 * Fallback UI component shown when an error occurs
 */
const ErrorFallback = ({ error, resetError, eventId }) => {
  const handleReload = () => {
    window.location.reload();
  };

  const handleGoHome = () => {
    window.location.href = "/dashboard";
  };

  const handleReportFeedback = () => {
    if (import.meta.env.VITE_SENTRY_DSN && eventId) {
      Sentry.showReportDialog({ eventId });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
        {/* Error Icon */}
        <div className="flex justify-center mb-6">
          <div className="bg-red-100 rounded-full p-4">
            <AlertTriangle className="w-12 h-12 text-red-600" />
          </div>
        </div>

        {/* Error Title */}
        <h1 className="text-3xl font-bold text-gray-900 text-center mb-4">
          Oops! Something went wrong
        </h1>

        {/* Error Description */}
        <p className="text-gray-600 text-center mb-6">
          We&apos;re sorry for the inconvenience. An unexpected error has occurred.
          Our team has been notified and is working on a fix.
        </p>

        {/* Error Details (only in development) */}
        {import.meta.env.MODE === "development" && error && (
          <div className="bg-gray-100 rounded-lg p-4 mb-6 overflow-auto">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Error Details (Development Only):
            </h3>
            <pre className="text-xs text-red-600 whitespace-pre-wrap break-words">
              {error.toString()}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </div>
        )}

        {/* Event ID (for support) */}
        {eventId && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800">
              <strong>Error ID:</strong> {eventId}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Please provide this ID when contacting support.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {/* Try Again Button */}
          <button
            onClick={resetError}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
            Try Again
          </button>

          {/* Go to Dashboard Button */}
          <button
            onClick={handleGoHome}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Home className="w-5 h-5" />
            Go to Dashboard
          </button>

          {/* Reload Page Button */}
          <button
            onClick={handleReload}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
            Reload Page
          </button>
        </div>

        {/* Report Feedback (if Sentry is configured) */}
        {import.meta.env.VITE_SENTRY_DSN && eventId && (
          <div className="mt-6 text-center">
            <button
              onClick={handleReportFeedback}
              className="text-sm text-blue-600 hover:text-blue-800 underline"
            >
              Report feedback about this error
            </button>
          </div>
        )}

        {/* Help Text */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-500 text-center">
            If this problem persists, please contact support at{" "}
            <a
              href="mailto:support@healthcaresurgicalmart.com"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              support@healthcaresurgicalmart.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

/**
 * Error Boundary Component using Sentry
 * Wraps the application to catch and handle errors
 */
const ErrorBoundary = Sentry.withErrorBoundary(
  ({ children }) => children,
  {
    fallback: ({ error, resetError, eventId }) => (
      <ErrorFallback error={error} resetError={resetError} eventId={eventId} />
    ),
    showDialog: false, // We handle the dialog manually in ErrorFallback
    beforeCapture: (scope, error, errorInfo) => {
      // Add additional context before sending to Sentry
      scope.setContext("errorInfo", {
        componentStack: errorInfo.componentStack,
      });
      
      // Add tags for better filtering
      scope.setTag("error_boundary", "react");
      
      // Add breadcrumb
      scope.addBreadcrumb({
        category: "error_boundary",
        message: "React Error Boundary caught an error",
        level: "error",
      });
    },
  }
);

export default ErrorBoundary;
