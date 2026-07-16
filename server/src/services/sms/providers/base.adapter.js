/**
 * Abstract base class for SMS provider adapters.
 * All concrete SMS adapters must extend this class and implement
 * the sendSMS and getDeliveryStatus methods.
 */
class BaseSMSAdapter {
  /**
   * Send an SMS message.
   * @param {string} to - Recipient phone number in E.164 format
   * @param {string} message - SMS message content
   * @param {object} options - Provider-specific options
   * @returns {Promise<{success: boolean, messageId?: string, status?: string, provider: string, cost?: number, error?: string}>}
   */
  async sendSMS(to, message, _options = {}) {
    throw new Error('sendSMS() must be implemented by subclass');
  }

  /**
   * Get the delivery status of a previously sent SMS.
   * @param {string} messageId - Provider-specific message identifier
   * @returns {Promise<{status: string, [key: string]: any}>}
   */
  async getDeliveryStatus(_messageId) {
    throw new Error('getDeliveryStatus() must be implemented by subclass');
  }

  /**
   * Calculate the cost of sending a message.
   * @param {object|string} result - Provider result or message content
   * @returns {number} Cost in USD
   */
  calculateCost(_result) {
    throw new Error('calculateCost() must be implemented by subclass');
  }
}

module.exports = BaseSMSAdapter;
