/**
 * Audit Log Schema
 * Defines the structure and validation for audit log entries.
 * Used for GDPR/HIPAA compliance and security monitoring.
 */

/**
 * All supported audit actions grouped by domain.
 * Use these constants when calling AuditLogService.log().
 */
const AUDIT_ACTIONS = {
  // Authentication
  LOGIN:            "LOGIN",
  LOGOUT:           "LOGOUT",
  LOGIN_FAILED:     "LOGIN_FAILED",
  TOKEN_REFRESH:    "TOKEN_REFRESH",

  // User management
  USER_CREATED:     "USER_CREATED",
  USER_UPDATED:     "USER_UPDATED",
  USER_DELETED:     "USER_DELETED",
  ROLE_CHANGED:     "ROLE_CHANGED",
  PASSWORD_CHANGED: "PASSWORD_CHANGED",

  // Products
  PRODUCT_CREATED:  "PRODUCT_CREATED",
  PRODUCT_UPDATED:  "PRODUCT_UPDATED",
  PRODUCT_DELETED:  "PRODUCT_DELETED",
  BULK_IMPORT:      "BULK_IMPORT",

  // Sales
  SALE_CREATED:     "SALE_CREATED",
  SALE_VOIDED:      "SALE_VOIDED",
  INVOICE_SENT:     "INVOICE_SENT",

  // Returns
  RETURN_CREATED:   "RETURN_CREATED",
  RETURN_APPROVED:  "RETURN_APPROVED",
  RETURN_REJECTED:  "RETURN_REJECTED",

  // Purchases
  PURCHASE_CREATED: "PURCHASE_CREATED",
  PURCHASE_UPDATED: "PURCHASE_UPDATED",

  // Customers
  CUSTOMER_CREATED: "CUSTOMER_CREATED",
  CUSTOMER_UPDATED: "CUSTOMER_UPDATED",
  CUSTOMER_DELETED: "CUSTOMER_DELETED",

  // Expenses
  EXPENSE_CREATED:  "EXPENSE_CREATED",
  EXPENSE_UPDATED:  "EXPENSE_UPDATED",
  EXPENSE_DELETED:  "EXPENSE_DELETED",

  // Settings
  SETTINGS_UPDATED: "SETTINGS_UPDATED",

  // Permissions
  PERMISSION_CHANGED: "PERMISSION_CHANGED",
};

/**
 * MongoDB collection name for audit logs.
 * Stored in the system database (not shop-prefixed) so SUPER_ADMIN
 * can query across all shops in one collection.
 */
const AUDIT_LOG_COLLECTION = "audit_logs";

/**
 * MongoDB index definitions for the audit_logs collection.
 * Applied once at startup via createAuditLogIndexes().
 */
const auditLogIndexes = [
  // Primary query patterns
  { key: { timestamp: -1 },                name: "timestamp_desc" },
  { key: { shopId: 1, timestamp: -1 },     name: "shop_timestamp" },
  { key: { userId: 1, timestamp: -1 },     name: "user_timestamp" },
  { key: { action: 1, timestamp: -1 },     name: "action_timestamp" },
  { key: { resource: 1, resourceId: 1 },   name: "resource_lookup" },
  // TTL index — auto-delete entries older than 2 years (GDPR retention)
  { key: { timestamp: 1 }, name: "ttl_2years", expireAfterSeconds: 63072000 },
];

module.exports = {
  AUDIT_ACTIONS,
  AUDIT_LOG_COLLECTION,
  auditLogIndexes,
};
