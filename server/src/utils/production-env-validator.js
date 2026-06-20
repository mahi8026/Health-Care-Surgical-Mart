/**
 * Production Environment Variable Validator
 * Validates all required environment variables for production deployment
 */

const { logger } = require('../config/logging');

/**
 * Environment variable validation rules
 */
const VALIDATION_RULES = {
  // Server Configuration
  NODE_ENV: {
    required: true,
    type: 'string',
    allowedValues: ['development', 'production', 'test'],
    description: 'Node environment',
  },
  PORT: {
    required: true,
    type: 'number',
    min: 1,
    max: 65535,
    description: 'Server port',
  },
  HOST: {
    required: true,
    type: 'string',
    description: 'Server host',
  },

  // Database Configuration
  MONGODB_URI: {
    required: true,
    type: 'string',
    pattern: /^mongodb(\+srv)?:\/\/.+/,
    description: 'MongoDB connection URI',
  },
  DB_NAME: {
    required: true,
    type: 'string',
    minLength: 1,
    description: 'Database name',
  },

  // JWT Configuration
  JWT_SECRET: {
    required: true,
    type: 'string',
    minLength: 32,
    description: 'JWT secret key (minimum 32 characters)',
    critical: true,
  },
  JWT_EXPIRES_IN: {
    required: false,
    type: 'string',
    default: '24h',
    description: 'JWT expiration time',
  },

  // Firebase Configuration
  FIREBASE_SERVICE_ACCOUNT_BASE64: {
    required: false,
    type: 'string',
    minLength: 100,
    description: 'Base64-encoded Firebase service account JSON',
    warning: 'Firebase authentication will be disabled without this or individual FIREBASE_* vars',
  },

  // CORS Configuration
  ALLOWED_ORIGINS: {
    required: true,
    type: 'string',
    description: 'Comma-separated list of allowed origins',
  },

  // Email Provider (at least one required)
  EMAIL_PROVIDER: {
    required: false,
    type: 'string',
    allowedValues: ['sendgrid', 'mailchimp'],
    description: 'Email provider selection',
  },
  SENDGRID_API_KEY: {
    required: false,
    type: 'string',
    minLength: 10,
    description: 'SendGrid API key',
    requiredIf: { EMAIL_PROVIDER: 'sendgrid' },
  },
  MAILCHIMP_API_KEY: {
    required: false,
    type: 'string',
    description: 'Mailchimp API key',
    requiredIf: { EMAIL_PROVIDER: 'mailchimp' },
  },

  // SMS Provider (at least one required)
  SMS_PROVIDER: {
    required: false,
    type: 'string',
    allowedValues: ['twilio', 'msg91'],
    description: 'SMS provider selection',
  },
  TWILIO_ACCOUNT_SID: {
    required: false,
    type: 'string',
    pattern: /^AC[a-z0-9]{32}$/i,
    description: 'Twilio Account SID',
    requiredIf: { SMS_PROVIDER: 'twilio' },
  },
  TWILIO_AUTH_TOKEN: {
    required: false,
    type: 'string',
    minLength: 32,
    description: 'Twilio Auth Token',
    requiredIf: { SMS_PROVIDER: 'twilio' },
  },
  MSG91_AUTH_KEY: {
    required: false,
    type: 'string',
    description: 'MSG91 Auth Key',
    requiredIf: { SMS_PROVIDER: 'msg91' },
  },

  // Redis Configuration (optional but recommended)
  REDIS_URL: {
    required: false,
    type: 'string',
    pattern: /^redis:\/\/.+/,
    description: 'Redis connection URL',
    warning: 'Redis is recommended for production queues',
  },
  ENABLE_QUEUES: {
    required: false,
    type: 'boolean',
    default: 'true',
    description: 'Enable Bull queues for async processing',
  },
};

/**
 * Validation result class
 */
class ValidationResult {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.isValid = true;
  }

  addError(variable, message) {
    this.errors.push({ variable, message });
    this.isValid = false;
  }

  addWarning(variable, message) {
    this.warnings.push({ variable, message });
  }

  addInfo(variable, message) {
    this.info.push({ variable, message });
  }

  getReport() {
    return {
      isValid: this.isValid,
      errors: this.errors,
      warnings: this.warnings,
      info: this.info,
      summary: {
        totalErrors: this.errors.length,
        totalWarnings: this.warnings.length,
        criticalErrors: this.errors.filter((e) =>
          e.message.includes('CRITICAL')
        ).length,
      },
    };
  }

  printReport() {
    const separator = '='.repeat(70);
    const report = [];

    report.push('\n' + separator);
    report.push('  PRODUCTION ENVIRONMENT VALIDATION REPORT');
    report.push(separator + '\n');

    if (this.errors.length > 0) {
      report.push('❌ ERRORS:');
      this.errors.forEach((error) => {
        const prefix = error.message.includes('CRITICAL') ? '🚨 CRITICAL' : '❌';
        report.push(`  ${prefix} ${error.variable}: ${error.message}`);
      });
      report.push('');
    }

    if (this.warnings.length > 0) {
      report.push('⚠️  WARNINGS:');
      this.warnings.forEach((warning) => {
        report.push(`  ⚠️  ${warning.variable}: ${warning.message}`);
      });
      report.push('');
    }

    if (this.info.length > 0) {
      report.push('ℹ️  INFO:');
      this.info.forEach((info) => {
        report.push(`  ℹ️  ${info.variable}: ${info.message}`);
      });
      report.push('');
    }

    report.push(separator);
    report.push(`  SUMMARY: ${this.errors.length} errors, ${this.warnings.length} warnings`);
    report.push(separator + '\n');

    if (this.isValid) {
      report.push('✅ All required environment variables are configured correctly!\n');
    } else {
      report.push('❌ Environment validation FAILED. Fix errors before deployment.\n');
    }

    // Log the entire report using Winston logger
    const reportText = report.join('\n');
    logger.info('Environment validation report', {
      file: 'production-env-validator.js',
      function: 'printReport',
      isValid: this.isValid,
      errorCount: this.errors.length,
      warningCount: this.warnings.length,
      report: reportText,
    });

    return this.isValid;
  }
}

/**
 * Validate a single environment variable
 */
function validateVariable(name, rule, result) {
  const value = process.env[name];

  // Check if required
  if (rule.required && !value) {
    const message = rule.critical
      ? `CRITICAL: ${rule.description} is required`
      : `${rule.description} is required`;
    result.addError(name, message);
    return;
  }

  // Check conditional requirements
  if (rule.requiredIf && !value) {
    const [condVar, condValue] = Object.entries(rule.requiredIf)[0];
    if (process.env[condVar] === condValue) {
      result.addError(
        name,
        `${rule.description} is required when ${condVar}=${condValue}`
      );
      return;
    }
  }

  // If not provided and not required, check for warnings
  if (!value) {
    if (rule.warning) {
      result.addWarning(name, rule.warning);
    }
    if (rule.default) {
      result.addInfo(name, `Using default value: ${rule.default}`);
    }
    return;
  }

  // Type validation
  if (rule.type === 'number') {
    const numValue = parseInt(value, 10);
    if (isNaN(numValue)) {
      result.addError(name, `Must be a valid number`);
      return;
    }
    if (rule.min !== undefined && numValue < rule.min) {
      result.addError(name, `Must be at least ${rule.min}`);
    }
    if (rule.max !== undefined && numValue > rule.max) {
      result.addError(name, `Must be at most ${rule.max}`);
    }
  }

  if (rule.type === 'boolean') {
    if (!['true', 'false', '1', '0'].includes(value.toLowerCase())) {
      result.addError(name, `Must be a boolean (true/false)`);
    }
  }

  // String validations
  if (rule.type === 'string') {
    if (rule.minLength && value.length < rule.minLength) {
      result.addError(
        name,
        `Must be at least ${rule.minLength} characters (current: ${value.length})`
      );
    }
    if (rule.maxLength && value.length > rule.maxLength) {
      result.addError(
        name,
        `Must be at most ${rule.maxLength} characters (current: ${value.length})`
      );
    }
    if (rule.pattern && !rule.pattern.test(value)) {
      result.addError(name, `Does not match required format`);
    }
  }

  // Allowed values
  if (rule.allowedValues && !rule.allowedValues.includes(value)) {
    result.addError(
      name,
      `Must be one of: ${rule.allowedValues.join(', ')} (current: ${value})`
    );
  }
}

/**
 * Validate all production environment variables
 */
function validateProductionEnvironment() {
  const result = new ValidationResult();

  // Validate each variable
  Object.entries(VALIDATION_RULES).forEach(([name, rule]) => {
    validateVariable(name, rule, result);
  });

  // Additional cross-variable validations
  validateEmailProvider(result);
  validateSMSProvider(result);
  validateRedisConfiguration(result);

  return result;
}

/**
 * Validate email provider configuration
 */
function validateEmailProvider(result) {
  const provider = process.env.EMAIL_PROVIDER;
  const hasSendGrid = !!process.env.SENDGRID_API_KEY;
  const hasMailchimp = !!process.env.MAILCHIMP_API_KEY;

  if (!provider && !hasSendGrid && !hasMailchimp) {
    result.addInfo(
      'EMAIL_PROVIDER',
      'No email provider configured. Email functionality will be disabled.'
    );
  } else if (provider === 'sendgrid' && !hasSendGrid) {
    result.addWarning(
      'SENDGRID_API_KEY',
      'SendGrid selected but API key not provided. Email will be disabled.'
    );
  } else if (provider === 'mailchimp' && !hasMailchimp) {
    result.addWarning(
      'MAILCHIMP_API_KEY',
      'Mailchimp selected but API key not provided. Email will be disabled.'
    );
  }
}

/**
 * Validate SMS provider configuration
 */
function validateSMSProvider(result) {
  const provider = process.env.SMS_PROVIDER;
  const hasTwilio =
    !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN;
  const hasMsg91 = !!process.env.MSG91_AUTH_KEY;

  if (!provider && !hasTwilio && !hasMsg91) {
    result.addInfo(
      'SMS_PROVIDER',
      'No SMS provider configured. SMS functionality will be disabled.'
    );
  } else if (provider === 'twilio' && !hasTwilio) {
    result.addWarning(
      'TWILIO_ACCOUNT_SID',
      'Twilio selected but credentials not provided. SMS will be disabled.'
    );
  } else if (provider === 'msg91' && !hasMsg91) {
    result.addWarning('MSG91_AUTH_KEY', 'MSG91 selected but auth key not provided. SMS will be disabled.');
  }
}

/**
 * Validate Redis configuration
 */
function validateRedisConfiguration(result) {
  const enableQueues = process.env.ENABLE_QUEUES !== 'false';
  const hasRedis = !!process.env.REDIS_URL || !!process.env.REDIS_HOST;

  if (enableQueues && !hasRedis) {
    result.addWarning(
      'REDIS_URL',
      'Queues enabled but Redis not configured. Email/SMS will process synchronously.'
    );
  }
}

/**
 * Run validation and exit if critical errors found
 */
function validateOrExit() {
  const result = validateProductionEnvironment();
  const isValid = result.printReport();

  // Only exit on critical errors (not warnings)
  const hasCriticalErrors = result.errors.some(e => e.message.includes('CRITICAL'));

  if (hasCriticalErrors && process.env.NODE_ENV === 'production') {
    logger.error('Production environment validation failed with critical errors. Exiting...');
    process.exit(1);
  }

  if (!isValid) {
    logger.warn('Production environment validation has non-critical errors. Continuing with warnings...');
  }

  return result;
}

module.exports = {
  validateProductionEnvironment,
  validateOrExit,
  ValidationResult,
};
