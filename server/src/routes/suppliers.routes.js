/**
 * Suppliers Routes
 * CRUD operations for supplier management
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

// Apply authentication to all routes
router.use(authenticate);
router.use(checkShopStatus);

/**
 * @swagger
 * /api/suppliers:
 *   get:
 *     summary: Get all suppliers for shop
 *     description: Retrieve paginated list of suppliers. Supports search by name, phone, email, or company. Requires suppliers.read permission.
 *     tags: [Suppliers]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name, phone, email, or company
 *     responses:
 *       200:
 *         description: Suppliers retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Supplier'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *
 *   post:
 *     summary: Create new supplier
 *     description: Add a new supplier to the system. Requires suppliers.create permission.
 *     tags: [Suppliers]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - phone
 *             properties:
 *               name:
 *                 type: string
 *                 example: "MedSupply International"
 *               company:
 *                 type: string
 *                 example: "MedSupply Ltd."
 *               phone:
 *                 type: string
 *                 example: "+8801812345678"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "sales@medsupply.com"
 *               address:
 *                 type: string
 *                 example: "456 Industrial Area, Dhaka"
 *               contactPerson:
 *                 type: string
 *                 example: "Ahmed Khan"
 *     responses:
 *       201:
 *         description: Supplier created successfully
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
 *                   example: "Supplier created successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Supplier'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       409:
 *         description: Supplier with this phone already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *
 * /api/suppliers/{id}:
 *   get:
 *     summary: Get supplier by ID
 *     description: Retrieve detailed information about a specific supplier. Requires suppliers.read permission.
 *     tags: [Suppliers]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Supplier ID
 *     responses:
 *       200:
 *         description: Supplier retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Supplier'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *
 *   put:
 *     summary: Update supplier
 *     description: Update an existing supplier's information. Requires suppliers.update permission.
 *     tags: [Suppliers]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Supplier ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - phone
 *             properties:
 *               name:
 *                 type: string
 *               company:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *               address:
 *                 type: string
 *               contactPerson:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Supplier updated successfully
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
 *                   example: "Supplier updated successfully"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       409:
 *         description: Phone number is already taken
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *
 *   delete:
 *     summary: Delete supplier
 *     description: Delete a supplier from the system. Cannot delete if supplier has purchase records. Requires suppliers.delete permission.
 *     tags: [Suppliers]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Supplier ID
 *     responses:
 *       200:
 *         description: Supplier deleted successfully
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
 *                   example: "Supplier deleted successfully"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       409:
 *         description: Cannot delete supplier with existing purchase records
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * GET /api/suppliers
 * Get all suppliers for the shop
 */
router.get(
  '/',
  requirePermission(PERMISSIONS.VIEW_SUPPLIERS),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { page = 1, limit = 50, search = '' } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const searchQuery = search
      ? {
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { phone: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
            { company: { $regex: search, $options: 'i' } },
          ],
        }
      : {};

    const suppliers = await shopDb
      .collection('suppliers')
      .find(searchQuery)
      .sort({ name: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    const total = await shopDb
      .collection('suppliers')
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
  '/:id',
  requirePermission(PERMISSIONS.VIEW_SUPPLIERS),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const supplier = await shopDb
      .collection('suppliers')
      .findOne({ _id: new ObjectId(req.params.id) });

    if (!supplier) {
      throw createError.notFound('Supplier not found');
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
  '/',
  requirePermission(PERMISSIONS.CREATE_SUPPLIER),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { name, company, phone, email, address, contactPerson } = req.body;

    // Validate required fields
    if (!name || !phone) {
      throw createError.badRequest('Name and phone are required');
    }

    // Check if phone already exists
    const existingSupplier = await shopDb
      .collection('suppliers')
      .findOne({ phone });

    if (existingSupplier) {
      throw createError.conflict('Supplier with this phone already exists');
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

    const result = await shopDb.collection('suppliers').insertOne(supplierData);

    res.status(201).json({
      success: true,
      message: 'Supplier created successfully',
      data: { _id: result.insertedId, ...supplierData },
    });
  }),
);

/**
 * PUT /api/suppliers/:id
 * Update supplier
 */
router.put(
  '/:id',
  requirePermission(PERMISSIONS.EDIT_SUPPLIER),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { name, company, phone, email, address, contactPerson, isActive } =
      req.body;

    // Validate required fields
    if (!name || !phone) {
      throw createError.badRequest('Name and phone are required');
    }

    // Check if supplier exists
    const existingSupplier = await shopDb
      .collection('suppliers')
      .findOne({ _id: new ObjectId(req.params.id) });

    if (!existingSupplier) {
      throw createError.notFound('Supplier not found');
    }

    // Check if phone is taken by another supplier
    const phoneCheck = await shopDb.collection('suppliers').findOne({
      phone: phone.trim(),
      _id: { $ne: new ObjectId(req.params.id) },
    });

    if (phoneCheck) {
      throw createError.conflict('Phone number is already taken');
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
      .collection('suppliers')
      .updateOne({ _id: new ObjectId(req.params.id) }, { $set: updateData });

    res.json({
      success: true,
      message: 'Supplier updated successfully',
    });
  }),
);

/**
 * DELETE /api/suppliers/:id
 * Delete supplier
 */
router.delete(
  '/:id',
  requirePermission(PERMISSIONS.DELETE_SUPPLIER),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);

    // Check if supplier exists
    const supplier = await shopDb
      .collection('suppliers')
      .findOne({ _id: new ObjectId(req.params.id) });

    if (!supplier) {
      throw createError.notFound('Supplier not found');
    }

    // Check if supplier has any purchases
    const purchasesCount = await shopDb
      .collection('purchases')
      .countDocuments({ supplierId: req.params.id });

    if (purchasesCount > 0) {
      throw createError.conflict(
        'Cannot delete supplier with existing purchase records',
      );
    }

    await shopDb
      .collection('suppliers')
      .deleteOne({ _id: new ObjectId(req.params.id) });

    res.json({
      success: true,
      message: 'Supplier deleted successfully',
    });
  }),
);

module.exports = router;
