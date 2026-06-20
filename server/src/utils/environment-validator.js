/**
 * Environment Variables Validator
 * Validates required environment variables on startup
 */

const { logger } = require('../config/logging');

/**
 * Required environment variables
 */
const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET', 'NODE_ENV'];

/**
 * Optional environment variables with defaults
 */
const optionalEnvVars = {
  PORT: '5000',
  HOST: '0.0.0.0',
  DB_NAME: 'medical_store_system',
  JWT_SECRET_IN: '24h',
  RATE_LIMIT_WINDOW_MS: '900000', // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: '100',
  LOG_LEVEL: 'info',
  MAX_REQUEST_SIZE: '10485760', // 10MB
  DB_MAX_POOL_SIZE: '50',
  DB_MIN_POOL_SIZE: '5',
  DB_MAX_IDLE_TIME: '30000',
  DB_CONNECT_TIMEOUT: '10000',
  DB_SOCKET_TIMEOUT: '45000',
  DB_SERVER_SELECTION_TIMEOUT: '5000',
  BCRYPT_ROUNDS: '12',
};

/**
 * Google Cloud Storage variables (optional - falls back to local storage)
 */
const gcsEnvVars = [
  'GCS_BUCKET_NAME',
  'GCS_PROJECT_ID',
  'GOOGLE_APPLICATION_CREDENTIALS_JSON',
];

/**
 * Validate environment variables
 */
const validateEnvironment = () => {
  // Skip validation in test environment if basic test variables are set
  if (process.env.NODE_ENV === 'test' && process.env.MONGODB_URI && process.env.JWT_SECRET) {
    logger.info('Test environment detected - skipping strict validation');
    return;
  }

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

  // Check GCS configuration (optional - warn if incomplete)
  const gcsConfigured = gcsEnvVars.every((varName) => process.env[varName]);
  if (!gcsConfigured) {
    const missingGcsVars = gcsEnvVars.filter((varName) => !process.env[varName]);
    if (missingGcsVars.length > 0 && missingGcsVars.length < gcsEnvVars.length) {
      warnings.push(
        `Partial GCS configuration detected. Missing: ${missingGcsVars.join(', ')}. ` +
        'File uploads will use local storage (not recommended for production on Render).'
      );
    }
  } else {
    logger.info('Google Cloud Storage configuration detected');
  }

  // Validate specific formats
  if (
    process.env.MONGODB_URI &&
    !process.env.MONGODB_URI.startsWith('mongodb')
  ) {
    errors.push("MONGODB_URI must start with 'mongodb://' or 'mongodb+srv://'");
  }

  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    warnings.push(
      'JWT_SECRET should be at least 32 characters long for security',
    );
  }

  if (
    process.env.NODE_ENV &&
    !['development', 'production', 'test'].includes(process.env.NODE_ENV)
  ) {
    warnings.push("NODE_ENV should be 'development', 'production', or 'test'");
  }

  // Validate numeric values
  const numericVars = [
    'PORT',
    'RATE_LIMIT_WINDOW_MS',
    'RATE_LIMIT_MAX_REQUESTS',
    'MAX_REQUEST_SIZE',
    'DB_MAX_POOL_SIZE',
    'DB_MIN_POOL_SIZE',
    'DB_MAX_IDLE_TIME',
    'DB_CONNECT_TIMEOUT',
    'DB_SOCKET_TIMEOUT',
    'DB_SERVER_SELECTION_TIMEOUT',
    'BCRYPT_ROUNDS',
  ];

  numericVars.forEach((varName) => {
    if (process.env[varName] && isNaN(parseInt(process.env[varName]))) {
      errors.push(`${varName} must be a valid number`);
    }
  });

  // Validate BCRYPT_ROUNDS range (10-14 recommended)
  if (process.env.BCRYPT_ROUNDS) {
    const rounds = parseInt(process.env.BCRYPT_ROUNDS);
    if (rounds < 10 || rounds > 14) {
      warnings.push('BCRYPT_ROUNDS should be between 10 and 14 for optimal security/performance balance');
    }
  }

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

    logger.error('Environment validation failed. Please check your .env file.');
    process.exit(1);
  }

  logger.info('Environment validation passed successfully');

  // Log current environment info (without sensitive data)
  logger.info('Environment configuration:', {
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
  gcsEnvVars,
};
