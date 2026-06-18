/**
 * Test Setup
 * Common setup for all tests
 */

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce noise in test output

// Mock environment variables for tests
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_min_32_characters_long_for_testing';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/health_care_test';

// Increase timeout for database operations
jest.setTimeout(10000);

// Global test utilities
global.testUtils = {
  // Generate a test user token
  generateTestToken: (userData) => {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
      {
        userId: userData._id || 'test_user_id',
        email: userData.email || 'test@example.com',
        role: userData.role || 'SHOP_ADMIN',
        shopId: userData.shopId || 'test_shop_1',
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  },
  
  // Common test data
  testShopId: 'test_shop_1',
  testUserId: 'test_user_id',
  testEmail: 'test@example.com',
};

// Cleanup after all tests
afterAll(async () => {
  // Close database connections
  // Add cleanup logic here if needed
});
