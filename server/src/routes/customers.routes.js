/**
 * Customers Routes
 * CRUD operations for customer management
 */

const express = require("express");
const router = express.Router();
const {
  authenticate,
  checkShopStatus,
} = require("../middleware/auth-multi-tenant");
const { requirePermission } = require("../utils/rbac");
const { PERMISSIONS } = require("../utils/rbac");
const customersController = require("../controllers/customers.controller");

// Apply authentication to all routes
router.use(authenticate);
router.use(checkShopStatus);

/**
 * @swagger
 * /api/customers:
 *   get:
 *     summary: Get all customers for shop
 *     description: Retrieve paginated list of customers. Supports search and filtering. Requires customers.view permission.
 *     tags: [Customers]
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
 *         description: Search by name, email, or phone
 *       - in: query
 *         name: customerType
 *         schema:
 *           type: string
 *           enum: [individual, hospital, clinic, pharmacy]
 *         description: Filter by customer type
 *     responses:
 *       200:
 *         description: Customers retrieved successfully
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
 *                     $ref: '#/components/schemas/Customer'
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
 *     summary: Create new customer
 *     description: Add a new customer to the system. Requires customers.create permission.
 *     tags: [Customers]
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
 *                 example: "Dr. Sarah Johnson"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "sarah.johnson@hospital.com"
 *               phone:
 *                 type: string
 *                 example: "+8801712345678"
 *               address:
 *                 type: string
 *                 example: "123 Medical Plaza, Dhaka"
 *               customerType:
 *                 type: string
 *                 enum: [individual, hospital, clinic, pharmacy]
 *                 example: "hospital"
 *               creditLimit:
 *                 type: number
 *                 minimum: 0
 *                 example: 50000.0
 *     responses:
 *       201:
 *         description: Customer created successfully
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
 *                   example: "Customer created successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Customer'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *
 * /api/customers/{id}:
 *   get:
 *     summary: Get customer by ID
 *     description: Retrieve detailed information about a specific customer. Requires customers.view permission.
 *     tags: [Customers]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Customer ID
 *     responses:
 *       200:
 *         description: Customer retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Customer'
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
 *     summary: Update customer
 *     description: Update an existing customer's information. Requires customers.edit permission.
 *     tags: [Customers]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Customer ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               address:
 *                 type: string
 *               creditLimit:
 *                 type: number
 *     responses:
 *       200:
 *         description: Customer updated successfully
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
 *                   example: "Customer updated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Customer'
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
 *     summary: Delete customer
 *     description: Delete a customer from the system. Requires customers.delete permission.
 *     tags: [Customers]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Customer ID
 *     responses:
 *       200:
 *         description: Customer deleted successfully
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
 *                   example: "Customer deleted successfully"
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
 * GET /api/customers
 * Get all customers for the shop
 */
router.get(
  "/",
  requirePermission(PERMISSIONS.VIEW_CUSTOMERS),
  customersController.getCustomers.bind(customersController),
);

/**
 * GET /api/customers/:id
 * Get customer by ID
 */
router.get(
  "/:id",
  requirePermission(PERMISSIONS.VIEW_CUSTOMERS),
  customersController.getCustomerById.bind(customersController),
);

/**
 * POST /api/customers
 * Create new customer
 */
router.post(
  "/",
  requirePermission(PERMISSIONS.CREATE_CUSTOMER),
  customersController.createCustomer.bind(customersController),
);

/**
 * PUT /api/customers/:id
 * Update customer
 */
router.put(
  "/:id",
  requirePermission(PERMISSIONS.EDIT_CUSTOMER),
  customersController.updateCustomer.bind(customersController),
);

/**
 * DELETE /api/customers/:id
 * Delete customer
 */
router.delete(
  "/:id",
  requirePermission(PERMISSIONS.DELETE_CUSTOMER),
  customersController.deleteCustomer.bind(customersController),
);

/**
 * @swagger
 * /api/customers/{id}/purchase-history:
 *   get:
 *     summary: Get customer purchase history
 *     description: |
 *       Retrieve paginated purchase history for a specific customer.
 *       Returns customer summary (total spent, total orders) and a list of
 *       sales with line items. Supports date range filtering.
 *       Requires customers.view permission.
 *     tags: [Customers]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Customer ID
 *         example: "507f1f77bcf86cd799439011"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Items per page
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter purchases from this date (default last 30 days)
 *         example: "2026-04-01"
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter purchases until this date
 *         example: "2026-05-31"
 *     responses:
 *       200:
 *         description: Purchase history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 customer:
 *                   type: object
 *                   properties:
 *                     name: { type: string, example: "Dr. Sarah Johnson" }
 *                     phone: { type: string, example: "+8801712345678" }
 *                     email: { type: string, example: "sarah@hospital.com" }
 *                     totalSpent: { type: number, example: 125000.00 }
 *                     totalOrders: { type: integer, example: 42 }
 *                 purchases:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       saleId: { type: string }
 *                       invoiceNo: { type: string, example: "INV-2026-00123" }
 *                       date: { type: string, format: date-time }
 *                       items:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             productName: { type: string }
 *                             qty: { type: integer }
 *                             price: { type: number }
 *                       total: { type: number, example: 1500.00 }
 *                       paymentMethod: { type: string, example: "cash" }
 *                       status: { type: string, example: "Paid" }
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * GET /api/customers/:id/purchase-history
 * Get paginated purchase history for a customer
 */
router.get(
  "/:id/purchase-history",
  requirePermission(PERMISSIONS.VIEW_CUSTOMERS),
  async (req, res) => {
    try {
      const { ObjectId } = require("mongodb");
      const { getShopDatabase } = require("../config/database");
      const { logger } = require("../config/logging");

      const shopDb = getShopDatabase(req.user.shopId);

      // Parse and validate the customer ID
      let customerId;
      try {
        customerId = new ObjectId(req.params.id);
      } catch {
        return res.status(400).json({
          success: false,
          message: "Invalid customer ID format",
        });
      }

      // Fetch the customer
      const customer = await shopDb.collection("customers").findOne({ _id: customerId });
      if (!customer) {
        return res.status(404).json({
          success: false,
          message: "Customer not found",
        });
      }

      // Parse pagination params
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
      const skip = (page - 1) * limit;

      // Date range — default to last 30 days
      const now = new Date();
      const defaultStart = new Date(now);
      defaultStart.setDate(defaultStart.getDate() - 30);

      const startDate = req.query.startDate ? new Date(req.query.startDate) : defaultStart;
      const endDate = req.query.endDate ? new Date(req.query.endDate) : now;
      // Include the full end day
      endDate.setHours(23, 59, 59, 999);

      // Build query — always scoped to this customer
      const query = {
        customerId,
        saleDate: { $gte: startDate, $lte: endDate },
      };

      // Total count for pagination and lifetime stats
      const [total, lifetimeStats] = await Promise.all([
        shopDb.collection("sales").countDocuments(query),
        shopDb.collection("sales").aggregate([
          { $match: { customerId } },
          {
            $group: {
              _id: null,
              totalSpent: { $sum: "$grandTotal" },
              totalOrders: { $sum: 1 },
            },
          },
        ]).toArray(),
      ]);

      // Fetch paginated sales
      const sales = await shopDb
        .collection("sales")
        .find(query)
        .sort({ saleDate: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();

      // Shape the response
      const purchases = sales.map((sale) => ({
        saleId: sale._id.toString(),
        invoiceNo: sale.invoiceNo || sale.invoiceNumber || `INV-${sale._id}`,
        date: sale.saleDate,
        items: (sale.items || []).map((item) => ({
          productName: item.name || item.productName || "Unknown Product",
          qty: item.qty || item.quantity || 0,
          price: item.rate || item.price || item.sellingPrice || 0,
        })),
        total: sale.grandTotal || 0,
        paymentMethod: sale.paymentMethod || (sale.cashPaid > 0 && sale.bankPaid > 0
          ? "Cash + Bank"
          : sale.bankPaid > 0 ? "Bank" : "Cash"),
        status: sale.paymentStatus || "Paid",
      }));

      const stats = lifetimeStats[0] || { totalSpent: 0, totalOrders: 0 };

      return res.json({
        success: true,
        customer: {
          name: customer.name,
          phone: customer.phone,
          email: customer.email || null,
          totalSpent: stats.totalSpent,
          totalOrders: stats.totalOrders,
        },
        purchases,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      const { logger } = require("../config/logging");
      logger.error("Purchase history error:", {
        error: error.message,
        customerId: req.params.id,
        shopId: req.user?.shopId,
      });
      return res.status(500).json({
        success: false,
        message: "Failed to fetch purchase history",
      });
    }
  }
);

module.exports = router;
