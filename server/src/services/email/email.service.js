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
   * Send an invoice email with a download link to the generated PDF.
   * Generates PDF via pdfkit, uploads to GCS (or local fallback),
   * then sends email with a "Download Invoice" button.
   * @param {object} sale - Sale document
   * @param {object} customer - Customer document
   * @param {object} [options] - Optional overrides
   * @param {string} [options.shopId] - Shop ID (falls back to sale.shopId)
   * @returns {Promise<{ invoiceUrl: string, emailSent: boolean, messageId?: string }>}
   */
  async sendInvoice(sale, customer, options = {}) {
    const shopId = options.shopId || sale.shopId || "main_store";

    // 1. Generate PDF buffer
    const pdfBuffer = await this.generateInvoicePDF(sale);

    // 2. Upload PDF to GCS / local storage
    const { uploadInvoicePDF } = require("../file-upload.service");
    const { url: invoiceUrl, storage } = await uploadInvoicePDF(
      pdfBuffer,
      shopId,
      sale._id?.toString() || sale.invoiceNo
    );

    // 3. Fetch shop details for branding
    let shopName = "Health Care Surgical Mart";
    let shopPhone = "";
    let shopAddress = "";
    try {
      const { getSystemDatabase } = require("../../config/database");
      const systemDb = getSystemDatabase();
      const shop = await systemDb.collection("shops").findOne({ shopId });
      if (shop) {
        shopName = shop.shopName || shop.name || shopName;
        shopPhone = shop.phone || "";
        shopAddress = shop.address || "";
      }
    } catch (_) {
      // Non-fatal — use defaults
    }

    // 4. Send email if customer has an email address
    let emailSent = false;
    let messageId;

    if (customer?.email) {
      const { subject, html } = this.template.render(
        await this.template.get("invoice_email"),
        {
          customerName: customer.name || "Valued Customer",
          invoiceNo: sale.invoiceNo,
          invoiceDate: new Date(sale.saleDate || Date.now()).toLocaleDateString(),
          totalAmount: `৳${(sale.grandTotal || 0).toFixed(2)}`,
          invoiceUrl,
          shopName,
          shopPhone,
          shopAddress,
        }
      );

      const result = await this.sendgrid.sendEmail(customer.email, subject, html, {
        shopId,
      });

      await this.logEmail({
        recipient: customer.email,
        subject,
        templateName: "invoice_email",
        provider: "sendgrid",
        type: "transactional",
        status: result.status,
        messageId: result.messageId,
        shopId,
        invoiceUrl,
        storage,
      });

      emailSent = result.status === "sent" || result.status === "queued";
      messageId = result.messageId;
    }

    return { invoiceUrl, emailSent, messageId, storage };
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
   * Generate a PDF buffer for an invoice.
   * @param {object} sale
   * @returns {Promise<Buffer>}
   */
  async generateInvoicePDF(sale) {
    const PDFDocument = require('pdfkit');
    
    // Get shop details for branding (with fallback for testing)
    let shop = null;
    try {
      const { getSystemDatabase } = require('../../config/database');
      const systemDb = getSystemDatabase();
      shop = await systemDb.collection('shops').findOne({ shopId: sale.shopId });
    } catch (error) {
      // Database not available (e.g., in tests) - use defaults
      shop = null;
    }
    
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ 
        margin: 50, 
        compress: false,
        info: {
          Title: `Invoice #${sale.invoiceNo}`,
          Subject: `Invoice ${sale.invoiceNo}`,
          Keywords: sale.invoiceNo
        }
      });
      const chunks = [];
      
      // Collect PDF data
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      
      // Header with shop branding
      doc.fontSize(20).text(shop?.shopName || 'Healthcare Surgical Mart', { align: 'center' });
      doc.fontSize(10).text(shop?.address || '', { align: 'center' });
      doc.text(shop?.phone || '', { align: 'center' });
      doc.moveDown();
      
      // Invoice title and details
      doc.fontSize(16).text(`INVOICE #${sale.invoiceNo}`, { align: 'center' });
      doc.moveDown();
      
      // Customer and date info
      doc.fontSize(10);
      doc.text(`Date: ${new Date(sale.saleDate).toLocaleDateString()}`, { align: 'right' });
      doc.text(`Customer: ${sale.customerName || 'Walk-in Customer'}`);
      if (sale.customerPhone) doc.text(`Phone: ${sale.customerPhone}`);
      doc.moveDown();
      
      // Table header
      const tableTop = doc.y;
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('Item', 50, tableTop);
      doc.text('Qty', 300, tableTop);
      doc.text('Price', 370, tableTop);
      doc.text('Total', 450, tableTop, { align: 'right' });
      doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();
      
      // Line items
      doc.font('Helvetica');
      let yPosition = tableTop + 25;
      
      for (const item of sale.items || []) {
        doc.text(item.productName || item.name, 50, yPosition, { width: 240 });
        doc.text(item.quantity.toString(), 300, yPosition);
        doc.text(`₹${item.price.toFixed(2)}`, 370, yPosition);
        doc.text(`₹${(item.quantity * item.price).toFixed(2)}`, 450, yPosition, { align: 'right' });
        yPosition += 20;
      }
      
      // Totals
      doc.moveDown();
      const totalsX = 400;
      yPosition = doc.y + 10;
      
      doc.text('Subtotal:', totalsX, yPosition);
      doc.text(`₹${sale.subtotal?.toFixed(2) || '0.00'}`, 450, yPosition, { align: 'right' });
      yPosition += 20;
      
      if (sale.discount > 0) {
        doc.text('Discount:', totalsX, yPosition);
        doc.text(`-₹${sale.discount.toFixed(2)}`, 450, yPosition, { align: 'right' });
        yPosition += 20;
      }
      
      if (sale.tax > 0) {
        doc.text('Tax:', totalsX, yPosition);
        doc.text(`₹${sale.tax.toFixed(2)}`, 450, yPosition, { align: 'right' });
        yPosition += 20;
      }
      
      doc.font('Helvetica-Bold');
      doc.fontSize(12);
      doc.text('Grand Total:', totalsX, yPosition);
      doc.text(`₹${sale.grandTotal.toFixed(2)}`, 450, yPosition, { align: 'right' });
      
      // Footer
      doc.fontSize(8).font('Helvetica').moveDown(2);
      doc.text('Thank you for your business!', { align: 'center' });
      
      // Finalize PDF
      doc.end();
    });
  }
}

module.exports = new EmailService();
