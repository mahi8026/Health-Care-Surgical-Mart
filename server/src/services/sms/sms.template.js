// server/src/services/sms/sms.template.js

class SMSTemplate {
  constructor() {
    this.templates = new Map();
    this.loadTemplates();
  }

  loadTemplates() {
    this.templates.set('test_sms', {
      name: 'test_sms',
      content: 'This is a test SMS from Health Care Surgical Mart. Your SMS system is working correctly!',
      variables: [],
      dltId: null,
      category: 'transactional',
    });

    this.templates.set('order_confirmation', {
      name: 'order_confirmation',
      content:
        'Hi {{customerName}}, your order #{{orderNo}} has been confirmed. Total: ₹{{amount}}. Thank you!',
      variables: ['customerName', 'orderNo', 'amount'],
      dltId: 'DLT_TEMPLATE_ID_1',
      category: 'transactional',
    });

    this.templates.set('order_ready', {
      name: 'order_ready',
      content:
        'Hi {{customerName}}, your order #{{orderNo}} is ready for pickup at {{storeName}}.',
      variables: ['customerName', 'orderNo', 'storeName'],
      dltId: 'DLT_TEMPLATE_ID_2',
      category: 'transactional',
    });

    this.templates.set('otp', {
      name: 'otp',
      content:
        'Your OTP is {{otp}}. Valid for {{validity}} minutes. Do not share.',
      variables: ['otp', 'validity'],
      dltId: 'DLT_TEMPLATE_ID_3',
      category: 'transactional',
    });

    this.templates.set('promotional_offer', {
      name: 'promotional_offer',
      content:
        '{{storeName}}: {{offerText}}. Valid till {{validTill}}. Visit us today!',
      variables: ['storeName', 'offerText', 'validTill'],
      dltId: 'DLT_TEMPLATE_ID_4',
      category: 'promotional',
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
   * Render a template by replacing {{variable}} placeholders.
   * Throws if any placeholders remain after substitution.
   * @param {object} template
   * @param {object} variables - Key/value pairs to substitute
   * @returns {string}
   */
  render(template, variables) {
    let message = template.content;

    for (const [key, value] of Object.entries(variables)) {
      message = message.replace(`{{${key}}}`, value);
    }

    if (message.includes('{{')) {
      throw new Error('Missing template variables');
    }

    return message;
  }

  /**
   * Save a custom template to the DB and in-memory map.
   * @param {object} templateData - Must include name, content, shopId
   * @returns {Promise<void>}
   */
  async create(templateData) {
    const { getShopDatabase } = require('../../config/database');
    const db = getShopDatabase(templateData.shopId);

    await db.collection('sms_templates').insertOne({
      ...templateData,
      createdAt: new Date(),
    });

    this.templates.set(templateData.name, templateData);
  }

  /**
   * List all templates — built-in plus custom templates from DB for the given shop.
   * @param {string} shopId
   * @returns {Promise<object[]>}
   */
  async list(shopId) {
    const builtIn = Array.from(this.templates.values());

    const { getShopDatabase } = require('../../config/database');
    const db = getShopDatabase(shopId);

    const custom = await db
      .collection('sms_templates')
      .find({ shopId })
      .toArray();

    return [...builtIn, ...custom];
  }

  /**
   * Delete a custom template from the DB (built-in templates cannot be deleted).
   * @param {string} templateName
   * @param {string} shopId
   * @returns {Promise<void>}
   */
  async delete(templateName, shopId) {
    const { getShopDatabase } = require('../../config/database');
    const db = getShopDatabase(shopId);

    await db.collection('sms_templates').deleteOne({ name: templateName, shopId });
  }
}

module.exports = SMSTemplate;
