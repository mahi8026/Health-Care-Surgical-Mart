/**
 * Role-Based Access Control (RBAC) Configuration
 * Defines permissions for each role
 */

const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  SHOP_ADMIN: "SHOP_ADMIN",
  STAFF: "STAFF",
};

const PERMISSIONS = {
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
  CREATE_PURCHASES: "create_purchase",
  READ_PURCHASES: "view_purchases",
  UPDATE_PURCHASES: "edit_purchase",
  DELETE_PURCHASES: "delete_purchase",
  VIEW_PURCHASES: "view_purchases",

  // Suppliers
  CREATE_SUPPLIERS: "create_supplier",
  READ_SUPPLIERS: "view_suppliers",
  UPDATE_SUPPLIERS: "edit_supplier",
  DELETE_SUPPLIERS: "delete_supplier",

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
};

// Role-Permission Mapping
const ROLE_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: [
    // All shop management permissions
    PERMISSIONS.CREATE_SHOP,
    PERMISSIONS.VIEW_ALL_SHOPS,
    PERMISSIONS.SUSPEND_SHOP,
    PERMISSIONS.DELETE_SHOP,
    PERMISSIONS.VIEW_USAGE_STATS,
    PERMISSIONS.CREATE_SHOP_ADMIN,

    // All other permissions (full access)
    ...Object.values(PERMISSIONS),
  ],

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
    PERMISSIONS.CREATE_PURCHASES,
    PERMISSIONS.UPDATE_PURCHASES,
    PERMISSIONS.DELETE_PURCHASES,
    PERMISSIONS.READ_PURCHASES,

    // Full supplier management
    PERMISSIONS.CREATE_SUPPLIERS,
    PERMISSIONS.UPDATE_SUPPLIERS,
    PERMISSIONS.DELETE_SUPPLIERS,
    PERMISSIONS.READ_SUPPLIERS,

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
    PERMISSIONS.READ_PURCHASES,

    // View suppliers
    PERMISSIONS.READ_SUPPLIERS,

    // View customers
    PERMISSIONS.VIEW_CUSTOMERS,

    // Limited reports (no profit)
    PERMISSIONS.VIEW_SALES_REPORT,
    PERMISSIONS.VIEW_STOCK_REPORT,

    // View expense categories only
    PERMISSIONS.VIEW_EXPENSE_CATEGORIES,

    // Limited expense access (view only)
    PERMISSIONS.VIEW_EXPENSES,
  ],
};

/**
 * Check if a role has a specific permission
 * @param {string} role - User role
 * @param {string} permission - Permission to check
 * @returns {boolean}
 */
function hasPermission(role, permission) {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}

/**
 * Check if user has permission (from user object)
 * @param {Object} user - User object with role
 * @param {string} permission - Permission to check
 * @returns {boolean}
 */
function userHasPermission(user, permission) {
  if (!user || !user.role) {
    return false;
  }

  // Check custom permissions first
  if (user.permissions && user.permissions.includes(permission)) {
    return true;
  }

  return hasPermission(user.role, permission);
}

/**
 * Get all permissions for a role
 * @param {string} role - User role
 * @returns {Array<string>}
 */
function getRolePermissions(role) {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Middleware to check permission
 * @param {string} permission - Required permission
 * @returns {Function} Express middleware
 */
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!userHasPermission(req.user, permission)) {
      return res.status(403).json({
        success: false,
        message: "Insufficient permissions",
        required: permission,
        userRole: req.user.role,
      });
    }

    next();
  };
}

/**
 * Middleware to check role
 * @param {Array<string>} allowedRoles - Array of allowed roles
 * @returns {Function} Express middleware
 */
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Insufficient role privileges",
        required: allowedRoles,
        userRole: req.user.role,
      });
    }

    next();
  };
}

module.exports = {
  ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  hasPermission,
  userHasPermission,
  getRolePermissions,
  requirePermission,
  requireRole,
};
