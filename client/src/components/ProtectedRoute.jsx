import React from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import LoadingSpinner from "./LoadingSpinner";
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  hasRole,
} from "../utils/permissions";

/**
 * ProtectedRoute Component
 * Handles authentication and authorization for routes
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components to render
 * @param {string} props.permission - Single permission required
 * @param {Array<string>} props.permissions - Any of these permissions required (OR logic)
 * @param {Array<string>} props.allPermissions - All of these permissions required (AND logic)
 * @param {string|Array<string>} props.roles - Required role(s)
 * @param {string} props.redirectTo - Custom redirect path on access denied
 */
const ProtectedRoute = ({
  children,
  permission = null,
  permissions = null,
  allPermissions = null,
  roles = null,
  redirectTo = "/login",
}) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to={redirectTo} replace />;
  }

  // Check role-based access
  if (roles && !hasRole(user, roles)) {
    return <AccessDenied navigate={navigate} reason="role" />;
  }

  // Check single permission
  if (permission && !hasPermission(user, permission)) {
    return <AccessDenied navigate={navigate} reason="permission" />;
  }

  // Check any of the permissions (OR logic)
  if (permissions && !hasAnyPermission(user, permissions)) {
    return <AccessDenied navigate={navigate} reason="permission" />;
  }

  // Check all permissions (AND logic)
  if (allPermissions && !hasAllPermissions(user, allPermissions)) {
    return <AccessDenied navigate={navigate} reason="permission" />;
  }

  // User has access - render children
  return children;
};

/**
 * AccessDenied Component
 * Displays when user doesn't have required permissions
 */
const AccessDenied = ({ navigate, reason = "permission" }) => {
  const messages = {
    role: {
      title: "Access Denied",
      description: "Your role doesn't have access to this page.",
    },
    permission: {
      title: "Insufficient Permissions",
      description:
        "You don't have the required permissions to access this page.",
    },
  };

  const message = messages[reason] || messages.permission;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        {/* Icon */}
        <div className="mb-6">
          <div className="mx-auto w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
            <i className="fas fa-lock text-4xl text-red-600"></i>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-gray-900 mb-3">
          {message.title}
        </h2>

        {/* Description */}
        <p className="text-gray-600 mb-6">{message.description}</p>

        {/* Additional Info */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <i className="fas fa-info-circle text-yellow-600 mt-0.5 mr-2"></i>
            <p className="text-sm text-yellow-800 text-left">
              If you believe you should have access to this page, please contact
              your administrator.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <i className="fas fa-arrow-left mr-2"></i>
            Go Back
          </button>
          <button
            onClick={() => navigate("/dashboard")}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <i className="fas fa-home mr-2"></i>
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProtectedRoute;
