// server/src/services/sms/sms.validator.js

/**
 * Validate a phone number in E.164 format.
 * E.164: +[country code][subscriber number], up to 15 digits total.
 * @param {string} phone
 * @returns {boolean}
 */
function validatePhoneNumber(phone) {
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phone);
}

/**
 * Normalize a phone number to E.164 format.
 * Strips spaces, dashes, parentheses, and prepends the country code if missing.
 * @param {string} phone - Raw phone number
 * @param {string} countryCode - Country dial code without '+', e.g. "91" for India
 * @returns {string} E.164 formatted number
 */
function formatPhoneNumber(phone, countryCode = "91") {
  // Remove all non-digit characters except leading +
  let cleaned = phone.replace(/[^\d+]/g, "");

  // Already has a + prefix — return as-is after stripping non-digits
  if (cleaned.startsWith("+")) {
    return cleaned;
  }

  // Remove leading zeros
  cleaned = cleaned.replace(/^0+/, "");

  return `+${countryCode}${cleaned}`;
}

/**
 * Check whether a phone number is a valid Indian mobile number.
 * Accepts E.164 (+91XXXXXXXXXX) or 10-digit local format.
 * Indian mobile numbers start with 6, 7, 8, or 9.
 * @param {string} phone
 * @returns {boolean}
 */
function isValidIndianNumber(phone) {
  // Strip country code if present
  let local = phone;
  if (local.startsWith("+91")) {
    local = local.slice(3);
  } else if (local.startsWith("91") && local.length === 12) {
    local = local.slice(2);
  }

  // Must be exactly 10 digits starting with 6-9
  return /^[6-9]\d{9}$/.test(local);
}

module.exports = { validatePhoneNumber, formatPhoneNumber, isValidIndianNumber };
