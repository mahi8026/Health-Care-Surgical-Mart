# Third-Party Integrations & API - Design Document

## 1. System Architecture Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Client Applications                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   POS Web    │  │  Admin Panel │  │   Mobile App │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
└─────────┼──────────────────┼──────────────────┼─────────────────┘
          │                  │                  │
          └──────────────────┼──────────────────┘
                             │
                    ┌────────▼────────┐
                    │   API Gateway   │
                    │   (Express.js)  │
                    └────────┬────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
┌─────────▼─────────┐ ┌─────▼──────┐ ┌────────▼────────┐
│  Communication    │ │ Accounting │ │   Public API    │
│    Services       │ │ Integration│ │    Service      │
│  (SMS/Email)      │ │  Service   │ │                 │
└─────────┬─────────┘ └─────┬──────┘ └────────┬────────┘
          │                  │                  │
          └──────────────────┼──────────────────┘
                             │
                    ┌────────▼────────┐
                    │  Message Queue  │
                    │  (Bull/Redis)   │
                    └────────┬────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
┌─────────▼─────────┐ ┌─────▼──────┐ ┌────────▼────────┐
│   SMS Providers   │ │   Email    │ │    MongoDB      │
│ (Twilio, MSG91)   │ │ Providers  │ │   (Logs/Data)   │
│                   │ │ (SendGrid) │ │                 │
└───────────────────┘ └────────────┘ └─────────────────┘
```

### 1.2 Technology Stack

**Backend:**

- Node.js/Express - Main API server
- Bull - Job queue for async processing
- Redis - Queue storage and caching
- MongoDB - Data persistence

**Communication Services:**

- Twilio - SMS provider (primary)
- MSG91 - SMS provider (backup)
- SendGrid - Email delivery
- Mailchimp - Email marketing campaigns

**Infrastructure:**

- Docker - Containerization
- PM2 - Process management
- Winston - Logging
- Prometheus - Metrics

## 2. SMS Gateway Integration Design

### 2.1 SMS Service Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SMS Service Layer                         │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   SMS API    │  │   Template   │  │   Provider   │     │
│  │  Controller  │─▶│   Manager    │─▶│   Selector   │     │
│  └──────────────┘  └──────────────┘  └──────┬───────┘     │
│                                              │             │
│         ┌────────────────────────────────────┘             │
│         │                                                   │
│  ┌──────▼───────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Twilio     │  │    MSG91     │  │   AWS SNS    │     │
│  │   Adapter    │  │   Adapter    │  │   Adapter    │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
          └──────────────────┼──────────────────┘
                             │
                    ┌────────▼────────┐
                    │   Bull Queue    │
                    │  (SMS Jobs)     │
                    └─────────────────┘
```

### 2.2 SMS Provider Adapters

#### 2.2.1 Twilio Adapter

```javascript
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
```

#### 2.2.2 MSG91 Adapter

```javascript
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
```

### 2.3 SMS Service Manager

```javascript
// server/src/services/sms/sms.service.js
const TwilioAdapter = require("./providers/twilio.adapter");
const MSG91Adapter = require("./providers/msg91.adapter");
const SMSQueue = require("./sms.queue");
const SMSTemplate = require("./sms.template");

class SMSService {
  constructor() {
    this.providers = {
      twilio: new TwilioAdapter(),
      msg91: new MSG91Adapter(),
    };
    this.queue = new SMSQueue();
    this.template = new SMSTemplate();
    this.defaultProvider = process.env.SMS_DEFAULT_PROVIDER || "twilio";
  }

  async sendTransactionalSMS(to, templateName, variables) {
    // Get template
    const template = await this.template.get(templateName);
    const message = this.template.render(template, variables);

    // Validate phone number
    if (!this.validatePhoneNumber(to)) {
      throw new Error("Invalid phone number");
    }

    // Check DND status (India specific)
    if (await this.isDND(to)) {
      console.log(`Number ${to} is on DND list, skipping promotional SMS`);
      return { success: false, reason: "DND" };
    }

    // Send immediately (transactional)
    return await this.send(to, message, {
      type: "transactional",
      templateId: template.dltId,
    });
  }

  async sendBulkSMS(recipients, message, options = {}) {
    // Add to queue for bulk processing
    const jobs = recipients.map((to) => ({
      to,
      message,
      options: {
        ...options,
        type: "promotional",
      },
    }));

    await this.queue.addBulk(jobs);

    return {
      success: true,
      queued: jobs.length,
      estimatedTime: jobs.length * 0.5, // 0.5 seconds per SMS
    };
  }

  async send(to, message, options = {}) {
    const provider = options.provider || this.defaultProvider;
    const adapter = this.providers[provider];

    if (!adapter) {
      throw new Error(`Provider ${provider} not found`);
    }

    // Send SMS
    const result = await adapter.sendSMS(to, message, options);

    // Log to database
    await this.logSMS({
      recipient: to,
      message,
      provider,
      status: result.status,
      messageId: result.messageId,
      cost: result.cost,
      type: options.type || "transactional",
    });

    return result;
  }

  async sendOTP(phoneNumber, otp) {
    const message = `Your OTP is ${otp}. Valid for 10 minutes. Do not share with anyone.`;

    return await this.send(phoneNumber, message, {
      type: "transactional",
      validityPeriod: 600, // 10 minutes
    });
  }

  validatePhoneNumber(phone) {
    // E.164 format validation
    const regex = /^\+[1-9]\d{1,14}$/;
    return regex.test(phone);
  }

  async isDND(phoneNumber) {
    // Check against DND registry (India)
    // This would integrate with TRAI DND API
    // For now, return false
    return false;
  }

  async logSMS(data) {
    const { getShopDatabase } = require("../../config/database");
    const db = getShopDatabase(data.shopId || "main_store");

    await db.collection("sms_logs").insertOne({
      ...data,
      createdAt: new Date(),
    });
  }

  async getDeliveryStatus(messageId, provider) {
    const adapter = this.providers[provider];
    return await adapter.getDeliveryStatus(messageId);
  }
}

module.exports = new SMSService();
```

### 2.4 SMS Template Manager

```javascript
// server/src/services/sms/sms.template.js
class SMSTemplate {
  constructor() {
    this.templates = new Map();
    this.loadTemplates();
  }

  loadTemplates() {
    // Predefined templates
    this.templates.set("order_confirmation", {
      name: "order_confirmation",
      content:
        "Hi {{customerName}}, your order #{{orderNo}} has been confirmed. Total: ₹{{amount}}. Thank you!",
      variables: ["customerName", "orderNo", "amount"],
      dltId: "DLT_TEMPLATE_ID_1", // India DLT registration
      category: "transactional",
    });

    this.templates.set("order_ready", {
      name: "order_ready",
      content:
        "Hi {{customerName}}, your order #{{orderNo}} is ready for pickup at {{storeName}}.",
      variables: ["customerName", "orderNo", "storeName"],
      dltId: "DLT_TEMPLATE_ID_2",
      category: "transactional",
    });

    this.templates.set("otp", {
      name: "otp",
      content:
        "Your OTP is {{otp}}. Valid for {{validity}} minutes. Do not share.",
      variables: ["otp", "validity"],
      dltId: "DLT_TEMPLATE_ID_3",
      category: "transactional",
    });

    this.templates.set("promotional_offer", {
      name: "promotional_offer",
      content:
        "{{storeName}}: {{offerText}}. Valid till {{validTill}}. Visit us today!",
      variables: ["storeName", "offerText", "validTill"],
      dltId: "DLT_TEMPLATE_ID_4",
      category: "promotional",
    });
  }

  async get(templateName) {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template ${templateName} not found`);
    }
    return template;
  }

  render(template, variables) {
    let message = template.content;

    // Replace variables
    for (const [key, value] of Object.entries(variables)) {
      message = message.replace(`{{${key}}}`, value);
    }

    // Validate all variables replaced
    if (message.includes("{{")) {
      throw new Error("Missing template variables");
    }

    return message;
  }

  async create(templateData) {
    // Save custom template to database
    const { getShopDatabase } = require("../../config/database");
    const db = getShopDatabase(templateData.shopId);

    await db.collection("sms_templates").insertOne({
      ...templateData,
      createdAt: new Date(),
    });

    this.templates.set(templateData.name, templateData);
  }
}

module.exports = SMSTemplate;
```

### 2.5 SMS Queue Worker

```javascript
// server/src/services/sms/sms.queue.js
const Queue = require("bull");
const SMSService = require("./sms.service");

class SMSQueue {
  constructor() {
    this.queue = new Queue("sms", {
      redis: {
        host: process.env.REDIS_HOST || "localhost",
        port: process.env.REDIS_PORT || 6379,
      },
    });

    this.setupWorker();
  }

  setupWorker() {
    // Process SMS jobs
    this.queue.process(async (job) => {
      const { to, message, options } = job.data;

      try {
        const result = await SMSService.send(to, message, options);
        return result;
      } catch (error) {
        // Retry logic
        if (job.attemptsMade < 3) {
          throw error; // Will retry
        }
        return { success: false, error: error.message };
      }
    });

    // Event listeners
    this.queue.on("completed", (job, result) => {
      console.log(`SMS sent successfully: ${job.id}`);
    });

    this.queue.on("failed", (job, error) => {
      console.error(`SMS failed: ${job.id}`, error);
    });
  }

  async add(smsData) {
    return await this.queue.add(smsData, {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
    });
  }

  async addBulk(smsArray) {
    const jobs = smsArray.map((sms) => ({
      data: sms,
      opts: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
      },
    }));

    return await this.queue.addBulk(jobs);
  }

  async getStats() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
    ]);

    return { waiting, active, completed, failed };
  }
}

module.exports = SMSQueue;
```

### 2.6 SMS API Endpoints

```javascript
// server/src/routes/sms.routes.js
const express = require("express");
const router = express.Router();
const SMSService = require("../services/sms/sms.service");
const { authenticate } = require("../middleware/auth-multi-tenant");
const { requirePermission } = require("../utils/rbac");

// Send transactional SMS
router.post("/send", authenticate, async (req, res) => {
  try {
    const { to, templateName, variables } = req.body;

    const result = await SMSService.sendTransactionalSMS(
      to,
      templateName,
      variables,
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Send bulk SMS
router.post(
  "/bulk",
  authenticate,
  requirePermission("SEND_BULK_SMS"),
  async (req, res) => {
    try {
      const { recipients, message, scheduledAt } = req.body;

      const result = await SMSService.sendBulkSMS(recipients, message, {
        scheduledAt,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },
);

// Get SMS logs
router.get("/logs", authenticate, async (req, res) => {
  try {
    const { startDate, endDate, type, status } = req.query;

    const { getShopDatabase } = require("../config/database");
    const db = getShopDatabase(req.user.shopId);

    const filter = {};
    if (startDate) filter.createdAt = { $gte: new Date(startDate) };
    if (endDate)
      filter.createdAt = { ...filter.createdAt, $lte: new Date(endDate) };
    if (type) filter.type = type;
    if (status) filter.status = status;

    const logs = await db
      .collection("sms_logs")
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    res.json({
      success: true,
      data: logs,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Get delivery status
router.get("/status/:messageId", authenticate, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { provider } = req.query;

    const status = await SMSService.getDeliveryStatus(messageId, provider);

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;
```

### 2.7 Data Models

```javascript
// MongoDB Collection: sms_logs
{
  _id: ObjectId,
  recipient: String,        // Phone number
  message: String,
  type: String,            // "transactional" | "promotional" | "alert"
  provider: String,        // "twilio" | "msg91"
  messageId: String,       // Provider's message ID
  status: String,          // "queued" | "sent" | "delivered" | "failed"
  cost: Number,            // Cost in USD
  errorMessage: String,
  templateName: String,
  shopId: String,
  createdAt: Date,
  sentAt: Date,
  deliveredAt: Date
}

// MongoDB Collection: sms_templates
{
  _id: ObjectId,
  name: String,
  content: String,
  variables: [String],
  category: String,        // "transactional" | "promotional"
  dltId: String,          // DLT template ID (India)
  shopId: String,
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

## 3. Email Marketing Integration Design

### 3.1 Email Service Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Email Service Layer                        │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Email API   │  │   Template   │  │   Campaign   │     │
│  │  Controller  │─▶│   Manager    │─▶│   Manager    │     │
│  └──────────────┘  └──────────────┘  └──────┬───────┘     │
│                                              │             │
│         ┌────────────────────────────────────┘             │
│         │                                                   │
│  ┌──────▼───────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  SendGrid    │  │  Mailchimp   │  │   AWS SES    │     │
│  │   Adapter    │  │   Adapter    │  │   Adapter    │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
          └──────────────────┼──────────────────┘
                             │
                    ┌────────▼────────┐
                    │   Bull Queue    │
                    │  (Email Jobs)   │
                    └─────────────────┘
```

### 3.2 SendGrid Integration (Transactional Emails)

```javascript
// server/src/services/email/providers/sendgrid.adapter.js
const sgMail = require("@sendgrid/mail");

class SendGridAdapter {
  constructor() {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    this.fromEmail = process.env.SENDGRID_FROM_EMAIL;
    this.fromName =
      process.env.SENDGRID_FROM_NAME || "Healthcare Plus Pharmacy";
  }

  async sendEmail(to, subject, content, options = {}) {
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
        categories: options.categories || ["transactional"],
        customArgs: {
          shopId: options.shopId,
          orderId: options.orderId,
        },
      };

      const result = await sgMail.send(msg);

      return {
        success: true,
        messageId: result[0].headers["x-message-id"],
        provider: "sendgrid",
        status: "sent",
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        provider: "sendgrid",
      };
    }
  }

  async sendBulk(emails) {
    try {
      const messages = emails.map((email) => ({
        to: email.to,
        from: {
          email: this.fromEmail,
          name: this.fromName,
        },
        subject: email.subject,
        html: email.content,
        categories: ["bulk", "marketing"],
      }));

      const result = await sgMail.send(messages);

      return {
        success: true,
        sent: result.length,
        provider: "sendgrid",
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        provider: "sendgrid",
      };
    }
  }

  async getEmailStats(messageId) {
    // SendGrid Event Webhook provides delivery stats
    // This would query the webhook data stored in DB
    const { getShopDatabase } = require("../../config/database");
    const db = getShopDatabase("main_store");

    const events = await db
      .collection("email_events")
      .find({ messageId })
      .toArray();

    return {
      delivered: events.some((e) => e.event === "delivered"),
      opened: events.some((e) => e.event === "open"),
      clicked: events.some((e) => e.event === "click"),
      bounced: events.some((e) => e.event === "bounce"),
      events: events,
    };
  }
}

module.exports = SendGridAdapter;
```

### 3.3 Mailchimp Integration (Marketing Campaigns)

```javascript
// server/src/services/email/providers/mailchimp.adapter.js
const mailchimp = require("@mailchimp/mailchimp_marketing");

class MailchimpAdapter {
  constructor() {
    mailchimp.setConfig({
      apiKey: process.env.MAILCHIMP_API_KEY,
      server: process.env.MAILCHIMP_SERVER_PREFIX,
    });
    this.listId = process.env.MAILCHIMP_LIST_ID;
  }

  async syncCustomers(customers) {
    try {
      const members = customers.map((customer) => ({
        email_address: customer.email,
        status: "subscribed",
        merge_fields: {
          FNAME: customer.name.split(" ")[0],
          LNAME: customer.name.split(" ").slice(1).join(" "),
          PHONE: customer.phone,
        },
        tags: customer.tags || [],
      }));

      const result = await mailchimp.lists.batchListMembers(this.listId, {
        members: members,
        update_existing: true,
      });

      return {
        success: true,
        added: result.new_members,
        updated: result.updated_members,
        errors: result.errors,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async createCampaign(campaignData) {
    try {
      const campaign = await mailchimp.campaigns.create({
        type: "regular",
        recipients: {
          list_id: this.listId,
          segment_opts: campaignData.segmentOptions,
        },
        settings: {
          subject_line: campaignData.subject,
          from_name: campaignData.fromName || "Healthcare Plus",
          reply_to: campaignData.replyTo || this.fromEmail,
          title: campaignData.title,
        },
      });

      // Set campaign content
      await mailchimp.campaigns.setContent(campaign.id, {
        html: campaignData.htmlContent,
      });

      return {
        success: true,
        campaignId: campaign.id,
        webId: campaign.web_id,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async sendCampaign(campaignId) {
    try {
      await mailchimp.campaigns.send(campaignId);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async getCampaignStats(campaignId) {
    try {
      const report = await mailchimp.reports.getCampaignReport(campaignId);

      return {
        success: true,
        stats: {
          emailsSent: report.emails_sent,
          opensTotal: report.opens.opens_total,
          openRate: report.opens.open_rate,
          clicksTotal: report.clicks.clicks_total,
          clickRate: report.clicks.click_rate,
          unsubscribed: report.unsubscribed,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async createSegment(segmentData) {
    try {
      const segment = await mailchimp.lists.createSegment(this.listId, {
        name: segmentData.name,
        static_segment: segmentData.emails || [],
      });

      return {
        success: true,
        segmentId: segment.id,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

module.exports = MailchimpAdapter;
```

### 3.4 Email Service Manager

```javascript
// server/src/services/email/email.service.js
const SendGridAdapter = require("./providers/sendgrid.adapter");
const MailchimpAdapter = require("./providers/mailchimp.adapter");
const EmailQueue = require("./email.queue");
const EmailTemplate = require("./email.template");

class EmailService {
  constructor() {
    this.sendgrid = new SendGridAdapter();
    this.mailchimp = new MailchimpAdapter();
    this.queue = new EmailQueue();
    this.template = new EmailTemplate();
  }

  async sendTransactionalEmail(to, templateName, variables) {
    // Get template
    const template = await this.template.get(templateName);
    const { subject, html } = this.template.render(template, variables);

    // Validate email
    if (!this.validateEmail(to)) {
      throw new Error("Invalid email address");
    }

    // Send via SendGrid
    const result = await this.sendgrid.sendEmail(to, subject, html, {
      templateData: variables,
      shopId: variables.shopId,
    });

    // Log to database
    await this.logEmail({
      recipient: to,
      subject,
      templateName,
      provider: "sendgrid",
      type: "transactional",
      status: result.status,
      messageId: result.messageId,
    });

    return result;
  }

  async sendOrderConfirmation(order, customer) {
    return await this.sendTransactionalEmail(
      customer.email,
      "order_confirmation",
      {
        customerName: customer.name,
        orderNo: order.invoiceNo,
        orderDate: order.saleDate,
        items: order.items,
        total: order.grandTotal,
        shopId: order.shopId,
      },
    );
  }

  async sendInvoice(sale, customer) {
    // Generate PDF invoice
    const invoicePDF = await this.generateInvoicePDF(sale);

    return await this.sendgrid.sendEmail(
      customer.email,
      `Invoice #${sale.invoiceNo}`,
      await this.template.render("invoice_email", {
        customerName: customer.name,
        invoiceNo: sale.invoiceNo,
      }),
      {
        attachments: [
          {
            content: invoicePDF.toString("base64"),
            filename: `invoice-${sale.invoiceNo}.pdf`,
            type: "application/pdf",
            disposition: "attachment",
          },
        ],
      },
    );
  }

  async sendMarketingCampaign(campaignData) {
    // Create campaign in Mailchimp
    const campaign = await this.mailchimp.createCampaign({
      title: campaignData.title,
      subject: campaignData.subject,
      htmlContent: campaignData.content,
      segmentOptions: campaignData.segment,
    });

    if (!campaign.success) {
      throw new Error(campaign.error);
    }

    // Schedule or send immediately
    if (campaignData.scheduledAt) {
      // Schedule for later
      return {
        success: true,
        campaignId: campaign.campaignId,
        scheduled: true,
      };
    } else {
      // Send now
      return await this.mailchimp.sendCampaign(campaign.campaignId);
    }
  }

  async syncCustomersToMailchimp(shopId) {
    const { getShopDatabase } = require("../../config/database");
    const db = getShopDatabase(shopId);

    // Get customers with email
    const customers = await db
      .collection("customers")
      .find({
        email: { $exists: true, $ne: "" },
        emailOptIn: true,
      })
      .toArray();

    return await this.mailchimp.syncCustomers(customers);
  }

  validateEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }

  async logEmail(data) {
    const { getShopDatabase } = require("../../config/database");
    const db = getShopDatabase(data.shopId || "main_store");

    await db.collection("email_logs").insertOne({
      ...data,
      createdAt: new Date(),
    });
  }

  async generateInvoicePDF(sale) {
    // Use a PDF library like pdfkit or puppeteer
    // This is a placeholder
    return Buffer.from("PDF content");
  }
}

module.exports = new EmailService();
```

### 3.5 Email Template Manager

```javascript
// server/src/services/email/email.template.js
const Handlebars = require("handlebars");

class EmailTemplate {
  constructor() {
    this.templates = new Map();
    this.loadTemplates();
  }

  loadTemplates() {
    // Order Confirmation Template
    this.templates.set("order_confirmation", {
      name: "order_confirmation",
      subject: "Order Confirmation - #{{orderNo}}",
      html: `
        <html>
          <body style="font-family: Arial, sans-serif;">
            <h2>Thank you for your order!</h2>
            <p>Hi {{customerName}},</p>
            <p>Your order #{{orderNo}} has been confirmed.</p>
            
            <h3>Order Details:</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr style="background: #f0f0f0;">
                <th style="padding: 10px; text-align: left;">Product</th>
                <th style="padding: 10px; text-align: right;">Qty</th>
                <th style="padding: 10px; text-align: right;">Price</th>
              </tr>
              {{#each items}}
              <tr>
                <td style="padding: 10px;">{{this.name}}</td>
                <td style="padding: 10px; text-align: right;">{{this.quantity}}</td>
                <td style="padding: 10px; text-align: right;">₹{{this.total}}</td>
              </tr>
              {{/each}}
            </table>
            
            <p style="font-size: 18px; font-weight: bold;">
              Total: ₹{{total}}
            </p>
            
            <p>Thank you for shopping with us!</p>
          </body>
        </html>
      `,
      variables: ["customerName", "orderNo", "items", "total"],
    });

    // Welcome Email Template
    this.templates.set("welcome", {
      name: "welcome",
      subject: "Welcome to {{storeName}}!",
      html: `
        <html>
          <body style="font-family: Arial, sans-serif;">
            <h2>Welcome to {{storeName}}!</h2>
            <p>Hi {{customerName}},</p>
            <p>Thank you for joining us. We're excited to serve you!</p>
            <p>As a welcome gift, here's a special discount code: <strong>{{discountCode}}</strong></p>
            <p>Visit us at: {{storeAddress}}</p>
          </body>
        </html>
      `,
      variables: ["storeName", "customerName", "discountCode", "storeAddress"],
    });
  }

  async get(templateName) {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template ${templateName} not found`);
    }
    return template;
  }

  render(template, variables) {
    // Compile subject
    const subjectTemplate = Handlebars.compile(template.subject);
    const subject = subjectTemplate(variables);

    // Compile HTML
    const htmlTemplate = Handlebars.compile(template.html);
    const html = htmlTemplate(variables);

    return { subject, html };
  }
}

module.exports = EmailTemplate;
```

### 3.6 Email API Endpoints

```javascript
// server/src/routes/email.routes.js
const express = require("express");
const router = express.Router();
const EmailService = require("../services/email/email.service");
const { authenticate } = require("../middleware/auth-multi-tenant");
const { requirePermission } = require("../utils/rbac");

// Send transactional email
router.post("/send", authenticate, async (req, res) => {
  try {
    const { to, templateName, variables } = req.body;

    const result = await EmailService.sendTransactionalEmail(to, templateName, {
      ...variables,
      shopId: req.user.shopId,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Create marketing campaign
router.post(
  "/campaign",
  authenticate,
  requirePermission("CREATE_CAMPAIGN"),
  async (req, res) => {
    try {
      const campaignData = req.body;

      const result = await EmailService.sendMarketingCampaign(campaignData);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },
);

// Sync customers to Mailchimp
router.post(
  "/sync-customers",
  authenticate,
  requirePermission("MANAGE_MARKETING"),
  async (req, res) => {
    try {
      const result = await EmailService.syncCustomersToMailchimp(
        req.user.shopId,
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },
);

// Get email logs
router.get("/logs", authenticate, async (req, res) => {
  try {
    const { startDate, endDate, type } = req.query;

    const { getShopDatabase } = require("../config/database");
    const db = getShopDatabase(req.user.shopId);

    const filter = {};
    if (startDate) filter.createdAt = { $gte: new Date(startDate) };
    if (endDate)
      filter.createdAt = { ...filter.createdAt, $lte: new Date(endDate) };
    if (type) filter.type = type;

    const logs = await db
      .collection("email_logs")
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    res.json({
      success: true,
      data: logs,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;
```

### 3.7 Data Models

```javascript
// MongoDB Collection: email_logs
{
  _id: ObjectId,
  recipient: String,
  subject: String,
  templateName: String,
  type: String,            // "transactional" | "marketing"
  provider: String,        // "sendgrid" | "mailchimp"
  messageId: String,
  status: String,          // "queued" | "sent" | "delivered" | "opened" | "clicked" | "bounced"
  shopId: String,
  createdAt: Date,
  sentAt: Date,
  openedAt: Date,
  clickedAt: Date
}

// MongoDB Collection: email_campaigns
{
  _id: ObjectId,
  title: String,
  subject: String,
  content: String,
  segment: Object,
  provider: String,
  campaignId: String,      // Provider's campaign ID
  status: String,          // "draft" | "scheduled" | "sent"
  scheduledAt: Date,
  sentAt: Date,
  stats: {
    sent: Number,
    opened: Number,
    clicked: Number,
    unsubscribed: Number
  },
  shopId: String,
  createdBy: ObjectId,
  createdAt: Date
}
```

---

## 4. Configuration & Environment Variables

```bash
# SMS Configuration
SMS_DEFAULT_PROVIDER=twilio
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
MSG91_API_KEY=your_api_key
MSG91_SENDER_ID=PHARMA

# Email Configuration
SENDGRID_API_KEY=your_api_key
SENDGRID_FROM_EMAIL=noreply@healthcareplus.com
SENDGRID_FROM_NAME=Healthcare Plus Pharmacy
MAILCHIMP_API_KEY=your_api_key
MAILCHIMP_SERVER_PREFIX=us1
MAILCHIMP_LIST_ID=your_list_id

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# Queue Configuration
QUEUE_CONCURRENCY=10
QUEUE_MAX_RETRIES=3
```

---

## 5. Monitoring & Analytics

### 5.1 Metrics to Track

- SMS delivery rate
- SMS cost per message
- Email open rate
- Email click rate
- Campaign conversion rate
- Queue processing time
- Failed message count

### 5.2 Dashboards

- Real-time SMS/Email status
- Cost analytics
- Campaign performance
- Delivery reports

---

## Next Steps

1. ✅ Requirements documented
2. ✅ Design completed
3. ⏭️ Create implementation tasks
4. ⏭️ Set up development environment
5. ⏭️ Begin Phase 1 implementation
