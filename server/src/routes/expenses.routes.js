/**
 * Expenses Routes
 * CRUD operations for expense management
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
const {
  generateExpenseNumber,
} = require("../services/expense-number-generator");
const {
  receiptUpload,
  processUploadedFiles,
  deleteUploadedFile,
  getFilePath,
} = require("../services/file-upload.service");

// Apply authentication to all routes
router.use(authenticate);
router.use(checkShopStatus);

/**
 * GET /api/expenses
 * Get all expenses for the shop with advanced filtering and pagination
 */
router.get(
  "/",
  requirePermission(PERMISSIONS.VIEW_EXPENSES),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const {
      page = 1,
      limit = 50,
      search = "",
      startDate,
      endDate,
      categoryId,
      paymentMethod,
      minAmount,
      maxAmount,
      vendor,
      tags,
      isRecurring,
      sortBy = "expenseDate",
      sortOrder = "desc",
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    let matchQuery = {};

    // Date range filter
    if (startDate || endDate) {
      matchQuery.expenseDate = {};
      if (startDate) matchQuery.expenseDate.$gte = new Date(startDate);
      if (endDate) matchQuery.expenseDate.$lte = new Date(endDate);
    }

    // Category filter - support multiple categories
    if (categoryId) {
      if (Array.isArray(categoryId)) {
        matchQuery.categoryId = {
          $in: categoryId.map((id) => new ObjectId(id)),
        };
      } else {
        matchQuery.categoryId = new ObjectId(categoryId);
      }
    }

    // Payment method filter - support multiple methods
    if (paymentMethod) {
      if (Array.isArray(paymentMethod)) {
        matchQuery.paymentMethod = { $in: paymentMethod };
      } else {
        matchQuery.paymentMethod = paymentMethod;
      }
    }

    // Amount range filter
    if (minAmount || maxAmount) {
      matchQuery.amount = {};
      if (minAmount) matchQuery.amount.$gte = parseFloat(minAmount);
      if (maxAmount) matchQuery.amount.$lte = parseFloat(maxAmount);
    }

    // Vendor filter
    if (vendor) {
      matchQuery["vendor.name"] = { $regex: vendor, $options: "i" };
    }

    // Tags filter - support multiple tags
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      matchQuery.tags = { $in: tagArray.map((tag) => new RegExp(tag, "i")) };
    }

    // Recurring filter
    if (isRecurring !== undefined) {
      matchQuery.isRecurring = isRecurring === "true";
    }

    const pipeline = [
      { $match: matchQuery },
      {
        $lookup: {
          from: "expenseCategories",
          localField: "categoryId",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: "$category" },
      {
        $lookup: {
          from: "users",
          localField: "createdBy",
          foreignField: "_id",
          as: "createdByUser",
        },
      },
      { $unwind: "$createdByUser" },
    ];

    // Enhanced search filter
    if (search) {
      const searchRegex = new RegExp(search, "i");
      const searchAmount = parseFloat(search);

      const searchConditions = [
        { description: { $regex: search, $options: "i" } },
        { "vendor.name": { $regex: search, $options: "i" } },
        { "vendor.email": { $regex: search, $options: "i" } },
        { expenseNumber: { $regex: search, $options: "i" } },
        { tags: { $in: [searchRegex] } },
        { notes: { $regex: search, $options: "i" } },
        { "category.name": { $regex: search, $options: "i" } },
        { "createdByUser.name": { $regex: search, $options: "i" } },
      ];

      // Add amount search if search term is a valid number
      if (!isNaN(searchAmount) && isFinite(searchAmount)) {
        searchConditions.push({ amount: searchAmount });
      }

      pipeline.push({
        $match: {
          $or: searchConditions,
        },
      });
    }

    // Enhanced sorting
    const sortDirection = sortOrder === "desc" ? -1 : 1;
    let sortField;

    switch (sortBy) {
      case "amount":
        sortField = "amount";
        break;
      case "category":
        sortField = "category.name";
        break;
      case "vendor":
        sortField = "vendor.name";
        break;
      case "paymentMethod":
        sortField = "paymentMethod";
        break;
      case "createdAt":
        sortField = "createdAt";
        break;
      case "expenseDate":
      default:
        sortField = "expenseDate";
        break;
    }

    pipeline.push({ $sort: { [sortField]: sortDirection } });

    // Get total count for pagination (before applying skip/limit)
    const countPipeline = [...pipeline];
    countPipeline.push({ $count: "total" });

    const countResult = await shopDb
      .collection("expenses")
      .aggregate(countPipeline)
      .toArray();

    const total = countResult.length > 0 ? countResult[0].total : 0;

    // Add pagination
    pipeline.push({ $skip: skip }, { $limit: parseInt(limit) });

    const expenses = await shopDb
      .collection("expenses")
      .aggregate(pipeline)
      .toArray();

    res.json({
      success: true,
      data: expenses,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
      filters: {
        search,
        startDate,
        endDate,
        categoryId,
        paymentMethod,
        minAmount,
        maxAmount,
        vendor,
        tags,
        isRecurring,
        sortBy,
        sortOrder,
      },
    });
  }),
);

/**
 * GET /api/expenses/filter-options
 * Get available filter options for expenses
 */
router.get(
  "/filter-options",
  requirePermission(PERMISSIONS.VIEW_EXPENSES),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);

    // Get available categories
    const categories = await shopDb
      .collection("expenseCategories")
      .find({ isActive: true })
      .sort({ name: 1 })
      .toArray();

    // Get available payment methods from existing expenses
    const paymentMethods = await shopDb
      .collection("expenses")
      .distinct("paymentMethod");

    // Get available vendors from existing expenses
    const vendors = await shopDb
      .collection("expenses")
      .aggregate([
        { $match: { "vendor.name": { $exists: true, $ne: null } } },
        { $group: { _id: "$vendor.name" } },
        { $sort: { _id: 1 } },
        { $limit: 100 }, // Limit to prevent too many results
      ])
      .toArray();

    // Get available tags from existing expenses
    const tags = await shopDb
      .collection("expenses")
      .aggregate([
        { $unwind: "$tags" },
        { $group: { _id: "$tags" } },
        { $sort: { _id: 1 } },
        { $limit: 100 }, // Limit to prevent too many results
      ])
      .toArray();

    // Get amount range from existing expenses
    const amountRange = await shopDb
      .collection("expenses")
      .aggregate([
        {
          $group: {
            _id: null,
            minAmount: { $min: "$amount" },
            maxAmount: { $max: "$amount" },
          },
        },
      ])
      .toArray();

    // Get date range from existing expenses
    const dateRange = await shopDb
      .collection("expenses")
      .aggregate([
        {
          $group: {
            _id: null,
            minDate: { $min: "$expenseDate" },
            maxDate: { $max: "$expenseDate" },
          },
        },
      ])
      .toArray();

    res.json({
      success: true,
      data: {
        categories: categories.map((cat) => ({
          id: cat._id,
          name: cat.name,
          type: cat.type,
        })),
        paymentMethods: paymentMethods.filter(Boolean),
        vendors: vendors.map((v) => v._id).filter(Boolean),
        tags: tags.map((t) => t._id).filter(Boolean),
        amountRange:
          amountRange.length > 0
            ? {
                min: amountRange[0].minAmount || 0,
                max: amountRange[0].maxAmount || 0,
              }
            : { min: 0, max: 0 },
        dateRange:
          dateRange.length > 0
            ? {
                min: dateRange[0].minDate,
                max: dateRange[0].maxDate,
              }
            : { min: null, max: null },
        sortOptions: [
          { value: "expenseDate", label: "Date" },
          { value: "amount", label: "Amount" },
          { value: "category", label: "Category" },
          { value: "vendor", label: "Vendor" },
          { value: "paymentMethod", label: "Payment Method" },
          { value: "createdAt", label: "Created Date" },
        ],
      },
    });
  }),
);

router.get(
  "/:id",
  requirePermission(PERMISSIONS.VIEW_EXPENSES),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);

    const expense = await shopDb
      .collection("expenses")
      .aggregate([
        { $match: { _id: new ObjectId(req.params.id) } },
        {
          $lookup: {
            from: "expenseCategories",
            localField: "categoryId",
            foreignField: "_id",
            as: "category",
          },
        },
        { $unwind: "$category" },
        {
          $lookup: {
            from: "users",
            localField: "createdBy",
            foreignField: "_id",
            as: "createdByUser",
          },
        },
        { $unwind: "$createdByUser" },
      ])
      .toArray();

    if (expense.length === 0) {
      throw createError.notFound("Expense not found");
    }

    res.json({
      success: true,
      data: expense[0],
    });
  }),
);

/**
 * POST /api/expenses
 * Create new expense
 */
router.post(
  "/",
  requirePermission(PERMISSIONS.CREATE_EXPENSE),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const {
      categoryId,
      amount,
      description,
      expenseDate = new Date(),
      paymentMethod = "cash",
      vendor,
      attachments = [],
      isRecurring = false,
      recurringConfig,
      tags = [],
      notes,
    } = req.body;

    // Validate required fields
    if (!categoryId || !amount || amount <= 0) {
      throw createError.badRequest(
        "Category ID and positive amount are required",
      );
    }

    // Validate category exists and is active
    const category = await shopDb
      .collection("expenseCategories")
      .findOne({ _id: new ObjectId(categoryId), isActive: true });

    if (!category) {
      throw createError.notFound("Active expense category not found");
    }

    // Validate payment method
    const validPaymentMethods = ["cash", "bank", "card"];
    if (!validPaymentMethods.includes(paymentMethod)) {
      throw createError.badRequest(
        "Payment method must be one of: cash, bank, card",
      );
    }

    // Validate expense date (cannot be future date unless recurring)
    const expenseDateObj = new Date(expenseDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today

    if (!isRecurring && expenseDateObj > today) {
      throw createError.badRequest("Expense date cannot be in the future");
    }

    // Validate amount precision (max 2 decimal places)
    const amountNum = parseFloat(amount);
    if (Math.round(amountNum * 100) / 100 !== amountNum) {
      throw createError.badRequest("Amount can have maximum 2 decimal places");
    }

    // Validate description length
    if (description && description.length > 1000) {
      throw createError.badRequest(
        "Description must be less than 1000 characters",
      );
    }

    // Validate vendor information if provided
    if (vendor) {
      if (vendor.name && vendor.name.length > 200) {
        throw createError.badRequest(
          "Vendor name must be less than 200 characters",
        );
      }
      if (vendor.phone && vendor.phone.length > 20) {
        throw createError.badRequest(
          "Vendor phone must be less than 20 characters",
        );
      }
      if (
        vendor.email &&
        !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(vendor.email)
      ) {
        throw createError.badRequest("Invalid vendor email format");
      }
    }

    // Validate recurring configuration if provided
    if (isRecurring && recurringConfig) {
      const validFrequencies = ["daily", "weekly", "monthly", "yearly"];
      if (!validFrequencies.includes(recurringConfig.frequency)) {
        throw createError.badRequest(
          "Recurring frequency must be one of: daily, weekly, monthly, yearly",
        );
      }

      if (recurringConfig.interval && recurringConfig.interval < 1) {
        throw createError.badRequest("Recurring interval must be at least 1");
      }

      if (recurringConfig.endDate && recurringConfig.startDate) {
        if (
          new Date(recurringConfig.endDate) <=
          new Date(recurringConfig.startDate)
        ) {
          throw createError.badRequest(
            "Recurring end date must be after start date",
          );
        }
      }
    }

    // Validate notes length
    if (notes && notes.length > 2000) {
      throw createError.badRequest("Notes must be less than 2000 characters");
    }

    // Generate expense number
    const expenseNumber = await generateExpenseNumber(shopDb);

    // Prepare expense data
    const expenseData = {
      expenseNumber,
      categoryId: new ObjectId(categoryId),
      categoryName: category.name, // Denormalized for reporting
      amount: amountNum,
      description: description?.trim() || null,
      expenseDate: expenseDateObj,
      paymentMethod,
      vendor: vendor
        ? {
            name: vendor.name?.trim() || null,
            phone: vendor.phone?.trim() || null,
            email: vendor.email?.trim() || null,
          }
        : null,
      attachments: attachments || [],
      isRecurring,
      recurringConfig:
        isRecurring && recurringConfig
          ? {
              frequency: recurringConfig.frequency,
              interval: recurringConfig.interval || 1,
              startDate: recurringConfig.startDate
                ? new Date(recurringConfig.startDate)
                : expenseDateObj,
              endDate: recurringConfig.endDate
                ? new Date(recurringConfig.endDate)
                : null,
              nextDueDate: recurringConfig.nextDueDate
                ? new Date(recurringConfig.nextDueDate)
                : null,
            }
          : null,
      tags: Array.isArray(tags)
        ? tags.filter((tag) => typeof tag === "string" && tag.trim())
        : [],
      notes: notes?.trim() || null,
      createdBy: new ObjectId(req.user.id),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await shopDb.collection("expenses").insertOne(expenseData);

    res.status(201).json({
      success: true,
      message: "Expense created successfully",
      data: { _id: result.insertedId, ...expenseData },
    });
  }),
);

/**
 * PUT /api/expenses/:id
 * Update existing expense
 */
router.put(
  "/:id",
  requirePermission(PERMISSIONS.EDIT_EXPENSE),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const {
      categoryId,
      amount,
      description,
      expenseDate,
      paymentMethod,
      vendor,
      attachments,
      isRecurring,
      recurringConfig,
      tags,
      notes,
    } = req.body;

    // Check if expense exists
    const existingExpense = await shopDb
      .collection("expenses")
      .findOne({ _id: new ObjectId(req.params.id) });

    if (!existingExpense) {
      throw createError.notFound("Expense not found");
    }

    // Validate required fields if provided
    if (amount !== undefined && amount <= 0) {
      throw createError.badRequest("Amount must be positive");
    }

    // Validate category if provided
    if (categoryId) {
      const category = await shopDb
        .collection("expenseCategories")
        .findOne({ _id: new ObjectId(categoryId), isActive: true });

      if (!category) {
        throw createError.notFound("Active expense category not found");
      }
    }

    // Validate payment method if provided
    if (paymentMethod) {
      const validPaymentMethods = ["cash", "bank", "card"];
      if (!validPaymentMethods.includes(paymentMethod)) {
        throw createError.badRequest(
          "Payment method must be one of: cash, bank, card",
        );
      }
    }

    // Validate expense date if provided
    if (expenseDate) {
      const expenseDateObj = new Date(expenseDate);
      const today = new Date();
      today.setHours(23, 59, 59, 999);

      if (!existingExpense.isRecurring && expenseDateObj > today) {
        throw createError.badRequest("Expense date cannot be in the future");
      }
    }

    // Validate amount precision if provided
    if (amount !== undefined) {
      const amountNum = parseFloat(amount);
      if (Math.round(amountNum * 100) / 100 !== amountNum) {
        throw createError.badRequest(
          "Amount can have maximum 2 decimal places",
        );
      }
    }

    // Build update data
    const updateData = {
      updatedAt: new Date(),
    };

    if (categoryId) {
      const category = await shopDb
        .collection("expenseCategories")
        .findOne({ _id: new ObjectId(categoryId) });
      updateData.categoryId = new ObjectId(categoryId);
      updateData.categoryName = category.name;
    }

    if (amount !== undefined) updateData.amount = parseFloat(amount);
    if (description !== undefined)
      updateData.description = description?.trim() || null;
    if (expenseDate !== undefined)
      updateData.expenseDate = new Date(expenseDate);
    if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod;
    if (vendor !== undefined) {
      updateData.vendor = vendor
        ? {
            name: vendor.name?.trim() || null,
            phone: vendor.phone?.trim() || null,
            email: vendor.email?.trim() || null,
          }
        : null;
    }
    if (attachments !== undefined) updateData.attachments = attachments || [];
    if (isRecurring !== undefined) updateData.isRecurring = isRecurring;
    if (recurringConfig !== undefined) {
      updateData.recurringConfig =
        isRecurring && recurringConfig
          ? {
              frequency: recurringConfig.frequency,
              interval: recurringConfig.interval || 1,
              startDate: recurringConfig.startDate
                ? new Date(recurringConfig.startDate)
                : null,
              endDate: recurringConfig.endDate
                ? new Date(recurringConfig.endDate)
                : null,
              nextDueDate: recurringConfig.nextDueDate
                ? new Date(recurringConfig.nextDueDate)
                : null,
            }
          : null;
    }
    if (tags !== undefined) {
      updateData.tags = Array.isArray(tags)
        ? tags.filter((tag) => typeof tag === "string" && tag.trim())
        : [];
    }
    if (notes !== undefined) updateData.notes = notes?.trim() || null;

    await shopDb
      .collection("expenses")
      .updateOne({ _id: new ObjectId(req.params.id) }, { $set: updateData });

    res.json({
      success: true,
      message: "Expense updated successfully",
    });
  }),
);

/**
 * DELETE /api/expenses/:id
 * Delete expense
 */
router.delete(
  "/:id",
  requirePermission(PERMISSIONS.DELETE_EXPENSE),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);

    // Check if expense exists
    const expense = await shopDb
      .collection("expenses")
      .findOne({ _id: new ObjectId(req.params.id) });

    if (!expense) {
      throw createError.notFound("Expense not found");
    }

    // Delete the expense
    await shopDb
      .collection("expenses")
      .deleteOne({ _id: new ObjectId(req.params.id) });

    res.json({
      success: true,
      message: "Expense deleted successfully",
    });
  }),
);

/**
 * POST /api/expenses/bulk-delete
 * Delete multiple expenses
 */
router.post(
  "/bulk-delete",
  requirePermission(PERMISSIONS.DELETE_EXPENSE),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { expenseIds } = req.body;

    if (!expenseIds || !Array.isArray(expenseIds) || expenseIds.length === 0) {
      throw createError.badRequest("Expense IDs array is required");
    }

    // Validate all IDs are valid ObjectIds
    const objectIds = expenseIds.map((id) => {
      if (!ObjectId.isValid(id)) {
        throw createError.badRequest(`Invalid expense ID: ${id}`);
      }
      return new ObjectId(id);
    });

    // Check how many expenses exist
    const existingCount = await shopDb
      .collection("expenses")
      .countDocuments({ _id: { $in: objectIds } });

    if (existingCount === 0) {
      throw createError.notFound("No expenses found with provided IDs");
    }

    // Delete the expenses
    const result = await shopDb
      .collection("expenses")
      .deleteMany({ _id: { $in: objectIds } });

    res.json({
      success: true,
      message: `${result.deletedCount} expense(s) deleted successfully`,
      deletedCount: result.deletedCount,
    });
  }),
);

/**
 * POST /api/expenses/upload-receipt
 * Upload receipt files for an expense
 */
router.post(
  "/upload-receipt",
  requirePermission(PERMISSIONS.UPLOAD_RECEIPT),
  receiptUpload.array("receipts", 5), // Allow up to 5 files
  asyncHandler(async (req, res) => {
    if (!req.files || req.files.length === 0) {
      throw createError.badRequest("No files uploaded");
    }

    // Process uploaded files
    const fileInfo = processUploadedFiles(req.files, req.user.shopId);

    res.json({
      success: true,
      message: `${req.files.length} file(s) uploaded successfully`,
      data: fileInfo,
    });
  }),
);

/**
 * GET /api/expenses/receipts/:shopId/:filename
 * Serve receipt files
 */
router.get(
  "/receipts/:shopId/:filename",
  requirePermission(PERMISSIONS.VIEW_EXPENSES),
  asyncHandler(async (req, res) => {
    const { shopId, filename } = req.params;

    // Verify user has access to this shop's files
    if (req.user.shopId !== shopId) {
      throw createError.forbidden("Access denied to this shop's files");
    }

    const filePath = getFilePath(shopId, filename);

    if (!filePath) {
      throw createError.notFound("File not found");
    }

    // Set appropriate headers
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);

    // Send file
    res.sendFile(filePath);
  }),
);

/**
 * DELETE /api/expenses/receipts/:filename
 * Delete a receipt file
 */
router.delete(
  "/receipts/:filename",
  requirePermission(PERMISSIONS.DELETE_EXPENSE),
  asyncHandler(async (req, res) => {
    const { filename } = req.params;

    const success = await deleteUploadedFile(req.user.shopId, filename);

    if (!success) {
      throw createError.notFound("File not found or could not be deleted");
    }

    res.json({
      success: true,
      message: "Receipt file deleted successfully",
    });
  }),
);

/**
 * PUT /api/expenses/:id/attachments
 * Update expense attachments
 */
router.put(
  "/:id/attachments",
  requirePermission(PERMISSIONS.EDIT_EXPENSE),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { attachments } = req.body;

    // Check if expense exists
    const expense = await shopDb
      .collection("expenses")
      .findOne({ _id: new ObjectId(req.params.id) });

    if (!expense) {
      throw createError.notFound("Expense not found");
    }

    // Validate attachments format
    if (attachments && !Array.isArray(attachments)) {
      throw createError.badRequest("Attachments must be an array");
    }

    // Update expense attachments
    await shopDb.collection("expenses").updateOne(
      { _id: new ObjectId(req.params.id) },
      {
        $set: {
          attachments: attachments || [],
          updatedAt: new Date(),
        },
      },
    );

    res.json({
      success: true,
      message: "Expense attachments updated successfully",
    });
  }),
);

module.exports = router;
