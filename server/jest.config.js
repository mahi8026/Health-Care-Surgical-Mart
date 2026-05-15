/**
 * Jest Configuration
 * Explicit config so CI and local environments behave identically.
 */

module.exports = {
  // Test environment
  testEnvironment: "node",

  // Where to find tests
  testMatch: ["**/tests/unit/**/*.test.js"],

  // Global setup file (sets env vars, global mocks)
  setupFilesAfterEnv: ["./tests/setup.js"],

  // Coverage collection
  collectCoverageFrom: [
    "src/**/*.js",
    "!src/server.js",
    "!src/**/*.config.js",
    "!src/scripts/**",
    "!src/utils/migrations/**",
  ],

  // Coverage output
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "clover"],

  // Fail if a test suite has no tests
  passWithNoTests: false,

  // Timeout per test (ms)
  testTimeout: 10000,

  // Verbose output
  verbose: true,
};
