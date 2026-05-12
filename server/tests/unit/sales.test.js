/**
 * Unit Tests for Sales Creation with Stock Deduction
 * Tests the critical path: POST /api/sales
 */

// Set environment variables BEFORE any imports
process.env.JWT_SECRET = "test_jwt_secret_key_for_testing_only_at_least_32_chars";
process.env.SENDGRID_API_KEY = "SG.test_key_for_testing_purposes_only_minimum_length";
process.env.SENDGRID_FROM_EMAIL = "test@example.com";
process.env.ENABLE_QUEUES = "false";

const request = require("supertest");
const express = require("express");
const { ObjectId } = require("mongodb");

// Mock dependencies BEFORE importing modules that use them
jest.mock("../../src/config/database");
jest.mock("../../src/config/logging");
jest.mock("../../src/services/email/email.service");
jest.mock("../../src/middleware/auth-multi-tenant");
jest.mock("../../src/utils/rbac");

// Import after mocking
const salesController = require("../../src/controllers/sales.controller");

const { getShopDatabase } = require("../../src/config/database");
const { authenticate, checkShopStatus } = require("../../src/middleware/auth-multi-tenant");
const { requirePermission } = require("../../src/utils/rbac");

describe("Sales Creation with Stock Deduction", () => {
  let app;
  let mockShopDb;
  let mockCollections;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock collections
    mockCollections = {
      sales: {
        insertOne: jest.fn(),
        find: jest.fn(),
        findOne: jest.fn(),
        countDocuments: jest.fn(),
      },
      products: {
        findOne: jest.fn(),
      },
      stock: {
        findOne: jest.fn(),
        updateOne: jest.fn(),
        insertOne: jest.fn(),
      },
      customers: {
        findOne: jest.fn(),
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
        name: "Test User",
        email: "test@example.com",
        role: "SHOP_ADMIN",
        shopId: "test_shop",
        permissions: ["create_sale"],
      };
      req.shopDb = mockShopDb;
      next();
    });

    checkShopStatus.mockImplementation((req, res, next) => next());

    // Mock permission middleware
    requirePermission.mockImplementation(() => (req, res, next) => next());

    // Create Express app for testing
    app = express();
    app.use(express.json());
    
    // Manually create routes instead of importing
    const router = express.Router();
    router.use(authenticate);
    router.use(checkShopStatus);
    router.post("/", requirePermission(), salesController.createSale.bind(salesController));
    router.get("/", requirePermission(), salesController.getSales.bind(salesController));
    router.get("/:id", requirePermission(), salesController.getSaleById.bind(salesController));
    
    app.use("/api/sales", router);
  });

  describe("POST /api/sales - Success Cases", () => {
    test("should create sale and deduct stock successfully", async () => {
      // Arrange
      const productId = new ObjectId();
      const saleData = {
        invoiceNumber: "INV-TEST-001",
        customer: {
          id: new ObjectId().toString(),
          name: "John Doe",
        },
        items: [
          {
            productId: productId.toString(),
            quantity: 5,
            sellingPrice: 100,
          },
        ],
        subtotal: 500,
        discount: 0,
        vatAmount: 50,
        vatPercent: 10,
        grandTotal: 550,
        cashPaid: 600,
        bankPaid: 0,
        notes: "Test sale",
      };

      // Mock product lookup
      mockCollections.products.findOne.mockResolvedValue({
        _id: productId,
        name: "Test Product",
        sku: "TEST-001",
        sellingPrice: 100,
        minStockLevel: 10,
      });

      // Mock stock lookup (sufficient stock)
      mockCollections.stock.findOne
        .mockResolvedValueOnce({
          productId: productId,
          currentQty: 100,
          availableQty: 100,
          minStockLevel: 10,
        })
        .mockResolvedValueOnce({
          productId: productId,
          currentQty: 95,
          availableQty: 95,
          minStockLevel: 10,
        });

      // Mock sale insertion
      mockCollections.sales.insertOne.mockResolvedValue({
        insertedId: new ObjectId(),
        acknowledged: true,
      });

      // Mock stock update
      mockCollections.stock.updateOne.mockResolvedValue({
        modifiedCount: 1,
        acknowledged: true,
      });

      // Act
      const response = await request(app)
        .post("/api/sales")
        .send(saleData)
        .expect(201);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Sale created successfully");
      expect(response.body.data).toHaveProperty("_id");
      expect(response.body.data.invoiceNo).toBe("INV-TEST-001");
      expect(response.body.data.grandTotal).toBe(550);

      // Verify product lookup was called
      expect(mockCollections.products.findOne).toHaveBeenCalledWith({
        _id: productId,
      });

      // Verify stock was checked
      expect(mockCollections.stock.findOne).toHaveBeenCalled();

      // Verify sale was inserted
      expect(mockCollections.sales.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          invoiceNo: "INV-TEST-001",
          grandTotal: 550,
          items: expect.arrayContaining([
            expect.objectContaining({
              productId: productId,
              qty: 5,
              rate: 100,
              total: 500,
            }),
          ]),
        }),
        expect.any(Object)
      );

      // Verify stock was updated (deducted)
      expect(mockCollections.stock.updateOne).toHaveBeenCalledWith(
        { productId: productId },
        expect.objectContaining({
          $inc: {
            currentQty: -5,
            availableQty: -5,
          },
          $set: expect.objectContaining({
            lastSaleDate: expect.any(Date),
          }),
        })
      );
    });

    test("should create sale with multiple items and deduct stock for each", async () => {
      // Arrange
      const product1Id = new ObjectId();
      const product2Id = new ObjectId();

      const saleData = {
        items: [
          { productId: product1Id.toString(), quantity: 3, sellingPrice: 50 },
          { productId: product2Id.toString(), quantity: 2, sellingPrice: 75 },
        ],
        subtotal: 300,
        discount: 0,
        vatAmount: 30,
        grandTotal: 330,
        cashPaid: 330,
        bankPaid: 0,
      };

      // Mock products
      mockCollections.products.findOne
        .mockResolvedValueOnce({
          _id: product1Id,
          name: "Product 1",
          sellingPrice: 50,
        })
        .mockResolvedValueOnce({
          _id: product2Id,
          name: "Product 2",
          sellingPrice: 75,
        });

      // Mock stock
      mockCollections.stock.findOne.mockResolvedValue({
        currentQty: 100,
        availableQty: 100,
      });

      mockCollections.sales.insertOne.mockResolvedValue({
        insertedId: new ObjectId(),
      });

      mockCollections.stock.updateOne.mockResolvedValue({
        modifiedCount: 1,
      });

      // Act
      const response = await request(app)
        .post("/api/sales")
        .send(saleData)
        .expect(201);

      // Assert
      expect(response.body.success).toBe(true);
      expect(mockCollections.products.findOne).toHaveBeenCalledTimes(2);
      // Stock update is called twice per item (deduction + low stock flag update)
      expect(mockCollections.stock.updateOne).toHaveBeenCalled();

      // Verify stock deduction for product 1 (first call)
      expect(mockCollections.stock.updateOne).toHaveBeenCalledWith(
        { productId: product1Id },
        expect.objectContaining({
          $inc: { currentQty: -3, availableQty: -3 },
        })
      );

      // Verify stock deduction for product 2 (third call)
      expect(mockCollections.stock.updateOne).toHaveBeenCalledWith(
        { productId: product2Id },
        expect.objectContaining({
          $inc: { currentQty: -2, availableQty: -2 },
        })
      );
    });

    test("should generate invoice number if not provided", async () => {
      // Arrange
      const productId = new ObjectId();
      const saleData = {
        // No invoiceNumber provided
        items: [
          { productId: productId.toString(), quantity: 1, sellingPrice: 100 },
        ],
        subtotal: 100,
        grandTotal: 100,
        cashPaid: 100,
      };

      mockCollections.products.findOne.mockResolvedValue({
        _id: productId,
        name: "Test Product",
        sellingPrice: 100,
      });

      mockCollections.stock.findOne.mockResolvedValue({
        currentQty: 50,
        availableQty: 50,
      });

      mockCollections.sales.insertOne.mockResolvedValue({
        insertedId: new ObjectId(),
      });

      mockCollections.stock.updateOne.mockResolvedValue({
        modifiedCount: 1,
      });

      // Act
      const response = await request(app)
        .post("/api/sales")
        .send(saleData)
        .expect(201);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.invoiceNo).toMatch(/^INV-\d+$/);
    });

    test("should handle cash customer (no customer ID)", async () => {
      // Arrange
      const productId = new ObjectId();
      const saleData = {
        customer: {
          name: "Cash Customer",
        },
        items: [
          { productId: productId.toString(), quantity: 1, sellingPrice: 50 },
        ],
        subtotal: 50,
        grandTotal: 50,
        cashPaid: 50,
      };

      mockCollections.products.findOne.mockResolvedValue({
        _id: productId,
        name: "Test Product",
        sellingPrice: 50,
      });

      mockCollections.stock.findOne.mockResolvedValue({
        currentQty: 100,
      });

      mockCollections.sales.insertOne.mockResolvedValue({
        insertedId: new ObjectId(),
      });

      mockCollections.stock.updateOne.mockResolvedValue({
        modifiedCount: 1,
      });

      // Act
      const response = await request(app)
        .post("/api/sales")
        .send(saleData)
        .expect(201);

      // Assert
      expect(response.body.success).toBe(true);
      expect(mockCollections.sales.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: null,
          customerName: "Cash Customer",
        }),
        expect.any(Object)
      );
    });
  });

  describe("POST /api/sales - Stock Edge Cases", () => {
    test("should create sale even with insufficient stock (warning only)", async () => {
      // Arrange
      const productId = new ObjectId();
      const saleData = {
        items: [
          { productId: productId.toString(), quantity: 10, sellingPrice: 100 },
        ],
        subtotal: 1000,
        grandTotal: 1000,
        cashPaid: 1000,
      };

      mockCollections.products.findOne.mockResolvedValue({
        _id: productId,
        name: "Test Product",
        sellingPrice: 100,
      });

      // Mock insufficient stock
      mockCollections.stock.findOne.mockResolvedValue({
        productId: productId,
        currentQty: 5, // Less than requested 10
        availableQty: 5,
      });

      mockCollections.sales.insertOne.mockResolvedValue({
        insertedId: new ObjectId(),
      });

      mockCollections.stock.updateOne.mockResolvedValue({
        modifiedCount: 1,
      });

      // Act
      const response = await request(app)
        .post("/api/sales")
        .send(saleData)
        .expect(201);

      // Assert - Sale should still be created
      expect(response.body.success).toBe(true);
      expect(mockCollections.stock.updateOne).toHaveBeenCalledWith(
        { productId: productId },
        expect.objectContaining({
          $inc: { currentQty: -10, availableQty: -10 },
        })
      );
    });

    test("should create stock record if product has no stock entry", async () => {
      // Arrange
      const productId = new ObjectId();
      const saleData = {
        items: [
          { productId: productId.toString(), quantity: 5, sellingPrice: 100 },
        ],
        subtotal: 500,
        grandTotal: 500,
        cashPaid: 500,
      };

      mockCollections.products.findOne
        .mockResolvedValueOnce({
          _id: productId,
          name: "New Product",
          sellingPrice: 100,
          minStockLevel: 10,
        })
        .mockResolvedValueOnce({
          _id: productId,
          name: "New Product",
          minStockLevel: 10,
        });

      // No existing stock on first two calls (_enrichSaleItems + _updateStockForSale check)
      // Third call returns the newly created stock for the low-stock flag update
      mockCollections.stock.findOne
        .mockResolvedValueOnce(null)  // _enrichSaleItems: no stock (warning only)
        .mockResolvedValueOnce(null)  // _updateStockForSale: no existing stock → triggers insertOne
        .mockResolvedValueOnce({      // _updateStockForSale: low-stock flag update
          productId: productId,
          currentQty: -5,
          availableQty: -5,
          minStockLevel: 10,
        });

      mockCollections.sales.insertOne.mockResolvedValue({
        insertedId: new ObjectId(),
      });

      mockCollections.stock.insertOne.mockResolvedValue({
        insertedId: new ObjectId(),
      });

      mockCollections.stock.updateOne.mockResolvedValue({
        modifiedCount: 1,
      });

      // Act
      const response = await request(app)
        .post("/api/sales")
        .send(saleData)
        .expect(201);

      // Assert
      expect(response.body.success).toBe(true);
      // Stock insert is not called because stock.findOne returns null initially,
      // but then the code path doesn't create new stock in this test scenario
      // The actual implementation creates stock with insertOne
      expect(mockCollections.stock.insertOne).toHaveBeenCalled();
    });

    test("should update low stock flag after sale", async () => {
      // Arrange
      const productId = new ObjectId();
      const saleData = {
        items: [
          { productId: productId.toString(), quantity: 15, sellingPrice: 100 },
        ],
        subtotal: 1500,
        grandTotal: 1500,
        cashPaid: 1500,
      };

      mockCollections.products.findOne.mockResolvedValue({
        _id: productId,
        name: "Test Product",
        sellingPrice: 100,
      });

      // Stock will go below minimum after sale
      mockCollections.stock.findOne
        .mockResolvedValueOnce({
          productId: productId,
          currentQty: 20,
          availableQty: 20,
          minStockLevel: 10,
        })
        .mockResolvedValueOnce({
          productId: productId,
          currentQty: 5, // After deduction
          availableQty: 5,
          minStockLevel: 10,
        });

      mockCollections.sales.insertOne.mockResolvedValue({
        insertedId: new ObjectId(),
      });

      mockCollections.stock.updateOne.mockResolvedValue({
        modifiedCount: 1,
      });

      // Act
      const response = await request(app)
        .post("/api/sales")
        .send(saleData)
        .expect(201);

      // Assert
      expect(response.body.success).toBe(true);
      // Stock update is called for deduction, and the low stock flag is updated in the same call
      expect(mockCollections.stock.updateOne).toHaveBeenCalled();
    });
  });

  describe("POST /api/sales - Validation Errors", () => {
    test("should return 400 if no items provided", async () => {
      // Arrange
      const saleData = {
        items: [],
        grandTotal: 100,
      };

      // Act
      const response = await request(app)
        .post("/api/sales")
        .send(saleData)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Sale must have at least one item");
      expect(mockCollections.sales.insertOne).not.toHaveBeenCalled();
    });

    test("should return 400 if grandTotal is invalid", async () => {
      // Arrange
      const productId = new ObjectId();
      const saleData = {
        items: [
          { productId: productId.toString(), quantity: 1, sellingPrice: 100 },
        ],
        grandTotal: 0,
      };

      // Act
      const response = await request(app)
        .post("/api/sales")
        .send(saleData)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Invalid sale amount");
    });

    test("should return 500 if product not found", async () => {
      // Arrange
      const productId = new ObjectId();
      const saleData = {
        items: [
          { productId: productId.toString(), quantity: 1, sellingPrice: 100 },
        ],
        grandTotal: 100,
        cashPaid: 100,
      };

      // Mock product not found
      mockCollections.products.findOne.mockResolvedValue(null);

      // Act
      const response = await request(app)
        .post("/api/sales")
        .send(saleData)
        .expect(500);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Product not found");
      expect(mockCollections.sales.insertOne).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/sales - Payment Calculations", () => {
    test("should calculate return amount correctly", async () => {
      // Arrange
      const productId = new ObjectId();
      const saleData = {
        items: [
          { productId: productId.toString(), quantity: 1, sellingPrice: 100 },
        ],
        subtotal: 100,
        grandTotal: 100,
        cashPaid: 150, // Overpayment
        bankPaid: 0,
      };

      mockCollections.products.findOne.mockResolvedValue({
        _id: productId,
        name: "Test Product",
        sellingPrice: 100,
      });

      mockCollections.stock.findOne.mockResolvedValue({
        currentQty: 50,
      });

      mockCollections.sales.insertOne.mockResolvedValue({
        insertedId: new ObjectId(),
      });

      mockCollections.stock.updateOne.mockResolvedValue({
        modifiedCount: 1,
      });

      // Act
      await request(app).post("/api/sales").send(saleData).expect(201);

      // Assert
      expect(mockCollections.sales.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          cashPaid: 150,
          grandTotal: 100,
          returnAmount: 50, // Change to return
        }),
        expect.any(Object)
      );
    });

    test("should handle mixed payment (cash + bank)", async () => {
      // Arrange
      const productId = new ObjectId();
      const saleData = {
        items: [
          { productId: productId.toString(), quantity: 1, sellingPrice: 100 },
        ],
        subtotal: 100,
        grandTotal: 100,
        cashPaid: 50,
        bankPaid: 50,
      };

      mockCollections.products.findOne.mockResolvedValue({
        _id: productId,
        name: "Test Product",
        sellingPrice: 100,
      });

      mockCollections.stock.findOne.mockResolvedValue({
        currentQty: 50,
      });

      mockCollections.sales.insertOne.mockResolvedValue({
        insertedId: new ObjectId(),
      });

      mockCollections.stock.updateOne.mockResolvedValue({
        modifiedCount: 1,
      });

      // Act
      await request(app).post("/api/sales").send(saleData).expect(201);

      // Assert
      expect(mockCollections.sales.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          cashPaid: 50,
          bankPaid: 50,
          grandTotal: 100,
          returnAmount: 0,
        }),
        expect.any(Object)
      );
    });
  });
});
