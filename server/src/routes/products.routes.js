/**
 * Products Routes - Multi-Tenant
 * Handles product CRUD operations for shops
 */

const express = require("express");
const router = express.Router();
const {
  authenticate,
  checkShopStatus,
} = require("../middleware/auth-multi-tenant");
const { requirePermission } = require("../utils/rbac");
const { PERMISSIONS } = require("../utils/rbac");
const productsController = require("../controllers/products.controller");
const { cacheResponse, queryHash } = require("../middleware/cache.middleware");
const { cacheService, TTL } = require("../services/cache.service");

// Apply authentication and shop status check to all routes
router.use(authenticate);
router.use(checkShopStatus);

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Get all products for shop
 *     description: Retrieve paginated list of products in the shop catalog. Supports search, filtering, and sorting. Requires products.view permission.
 *     tags: [Products]
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
 *           default: 20
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by product name, SKU, or barcode
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: Products retrieved successfully
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
 *                     $ref: '#/components/schemas/Product'
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
 *     summary: Create new product
 *     description: Add a new product to the shop catalog. Requires products.create permission.
 *     tags: [Products]
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
 *               - price
 *               - unit
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Surgical Gloves - Medium"
 *               sku:
 *                 type: string
 *                 example: "SG-MED-001"
 *               barcode:
 *                 type: string
 *                 example: "1234567890123"
 *               category:
 *                 type: string
 *                 example: "Surgical Supplies"
 *               subcategory:
 *                 type: string
 *                 example: "Gloves"
 *               manufacturer:
 *                 type: string
 *                 example: "MedSupply Inc."
 *               price:
 *                 type: number
 *                 minimum: 0
 *                 example: 15.99
 *               costPrice:
 *                 type: number
 *                 minimum: 0
 *                 example: 10.50
 *               taxRate:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *                 example: 5.0
 *               unit:
 *                 type: string
 *                 example: "box"
 *               description:
 *                 type: string
 *                 example: "Latex-free surgical gloves, powder-free"
 *               reorderLevel:
 *                 type: integer
 *                 minimum: 0
 *                 example: 20
 *     responses:
 *       201:
 *         description: Product created successfully
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
 *                   example: "Product created successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Product'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *
 * /api/products/{id}:
 *   get:
 *     summary: Get product by ID
 *     description: Retrieve detailed information about a specific product. Requires products.view permission.
 *     tags: [Products]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *     responses:
 *       200:
 *         description: Product retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Product'
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
 *     summary: Update product
 *     description: Update an existing product's information. Requires products.edit permission.
 *     tags: [Products]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               price:
 *                 type: number
 *               costPrice:
 *                 type: number
 *               category:
 *                 type: string
 *               description:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Product updated successfully
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
 *                   example: "Product updated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Product'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *
 *   delete:
 *     summary: Delete product
 *     description: Soft delete a product (marks as inactive). Requires products.delete permission.
 *     tags: [Products]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *     responses:
 *       200:
 *         description: Product deleted successfully
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
 *                   example: "Product deleted successfully"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * GET /api/products
 * Get all products for the shop
 */
router.get(
  "/",
  requirePermission(PERMISSIONS.VIEW_PRODUCTS),
  cacheResponse(TTL.PRODUCTS, (req) => `products:${req.user.shopId}:${queryHash(req.query)}`),
  productsController.getProducts.bind(productsController),
);

/**
 * GET /api/products/:id
 * Get single product by ID
 */
router.get(
  "/:id",
  requirePermission(PERMISSIONS.VIEW_PRODUCTS),
  productsController.getProductById.bind(productsController),
);

/**
 * POST /api/products
 * Create new product
 */
router.post(
  "/",
  requirePermission(PERMISSIONS.CREATE_PRODUCT),
  productsController.createProduct.bind(productsController),
);

/**
 * PUT /api/products/:id
 * Update product
 */
router.put(
  "/:id",
  requirePermission(PERMISSIONS.EDIT_PRODUCT),
  productsController.updateProduct.bind(productsController),
);

/**
 * DELETE /api/products/:id
 * Delete product (soft delete)
 */
router.delete(
  "/:id",
  requirePermission(PERMISSIONS.DELETE_PRODUCT),
  productsController.deleteProduct.bind(productsController),
);

module.exports = router;
