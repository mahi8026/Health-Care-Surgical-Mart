/**
 * Expense Categories Routes
 * CRUD operations for expense category management
 */

const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const {
  authenticate,
  checkShopStatus,
} = require('../middleware/auth-multi-tenant');
const { requirePermission } = require('../utils/rbac');
const { PERMISSIONS } = require('../utils/rbac');
const { getShopDatabase } = require('../config/database');
const { asyncHandler, createError } = require('../config/error-handling');
const { cacheResponse } = require('../middleware/cache.middleware');
const { cacheService, TTL } = require('../services/cache.service');

// Apply authentication to all routes
router.use(authenticate);
router.use(checkShopStatus);

/**
 * @swagger
 * /api/expense-categories:
 *   get:
 *     summary: Get all expense categories
 *     description: Retrieve expense categories for the shop. Requires expenses.view_categories permission.
 *     tags: [Expenses]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: includeInactive
 *         schema: { type: boolean, default: false }
 *         description: Include inactive categories
 *     responses:
 *       200:
 *         description: Categories retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id: { type: string }
 *                       name: { type: string, example: "Utilities" }
 *                       description: { type: string }
 *                       isActive: { type: boolean }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *
 *   post:
 *     summary: Create expense category
 *     description: Create a new expense category. Requires expenses.manage_categories permission.
 *     tags: [Expenses]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, example: "Utilities" }
 *               description: { type: string, example: "Electricity, water, internet bills" }
 *               color: { type: string, example: "#FF5733" }
 *     responses:
 *       201:
 *         description: Category created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: object }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *
 * /api/expense-categories/{id}:
 *   get:
 *     summary: Get expense category by ID
 *     description: Retrieve a specific expense category. Requires expenses.view_categories permission.
 *     tags: [Expenses]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Category retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: object }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       404: { $ref: '#/components/responses/NotFoundError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *
 *   put:
 *     summary: Update expense category
 *     description: Update an expense category. Requires expenses.manage_categories permission.
 *     tags: [Expenses]
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
 *               description: { type: string }
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: Category updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Category updated successfully" }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       404: { $ref: '#/components/responses/NotFoundError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *
 *   delete:
 *     summary: Delete expense category
 *     description: Delete an expense category. Cannot delete if expenses are linked. Requires expenses.manage_categories permission.
 *     tags: [Expenses]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Category deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Category deleted successfully" }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       404: { $ref: '#/components/responses/NotFoundError' }
 *       409:
 *         description: Cannot delete category with linked expenses
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */

/**
 * GET /api/expense-categories
 * Get all expense categories for the shop
 */
router.get(
  '/',
  requirePermission(PERMISSIONS.VIEW_EXPENSE_CATEGORIES),
  cacheResponse(TTL.EXPENSE_CATS, (req) => `expense-cats:${req.user.shopId}`),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { includeInactive = false } = req.query;

    const query = includeInactive === 'true' ? {} : { isActive: true };

    const categories = await shopDb
      .collection('expense_categories')
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
  '/:id',
  requirePermission(PERMISSIONS.VIEW_EXPENSE_CATEGORIES),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);

    if (!ObjectId.isValid(req.params.id)) {
      throw createError.notFound('Expense category not found');
    }

    const category = await shopDb
      .collection('expense_categories')
      .findOne({ _id: new ObjectId(req.params.id) });

    if (!category) {
      throw createError.notFound('Expense category not found');
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
  '/',
  requirePermission(PERMISSIONS.CREATE_EXPENSE_CATEGORY),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { name, description, type } = req.body;

    // Validate required fields
    if (!name || !type) {
      throw createError.badRequest('Name and type are required');
    }

    // Validate type
    const validTypes = ['Fixed', 'Variable', 'One-time'];
    if (!validTypes.includes(type)) {
      throw createError.badRequest(
        'Type must be one of: Fixed, Variable, One-time',
      );
    }

    // Validate name length
    if (name.length < 1 || name.length > 100) {
      throw createError.badRequest('Name must be between 1 and 100 characters');
    }

    // Validate description length if provided
    if (description && description.length > 500) {
      throw createError.badRequest(
        'Description must be less than 500 characters',
      );
    }

    // Check if category name already exists
    const existingCategory = await shopDb
      .collection('expense_categories')
      .findOne({ name: name.trim() });

    if (existingCategory) {
      throw createError.conflict('Category with this name already exists');
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
      .collection('expense_categories')
      .insertOne(categoryData);

    // Invalidate expense categories cache
    cacheService.invalidateShopCache(req.user.shopId, 'expense-cats');

    res.status(201).json({
      success: true,
      message: 'Expense category created successfully',
      data: { _id: result.insertedId, ...categoryData },
    });
  }),
);

/**
 * PUT /api/expense-categories/:id
 * Update expense category
 */
router.put(
  '/:id',
  requirePermission(PERMISSIONS.EDIT_EXPENSE_CATEGORY),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { name, description, type } = req.body;

    if (!ObjectId.isValid(req.params.id)) {
      throw createError.notFound('Expense category not found');
    }

    // Validate required fields
    if (!name || !type) {
      throw createError.badRequest('Name and type are required');
    }

    // Validate type
    const validTypes = ['Fixed', 'Variable', 'One-time'];
    if (!validTypes.includes(type)) {
      throw createError.badRequest(
        'Type must be one of: Fixed, Variable, One-time',
      );
    }

    // Validate name length
    if (name.length < 1 || name.length > 100) {
      throw createError.badRequest('Name must be between 1 and 100 characters');
    }

    // Validate description length if provided
    if (description && description.length > 500) {
      throw createError.badRequest(
        'Description must be less than 500 characters',
      );
    }

    // Check if category exists
    const existingCategory = await shopDb
      .collection('expense_categories')
      .findOne({ _id: new ObjectId(req.params.id) });

    if (!existingCategory) {
      throw createError.notFound('Expense category not found');
    }

    // Check if name is taken by another category
    const nameCheck = await shopDb.collection('expense_categories').findOne({
      name: name.trim(),
      _id: { $ne: new ObjectId(req.params.id) },
    });

    if (nameCheck) {
      throw createError.conflict('Category name is already taken');
    }

    const updateData = {
      name: name.trim(),
      description: description?.trim() || null,
      type,
      updatedAt: new Date(),
    };

    await shopDb
      .collection('expense_categories')
      .updateOne({ _id: new ObjectId(req.params.id) }, { $set: updateData });

    // Invalidate expense categories cache
    cacheService.invalidateShopCache(req.user.shopId, 'expense-cats');

    res.json({
      success: true,
      message: 'Expense category updated successfully',
    });
  }),
);

/**
 * DELETE /api/expense-categories/:id
 * Soft delete expense category (deactivate)
 */
router.delete(
  '/:id',
  requirePermission(PERMISSIONS.DELETE_EXPENSE_CATEGORY),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);

    if (!ObjectId.isValid(req.params.id)) {
      throw createError.notFound('Expense category not found');
    }

    // Check if category exists
    const category = await shopDb
      .collection('expense_categories')
      .findOne({ _id: new ObjectId(req.params.id) });

    if (!category) {
      throw createError.notFound('Expense category not found');
    }

    // Check if category has any expenses
    const expenseCount = await shopDb
      .collection('expenses')
      .countDocuments({ categoryId: new ObjectId(req.params.id) });

    if (expenseCount > 0) {
      throw createError.conflict(
        'Cannot delete category with existing expenses. Please reassign expenses to another category first.',
      );
    }

    // Soft delete - set isActive to false
    await shopDb
      .collection('expense_categories')
      .updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { isActive: false, updatedAt: new Date() } },
      );

    // Invalidate expense categories cache
    cacheService.invalidateShopCache(req.user.shopId, 'expense-cats');

    res.json({
      success: true,
      message: 'Expense category deactivated successfully',
    });
  }),
);

module.exports = router;
