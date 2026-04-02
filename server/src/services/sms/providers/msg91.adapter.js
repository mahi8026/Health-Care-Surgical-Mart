// server/src/services/sms/providers/msg91.adapter.js
const axios = require("axios");

class MSG91Adapter {
  constructor() {
    this.apiKey = process.env.MSG91_API_KEY;
    this.senderId = process.env.MSG91_SENDER_ID;
    this.baseURL = "https://api.msg91.com/api";
  }

  async sendSMS(to, message, options = {}) {
    try {
      const response = await axios.post(`${this.baseURL}/sendhttp.php`, {
        authkey: this.apiKey,
        mobiles: to,
        message: message,
        sender: this.senderId,
        route: options.route || "4", // Transactional
        country: options.country || "91",
        DLT_TE_ID: options.templateId, // DLT template ID (India)
      });

      return {
        success: true,
        messageId: response.data.message_id,
        status: "queued",
        provider: "msg91",
        cost: this.calculateCost(message),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        provider: "msg91",
      };
    }
  }

  async getDeliveryStatus(messageId) {
    const response = await axios.get(
      `${this.baseURL}/status.php?authkey=${this.apiKey}&msg_id=${messageId}`,
    );
    return {
      status: response.data.status,
      deliveredAt: response.data.delivered_at,
    };
  }

  calculateCost(message) {
    // MSG91 pricing (India)
    const basePrice = 0.0015; // ₹0.10 per SMS (~$0.0015)
    const segments = Math.ceil(message.length / 160);
    return basePrice * segments;
  }
}

module.exports = MSG91Adapter;
