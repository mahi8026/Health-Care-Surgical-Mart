// server/src/services/email/email.template.js
const Handlebars = require("handlebars");
const fs = require("fs");
const path = require("path");

const TEMPLATES_DIR = path.join(__dirname, "templates");

/**
 * Load an HTML file from the templates directory.
 * @param {string} filename
 * @returns {string}
 */
function loadHtml(filename) {
  return fs.readFileSync(path.join(TEMPLATES_DIR, filename), "utf8");
}

class EmailTemplate {
  constructor() {
    /** @type {Map<string, {name: string, subject: string, html: string, variables: string[]}>} */
    this.templates = new Map();
    this.loadTemplates();
  }

  loadTemplates() {
    this.templates.set("order_confirmation", {
      name: "order_confirmation",
      subject: "Order Confirmation - #{{orderNo}}",
      html: loadHtml("order_confirmation.html"),
      variables: ["customerName", "orderNo", "orderDate", "items", "total"],
    });

    this.templates.set("invoice_email", {
      name: "invoice_email",
      subject: "Invoice #{{invoiceNo}} from Healthcare Plus",
      html: loadHtml("invoice_email.html"),
      variables: ["customerName", "invoiceNo"],
    });

    this.templates.set("welcome_email", {
      name: "welcome_email",
      subject: "Welcome to {{storeName}}!",
      html: loadHtml("welcome_email.html"),
      variables: ["customerName", "storeName"],
    });

    this.templates.set("password_reset", {
      name: "password_reset",
      subject: "Reset Your Password",
      html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:20px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="background-color:#dc2626;padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">Password Reset</h1>
        </td></tr>
        <tr><td style="padding:32px 40px;">
          <p style="margin:0 0 16px;color:#374151;font-size:16px;">Hi <strong>{{customerName}}</strong>,</p>
          <p style="margin:0 0 24px;color:#374151;font-size:15px;">
            We received a request to reset your password. Click the link below to set a new password.
          </p>
          <p style="margin:0 0 24px;text-align:center;">
            <a href="{{resetLink}}" style="display:inline-block;background-color:#dc2626;color:#ffffff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;">Reset Password</a>
          </p>
          <p style="margin:0;color:#6b7280;font-size:13px;">
            This link expires in {{expiryMinutes}} minutes. If you did not request a password reset, please ignore this email.
          </p>
        </td></tr>
        <tr><td style="background-color:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="margin:0;color:#9ca3af;font-size:12px;">&copy; 2024 Healthcare Plus Pharmacy. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
      variables: ["customerName", "resetLink", "expiryMinutes"],
    });
  }

  /**
   * Get a template by name. Throws if not found.
   * @param {string} templateName
   * @returns {Promise<object>}
   */
  async get(templateName) {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template ${templateName} not found`);
    }
    return template;
  }

  /**
   * Render a template with Handlebars, returning { subject, html }.
   * @param {object} template
   * @param {object} variables
   * @returns {{ subject: string, html: string }}
   */
  render(template, variables) {
    const subjectFn = Handlebars.compile(template.subject);
    const htmlFn = Handlebars.compile(template.html);

    return {
      subject: subjectFn(variables),
      html: htmlFn(variables),
    };
  }

  /**
   * Save a custom template to the DB and in-memory map.
   * @param {object} templateData - Must include name, subject, html, shopId
   * @returns {Promise<void>}
   */
  async create(templateData) {
    const { getShopDatabase } = require("../../config/database");
    const db = getShopDatabase(templateData.shopId);

    await db.collection("email_templates").insertOne({
      ...templateData,
      createdAt: new Date(),
    });

    this.templates.set(templateData.name, templateData);
  }

  /**
   * List built-in templates plus custom templates from DB for the given shop.
   * @param {string} shopId
   * @returns {Promise<object[]>}
   */
  async list(shopId) {
    const builtIn = Array.from(this.templates.values()).map((t) => ({
      ...t,
      isBuiltIn: true,
    }));

    const { getShopDatabase } = require("../../config/database");
    const db = getShopDatabase(shopId);

    const custom = await db
      .collection("email_templates")
      .find({ shopId })
      .toArray();

    return [...builtIn, ...custom];
  }

  /**
   * Delete a custom template from the DB.
   * Built-in templates cannot be deleted.
   * @param {string} templateName
   * @param {string} shopId
   * @returns {Promise<void>}
   */
  async delete(templateName, shopId) {
    const { getShopDatabase } = require("../../config/database");
    const db = getShopDatabase(shopId);

    await db
      .collection("email_templates")
      .deleteOne({ name: templateName, shopId });
  }

  /**
   * Render a template with sample data for preview purposes.
   * @param {string} templateName
   * @param {object} sampleData
   * @returns {Promise<{ subject: string, html: string }>}
   */
  async preview(templateName, sampleData) {
    const template = await this.get(templateName);
    return this.render(template, sampleData);
  }
}

module.exports = EmailTemplate;
