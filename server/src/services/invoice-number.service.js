/**
 * Invoice Number Service
 * 
 * Generates sequential invoice numbers per shop
 * Format: INV-YYYYMM-XXXXX
 * Example: INV-202606-00001, INV-202606-00002, etc.
 * 
 * Resets monthly for better organization
 */

const { getShopDatabase } = require('../config/database');
const { logger } = require('../config/logging');

class InvoiceNumberService {
  /**
   * Generate next sequential invoice number for a shop
   * 
   * @param {string} shopId - Shop identifier
   * @returns {Promise<string>} - Generated invoice number (e.g., INV-202606-00001)
   */
  async generateInvoiceNumber(shopId) {
    try {
      const shopDb = getShopDatabase(shopId);
      
      // Get current year-month (YYYYMM format)
      const now = new Date();
      const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      // Find the last invoice for this month
      const lastSale = await shopDb.collection('sales')
        .find({
          invoiceNo: { $regex: `^INV-${yearMonth}-` }
        })
        .sort({ createdAt: -1, _id: -1 })
        .limit(1)
        .toArray();
      
      let sequenceNumber = 1;
      
      if (lastSale.length > 0) {
        // Extract sequence number from last invoice (INV-202606-00001 → 00001)
        const lastInvoiceNo = lastSale[0].invoiceNo;
        const match = lastInvoiceNo.match(/INV-\d{6}-(\d{5})$/);
        
        if (match && match[1]) {
          sequenceNumber = parseInt(match[1], 10) + 1;
        }
      }
      
      // Format: INV-YYYYMM-XXXXX (e.g., INV-202606-00001)
      const invoiceNo = `INV-${yearMonth}-${String(sequenceNumber).padStart(5, '0')}`;
      
      logger.debug('Generated invoice number', {
        shopId,
        invoiceNo,
        yearMonth,
        sequenceNumber
      });
      
      return invoiceNo;
      
    } catch (error) {
      logger.error('Failed to generate invoice number:', error);
      // Fallback to timestamp-based if sequence generation fails
      return `INV-${Date.now()}`;
    }
  }
  
  /**
   * Get next invoice number preview (without creating)
   * Useful for displaying next invoice number on POS screen
   * 
   * @param {string} shopId - Shop identifier
   * @returns {Promise<string>} - Next invoice number
   */
  async getNextInvoiceNumber(shopId) {
    return await this.generateInvoiceNumber(shopId);
  }
  
  /**
   * Get statistics for current month
   * 
   * @param {string} shopId - Shop identifier
   * @returns {Promise<Object>} - Statistics object
   */
  async getMonthlyStats(shopId) {
    try {
      const shopDb = getShopDatabase(shopId);
      
      const now = new Date();
      const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      const count = await shopDb.collection('sales')
        .countDocuments({
          invoiceNo: { $regex: `^INV-${yearMonth}-` }
        });
      
      return {
        yearMonth,
        totalInvoices: count,
        nextSequence: count + 1
      };
      
    } catch (error) {
      logger.error('Failed to get monthly stats:', error);
      return {
        yearMonth: 'unknown',
        totalInvoices: 0,
        nextSequence: 1
      };
    }
  }
}

module.exports = new InvoiceNumberService();
