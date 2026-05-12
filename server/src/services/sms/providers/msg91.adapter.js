// server/src/services/sms/providers/msg91.adapter.js
const axios = require("axios");
const { logger } = require("../../../config/logging");

class MSG91Adapter {
  constructor() {
    this.apiKey = process.env.MSG91_API_KEY;
    this.senderId = process.env.MSG91_SENDER_ID;
    this.baseURL = "https://api.msg91.com/api";
    
    if (!this.apiKey || !this.senderId) {
      logger.warn("MSG91 SMS provider not configured", {
        file: "msg91.adapter.js",
        function: "constructor",
        message: "Please set MSG91_API_KEY and MSG91_SENDER_ID in .env",
      });
    }
  }

  async sendSMS(to, message, options = {}) {
    if (!this.apiKey || !this.senderId) {
      return {
        success: false,
        error: "MSG91 SMS provider is not configured. Please set MSG91_API_KEY and MSG91_SENDER_ID in your environment variables.",
        provider: "msg91",
      };
    }

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
