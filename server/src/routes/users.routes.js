/**
 * Users Routes - Multi-Tenant
 * Handles user management within shops
 */

const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const { ObjectId } = require("mongodb");
const {
  authenticate,
  checkShopStatus,
} = require("../middleware/auth-multi-tenant");
const { requirePermission } = require("../utils/rbac");
const { PERMISSIONS } = require("../utils/rbac");
const { getShopDatabase } = require("../config/database");
const { asyncHandler, createError } = require("../config/error-handling");
const { logger } = require('../config/logging');
const auditLog = require("../services/audit-log.service");
const { AUDIT_ACTIONS } = require("../models/audit-log.schema");
const { cacheService } = require("../services/cache.service");

// Apply authentication and shop status check to all routes
router.use(authenticate);
router.use(checkShopStatus);

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users in the shop
 *     description: Retrieve all user accounts for the authenticated shop. Passwords are excluded. Requires users.view permission.
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/User' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *
 *   post:
 *     summary: Create new user
 *     description: Create a new user account in the shop. Requires users.create permission.
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, role]
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Ahmed Rahman"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "ahmed@shop.com"
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: "SecurePass123"
 *               role:
 *                 type: string
 *                 enum: [ADMIN, MANAGER, CASHIER]
 *                 example: "CASHIER"
 *               permissions:
 *                 type: array
 *                 items: { type: string }
 *                 description: Additional permissions beyond role defaults
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "User created successfully" }
 *                 data: { $ref: '#/components/schemas/User' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       409:
 *         description: Email already in use
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *
 * /api/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     description: Retrieve a specific user's details. Requires users.view permission.
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/User' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       404: { $ref: '#/components/responses/NotFoundError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *
 *   put:
 *     summary: Update user
 *     description: Update a user's profile, role, or permissions. Requires users.edit permission.
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               role: { type: string, enum: [ADMIN, MANAGER, CASHIER] }
 *               permissions: { type: array, items: { type: string } }
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: User updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "User updated successfully" }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       404: { $ref: '#/components/responses/NotFoundError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *
 *   delete:
 *     summary: Delete user
 *     description: Delete a user account from the shop. Requires users.delete permission.
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "User deleted successfully" }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       404: { $ref: '#/components/responses/NotFoundError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *
 * /api/users/{id}/reset-password:
 *   put:
 *     summary: Reset user password
 *     description: Reset a user's password (admin action). Requires users.edit permission.
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [newPassword]
 *             properties:
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: "NewSecurePass456"
 *     responses:
 *       200:
 *         description: Password reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Password reset successfully" }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       404: { $ref: '#/components/responses/NotFoundError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *
 * /api/users/permissions/list:
 *   get:
 *     summary: Get all available permissions
 *     description: Retrieve the full list of RBAC permissions available in the system. Requires users.view permission.
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Permissions list retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items: { type: string }
 *                   example: ["sales.create", "products.read", "customers.manage"]
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */

/**
 * GET /api/users
 * Get all users in the shop
 */
router.get(
  "/",
  requirePermission(PERMISSIONS.VIEW_USERS),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);

    const users = await shopDb
      .collection("users")
      .find(
        {},
        {
          projection: {
            password: 0, // Exclude password from response
            refreshToken: 0,
          },
        },
      )
      .sort({ createdAt: -1 })
      .toArray();

    res.json({
      success: true,
      data: users,
    });
  }),
);

/**
 * GET /api/users/:id
 * Get user by ID
 */
router.get(
  "/:id",
  requirePermission(PERMISSIONS.VIEW_USERS),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);

    const user = await shopDb.collection("users").findOne(
      { _id: new ObjectId(req.params.id) },
      {
        projection: {
          password: 0,
          refreshToken: 0,
        },
      },
    );

    if (!user) {
      throw createError.notFound("User not found");
    }

    res.json({
      success: true,
      data: user,
    });
  }),
);

/**
 * POST /api/users
 * Create new user (SUPER_ADMIN only)
 */
router.post(
  "/",
  requirePermission(PERMISSIONS.CREATE_USER),
  asyncHandler(async (req, res) => {
    // ── CRITICAL: Only SUPER_ADMIN can create users ──
    if (req.user.role !== "SUPER_ADMIN") {
      throw createError.forbidden("Only SUPER_ADMIN can create users");
    }

    const shopDb = getShopDatabase(req.user.shopId);
    const { name, email, password, role = "STAFF", isActive = true } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      throw createError.badRequest("Name, email, and password are required");
    }

    if (password.length < 6) {
      throw createError.badRequest("Password must be at least 6 characters");
    }

    // Only SUPER_ADMIN can create SUPER_ADMIN (though this should never happen in shop context)
    if (role === "SUPER_ADMIN") {
      throw createError.forbidden("Cannot create SUPER_ADMIN users through this endpoint");
    }

    // Validate role is one of the allowed values
    const validRoles = ["STAFF", "SHOP_ADMIN"];
    if (!validRoles.includes(role)) {
      throw createError.badRequest(`Invalid role. Must be one of: ${validRoles.join(", ")}`);
    }

    // Check if email already exists in MongoDB
    const existingUser = await shopDb
      .collection("users")
      .findOne({ email: email.toLowerCase() });

    if (existingUser) {
      throw createError.conflict("User with this email already exists");
    }

    // ── Step 1: Create in Firebase Auth ──────────────────────────────────
    let firebaseUid = null;
    try {
      const admin = require("../config/firebase-admin");
      const firebaseUser = await admin.auth().createUser({
        email: email.toLowerCase().trim(),
        password,
        displayName: name.trim(),
        disabled: !isActive,
      });
      firebaseUid = firebaseUser.uid;
      logger.info(`Firebase user created: ${firebaseUid} (${email})`);
    } catch (firebaseErr) {
      // If Firebase user already exists, that's OK — just log it
      if (firebaseErr.code === "auth/email-already-exists") {
        logger.warn(`Firebase user already exists for ${email} — linking to MongoDB only`);
      } else {
        logger.error("Failed to create Firebase user:", firebaseErr.message);
        throw createError.internal(`Failed to create user in auth system: ${firebaseErr.message}`);
      }
    }

    // ── Step 2: Create in MongoDB ─────────────────────────────────────────
    const hashedPassword = await bcrypt.hash(password, 12);

    const userData = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      firebaseUid,
      role,
      isActive: Boolean(isActive),
      shopId: req.user.shopId,
      permissions: [],
      lastLogin: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: req.user._id,
    };

    const result = await shopDb.collection("users").insertOne(userData);

    // Return user data without password
    const { password: _, ...userResponse } = userData;
    userResponse._id = result.insertedId;

    // Audit log
    auditLog.log(req, AUDIT_ACTIONS.USER_CREATED, "user", result.insertedId.toString(),
      `Created user ${email} with role ${role}`,
      { after: { name, email, role, shopId: req.user.shopId } }
    );

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: userResponse,
    });
  }),
);


/**
 * PUT /api/users/:id
 * Update user (SUPER_ADMIN only)
 */
router.put(
  "/:id",
  requirePermission(PERMISSIONS.EDIT_USER),
  asyncHandler(async (req, res) => {
    // ── CRITICAL: Only SUPER_ADMIN can edit users ──
    if (req.user.role !== "SUPER_ADMIN") {
      throw createError.forbidden("Only SUPER_ADMIN can edit users");
    }

    const shopDb = getShopDatabase(req.user.shopId);
    const { name, email, password, role, isActive } = req.body;

    // Check if user exists
    const existingUser = await shopDb
      .collection("users")
      .findOne({ _id: new ObjectId(req.params.id) });

    if (!existingUser) {
      throw createError.notFound("User not found");
    }

    // Prevent users from editing themselves (except password through dedicated endpoint)
    if (req.params.id === req.user._id?.toString() && (role || isActive !== undefined)) {
      throw createError.forbidden("You cannot change your own role or status");
    }

    // Nobody can assign SUPER_ADMIN through this endpoint
    if (role === "SUPER_ADMIN") {
      throw createError.forbidden("Cannot assign SUPER_ADMIN role through this endpoint");
    }

    // Validate role if provided
    if (role) {
      const validRoles = ["STAFF", "SHOP_ADMIN"];
      if (!validRoles.includes(role)) {
        throw createError.badRequest(`Invalid role. Must be one of: ${validRoles.join(", ")}`);
      }
    }

    // Check if email is taken by another user
    if (email && email !== existingUser.email) {
      const emailCheck = await shopDb.collection("users").findOne({
        email: email.toLowerCase(),
        _id: { $ne: new ObjectId(req.params.id) },
      });

      if (emailCheck) {
        throw createError.conflict("Email is already taken");
      }
    }

    const updateData = {
      updatedAt: new Date(),
      updatedBy: req.user._id,
    };

    if (name) updateData.name = name.trim();
    if (email) updateData.email = email.toLowerCase().trim();
    if (role) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);

    // Hash new password if provided
    if (password && password.trim()) {
      updateData.password = await bcrypt.hash(password.trim(), 12);
    }

    await shopDb
      .collection("users")
      .updateOne({ _id: new ObjectId(req.params.id) }, { $set: updateData });

    // Audit: user updated (role change gets its own action)
    const action = role && role !== existingUser.role
      ? AUDIT_ACTIONS.ROLE_CHANGED
      : AUDIT_ACTIONS.USER_UPDATED;
    auditLog.log(req, action, "user", req.params.id,
      action === AUDIT_ACTIONS.ROLE_CHANGED
        ? `Changed role of ${existingUser.email} from ${existingUser.role} to ${role}`
        : `Updated user ${existingUser.email}`,
      {
        before: { name: existingUser.name, email: existingUser.email, role: existingUser.role, isActive: existingUser.isActive },
        after: updateData,
      }
    );

    // Invalidate this user's permissions cache (role/permissions may have changed)
    cacheService.invalidateShopCache(req.user.shopId, "permissions", req.params.id);

    res.json({
      success: true,
      message: "User updated successfully",
    });
  }),
);

/**
 * DELETE /api/users/:id
 * Delete user (SUPER_ADMIN only)
 */
router.delete(
  "/:id",
  requirePermission(PERMISSIONS.DELETE_USER),
  asyncHandler(async (req, res) => {
    // ── CRITICAL: Only SUPER_ADMIN can delete users ──
    if (req.user.role !== "SUPER_ADMIN") {
      throw createError.forbidden("Only SUPER_ADMIN can delete users");
    }

    const shopDb = getShopDatabase(req.user.shopId);

    if (req.params.id === req.user.id) {
      throw createError.forbidden("You cannot delete your own account");
    }

    const user = await shopDb
      .collection("users")
      .findOne({ _id: new ObjectId(req.params.id) });

    if (!user) {
      throw createError.notFound("User not found");
    }

    const salesCount = await shopDb
      .collection("sales")
      .countDocuments({ createdBy: req.params.id });

    if (salesCount > 0) {
      throw createError.conflict(
        "Cannot delete user with existing sales records. Deactivate instead.",
      );
    }

    // Remove from Firebase Auth
    if (user.firebaseUid) {
      try {
        const admin = require("../config/firebase-admin");
        await admin.auth().deleteUser(user.firebaseUid);
        logger.info(`Firebase user deleted: ${user.firebaseUid}`);
      } catch (firebaseErr) {
        logger.warn(`Could not delete Firebase user ${user.firebaseUid}: ${firebaseErr.message}`);
        // Non-fatal — still delete from MongoDB
      }
    }

    await shopDb.collection("users").deleteOne({ _id: new ObjectId(req.params.id) });

    auditLog.log(req, AUDIT_ACTIONS.USER_DELETED, "user", req.params.id,
      `Deleted user ${user.email}`,
      { before: { name: user.name, email: user.email, role: user.role } }
    );

    cacheService.invalidateShopCache(req.user.shopId, "permissions", req.params.id);

    res.json({ success: true, message: "User deleted successfully" });
  }),
);


/**
 * PUT /api/users/:id/password
 * Change user password
 */
router.put(
  "/:id/password",
  authenticate,
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { currentPassword, newPassword } = req.body;

    if (req.params.id !== req.user._id?.toString() && req.user.role !== "SHOP_ADMIN") {
      throw createError.forbidden("You can only change your own password");
    }

    if (!newPassword || newPassword.length < 6) {
      throw createError.badRequest("New password must be at least 6 characters");
    }

    const user = await shopDb
      .collection("users")
      .findOne({ _id: new ObjectId(req.params.id) });

    if (!user) throw createError.notFound("User not found");

    if (req.params.id === req.user._id?.toString()) {
      if (!currentPassword) throw createError.badRequest("Current password is required");
      const isValid = await bcrypt.compare(currentPassword, user.password);
      if (!isValid) throw createError.unauthorized("Current password is incorrect");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update MongoDB
    await shopDb.collection("users").updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { password: hashedPassword, updatedAt: new Date(), updatedBy: req.user._id } }
    );

    // Update Firebase Auth
    if (user.firebaseUid) {
      try {
        const admin = require("../config/firebase-admin");
        await admin.auth().updateUser(user.firebaseUid, { password: newPassword });
        logger.info(`Firebase password updated for ${user.email}`);
      } catch (firebaseErr) {
        logger.warn(`Firebase password update failed for ${user.email}: ${firebaseErr.message}`);
        // Non-fatal — MongoDB password already updated
      }
    }

    res.json({ success: true, message: "Password updated successfully" });
  }),
);


/**
 * GET /api/users/profile/me
 * Get current user profile
 */
router.get(
  "/profile/me",
  authenticate,
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);

    const user = await shopDb.collection("users").findOne(
      { _id: new ObjectId(req.user.id) },
      {
        projection: {
          password: 0,
          refreshToken: 0,
        },
      },
    );

    if (!user) {
      throw createError.notFound("User not found");
    }

    res.json({
      success: true,
      data: user,
    });
  }),
);

module.exports = router;
