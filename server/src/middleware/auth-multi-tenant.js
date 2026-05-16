/**
 * Multi-Tenant Authentication Middleware
 * Handles JWT authentication and shop context
 */

const jwt = require("jsonwebtoken");
const { getShopDatabase, getSystemDatabase } = require("../config/database");
const { ObjectId } = require("mongodb");
const { logger } = require("../config/logging");

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
 */
async function authenticate(req, res, next) {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
      });
    }

    const token = authHeader.substring(7);

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
    // This ensures a Super Admin sees the correct shop's data when switching shops,
    // instead of always being locked to the first shop.
    if (req.user.role === "SUPER_ADMIN" && !req.user.shopId) {
      const requestedShopId =
        req.query.shopId ||
        req.body?.shopId ||
        req.headers["x-shop-id"] ||
        null;

      if (requestedShopId) {
        req.user.shopId = requestedShopId;
      } else {
        // Fallback: assign first active shop only as a last resort
        try {
          const systemDb = getSystemDatabase();
          const firstShop = await systemDb
            .collection("shops")
            .findOne({ status: "Active" }, { sort: { createdAt: 1 } });
          if (firstShop) {
            req.user.shopId = firstShop.shopId;
          }
        } catch (shopErr) {
          logger.warn("Could not resolve shopId for SUPER_ADMIN", {
            error: shopErr.message,
          });
        }
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
};
