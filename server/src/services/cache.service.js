/**
 * Redis Cache Service
 * Optional caching layer using ioredis (already installed for Bull queues).
 *
 * DESIGN PRINCIPLES:
 * - Completely transparent: same API response with or without Redis
 * - Never throws: all errors are swallowed and logged via Winston
 * - Multi-tenant: shopId is always part of the cache key
 * - Key prefix "hcsm:" avoids collisions with Bull queue keys
 * - Single Redis connection shared across the app (singleton)
 */

const { logger } = require("../config/logging");

const KEY_PREFIX = "hcsm:";

// TTL constants (seconds)
const TTL = {
  PRODUCTS:         5 * 60,   // 5 minutes
  CATEGORIES:       30 * 60,  // 30 minutes
  PERMISSIONS:      10 * 60,  // 10 minutes
  SETTINGS:         30 * 60,  // 30 minutes
  EXPENSE_CATS:     30 * 60,  // 30 minutes
  FINANCIAL_REPORTS: 10 * 60, // 10 minutes
};

class CacheService {
  constructor() {
    this._client = null;
    this._available = false;
    this._warnedOnce = false;
    this._connecting = false;
  }

  /**
   * Lazily initialize the Redis client.
   * Called once on first use — never blocks startup.
   */
  _init() {
    if (this._client || this._connecting) return;
    this._connecting = true;

    try {
      const Redis = require("ioredis");

      const redisUrl = process.env.REDIS_URL;
      let client;

      if (redisUrl) {
        client = new Redis(redisUrl, {
          lazyConnect: true,
          enableOfflineQueue: false,
          maxRetriesPerRequest: 1,
          connectTimeout: 3000,
          retryStrategy: (times) => {
            // Give up after 3 retries — cache is optional
            if (times > 3) return null;
            return Math.min(times * 500, 2000);
          },
        });
      } else {
        const host = process.env.REDIS_HOST || "127.0.0.1";
        const port = parseInt(process.env.REDIS_PORT, 10) || 6379;
        const password = process.env.REDIS_PASSWORD || undefined;

        client = new Redis({
          host,
          port,
          password,
          lazyConnect: true,
          enableOfflineQueue: false,
          maxRetriesPerRequest: 1,
          connectTimeout: 3000,
          retryStrategy: (times) => {
            if (times > 3) return null;
            return Math.min(times * 500, 2000);
          },
        });
      }

      client.on("connect", () => {
        this._available = true;
        this._warnedOnce = false;
        logger.info("Cache service connected to Redis", {
          file: "cache.service.js",
        });
      });

      client.on("ready", () => {
        this._available = true;
      });

      client.on("error", (err) => {
        this._available = false;
        if (!this._warnedOnce) {
          this._warnedOnce = true;
          logger.warn("Cache service: Redis unavailable — caching disabled", {
            file: "cache.service.js",
            error: err.message,
          });
        }
      });

      client.on("close", () => {
        this._available = false;
      });

      // Attempt connection (non-blocking)
      client.connect().catch(() => {
        // Handled by the error event above
      });

      // Unref so the client doesn't prevent process exit in tests
      if (client.connector && client.connector.stream) {
        client.connector.stream.unref();
      }

      this._client = client;
    } catch (err) {
      // ioredis not available or config error — cache silently disabled
      logger.warn("Cache service: could not initialize Redis client", {
        file: "cache.service.js",
        error: err.message,
      });
    } finally {
      this._connecting = false;
    }
  }

  /**
   * Returns true if Redis is connected and ready.
   */
  isAvailable() {
    return this._available && this._client !== null;
  }

  /**
   * Get a cached value by key.
   * @param {string} key - Full cache key (without prefix)
   * @returns {Promise<any|null>} Parsed value or null on miss/error
   */
  async get(key) {
    if (!this.isAvailable()) return null;
    try {
      const raw = await this._client.get(KEY_PREFIX + key);
      if (raw === null) return null;
      return JSON.parse(raw);
    } catch (err) {
      logger.warn("Cache get error", { key, error: err.message });
      return null;
    }
  }

  /**
   * Store a value in cache.
   * @param {string} key - Full cache key (without prefix)
   * @param {*} value - Any JSON-serializable value
   * @param {number} ttlSeconds - Time to live in seconds
   * @returns {Promise<boolean>} true on success, false on error
   */
  async set(key, value, ttlSeconds) {
    if (!this.isAvailable()) return false;
    try {
      const serialized = JSON.stringify(value);
      const sizeInBytes = Buffer.byteLength(serialized, 'utf8');
      const maxSize = 1024 * 1024; // 1MB limit

      if (sizeInBytes > maxSize) {
        logger.warn("Cache value exceeds 1MB limit, skipping cache", {
          key,
          sizeInBytes,
          sizeMB: (sizeInBytes / (1024 * 1024)).toFixed(2)
        });
        return false;
      }

      await this._client.set(
        KEY_PREFIX + key,
        serialized,
        "EX",
        ttlSeconds
      );
      return true;
    } catch (err) {
      logger.warn("Cache set error", { key, error: err.message });
      return false;
    }
  }

  /**
   * Delete a single cache key.
   * @param {string} key - Full cache key (without prefix)
   * @returns {Promise<boolean>}
   */
  async del(key) {
    if (!this.isAvailable()) return false;
    try {
      await this._client.del(KEY_PREFIX + key);
      return true;
    } catch (err) {
      logger.warn("Cache del error", { key, error: err.message });
      return false;
    }
  }

  /**
   * Delete all keys matching a glob pattern.
   * Uses SCAN to avoid blocking Redis with KEYS.
   * @param {string} pattern - Glob pattern WITHOUT the "hcsm:" prefix
   * @returns {Promise<number>} Number of keys deleted
   */
  async delPattern(pattern) {
    if (!this.isAvailable()) return 0;
    try {
      const fullPattern = KEY_PREFIX + pattern;
      let cursor = "0";
      let deleted = 0;

      do {
        const [nextCursor, keys] = await this._client.scan(
          cursor,
          "MATCH",
          fullPattern,
          "COUNT",
          100
        );
        cursor = nextCursor;

        if (keys.length > 0) {
          await this._client.del(...keys);
          deleted += keys.length;
        }
      } while (cursor !== "0");

      return deleted;
    } catch (err) {
      logger.warn("Cache delPattern error", { pattern, error: err.message });
      return 0;
    }
  }

  /**
   * Invalidate all cached data for a shop's resource.
   * Call this after any write operation that modifies the resource.
   *
   * @param {string} shopId - Shop identifier
   * @param {string} resource - Resource name: "products" | "categories" |
   *   "settings" | "expense-cats" | "reports" | "permissions"
   * @param {string} [userId] - Required when resource = "permissions"
   */
  invalidateShopCache(shopId, resource, userId = null) {
    // Fire-and-forget — never await in route handlers
    setImmediate(async () => {
      try {
        if (resource === "permissions" && userId) {
          await this.del(`permissions:${userId}`);
        } else {
          await this.delPattern(`${resource}:${shopId}:*`);
          // Also delete exact keys (for resources without query hash)
          await this.del(`${resource}:${shopId}`);
        }
      } catch (err) {
        logger.warn("Cache invalidation error", { shopId, resource, error: err.message });
      }
    });
  }
}

// Export singleton + TTL constants
const cacheService = new CacheService();

// Lazy-init on first import (non-blocking)
setImmediate(() => cacheService._init());

module.exports = { cacheService, TTL };
