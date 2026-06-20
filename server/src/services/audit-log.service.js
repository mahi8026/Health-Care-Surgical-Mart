/**
 * Audit Log Service
 * Fire-and-forget audit trail for sensitive operations.
 *
 * DESIGN PRINCIPLES:
 * - Never throws — all errors are swallowed and logged via Winston
 * - Never awaited in route handlers — use auditLog.log() without await
 * - Sanitizes sensitive fields before persisting
 * - Extracts context (shopId, userId, IP) from req automatically
 */

const { logger } = require('../config/logging');
const { AUDIT_LOG_COLLECTION } = require('../models/audit-log.schema');

// Fields that must never appear in before/after snapshots
const SENSITIVE_FIELDS = new Set([
  'password',
  'passwordHash',
  'hashedPassword',
  'token',
  'refreshToken',
  'accessToken',
  'idToken',
  'firebaseToken',
  'apiKey',
  'api_key',
  'secret',
  'privateKey',
  'private_key',
  'creditCard',
  'cardNumber',
  'cvv',
  'ssn',
]);

/**
 * Deep-clone an object and redact all sensitive fields.
 * @param {*} obj
 * @returns {*} Sanitized clone
 */
function sanitize(obj) {
  if (obj === null || obj === undefined) {return obj;}
  if (typeof obj !== 'object') {return obj;}
  if (Array.isArray(obj)) {return obj.map(sanitize);}

  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_FIELDS.has(key)) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitize(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Extract the real client IP, handling reverse proxies.
 * @param {import('express').Request} req
 * @returns {string}
 */
function extractIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    // x-forwarded-for can be a comma-separated list; first is the client
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

class AuditLogService {
  /**
   * Write an audit log entry.
   * This method is FIRE-AND-FORGET — never await it in route handlers.
   *
   * @param {import('express').Request} req - Express request (for user/IP context)
   * @param {string} action - One of AUDIT_ACTIONS.*
   * @param {string} resource - Resource type e.g. "product", "sale", "user"
   * @param {string|null} resourceId - MongoDB ObjectId string of affected document
   * @param {string} description - Human-readable summary e.g. "Created product Surgical Gloves"
   * @param {object} [options]
   * @param {object} [options.before] - Document snapshot before change (UPDATE/DELETE)
   * @param {object} [options.after]  - Document snapshot after change (CREATE/UPDATE)
   * @param {"success"|"failure"} [options.status] - Defaults to "success"
   * @param {string} [options.errorMessage] - Error message if status = "failure"
   * @param {string} [options.shopId] - Override shopId (for auth routes where req.user may not exist)
   * @param {string} [options.userId] - Override userId (for login-failed where req.user is absent)
   * @param {string} [options.userEmail] - Override userEmail
   */
  log(req, action, resource, resourceId, description, options = {}) {
    // Fire-and-forget: schedule the DB write on the next tick
    setImmediate(() => {
      this._write(req, action, resource, resourceId, description, options).catch(
        (err) => {
          // Last-resort: log to Winston but never propagate
          logger.error('AuditLogService: failed to write audit entry', {
            file: 'audit-log.service.js',
            action,
            resource,
            error: err.message,
          });
        }
      );
    });
  }

  /**
   * Internal async writer — called via setImmediate.
   * @private
   */
  async _write(req, action, resource, resourceId, description, options) {
    const {
      before,
      after,
      status = 'success',
      errorMessage,
      shopId: overrideShopId,
      userId: overrideUserId,
      userEmail: overrideEmail,
    } = options;

    // Resolve context from req.user (may be absent for login-failed)
    const user = req?.user || {};
    const shopId = overrideShopId || user.shopId || null;
    const userId = overrideUserId || user._id?.toString() || null;
    const userEmail = overrideEmail || user.email || null;
    const role = user.role || null;

    const entry = {
      shopId,
      userId,
      userEmail,
      role,
      action,
      resource,
      resourceId: resourceId ? String(resourceId) : null,
      description,
      ipAddress: extractIp(req),
      userAgent: req?.headers?.['user-agent'] || null,
      before: before ? sanitize(before) : null,
      after: after ? sanitize(after) : null,
      status,
      errorMessage: errorMessage || null,
      timestamp: new Date(),
    };

    // Write to the system database (not shop-prefixed)
    const { getSystemDatabase } = require('../config/database');
    const db = getSystemDatabase();
    await db.collection(AUDIT_LOG_COLLECTION).insertOne(entry);
  }

  /**
   * Query audit logs with filters and pagination.
   * Used by GET /api/audit-logs.
   *
   * @param {object} filters
   * @param {string} [filters.shopId]
   * @param {string} [filters.userId]
   * @param {string} [filters.action]
   * @param {string} [filters.resource]
   * @param {Date}   [filters.startDate]
   * @param {Date}   [filters.endDate]
   * @param {number} [filters.page]
   * @param {number} [filters.limit]
   * @returns {Promise<{ entries: object[], total: number, page: number, pages: number }>}
   */
  async query(filters = {}) {
    const {
      shopId,
      userId,
      action,
      resource,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = filters;

    const query = {};
    if (shopId)    {query.shopId = shopId;}
    if (userId)    {query.userId = userId;}
    if (action)    {query.action = action;}
    if (resource)  {query.resource = resource;}

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {query.timestamp.$gte = new Date(startDate);}
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.timestamp.$lte = end;
      }
    }

    const skip = (Math.max(1, page) - 1) * Math.min(200, Math.max(1, limit));
    const safeLimit = Math.min(200, Math.max(1, limit));

    const { getSystemDatabase } = require('../config/database');
    const db = getSystemDatabase();
    const col = db.collection(AUDIT_LOG_COLLECTION);

    const [entries, total] = await Promise.all([
      col.find(query).sort({ timestamp: -1 }).skip(skip).limit(safeLimit).toArray(),
      col.countDocuments(query),
    ]);

    return {
      entries,
      total,
      page: Math.max(1, page),
      pages: Math.ceil(total / safeLimit),
    };
  }

  /**
   * Ensure indexes exist on the audit_logs collection.
   * Call once at server startup (non-blocking).
   */
  async ensureIndexes() {
    try {
      const { auditLogIndexes } = require('../models/audit-log.schema');
      const { getSystemDatabase } = require('../config/database');
      const db = getSystemDatabase();
      const col = db.collection(AUDIT_LOG_COLLECTION);

      for (const idx of auditLogIndexes) {
        const { key, name, ...options } = idx;
        await col.createIndex(key, { name, ...options });
      }

      logger.info('Audit log indexes ensured', {
        file: 'audit-log.service.js',
        collection: AUDIT_LOG_COLLECTION,
      });
    } catch (err) {
      // Non-fatal — indexes are a performance optimization
      logger.warn('AuditLogService: could not ensure indexes', {
        error: err.message,
      });
    }
  }
}

// Export singleton
module.exports = new AuditLogService();
