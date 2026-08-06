/**
 * Test Setup
 * Common setup for all tests
 */

const { ObjectId } = require('mongodb');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce noise in test output

// Load .env file before setting test defaults (so .env values take precedence)
try { require('dotenv').config(); } catch (_) {}

// Mock environment variables for tests (only if not already set by .env)
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_min_32_characters_long_for_testing';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/health_care_test';

// Increase timeout for database operations
jest.setTimeout(30000);

// Known test IDs (valid MongoDB ObjectId hex strings)
const TEST_ADMIN_ID = '507f191e810c19729de860ea';
const TEST_SHOP_ID = 'shop_health_care_01';

// Single-tenant mode: pin the shop database the routes resolve to.
// getShopDatabase() with no argument uses SHOP_ID → client.db(`shop_${SHOP_ID}`),
// which is exactly the DB seeded below.
process.env.SHOP_ID = process.env.SHOP_ID || TEST_SHOP_ID;

// Connect to database for integration tests
let connected = false;
let seedDone = false;
beforeAll(async () => {
  if (!connected) {
    try {
      const { connectToDatabase } = require('../src/config/database');
      await connectToDatabase();
      connected = true;
    } catch (err) {
      console.warn('Database connection failed in test setup:', err.message);
    }
  }

  // Seed test data once
  if (connected && !seedDone) {
    try {
      const { getShopDatabase, getSystemDatabase } = require('../src/config/database');
      const systemDb = getSystemDatabase();
      const shopDb = getShopDatabase(TEST_SHOP_ID);

      // Create test shop
      await systemDb.collection('shops').updateOne(
        { shopId: TEST_SHOP_ID },
        {
          $setOnInsert: {
            shopId: TEST_SHOP_ID,
            name: 'Test Health Care Shop',
            status: 'Active',
            subscriptionExpiry: new Date('2099-12-31'),
            isActive: true,
            createdAt: new Date(),
          },
        },
        { upsert: true },
      );

      // Create test SHOP_ADMIN user
      await shopDb.collection('users').updateOne(
        { _id: new ObjectId(TEST_ADMIN_ID) },
        {
          $setOnInsert: {
            _id: new ObjectId(TEST_ADMIN_ID),
            name: 'Test Admin',
            email: 'admin@test.com',
            role: 'SHOP_ADMIN',
            shopId: TEST_SHOP_ID,
            isActive: true,
            createdAt: new Date(),
          },
        },
        { upsert: true },
      );

      seedDone = true;
    } catch (err) {
      console.warn('Test data seeding failed:', err.message);
    }
  }
});

// Global test utilities
global.testUtils = {
  // Well-known IDs
  ADMIN_ID: TEST_ADMIN_ID,
  SHOP_ID: TEST_SHOP_ID,

  // Generate a test user token
  generateTestToken: (userData) => {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
      {
        userId: userData.userId || TEST_ADMIN_ID,
        email: userData.email || 'admin@test.com',
        role: userData.role || 'SHOP_ADMIN',
        shopId: userData.shopId || TEST_SHOP_ID,
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' },
    );
  },

  // Common test data
  testShopId: TEST_SHOP_ID,
  testUserId: TEST_ADMIN_ID,
  testEmail: 'admin@test.com',
};

// Cleanup after all tests
afterAll(async () => {
  // Close database connections
  try {
    const { closeDatabaseConnection } = require('../src/config/database');
    await closeDatabaseConnection();
  } catch (err) {
    // Ignore cleanup errors
  }
});
