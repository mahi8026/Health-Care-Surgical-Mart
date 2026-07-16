/**
 * Abstract base class for email provider adapters.
 * All concrete email adapters must extend this class and implement
 * the sendEmail and getEmailStats abstract methods.
 */
class BaseEmailAdapter {
  /**
   * Send an email message.
   * @param {string} to - Recipient email address
   * @param {string} subject - Email subject line
   * @param {string} content - HTML email content
   * @param {object} options - Provider-specific options
   * @returns {Promise<{success: boolean, messageId?: string, status?: string, provider: string, error?: string}>}
   */
  async sendEmail(to, subject, content, _options = {}) {
    throw new Error('sendEmail() must be implemented by subclass');
  }

  /**
   * Get delivery/engagement stats for a previously sent email.
   * @param {string} messageId - Provider-specific message identifier
   * @returns {Promise<{delivered: boolean, opened: boolean, clicked: boolean, bounced: boolean, [key: string]: any}>}
   */
  async getEmailStats(_messageId) {
    throw new Error('getEmailStats() must be implemented by subclass');
  }

  /**
   * Validate an email address format.
   * @param {string} email - Email address to validate
   * @returns {boolean}
   */
  validateEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }
}

module.exports = BaseEmailAdapter;
