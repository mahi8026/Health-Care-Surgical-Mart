module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/server/src", "<rootDir>/server/tests"],
  testMatch: ["**/__tests__/**/*.js", "**/?(*.)+(spec|test).js"],
  collectCoverageFrom: [
    "server/src/**/*.js",
    "!server/src/server.js",
    "!server/src/config/logging.js",
    "!**/node_modules/**",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  setupFilesAfterEnv: ["<rootDir>/server/tests/setup.js"],
  testTimeout: 10000,
};
