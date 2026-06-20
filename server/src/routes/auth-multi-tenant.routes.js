/**
 * Multi-Tenant Authentication Routes
 * Login for all user types
 * Updated: 2026-06-20 - Fixed shop database schema (v2)
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getShopDatabase, getSystemDatabase } = require('../config/database');
const { generateToken } = require('../middleware/auth-multi-tenant');
const { logger } = require('../config/logging');
const auditLog = require('../services/audit-log.service');
const { AUDIT_ACTIONS } = require('../models/audit-log.schema');
const { bruteForceProtection } = require('../middleware/security-headers');

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
router.post('/login', bruteForceProtection, async (req, res) => {
  try {
    const { email, password, shopId } = req.body;


    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    let user;
    let userDb;

    // Check if super admin login
    const systemDb = getSystemDatabase();
    const superAdmin = await systemDb
      .collection('system_users')
      .findOne({ email });

    if (superAdmin && superAdmin.role === 'SUPER_ADMIN') {
      user = superAdmin;
      userDb = 'system';
    } else {
      // Shop user login - try to find shopId automatically
      let targetShopId = shopId;

      if (!targetShopId) {
        // PERFORMANCE OPTIMIZATION: Use user_shop_index for O(1) lookup
        // Instead of O(n) loop through all shops
        try {
          const userShopMapping = await systemDb
            .collection('user_shop_index')
            .findOne({ email, isActive: true });

          if (userShopMapping) {
            targetShopId = userShopMapping.shopId;
            logger.debug('Login: Found shop via index lookup', { email, shopId: targetShopId });
          }
        } catch (indexError) {
          logger.warn('Failed to query user_shop_index, falling back to shop loop', {
            email,
            error: indexError.message
          });
        }

        // FALLBACK: If index lookup failed, use legacy method (loop through shops)
        if (!targetShopId) {
          logger.info('Login: Index lookup failed, using legacy shop loop', { email });

          const shops = await systemDb
            .collection('shops')
            .find({ status: 'Active' })
            .toArray();

          // First check if email matches shop owner email
          for (const shop of shops) {
            if (shop.ownerEmail === email) {
              targetShopId = shop._id.toString(); // Use _id, not shopId
              break;
            }
          }

          // If not found as owner, search in each shop's users collection
          if (!targetShopId) {
            for (const shop of shops) {
              try {
                const shopDb = getShopDatabase(shop._id.toString()); // Use _id, not shopId
                const shopUser = await shopDb
                  .collection('users')
                  .findOne({ email });
                if (shopUser) {
                  targetShopId = shop._id.toString(); // Use _id, not shopId
                  break;
                }
              } catch (error) {
                logger.warn('Failed to query shop database during legacy login auto-detect', {
                  shopId: shop._id.toString(),
                  error: error.message
                });
              }
            }
          }
        }

        if (!targetShopId) {
          return res.status(400).json({
            success: false,
            message: 'Shop not found for this email. Please contact support.',
          });
        }
      }

      // Verify shop exists (find by _id as string or ObjectId)
      const shop = await systemDb
        .collection('shops')
        .findOne({
          $or: [
            { shopId: targetShopId },
            { _id: targetShopId }
          ]
        });
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

      // Get user from shop database
      const shopDb = getShopDatabase(targetShopId);
      user = await shopDb.collection('users').findOne({ email });
      if (user) {
      }
      userDb = targetShopId;
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
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
        message: 'Invalid email or password',
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
        message: 'User account is inactive',
      });
    }

    // Update last login
    if (userDb === 'system') {
      await systemDb
        .collection('system_users')
        .updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });
    } else {
      const shopDb = getShopDatabase(userDb);
      await shopDb
        .collection('users')
        .updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });
    }

    // Generate token
    const token = generateToken(user);

    // Set JWT as httpOnly cookie (secure, XSS-proof)
    // For same-domain this is the most secure option
    res.cookie('jwt', token, {
      httpOnly: true,           // Cannot be accessed by JavaScript (XSS protection)
      secure: true,             // Always HTTPS (required for sameSite=none)
      sameSite: 'none',         // Allow cross-site cookies
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/',
    });

    // Audit: successful legacy login
    auditLog.log(req, AUDIT_ACTIONS.LOGIN, 'auth', user._id?.toString(),
      `User ${user.email} logged in (password)`, {
        after: { email: user.email, role: user.role, shopId: user.shopId || null },
        shopId: user.shopId || null,
        userId: user._id?.toString(),
        userEmail: user.email,
      }
    );

    // Return user data AND token for cross-domain compatibility
    // Frontend will store token in localStorage and send via Authorization header
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          shopId: user.shopId || null,
        },
        token: token, // Include token for cross-domain setups
      },
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
    });
  }
});

/**
 * POST /api/auth/change-password
 * Change user password (requires old password verification)
 */
router.post('/change-password', async (req, res) => {
  try {
    const { email, oldPassword, newPassword, shopId } = req.body;

    if (!email || !oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required',
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters',
      });
    }

    let user;
    let collection;

    // Determine if super admin or shop user
    const systemDb = getSystemDatabase();
    const superAdmin = await systemDb
      .collection('system_users')
      .findOne({ email });

    if (superAdmin && superAdmin.role === 'SUPER_ADMIN') {
      user = superAdmin;
      collection = systemDb.collection('system_users');
    } else {
      if (!shopId) {
        return res.status(400).json({
          success: false,
          message: 'Shop ID is required',
        });
      }

      const shopDb = getShopDatabase(shopId);
      user = await shopDb.collection('users').findOne({ email });
      collection = shopDb.collection('users');
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
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
        message: 'Old password is incorrect',
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

    // Audit: password change
    auditLog.log(req, AUDIT_ACTIONS.UPDATE, 'user', user._id?.toString(),
      `User ${user.email} changed password`, {
        shopId: user.shopId || null,
        userId: user._id?.toString(),
        userEmail: user.email,
      }
    );

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password',
    });
  }
});

/**
 * POST /api/auth/request-password-reset
 * Request password reset (sends email verification code)
 * SECURITY FIX: Added email verification before password reset
 * SECURITY FIX: Added brute force protection to prevent email enumeration
 */
router.post('/request-password-reset', bruteForceProtection, async (req, res) => {
  try {
    const { email, shopId } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    let user;
    let targetShopId = shopId;

    // Determine if super admin or shop user
    const systemDb = getSystemDatabase();
    const superAdmin = await systemDb
      .collection('system_users')
      .findOne({ email });

    if (superAdmin && superAdmin.role === 'SUPER_ADMIN') {
      user = superAdmin;
      targetShopId = null;
    } else {
      // Auto-detect shopId if not provided
      if (!targetShopId) {
        // PERFORMANCE OPTIMIZATION: Use user_shop_index for O(1) lookup
        try {
          const userShopMapping = await systemDb
            .collection('user_shop_index')
            .findOne({ email, isActive: true });

          if (userShopMapping) {
            targetShopId = userShopMapping.shopId;
            logger.debug('[PASSWORD_RESET] Found shop via index lookup', { email, shopId: targetShopId });
          }
        } catch (indexError) {
          logger.warn('[PASSWORD_RESET] Failed to query user_shop_index, falling back to shop loop', {
            email,
            error: indexError.message
          });
        }

        // FALLBACK: If index lookup failed, use legacy method
        if (!targetShopId) {
          logger.info('[PASSWORD_RESET] Index lookup failed, using legacy shop loop', { email });

          const shops = await systemDb
            .collection('shops')
            .find({ status: 'Active' })
            .toArray();

          for (const shop of shops) {
            if (shop.ownerEmail === email) {
              targetShopId = shop.shopId;
              break;
            }
          }

          if (!targetShopId) {
            for (const shop of shops) {
              try {
                const shopDb = getShopDatabase(shop.shopId);
                const shopUser = await shopDb.collection('users').findOne({ email });
                if (shopUser) {
                  targetShopId = shop.shopId;
                  break;
                }
              } catch (error) {
                logger.warn('[PASSWORD_RESET] Failed to query shop during password reset', {
                  shopId: shop.shopId,
                  error: error.message
                });
              }
            }
          }
        }

        if (!targetShopId) {
          // Return success even if user not found (prevent email enumeration)
          return res.json({
            success: true,
            message: 'If an account with that email exists, a password reset code has been sent.',
          });
        }
      }

      const shopDb = getShopDatabase(targetShopId);
      user = await shopDb.collection('users').findOne({ email });
    }

    if (!user) {
      // Return success even if user not found (prevent email enumeration)
      return res.json({
        success: true,
        message: 'If an account with that email exists, a password reset code has been sent.',
      });
    }

    // Generate 6-digit reset code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const resetCodeHash = await bcrypt.hash(resetCode, 10);
    const resetCodeExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Store reset code in database
    const collection = user.role === 'SUPER_ADMIN'
      ? systemDb.collection('system_users')
      : getShopDatabase(targetShopId).collection('users');

    await collection.updateOne(
      { _id: user._id },
      {
        $set: {
          passwordResetCode: resetCodeHash,
          passwordResetExpiry: resetCodeExpiry,
          updatedAt: new Date(),
        },
      },
    );

    // Send password reset email
    const emailService = require('../services/email.service');
    await emailService.sendPasswordResetEmail(email, resetCode, 15);

    // Audit: password reset requested
    auditLog.log(req, AUDIT_ACTIONS.UPDATE, 'user', user._id?.toString(),
      `Password reset requested for ${user.email}`, {
        shopId: targetShopId || null,
        userId: user._id?.toString(),
        userEmail: user.email,
      }
    );

    res.json({
      success: true,
      message: 'If an account with that email exists, a password reset code has been sent.',
      // In development, include the code for testing
      ...(process.env.NODE_ENV === 'development' && { resetCode }),
    });
  } catch (error) {
    logger.error('Request password reset error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process password reset request',
    });
  }
});

/**
 * POST /api/auth/reset-password
 * Reset password with verification code
 * SECURITY FIX: Requires email verification code
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { email, resetCode, newPassword, shopId } = req.body;

    if (!email || !resetCode || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email, reset code, and new password are required',
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters',
      });
    }

    let user;
    let collection;

    // Determine if super admin or shop user
    const systemDb = getSystemDatabase();
    const superAdmin = await systemDb
      .collection('system_users')
      .findOne({ email });

    if (superAdmin && superAdmin.role === 'SUPER_ADMIN') {
      user = superAdmin;
      collection = systemDb.collection('system_users');
    } else {
      if (!shopId) {
        return res.status(400).json({
          success: false,
          message: 'Shop ID is required',
        });
      }

      const shopDb = getShopDatabase(shopId);
      user = await shopDb.collection('users').findOne({ email });
      collection = shopDb.collection('users');
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Invalid or expired reset code',
      });
    }

    // Verify reset code exists and not expired
    if (!user.passwordResetCode || !user.passwordResetExpiry) {
      return res.status(400).json({
        success: false,
        message: 'No password reset request found. Please request a new reset code.',
      });
    }

    if (new Date() > new Date(user.passwordResetExpiry)) {
      return res.status(400).json({
        success: false,
        message: 'Reset code has expired. Please request a new one.',
      });
    }

    // Verify reset code
    const isCodeValid = await bcrypt.compare(resetCode, user.passwordResetCode);
    if (!isCodeValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid reset code',
      });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    // Update password and clear reset code
    await collection.updateOne(
      { _id: user._id },
      {
        $set: {
          passwordHash: newPasswordHash,
          updatedAt: new Date(),
        },
        $unset: {
          passwordResetCode: '',
          passwordResetExpiry: '',
        },
      },
    );

    // Audit: password reset completed
    auditLog.log(req, AUDIT_ACTIONS.UPDATE, 'user', user._id?.toString(),
      `Password reset completed for ${user.email}`, {
        shopId: user.shopId || null,
        userId: user._id?.toString(),
        userEmail: user.email,
      }
    );

    res.json({
      success: true,
      message: 'Password reset successful. You can now login with your new password.',
    });
  } catch (error) {
    logger.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset password',
    });
  }
});

/**
 * POST /api/auth/firebase-login
 * Login with Firebase token
 */
router.post('/firebase-login', bruteForceProtection, async (req, res) => {
  try {
    const { email, shopId, idToken, firebaseToken } = req.body;

    // Accept both 'idToken' and 'firebaseToken' for backward compatibility
    const firebaseIdToken = idToken || firebaseToken;

    if (!email || !firebaseIdToken) {
      logger.error('[LOGIN] Missing credentials', { email: !!email, token: !!firebaseIdToken });
      return res.status(400).json({
        success: false,
        message: 'Email and Firebase ID token are required',
      });
    }

    // Verify Firebase token using Firebase Admin SDK
    const admin = require('../config/firebase-admin');

    // SECURITY FIX: Remove Firebase token bypass in production
    const firebaseAdminConfigured = admin.apps && admin.apps.length > 0;

    if (!firebaseAdminConfigured) {
      // In production, Firebase Admin MUST be configured
      if (process.env.NODE_ENV === 'production') {
        logger.error('[LOGIN] Firebase Admin SDK not configured in PRODUCTION - authentication blocked', {
          email,
          environment: process.env.NODE_ENV
        });
        return res.status(503).json({
          success: false,
          message: 'Authentication service unavailable. Please contact support.',
        });
      } else {
        // Development-only bypass (for local testing without Firebase credentials)
        logger.warn('[LOGIN] Firebase Admin SDK not configured — BYPASSING token verification (DEVELOPMENT ONLY)', {
          file: 'auth-multi-tenant.routes.js',
          function: 'firebase-login',
          email,
          environment: process.env.NODE_ENV
        });
      }
    } else {
      // Verify Firebase token
      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(firebaseIdToken);
        logger.info('[LOGIN] Firebase token verified successfully', { uid: decodedToken.uid, email: decodedToken.email });
      } catch (error) {
        logger.error('[LOGIN] Firebase token verification failed', {
          code: error.code,
          message: error.message,
          email: email
        });
        return res.status(401).json({
          success: false,
          message: 'Invalid Firebase token',
        });
      }

      // Verify email matches token
      if (decodedToken.email !== email) {
        logger.warn(`[LOGIN] Email mismatch: token email ${decodedToken.email} !== request email ${email}`);
        return res.status(401).json({
          success: false,
          message: 'Email does not match Firebase token',
        });
      }
    }

    let user;
    let userDb;

    // Check if super admin login
    const systemDb = getSystemDatabase();
    const superAdmin = await systemDb
      .collection('system_users')
      .findOne({ email });

    if (superAdmin && superAdmin.role === 'SUPER_ADMIN') {
      user = superAdmin;
      userDb = 'system';
    } else {
      // Shop user login - try to find shopId automatically
      let targetShopId = shopId;

      if (!targetShopId) {
        // PERFORMANCE OPTIMIZATION: Use user_shop_index for O(1) lookup
        // Instead of O(n) loop through all shops
        try {
          const userShopMapping = await systemDb
            .collection('user_shop_index')
            .findOne({ email, isActive: true });

          if (userShopMapping) {
            targetShopId = userShopMapping.shopId;
            logger.debug('[LOGIN] Found shop via index lookup', { email, shopId: targetShopId });
          }
        } catch (indexError) {
          logger.warn('[LOGIN] Failed to query user_shop_index, falling back to shop loop', {
            email,
            error: indexError.message
          });
        }

        // FALLBACK: If index lookup failed, use legacy method (loop through shops)
        if (!targetShopId) {
          logger.info('[LOGIN] Index lookup failed, using legacy shop loop', { email });

          const shops = await systemDb
            .collection('shops')
            .find({ status: 'Active' })
            .toArray();

          // First check if email matches shop owner email
          for (const shop of shops) {
            if (shop.ownerEmail === email) {
              targetShopId = shop._id.toString(); // Use _id, not shopId
              break;
            }
          }

          // If not found as owner, search in each shop's users collection
          if (!targetShopId) {
            for (const shop of shops) {
              try {
                const shopDb = getShopDatabase(shop._id.toString()); // Use _id, not shopId
                const shopUser = await shopDb
                  .collection('users')
                  .findOne({ email });
                if (shopUser) {
                  targetShopId = shop._id.toString(); // Use _id, not shopId
                  break;
                }
              } catch (error) {
                logger.warn('[LOGIN] Failed to query shop database during Firebase login auto-detect', {
                  shopId: shop._id.toString(),
                  error: error.message
                });
              }
            }
          }
        }

        if (!targetShopId) {
          logger.error('[LOGIN] User not found in any shop', { email });
          return res.status(400).json({
            success: false,
            message:
              'User not found in system. Please contact administrator to add your account.',
          });
        }
      }

      // Verify shop exists (find by _id as string or ObjectId)
      const shop = await systemDb
        .collection('shops')
        .findOne({
          $or: [
            { shopId: targetShopId },
            { _id: targetShopId }
          ]
        });
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

      // Get user from shop database
      const shopDb = getShopDatabase(targetShopId);
      user = await shopDb.collection('users').findOne({ email });
      userDb = targetShopId;
    }

    if (!user) {
      // Increment login attempts on failure
      if (req.incrementLoginAttempts) {
        req.incrementLoginAttempts();
      }
      logger.error('[LOGIN] User not found in MongoDB', { email });
      return res.status(401).json({
        success: false,
        message: 'User not found in system. Please contact administrator.',
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
        message: 'User account is inactive',
      });
    }

    // Reset login attempts on successful authentication
    if (req.resetLoginAttempts) {
      req.resetLoginAttempts();
    }

    // Update last login
    if (userDb === 'system') {
      await systemDb
        .collection('system_users')
        .updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });
    } else {
      const shopDb = getShopDatabase(userDb);
      await shopDb
        .collection('users')
        .updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });
    }

    // Generate token
    const token = generateToken(user);

    // Set JWT as httpOnly cookie (secure, XSS-proof)
    // For same-domain this is the most secure option
    res.cookie('jwt', token, {
      httpOnly: true,           // Cannot be accessed by JavaScript (XSS protection)
      secure: true,             // Always HTTPS (required for sameSite=none)
      sameSite: 'none',         // Allow cross-site cookies
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/',
    });

    logger.info('[LOGIN] Firebase login successful', {
      email: user.email,
      role: user.role,
      shopId: user.shopId || 'N/A (SUPER_ADMIN)',
      userId: user._id.toString()
    });

    // Audit: successful login
    auditLog.log(req, AUDIT_ACTIONS.LOGIN, 'auth', user._id?.toString(),
      `User ${user.email} logged in via Firebase`, {
        after: { email: user.email, role: user.role, shopId: user.shopId || null },
        shopId: user.shopId || null,
        userId: user._id?.toString(),
        userEmail: user.email,
      }
    );

    // Return user data AND token for cross-domain compatibility
    // Frontend will store token in localStorage and send via Authorization header
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          shopId: user.shopId || null,
        },
        token: token, // Include token for cross-domain setups
      },
    });
  } catch (error) {
    logger.error('Firebase login error:', error);
    logger.error('[LOGIN] Unexpected error during Firebase login', {
      error: error.message,
      stack: error.stack,
      email: req.body?.email
    });
    res.status(500).json({
      success: false,
      message: 'Login failed',
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout user by revoking JWT token and clearing the cookie
 * SECURITY FIX: Added token revocation/blacklist
 */
router.post('/logout', (req, res) => {
  try {
    // Get token from cookie or header
    let token = req.cookies?.jwt;
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7);
    }

    // Revoke token (add to blacklist)
    if (token) {
      const { revokeToken } = require('../middleware/auth-multi-tenant');
      const revoked = revokeToken(token);

      if (revoked) {
        logger.info('[LOGOUT] Token revoked successfully');
      } else {
        logger.warn('[LOGOUT] Failed to revoke token (invalid or already expired)');
      }
    }

    // Clear the JWT cookie
    res.clearCookie('jwt', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
    });

    logger.info('[LOGOUT] User logged out successfully');

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed',
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user from JWT cookie (for page refresh/session restore)
 */
router.get('/me', async (req, res) => {
  try {
    // Get JWT from cookie
    const token = req.cookies?.jwt;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
    }

    // Verify token
    const jwt = require('jsonwebtoken');
    let decoded;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (_error) {
      // Token invalid or expired
      res.clearCookie('jwt', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }

    // Get fresh user data from database
    let user;
    const systemDb = getSystemDatabase();

    if (decoded.role === 'SUPER_ADMIN') {
      user = await systemDb
        .collection('system_users')
        .findOne({ _id: require('mongodb').ObjectId(decoded.userId) });
    } else {
      if (!decoded.shopId) {
        return res.status(401).json({
          success: false,
          message: 'Invalid token: missing shopId',
        });
      }

      const shopDb = getShopDatabase(decoded.shopId);
      user = await shopDb
        .collection('users')
        .findOne({ _id: require('mongodb').ObjectId(decoded.userId) });
    }

    if (!user || !user.isActive) {
      res.clearCookie('jwt', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
      });

      return res.status(401).json({
        success: false,
        message: 'User not found or inactive',
      });
    }

    // Return user data
    res.json({
      success: true,
      data: {
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
    logger.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user data',
    });
  }
});

/**
 * GET /api/auth/health
 * Health check endpoint for auth system diagnostics
 */
router.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {}
    };

    // Check Firebase Admin SDK
    try {
      const admin = require('../config/firebase-admin');
      if (admin.apps && admin.apps.length > 0) {
        health.checks.firebaseAdmin = 'ok';
      } else {
        health.checks.firebaseAdmin = 'error: not initialized';
        health.status = 'unhealthy';
      }
    } catch (error) {
      health.checks.firebaseAdmin = `error: ${error.message}`;
      health.status = 'unhealthy';
    }

    // Check MongoDB connection
    try {
      const { getSystemDatabase } = require('../config/database');
      const systemDb = getSystemDatabase();
      await systemDb.admin().ping();
      health.checks.mongodbConnection = 'ok';
    } catch (error) {
      health.checks.mongodbConnection = `error: ${error.message}`;
      health.status = 'unhealthy';
    }

    // Check JWT Secret
    const JWT_SECRET = process.env.JWT_SECRET;
    if (JWT_SECRET && JWT_SECRET.length >= 32) {
      health.checks.jwtSecret = 'set';
    } else if (JWT_SECRET) {
      health.checks.jwtSecret = 'error: too short (min 32 chars)';
      health.status = 'unhealthy';
    } else {
      health.checks.jwtSecret = 'missing';
      health.status = 'unhealthy';
    }

    // Check CORS origins
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
    health.checks.corsOrigins = allowedOrigins.length > 0
      ? allowedOrigins
      : ['none configured - using defaults'];

    // Check if production URLs are configured
    const hasProductionUrls = allowedOrigins.some(origin =>
      origin.includes('health-care-60ee6') ||
      origin.includes('medical-pos-backend.onrender.com')
    );

    if (!hasProductionUrls && process.env.NODE_ENV === 'production') {
      health.checks.productionCors = 'warning: production URLs not in ALLOWED_ORIGINS';
    } else {
      health.checks.productionCors = 'ok';
    }

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);

  } catch (error) {
    logger.error('Auth health check error:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
