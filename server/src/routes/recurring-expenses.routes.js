/**
 * Recurring Expenses Routes
 * Management of recurring expense templates and processing
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
const { asyncHandler, createError } = require('../config/error-handling');
const {
  getRecurringTemplates,
  updateRecurringTemplate,
  stopRecurringExpense,
  processShopRecurringExpenses,
} = require('../services/recurring-expense.service');

// Apply authentication to all routes
router.use(authenticate);
router.use(checkShopStatus);

/**
 * @swagger
 * /api/recurring-expenses:
 *   get:
 *     summary: Get all recurring expense templates
 *     description: Retrieve all recurring expense schedules for the shop. Requires expenses.view permission.
 *     tags: [Expenses]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: categoryId
 *         schema: { type: string }
 *         description: Filter by category
 *       - in: query
 *         name: isActive
 *         schema: { type: boolean }
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: Recurring expenses retrieved
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
 *                       name: { type: string, example: "Monthly Rent" }
 *                       amount: { type: number, example: 50000 }
 *                       frequency: { type: string, enum: [daily, weekly, monthly, yearly] }
 *                       nextDueDate: { type: string, format: date }
 *                       isActive: { type: boolean }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *
 *   post:
 *     summary: Create recurring expense template
 *     description: Set up a new recurring expense schedule. Requires expenses.create permission.
 *     tags: [Expenses]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, categoryId, amount, frequency, startDate]
 *             properties:
 *               name: { type: string, example: "Monthly Rent" }
 *               categoryId: { type: string }
 *               amount: { type: number, minimum: 0, example: 50000 }
 *               frequency:
 *                 type: string
 *                 enum: [daily, weekly, monthly, yearly]
 *                 example: "monthly"
 *               startDate: { type: string, format: date, example: "2026-06-01" }
 *               endDate: { type: string, format: date }
 *               paymentMethod: { type: string, enum: [cash, bank_transfer, card, mobile] }
 *               description: { type: string }
 *     responses:
 *       201:
 *         description: Recurring expense created
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
 * /api/recurring-expenses/{id}:
 *   put:
 *     summary: Update recurring expense template
 *     description: Update a recurring expense schedule. Requires expenses.edit permission.
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
 *               amount: { type: number }
 *               frequency: { type: string }
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: Recurring expense updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Recurring expense updated" }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       404: { $ref: '#/components/responses/NotFoundError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *
 * /api/recurring-expenses/{id}/stop:
 *   post:
 *     summary: Stop recurring expense
 *     description: Deactivate a recurring expense schedule. Requires expenses.edit permission.
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
 *         description: Recurring expense stopped
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Recurring expense stopped" }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       404: { $ref: '#/components/responses/NotFoundError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */

/**
 * GET /api/recurring-expenses
 * Get all recurring expense templates for the shop
 */
router.get(
  '/',
  requirePermission(PERMISSIONS.VIEW_EXPENSES),
  asyncHandler(async (req, res) => {
    const { categoryId, isActive } = req.query;

    const filters = {};
    if (categoryId) {filters.categoryId = categoryId;}
    if (isActive !== undefined) {filters.isActive = isActive === 'true';}

    const templates = await getRecurringTemplates(req.user.shopId, filters);

    res.json({
      success: true,
      data: templates,
      count: templates.length,
    });
  }),
);

/**
 * PUT /api/recurring-expenses/:id
 * Update a recurring expense template
 */
router.put(
  '/:id',
  requirePermission(PERMISSIONS.EDIT_EXPENSE),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    if (!ObjectId.isValid(id)) {
      throw createError.badRequest('Invalid template ID');
    }

    try {
      const result = await updateRecurringTemplate(
        req.user.shopId,
        id,
        updates,
      );

      if (!result.success) {
        throw createError.notFound('Recurring expense template not found');
      }

      res.json({
        success: true,
        message: 'Recurring expense template updated successfully',
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        throw createError.notFound(error.message);
      }
      throw createError.badRequest(error.message);
    }
  }),
);

/**
 * POST /api/recurring-expenses/:id/stop
 * Stop a recurring expense (set end date to today)
 */
router.post(
  '/:id/stop',
  requirePermission(PERMISSIONS.EDIT_EXPENSE),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      throw createError.badRequest('Invalid template ID');
    }

    try {
      const result = await stopRecurringExpense(req.user.shopId, id);

      if (!result.success) {
        throw createError.notFound('Recurring expense template not found');
      }

      res.json({
        success: true,
        message: 'Recurring expense stopped successfully',
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        throw createError.notFound(error.message);
      }
      throw createError.badRequest(error.message);
    }
  }),
);

/**
 * POST /api/recurring-expenses/process
 * Manually trigger processing of due recurring expenses for this shop
 */
router.post(
  '/process',
  requirePermission(PERMISSIONS.CREATE_EXPENSE),
  asyncHandler(async (req, res) => {
    const { processDate } = req.body;

    const dateToProcess = processDate ? new Date(processDate) : new Date();

    try {
      const results = await processShopRecurringExpenses(
        req.user.shopId,
        dateToProcess,
      );

      res.json({
        success: true,
        message: `Processed ${results.processedCount} recurring expenses`,
        data: results,
      });
    } catch (error) {
      throw createError.internalServerError(
        `Error processing recurring expenses: ${error.message}`,
      );
    }
  }),
);

module.exports = router;
