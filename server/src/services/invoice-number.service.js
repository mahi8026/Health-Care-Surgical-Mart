/**
 * Invoice Number Service
 *
 * Generates sequential invoice numbers per shop
 * Format: INV-YYYYMM-XXXXX
 * Example: INV-202606-00001, INV-202606-00002, etc.
 *
 * Resets monthly for better organization.
 *
 * Numbers are minted from an atomic counter document (invoice_counters) keyed
 * by shop + month, so two concurrent POS checkouts can never produce the same
 * invoice number.
 */

const { getShopDatabase } = require('../config/database');
const { logger } = require('../config/logging');

class InvoiceNumberService {
  buildInvoiceNo(yearMonth, sequenceNumber) {
    return `INV-${yearMonth}-${String(sequenceNumber).padStart(5, '0')}`;
  }

  /**
   * Generate next sequential invoice number for a shop
   *
   * @param {string} shopId - Shop identifier
   * @returns {Promise<string>} - Generated invoice number (e.g., INV-202606-00001)
   */
  async generateInvoiceNumber(shopId) {
    try {
      const shopDb = getShopDatabase(shopId);

      const now = new Date();
      const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
      const counterId = `INV-${yearMonth}`;

      const counters = shopDb.collection('invoice_counters');

      let sequenceNumber;
      try {
        // Bootstrap BEFORE claiming: when the counter does not exist yet
        // (month rollover or first run after the read-based generator era),
        // reconcile it with the highest existing invoice using an atomic,
        // idempotent `$max` upsert. Two concurrent first-callers both raise
        // the counter to maxExisting and then claim strictly increasing
        // values — the old "$set regresses the counter" race is gone.
        const existing = await counters.findOne({ _id: counterId });
        if (!existing) {
          const maxExisting = await this._maxExistingInvoiceSequence(
            shopDb,
            yearMonth,
          );
          await counters.updateOne(
            { _id: counterId },
            { $max: { value: maxExisting } },
            { upsert: true },
          );
        }

        // Atomically claim the next sequence number. upsert + $inc is atomic,
        // so two concurrent POS checkouts receive strictly increasing values.
        const claimed = await counters.findOneAndUpdate(
          { _id: counterId },
          { $inc: { value: 1 }, $set: { updatedAt: new Date() } },
          { upsert: true, returnDocument: 'after' },
        );
        sequenceNumber = claimed ? claimed.value : 1;

        // Final collision guard: if the minted number already exists (manual
        // counter reset, imported data), bump the counter and re-claim.
        for (let attempt = 0; attempt < 5; attempt += 1) {
          const candidate = this.buildInvoiceNo(yearMonth, sequenceNumber);
          // eslint-disable-next-line no-await-in-loop
          const collision = await shopDb
            .collection('sales')
            .countDocuments({ invoiceNo: candidate });
          if (!collision) {
            break;
          }
          logger.warn(`Invoice number collision on ${candidate}, re-claiming`);
          // eslint-disable-next-line no-await-in-loop
          const reclaimed = await counters.findOneAndUpdate(
            { _id: counterId },
            { $inc: { value: 1 }, $set: { updatedAt: new Date() } },
            { returnDocument: 'after' },
          );
          sequenceNumber = reclaimed ? reclaimed.value : sequenceNumber + 1;
        }
      } catch (counterError) {
        // Counter collection unavailable (e.g. mocked or restricted DB) —
        // fall back to the read-based sequence below.
        logger.warn('Invoice counter unavailable, using read-based sequence:', counterError.message);
        return await this._readBasedInvoiceNo(shopDb, yearMonth);
      }

      const invoiceNo = this.buildInvoiceNo(yearMonth, sequenceNumber);

      logger.debug('Generated invoice number', {
        shopId,
        invoiceNo,
        yearMonth,
        sequenceNumber,
      });

      return invoiceNo;
    } catch (error) {
      logger.error('Failed to generate invoice number:', error);
      // Fallback to timestamp-based if sequence generation fails
      return `INV-${Date.now()}`;
    }
  }

  /**
   * Read-based sequence: highest existing invoice this month + 1.
   * Used when the atomic counter collection is unavailable.
   */
  async _readBasedInvoiceNo(shopDb, yearMonth) {
    const lastSale = await shopDb
      .collection('sales')
      .find({ invoiceNo: { $regex: `^INV-${yearMonth}-` } })
      .sort({ createdAt: -1, _id: -1 })
      .limit(1)
      .toArray();

    let sequenceNumber = 1;
    if (lastSale.length > 0) {
      const match = lastSale[0].invoiceNo.match(/INV-\d{6}-(\d{5})$/);
      if (match && match[1]) {
        sequenceNumber = parseInt(match[1], 10) + 1;
      }
    }

    return this.buildInvoiceNo(yearMonth, sequenceNumber);
  }

  /**
   * Highest existing invoice sequence for a year-month (0 when none).
   * Shared by the counter bootstrap and read-based fallback.
   */
  async _maxExistingInvoiceSequence(shopDb, yearMonth) {
    const lastSale = await shopDb
      .collection('sales')
      .find({ invoiceNo: { $regex: `^INV-${yearMonth}-` } })
      .sort({ createdAt: -1, _id: -1 })
      .limit(1)
      .toArray();

    if (lastSale.length > 0) {
      const match = lastSale[0].invoiceNo.match(/INV-\d{6}-(\d{5})$/);
      if (match && match[1]) {
        return parseInt(match[1], 10);
      }
    }
    return 0;
  }

  /**
   * Get next invoice number preview (read-only — never claims a number, so
   * the POS "next invoice" display cannot burn sequence values).
   *
   * @param {string} shopId - Shop identifier
   * @returns {Promise<string>} - Next invoice number
   */
  async getNextInvoiceNumber(shopId) {
    try {
      const shopDb = getShopDatabase(shopId);

      const now = new Date();
      const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
      const counterId = `INV-${yearMonth}`;

      // If the counter exists, the next number is counter.value + 1.
      const counter = await shopDb.collection('invoice_counters').findOne({ _id: counterId });
      if (counter && counter.value > 0) {
        return this.buildInvoiceNo(yearMonth, counter.value + 1);
      }

      // Otherwise fall back to the highest existing invoice this month.
      const maxExisting = await this._maxExistingInvoiceSequence(shopDb, yearMonth);
      return this.buildInvoiceNo(yearMonth, maxExisting + 1);
    } catch (error) {
      logger.error('Failed to preview invoice number:', error);
      return `INV-${Date.now()}`;
    }
  }

  /**
   * Get statistics for current month (read-only; does not claim a number)
   *
   * @param {string} shopId - Shop identifier
   * @returns {Promise<Object>} - Statistics object
   */
  async getMonthlyStats(shopId) {
    try {
      const shopDb = getShopDatabase(shopId);

      const now = new Date();
      const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
      const counterId = `INV-${yearMonth}`;

      const count = await shopDb.collection('sales').countDocuments({
        invoiceNo: { $regex: `^INV-${yearMonth}-` },
      });

      // nextSequence must respect gaps (skipped numbers, fallback timestamps),
      // so derive it from the counter / highest existing invoice, not count.
      const counter = await shopDb.collection('invoice_counters').findOne({ _id: counterId });
      const maxExisting =
        counter && counter.value > 0
          ? counter.value
          : await this._maxExistingInvoiceSequence(shopDb, yearMonth);

      return {
        yearMonth,
        totalInvoices: count,
        nextSequence: maxExisting + 1,
      };
    } catch (error) {
      logger.error('Failed to get monthly stats:', error);
      return {
        yearMonth: 'unknown',
        totalInvoices: 0,
        nextSequence: 1,
      };
    }
  }
}

module.exports = new InvoiceNumberService();