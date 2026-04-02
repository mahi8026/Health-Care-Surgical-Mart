// server/src/services/sms/providers/twilio.adapter.js
const twilio = require("twilio");

class TwilioAdapter {
  constructor() {
    this.client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN,
    );
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER;
  }

  async sendSMS(to, message, options = {}) {
    try {
      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: to,
        statusCallback: options.statusCallback,
        validityPeriod: options.validityPeriod || 3600,
      });

      return {
        success: true,
        messageId: result.sid,
        status: result.status,
        provider: "twilio",
        cost: this.calculateCost(result),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        provider: "twilio",
      };
    }
  }

  async getDeliveryStatus(messageId) {
    const message = await this.client.messages(messageId).fetch();
    return {
      status: message.status,
      errorCode: message.errorCode,
      errorMessage: message.errorMessage,
      dateUpdated: message.dateUpdated,
    };
  }

  calculateCost(result) {
    // Twilio pricing logic
    const basePrice = 0.0075; // $0.0075 per SMS
    const segments = Math.ceil(result.body.length / 160);
    return basePrice * segments;
  }
}

module.exports = TwilioAdapter;
