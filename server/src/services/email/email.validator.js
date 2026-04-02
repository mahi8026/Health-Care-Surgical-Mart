// server/src/services/email/email.validator.js

/**
 * Validate a single email address using a standard regex.
 * @param {string} email
 * @returns {boolean}
 */
function validateEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * Validate an array of email addresses.
 * Returns a split of valid and invalid entries.
 * @param {string[]} emails
 * @returns {{ valid: string[], invalid: string[] }}
 */
function validateEmailList(emails) {
  const valid = [];
  const invalid = [];

  for (const email of emails) {
    if (validateEmail(email)) {
      valid.push(email);
    } else {
      invalid.push(email);
    }
  }

  return { valid, invalid };
}

/**
 * Sanitize an email address by trimming whitespace and lowercasing.
 * @param {string} email
 * @returns {string}
 */
function sanitizeEmail(email) {
  return email.trim().toLowerCase();
}

module.exports = { validateEmail, validateEmailList, sanitizeEmail };
