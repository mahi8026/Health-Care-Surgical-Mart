/**
 * Navigation Configuration
 * Role-based navigation menu structure
 */

import { PERMISSIONS } from "../utils/permissions";

/**
 * Navigation menu items with role-based access control
 * Each item can have:
 * - id: Unique identifier
 * - name: Display name
 * - icon: Font Awesome icon class
 * - path: Route path
 * - permission: Required permission (optional)
 * - permissions: Array of required permissions (any) (optional)
 * - allPermissions: Array of required permissions (all) (optional)
 * - children: Sub-menu items (optional)
 * - badge: Badge configuration (optional)
 * - divider: Show divider after this item (optional)
 */
export const navigationConfig = [
  // Dashboard - Available to all authenticated users
  {
    id: "dashboard",
    name: "Dashboard",
    icon: "fas fa-tachometer-alt",
    path: "/dashboard",
    description: "Overview and key metrics",
  },

  // Sales & POS - Available to all roles
  {
    id: "sales",
    name: "Point of Sale",
    icon: "fas fa-cash-register",
    path: "/sales",
    permission: PERMISSIONS.CREATE_SALE,
    description: "Create new sales transactions",
    badge: {
      text: "POS",
      color: "green",
    },
  },

  // Inventory Management Section
  {
    id: "products",
    name: "Products",
    icon: "fas fa-boxes",
    path: "/products",
    permission: PERMISSIONS.VIEW_PRODUCTS,
    description: "Manage product inventory",
  },
  {
    id: "stock-report",
    name: "Stock Report",
    icon: "fas fa-chart-bar",
    path: "/stock-report",
    permission: PERMISSIONS.VIEW_STOCK,
    description: "View stock levels and reports",
  },

  // Purchase Management - Admin only
  {
    id: "purchases",
    name: "Purchases",
    icon: "fas fa-shopping-cart",
    path: "/purchases",
    permission: PERMISSIONS.VIEW_PURCHASES,
    description: "Manage purchase orders",
    divider: true,
  },

  // Customer & Returns Management
  {
    id: "customers",
    name: "Customers",
    icon: "fas fa-users",
    path: "/customers",
    permission: PERMISSIONS.VIEW_CUSTOMERS,
    description: "Manage customer information",
  },
  {
    id: "returns",
    name: "Returns",
    icon: "fas fa-undo",
    path: "/returns",
    permission: PERMISSIONS.VIEW_RETURNS,
    description: "Process product returns",
    divider: true,
  },

  // Expense Management Section
  {
    id: "expenses",
    name: "Expenses",
    icon: "fas fa-receipt",
    path: "/expenses",
    permission: PERMISSIONS.VIEW_EXPENSES,
    description: "Track business expenses",
  },
  {
    id: "expense-categories",
    name: "Expense Categories",
    icon: "fas fa-tags",
    path: "/expense-categories",
    permission: PERMISSIONS.VIEW_EXPENSE_CATEGORIES,
    description: "Manage expense categories",
    divider: true,
  },

  // Reports & Analytics Section
  {
    id: "financial-reports",
    name: "Financial Reports",
    icon: "fas fa-chart-line",
    path: "/financial-reports",
    permissions: [
      PERMISSIONS.VIEW_SALES_REPORT,
      PERMISSIONS.VIEW_PROFIT_REPORT,
    ],
    description: "View financial analytics",
    divider: true,
  },

  // Settings - Admin only
  {
    id: "settings",
    name: "Settings",
    icon: "fas fa-cogs",
    path: "/settings",
    permission: PERMISSIONS.VIEW_SETTINGS,
    description: "System configuration",
  },
];

/**
 * Get navigation items filtered by user permissions
 * @param {Object} user - User object with role and permissions
 * @param {Function} hasPermission - Permission checking function
 * @returns {Array} Filtered navigation items
 */
export const getFilteredNavigation = (user, hasPermission) => {
  if (!user) {
    return [];
  }

  return navigationConfig.filter((item) => {
    // No permission required - show to all authenticated users
    if (!item.permission && !item.permissions && !item.allPermissions) {
      return true;
    }

    // Single permission check
    if (item.permission) {
      return hasPermission(user, item.permission);
    }

    // Any of the permissions (OR logic)
    if (item.permissions && Array.isArray(item.permissions)) {
      return item.permissions.some((perm) => hasPermission(user, perm));
    }

    // All permissions required (AND logic)
    if (item.allPermissions && Array.isArray(item.allPermissions)) {
      return item.allPermissions.every((perm) => hasPermission(user, perm));
    }

    return false;
  });
};

/**
 * Navigation sections for better organization
 */
export const navigationSections = {
  main: {
    title: "Main",
    items: ["dashboard", "sales"],
  },
  inventory: {
    title: "Inventory",
    items: ["products", "stock-report", "purchases"],
  },
  customers: {
    title: "Customers & Returns",
    items: ["customers", "returns"],
  },
  expenses: {
    title: "Expenses",
    items: ["expenses", "expense-categories"],
  },
  reports: {
    title: "Reports & Analytics",
    items: ["financial-reports"],
  },
  system: {
    title: "System",
    items: ["settings"],
  },
};

/**
 * Get navigation organized by sections
 * @param {Object} user - User object
 * @param {Function} hasPermission - Permission checking function
 * @returns {Object} Navigation organized by sections
 */
export const getNavigationBySections = (user, hasPermission) => {
  const filteredNav = getFilteredNavigation(user, hasPermission);
  const navById = filteredNav.reduce((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {});

  const result = {};

  Object.entries(navigationSections).forEach(([key, section]) => {
    const sectionItems = section.items
      .map((itemId) => navById[itemId])
      .filter(Boolean);

    if (sectionItems.length > 0) {
      result[key] = {
        ...section,
        items: sectionItems,
      };
    }
  });

  return result;
};
