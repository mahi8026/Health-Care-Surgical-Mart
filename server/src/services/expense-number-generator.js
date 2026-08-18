/**
 * Expense Number Generator Service
 * Generates unique expense numbers in format EXP-YYYY-NNN
 */

const { logger } = require('../config/logging');

/**
 * Generate next expense number for a shop
 * @param {Db} shopDb - Shop database instance
 * @returns {Promise<string>} Generated expense number
 */
async function generateExpenseNumber(shopDb) {
  try {
    const currentYear = new Date().getFullYear();
    const yearPrefix = `EXP-${currentYear}-`;

    const counters = shopDb.collection('expense_counters');

    // Atomically claim the next sequence number. upsert + $inc is atomic, so
    // two concurrent expense creations receive strictly increasing values.
    let claimed;
    try {
      claimed = await counters.findOneAndUpdate(
        { _id: yearPrefix },
        { $inc: { value: 1 }, $set: { updatedAt: new Date() } },
        { upsert: true, returnDocument: 'after' },
      );
    } catch (counterError) {
      logger.warn('Expense counter unavailable, using read-based sequence:', counterError.message);
      return await readBasedExpenseNumber(shopDb, yearPrefix);
    }

    let sequenceNumber = claimed ? claimed.value : 1;

    // Bootstrap: the very first claim (value === 1) may belong to a year that
    // already has expenses from the old read-based generator. Reconcile so
    // numbering continues instead of colliding.
    if (sequenceNumber === 1) {
      const lastExpense = await shopDb
        .collection('expenses')
        .find({ expenseNumber: { $regex: `^${yearPrefix}` } })
        .sort({ createdAt: -1, _id: -1 })
        .limit(1)
        .toArray();

      let maxExisting = 0;
      if (lastExpense.length > 0) {
        const match = lastExpense[0].expenseNumber.match(/EXP-\d{4}-(\d+)$/);
        if (match && match[1]) {
          maxExisting = parseInt(match[1], 10);
        }
      }

      if (maxExisting >= sequenceNumber) {
        await counters.updateOne(
          { _id: yearPrefix },
          { $set: { value: maxExisting, updatedAt: new Date() } },
        );
        sequenceNumber = maxExisting + 1;
      }
    }

    // Format with leading zeros (minimum 3 digits)
    const formattedNumber = sequenceNumber.toString().padStart(3, '0');
    const expenseNumber = `${yearPrefix}${formattedNumber}`;

    logger.debug(`Generated expense number: ${expenseNumber}`);
    return expenseNumber;
  } catch (error) {
    logger.error('Error generating expense number:', error);
    throw new Error(`Failed to generate expense number: ${error.message}`);
  }
}

/**
 * Read-based sequence: highest existing expense number for the year + 1.
 * Used when the atomic counter collection is unavailable.
 */
async function readBasedExpenseNumber(shopDb, yearPrefix) {
  const lastExpense = await shopDb
    .collection('expenses')
    .find({ expenseNumber: { $regex: `^${yearPrefix}` } })
    .sort({ createdAt: -1, _id: -1 })
    .limit(1)
    .toArray();

  let sequenceNumber = 1;
  if (lastExpense.length > 0 && lastExpense[0].expenseNumber) {
    const match = lastExpense[0].expenseNumber.match(/EXP-\d{4}-(\d+)$/);
    if (match && match[1]) {
      sequenceNumber = parseInt(match[1], 10) + 1;
    }
  }

  return `${yearPrefix}${sequenceNumber.toString().padStart(3, '0')}`;
}

/**
 * Get the next expense number without claiming it (read-only preview).
 * @param {Db} shopDb - Shop database instance
 * @returns {Promise<string>} Next expense number
 */
async function getNextExpenseNumber(shopDb) {
  const currentYear = new Date().getFullYear();
  const yearPrefix = `EXP-${currentYear}-`;

  const counter = await shopDb.collection('expense_counters').findOne({ _id: yearPrefix });
  if (counter && counter.value > 0) {
    return `${yearPrefix}${(counter.value + 1).toString().padStart(3, '0')}`;
  }

  return readBasedExpenseNumber(shopDb, yearPrefix);
}

/**
 * Validate expense number format
 * @param {string} expenseNumber - Expense number to validate
 * @returns {boolean} Whether the format is valid
 */
function validateExpenseNumberFormat(expenseNumber) {
  if (!expenseNumber || typeof expenseNumber !== 'string') {
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

  const parts = expenseNumber.split('-');
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

  const parts = expenseNumber.split('-');
  return parseInt(parts[2], 10);
}

module.exports = {
  generateExpenseNumber,
  getNextExpenseNumber,
  validateExpenseNumberFormat,
  extractYearFromExpenseNumber,
  extractSequenceFromExpenseNumber,
};
