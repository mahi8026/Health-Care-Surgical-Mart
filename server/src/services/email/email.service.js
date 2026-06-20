// server/src/services/email/email.service.js
const SendGridAdapter = require('./providers/sendgrid.adapter');
const MailchimpAdapter = require('./providers/mailchimp.adapter');
const { validateEmail } = require('./email.validator');

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
      const EmailQueue = require('./email.queue');
      this._queue = new EmailQueue();
    }
    return this._queue;
  }

  get template() {
    if (!this._template) {
      // Lazy require to avoid circular deps (task 2.5)
      const EmailTemplate = require('./email.template');
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
      throw new Error('Invalid email address');
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
      provider: 'sendgrid',
      type: 'transactional',
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
      'order_confirmation',
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
    const shopId = options.shopId || sale.shopId || 'main_store';

    // 1. Generate PDF buffer
    const pdfBuffer = await this.generateInvoicePDF(sale);

    // 2. Upload PDF to GCS / local storage
    const { uploadInvoicePDF } = require('../file-upload.service');
    const { url: invoiceUrl, storage } = await uploadInvoicePDF(
      pdfBuffer,
      shopId,
      sale._id?.toString() || sale.invoiceNo
    );

    // 3. Fetch shop details for branding
    let shopName = 'Health Care Surgical Mart';
    let shopPhone = '';
    let shopAddress = '';
    try {
      const { getSystemDatabase } = require('../../config/database');
      const systemDb = getSystemDatabase();
      const shop = await systemDb.collection('shops').findOne({ shopId });
      if (shop) {
        shopName = shop.shopName || shop.name || shopName;
        shopPhone = shop.phone || '';
        shopAddress = shop.address || '';
      }
    } catch (_) {
      // Non-fatal — use defaults
    }

    // 4. Send email if customer has an email address
    let emailSent = false;
    let messageId;

    if (customer?.email) {
      const { subject, html } = this.template.render(
        await this.template.get('invoice_email'),
        {
          customerName: customer.name || 'Valued Customer',
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
        templateName: 'invoice_email',
        provider: 'sendgrid',
        type: 'transactional',
        status: result.status,
        messageId: result.messageId,
        shopId,
        invoiceUrl,
        storage,
      });

      emailSent = result.status === 'sent' || result.status === 'queued';
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
    const { getShopDatabase } = require('../../config/database');
    const db = getShopDatabase(shopId);

    const customers = await db
      .collection('customers')
      .find({
        email: { $exists: true, $ne: '' },
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
    const { getShopDatabase } = require('../../config/database');
    const db = getShopDatabase(data.shopId || 'main_store');

    await db.collection('email_logs').insertOne({
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

    // Get shop details for branding
    let shop = null;
    try {
      const { getSystemDatabase } = require('../../config/database');
      const systemDb = getSystemDatabase();
      shop = await systemDb.collection('shops').findOne({ shopId: sale.shopId });
    } catch (_) {
      shop = null;
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4', compress: false });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const shopName = shop?.name || shop?.shopName || 'Health Care Surgical Mart';
      const currency = '৳';

      // ── Header ──────────────────────────────────────────────────────────
      doc.fontSize(18).font('Helvetica-Bold').text(shopName, { align: 'center' });
      if (shop?.address) {doc.fontSize(9).font('Helvetica').text(shop.address, { align: 'center' });}
      if (shop?.phone)   {doc.fontSize(9).text(`Phone: ${shop.phone}`, { align: 'center' });}
      doc.moveDown(0.5);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).lineWidth(1.5).stroke();
      doc.moveDown(0.5);

      // ── Invoice title ────────────────────────────────────────────────────
      doc.fontSize(14).font('Helvetica-Bold').text('INVOICE', { align: 'center' });
      doc.moveDown(0.5);

      // ── Two-column info block ────────────────────────────────────────────
      const infoTop = doc.y;
      doc.fontSize(9).font('Helvetica-Bold').text('Bill To:', 40, infoTop);
      doc.font('Helvetica').text(sale.customerName || 'Cash Customer', 40, infoTop + 14);
      if (sale.customerPhone) {doc.text(`Phone: ${sale.customerPhone}`, 40, infoTop + 26);}
      if (sale.customerAddress) {doc.text(sale.customerAddress, 40, infoTop + 38);}

      doc.font('Helvetica-Bold').text('Invoice No:', 380, infoTop);
      doc.font('Helvetica').text(sale.invoiceNo || 'N/A', 460, infoTop);
      doc.font('Helvetica-Bold').text('Date:', 380, infoTop + 14);
      doc.font('Helvetica').text(
        new Date(sale.saleDate || sale.createdAt).toLocaleDateString('en-GB', {
          day: '2-digit', month: 'short', year: 'numeric'
        }),
        460, infoTop + 14
      );
      doc.font('Helvetica-Bold').text('Status:', 380, infoTop + 28);
      doc.font('Helvetica').text(sale.paymentStatus || 'N/A', 460, infoTop + 28);

      doc.moveDown(3.5);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).lineWidth(0.5).stroke();
      doc.moveDown(0.3);

      // ── Table header ─────────────────────────────────────────────────────
      const col = { sl: 40, name: 65, qty: 340, rate: 400, total: 480 };
      const rowH = 18;
      let y = doc.y;

      doc.rect(40, y, 515, rowH).fill('#2563eb');
      doc.fillColor('white').fontSize(9).font('Helvetica-Bold');
      doc.text('#',          col.sl,   y + 5, { width: 20 });
      doc.text('Item',       col.name, y + 5, { width: 270 });
      doc.text('Qty',        col.qty,  y + 5, { width: 55, align: 'right' });
      doc.text('Rate',       col.rate, y + 5, { width: 75, align: 'right' });
      doc.text('Total',      col.total,y + 5, { width: 75, align: 'right' });
      doc.fillColor('black');
      y += rowH + 2;

      // ── Table rows ───────────────────────────────────────────────────────
      doc.fontSize(9).font('Helvetica');
      const items = sale.items || [];
      items.forEach((item, i) => {
        // Support both field name variants
        const qty   = item.qty ?? item.quantity ?? 0;
        const rate  = item.rate ?? item.sellingPrice ?? item.price ?? 0;
        const total = item.total ?? (qty * rate);
        const name  = item.name || item.productName || 'Item';

        if (i % 2 === 1) {doc.rect(40, y, 515, rowH).fill('#f8fafc').stroke('#e2e8f0');}
        doc.fillColor('black');
        doc.text(String(i + 1),                col.sl,   y + 4, { width: 20 });
        doc.text(name,                          col.name, y + 4, { width: 270 });
        doc.text(item.unit ? `${qty} ${item.unit}` : String(qty), col.qty,  y + 4, { width: 55, align: 'right' });
        doc.text(`${currency}${Number(rate).toFixed(2)}`,  col.rate,  y + 4, { width: 75, align: 'right' });
        doc.text(`${currency}${Number(total).toFixed(2)}`, col.total, y + 4, { width: 75, align: 'right' });
        y += rowH;
      });

      doc.moveTo(40, y).lineTo(555, y).lineWidth(0.5).stroke();
      y += 8;

      // ── Totals ───────────────────────────────────────────────────────────
      const totalsX = 380;
      const valX    = 480;
      const totW    = 75;

      const addRow = (label, value, bold = false) => {
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 10 : 9);
        doc.text(label, totalsX, y, { width: 95 });
        doc.text(value, valX,    y, { width: totW, align: 'right' });
        y += bold ? 16 : 14;
      };

      addRow('Subtotal:',  `${currency}${Number(sale.subtotal || 0).toFixed(2)}`);
      if ((sale.discountAmount || 0) > 0)
        {addRow('Discount:', `-${currency}${Number(sale.discountAmount).toFixed(2)}`);}
      if ((sale.vatAmount || 0) > 0)
        {addRow(`VAT (${sale.vatPercent || 0}%):`, `${currency}${Number(sale.vatAmount).toFixed(2)}`);}

      doc.moveTo(totalsX, y).lineTo(555, y).lineWidth(0.5).stroke();
      y += 4;
      addRow('Grand Total:', `${currency}${Number(sale.grandTotal || 0).toFixed(2)}`, true);

      const paid = (sale.cashPaid || 0) + (sale.bankPaid || 0);
      addRow('Paid:', `${currency}${Number(paid).toFixed(2)}`);
      if ((sale.dueAmount || 0) > 0) {
        doc.fillColor('#dc2626');
        addRow('Due:', `${currency}${Number(sale.dueAmount).toFixed(2)}`);
        doc.fillColor('black');
      }

      // ── Footer ───────────────────────────────────────────────────────────
      doc.moveDown(2);
      doc.fontSize(8).font('Helvetica').fillColor('#6b7280')
        .text('Thank you for your business!', { align: 'center' });
      doc.text('This is a computer-generated invoice.', { align: 'center' });

      doc.end();
    });
  }
}

module.exports = new EmailService();
