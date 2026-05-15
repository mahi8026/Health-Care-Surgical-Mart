/**
 * Multi-Tenant Authentication Routes
 * Login for all user types
 */

const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const { getShopDatabase, getSystemDatabase } = require("../config/database");
const { generateToken } = require("../middleware/auth-multi-tenant");
const { logger } = require('../config/logging');
const auditLog = require("../services/audit-log.service");
const { AUDIT_ACTIONS } = require("../models/audit-log.schema");
const { bruteForceProtection } = require("../middleware/security-headers");

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 12;

/**
 * @swagger
 * /api/auth/firebase-login:
 *   post:
 *     summary: Login with Firebase authentication token
 *     description: Authenticate user using Firebase ID token and get JWT token for API access. Supports both shop users and super admins. Shop ID is auto-detected if not provided.
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *           examples:
 *             shopUser:
 *               summary: Shop user login
 *               value:
 *                 idToken: "eyJhbGciOiJSUzI1NiIsImtpZCI6IjFkYzBmM..."
 *                 email: "manager@shop.com"
 *                 shopId: "shop_12345"
 *             autoDetect:
 *               summary: Auto-detect shop
 *               value:
 *                 idToken: "eyJhbGciOiJSUzI1NiIsImtpZCI6IjFkYzBmM..."
 *                 email: "manager@shop.com"
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         description: Invalid credentials or inactive account
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               invalidToken:
 *                 value:
 *                   success: false
 *                   message: "Invalid Firebase token"
 *               userNotFound:
 *                 value:
 *                   success: false
 *                   message: "User not found in system. Please contact administrator."
 *               inactiveAccount:
 *                 value:
 *                   success: false
 *                   message: "User account is inactive"
 *       403:
 *         description: Shop is not active
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Shop is suspended. Please contact support."
 *       404:
 *         description: Shop not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Shop not found"
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login with email and password (legacy)
 *     description: Authenticate user using email and password. Returns JWT token for API access. Shop ID is auto-detected if not provided.
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "manager@shop.com"
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "SecurePassword123"
 *               shopId:
 *                 type: string
 *                 description: "Shop ID (optional - auto-detected if not provided)"
 *                 example: "shop_12345"
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         description: Invalid credentials or inactive account
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Invalid email or password"
 *       403:
 *         description: Shop is not active
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *
 * @swagger
 * /api/auth/change-password:
 *   post:
 *     summary: Change user password
 *     description: Change password for authenticated user. Requires old password verification.
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - oldPassword
 *               - newPassword
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "manager@shop.com"
 *               oldPassword:
 *                 type: string
 *                 format: password
 *                 example: "OldPassword123"
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: "NewSecurePassword456"
 *               shopId:
 *                 type: string
 *                 description: "Shop ID (required for shop users, not for super admin)"
 *                 example: "shop_12345"
 *     responses:
 *       200:
 *         description: Password changed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Password changed successfully"
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               missingFields:
 *                 value:
 *                   success: false
 *                   message: "All fields are required"
 *               weakPassword:
 *                 value:
 *                   success: false
 *                   message: "New password must be at least 8 characters"
 *       401:
 *         description: Old password is incorrect
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Old password is incorrect"
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "User not found"
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * POST /api/auth/login
 * Login for all user types
 */
router.post("/login", bruteForceProtection, async (req, res) => {
  try {
    const { email, password, shopId } = req.body;


    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    let user;
    let userDb;

    // Check if super admin login
    const systemDb = getSystemDatabase();
    const superAdmin = await systemDb
      .collection("system_users")
      .findOne({ email });

    if (superAdmin && superAdmin.role === "SUPER_ADMIN") {
      user = superAdmin;
      userDb = "system";
    } else {
      // Shop user login - try to find shopId automatically
      let targetShopId = shopId;

      if (!targetShopId) {
        // Auto-detect shopId by searching all shops for this email
        const shops = await systemDb
          .collection("shops")
          .find({ status: "Active" })
          .toArray();


        // First check if email matches shop owner email
        for (const shop of shops) {
          if (shop.ownerEmail === email) {
            targetShopId = shop.shopId;
            break;
          }
        }

        // If not found as owner, search in each shop's users collection
        if (!targetShopId) {
          for (const shop of shops) {
            try {
              const shopDb = getShopDatabase(shop.shopId);
              const shopUser = await shopDb
                .collection("users")
                .findOne({ email });
              if (shopUser) {
                targetShopId = shop.shopId;
                break;
              }
            } catch (error) {
              logger.warn('Failed to query shop database during legacy login auto-detect', { shopId: shop.shopId, error: error.message });
            }
          }
        }

        if (!targetShopId) {
          return res.status(400).json({
            success: false,
            message: "Shop not found for this email. Please contact support.",
          });
        }
      }

      // Verify shop exists
      const shop = await systemDb
        .collection("shops")
        .findOne({ shopId: targetShopId });
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

      // Get user from shop database
      const shopDb = getShopDatabase(targetShopId);
      user = await shopDb.collection("users").findOne({ email });
      if (user) {
      }
      userDb = targetShopId;
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      // Increment login attempts on failure
      if (req.incrementLoginAttempts) {
        req.incrementLoginAttempts();
      }
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Reset login attempts on successful authentication
    if (req.resetLoginAttempts) {
      req.resetLoginAttempts();
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: "User account is inactive",
      });
    }

    // Update last login
    if (userDb === "system") {
      await systemDb
        .collection("system_users")
        .updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });
    } else {
      const shopDb = getShopDatabase(userDb);
      await shopDb
        .collection("users")
        .updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });
    }

    // Generate token
    const token = generateToken(user);

    // Audit: successful legacy login
    auditLog.log(req, AUDIT_ACTIONS.LOGIN, "auth", user._id?.toString(),
      `User ${user.email} logged in (password)`, {
        after: { email: user.email, role: user.role, shopId: user.shopId || null },
        shopId: user.shopId || null,
        userId: user._id?.toString(),
        userEmail: user.email,
      }
    );

    res.json({
      success: true,
      message: "Login successful",
      data: {
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          shopId: user.shopId || null,
        },
      },
    });
  } catch (error) {
    logger.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Login failed",
    });
  }
});

/**
 * POST /api/auth/change-password
 * Change user password
 */
router.post("/change-password", async (req, res) => {
  try {
    const { email, oldPassword, newPassword, shopId } = req.body;

    if (!email || !oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters",
      });
    }

    let user;
    let collection;

    // Determine if super admin or shop user
    const systemDb = getSystemDatabase();
    const superAdmin = await systemDb
      .collection("system_users")
      .findOne({ email });

    if (superAdmin && superAdmin.role === "SUPER_ADMIN") {
      user = superAdmin;
      collection = systemDb.collection("system_users");
    } else {
      if (!shopId) {
        return res.status(400).json({
          success: false,
          message: "Shop ID is required",
        });
      }

      const shopDb = getShopDatabase(shopId);
      user = await shopDb.collection("users").findOne({ email });
      collection = shopDb.collection("users");
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Verify old password
    const isOldPasswordValid = await bcrypt.compare(
      oldPassword,
      user.passwordHash,
    );
    if (!isOldPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Old password is incorrect",
      });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    // Update password
    await collection.updateOne(
      { _id: user._id },
      {
        $set: {
          passwordHash: newPasswordHash,
          updatedAt: new Date(),
        },
      },
    );

    res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    logger.error("Change password error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to change password",
    });
  }
});

/**
 * POST /api/auth/firebase-login
 * Login with Firebase token
 */
router.post("/firebase-login", bruteForceProtection, async (req, res) => {
  try {
    const { email, shopId, idToken, firebaseToken } = req.body;

    // Accept both 'idToken' and 'firebaseToken' for backward compatibility
    const firebaseIdToken = idToken || firebaseToken;

    if (!email || !firebaseIdToken) {
      return res.status(400).json({
        success: false,
        message: "Email and Firebase ID token are required",
      });
    }

    // Verify Firebase token using Firebase Admin SDK
    const admin = require('../config/firebase-admin');
    
    // In development without Firebase credentials, skip token verification
    // and trust the email directly (dev-only bypass)
    const firebaseAdminConfigured = admin.apps && admin.apps.length > 0;
    
    if (firebaseAdminConfigured) {
      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(firebaseIdToken);
      } catch (error) {
        logger.error("Firebase token verification failed:", error);
        return res.status(401).json({
          success: false,
          message: "Invalid Firebase token",
        });
      }

      // Verify email matches token
      if (decodedToken.email !== email) {
        logger.warn(`Email mismatch: token email ${decodedToken.email} !== request email ${email}`);
        return res.status(401).json({
          success: false,
          message: "Email does not match Firebase token",
        });
      }
    } else {
      // Firebase Admin not configured — skip token verification in development
      logger.warn("Firebase Admin SDK not configured — skipping token verification (dev mode)", {
        file: "auth-multi-tenant.routes.js",
        function: "firebase-login",
        email,
      });
    }

    let user;
    let userDb;

    // Check if super admin login
    const systemDb = getSystemDatabase();
    const superAdmin = await systemDb
      .collection("system_users")
      .findOne({ email });

    if (superAdmin && superAdmin.role === "SUPER_ADMIN") {
      user = superAdmin;
      userDb = "system";
    } else {
      // Shop user login - try to find shopId automatically
      let targetShopId = shopId;

      if (!targetShopId) {
        // Auto-detect shopId by searching all shops for this email
        const shops = await systemDb
          .collection("shops")
          .find({ status: "Active" })
          .toArray();

        // First check if email matches shop owner email
        for (const shop of shops) {
          if (shop.ownerEmail === email) {
            targetShopId = shop.shopId;
            break;
          }
        }

        // If not found as owner, search in each shop's users collection
        if (!targetShopId) {
          for (const shop of shops) {
            try {
              const shopDb = getShopDatabase(shop.shopId);
              const shopUser = await shopDb
                .collection("users")
                .findOne({ email });
              if (shopUser) {
                targetShopId = shop.shopId;
                break;
              }
            } catch (error) {
              logger.warn('Failed to query shop database during Firebase login auto-detect', { shopId: shop.shopId, error: error.message });
            }
          }
        }

        if (!targetShopId) {
          return res.status(400).json({
            success: false,
            message:
              "User not found in system. Please contact administrator to add your account.",
          });
        }
      }

      // Verify shop exists
      const shop = await systemDb
        .collection("shops")
        .findOne({ shopId: targetShopId });
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

      // Get user from shop database
      const shopDb = getShopDatabase(targetShopId);
      user = await shopDb.collection("users").findOne({ email });
      userDb = targetShopId;
    }

    if (!user) {
      // Increment login attempts on failure
      if (req.incrementLoginAttempts) {
        req.incrementLoginAttempts();
      }
      return res.status(401).json({
        success: false,
        message: "User not found in system. Please contact administrator.",
      });
    }

    // Check if user is active
    if (!user.isActive) {
      // Increment login attempts on failure
      if (req.incrementLoginAttempts) {
        req.incrementLoginAttempts();
      }
      return res.status(401).json({
        success: false,
        message: "User account is inactive",
      });
    }

    // Reset login attempts on successful authentication
    if (req.resetLoginAttempts) {
      req.resetLoginAttempts();
    }

    // Update last login
    if (userDb === "system") {
      await systemDb
        .collection("system_users")
        .updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });
    } else {
      const shopDb = getShopDatabase(userDb);
      await shopDb
        .collection("users")
        .updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });
    }

    // Generate token
    const token = generateToken(user);

    // Audit: successful login
    auditLog.log(req, AUDIT_ACTIONS.LOGIN, "auth", user._id?.toString(),
      `User ${user.email} logged in via Firebase`, {
        after: { email: user.email, role: user.role, shopId: user.shopId || null },
        shopId: user.shopId || null,
        userId: user._id?.toString(),
        userEmail: user.email,
      }
    );

    res.json({
      success: true,
      message: "Login successful",
      data: {
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          shopId: user.shopId || null,
        },
      },
    });
  } catch (error) {
    logger.error("Firebase login error:", error);
    res.status(500).json({
      success: false,
      message: "Login failed",
    });
  }
});

module.exports = router;
