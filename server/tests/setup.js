/**
 * Test Setup
 * Global test configuration and setup
 */

// Set test environment
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test_jwt_secret_key_for_testing_only_at_least_32_chars";
process.env.MONGODB_URI = "mongodb://localhost:27017/medical_store_test";
process.env.DB_NAME = "medical_store_test";
process.env.SENDGRID_API_KEY = "SG.test_key_for_testing_purposes_only";
process.env.SENDGRID_FROM_EMAIL = "test@example.com";
process.env.SENDGRID_FROM_NAME = "Test Store";
process.env.ENABLE_QUEUES = "false";

// Global test timeout
jest.setTimeout(10000);

// Mock console methods in tests
global.console = {
  ...console,
  // Uncomment to suppress console output in tests
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
};

// Mock logger globally
jest.mock("../src/config/logging", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  setupLogging: jest.fn(),
}));

/**
 * Global error handler middleware for tests.
 * Converts AppError / http-errors / plain Error objects with a statusCode
 * into the standard { success: false, message, status } JSON response that
 * all route tests assert against.
 *
 * Usage in test files — add AFTER routes:
 *   app.use((err, req, res, next) => {
 *     const statusCode = err.statusCode || err.status || 500;
 *     res.status(statusCode).json({ success: false, message: err.message });
 *   });
 */
