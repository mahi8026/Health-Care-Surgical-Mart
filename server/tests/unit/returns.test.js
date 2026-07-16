/**
 * Unit Tests for Return Processing with Stock Restoration
 * Tests the critical path: POST /api/returns
 */

// Set environment variables BEFORE any imports
process.env.JWT_SECRET = "test_jwt_secret_key_for_testing_only_at_least_32_chars";
process.env.SENDGRID_API_KEY = "SG.test_key_for_testing_purposes_only_minimum_length";
process.env.ENABLE_QUEUES = "false";

const request = require("supertest");
const express = require("express");
const { ObjectId } = require("mongodb");

// Mock dependencies BEFORE importing modules that use them
jest.mock("../../src/config/database");
jest.mock("../../src/config/logging");
jest.mock("../../src/middleware/auth-multi-tenant");
jest.mock("../../src/utils/rbac");
jest.mock("../../src/config/error-handling");

// Mock stock-command service (used inside returns routes for Phase 6 event-sourced stock)
const mockRecordMovement = jest.fn();
const mockAllocateBatchesFEFO = jest.fn();
const mockInsufficientStockError = class extends Error {
  constructor(msg, available, requested) {
    super(msg); this.available = available; this.requested = requested;
  }
};
jest.mock("../../src/services/stock-command.service", () => {
  const actual = jest.requireActual("../../src/services/stock-command.service");
  actual.recordMovement = mockRecordMovement;
  actual.allocateBatchesFEFO = mockAllocateBatchesFEFO;
  actual.InsufficientStockError = mockInsufficientStockError;
  return actual;
});

// Import after mocking
const { getShopDatabase } = require("../../src/config/database");
const { authenticate, checkShopStatus } = require("../../src/middleware/auth-multi-tenant");
const { requirePermission } = require("../../src/utils/rbac");
const { logger } = require("../../src/config/logging");
const { asyncHandler, createError } = require("../../src/config/error-handling");

describe("Return Processing with Stock Restoration", () => {
  let app;
  let mockShopDb;
  let mockCollections;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Re-apply stock-command mocks (jest.clearAllMocks() strips mockResolvedValue)
    mockRecordMovement.mockResolvedValue({ success: true });
    mockAllocateBatchesFEFO.mockResolvedValue([]);

    // Mock logger
    logger.error = jest.fn();
    logger.warn = jest.fn();
    logger.info = jest.fn();

    // Create mock collections
    mockCollections = {
      returns: {
        insertOne: jest.fn(),
        find: jest.fn(),
        findOne: jest.fn(),
        updateOne: jest.fn(),
        countDocuments: jest.fn(),
      },
      sales: {
        findOne: jest.fn(),
        updateOne: jest.fn(),
      },
      products: {
        findOne: jest.fn(),
      },
      stock: {
        findOne: jest.fn(),
        updateOne: jest.fn(),
      },
      stock_movements: {
        insertOne: jest.fn(),
      },
      // Event-sourced stock system collections
      stock_snapshots: {
        findOne: jest.fn(),
        insertOne: jest.fn(),
        findOneAndUpdate: jest.fn(),
      },
      stock_ledger: {
        insertOne: jest.fn(),
      },
      stock_batches: {
        insertOne: jest.fn(),
        updateOne: jest.fn(),
      },
    };

    // Mock shop database
    mockShopDb = {
      collection: jest.fn((name) => mockCollections[name]),
    };

    getShopDatabase.mockReturnValue(mockShopDb);

    // Mock authentication middleware
    authenticate.mockImplementation((req, res, next) => {
      req.user = {
        _id: new ObjectId(),
        id: new ObjectId().toString(),
        name: "Test User",
        email: "test@example.com",
        role: "SHOP_ADMIN",
        shopId: "test_shop",
        permissions: ["create_return", "view_returns", "edit_return"],
      };
      req.shopDb = mockShopDb;
      next();
    });

    checkShopStatus.mockImplementation((req, res, next) => next());

    // Mock permission middleware
    requirePermission.mockImplementation(() => (req, res, next) => next());

    // Mock error handling utilities
    asyncHandler.mockImplementation((fn) => (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    });

    // Mock createError
    const mockCreateError = {
      badRequest: (msg) => {
        const err = new Error(msg);
        err.statusCode = 400;
        return err;
      },
      notFound: (msg) => {
        const err = new Error(msg);
        err.statusCode = 404;
        return err;
      },
      internalServerError: (msg) => {
        const err = new Error(msg);
        err.statusCode = 500;
        return err;
      },
    };

    // Mock the error-handling module
    require("../../src/config/error-handling").createError = mockCreateError;

    // Create Express app for testing
    app = express();
    app.use(express.json());
    
    // Import and use returns routes
    const returnsRoutes = require("../../src/routes/returns.routes");
    app.use("/api/returns", returnsRoutes);

    // Error handler: converts AppError/http-errors into { success: false, message }
    // Required so validation error assertions (response.body.success === false) work
    app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
      const statusCode = err.statusCode || err.status || 500;
      res.status(statusCode).json({
        success: false,
        message: err.message || "Internal server error",
        status: statusCode,
      });
    });
  });

  describe("POST /api/returns - Success Cases", () => {
    test("should process return and restore stock successfully", async () => {
      // Arrange
      const saleId = new ObjectId();
      const productId = new ObjectId();

      const returnData = {
        originalSaleId: saleId.toString(),
        originalInvoiceNumber: "INV-001",
        customer: {
          name: "John Doe",
          phone: "1234567890",
        },
        items: [
          {
            productId: productId.toString(),
            returnQuantity: 3,
            returnReason: "Defective product",
          },
        ],
        returnReason: "Defective product",
        returnType: "partial",
        refundMethod: "cash",
        notes: "Product damaged",
      };

      // Mock original sale
      mockCollections.sales.findOne.mockResolvedValue({
        _id: saleId,
        invoiceNumber: "INV-001",
        items: [
          {
            productId: productId,
            name: "Test Product",
            sku: "TEST-001",
            qty: 5,
            price: 100,
          },
        ],
        subtotal: 500,
        discount: 0,
        vatAmount: 50,
        grandTotal: 550,
        customer: { name: "John Doe" },
      });

      // Mock no existing returns
      mockCollections.returns.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([]),
      });

      // Mock product
      mockCollections.products.findOne.mockResolvedValue({
        _id: productId,
        name: "Test Product",
        sku: "TEST-001",
      });

      // Mock return count for number generation
      mockCollections.returns.countDocuments.mockResolvedValue(0);

      // Mock return insertion
      mockCollections.returns.insertOne.mockResolvedValue({
        insertedId: new ObjectId(),
        acknowledged: true,
      });

      // Mock stock movement insertion
      mockCollections.stock_movements.insertOne.mockResolvedValue({
        insertedId: new ObjectId(),
      });

      // Mock sale update
      mockCollections.sales.updateOne.mockResolvedValue({
        modifiedCount: 1,
      });

      // Act
      const response = await request(app)
        .post("/api/returns")
        .send(returnData)
        .expect(201);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Return processed successfully");
      expect(response.body.data).toHaveProperty("_id");
      expect(response.body.data.returnNumber).toMatch(/^RET-\d+-\d{4}$/);

      // Verify return was inserted
      expect(mockCollections.returns.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          originalSaleId: saleId.toString(),
          status: "completed",
          items: expect.arrayContaining([
            expect.objectContaining({
              productId: productId,
              returnQuantity: 3,
              price: 100,
              total: 300,
            }),
          ]),
        })
      );

      // Verify stock was restored via event-sourced system
      expect(mockRecordMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: productId,
          movementType: 'RETURN_IN',
          quantity: 3,
        })
      );

      // Verify return batch was created
      expect(mockCollections.stock_batches.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: productId,
          quantity: 3,
          source: 'RETURN',
        })
      );

      // Verify stock movement was logged (legacy)
      expect(mockCollections.stock_movements.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: productId,
          movementType: "return",
          quantity: 3,
          referenceType: "return",
        })
      );

      // Verify original sale was updated
      expect(mockCollections.sales.updateOne).toHaveBeenCalledWith(
        { _id: saleId },
        expect.objectContaining({
          $push: {
            returns: expect.objectContaining({
              returnNumber: expect.any(String),
              returnAmount: expect.any(Number),
            }),
          },
        })
      );
    });

    test("should process full return with multiple items", async () => {
      // Arrange
      const saleId = new ObjectId();
      const product1Id = new ObjectId();
      const product2Id = new ObjectId();

      const returnData = {
        originalSaleId: saleId.toString(),
        items: [
          {
            productId: product1Id.toString(),
            returnQuantity: 2,
            returnReason: "Wrong item",
          },
          {
            productId: product2Id.toString(),
            returnQuantity: 1,
            returnReason: "Wrong item",
          },
        ],
        returnReason: "Wrong item",
        returnType: "full",
        refundMethod: "bank",
      };

      // Mock original sale
      mockCollections.sales.findOne.mockResolvedValue({
        _id: saleId,
        invoiceNumber: "INV-002",
        items: [
          {
            productId: product1Id,
            name: "Product 1",
            sku: "P1",
            qty: 2,
            price: 50,
          },
          {
            productId: product2Id,
            name: "Product 2",
            sku: "P2",
            qty: 1,
            price: 100,
          },
        ],
        subtotal: 200,
        discount: 0,
        vatAmount: 20,
        grandTotal: 220,
      });

      mockCollections.returns.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([]),
      });

      mockCollections.products.findOne
        .mockResolvedValueOnce({
          _id: product1Id,
          name: "Product 1",
        })
        .mockResolvedValueOnce({
          _id: product2Id,
          name: "Product 2",
        });

      mockCollections.returns.countDocuments.mockResolvedValue(5);
      mockCollections.returns.insertOne.mockResolvedValue({
        insertedId: new ObjectId(),
      });
      mockCollections.stock_movements.insertOne.mockResolvedValue({
        insertedId: new ObjectId(),
      });
      mockCollections.sales.updateOne.mockResolvedValue({
        modifiedCount: 1,
      });

      // Act
      const response = await request(app)
        .post("/api/returns")
        .send(returnData)
        .expect(201);

      // Assert
      expect(response.body.success).toBe(true);
      // Verify stock was restored via event-sourced system for both items
      expect(mockRecordMovement).toHaveBeenCalledTimes(2);

      // Verify stock restored for product 1
      expect(mockRecordMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: product1Id,
          movementType: 'RETURN_IN',
          quantity: 2,
        })
      );

      // Verify stock restored for product 2
      expect(mockRecordMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: product2Id,
          movementType: 'RETURN_IN',
          quantity: 1,
        })
      );
    });

    test("should calculate refund amounts correctly with discount and VAT", async () => {
      // Arrange
      const saleId = new ObjectId();
      const productId = new ObjectId();

      const returnData = {
        originalSaleId: saleId.toString(),
        items: [
          {
            productId: productId.toString(),
            returnQuantity: 2,
          },
        ],
        returnReason: "Customer request",
        returnType: "partial",
        refundMethod: "cash",
      };

      // Mock sale with discount and VAT
      mockCollections.sales.findOne.mockResolvedValue({
        _id: saleId,
        invoiceNumber: "INV-003",
        items: [
          {
            productId: productId,
            name: "Test Product",
            qty: 5,
            price: 100,
          },
        ],
        subtotal: 500,
        discount: 50, // 10% discount
        vatAmount: 45, // 10% VAT on discounted amount
        grandTotal: 495,
      });

      mockCollections.returns.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([]),
      });

      mockCollections.products.findOne.mockResolvedValue({
        _id: productId,
        name: "Test Product",
      });

      mockCollections.returns.countDocuments.mockResolvedValue(0);
      mockCollections.returns.insertOne.mockResolvedValue({
        insertedId: new ObjectId(),
      });
      mockCollections.stock_movements.insertOne.mockResolvedValue({
        insertedId: new ObjectId(),
      });
      mockCollections.sales.updateOne.mockResolvedValue({
        modifiedCount: 1,
      });

      // Act
      const response = await request(app)
        .post("/api/returns")
        .send(returnData)
        .expect(201);

      // Assert
      expect(response.body.success).toBe(true);

      // Return amount = 2 items * 100 = 200
      // Return ratio = 200 / 500 = 0.4
      // Refund discount = 50 * 0.4 = 20
      // Refund VAT = 45 * 0.4 = 18
      // Total refund = 200 - 20 + 18 = 198

      expect(mockCollections.returns.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          subtotal: 200,
          discount: 20,
          vatAmount: 18,
          totalRefund: 198,
        })
      );
    });
  });

  describe("POST /api/returns - Validation Errors", () => {
    test("should return 400 if originalSaleId is missing", async () => {
      // Arrange
      const returnData = {
        items: [
          {
            productId: new ObjectId().toString(),
            returnQuantity: 1,
          },
        ],
        returnReason: "Test",
      };

      // Act
      const response = await request(app)
        .post("/api/returns")
        .send(returnData)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Original sale ID");
      expect(mockCollections.returns.insertOne).not.toHaveBeenCalled();
    });

    test("should return 400 if no items provided", async () => {
      // Arrange
      const returnData = {
        originalSaleId: new ObjectId().toString(),
        items: [],
        returnReason: "Test",
      };

      // Act
      const response = await request(app)
        .post("/api/returns")
        .send(returnData)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("return items are required");
    });

    test("should return 400 if returnReason is missing", async () => {
      // Arrange
      const returnData = {
        originalSaleId: new ObjectId().toString(),
        items: [
          {
            productId: new ObjectId().toString(),
            returnQuantity: 1,
          },
        ],
      };

      // Act
      const response = await request(app)
        .post("/api/returns")
        .send(returnData)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Return reason is required");
    });

    test("should return 404 if original sale not found", async () => {
      // Arrange
      const returnData = {
        originalSaleId: new ObjectId().toString(),
        items: [
          {
            productId: new ObjectId().toString(),
            returnQuantity: 1,
          },
        ],
        returnReason: "Test",
      };

      // Mock sale not found
      mockCollections.sales.findOne.mockResolvedValue(null);

      // Act
      const response = await request(app)
        .post("/api/returns")
        .send(returnData)
        .expect(404);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Original sale not found");
    });

    test("should return 400 if product not in original sale", async () => {
      // Arrange
      const saleId = new ObjectId();
      const productId = new ObjectId();
      const wrongProductId = new ObjectId();

      const returnData = {
        originalSaleId: saleId.toString(),
        items: [
          {
            productId: wrongProductId.toString(),
            returnQuantity: 1,
          },
        ],
        returnReason: "Test",
      };

      mockCollections.sales.findOne.mockResolvedValue({
        _id: saleId,
        items: [
          {
            productId: productId,
            name: "Test Product",
            qty: 5,
            price: 100,
          },
        ],
        subtotal: 500,
        grandTotal: 500,
      });

      mockCollections.returns.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([]),
      });

      // Act
      const response = await request(app)
        .post("/api/returns")
        .send(returnData)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("not found in original sale");
    });

    test("should return 400 if return quantity exceeds available quantity", async () => {
      // Arrange
      const saleId = new ObjectId();
      const productId = new ObjectId();

      const returnData = {
        originalSaleId: saleId.toString(),
        items: [
          {
            productId: productId.toString(),
            returnQuantity: 10, // More than sold
          },
        ],
        returnReason: "Test",
      };

      mockCollections.sales.findOne.mockResolvedValue({
        _id: saleId,
        items: [
          {
            productId: productId,
            name: "Test Product",
            qty: 5, // Only 5 sold
            price: 100,
          },
        ],
        subtotal: 500,
        grandTotal: 500,
      });

      mockCollections.returns.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([]),
      });

      mockCollections.products.findOne.mockResolvedValue({
        _id: productId,
        name: "Test Product",
      });

      // Act
      const response = await request(app)
        .post("/api/returns")
        .send(returnData)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Cannot return 10 units");
      expect(response.body.message).toContain("Only 5 units available");
    });

    test("should prevent duplicate returns exceeding original quantity", async () => {
      // Arrange
      const saleId = new ObjectId();
      const productId = new ObjectId();

      const returnData = {
        originalSaleId: saleId.toString(),
        items: [
          {
            productId: productId.toString(),
            returnQuantity: 3,
          },
        ],
        returnReason: "Test",
      };

      mockCollections.sales.findOne.mockResolvedValue({
        _id: saleId,
        items: [
          {
            productId: productId,
            name: "Test Product",
            qty: 5,
            price: 100,
          },
        ],
        subtotal: 500,
        grandTotal: 500,
      });

      // Mock existing return of 3 units
      mockCollections.returns.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([
          {
            originalSaleId: saleId.toString(),
            status: "completed",
            items: [
              {
                productId: productId,
                returnQuantity: 3,
              },
            ],
          },
        ]),
      });

      mockCollections.products.findOne.mockResolvedValue({
        _id: productId,
        name: "Test Product",
      });

      // Act - Try to return 3 more (total would be 6, exceeds 5)
      const response = await request(app)
        .post("/api/returns")
        .send(returnData)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Only 2 units available");
    });
  });

  describe("PUT /api/returns/:id/status - Status Updates", () => {
    test("should cancel return and reverse stock restoration", async () => {
      // Arrange
      const returnId = new ObjectId();
      const productId = new ObjectId();

      mockCollections.returns.findOne.mockResolvedValue({
        _id: returnId,
        status: "completed",
        items: [
          {
            productId: productId,
            returnQuantity: 5,
          },
        ],
      });

      mockCollections.returns.updateOne.mockResolvedValue({
        modifiedCount: 1,
      });

      // Act
      const response = await request(app)
        .put(`/api/returns/${returnId}/status`)
        .send({
          status: "cancelled",
          notes: "Customer changed mind",
        })
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Return status updated successfully");

      // Verify stock was reversed via event-sourced system
      expect(mockRecordMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: productId,
          movementType: 'RETURN_OUT',
          quantity: 5,
        })
      );

      // Verify return status was updated
      expect(mockCollections.returns.updateOne).toHaveBeenCalledWith(
        { _id: returnId },
        expect.objectContaining({
          $set: expect.objectContaining({
            status: "cancelled",
          }),
        })
      );
    });

    test("should complete pending return and restore stock", async () => {
      // Arrange
      const returnId = new ObjectId();
      const productId = new ObjectId();

      mockCollections.returns.findOne.mockResolvedValue({
        _id: returnId,
        status: "pending",
        items: [
          {
            productId: productId,
            returnQuantity: 3,
          },
        ],
      });

      mockCollections.returns.updateOne.mockResolvedValue({
        modifiedCount: 1,
      });

      // Act
      const response = await request(app)
        .put(`/api/returns/${returnId}/status`)
        .send({
          status: "completed",
        })
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);

      // Verify stock was restored via event-sourced system
      expect(mockRecordMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: productId,
          movementType: 'RETURN_IN',
          quantity: 3,
        })
      );
    });

    test("should return 400 for invalid status", async () => {
      // Act
      const response = await request(app)
        .put(`/api/returns/${new ObjectId()}/status`)
        .send({
          status: "invalid_status",
        })
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Invalid status");
    });

    test("should return 404 if return not found", async () => {
      // Arrange
      mockCollections.returns.findOne.mockResolvedValue(null);

      // Act
      const response = await request(app)
        .put(`/api/returns/${new ObjectId()}/status`)
        .send({
          status: "cancelled",
        })
        .expect(404);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Return record not found");
    });
  });
});
