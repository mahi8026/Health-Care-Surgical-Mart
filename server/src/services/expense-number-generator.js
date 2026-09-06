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

    let sequenceNumber;
    try {
      // Bootstrap BEFORE claiming: when the counter does not exist yet, raise
      // it to the highest existing expense number with an atomic, idempotent
      // `$max` upsert. Concurrent first-callers can never claim a colliding
      // number, and the old "$set regresses the counter" race is gone.
      const existing = await counters.findOne({ _id: yearPrefix });
      if (!existing) {
        const maxExisting = await maxExistingExpenseSequence(shopDb, yearPrefix);
        await counters.updateOne(
          { _id: yearPrefix },
          { $max: { value: maxExisting } },
          { upsert: true },
        );
      }

      // Atomically claim the next sequence number. upsert + $inc is atomic, so
      // two concurrent expense creations receive strictly increasing values.
      const claimed = await counters.findOneAndUpdate(
        { _id: yearPrefix },
        { $inc: { value: 1 }, $set: { updatedAt: new Date() } },
        { upsert: true, returnDocument: 'after' },
      );
      sequenceNumber = claimed ? claimed.value : 1;

      // Final collision guard: if the minted number already exists (manual
      // counter reset, imported data), bump the counter and re-claim.
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const candidate = `${yearPrefix}${sequenceNumber.toString().padStart(3, '0')}`;
        // eslint-disable-next-line no-await-in-loop
        const collision = await shopDb
          .collection('expenses')
          .countDocuments({ expenseNumber: candidate });
        if (!collision) {
          break;
        }
        logger.warn(`Expense number collision on ${candidate}, re-claiming`);
        // eslint-disable-next-line no-await-in-loop
        const reclaimed = await counters.findOneAndUpdate(
          { _id: yearPrefix },
          { $inc: { value: 1 }, $set: { updatedAt: new Date() } },
          { returnDocument: 'after' },
        );
        sequenceNumber = reclaimed ? reclaimed.value : sequenceNumber + 1;
      }
    } catch (counterError) {
      logger.warn('Expense counter unavailable, using read-based sequence:', counterError.message);
      return await readBasedExpenseNumber(shopDb, yearPrefix);
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
 * Highest existing expense sequence for a year prefix (0 when none).
 * Shared by the counter bootstrap and read-based fallback.
 */
async function maxExistingExpenseSequence(shopDb, yearPrefix) {
  const lastExpense = await shopDb
    .collection('expenses')
    .find({ expenseNumber: { $regex: `^${yearPrefix}` } })
    .sort({ createdAt: -1, _id: -1 })
    .limit(1)
    .toArray();

  if (lastExpense.length > 0 && lastExpense[0].expenseNumber) {
    const match = lastExpense[0].expenseNumber.match(/EXP-\d{4}-(\d+)$/);
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }
  }
  return 0;
}

/**
 * Read-based sequence: highest existing expense number for the year + 1.
 * Used when the atomic counter collection is unavailable.
 */
async function readBasedExpenseNumber(shopDb, yearPrefix) {
  const maxExisting = await maxExistingExpenseSequence(shopDb, yearPrefix);
  return `${yearPrefix}${(maxExisting + 1).toString().padStart(3, '0')}`;
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
