/**
 * Token Blacklist Service
 *
 * Manages revoked JWT tokens with persistent storage.
 * Supports Redis (primary) and MongoDB (fallback) backends.
 *
 * Features:
 * - Automatic TTL expiration
 * - Graceful fallback to MongoDB if Redis unavailable
 * - Fast lookups (< 10ms)
 */

const jwt = require('jsonwebtoken');
const logger = require('../config/logging').logger;

class TokenBlacklistService {
  constructor(redisClient = null, mongoDb = null) {
    this.redisClient = redisClient;
    this.mongoDb = mongoDb;
    this.collectionName = 'token_blacklist';

    if (this.redisClient) {
      logger.info('TokenBlacklistService: Using Redis for token storage');
    } else if (this.mongoDb) {
      logger.info('TokenBlacklistService: Using MongoDB for token storage');
      this.ensureMongoIndexes();
    } else {
      logger.warn('TokenBlacklistService: No storage backend configured, falling back to in-memory (NOT RECOMMENDED for production)');
      // Map of signature -> expiry timestamp (ms) so expired entries can be pruned
      this.inMemoryStore = new Map();

      // Periodic sweep so the in-memory store doesn't grow unbounded.
      // unref() lets the process exit naturally when idle.
      const cleanupInterval = setInterval(() => {
        this.cleanup().catch(() => {});
      }, 5 * 60 * 1000);
      cleanupInterval.unref();
    }
  }

  /**
   * Ensure MongoDB collection has TTL index for automatic expiration
   */
  async ensureMongoIndexes() {
    try {
      const collection = this.mongoDb.collection(this.collectionName);

      // Create TTL index (expires documents at 'expiry' time)
      await collection.createIndex(
        { expiry: 1 },
        { expireAfterSeconds: 0, name: 'expiry_ttl_idx' }
      );

      // Create index on signature for fast lookups
      await collection.createIndex(
        { signature: 1 },
        { unique: true, name: 'signature_idx' }
      );

      logger.info('TokenBlacklistService: MongoDB indexes created');
    } catch (error) {
      if (error.code === 85) {
        // Index already exists with different options - this is ok
        logger.debug('TokenBlacklistService: MongoDB indexes already exist');
      } else {
        logger.error('TokenBlacklistService: Error creating indexes:', error);
      }
    }
  }

  /**
   * Extract token signature (last part of JWT)
   * @param {string} token - Full JWT token
   * @returns {string} Token signature
   */
  getTokenSignature(token) {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }
    return parts[2];
  }

  /**
   * Calculate TTL from token expiration
   * @param {object} decoded - Decoded JWT payload
   * @returns {number} TTL in seconds
   */
  calculateTTL(decoded) {
    if (!decoded.exp) {
      // If no expiration, default to 24 hours
      return 24 * 60 * 60;
    }

    const ttl = Math.floor((decoded.exp * 1000 - Date.now()) / 1000);
    return Math.max(0, ttl); // Ensure non-negative
  }

  /**
   * Revoke a token (add to blacklist)
   * @param {string} token - JWT token to revoke
   * @returns {Promise<boolean>} Success status
   */
  async revokeToken(token) {
    try {
      const signature = this.getTokenSignature(token);
      const decoded = jwt.decode(token);

      if (!decoded) {
        logger.error('TokenBlacklistService: Unable to decode token for revocation');
        return false;
      }

      const ttl = this.calculateTTL(decoded);

      // Redis storage
      if (this.redisClient) {
        try {
          await this.redisClient.setEx(`blacklist:${signature}`, ttl, '1');
          logger.info(`TokenBlacklistService: Token revoked in Redis (TTL: ${ttl}s)`);
          return true;
        } catch (error) {
          logger.error('TokenBlacklistService: Redis error, falling back to MongoDB:', error);
          // Fall through to MongoDB
        }
      }

      // MongoDB storage
      if (this.mongoDb) {
        try {
          const collection = this.mongoDb.collection(this.collectionName);
          await collection.updateOne(
            { signature },
            {
              $set: {
                signature,
                expiry: new Date(decoded.exp * 1000),
                revokedAt: new Date(),
                userId: decoded.userId,
                email: decoded.email
              }
            },
            { upsert: true }
          );
          logger.info(`TokenBlacklistService: Token revoked in MongoDB`);
          return true;
        } catch (error) {
          logger.error('TokenBlacklistService: MongoDB error:', error);
          // Fall through to in-memory
        }
      }

      // In-memory fallback (NOT RECOMMENDED for production)
      if (this.inMemoryStore) {
        this.inMemoryStore.set(signature, decoded.exp * 1000);
        logger.warn('TokenBlacklistService: Token revoked in-memory (NOT PERSISTENT)');
        return true;
      }

      return false;
    } catch (error) {
      logger.error('TokenBlacklistService: Error revoking token:', error);
      return false;
    }
  }

  /**
   * Check if a token is blacklisted
   * @param {string} token - JWT token to check
   * @returns {Promise<boolean>} True if blacklisted
   */
  async isBlacklisted(token) {
    try {
      const signature = this.getTokenSignature(token);

      // Redis check
      if (this.redisClient) {
        try {
          const exists = await this.redisClient.exists(`blacklist:${signature}`);
          return exists === 1;
        } catch (error) {
          logger.error('TokenBlacklistService: Redis check error, falling back:', error);
          // Fall through to MongoDB
        }
      }

      // MongoDB check
      if (this.mongoDb) {
        try {
          const collection = this.mongoDb.collection(this.collectionName);
          const doc = await collection.findOne({ signature });
          return !!doc;
        } catch (error) {
          logger.error('TokenBlacklistService: MongoDB check error:', error);
          // Fall through to in-memory
        }
      }

      // In-memory check
      if (this.inMemoryStore) {
        const expiry = this.inMemoryStore.get(signature);
        if (!expiry) {
          return false;
        }
        // Prune expired entries lazily
        if (expiry <= Date.now()) {
          this.inMemoryStore.delete(signature);
          return false;
        }
        return true;
      }

      // If all storage backends fail, deny access (fail-secure)
      logger.error('TokenBlacklistService: All storage backends unavailable');
      return false;
    } catch (error) {
      logger.error('TokenBlacklistService: Error checking blacklist:', error);
      return false;
    }
  }

  /**
   * Get statistics about the blacklist
   * @returns {Promise<object>} Blacklist stats
   */
  async getStats() {
    try {
      const stats = {
        backend: 'unknown',
        count: 0
      };

      if (this.redisClient) {
        try {
          const keys = await this.redisClient.keys('blacklist:*');
          stats.backend = 'redis';
          stats.count = keys.length;
          return stats;
        } catch (error) {
          logger.error('TokenBlacklistService: Error getting Redis stats:', error);
        }
      }

      if (this.mongoDb) {
        try {
          const collection = this.mongoDb.collection(this.collectionName);
          const count = await collection.countDocuments();
          stats.backend = 'mongodb';
          stats.count = count;
          return stats;
        } catch (error) {
          logger.error('TokenBlacklistService: Error getting MongoDB stats:', error);
        }
      }

      if (this.inMemoryStore) {
        stats.backend = 'in-memory';
        stats.count = this.inMemoryStore.size;
        return stats;
      }

      return stats;
    } catch (error) {
      logger.error('TokenBlacklistService: Error getting stats:', error);
      return { backend: 'error', count: 0 };
    }
  }

  /**
   * Clean up expired tokens (manual cleanup for in-memory)
   * Note: Redis and MongoDB handle this automatically via TTL
   */
  async cleanup() {
    if (this.inMemoryStore) {
      const now = Date.now();
      let removed = 0;
      for (const [signature, expiry] of this.inMemoryStore.entries()) {
        if (expiry <= now) {
          this.inMemoryStore.delete(signature);
          removed += 1;
        }
      }
      if (removed > 0) {
        logger.info(`TokenBlacklistService: Cleaned ${removed} expired in-memory entries`);
      }
    }
  }
}

module.exports = TokenBlacklistService;
