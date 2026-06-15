/**
 * Cache Response Middleware
 * Wraps Express route handlers with Redis caching.
 *
 * Usage:
 *   router.get("/", cacheResponse(TTL.PRODUCTS, (req) => `products:${req.user.shopId}:${queryHash(req.query)}`), handler)
 *
 * Headers added:
 *   X-Cache: HIT  — response served from cache
 *   X-Cache: MISS — response fetched from DB and cached
 *   X-Cache: SKIP — Redis unavailable, request passed through normally
 */

const crypto = require("crypto");
const { cacheService } = require("../services/cache.service");

/**
 * Create a short deterministic hash of an object (for query params).
 * @param {object} obj
 * @returns {string} 16-char hex hash (increased from 8 to reduce collision risk)
 */
function queryHash(obj) {
  if (!obj || Object.keys(obj).length === 0) return "default";
  const sorted = Object.keys(obj)
    .sort()
    .reduce((acc, k) => { acc[k] = obj[k]; return acc; }, {});
  return crypto
    .createHash("md5")
    .update(JSON.stringify(sorted))
    .digest("hex")
    .slice(0, 16);
}

/**
 * Express middleware factory for response caching.
 *
 * @param {number} ttlSeconds - Cache TTL in seconds
 * @param {(req: import('express').Request) => string} keyFn
 *   Function that receives the request and returns the cache key (without "hcsm:" prefix).
 *   The key should include shopId and any query params that affect the response.
 * @returns {import('express').RequestHandler}
 */
function cacheResponse(ttlSeconds, keyFn) {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== "GET") return next();

    // Skip if Redis unavailable — transparent fallback
    if (!cacheService.isAvailable()) {
      res.setHeader("X-Cache", "SKIP");
      return next();
    }

    const key = keyFn(req);

    try {
      const cached = await cacheService.get(key);

      if (cached !== null) {
        // Cache HIT — return cached response immediately
        res.setHeader("X-Cache", "HIT");
        res.setHeader("Content-Type", "application/json");
        return res.status(200).json(cached);
      }
    } catch (_) {
      // Cache read error — fall through to normal handler
      res.setHeader("X-Cache", "SKIP");
      return next();
    }

    // Cache MISS — intercept the response to cache it
    res.setHeader("X-Cache", "MISS");

    // Monkey-patch res.json to capture the response body
    const originalJson = res.json.bind(res);
    res.json = function (body) {
      // Only cache successful 200 responses
      if (res.statusCode === 200 && body && body.success !== false) {
        cacheService.set(key, body, ttlSeconds).catch(() => {});
      }
      return originalJson(body);
    };

    next();
  };
}

module.exports = { cacheResponse, queryHash };
