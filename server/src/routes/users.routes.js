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

// Apply authentication and shop status check to all routes
router.use(authenticate);
router.use(checkShopStatus);

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
 * Create new user
 */
router.post(
  "/",
  requirePermission(PERMISSIONS.CREATE_STAFF),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { name, email, password, role = "STAFF", isActive = true } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      throw createError.badRequest("Name, email, and password are required");
    }

    // Validate role
    const allowedRoles = ["STAFF"];
    if (req.user.role === "SHOP_ADMIN") {
      allowedRoles.push("SHOP_ADMIN");
    }

    if (!allowedRoles.includes(role)) {
      throw createError.forbidden("You cannot create users with this role");
    }

    // Check if email already exists
    const existingUser = await shopDb
      .collection("users")
      .findOne({ email: email.toLowerCase() });

    if (existingUser) {
      throw createError.conflict("User with this email already exists");
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    const userData = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role,
      isActive: Boolean(isActive),
      shopId: req.user.shopId,
      permissions: [], // Custom permissions can be added later
      lastLogin: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: req.user.id,
    };

    const result = await shopDb.collection("users").insertOne(userData);

    // Return user data without password
    const { password: _, ...userResponse } = userData;
    userResponse._id = result.insertedId;

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: userResponse,
    });
  }),
);

/**
 * PUT /api/users/:id
 * Update user
 */
router.put(
  "/:id",
  requirePermission(PERMISSIONS.EDIT_USER),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { name, email, password, role, isActive } = req.body;

    // Check if user exists
    const existingUser = await shopDb
      .collection("users")
      .findOne({ _id: new ObjectId(req.params.id) });

    if (!existingUser) {
      throw createError.notFound("User not found");
    }

    // Prevent users from editing themselves (except password)
    if (req.params.id === req.user.id && (role || isActive !== undefined)) {
      throw createError.forbidden("You cannot change your own role or status");
    }

    // Validate role if provided
    if (role) {
      const allowedRoles = ["STAFF"];
      if (req.user.role === "SHOP_ADMIN") {
        allowedRoles.push("SHOP_ADMIN");
      }

      if (!allowedRoles.includes(role)) {
        throw createError.forbidden("You cannot assign this role");
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
      updatedBy: req.user.id,
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

    res.json({
      success: true,
      message: "User updated successfully",
    });
  }),
);

/**
 * DELETE /api/users/:id
 * Delete user
 */
router.delete(
  "/:id",
  requirePermission(PERMISSIONS.DELETE_USER),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);

    // Prevent users from deleting themselves
    if (req.params.id === req.user.id) {
      throw createError.forbidden("You cannot delete your own account");
    }

    // Check if user exists
    const user = await shopDb
      .collection("users")
      .findOne({ _id: new ObjectId(req.params.id) });

    if (!user) {
      throw createError.notFound("User not found");
    }

    // Check if user has any associated records (sales, etc.)
    const salesCount = await shopDb
      .collection("sales")
      .countDocuments({ createdBy: req.params.id });

    if (salesCount > 0) {
      throw createError.conflict(
        "Cannot delete user with existing sales records. Deactivate instead.",
      );
    }

    await shopDb
      .collection("users")
      .deleteOne({ _id: new ObjectId(req.params.id) });

    res.json({
      success: true,
      message: "User deleted successfully",
    });
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

    // Users can only change their own password, or admins can change any password
    if (req.params.id !== req.user.id && req.user.role !== "SHOP_ADMIN") {
      throw createError.forbidden("You can only change your own password");
    }

    if (!newPassword || newPassword.length < 6) {
      throw createError.badRequest(
        "New password must be at least 6 characters",
      );
    }

    const user = await shopDb
      .collection("users")
      .findOne({ _id: new ObjectId(req.params.id) });

    if (!user) {
      throw createError.notFound("User not found");
    }

    // If changing own password, verify current password
    if (req.params.id === req.user.id) {
      if (!currentPassword) {
        throw createError.badRequest("Current password is required");
      }

      const isValidPassword = await bcrypt.compare(
        currentPassword,
        user.password,
      );
      if (!isValidPassword) {
        throw createError.unauthorized("Current password is incorrect");
      }
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await shopDb.collection("users").updateOne(
      { _id: new ObjectId(req.params.id) },
      {
        $set: {
          password: hashedPassword,
          updatedAt: new Date(),
          updatedBy: req.user.id,
        },
      },
    );

    res.json({
      success: true,
      message: "Password updated successfully",
    });
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
