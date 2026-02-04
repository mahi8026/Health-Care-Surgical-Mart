/**
 * Recurring Expenses Routes
 * Management of recurring expense templates and processing
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
const { asyncHandler, createError } = require("../config/error-handling");
const {
  getRecurringTemplates,
  updateRecurringTemplate,
  stopRecurringExpense,
  processShopRecurringExpenses,
} = require("../services/recurring-expense.service");

// Apply authentication to all routes
router.use(authenticate);
router.use(checkShopStatus);

/**
 * GET /api/recurring-expenses
 * Get all recurring expense templates for the shop
 */
router.get(
  "/",
  requirePermission(PERMISSIONS.VIEW_EXPENSES),
  asyncHandler(async (req, res) => {
    const { categoryId, isActive } = req.query;

    const filters = {};
    if (categoryId) filters.categoryId = categoryId;
    if (isActive !== undefined) filters.isActive = isActive === "true";

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
  "/:id",
  requirePermission(PERMISSIONS.EDIT_EXPENSE),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    if (!ObjectId.isValid(id)) {
      throw createError.badRequest("Invalid template ID");
    }

    try {
      const result = await updateRecurringTemplate(
        req.user.shopId,
        id,
        updates,
      );

      if (!result.success) {
        throw createError.notFound("Recurring expense template not found");
      }

      res.json({
        success: true,
        message: "Recurring expense template updated successfully",
      });
    } catch (error) {
      if (error.message.includes("not found")) {
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
  "/:id/stop",
  requirePermission(PERMISSIONS.EDIT_EXPENSE),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      throw createError.badRequest("Invalid template ID");
    }

    try {
      const result = await stopRecurringExpense(req.user.shopId, id);

      if (!result.success) {
        throw createError.notFound("Recurring expense template not found");
      }

      res.json({
        success: true,
        message: "Recurring expense stopped successfully",
      });
    } catch (error) {
      if (error.message.includes("not found")) {
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
  "/process",
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
