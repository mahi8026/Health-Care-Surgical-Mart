/**
 * Validation Utilities
 * Common validation functions
 */

const { ValidationError } = require("./errors");

/**
 * Validate required fields
 */
const validateRequired = (data, requiredFields) => {
  const missing = [];

  for (const field of requiredFields) {
    if (data[field] === undefined || data[field] === null || data[field] === "") {
      missing.push(field);
    }
  }

  if (missing.length > 0) {
    throw new ValidationError(
      `Missing required fields: ${missing.join(", ")}`,
      missing.map((field) => ({ field, message: "This field is required" })),
    );
  }
};

/**
 * Validate email format
 */
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ValidationError("Invalid email format");
  }
};

/**
 * Validate phone number (Bangladesh format)
 */
const validatePhone = (phone) => {
  // Bangladesh phone: 11 digits starting with 01
  const phoneRegex = /^01[0-9]{9}$/;
  if (!phoneRegex.test(phone.replace(/[\s-]/g, ""))) {
    throw new ValidationError(
      "Invalid phone number. Must be 11 digits starting with 01",
    );
  }
};

/**
 * Validate positive number
 */
const validatePositiveNumber = (value, fieldName = "Value") => {
  const num = parseFloat(value);
  if (isNaN(num) || num <= 0) {
    throw new ValidationError(`${fieldName} must be a positive number`);
  }
  return num;
};

/**
 * Validate non-negative number
 */
const validateNonNegativeNumber = (value, fieldName = "Value") => {
  const num = parseFloat(value);
  if (isNaN(num) || num < 0) {
    throw new ValidationError(`${fieldName} must be a non-negative number`);
  }
  return num;
};

/**
 * Validate integer
 */
const validateInteger = (value, fieldName = "Value") => {
  const num = parseInt(value);
  if (isNaN(num) || !Number.isInteger(num)) {
    throw new ValidationError(`${fieldName} must be an integer`);
  }
  return num;
};

/**
 * Validate date
 */
const validateDate = (date, fieldName = "Date") => {
  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) {
    throw new ValidationError(`${fieldName} must be a valid date`);
  }
  return parsedDate;
};

/**
 * Validate string length
 */
const validateStringLength = (value, min, max, fieldName = "Value") => {
  if (typeof value !== "string") {
    throw new ValidationError(`${fieldName} must be a string`);
  }

  if (min && value.length < min) {
    throw new ValidationError(
      `${fieldName} must be at least ${min} characters`,
    );
  }

  if (max && value.length > max) {
    throw new ValidationError(
      `${fieldName} must be at most ${max} characters`,
    );
  }

  return value;
};

/**
 * Validate enum value
 */
const validateEnum = (value, allowedValues, fieldName = "Value") => {
  if (!allowedValues.includes(value)) {
    throw new ValidationError(
      `${fieldName} must be one of: ${allowedValues.join(", ")}`,
    );
  }
  return value;
};

/**
 * Validate MongoDB ObjectId
 */
const validateObjectId = (id, fieldName = "ID") => {
  const ObjectId = require("mongodb").ObjectId;
  if (!ObjectId.isValid(id)) {
    throw new ValidationError(`${fieldName} is not a valid ID`);
  }
  return new ObjectId(id);
};

/**
 * Validate array
 */
const validateArray = (value, minLength = 0, fieldName = "Array") => {
  if (!Array.isArray(value)) {
    throw new ValidationError(`${fieldName} must be an array`);
  }

  if (value.length < minLength) {
    throw new ValidationError(
      `${fieldName} must have at least ${minLength} items`,
    );
  }

  return value;
};

/**
 * Sanitize string (trim and remove extra spaces)
 */
const sanitizeString = (value) => {
  if (typeof value !== "string") return value;
  return value.trim().replace(/\s+/g, " ");
};

/**
 * Sanitize object (trim all string values)
 */
const sanitizeObject = (obj) => {
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      sanitized[key] = sanitizeString(value);
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

module.exports = {
  validateRequired,
  validateEmail,
  validatePhone,
  validatePositiveNumber,
  validateNonNegativeNumber,
  validateInteger,
  validateDate,
  validateStringLength,
  validateEnum,
  validateObjectId,
  validateArray,
  sanitizeString,
  sanitizeObject,
};
