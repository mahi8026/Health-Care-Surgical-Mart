/**
 * usePermissions Hook
 * Custom hook for checking user permissions in components
 */

import { useFirebaseAuth as useAuth } from "../contexts/FirebaseAuthContext";
import {
  hasPermission as checkPermission,
  hasAnyPermission as checkAnyPermission,
  hasAllPermissions as checkAllPermissions,
  hasRole as checkRole,
  isAdmin as checkIsAdmin,
  isSuperAdmin as checkIsSuperAdmin,
  isStaff as checkIsStaff,
  getUserPermissions,
} from "../utils/permissions";

/**
 * Hook to check user permissions
 * @returns {Object} Permission checking functions
 */
export const usePermissions = () => {
  const { user } = useAuth();

  return {
    /**
     * Check if user has a specific permission
     * @param {string} permission - Permission to check
     * @returns {boolean}
     */
    hasPermission: (permission) => checkPermission(user, permission),

    /**
     * Check if user has any of the specified permissions
     * @param {Array<string>} permissions - Array of permissions
     * @returns {boolean}
     */
    hasAnyPermission: (permissions) => checkAnyPermission(user, permissions),

    /**
     * Check if user has all of the specified permissions
     * @param {Array<string>} permissions - Array of permissions
     * @returns {boolean}
     */
    hasAllPermissions: (permissions) => checkAllPermissions(user, permissions),

    /**
     * Check if user has a specific role
     * @param {string|Array<string>} roles - Role(s) to check
     * @returns {boolean}
     */
    hasRole: (roles) => checkRole(user, roles),

    /**
     * Check if user is admin (SUPER_ADMIN or SHOP_ADMIN)
     * @returns {boolean}
     */
    isAdmin: () => checkIsAdmin(user),

    /**
     * Check if user is super admin
     * @returns {boolean}
     */
    isSuperAdmin: () => checkIsSuperAdmin(user),

    /**
     * Check if user is staff
     * @returns {boolean}
     */
    isStaff: () => checkIsStaff(user),

    /**
     * Get all permissions for current user
     * @returns {Array<string>}
     */
    getPermissions: () => getUserPermissions(user),

    /**
     * Get current user
     * @returns {Object|null}
     */
    user,
  };
};

export default usePermissions;
