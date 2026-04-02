// server/src/services/email/email.service.js
const SendGridAdapter = require("./providers/sendgrid.adapter");
const MailchimpAdapter = require("./providers/mailchimp.adapter");
const { validateEmail } = require("./email.validator");

class EmailService {
  constructor() {
    this.sendgrid = new SendGridAdapter();
    this.mailchimp = new MailchimpAdapter();

    // Lazy-loaded to avoid circular dependency issues at startup
    // (EmailQueue and EmailTemplate are created in tasks 2.5 and 2.6)
    this._queue = null;
    this._template = null;
  }

  get queue() {
    if (!this._queue) {
      const EmailQueue = require("./email.queue");
      this._queue = new EmailQueue();
    }
    return this._queue;
  }

  get template() {
    if (!this._template) {
      // Lazy require to avoid circular deps (task 2.5)
      const EmailTemplate = require("./email.template");
      this._template = new EmailTemplate();
    }
    return this._template;
  }

  /**
   * Send a transactional email using a named template.
   * @param {string} to - Recipient email address
   * @param {string} templateName - Template identifier
   * @param {object} variables - Template variable substitutions
   */
  async sendTransactionalEmail(to, templateName, variables) {
    if (!this.validateEmail(to)) {
      throw new Error("Invalid email address");
    }

    const tmpl = await this.template.get(templateName);
    const { subject, html } = this.template.render(tmpl, variables);

    const result = await this.sendgrid.sendEmail(to, subject, html, {
      templateData: variables,
      shopId: variables.shopId,
    });

    await this.logEmail({
      recipient: to,
      subject,
      templateName,
      provider: "sendgrid",
      type: "transactional",
      status: result.status,
      messageId: result.messageId,
      shopId: variables.shopId,
    });

    return result;
  }

  /**
   * Send an order confirmation email to a customer.
   * @param {object} order
   * @param {object} customer
   */
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

  /**
   * Send an invoice email with a PDF attachment.
   * PDF generation is stubbed — replace with real implementation when ready.
   * @param {object} sale
   * @param {object} customer
   */
  async sendInvoice(sale, customer) {
    const invoicePDF = await this.generateInvoicePDF(sale);

    const { subject, html } = this.template.render(
      await this.template.get("invoice_email"),
      {
        customerName: customer.name,
        invoiceNo: sale.invoiceNo,
        shopId: sale.shopId,
      },
    );

    const result = await this.sendgrid.sendEmail(customer.email, subject, html, {
      shopId: sale.shopId,
      attachments: [
        {
          content: invoicePDF.toString("base64"),
          filename: `invoice-${sale.invoiceNo}.pdf`,
          type: "application/pdf",
          disposition: "attachment",
        },
      ],
    });

    await this.logEmail({
      recipient: customer.email,
      subject,
      templateName: "invoice_email",
      provider: "sendgrid",
      type: "transactional",
      status: result.status,
      messageId: result.messageId,
      shopId: sale.shopId,
    });

    return result;
  }

  /**
   * Create and send (or schedule) a Mailchimp marketing campaign.
   * @param {object} campaignData
   */
  async sendMarketingCampaign(campaignData) {
    const campaign = await this.mailchimp.createCampaign({
      title: campaignData.title,
      subject: campaignData.subject,
      htmlContent: campaignData.content,
      segmentOptions: campaignData.segment,
      fromName: campaignData.fromName,
      replyTo: campaignData.replyTo,
    });

    if (!campaign.success) {
      throw new Error(campaign.error);
    }

    if (campaignData.scheduledAt) {
      return {
        success: true,
        campaignId: campaign.campaignId,
        scheduled: true,
        scheduledAt: campaignData.scheduledAt,
      };
    }

    return await this.mailchimp.sendCampaign(campaign.campaignId);
  }

  /**
   * Sync opted-in customers from a shop to Mailchimp.
   * @param {string} shopId
   */
  async syncCustomersToMailchimp(shopId) {
    const { getShopDatabase } = require("../../config/database");
    const db = getShopDatabase(shopId);

    const customers = await db
      .collection("customers")
      .find({
        email: { $exists: true, $ne: "" },
        emailOptIn: true,
      })
      .toArray();

    return await this.mailchimp.syncCustomers(customers);
  }

  /**
   * Persist an email log entry to the shop database.
   * @param {object} data
   */
  async logEmail(data) {
    const { getShopDatabase } = require("../../config/database");
    const db = getShopDatabase(data.shopId || "main_store");

    await db.collection("email_logs").insertOne({
      ...data,
      createdAt: new Date(),
    });
  }

  /**
   * Validate an email address.
   * @param {string} email
   * @returns {boolean}
   */
  validateEmail(email) {
    return validateEmail(email);
  }

  /**
   * Stub: Generate a PDF buffer for an invoice.
   * Replace with a real PDF library (e.g. pdfkit, puppeteer) when ready.
   * @param {object} sale
   * @returns {Promise<Buffer>}
   */
  async generateInvoicePDF(sale) {
    // TODO: implement real PDF generation
    return Buffer.from(`Invoice #${sale.invoiceNo}`);
  }
}

module.exports = new EmailService();
