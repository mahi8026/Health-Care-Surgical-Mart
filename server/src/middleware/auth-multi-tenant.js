/**
 * Multi-Tenant Authentication Middleware
 * Handles JWT authentication and shop context
 */

const jwt = require("jsonwebtoken");
const { getShopDatabase, getSystemDatabase } = require("../config/database");
const { ObjectId } = require("mongodb");
const { logger } = require("../config/logging");

// Token blacklist for revoked tokens (in-memory, upgrade to Redis for production clustering)
// Maps token signature to expiry timestamp
const tokenBlacklist = new Map();

// Clean up expired tokens from blacklist every hour
setInterval(() => {
  const now = Date.now();
  for (const [tokenSig, expiry] of tokenBlacklist.entries()) {
    if (now > expiry) {
      tokenBlacklist.delete(tokenSig);
    }
  }
}, 3600000); // 1 hour

/**
 * Add token to blacklist (revoke it)
 * @param {string} token - JWT token to revoke
 */
function revokeToken(token) {
  try {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.exp) {
      return false;
    }
    
    // Extract token signature (last part of JWT)
    const parts = token.split('.');
    if (parts.length !== 3) {
      return false;
    }
    const signature = parts[2];
    
    // Store signature with expiry timestamp
    tokenBlacklist.set(signature, decoded.exp * 1000); // exp is in seconds, convert to ms
    logger.info('Token revoked', { userId: decoded.userId, exp: new Date(decoded.exp * 1000) });
    return true;
  } catch (error) {
    logger.error('Failed to revoke token:', error);
    return false;
  }
}

/**
 * Check if token is blacklisted (revoked)
 * @param {string} token - JWT token to check
 * @returns {boolean} true if blacklisted
 */
function isTokenBlacklisted(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return false;
    }
    const signature = parts[2];
    
    const expiry = tokenBlacklist.get(signature);
    if (!expiry) {
      return false;
    }
    
    // Check if token expiry has passed (can remove from blacklist)
    const now = Date.now();
    if (now > expiry) {
      tokenBlacklist.delete(signature);
      return false;
    }
    
    return true;
  } catch (error) {
    logger.error('Failed to check token blacklist:', error);
    return false;
  }
}

// Lazy validation of JWT_SECRET (only when middleware is used)
function getJWTSecret() {
  const JWT_SECRET = process.env.JWT_SECRET;
  
  if (!JWT_SECRET || JWT_SECRET.length < 32) {
    throw new Error(
      "FATAL: JWT_SECRET environment variable is missing or too short. " +
      "JWT_SECRET must be at least 32 characters. " +
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
    else if (req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.substring(7);
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
      });
    }

    // SECURITY FIX: Check if token is blacklisted (revoked)
    if (isTokenBlacklisted(token)) {
      return res.status(401).json({
        success: false,
        message: "Token has been revoked. Please login again.",
      });
    }

    // Verify token with nested try-catch for JWT-specific errors
    let decoded;
    try {
      decoded = jwt.verify(token, getJWTSecret());
    } catch (jwtError) {
      if (jwtError.name === "JsonWebTokenError") {
        return res.status(401).json({
          success: false,
          message: "Invalid token",
        });
      }
      if (jwtError.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Token expired",
        });
      }
      // Re-throw unexpected JWT errors to outer catch
      throw jwtError;
    }

    // Validate shopId for non-super-admin users
    if (decoded.role !== "SUPER_ADMIN" && !decoded.shopId) {
      return res.status(401).json({
        success: false,
        message: "Invalid token: missing shop context",
      });
    }

    // Get user from appropriate database with nested try-catch for database errors
    let user;
    try {
      if (decoded.role === "SUPER_ADMIN") {
        const systemDb = getSystemDatabase();
        user = await systemDb.collection("system_users").findOne({
          _id: new ObjectId(decoded.userId),
        });
      } else {
        const shopDb = getShopDatabase(decoded.shopId);
        user = await shopDb.collection("users").findOne({
          _id: new ObjectId(decoded.userId),
        });
      }
    } catch (dbError) {
      logger.error("Database error in authenticate middleware:", {
        error: dbError.message,
        stack: dbError.stack,
        userId: decoded?.userId,
        shopId: decoded?.shopId,
        role: decoded?.role,
        path: req.path,
      });
      return res.status(500).json({
        success: false,
        message: "Database connection failed",
      });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: "User account is inactive",
      });
    }

    // Attach user to request
    req.user = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      shopId: user.shopId || decoded.shopId,
      permissions: user.permissions || [],
    };

    // For SUPER_ADMIN: resolve shopId from request context (query/body/header).
    // SUPER_ADMIN MUST explicitly specify which shop they want to access.
    // This prevents accidentally accessing the wrong shop's data.
    if (req.user.role === "SUPER_ADMIN" && !req.user.shopId) {
      const requestedShopId =
        req.query.shopId ||
        req.body?.shopId ||
        req.headers["x-shop-id"] ||
        null;

      if (requestedShopId) {
        // Validate that the requested shop exists and is accessible
        try {
          const systemDb = getSystemDatabase();
          const shop = await systemDb.collection("shops").findOne({ 
            shopId: requestedShopId 
          });

          if (!shop) {
            logger.warn("SUPER_ADMIN attempted to access non-existent shop", {
              userId: req.user._id,
              email: req.user.email,
              shopId: requestedShopId,
              path: req.path,
            });
            return res.status(400).json({
              success: false,
              message: `Shop '${requestedShopId}' not found`,
            });
          }

          if (shop.status !== "Active") {
            logger.warn("SUPER_ADMIN attempted to access inactive shop", {
              userId: req.user._id,
              email: req.user.email,
              shopId: requestedShopId,
              status: shop.status,
              path: req.path,
            });
            return res.status(403).json({
              success: false,
              message: `Shop '${requestedShopId}' is ${shop.status}. Cannot access data.`,
            });
          }

          req.user.shopId = requestedShopId;
        } catch (shopErr) {
          logger.error("Shop validation error:", {
            error: shopErr.message,
            stack: shopErr.stack,
            shopId: requestedShopId,
            userId: req.user._id,
          });
          return res.status(500).json({
            success: false,
            message: "Failed to validate shop",
          });
        }
      } else {
        // CRITICAL: No fallback - SUPER_ADMIN must specify shopId explicitly
        // This prevents accidentally accessing the wrong shop's data
        logger.warn("SUPER_ADMIN attempted to access data without shopId", {
          userId: req.user._id,
          email: req.user.email,
          path: req.path,
          method: req.method,
        });
        return res.status(400).json({
          success: false,
          message: "SUPER_ADMIN must specify shopId via query parameter (?shopId=xxx), header (X-Shop-Id), or request body. Use GET /api/admin/shops to list available shops.",
        });
      }
    }

    // Attach shop database to request for convenience
    if (req.user.shopId) {
      try {
        req.shopDb = getShopDatabase(req.user.shopId);
      } catch (dbError) {
        logger.error("Failed to get shop database in authenticate middleware:", {
          error: dbError.message,
          stack: dbError.stack,
          userId: req.user._id,
          shopId: req.user.shopId,
          path: req.path,
        });
        return res.status(500).json({
          success: false,
          message: "Failed to connect to shop database",
        });
      }
    }

    next();
  } catch (error) {
    // Catch-all for any unexpected errors
    logger.error("Unexpected error in authenticate middleware:", {
      error: error.message,
      stack: error.stack,
      path: req.path,
    });
    return res.status(500).json({
      success: false,
      message: "Authentication failed",
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
    expiresIn: "24h",
  });
}

/**
 * Verify shop access (ensure user belongs to the shop)
 */
function verifyShopAccess(req, res, next) {
  const shopIdFromParams =
    req.params.shopId || req.body.shopId || req.query.shopId;

  // Super admin can access any shop
  if (req.user.role === "SUPER_ADMIN") {
    return next();
  }

  // Other users must match shop context
  if (shopIdFromParams && shopIdFromParams !== req.user.shopId) {
    return res.status(403).json({
      success: false,
      message: "Access denied: You do not have access to this shop",
    });
  }

  next();
}

/**
 * Check if shop is active
 */
async function checkShopStatus(req, res, next) {
  try {
    // Skip for super admin
    if (req.user.role === "SUPER_ADMIN") {
      return next();
    }

    const systemDb = getSystemDatabase();
    const shop = await systemDb.collection("shops").findOne({
      shopId: req.user.shopId,
    });

    if (!shop) {
      return res.status(404).json({
        success: false,
        message: "Shop not found",
      });
    }

    if (shop.status !== "Active") {
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
        message: "Subscription expired. Please renew to continue.",
      });
    }

    next();
  } catch (error) {
    logger.error("Shop status check error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to verify shop status",
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
};
