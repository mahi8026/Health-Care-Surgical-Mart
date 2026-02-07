/**
 * Notification Service
 * Handles SMS, WhatsApp, and Email notifications
 */

const nodemailer = require("nodemailer");
const { logger } = require("../config/logging");

class NotificationService {
  constructor() {
    this.emailTransporter = null;
    this.initializeEmailTransporter();
  }

  /**
   * Initialize email transporter
   */
  initializeEmailTransporter() {
    try {
      if (
        process.env.EMAIL_HOST &&
        process.env.EMAIL_USER &&
        process.env.EMAIL_PASSWORD
      ) {
        this.emailTransporter = nodemailer.createTransport({
          host: process.env.EMAIL_HOST,
          port: parseInt(process.env.EMAIL_PORT) || 587,
          secure: process.env.EMAIL_SECURE === "true",
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD,
          },
        });

        logger.info("Email transporter initialized successfully");
      } else {
        logger.warn(
          "Email configuration not found, email notifications disabled",
        );
      }
    } catch (error) {
      logger.error("Failed to initialize email transporter:", error);
    }
  }

  /**
   * Send Email
   */
  async sendEmail({ to, subject, html, text, attachments = [] }) {
    try {
      if (!this.emailTransporter) {
        logger.warn("Email transporter not configured");
        return { success: false, message: "Email service not configured" };
      }

      const mailOptions = {
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to,
        subject,
        html,
        text,
        attachments,
      };

      const info = await this.emailTransporter.sendMail(mailOptions);

      logger.info(`Email sent successfully to ${to}`, {
        messageId: info.messageId,
      });

      return {
        success: true,
        messageId: info.messageId,
        message: "Email sent successfully",
      };
    } catch (error) {
      logger.error("Failed to send email:", error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Send SMS (Twilio or local gateway)
   */
  async sendSMS({ to, message }) {
    try {
      // Check if SMS is enabled
      if (process.env.ENABLE_SMS_NOTIFICATIONS !== "true") {
        logger.info("SMS notifications are disabled");
        return { success: false, message: "SMS notifications disabled" };
      }

      // Twilio implementation
      if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        return await this.sendTwilioSMS(to, message);
      }

      // Custom SMS gateway implementation
      if (process.env.SMS_API_KEY) {
        return await this.sendCustomSMS(to, message);
      }

      logger.warn("No SMS gateway configured");
      return { success: false, message: "SMS gateway not configured" };
    } catch (error) {
      logger.error("Failed to send SMS:", error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Send SMS via Twilio
   */
  async sendTwilioSMS(to, message) {
    try {
      const twilio = require("twilio");
      const client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN,
      );

      const result = await client.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: to,
      });

      logger.info(`SMS sent via Twilio to ${to}`, { sid: result.sid });

      return {
        success: true,
        messageId: result.sid,
        message: "SMS sent successfully",
      };
    } catch (error) {
      logger.error("Twilio SMS error:", error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Send SMS via custom gateway (Bangladesh local providers)
   */
  async sendCustomSMS(to, message) {
    try {
      const axios = require("axios");

      // Example for Bangladesh SMS gateways (adjust based on your provider)
      const response = await axios.post(
        process.env.SMS_GATEWAY_URL || "https://api.smsgateway.com/send",
        {
          api_key: process.env.SMS_API_KEY,
          api_secret: process.env.SMS_API_SECRET,
          sender_id: process.env.SMS_SENDER_ID || "HealthCare",
          phone: to,
          message: message,
        },
      );

      logger.info(`SMS sent via custom gateway to ${to}`);

      return {
        success: true,
        messageId: response.data.message_id,
        message: "SMS sent successfully",
      };
    } catch (error) {
      logger.error("Custom SMS gateway error:", error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Send WhatsApp message (Twilio WhatsApp API)
   */
  async sendWhatsApp({ to, message, mediaUrl = null }) {
    try {
      // Check if WhatsApp is enabled
      if (process.env.ENABLE_WHATSAPP_NOTIFICATIONS !== "true") {
        logger.info("WhatsApp notifications are disabled");
        return { success: false, message: "WhatsApp notifications disabled" };
      }

      if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
        logger.warn("Twilio credentials not configured for WhatsApp");
        return { success: false, message: "WhatsApp service not configured" };
      }

      const twilio = require("twilio");
      const client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN,
      );

      const messageOptions = {
        body: message,
        from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
        to: `whatsapp:${to}`,
      };

      if (mediaUrl) {
        messageOptions.mediaUrl = [mediaUrl];
      }

      const result = await client.messages.create(messageOptions);

      logger.info(`WhatsApp message sent to ${to}`, { sid: result.sid });

      return {
        success: true,
        messageId: result.sid,
        message: "WhatsApp message sent successfully",
      };
    } catch (error) {
      logger.error("WhatsApp message error:", error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Send sale confirmation notification
   */
  async sendSaleConfirmation(sale, customer, settings) {
    const notifications = [];

    try {
      // Email notification
      if (settings.emailNotifications && customer.email) {
        const emailResult = await this.sendEmail({
          to: customer.email,
          subject: `Order Confirmation - Invoice #${sale.invoiceNo}`,
          html: this.getSaleConfirmationEmailTemplate(sale, customer),
        });
        notifications.push({ type: "email", ...emailResult });
      }

      // SMS notification
      if (settings.smsNotifications && customer.phone) {
        const smsMessage = `Thank you for your purchase! Invoice #${sale.invoiceNo}. Total: BDT ${sale.grandTotal}. - Health Care Surgical Mart`;
        const smsResult = await this.sendSMS({
          to: customer.phone,
          message: smsMessage,
        });
        notifications.push({ type: "sms", ...smsResult });
      }

      // WhatsApp notification
      if (settings.whatsappNotifications && customer.phone) {
        const whatsappMessage = `🏥 *Health Care Surgical Mart*\n\nThank you for your purchase!\n\n📋 Invoice: #${sale.invoiceNo}\n💰 Total: BDT ${sale.grandTotal}\n📅 Date: ${new Date(sale.saleDate).toLocaleDateString()}\n\nWe appreciate your business!`;
        const whatsappResult = await this.sendWhatsApp({
          to: customer.phone,
          message: whatsappMessage,
        });
        notifications.push({ type: "whatsapp", ...whatsappResult });
      }

      return {
        success: true,
        notifications,
      };
    } catch (error) {
      logger.error("Failed to send sale confirmation:", error);
      return {
        success: false,
        message: error.message,
        notifications,
      };
    }
  }

  /**
   * Send low stock alert
   */
  async sendLowStockAlert(products, recipients, settings) {
    const notifications = [];

    try {
      const productList = products
        .map(
          (p) =>
            `- ${p.name} (SKU: ${p.sku}): ${p.stockQuantity} ${p.unit} remaining`,
        )
        .join("\n");

      // Email notification
      if (settings.emailNotifications) {
        for (const recipient of recipients) {
          if (recipient.email) {
            const emailResult = await this.sendEmail({
              to: recipient.email,
              subject: `⚠️ Low Stock Alert - ${products.length} Products`,
              html: this.getLowStockEmailTemplate(products),
            });
            notifications.push({
              type: "email",
              recipient: recipient.email,
              ...emailResult,
            });
          }
        }
      }

      // SMS notification
      if (settings.smsNotifications) {
        for (const recipient of recipients) {
          if (recipient.phone) {
            const smsMessage = `Low Stock Alert: ${products.length} products need restocking. Check your dashboard for details. - Health Care Surgical Mart`;
            const smsResult = await this.sendSMS({
              to: recipient.phone,
              message: smsMessage,
            });
            notifications.push({
              type: "sms",
              recipient: recipient.phone,
              ...smsResult,
            });
          }
        }
      }

      return {
        success: true,
        notifications,
      };
    } catch (error) {
      logger.error("Failed to send low stock alert:", error);
      return {
        success: false,
        message: error.message,
        notifications,
      };
    }
  }

  /**
   * Send payment reminder
   */
  async sendPaymentReminder(customer, dueAmount, dueDate, settings) {
    const notifications = [];

    try {
      // Email notification
      if (settings.emailNotifications && customer.email) {
        const emailResult = await this.sendEmail({
          to: customer.email,
          subject: `Payment Reminder - BDT ${dueAmount} Due`,
          html: this.getPaymentReminderEmailTemplate(
            customer,
            dueAmount,
            dueDate,
          ),
        });
        notifications.push({ type: "email", ...emailResult });
      }

      // SMS notification
      if (settings.smsNotifications && customer.phone) {
        const smsMessage = `Payment Reminder: BDT ${dueAmount} is due on ${new Date(dueDate).toLocaleDateString()}. Please make payment at your earliest convenience. - Health Care Surgical Mart`;
        const smsResult = await this.sendSMS({
          to: customer.phone,
          message: smsMessage,
        });
        notifications.push({ type: "sms", ...smsResult });
      }

      return {
        success: true,
        notifications,
      };
    } catch (error) {
      logger.error("Failed to send payment reminder:", error);
      return {
        success: false,
        message: error.message,
        notifications,
      };
    }
  }

  /**
   * Send promotional message
   */
  async sendPromotionalMessage(recipients, message, settings) {
    const notifications = [];

    try {
      for (const recipient of recipients) {
        // Email
        if (settings.emailNotifications && recipient.email) {
          const emailResult = await this.sendEmail({
            to: recipient.email,
            subject:
              message.subject || "Special Offer from Health Care Surgical Mart",
            html: this.getPromotionalEmailTemplate(message),
          });
          notifications.push({
            type: "email",
            recipient: recipient.email,
            ...emailResult,
          });
        }

        // SMS
        if (settings.smsNotifications && recipient.phone) {
          const smsResult = await this.sendSMS({
            to: recipient.phone,
            message: message.smsText || message.text,
          });
          notifications.push({
            type: "sms",
            recipient: recipient.phone,
            ...smsResult,
          });
        }

        // WhatsApp
        if (settings.whatsappNotifications && recipient.phone) {
          const whatsappResult = await this.sendWhatsApp({
            to: recipient.phone,
            message: message.whatsappText || message.text,
          });
          notifications.push({
            type: "whatsapp",
            recipient: recipient.phone,
            ...whatsappResult,
          });
        }
      }

      return {
        success: true,
        notifications,
        totalSent: notifications.filter((n) => n.success).length,
        totalFailed: notifications.filter((n) => !n.success).length,
      };
    } catch (error) {
      logger.error("Failed to send promotional message:", error);
      return {
        success: false,
        message: error.message,
        notifications,
      };
    }
  }

  /**
   * Email Templates
   */

  getSaleConfirmationEmailTemplate(sale, customer) {
    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(to right, #166534, #86efac); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .invoice-details { background: white; padding: 15px; margin: 15px 0; border-radius: 8px; }
    .footer { background: #374151; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; }
    .button { background: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 10px 0; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    th, td { padding: 8px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f3f4f6; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🏥 Health Care Surgical Mart</h1>
      <p>Order Confirmation</p>
    </div>
    
    <div class="content">
      <h2>Thank you for your purchase, ${customer.name}!</h2>
      <p>Your order has been confirmed and is being processed.</p>
      
      <div class="invoice-details">
        <h3>Order Details</h3>
        <p><strong>Invoice Number:</strong> ${sale.invoiceNo}</p>
        <p><strong>Date:</strong> ${new Date(sale.saleDate).toLocaleDateString()}</p>
        <p><strong>Total Amount:</strong> BDT ${sale.grandTotal.toFixed(2)}</p>
        <p><strong>Payment Status:</strong> ${sale.paymentStatus || "Paid"}</p>
      </div>
      
      <h3>Items Purchased</h3>
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Qty</th>
            <th>Price</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${sale.items
            .map(
              (item) => `
            <tr>
              <td>${item.name || item.productName}</td>
              <td>${item.quantity || item.qty}</td>
              <td>BDT ${(item.saleRate || item.rate).toFixed(2)}</td>
              <td>BDT ${item.total.toFixed(2)}</td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
      
      <p style="margin-top: 20px;">If you have any questions about your order, please don't hesitate to contact us.</p>
      
      <a href="#" class="button">View Invoice</a>
    </div>
    
    <div class="footer">
      <p><strong>Health Care Surgical Mart</strong></p>
      <p>A Trust Medical Equipment Company</p>
      <p>📞 Contact: ${process.env.SHOP_PHONE || "N/A"} | 📧 Email: ${process.env.SHOP_EMAIL || "N/A"}</p>
      <p style="margin-top: 10px; font-size: 10px;">This is an automated email. Please do not reply.</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  getLowStockEmailTemplate(products) {
    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .alert-box { background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 15px 0; }
    .footer { background: #374151; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    th, td { padding: 8px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f3f4f6; font-weight: bold; }
    .low-stock { color: #dc2626; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠️ Low Stock Alert</h1>
      <p>Immediate Action Required</p>
    </div>
    
    <div class="content">
      <div class="alert-box">
        <h3>⚠️ ${products.length} Products Need Restocking</h3>
        <p>The following products have reached or fallen below their minimum stock levels.</p>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>SKU</th>
            <th>Current Stock</th>
            <th>Min Level</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${products
            .map(
              (product) => `
            <tr>
              <td>${product.name}</td>
              <td>${product.sku}</td>
              <td class="low-stock">${product.stockQuantity} ${product.unit}</td>
              <td>${product.minStockLevel} ${product.unit}</td>
              <td>${product.stockQuantity === 0 ? "❌ Out of Stock" : "⚠️ Low Stock"}</td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
      
      <p style="margin-top: 20px;"><strong>Action Required:</strong> Please reorder these products as soon as possible to avoid stockouts.</p>
    </div>
    
    <div class="footer">
      <p><strong>Health Care Surgical Mart</strong></p>
      <p>Inventory Management System</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  getPaymentReminderEmailTemplate(customer, dueAmount, dueDate) {
    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #f97316; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .reminder-box { background: #fff7ed; border-left: 4px solid #f97316; padding: 15px; margin: 15px 0; }
    .footer { background: #374151; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; }
    .amount { font-size: 24px; font-weight: bold; color: #f97316; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💰 Payment Reminder</h1>
    </div>
    
    <div class="content">
      <h2>Dear ${customer.name},</h2>
      
      <div class="reminder-box">
        <p>This is a friendly reminder that you have an outstanding payment:</p>
        <p class="amount">BDT ${dueAmount.toFixed(2)}</p>
        <p><strong>Due Date:</strong> ${new Date(dueDate).toLocaleDateString()}</p>
      </div>
      
      <p>Please make the payment at your earliest convenience to avoid any service interruption.</p>
      
      <h3>Payment Methods:</h3>
      <ul>
        <li>💵 Cash payment at our store</li>
        <li>🏦 Bank transfer</li>
        <li>📱 bKash/Nagad</li>
      </ul>
      
      <p>If you have already made the payment, please disregard this reminder.</p>
      
      <p>Thank you for your business!</p>
    </div>
    
    <div class="footer">
      <p><strong>Health Care Surgical Mart</strong></p>
      <p>📞 Contact: ${process.env.SHOP_PHONE || "N/A"} | 📧 Email: ${process.env.SHOP_EMAIL || "N/A"}</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  getPromotionalEmailTemplate(message) {
    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(to right, #166534, #86efac); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .promo-box { background: white; border: 2px solid #16a34a; padding: 20px; margin: 15px 0; border-radius: 8px; text-align: center; }
    .footer { background: #374151; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; }
    .button { background: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 10px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 ${message.title || "Special Offer"}</h1>
    </div>
    
    <div class="content">
      <div class="promo-box">
        ${message.html || `<p>${message.text}</p>`}
      </div>
      
      ${message.buttonText ? `<a href="${message.buttonUrl || "#"}" class="button">${message.buttonText}</a>` : ""}
      
      <p style="margin-top: 20px; font-size: 12px; color: #666;">
        ${message.disclaimer || "Offer valid while stocks last. Terms and conditions apply."}
      </p>
    </div>
    
    <div class="footer">
      <p><strong>Health Care Surgical Mart</strong></p>
      <p>A Trust Medical Equipment Company</p>
    </div>
  </div>
</body>
</html>
    `;
  }
}

// Export singleton instance
module.exports = new NotificationService();
