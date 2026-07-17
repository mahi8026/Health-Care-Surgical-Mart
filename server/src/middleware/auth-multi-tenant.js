/**
 * Multi-Tenant Authentication Middleware
 * Handles JWT authentication and shop context
 */

const jwt = require('jsonwebtoken');
const { getShopDatabase, getSystemDatabase } = require('../config/database');
const { ObjectId } = require('mongodb');
const { logger } = require('../config/logging');
const TokenBlacklistService = require('../services/token-blacklist.service');

// Initialize TokenBlacklistService (will be set up with Redis/MongoDB in server.js)
let tokenBlacklistService = null;

/**
 * Initialize the token blacklist service
 * Called from server.js after database connection is established
 * @param {object} redisClient - Redis client instance (optional)
 * @param {object} mongoDb - MongoDB database instance (optional)
 */
function initializeTokenBlacklistService(redisClient = null, mongoDb = null) {
  tokenBlacklistService = new TokenBlacklistService(redisClient, mongoDb);
  logger.info('TokenBlacklistService initialized in auth middleware');
}

/**
 * Get the token blacklist service instance
 * @returns {TokenBlacklistService}
 */
function getTokenBlacklistService() {
  if (!tokenBlacklistService) {
    // Lazy initialization with MongoDB fallback if not already initialized
    const systemDb = getSystemDatabase();
    tokenBlacklistService = new TokenBlacklistService(null, systemDb);
    logger.warn('TokenBlacklistService lazily initialized (MongoDB only)');
  }
  return tokenBlacklistService;
}

/**
 * Add token to blacklist (revoke it)
 * @param {string} token - JWT token to revoke
 * @returns {Promise<boolean>} Success status
 */
async function revokeToken(token) {
  try {
    const service = getTokenBlacklistService();
    return await service.revokeToken(token);
  } catch (error) {
    logger.error('Failed to revoke token:', error);
    return false;
  }
}

/**
 * Check if token is blacklisted (revoked)
 * @param {string} token - JWT token to check
 * @returns {Promise<boolean>} true if blacklisted
 */
async function isTokenBlacklisted(token) {
  try {
    const service = getTokenBlacklistService();
    return await service.isBlacklisted(token);
  } catch (error) {
    logger.error('Failed to check token blacklist:', error);
    // Fail-secure: if we can't check, assume not blacklisted but log error
    return false;
  }
}

// Lazy validation of JWT_SECRET (only when middleware is used)
function getJWTSecret() {
  const JWT_SECRET = process.env.JWT_SECRET;

  if (!JWT_SECRET || JWT_SECRET.length < 32) {
    throw new Error(
      'FATAL: JWT_SECRET environment variable is missing or too short. ' +
      'JWT_SECRET must be at least 32 characters. ' +
      "Generate a secure secret using: node -e \"require('crypto').randomBytes(32, (err, buf) => { if (err) throw err; process.stdout.write(buf.toString('hex')); })\""
    );
  }

  return JWT_SECRET;
}

/**
 * Authenticate user and attach to request
 * Reads JWT from httpOnly cookie (secure) or Authorization header (backward compatibility)
 */
async function authenticate(req, res, next) {
  try {
    let token;

    // Try to get token from httpOnly cookie first (preferred, more secure)
    if (req.cookies?.jwt) {
      token = req.cookies.jwt;
    }
    // Fallback: Authorization header (for backward compatibility with mobile apps, etc.)
    else if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7);
    }
    // Fallback: Query parameter (for SSE EventSource which can't send custom headers)
    else if (req.query?.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided',
      });
    }

    // SECURITY FIX: Check if token is blacklisted (revoked)
    const blacklisted = await isTokenBlacklisted(token);
    if (blacklisted) {
      return res.status(401).json({
        success: false,
        message: 'Token has been revoked. Please login again.',
      });
    }

    // Verify token with nested try-catch for JWT-specific errors
    let decoded;
    try {
      decoded = jwt.verify(token, getJWTSecret());
    } catch (jwtError) {
      if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token',
        });
      }
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expired',
        });
      }
      // Re-throw unexpected JWT errors to outer catch
      throw jwtError;
    }

    // Validate shopId - all users must have shop context
    if (!decoded.shopId) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token: missing shop context',
      });
    }

    // Get user from shop database with nested try-catch for database errors
    let user;
    try {
      if (!ObjectId.isValid(decoded.userId)) {
        return res.status(401).json({
          success: false,
          message: 'User not found',
        });
      }
      const shopDb = getShopDatabase(decoded.shopId);
      user = await shopDb.collection('users').findOne({
        _id: new ObjectId(decoded.userId),
      });
    } catch (dbError) {
      logger.error('Database error in authenticate middleware:', {
        error: dbError.message,
        stack: dbError.stack,
        userId: decoded?.userId,
        shopId: decoded?.shopId,
        role: decoded?.role,
        path: req.path,
      });
      return res.status(500).json({
        success: false,
        message: 'Database connection failed',
      });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User account is inactive',
      });
    }

    // Attach user to request
    req.user = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      shopId: (user.shopId || decoded.shopId)?.toString() ?? null, // Convert ObjectId to string
      permissions: user.permissions || [],
    };

    // Attach shop database to request for convenience
    if (req.user.shopId) {
      try {
        req.shopDb = getShopDatabase(req.user.shopId);

        // Ensure shop indexes exist (fire-and-forget, non-blocking)
        const { createShopIndexes } = require('../config/database');
        setImmediate(() => {
          createShopIndexes(req.user.shopId).catch((err) => {
            logger.warn(`Failed to verify shop indexes for ${req.user.shopId}:`, err.message);
          });
        });
      } catch (dbError) {
        logger.error('Failed to get shop database in authenticate middleware:', {
          error: dbError.message,
          stack: dbError.stack,
          userId: req.user._id,
          shopId: req.user.shopId,
          path: req.path,
        });
        return res.status(500).json({
          success: false,
          message: 'Failed to connect to shop database',
        });
      }
    }

    next();
  } catch (error) {
    // Catch-all for any unexpected errors
    logger.error('Unexpected error in authenticate middleware:', {
      error: error.message,
      stack: error.stack,
      path: req.path,
    });
    return res.status(500).json({
      success: false,
      message: 'Authentication failed',
    });
  }
}

/**
 * Generate JWT token
 * @param {Object} user - User object
 * @returns {string} JWT token
 */
function generateToken(user) {
  const payload = {
    userId: user._id.toString(),
    uid: user._id.toString(), // Include uid for consistency
    email: user.email,
    role: user.role,
    shopId: user.shopId || null,
  };

  return jwt.sign(payload, getJWTSecret(), {
    expiresIn: '24h',
  });
}

/**
 * Verify shop access (ensure user belongs to the shop)
 */
function verifyShopAccess(req, res, next) {
  const shopIdFromParams =
    req.params.shopId || req.body.shopId || req.query?.shopId;

  // All users must match shop context
  if (shopIdFromParams && shopIdFromParams !== req.user.shopId) {
    return res.status(403).json({
      success: false,
      message: 'Access denied: You do not have access to this shop',
    });
  }

  next();
}

/**
 * Check if shop is active
 */
async function checkShopStatus(req, res, next) {
  try {
    const systemDb = getSystemDatabase();
    const shopQuery = ObjectId.isValid(req.user.shopId)
      ? { _id: new ObjectId(req.user.shopId) }
      : { shopId: req.user.shopId };
    const shop = await systemDb.collection('shops').findOne(shopQuery);

    if (!shop) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found',
      });
    }

    if (shop.status !== 'Active') {
      return res.status(403).json({
        success: false,
        message: `Shop is ${shop.status.toLowerCase()}. Please contact support.`,
      });
    }

    // Check subscription expiry
    if (
      shop.subscriptionExpiry &&
      new Date(shop.subscriptionExpiry) < new Date()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Subscription expired. Please renew to continue.',
      });
    }

    next();
  } catch (error) {
    logger.error('Shop status check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify shop status',
    });
  }
}

module.exports = {
  authenticate,
  generateToken,
  verifyShopAccess,
  checkShopStatus,
  revokeToken,
  isTokenBlacklisted,
  initializeTokenBlacklistService,
  getTokenBlacklistService,
};
