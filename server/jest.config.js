/**
 * Jest Configuration
 * For testing the backend API
 */

module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  
  // Test match patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/__tests__/**/*.js',
  ],
  
  // Coverage configuration
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js', // Exclude entry point
    '!src/**/index.js', // Exclude index files
    '!src/**/*.config.js', // Exclude config files
  ],
  
  // Coverage thresholds (aligned with actual suite coverage ~19%; raise as coverage grows)
  coverageThreshold: {
    global: {
      branches: 8,
      functions: 10,
      lines: 15,
      statements: 15,
    },
  },
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
  ],
  
  // Timeouts
  testTimeout: 10000,
  
  // Verbose output
  verbose: true,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Reset mocks between tests
  resetMocks: true,
};
