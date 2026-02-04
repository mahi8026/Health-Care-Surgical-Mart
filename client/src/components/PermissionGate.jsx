/**
 * PermissionGate Component
 * Conditionally renders children based on user permissions
 */

import React from "react";
import { usePermissions } from "../hooks/usePermissions";

/**
 * PermissionGate - Renders children only if user has required permissions
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Content to render if permission check passes
 * @param {string} props.permission - Single permission required
 * @param {Array<string>} props.permissions - Any of these permissions required (OR logic)
 * @param {Array<string>} props.allPermissions - All of these permissions required (AND logic)
 * @param {string|Array<string>} props.roles - Required role(s)
 * @param {React.ReactNode} props.fallback - Content to render if permission check fails
 * @param {boolean} props.showFallback - Whether to show fallback content (default: false)
 *
 * @example
 * // Single permission
 * <PermissionGate permission={PERMISSIONS.CREATE_EXPENSE}>
 *   <button>Add Expense</button>
 * </PermissionGate>
 *
 * @example
 * // Any of multiple permissions
 * <PermissionGate permissions={[PERMISSIONS.EDIT_EXPENSE, PERMISSIONS.DELETE_EXPENSE]}>
 *   <button>Manage Expense</button>
 * </PermissionGate>
 *
 * @example
 * // All permissions required
 * <PermissionGate allPermissions={[PERMISSIONS.VIEW_EXPENSES, PERMISSIONS.EXPORT_REPORTS]}>
 *   <button>Export Expenses</button>
 * </PermissionGate>
 *
 * @example
 * // Role-based
 * <PermissionGate roles={["SHOP_ADMIN", "SUPER_ADMIN"]}>
 *   <button>Admin Panel</button>
 * </PermissionGate>
 *
 * @example
 * // With fallback
 * <PermissionGate
 *   permission={PERMISSIONS.CREATE_EXPENSE}
 *   fallback={<p>You don't have permission to add expenses</p>}
 *   showFallback={true}
 * >
 *   <button>Add Expense</button>
 * </PermissionGate>
 */
const PermissionGate = ({
  children,
  permission = null,
  permissions = null,
  allPermissions = null,
  roles = null,
  fallback = null,
  showFallback = false,
}) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions, hasRole } =
    usePermissions();

  // Check role-based access
  if (roles && !hasRole(roles)) {
    return showFallback ? fallback : null;
  }

  // Check single permission
  if (permission && !hasPermission(permission)) {
    return showFallback ? fallback : null;
  }

  // Check any of the permissions (OR logic)
  if (permissions && !hasAnyPermission(permissions)) {
    return showFallback ? fallback : null;
  }

  // Check all permissions (AND logic)
  if (allPermissions && !hasAllPermissions(allPermissions)) {
    return showFallback ? fallback : null;
  }

  // User has required permissions - render children
  return <>{children}</>;
};

export default PermissionGate;
