// server/src/services/sms/sms.service.js
const TwilioAdapter = require("./providers/twilio.adapter");
const MSG91Adapter = require("./providers/msg91.adapter");
const { validatePhoneNumber } = require("./sms.validator");

class SMSService {
  constructor() {
    this.providers = {
      twilio: new TwilioAdapter(),
      msg91: new MSG91Adapter(),
    };
    this.defaultProvider = process.env.SMS_DEFAULT_PROVIDER || "twilio";

    // Lazy-loaded to avoid circular dependency issues at startup
    // (SMSQueue and SMSTemplate are created in tasks 2.2 and 2.3)
    this._queue = null;
    this._template = null;
  }

  get queue() {
    if (!this._queue) {
      const SMSQueue = require("./sms.queue");
      this._queue = new SMSQueue();
    }
    return this._queue;
  }

  get template() {
    if (!this._template) {
      const SMSTemplate = require("./sms.template");
      this._template = new SMSTemplate();
    }
    return this._template;
  }

  /**
   * Send a transactional SMS using a named template.
   * @param {string} to - Recipient phone number (E.164)
   * @param {string} templateName - Template identifier
   * @param {object} variables - Template variable substitutions
   */
  async sendTransactionalSMS(to, templateName, variables) {
    const tmpl = await this.template.get(templateName);
    const message = this.template.render(tmpl, variables);

    if (!validatePhoneNumber(to)) {
      throw new Error("Invalid phone number");
    }

    if (await this.isDND(to)) {
      console.log(`Number ${to} is on DND list, skipping promotional SMS`);
      return { success: false, reason: "DND" };
    }

    return await this.send(to, message, {
      type: "transactional",
      templateId: tmpl.dltId,
    });
  }

  /**
   * Queue a bulk SMS send to multiple recipients.
   * @param {string[]} recipients - Array of E.164 phone numbers
   * @param {string} message - SMS body
   * @param {object} options
   */
  async sendBulkSMS(recipients, message, options = {}) {
    const jobs = recipients.map((to) => ({
      to,
      message,
      options: { ...options, type: "promotional" },
    }));

    await this.queue.addBulk(jobs);

    return {
      success: true,
      queued: jobs.length,
      estimatedTime: jobs.length * 0.5, // 0.5 seconds per SMS
    };
  }

  /**
   * Send an OTP message immediately.
   * @param {string} phoneNumber - E.164 phone number
   * @param {string|number} otp - One-time password
   */
  async sendOTP(phoneNumber, otp) {
    const message = `Your OTP is ${otp}. Valid for 10 minutes. Do not share with anyone.`;

    return await this.send(phoneNumber, message, {
      type: "transactional",
      validityPeriod: 600, // 10 minutes in seconds
    });
  }

  /**
   * Core send method — selects provider, dispatches SMS, and logs result.
   * @param {string} to - E.164 phone number
   * @param {string} message - SMS body
   * @param {object} options
   */
  async send(to, message, options = {}) {
    const providerName = options.provider || this.defaultProvider;
    const adapter = this.providers[providerName];

    if (!adapter) {
      throw new Error(`Provider ${providerName} not found`);
    }

    const result = await adapter.sendSMS(to, message, options);

    await this.logSMS({
      recipient: to,
      message,
      provider: providerName,
      status: result.status,
      messageId: result.messageId,
      cost: result.cost,
      type: options.type || "transactional",
      shopId: options.shopId,
    });

    return result;
  }

  /**
   * Validate a phone number against E.164 format.
   * @param {string} phone
   * @returns {boolean}
   */
  validatePhoneNumber(phone) {
    return validatePhoneNumber(phone);
  }

  /**
   * Check whether a number is on the DND (Do Not Disturb) registry.
   * Stub — always returns false until TRAI DND API integration is added.
   * @param {string} phoneNumber
   * @returns {Promise<boolean>}
   */
  async isDND(phoneNumber) {
    // TODO: integrate with TRAI DND API for India
    return false;
  }

  /**
   * Persist an SMS log entry to the shop database.
   * @param {object} data
   */
  async logSMS(data) {
    const { getShopDatabase } = require("../../config/database");
    const db = getShopDatabase(data.shopId || "main_store");

    await db.collection("sms_logs").insertOne({
      ...data,
      createdAt: new Date(),
    });
  }

  /**
   * Fetch delivery status from the originating provider.
   * @param {string} messageId - Provider message ID
   * @param {string} provider - Provider name
   */
  async getDeliveryStatus(messageId, provider) {
    const adapter = this.providers[provider];
    if (!adapter) {
      throw new Error(`Provider ${provider} not found`);
    }
    return await adapter.getDeliveryStatus(messageId);
  }
}

module.exports = new SMSService();
