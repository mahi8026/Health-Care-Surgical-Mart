/**
 * Multi-Tenant Authentication Middleware
 * Handles JWT authentication and shop context
 */

const jwt = require("jsonwebtoken");
const { getShopDatabase, getSystemDatabase } = require("../config/database");
const { ObjectId } = require("mongodb");
const { logger } = require("../config/logging");

const JWT_SECRET =
  process.env.JWT_SECRET || "your_jwt_secret_key_change_in_production";

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

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Get user from appropriate database
    let user;
    if (decoded.role === "SUPER_ADMIN") {
      const systemDb = getSystemDatabase();
      user = await systemDb.collection("system_users").findOne({
        _id: new ObjectId(decoded.userId),
      });
    } else {
      if (!decoded.shopId) {
        return res.status(401).json({
          success: false,
          message: "Invalid token: missing shop context",
        });
      }

      const shopDb = getShopDatabase(decoded.shopId);
      user = await shopDb.collection("users").findOne({
        _id: new ObjectId(decoded.userId),
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


    // Attach shop database to request for convenience
    if (req.user.shopId) {
      try {
        req.shopDb = getShopDatabase(req.user.shopId);
      } catch (dbError) {
        logger.error(
          "Auth middleware - Failed to get shop database:",
          dbError,
        );
        return res.status(500).json({
          success: false,
          message: "Failed to connect to shop database",
        });
      }
    } else {
    }

    next();
  } catch (error) {
    logger.error("Auth middleware - Error:", error);
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired",
      });
    }

    logger.error("Authentication error:", error);
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

  return jwt.sign(payload, JWT_SECRET, {
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
