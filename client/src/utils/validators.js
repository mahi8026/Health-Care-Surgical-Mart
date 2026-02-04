/**
 * Validation Utilities
 * Common validation functions for forms and data
 */

import { FILE_UPLOAD } from "../config/constants";

// Email validation
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Phone number validation (Indian format)
export const isValidPhone = (phone) => {
  const phoneRegex = /^[6-9]\d{9}$/;
  return phoneRegex.test(phone.replace(/\s+/g, ""));
};

// Amount validation
export const isValidAmount = (amount) => {
  const num = parseFloat(amount);
  return !isNaN(num) && num > 0 && num <= 999999999.99;
};

// Required field validation
export const isRequired = (value) => {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  return value !== null && value !== undefined && value !== "";
};

// Minimum length validation
export const hasMinLength = (value, minLength) => {
  return value && value.length >= minLength;
};

// Maximum length validation
export const hasMaxLength = (value, maxLength) => {
  return !value || value.length <= maxLength;
};

// Date validation
export const isValidDate = (date) => {
  const d = new Date(date);
  return d instanceof Date && !isNaN(d.getTime());
};

// Future date validation
export const isFutureDate = (date) => {
  const d = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d > today;
};

// Past or today date validation
export const isPastOrTodayDate = (date) => {
  const d = new Date(date);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return d <= today;
};

// File validation
export const isValidFile = (file) => {
  if (!file) return false;

  // Check file size
  if (file.size > FILE_UPLOAD.MAX_SIZE) {
    return { valid: false, error: "File size exceeds 5MB limit" };
  }

  // Check file type
  if (!FILE_UPLOAD.ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: "Invalid file type. Only JPG, PNG, and PDF files are allowed",
    };
  }

  return { valid: true };
};

// Password strength validation
export const isStrongPassword = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  return {
    valid:
      password.length >= minLength &&
      hasUpperCase &&
      hasLowerCase &&
      hasNumbers,
    requirements: {
      minLength: password.length >= minLength,
      hasUpperCase,
      hasLowerCase,
      hasNumbers,
      hasSpecialChar,
    },
  };
};

// Form validation helper
export const validateForm = (data, rules) => {
  const errors = {};

  Object.keys(rules).forEach((field) => {
    const value = data[field];
    const fieldRules = rules[field];

    fieldRules.forEach((rule) => {
      if (typeof rule === "function") {
        const result = rule(value);
        if (result !== true) {
          errors[field] = result;
        }
      } else if (typeof rule === "object") {
        const { validator, message } = rule;
        if (!validator(value)) {
          errors[field] = message;
        }
      }
    });
  });

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};
