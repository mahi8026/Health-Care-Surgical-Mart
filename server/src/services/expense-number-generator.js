/**
 * Expense Number Generator Service
 * Generates unique expense numbers in format EXP-YYYY-NNN
 */

const { logger } = require("../config/logging");

/**
 * Generate next expense number for a shop
 * @param {Db} shopDb - Shop database instance
 * @returns {Promise<string>} Generated expense number
 */
async function generateExpenseNumber(shopDb) {
  try {
    const currentYear = new Date().getFullYear();
    const yearPrefix = `EXP-${currentYear}-`;

    // Find the highest expense number for current year
    const expensesCollection = shopDb.collection("expenses");

    const lastExpense = await expensesCollection.findOne(
      { expenseNumber: { $regex: `^${yearPrefix}` } },
      { sort: { expenseNumber: -1 } },
    );

    let nextNumber = 1;

    if (lastExpense && lastExpense.expenseNumber) {
      // Extract the number part and increment
      const numberPart = lastExpense.expenseNumber.split("-")[2];
      nextNumber = parseInt(numberPart, 10) + 1;
    }

    // Format with leading zeros (minimum 3 digits)
    const formattedNumber = nextNumber.toString().padStart(3, "0");
    const expenseNumber = `${yearPrefix}${formattedNumber}`;

    logger.debug(`Generated expense number: ${expenseNumber}`);
    return expenseNumber;
  } catch (error) {
    logger.error("Error generating expense number:", error);
    throw new Error(`Failed to generate expense number: ${error.message}`);
  }
}

/**
 * Validate expense number format
 * @param {string} expenseNumber - Expense number to validate
 * @returns {boolean} Whether the format is valid
 */
function validateExpenseNumberFormat(expenseNumber) {
  if (!expenseNumber || typeof expenseNumber !== "string") {
    return false;
  }

  // Pattern: EXP-YYYY-NNN (where NNN is at least 3 digits)
  const pattern = /^EXP-\d{4}-\d{3,}$/;
  return pattern.test(expenseNumber);
}

/**
 * Extract year from expense number
 * @param {string} expenseNumber - Expense number
 * @returns {number|null} Year or null if invalid format
 */
function extractYearFromExpenseNumber(expenseNumber) {
  if (!validateExpenseNumberFormat(expenseNumber)) {
    return null;
  }

  const parts = expenseNumber.split("-");
  return parseInt(parts[1], 10);
}

/**
 * Extract sequence number from expense number
 * @param {string} expenseNumber - Expense number
 * @returns {number|null} Sequence number or null if invalid format
 */
function extractSequenceFromExpenseNumber(expenseNumber) {
  if (!validateExpenseNumberFormat(expenseNumber)) {
    return null;
  }

  const parts = expenseNumber.split("-");
  return parseInt(parts[2], 10);
}

module.exports = {
  generateExpenseNumber,
  validateExpenseNumberFormat,
  extractYearFromExpenseNumber,
  extractSequenceFromExpenseNumber,
};
