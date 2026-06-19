/**
 * Application Constants
 * Centralized configuration for the application
 */

// Company Branding
export const COMPANY = {
  NAME: "Health Care Surgical Mart",
  TAGLINE: "A Trust Medical Equipment Company",
  LOGO_URL: "/logo.png", // Local logo in public folder
  LOGO_FALLBACK: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Ctext x='50' y='50' font-family='Arial' font-size='40' fill='%23059669' text-anchor='middle' dominant-baseline='middle'%3EH%3C/text%3E%3C/svg%3E",
  EMAIL: "healthcaresurgicalmart@gmail.com",
  PHONE: "+880-1792880999",
  ADDRESS: "", // Add if needed
};

// API Configuration
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_URL || '/api',
  TIMEOUT: 90000, // 90s — allows time for Render free tier to wake up (~60s cold start)
  RETRY_ATTEMPTS: 3,
};

// Export base URL separately for SSE connections
export const API_BASE_URL = API_CONFIG.BASE_URL;

// Application Routes
export const ROUTES = {
  // Auth
  LOGIN: "/login",

  // Main Navigation
  DASHBOARD: "/dashboard",
  SALES: "/sales",
  PRODUCTS: "/products",
  PURCHASES: "/purchases",
  CUSTOMERS: "/customers",
  RETURNS: "/returns",

  // Expense Management
  EXPENSES: "/expenses",
  EXPENSE_ADD: "/expenses/add",
  EXPENSE_EDIT: "/expenses/edit",
  EXPENSE_CATEGORIES: "/expense-categories",

  // Reports & Analytics
  FINANCIAL_REPORTS: "/financial-reports",
  STOCK_REPORT: "/stock-report",

  // Settings
  SETTINGS: "/settings",
};

// User Permissions
export const PERMISSIONS = {
  // Expense Management
  VIEW_EXPENSES: "view_expenses",
  CREATE_EXPENSE: "create_expense",
  EDIT_EXPENSE: "edit_expense",
  DELETE_EXPENSE: "delete_expense",
  VIEW_EXPENSE_CATEGORIES: "view_expense_categories",
  MANAGE_EXPENSE_CATEGORIES: "manage_expense_categories",

  // Financial Reports
  VIEW_FINANCIAL_REPORTS: "view_financial_reports",

  // Admin
  MANAGE_USERS: "manage_users",
  MANAGE_SETTINGS: "manage_settings",
};

// Expense Categories
export const EXPENSE_TYPES = {
  FIXED: "Fixed",
  VARIABLE: "Variable",
  ONE_TIME: "One-time",
};

export const PAYMENT_METHODS = {
  CASH: "cash",
  BANK: "bank",
  CARD: "card",
};

export const RECURRING_FREQUENCIES = {
  DAILY: "daily",
  WEEKLY: "weekly",
  MONTHLY: "monthly",
  YEARLY: "yearly",
};

// UI Constants
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  PAGE_SIZE_OPTIONS: [10, 25, 50, 100],
};

export const DATE_FORMATS = {
  DISPLAY: "DD/MM/YYYY",
  API: "YYYY-MM-DD",
  DATETIME: "DD/MM/YYYY HH:mm",
};

// File Upload
export const FILE_UPLOAD = {
  MAX_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_TYPES: ["image/jpeg", "image/png", "application/pdf"],
  ALLOWED_EXTENSIONS: [".jpg", ".jpeg", ".png", ".pdf"],
};

// Toast Messages
export const TOAST_MESSAGES = {
  SUCCESS: {
    EXPENSE_CREATED: "Expense created successfully",
    EXPENSE_UPDATED: "Expense updated successfully",
    EXPENSE_DELETED: "Expense deleted successfully",
    CATEGORY_CREATED: "Category created successfully",
    CATEGORY_UPDATED: "Category updated successfully",
    CATEGORY_DELETED: "Category deleted successfully",
  },
  ERROR: {
    GENERIC: "Something went wrong. Please try again.",
    NETWORK: "Network error. Please check your connection.",
    UNAUTHORIZED: "You are not authorized to perform this action.",
    VALIDATION: "Please check your input and try again.",
  },
};

// Theme Configuration
export const THEME = {
  COLORS: {
    PRIMARY: "#3B82F6",
    SECONDARY: "#6B7280",
    SUCCESS: "#10B981",
    WARNING: "#F59E0B",
    ERROR: "#EF4444",
    INFO: "#3B82F6",
  },
};
