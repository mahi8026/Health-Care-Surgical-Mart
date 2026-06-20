// server/src/services/email/providers/sendgrid.adapter.js
const sgMail = require('@sendgrid/mail');
const BaseEmailAdapter = require('./base.adapter');

class SendGridAdapter extends BaseEmailAdapter {
  constructor() {
    super();
    const apiKey = process.env.SENDGRID_API_KEY;
    if (apiKey && apiKey.startsWith('SG.')) {
      sgMail.setApiKey(apiKey);
      this.configured = true;
    } else {
      this.configured = false;
      if (apiKey) {
        // Key is set but malformed — warn so it's visible in logs
        console.warn(
          "[SendGrid] SENDGRID_API_KEY is set but does not start with 'SG.' — email sending will be disabled."
        );
      }
    }
    this.fromEmail = process.env.SENDGRID_FROM_EMAIL;
    this.fromName =
      process.env.SENDGRID_FROM_NAME || 'Healthcare Plus Pharmacy';
  }

  async sendEmail(to, subject, content, options = {}) {
    if (!this.configured) {
      return {
        success: false,
        error: "SendGrid is not configured. Set a valid SENDGRID_API_KEY (must start with 'SG.').",
        provider: 'sendgrid',
        status: 'not_configured',
      };
    }
    if (!this.validateEmail(to)) {
      return {
        success: false,
        error: 'Invalid email address',
        provider: 'sendgrid',
      };
    }

    try {
      const msg = {
        to: to,
        from: {
          email: this.fromEmail,
          name: this.fromName,
        },
        subject: subject,
        html: content,
        text: options.textContent,
        templateId: options.templateId,
        dynamicTemplateData: options.templateData,
        attachments: options.attachments,
        categories: options.categories || ['transactional'],
        customArgs: {
          shopId: options.shopId,
          orderId: options.orderId,
        },
      };

      const result = await sgMail.send(msg);

      return {
        success: true,
        messageId: result[0].headers['x-message-id'],
        provider: 'sendgrid',
        status: 'sent',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        provider: 'sendgrid',
      };
    }
  }

  async sendBulk(emails) {
    if (!this.configured) {
      return {
        success: false,
        error: "SendGrid is not configured. Set a valid SENDGRID_API_KEY (must start with 'SG.').",
        provider: 'sendgrid',
        status: 'not_configured',
      };
    }
    try {
      const messages = emails.map((email) => ({
        to: email.to,
        from: {
          email: this.fromEmail,
          name: this.fromName,
        },
        subject: email.subject,
        html: email.content,
        categories: ['bulk', 'marketing'],
      }));

      const result = await sgMail.send(messages);

      return {
        success: true,
        sent: result.length,
        provider: 'sendgrid',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        provider: 'sendgrid',
      };
    }
  }

  async getEmailStats(messageId) {
    // SendGrid Event Webhook provides delivery stats
    // This queries the webhook data stored in DB
    const { getShopDatabase } = require('../../config/database');
    const db = getShopDatabase('main_store');

    const events = await db
      .collection('email_events')
      .find({ messageId })
      .toArray();

    return {
      delivered: events.some((e) => e.event === 'delivered'),
      opened: events.some((e) => e.event === 'open'),
      clicked: events.some((e) => e.event === 'click'),
      bounced: events.some((e) => e.event === 'bounce'),
      events: events,
    };
  }
}

module.exports = SendGridAdapter;
