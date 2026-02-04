/**
 * Permission Utility
 * Centralized permission checking and role management
 */

// Role definitions
export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  SHOP_ADMIN: "SHOP_ADMIN",
  STAFF: "STAFF",
};

// Permission definitions
export const PERMISSIONS = {
  // Shop Management (SUPER_ADMIN only)
  CREATE_SHOP: "create_shop",
  VIEW_ALL_SHOPS: "view_all_shops",
  SUSPEND_SHOP: "suspend_shop",
  DELETE_SHOP: "delete_shop",
  VIEW_USAGE_STATS: "view_usage_stats",

  // User Management
  CREATE_SHOP_ADMIN: "create_shop_admin",
  CREATE_STAFF: "create_staff",
  EDIT_USER: "edit_user",
  DELETE_USER: "delete_user",
  VIEW_USERS: "view_users",

  // Product Management
  CREATE_PRODUCT: "create_product",
  EDIT_PRODUCT: "edit_product",
  DELETE_PRODUCT: "delete_product",
  VIEW_PRODUCTS: "view_products",

  // Stock Management
  MANAGE_STOCK: "manage_stock",
  VIEW_STOCK: "view_stock",

  // Sales
  CREATE_SALE: "create_sale",
  EDIT_SALE: "edit_sale",
  DELETE_SALE: "delete_sale",
  VIEW_SALES: "view_sales",

  // Returns
  CREATE_RETURN: "create_return",
  EDIT_RETURN: "edit_return",
  DELETE_RETURN: "delete_return",
  VIEW_RETURNS: "view_returns",
  APPROVE_RETURN: "approve_return",

  // Purchases
  CREATE_PURCHASE: "create_purchase",
  EDIT_PURCHASE: "edit_purchase",
  DELETE_PURCHASE: "delete_purchase",
  VIEW_PURCHASES: "view_purchases",

  // Suppliers
  CREATE_SUPPLIER: "create_supplier",
  EDIT_SUPPLIER: "edit_supplier",
  DELETE_SUPPLIER: "delete_supplier",
  VIEW_SUPPLIERS: "view_suppliers",

  // Customers
  CREATE_CUSTOMER: "create_customer",
  EDIT_CUSTOMER: "edit_customer",
  DELETE_CUSTOMER: "delete_customer",
  VIEW_CUSTOMERS: "view_customers",

  // Reports
  VIEW_SALES_REPORT: "view_sales_report",
  VIEW_PROFIT_REPORT: "view_profit_report",
  VIEW_STOCK_REPORT: "view_stock_report",
  VIEW_PURCHASE_REPORT: "view_purchase_report",
  EXPORT_REPORTS: "export_reports",

  // Expense Categories
  CREATE_EXPENSE_CATEGORY: "create_expense_category",
  EDIT_EXPENSE_CATEGORY: "edit_expense_category",
  DELETE_EXPENSE_CATEGORY: "delete_expense_category",
  VIEW_EXPENSE_CATEGORIES: "view_expense_categories",

  // Expenses
  CREATE_EXPENSE: "create_expense",
  EDIT_EXPENSE: "edit_expense",
  DELETE_EXPENSE: "delete_expense",
  VIEW_EXPENSES: "view_expenses",
  UPLOAD_RECEIPT: "upload_receipt",

  // Settings
  VIEW_SETTINGS: "view_settings",
  EDIT_SETTINGS: "edit_settings",
};

// Role-Permission Mapping
const ROLE_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: Object.values(PERMISSIONS), // All permissions

  [ROLES.SHOP_ADMIN]: [
    // User management within shop
    PERMISSIONS.CREATE_STAFF,
    PERMISSIONS.EDIT_USER,
    PERMISSIONS.DELETE_USER,
    PERMISSIONS.VIEW_USERS,

    // Full product management
    PERMISSIONS.CREATE_PRODUCT,
    PERMISSIONS.EDIT_PRODUCT,
    PERMISSIONS.DELETE_PRODUCT,
    PERMISSIONS.VIEW_PRODUCTS,

    // Full stock management
    PERMISSIONS.MANAGE_STOCK,
    PERMISSIONS.VIEW_STOCK,

    // Full sales management
    PERMISSIONS.CREATE_SALE,
    PERMISSIONS.EDIT_SALE,
    PERMISSIONS.DELETE_SALE,
    PERMISSIONS.VIEW_SALES,

    // Full returns management
    PERMISSIONS.CREATE_RETURN,
    PERMISSIONS.EDIT_RETURN,
    PERMISSIONS.DELETE_RETURN,
    PERMISSIONS.VIEW_RETURNS,
    PERMISSIONS.APPROVE_RETURN,

    // Full purchase management
    PERMISSIONS.CREATE_PURCHASE,
    PERMISSIONS.EDIT_PURCHASE,
    PERMISSIONS.DELETE_PURCHASE,
    PERMISSIONS.VIEW_PURCHASES,

    // Full supplier management
    PERMISSIONS.CREATE_SUPPLIER,
    PERMISSIONS.EDIT_SUPPLIER,
    PERMISSIONS.DELETE_SUPPLIER,
    PERMISSIONS.VIEW_SUPPLIERS,

    // Full customer management
    PERMISSIONS.CREATE_CUSTOMER,
    PERMISSIONS.EDIT_CUSTOMER,
    PERMISSIONS.DELETE_CUSTOMER,
    PERMISSIONS.VIEW_CUSTOMERS,

    // All reports
    PERMISSIONS.VIEW_SALES_REPORT,
    PERMISSIONS.VIEW_PROFIT_REPORT,
    PERMISSIONS.VIEW_STOCK_REPORT,
    PERMISSIONS.VIEW_PURCHASE_REPORT,
    PERMISSIONS.EXPORT_REPORTS,

    // Full expense category management
    PERMISSIONS.CREATE_EXPENSE_CATEGORY,
    PERMISSIONS.EDIT_EXPENSE_CATEGORY,
    PERMISSIONS.DELETE_EXPENSE_CATEGORY,
    PERMISSIONS.VIEW_EXPENSE_CATEGORIES,

    // Full expense management
    PERMISSIONS.CREATE_EXPENSE,
    PERMISSIONS.EDIT_EXPENSE,
    PERMISSIONS.DELETE_EXPENSE,
    PERMISSIONS.VIEW_EXPENSES,
    PERMISSIONS.UPLOAD_RECEIPT,

    // Settings
    PERMISSIONS.VIEW_SETTINGS,
    PERMISSIONS.EDIT_SETTINGS,
  ],

  [ROLES.STAFF]: [
    // Limited product access
    PERMISSIONS.VIEW_PRODUCTS,

    // View stock only
    PERMISSIONS.VIEW_STOCK,

    // Create sales (POS)
    PERMISSIONS.CREATE_SALE,
    PERMISSIONS.VIEW_SALES,

    // View returns
    PERMISSIONS.VIEW_RETURNS,

    // View purchases
    PERMISSIONS.VIEW_PURCHASES,

    // View suppliers
    PERMISSIONS.VIEW_SUPPLIERS,

    // View customers
    PERMISSIONS.VIEW_CUSTOMERS,

    // Limited reports (no profit)
    PERMISSIONS.VIEW_SALES_REPORT,
    PERMISSIONS.VIEW_STOCK_REPORT,

    // View expense categories only
    PERMISSIONS.VIEW_EXPENSE_CATEGORIES,

    // Limited expense access (view only)
    PERMISSIONS.VIEW_EXPENSES,

    // View settings only
    PERMISSIONS.VIEW_SETTINGS,
  ],
};

/**
 * Check if a user has a specific permission
 * @param {Object} user - User object with role
 * @param {string} permission - Permission to check
 * @returns {boolean}
 */
export const hasPermission = (user, permission) => {
  if (!user || !user.role) {
    return false;
  }

  // Check custom permissions first (if user has custom permissions)
  if (user.permissions && Array.isArray(user.permissions)) {
    if (user.permissions.includes(permission)) {
      return true;
    }
  }

  // Check role-based permissions
  const rolePermissions = ROLE_PERMISSIONS[user.role] || [];
  return rolePermissions.includes(permission);
};

/**
 * Check if a user has any of the specified permissions
 * @param {Object} user - User object with role
 * @param {Array<string>} permissions - Array of permissions to check
 * @returns {boolean}
 */
export const hasAnyPermission = (user, permissions) => {
  if (!Array.isArray(permissions) || permissions.length === 0) {
    return true;
  }

  return permissions.some((permission) => hasPermission(user, permission));
};

/**
 * Check if a user has all of the specified permissions
 * @param {Object} user - User object with role
 * @param {Array<string>} permissions - Array of permissions to check
 * @returns {boolean}
 */
export const hasAllPermissions = (user, permissions) => {
  if (!Array.isArray(permissions) || permissions.length === 0) {
    return true;
  }

  return permissions.every((permission) => hasPermission(user, permission));
};

/**
 * Check if a user has a specific role
 * @param {Object} user - User object with role
 * @param {string|Array<string>} roles - Role(s) to check
 * @returns {boolean}
 */
export const hasRole = (user, roles) => {
  if (!user || !user.role) {
    return false;
  }

  if (Array.isArray(roles)) {
    return roles.includes(user.role);
  }

  return user.role === roles;
};

/**
 * Get all permissions for a user
 * @param {Object} user - User object with role
 * @returns {Array<string>}
 */
export const getUserPermissions = (user) => {
  if (!user || !user.role) {
    return [];
  }

  const rolePermissions = ROLE_PERMISSIONS[user.role] || [];

  // Merge with custom permissions if available
  if (user.permissions && Array.isArray(user.permissions)) {
    return [...new Set([...rolePermissions, ...user.permissions])];
  }

  return rolePermissions;
};

/**
 * Check if user is admin (SUPER_ADMIN or SHOP_ADMIN)
 * @param {Object} user - User object with role
 * @returns {boolean}
 */
export const isAdmin = (user) => {
  return hasRole(user, [ROLES.SUPER_ADMIN, ROLES.SHOP_ADMIN]);
};

/**
 * Check if user is super admin
 * @param {Object} user - User object with role
 * @returns {boolean}
 */
export const isSuperAdmin = (user) => {
  return hasRole(user, ROLES.SUPER_ADMIN);
};

/**
 * Check if user is staff
 * @param {Object} user - User object with role
 * @returns {boolean}
 */
export const isStaff = (user) => {
  return hasRole(user, ROLES.STAFF);
};
