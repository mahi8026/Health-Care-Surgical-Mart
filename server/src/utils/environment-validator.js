/**
 * Environment Variables Validator
 * Validates required environment variables on startup
 */

const { logger } = require("../config/logging");

/**
 * Required environment variables
 */
const requiredEnvVars = ["MONGODB_URI", "JWT_SECRET", "NODE_ENV"];

/**
 * Optional environment variables with defaults
 */
const optionalEnvVars = {
  PORT: "5000",
  HOST: "0.0.0.0",
  DB_NAME: "medical_store_system",
  JWT_EXPIRES_IN: "24h",
  RATE_LIMIT_WINDOW_MS: "900000", // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: "100",
  LOG_LEVEL: "info",
  MAX_REQUEST_SIZE: "10485760", // 10MB
  DB_MAX_POOL_SIZE: "50",
  DB_MIN_POOL_SIZE: "5",
  DB_MAX_IDLE_TIME: "30000",
  DB_CONNECT_TIMEOUT: "10000",
  DB_SOCKET_TIMEOUT: "45000",
  DB_SERVER_SELECTION_TIMEOUT: "5000",
};

/**
 * Validate environment variables
 */
const validateEnvironment = () => {
  const errors = [];
  const warnings = [];

  // Check required variables
  requiredEnvVars.forEach((varName) => {
    if (!process.env[varName]) {
      errors.push(`Missing required environment variable: ${varName}`);
    }
  });

  // Set defaults for optional variables
  Object.entries(optionalEnvVars).forEach(([varName, defaultValue]) => {
    if (!process.env[varName]) {
      process.env[varName] = defaultValue;
      warnings.push(`Using default value for ${varName}: ${defaultValue}`);
    }
  });

  // Validate specific formats
  if (
    process.env.MONGODB_URI &&
    !process.env.MONGODB_URI.startsWith("mongodb")
  ) {
    errors.push("MONGODB_URI must start with 'mongodb://' or 'mongodb+srv://'");
  }

  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    warnings.push(
      "JWT_SECRET should be at least 32 characters long for security",
    );
  }

  if (
    process.env.NODE_ENV &&
    !["development", "production", "test"].includes(process.env.NODE_ENV)
  ) {
    warnings.push("NODE_ENV should be 'development', 'production', or 'test'");
  }

  // Validate numeric values
  const numericVars = [
    "PORT",
    "RATE_LIMIT_WINDOW_MS",
    "RATE_LIMIT_MAX_REQUESTS",
    "MAX_REQUEST_SIZE",
    "DB_MAX_POOL_SIZE",
    "DB_MIN_POOL_SIZE",
    "DB_MAX_IDLE_TIME",
    "DB_CONNECT_TIMEOUT",
    "DB_SOCKET_TIMEOUT",
    "DB_SERVER_SELECTION_TIMEOUT",
  ];

  numericVars.forEach((varName) => {
    if (process.env[varName] && isNaN(parseInt(process.env[varName]))) {
      errors.push(`${varName} must be a valid number`);
    }
  });

  // Log results
  if (warnings.length > 0) {
    warnings.forEach((warning) => {
      logger.warn(`Environment validation warning: ${warning}`);
    });
  }

  if (errors.length > 0) {
    errors.forEach((error) => {
      logger.error(`Environment validation error: ${error}`);
    });

    logger.error("Environment validation failed. Please check your .env file.");
    process.exit(1);
  }

  logger.info("Environment validation passed successfully");

  // Log current environment info (without sensitive data)
  logger.info("Environment configuration:", {
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT,
    host: process.env.HOST,
    logLevel: process.env.LOG_LEVEL,
    dbName: process.env.DB_NAME,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN,
    rateLimitWindow: process.env.RATE_LIMIT_WINDOW_MS,
    rateLimitMax: process.env.RATE_LIMIT_MAX_REQUESTS,
  });
};

module.exports = {
  validateEnvironment,
  requiredEnvVars,
  optionalEnvVars,
};
