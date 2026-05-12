/**
 * Unit Tests for Firebase Token Verification Flow
 * Tests the critical path: authenticate middleware
 */

// Set environment variables BEFORE any imports
process.env.JWT_SECRET = "test_secret_key_with_32_characters_minimum_length";

const jwt = require("jsonwebtoken");
const { ObjectId } = require("mongodb");

// Mock dependencies BEFORE importing modules that use them
jest.mock("../../src/config/database");
jest.mock("../../src/config/logging");

const {
  authenticate,
  generateToken,
  verifyShopAccess,
  checkShopStatus,
} = require("../../src/middleware/auth-multi-tenant");

const { getShopDatabase, getSystemDatabase } = require("../../src/config/database");
const { logger } = require("../../src/config/logging");

describe("Firebase Token Verification Flow", () => {
  let mockReq;
  let mockRes;
  let mockNext;
  let mockShopDb;
  let mockSystemDb;
  let mockCollections;

  // Set JWT_SECRET for testing
  const originalEnv = process.env.JWT_SECRET;

  beforeAll(() => {
    process.env.JWT_SECRET = "test_secret_key_with_32_characters_minimum_length";
  });

  afterAll(() => {
    process.env.JWT_SECRET = originalEnv;
  });

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock logger
    logger.error = jest.fn();
    logger.warn = jest.fn();
    logger.info = jest.fn();

    // Create mock collections
    mockCollections = {
      users: {
        findOne: jest.fn(),
      },
      system_users: {
        findOne: jest.fn(),
      },
      shops: {
        findOne: jest.fn(),
      },
    };

    // Mock databases
    mockShopDb = {
      collection: jest.fn((name) => mockCollections[name]),
    };

    mockSystemDb = {
      collection: jest.fn((name) => mockCollections[name]),
    };

    getShopDatabase.mockReturnValue(mockShopDb);
    getSystemDatabase.mockReturnValue(mockSystemDb);

    // Mock request, response, next
    mockReq = {
      headers: {},
      path: "/api/test",
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  describe("authenticate - Success Cases", () => {
    test("should authenticate valid JWT token for shop user", async () => {
      // Arrange
      const userId = new ObjectId();
      const shopId = "test_shop";

      const user = {
        _id: userId,
        name: "Test User",
        email: "test@example.com",
        role: "SHOP_ADMIN",
        shopId: shopId,
        isActive: true,
        permissions: ["create_sale", "view_sales"],
      };

      const token = jwt.sign(
        {
          userId: userId.toString(),
          email: user.email,
          role: user.role,
          shopId: shopId,
        },
        process.env.JWT_SECRET,
        { expiresIn: "24h" }
      );

      mockReq.headers.authorization = `Bearer ${token}`;
      mockCollections.users.findOne.mockResolvedValue(user);

      // Act
      await authenticate(mockReq, mockRes, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockReq.user).toEqual({
        _id: userId,
        name: "Test User",
        email: "test@example.com",
        role: "SHOP_ADMIN",
        shopId: shopId,
        permissions: ["create_sale", "view_sales"],
      });
      expect(mockReq.shopDb).toBe(mockShopDb);
      expect(getShopDatabase).toHaveBeenCalledWith(shopId);
    });

    test("should authenticate valid JWT token for super admin", async () => {
      // Arrange
      const userId = new ObjectId();

      const user = {
        _id: userId,
        name: "Super Admin",
        email: "admin@example.com",
        role: "SUPER_ADMIN",
        isActive: true,
        permissions: [],
      };

      const token = jwt.sign(
        {
          userId: userId.toString(),
          email: user.email,
          role: "SUPER_ADMIN",
          shopId: null,
        },
        process.env.JWT_SECRET,
        { expiresIn: "24h" }
      );

      mockReq.headers.authorization = `Bearer ${token}`;
      mockCollections.system_users.findOne.mockResolvedValue(user);

      // Act
      await authenticate(mockReq, mockRes, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toEqual({
        _id: userId,
        name: "Super Admin",
        email: "admin@example.com",
        role: "SUPER_ADMIN",
        shopId: null,
        permissions: [],
      });
      expect(getSystemDatabase).toHaveBeenCalled();
      expect(mockReq.shopDb).toBeUndefined();
    });

    test("should handle user with no permissions array", async () => {
      // Arrange
      const userId = new ObjectId();
      const shopId = "test_shop";

      const user = {
        _id: userId,
        name: "Staff User",
        email: "staff@example.com",
        role: "STAFF",
        shopId: shopId,
        isActive: true,
        // No permissions array
      };

      const token = jwt.sign(
        {
          userId: userId.toString(),
          email: user.email,
          role: user.role,
          shopId: shopId,
        },
        process.env.JWT_SECRET
      );

      mockReq.headers.authorization = `Bearer ${token}`;
      mockCollections.users.findOne.mockResolvedValue(user);

      // Act
      await authenticate(mockReq, mockRes, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user.permissions).toEqual([]);
    });
  });

  describe("authenticate - Token Validation Errors", () => {
    test("should return 401 if no authorization header", async () => {
      // Arrange - no authorization header

      // Act
      await authenticate(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: "No token provided",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test("should return 401 if authorization header doesn't start with Bearer", async () => {
      // Arrange
      mockReq.headers.authorization = "InvalidFormat token123";

      // Act
      await authenticate(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: "No token provided",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test("should return 401 for invalid JWT token", async () => {
      // Arrange
      mockReq.headers.authorization = "Bearer invalid_token_string";

      // Act
      await authenticate(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: "Invalid token",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test("should return 401 for expired JWT token", async () => {
      // Arrange
      const userId = new ObjectId();
      const token = jwt.sign(
        {
          userId: userId.toString(),
          email: "test@example.com",
          role: "SHOP_ADMIN",
          shopId: "test_shop",
        },
        process.env.JWT_SECRET,
        { expiresIn: "-1h" } // Expired 1 hour ago
      );

      mockReq.headers.authorization = `Bearer ${token}`;

      // Act
      await authenticate(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: "Token expired",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test("should return 401 if token missing shopId for non-super-admin", async () => {
      // Arrange
      const userId = new ObjectId();
      const token = jwt.sign(
        {
          userId: userId.toString(),
          email: "test@example.com",
          role: "SHOP_ADMIN",
          // Missing shopId
        },
        process.env.JWT_SECRET
      );

      mockReq.headers.authorization = `Bearer ${token}`;

      // Act
      await authenticate(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: "Invalid token: missing shop context",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("authenticate - User Validation Errors", () => {
    test("should return 401 if user not found in database", async () => {
      // Arrange
      const userId = new ObjectId();
      const token = jwt.sign(
        {
          userId: userId.toString(),
          email: "test@example.com",
          role: "SHOP_ADMIN",
          shopId: "test_shop",
        },
        process.env.JWT_SECRET
      );

      mockReq.headers.authorization = `Bearer ${token}`;
      mockCollections.users.findOne.mockResolvedValue(null); // User not found

      // Act
      await authenticate(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: "User not found",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test("should return 401 if user account is inactive", async () => {
      // Arrange
      const userId = new ObjectId();
      const token = jwt.sign(
        {
          userId: userId.toString(),
          email: "test@example.com",
          role: "SHOP_ADMIN",
          shopId: "test_shop",
        },
        process.env.JWT_SECRET
      );

      mockReq.headers.authorization = `Bearer ${token}`;
      mockCollections.users.findOne.mockResolvedValue({
        _id: userId,
        name: "Inactive User",
        email: "test@example.com",
        role: "SHOP_ADMIN",
        shopId: "test_shop",
        isActive: false, // Inactive account
      });

      // Act
      await authenticate(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: "User account is inactive",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("authenticate - Database Error Handling", () => {
    test("should return 500 if database connection fails", async () => {
      // Arrange
      const userId = new ObjectId();
      const token = jwt.sign(
        {
          userId: userId.toString(),
          email: "test@example.com",
          role: "SHOP_ADMIN",
          shopId: "test_shop",
        },
        process.env.JWT_SECRET
      );

      mockReq.headers.authorization = `Bearer ${token}`;
      mockCollections.users.findOne.mockRejectedValue(
        new Error("Database connection failed")
      );

      // Act
      await authenticate(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: "Database connection failed",
      });
      expect(logger.error).toHaveBeenCalledWith(
        "Database error in authenticate middleware:",
        expect.any(Object)
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    test("should return 500 if getShopDatabase fails", async () => {
      // Arrange
      const userId = new ObjectId();
      const token = jwt.sign(
        {
          userId: userId.toString(),
          email: "test@example.com",
          role: "SHOP_ADMIN",
          shopId: "test_shop",
        },
        process.env.JWT_SECRET
      );

      mockReq.headers.authorization = `Bearer ${token}`;
      mockCollections.users.findOne.mockResolvedValue({
        _id: userId,
        name: "Test User",
        email: "test@example.com",
        role: "SHOP_ADMIN",
        shopId: "test_shop",
        isActive: true,
      });

      getShopDatabase.mockImplementation(() => {
        throw new Error("Failed to connect to shop database");
      });

      // Act
      await authenticate(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: "Database connection failed",
      });
      expect(logger.error).toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("generateToken", () => {
    test("should generate valid JWT token for shop user", () => {
      // Arrange
      const user = {
        _id: new ObjectId(),
        email: "test@example.com",
        role: "SHOP_ADMIN",
        shopId: "test_shop",
      };

      // Act
      const token = generateToken(user);

      // Assert
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");

      // Verify token can be decoded
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      expect(decoded.userId).toBe(user._id.toString());
      expect(decoded.email).toBe(user.email);
      expect(decoded.role).toBe(user.role);
      expect(decoded.shopId).toBe(user.shopId);
    });

    test("should generate valid JWT token for super admin", () => {
      // Arrange
      const user = {
        _id: new ObjectId(),
        email: "admin@example.com",
        role: "SUPER_ADMIN",
      };

      // Act
      const token = generateToken(user);

      // Assert
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      expect(decoded.userId).toBe(user._id.toString());
      expect(decoded.role).toBe("SUPER_ADMIN");
      expect(decoded.shopId).toBeNull();
    });

    test("should set token expiration to 24 hours", () => {
      // Arrange
      const user = {
        _id: new ObjectId(),
        email: "test@example.com",
        role: "SHOP_ADMIN",
        shopId: "test_shop",
      };

      // Act
      const token = generateToken(user);

      // Assert
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const expiresIn = decoded.exp - decoded.iat;
      expect(expiresIn).toBe(24 * 60 * 60); // 24 hours in seconds
    });
  });

  describe("verifyShopAccess", () => {
    test("should allow super admin to access any shop", () => {
      // Arrange
      mockReq.user = {
        role: "SUPER_ADMIN",
        shopId: null,
      };
      mockReq.params = { shopId: "any_shop" };

      // Act
      verifyShopAccess(mockReq, mockRes, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    test("should allow user to access their own shop", () => {
      // Arrange
      mockReq.user = {
        role: "SHOP_ADMIN",
        shopId: "test_shop",
      };
      mockReq.params = { shopId: "test_shop" };

      // Act
      verifyShopAccess(mockReq, mockRes, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    test("should allow access if no shopId in params", () => {
      // Arrange
      mockReq.user = {
        role: "SHOP_ADMIN",
        shopId: "test_shop",
      };
      mockReq.params = {};
      mockReq.body = {};
      mockReq.query = {};

      // Act
      verifyShopAccess(mockReq, mockRes, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalled();
    });

    test("should deny access to different shop", () => {
      // Arrange
      mockReq.user = {
        role: "SHOP_ADMIN",
        shopId: "shop_1",
      };
      mockReq.params = { shopId: "shop_2" };

      // Act
      verifyShopAccess(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: "Access denied: You do not have access to this shop",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("checkShopStatus", () => {
    test("should allow super admin to bypass shop status check", async () => {
      // Arrange
      mockReq.user = {
        role: "SUPER_ADMIN",
      };

      // Act
      await checkShopStatus(mockReq, mockRes, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(mockCollections.shops.findOne).not.toHaveBeenCalled();
    });

    test("should allow access if shop is active", async () => {
      // Arrange
      mockReq.user = {
        role: "SHOP_ADMIN",
        shopId: "test_shop",
      };

      mockCollections.shops.findOne.mockResolvedValue({
        shopId: "test_shop",
        status: "Active",
        subscriptionExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      });

      // Act
      await checkShopStatus(mockReq, mockRes, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    test("should return 404 if shop not found", async () => {
      // Arrange
      mockReq.user = {
        role: "SHOP_ADMIN",
        shopId: "test_shop",
      };

      mockCollections.shops.findOne.mockResolvedValue(null);

      // Act
      await checkShopStatus(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: "Shop not found",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test("should return 403 if shop is suspended", async () => {
      // Arrange
      mockReq.user = {
        role: "SHOP_ADMIN",
        shopId: "test_shop",
      };

      mockCollections.shops.findOne.mockResolvedValue({
        shopId: "test_shop",
        status: "Suspended",
      });

      // Act
      await checkShopStatus(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: "Shop is suspended. Please contact support.",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test("should return 403 if subscription expired", async () => {
      // Arrange
      mockReq.user = {
        role: "SHOP_ADMIN",
        shopId: "test_shop",
      };

      mockCollections.shops.findOne.mockResolvedValue({
        shopId: "test_shop",
        status: "Active",
        subscriptionExpiry: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
      });

      // Act
      await checkShopStatus(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: "Subscription expired. Please renew to continue.",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test("should return 500 if database error occurs", async () => {
      // Arrange
      mockReq.user = {
        role: "SHOP_ADMIN",
        shopId: "test_shop",
      };

      mockCollections.shops.findOne.mockRejectedValue(
        new Error("Database error")
      );

      // Act
      await checkShopStatus(mockReq, mockRes, mockNext);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: "Failed to verify shop status",
      });
      expect(logger.error).toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
