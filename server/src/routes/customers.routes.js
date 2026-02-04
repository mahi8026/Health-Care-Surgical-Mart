/**
 * Customers Routes
 * CRUD operations for customer management
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
 * GET /api/customers
 * Get all customers for the shop
 */
router.get(
  "/",
  requirePermission(PERMISSIONS.VIEW_CUSTOMERS),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { page = 1, limit = 50, search = "" } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const searchQuery = search
      ? {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { phone: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const customers = await shopDb
      .collection("customers")
      .find(searchQuery)
      .sort({ name: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    const total = await shopDb
      .collection("customers")
      .countDocuments(searchQuery);

    res.json({
      success: true,
      data: customers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  }),
);

/**
 * GET /api/customers/:id
 * Get customer by ID
 */
router.get(
  "/:id",
  requirePermission(PERMISSIONS.VIEW_CUSTOMERS),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const customer = await shopDb
      .collection("customers")
      .findOne({ _id: new ObjectId(req.params.id) });

    if (!customer) {
      throw createError.notFound("Customer not found");
    }

    res.json({
      success: true,
      data: customer,
    });
  }),
);

/**
 * POST /api/customers
 * Create new customer
 */
router.post(
  "/",
  requirePermission(PERMISSIONS.CREATE_CUSTOMER),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { name, phone, email, address, type = "Regular" } = req.body;

    // Validate required fields
    if (!name || !phone) {
      throw createError.badRequest("Name and phone are required");
    }

    // Check if phone already exists
    const existingCustomer = await shopDb
      .collection("customers")
      .findOne({ phone });

    if (existingCustomer) {
      throw createError.conflict("Customer with this phone already exists");
    }

    const customerData = {
      name: name.trim(),
      phone: phone.trim(),
      email: email?.trim() || null,
      address: address?.trim() || null,
      type,
      totalPurchases: 0,
      lastPurchaseDate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: req.user.id,
    };

    const result = await shopDb.collection("customers").insertOne(customerData);

    res.status(201).json({
      success: true,
      message: "Customer created successfully",
      data: { _id: result.insertedId, ...customerData },
    });
  }),
);

/**
 * PUT /api/customers/:id
 * Update customer
 */
router.put(
  "/:id",
  requirePermission(PERMISSIONS.EDIT_CUSTOMER),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { name, phone, email, address, type } = req.body;

    // Validate required fields
    if (!name || !phone) {
      throw createError.badRequest("Name and phone are required");
    }

    // Check if customer exists
    const existingCustomer = await shopDb
      .collection("customers")
      .findOne({ _id: new ObjectId(req.params.id) });

    if (!existingCustomer) {
      throw createError.notFound("Customer not found");
    }

    // Check if phone is taken by another customer
    const phoneCheck = await shopDb.collection("customers").findOne({
      phone: phone.trim(),
      _id: { $ne: new ObjectId(req.params.id) },
    });

    if (phoneCheck) {
      throw createError.conflict("Phone number is already taken");
    }

    const updateData = {
      name: name.trim(),
      phone: phone.trim(),
      email: email?.trim() || null,
      address: address?.trim() || null,
      type,
      updatedAt: new Date(),
      updatedBy: req.user.id,
    };

    await shopDb
      .collection("customers")
      .updateOne({ _id: new ObjectId(req.params.id) }, { $set: updateData });

    res.json({
      success: true,
      message: "Customer updated successfully",
    });
  }),
);

/**
 * DELETE /api/customers/:id
 * Delete customer
 */
router.delete(
  "/:id",
  requirePermission(PERMISSIONS.DELETE_CUSTOMER),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);

    // Check if customer exists
    const customer = await shopDb
      .collection("customers")
      .findOne({ _id: new ObjectId(req.params.id) });

    if (!customer) {
      throw createError.notFound("Customer not found");
    }

    // Check if customer has any sales
    const salesCount = await shopDb
      .collection("sales")
      .countDocuments({ customerId: req.params.id });

    if (salesCount > 0) {
      throw createError.conflict(
        "Cannot delete customer with existing sales records",
      );
    }

    await shopDb
      .collection("customers")
      .deleteOne({ _id: new ObjectId(req.params.id) });

    res.json({
      success: true,
      message: "Customer deleted successfully",
    });
  }),
);

module.exports = router;
