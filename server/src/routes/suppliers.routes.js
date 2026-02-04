/**
 * Suppliers Routes
 * CRUD operations for supplier management
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
 * GET /api/suppliers
 * Get all suppliers for the shop
 */
router.get(
  "/",
  requirePermission(PERMISSIONS.READ_SUPPLIERS),
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
            { company: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const suppliers = await shopDb
      .collection("suppliers")
      .find(searchQuery)
      .sort({ name: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    const total = await shopDb
      .collection("suppliers")
      .countDocuments(searchQuery);

    res.json({
      success: true,
      data: suppliers,
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
 * GET /api/suppliers/:id
 * Get supplier by ID
 */
router.get(
  "/:id",
  requirePermission(PERMISSIONS.READ_SUPPLIERS),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const supplier = await shopDb
      .collection("suppliers")
      .findOne({ _id: new ObjectId(req.params.id) });

    if (!supplier) {
      throw createError.notFound("Supplier not found");
    }

    res.json({
      success: true,
      data: supplier,
    });
  }),
);

/**
 * POST /api/suppliers
 * Create new supplier
 */
router.post(
  "/",
  requirePermission(PERMISSIONS.CREATE_SUPPLIERS),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { name, company, phone, email, address, contactPerson } = req.body;

    // Validate required fields
    if (!name || !phone) {
      throw createError.badRequest("Name and phone are required");
    }

    // Check if phone already exists
    const existingSupplier = await shopDb
      .collection("suppliers")
      .findOne({ phone });

    if (existingSupplier) {
      throw createError.conflict("Supplier with this phone already exists");
    }

    const supplierData = {
      name: name.trim(),
      company: company?.trim() || null,
      phone: phone.trim(),
      email: email?.trim() || null,
      address: address?.trim() || null,
      contactPerson: contactPerson?.trim() || null,
      totalPurchases: 0,
      lastPurchaseDate: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: req.user.id,
    };

    const result = await shopDb.collection("suppliers").insertOne(supplierData);

    res.status(201).json({
      success: true,
      message: "Supplier created successfully",
      data: { _id: result.insertedId, ...supplierData },
    });
  }),
);

/**
 * PUT /api/suppliers/:id
 * Update supplier
 */
router.put(
  "/:id",
  requirePermission(PERMISSIONS.UPDATE_SUPPLIERS),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { name, company, phone, email, address, contactPerson, isActive } =
      req.body;

    // Validate required fields
    if (!name || !phone) {
      throw createError.badRequest("Name and phone are required");
    }

    // Check if supplier exists
    const existingSupplier = await shopDb
      .collection("suppliers")
      .findOne({ _id: new ObjectId(req.params.id) });

    if (!existingSupplier) {
      throw createError.notFound("Supplier not found");
    }

    // Check if phone is taken by another supplier
    const phoneCheck = await shopDb.collection("suppliers").findOne({
      phone: phone.trim(),
      _id: { $ne: new ObjectId(req.params.id) },
    });

    if (phoneCheck) {
      throw createError.conflict("Phone number is already taken");
    }

    const updateData = {
      name: name.trim(),
      company: company?.trim() || null,
      phone: phone.trim(),
      email: email?.trim() || null,
      address: address?.trim() || null,
      contactPerson: contactPerson?.trim() || null,
      isActive: isActive !== undefined ? isActive : true,
      updatedAt: new Date(),
      updatedBy: req.user.id,
    };

    await shopDb
      .collection("suppliers")
      .updateOne({ _id: new ObjectId(req.params.id) }, { $set: updateData });

    res.json({
      success: true,
      message: "Supplier updated successfully",
    });
  }),
);

/**
 * DELETE /api/suppliers/:id
 * Delete supplier
 */
router.delete(
  "/:id",
  requirePermission(PERMISSIONS.DELETE_SUPPLIERS),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);

    // Check if supplier exists
    const supplier = await shopDb
      .collection("suppliers")
      .findOne({ _id: new ObjectId(req.params.id) });

    if (!supplier) {
      throw createError.notFound("Supplier not found");
    }

    // Check if supplier has any purchases
    const purchasesCount = await shopDb
      .collection("purchases")
      .countDocuments({ supplierId: req.params.id });

    if (purchasesCount > 0) {
      throw createError.conflict(
        "Cannot delete supplier with existing purchase records",
      );
    }

    await shopDb
      .collection("suppliers")
      .deleteOne({ _id: new ObjectId(req.params.id) });

    res.json({
      success: true,
      message: "Supplier deleted successfully",
    });
  }),
);

module.exports = router;
