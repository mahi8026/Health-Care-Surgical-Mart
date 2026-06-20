/**
 * In-Memory Caching Middleware
 * Provides request-level and token-level caching
 */

class CacheManager {
  constructor() {
    this.cache = new Map();
    this.tokenCache = new Map();
    this.defaultTTL = 5 * 60 * 1000; // 5 minutes
    this.tokenTTL = 15 * 60 * 1000; // 15 minutes
  }

  /**
   * Get cached value
   */
  get(key) {
    const item = this.cache.get(key);
    if (!item) {return null;}

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  /**
   * Set cached value with TTL
   */
  set(key, value, ttl = this.defaultTTL) {
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttl,
    });
  }

  /**
   * Delete cached value
   */
  delete(key) {
    this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get cached token data
   */
  getToken(token) {
    const item = this.tokenCache.get(token);
    if (!item) {return null;}

    if (Date.now() > item.expiry) {
      this.tokenCache.delete(token);
      return null;
    }

    return item.value;
  }

  /**
   * Set cached token data
   */
  setToken(token, userData) {
    this.tokenCache.set(token, {
      value: userData,
      expiry: Date.now() + this.tokenTTL,
    });
  }

  /**
   * Delete cached token
   */
  deleteToken(token) {
    this.tokenCache.delete(token);
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      tokenCacheSize: this.tokenCache.size,
      totalSize: this.cache.size + this.tokenCache.size,
    };
  }

  /**
   * Clean expired entries
   */
  cleanup() {
    const now = Date.now();

    // Clean regular cache
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
      }
    }

    // Clean token cache
    for (const [key, item] of this.tokenCache.entries()) {
      if (now > item.expiry) {
        this.tokenCache.delete(key);
      }
    }
  }
}

// Singleton instance
const cacheManager = new CacheManager();

// Cleanup expired entries every 5 minutes
setInterval(
  () => {
    cacheManager.cleanup();
  },
  5 * 60 * 1000,
);

/**
 * Cache middleware for GET requests
 */
function cacheMiddleware(ttl = 5 * 60 * 1000) {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Generate cache key from URL and query params
    const cacheKey = `${req.originalUrl || req.url}`;

    // Check cache
    const cachedResponse = cacheManager.get(cacheKey);
    if (cachedResponse) {
      return res.json(cachedResponse);
    }

    // Store original res.json
    const originalJson = res.json.bind(res);

    // Override res.json to cache response
    res.json = function (data) {
      // Only cache successful responses
      if (res.statusCode === 200 && data.success !== false) {
        cacheManager.set(cacheKey, data, ttl);
      }
      return originalJson(data);
    };

    next();
  };
}

/**
 * Invalidate cache for specific patterns
 */
function invalidateCache(pattern) {
  const keys = Array.from(cacheManager.cache.keys());
  const regex = new RegExp(pattern);

  keys.forEach((key) => {
    if (regex.test(key)) {
      cacheManager.delete(key);
    }
  });
}

module.exports = {
  cacheManager,
  cacheMiddleware,
  invalidateCache,
};
