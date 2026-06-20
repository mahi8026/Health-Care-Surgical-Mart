/**
 * Redis Configuration
 * 
 * Optional Redis connection for high-performance token blacklist.
 * Falls back gracefully if Redis is unavailable.
 */

const redis = require('redis');
const logger = require('./logging').logger;

let redisClient = null;

/**
 * Initialize Redis client
 * @returns {Promise<object|null>} Redis client or null if unavailable
 */
async function initializeRedis() {
  // Skip if no Redis URL configured
  if (!process.env.REDIS_URL) {
    logger.info('Redis: REDIS_URL not configured, skipping Redis connection');
    return null;
  }

  try {
    logger.info('Redis: Attempting to connect...');
    
    const client = redis.createClient({
      url: process.env.REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 3) {
            logger.warn('Redis: Max reconnection attempts reached, giving up');
            return new Error('Redis reconnection failed');
          }
          // Exponential backoff: 50ms, 100ms, 200ms
          return Math.min(retries * 50, 1000);
        }
      }
    });

    // Error handling
    client.on('error', (err) => {
      logger.error('Redis: Connection error:', err.message);
    });

    client.on('ready', () => {
      logger.info('Redis: Connection ready');
    });

    client.on('reconnecting', () => {
      logger.info('Redis: Attempting to reconnect...');
    });

    client.on('end', () => {
      logger.info('Redis: Connection closed');
    });

    // Connect with timeout
    await Promise.race([
      client.connect(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Redis connection timeout')), 5000)
      )
    ]);

    logger.info('Redis: Connected successfully');
    redisClient = client;
    return client;
    
  } catch (error) {
    logger.warn(`Redis: Connection failed (${error.message}), will use MongoDB fallback`);
    return null;
  }
}

/**
 * Get Redis client instance
 * @returns {object|null} Redis client or null if unavailable
 */
function getRedisClient() {
  return redisClient;
}

/**
 * Close Redis connection
 */
async function closeRedis() {
  if (redisClient) {
    try {
      await redisClient.quit();
      logger.info('Redis: Connection closed gracefully');
    } catch (error) {
      logger.error('Redis: Error closing connection:', error);
    }
  }
}

/**
 * Check if Redis is connected
 * @returns {boolean} Connection status
 */
function isRedisConnected() {
  return redisClient && redisClient.isOpen;
}

module.exports = {
  initializeRedis,
  getRedisClient,
  closeRedis,
  isRedisConnected
};
