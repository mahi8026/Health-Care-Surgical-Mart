/**
 * Email Service
 *
 * Handles all email operations using SendGrid.
 * Includes professional templates and error handling.
 */

const sgMail = require('@sendgrid/mail');
const logger = require('../config/logging').logger;

class EmailService {
  constructor() {
    // Initialize SendGrid only if API key is configured
    if (process.env.SENDGRID_API_KEY) {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      this.enabled = true;
      logger.info('EmailService: SendGrid initialized');
    } else {
      this.enabled = false;
      logger.warn('EmailService: SENDGRID_API_KEY not configured, email sending disabled');
    }

    this.fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@healthcaresurgicalmart.com';
  }

  /**
   * Check if email service is enabled
   * @returns {boolean} Service status
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Generate HTML template for password reset email
   * @param {string} resetCode - 6-digit reset code
   * @param {number} expiryMinutes - Code expiry time in minutes
   * @returns {string} HTML content
   */
  generatePasswordResetHTML(resetCode, expiryMinutes = 15) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .container {
      background-color: #f9f9f9;
      border-radius: 8px;
      padding: 30px;
      border: 1px solid #e0e0e0;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .logo {
      font-size: 24px;
      font-weight: bold;
      color: #2196F3;
      margin-bottom: 10px;
    }
    .code-box {
      background-color: #fff;
      border: 2px solid #2196F3;
      border-radius: 6px;
      padding: 20px;
      text-align: center;
      margin: 30px 0;
    }
    .code {
      font-size: 32px;
      font-weight: bold;
      color: #2196F3;
      letter-spacing: 8px;
      font-family: 'Courier New', monospace;
    }
    .warning {
      background-color: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 12px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      font-size: 12px;
      color: #666;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background-color: #2196F3;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🏥 Health Care Surgical Mart</div>
      <h2 style="margin: 0; color: #333;">Password Reset Request</h2>
    </div>
    
    <p>Hello,</p>
    
    <p>We received a request to reset your password for your Health Care Surgical Mart POS account.</p>
    
    <div class="code-box">
      <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">Your reset code is:</p>
      <div class="code">${resetCode}</div>
      <p style="margin: 10px 0 0 0; font-size: 12px; color: #666;">Valid for ${expiryMinutes} minutes</p>
    </div>
    
    <p><strong>How to reset your password:</strong></p>
    <ol>
      <li>Return to the password reset page</li>
      <li>Enter the code above</li>
      <li>Create your new password</li>
    </ol>
    
    <div class="warning">
      <strong>⚠️ Security Notice:</strong><br>
      • Do not share this code with anyone<br>
      • This code expires in ${expiryMinutes} minutes<br>
      • If you didn't request this reset, please ignore this email
    </div>
    
    <p>If you have any questions or concerns, please contact your system administrator.</p>
    
    <div class="footer">
      <p>This is an automated message from Health Care Surgical Mart POS System.</p>
      <p>© ${new Date().getFullYear()} Health Care Surgical Mart. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Generate plain text version for password reset
   * @param {string} resetCode - 6-digit reset code
   * @param {number} expiryMinutes - Code expiry time in minutes
   * @returns {string} Plain text content
   */
  generatePasswordResetText(resetCode, expiryMinutes = 15) {
    return `
Health Care Surgical Mart - Password Reset Request

Your password reset code is: ${resetCode}

This code is valid for ${expiryMinutes} minutes.

How to reset your password:
1. Return to the password reset page
2. Enter the code above
3. Create your new password

SECURITY NOTICE:
• Do not share this code with anyone
• This code expires in ${expiryMinutes} minutes
• If you didn't request this reset, please ignore this email

If you have any questions, please contact your system administrator.

---
This is an automated message from Health Care Surgical Mart POS System.
© ${new Date().getFullYear()} Health Care Surgical Mart. All rights reserved.
    `.trim();
  }

  /**
   * Send password reset email
   * @param {string} to - Recipient email address
   * @param {string} resetCode - 6-digit reset code
   * @param {number} expiryMinutes - Code expiry time in minutes
   * @returns {Promise<boolean>} Success status
   */
  async sendPasswordResetEmail(to, resetCode, expiryMinutes = 15) {
    if (!this.enabled) {
      logger.warn('EmailService: Cannot send email, service not enabled');

      // In development, log the code to console
      if (process.env.NODE_ENV === 'development') {
        logger.info('═══════════════════════════════════════════');
        logger.info('📧 [DEV MODE] PASSWORD RESET EMAIL');
        logger.info('═══════════════════════════════════════════');
        logger.info(`To: ${to}`);
        logger.info(`Reset Code: ${resetCode}`);
        logger.info(`Valid for: ${expiryMinutes} minutes`);
        logger.info('═══════════════════════════════════════════');
      }

      return false;
    }

    try {
      const msg = {
        to,
        from: {
          email: this.fromEmail,
          name: 'Health Care Surgical Mart'
        },
        subject: 'Password Reset Code - Health Care Surgical Mart',
        text: this.generatePasswordResetText(resetCode, expiryMinutes),
        html: this.generatePasswordResetHTML(resetCode, expiryMinutes),
        // Add tracking settings
        trackingSettings: {
          clickTracking: {
            enable: false
          },
          openTracking: {
            enable: false
          }
        },
        // Add categories for analytics
        categories: ['password-reset']
      };

      const response = await sgMail.send(msg);

      logger.info(`EmailService: Password reset email sent to ${to} (Status: ${response[0].statusCode})`);
      return true;

    } catch (error) {
      logger.error('EmailService: Failed to send password reset email:', {
        to,
        error: error.message,
        code: error.code,
        response: error.response?.body
      });

      // In development, still log the code as fallback
      if (process.env.NODE_ENV === 'development') {
        logger.info('═══════════════════════════════════════════');
        logger.info('📧 [DEV MODE] EMAIL FAILED - PASSWORD RESET CODE');
        logger.info('═══════════════════════════════════════════');
        logger.info(`To: ${to}`);
        logger.info(`Reset Code: ${resetCode}`);
        logger.info(`Valid for: ${expiryMinutes} minutes`);
        logger.info('═══════════════════════════════════════════');
      }

      return false;
    }
  }

  /**
   * Send invoice email to customer
   * @param {string} to - Customer email
   * @param {object} invoiceData - Invoice details
   * @returns {Promise<boolean>} Success status
   */
  async sendInvoiceEmail(to, invoiceData) {
    if (!this.enabled) {
      logger.warn('EmailService: Cannot send invoice email, service not enabled');
      return false;
    }

    try {
      const msg = {
        to,
        from: {
          email: this.fromEmail,
          name: 'Health Care Surgical Mart'
        },
        subject: `Invoice #${invoiceData.invoiceNo} - Health Care Surgical Mart`,
        text: `Your invoice #${invoiceData.invoiceNo} is ready. Total: Tk ${invoiceData.totalAmount}`,
        html: `
          <h2>Invoice #${invoiceData.invoiceNo}</h2>
          <p>Thank you for your purchase!</p>
          <p><strong>Total Amount:</strong> Tk ${invoiceData.totalAmount}</p>
          <p>If you have any questions, please contact us.</p>
        `,
        categories: ['invoice']
      };

      await sgMail.send(msg);
      logger.info(`EmailService: Invoice email sent to ${to}`);
      return true;

    } catch (error) {
      logger.error('EmailService: Failed to send invoice email:', error);
      return false;
    }
  }

  /**
   * Get service statistics
   * @returns {object} Service stats
   */
  getStats() {
    return {
      enabled: this.enabled,
      fromEmail: this.fromEmail,
      provider: 'SendGrid'
    };
  }
}

// Export singleton instance
module.exports = new EmailService();
