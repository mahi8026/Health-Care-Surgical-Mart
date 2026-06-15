/**
 * usePermissions Hook
 * Provides permission checking functions for the authenticated user
 */

import { useAuth } from "../contexts/AuthContext";
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  hasRole,
  getUserPermissions,
  isAdmin,
  isSuperAdmin,
  isStaff,
} from "../utils/permissions";

/**
 * Custom hook to access permission checking functions
 * @returns {Object} Permission checking utilities
 */
export const usePermissions = () => {
  const { user } = useAuth();

  return {
    /**
     * Check if user has a specific permission
     * @param {string} permission - Permission to check
     * @returns {boolean}
     */
    hasPermission: (permission) => hasPermission(user, permission),

    /**
     * Check if user has any of the specified permissions (OR logic)
     * @param {Array<string>} permissions - Array of permissions
     * @returns {boolean}
     */
    hasAnyPermission: (permissions) => hasAnyPermission(user, permissions),

    /**
     * Check if user has all of the specified permissions (AND logic)
     * @param {Array<string>} permissions - Array of permissions
     * @returns {boolean}
     */
    hasAllPermissions: (permissions) => hasAllPermissions(user, permissions),

    /**
     * Check if user has a specific role or any of the specified roles
     * @param {string|Array<string>} roles - Role(s) to check
     * @returns {boolean}
     */
    hasRole: (roles) => hasRole(user, roles),

    /**
     * Get all permissions for the current user
     * @returns {Array<string>}
     */
    getUserPermissions: () => getUserPermissions(user),

    /**
     * Check if user is admin (SUPER_ADMIN or SHOP_ADMIN)
     * @returns {boolean}
     */
    isAdmin: () => isAdmin(user),

    /**
     * Check if user is super admin
     * @returns {boolean}
     */
    isSuperAdmin: () => isSuperAdmin(user),

    /**
     * Check if user is staff
     * @returns {boolean}
     */
    isStaff: () => isStaff(user),

    /**
     * Current user object
     */
    user,
  };
};

export default usePermissions;
