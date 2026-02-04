/**
 * Expense Categories Routes
 * CRUD operations for expense category management
 */

const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb");
const {
  authenticate,
  checkShopStatus,
} = require("../middleware/auth-multi-tenant");
const { requirePermission } = require("../utils/rbac");
const { PERMISSIONS } = require("../utils/rbac");
const { getShopDatabase } = require("../config/database");
const { asyncHandler, createError } = require("../config/error-handling");

// Apply authentication to all routes
router.use(authenticate);
router.use(checkShopStatus);

/**
 * GET /api/expense-categories
 * Get all expense categories for the shop
 */
router.get(
  "/",
  requirePermission(PERMISSIONS.VIEW_EXPENSE_CATEGORIES),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { includeInactive = false } = req.query;

    const query = includeInactive === "true" ? {} : { isActive: true };

    const categories = await shopDb
      .collection("expenseCategories")
      .find(query)
      .sort({ name: 1 })
      .toArray();

    res.json({
      success: true,
      data: categories,
    });
  }),
);

/**
 * GET /api/expense-categories/:id
 * Get expense category by ID
 */
router.get(
  "/:id",
  requirePermission(PERMISSIONS.VIEW_EXPENSE_CATEGORIES),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const category = await shopDb
      .collection("expenseCategories")
      .findOne({ _id: new ObjectId(req.params.id) });

    if (!category) {
      throw createError.notFound("Expense category not found");
    }

    res.json({
      success: true,
      data: category,
    });
  }),
);

/**
 * POST /api/expense-categories
 * Create new expense category
 */
router.post(
  "/",
  requirePermission(PERMISSIONS.CREATE_EXPENSE_CATEGORY),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { name, description, type } = req.body;

    // Validate required fields
    if (!name || !type) {
      throw createError.badRequest("Name and type are required");
    }

    // Validate type
    const validTypes = ["Fixed", "Variable", "One-time"];
    if (!validTypes.includes(type)) {
      throw createError.badRequest(
        "Type must be one of: Fixed, Variable, One-time",
      );
    }

    // Validate name length
    if (name.length < 1 || name.length > 100) {
      throw createError.badRequest("Name must be between 1 and 100 characters");
    }

    // Validate description length if provided
    if (description && description.length > 500) {
      throw createError.badRequest(
        "Description must be less than 500 characters",
      );
    }

    // Check if category name already exists
    const existingCategory = await shopDb
      .collection("expenseCategories")
      .findOne({ name: name.trim() });

    if (existingCategory) {
      throw createError.conflict("Category with this name already exists");
    }

    const categoryData = {
      name: name.trim(),
      description: description?.trim() || null,
      type,
      isActive: true,
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await shopDb
      .collection("expenseCategories")
      .insertOne(categoryData);

    res.status(201).json({
      success: true,
      message: "Expense category created successfully",
      data: { _id: result.insertedId, ...categoryData },
    });
  }),
);

/**
 * PUT /api/expense-categories/:id
 * Update expense category
 */
router.put(
  "/:id",
  requirePermission(PERMISSIONS.EDIT_EXPENSE_CATEGORY),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { name, description, type } = req.body;

    // Validate required fields
    if (!name || !type) {
      throw createError.badRequest("Name and type are required");
    }

    // Validate type
    const validTypes = ["Fixed", "Variable", "One-time"];
    if (!validTypes.includes(type)) {
      throw createError.badRequest(
        "Type must be one of: Fixed, Variable, One-time",
      );
    }

    // Validate name length
    if (name.length < 1 || name.length > 100) {
      throw createError.badRequest("Name must be between 1 and 100 characters");
    }

    // Validate description length if provided
    if (description && description.length > 500) {
      throw createError.badRequest(
        "Description must be less than 500 characters",
      );
    }

    // Check if category exists
    const existingCategory = await shopDb
      .collection("expenseCategories")
      .findOne({ _id: new ObjectId(req.params.id) });

    if (!existingCategory) {
      throw createError.notFound("Expense category not found");
    }

    // Check if name is taken by another category
    const nameCheck = await shopDb.collection("expenseCategories").findOne({
      name: name.trim(),
      _id: { $ne: new ObjectId(req.params.id) },
    });

    if (nameCheck) {
      throw createError.conflict("Category name is already taken");
    }

    const updateData = {
      name: name.trim(),
      description: description?.trim() || null,
      type,
      updatedAt: new Date(),
    };

    await shopDb
      .collection("expenseCategories")
      .updateOne({ _id: new ObjectId(req.params.id) }, { $set: updateData });

    res.json({
      success: true,
      message: "Expense category updated successfully",
    });
  }),
);

/**
 * DELETE /api/expense-categories/:id
 * Soft delete expense category (deactivate)
 */
router.delete(
  "/:id",
  requirePermission(PERMISSIONS.DELETE_EXPENSE_CATEGORY),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);

    // Check if category exists
    const category = await shopDb
      .collection("expenseCategories")
      .findOne({ _id: new ObjectId(req.params.id) });

    if (!category) {
      throw createError.notFound("Expense category not found");
    }

    // Check if category has any expenses
    const expenseCount = await shopDb
      .collection("expenses")
      .countDocuments({ categoryId: new ObjectId(req.params.id) });

    if (expenseCount > 0) {
      throw createError.conflict(
        "Cannot delete category with existing expenses. Please reassign expenses to another category first.",
      );
    }

    // Soft delete - set isActive to false
    await shopDb
      .collection("expenseCategories")
      .updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { isActive: false, updatedAt: new Date() } },
      );

    res.json({
      success: true,
      message: "Expense category deactivated successfully",
    });
  }),
);

module.exports = router;
