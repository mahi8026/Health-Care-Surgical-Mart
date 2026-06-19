/**
 * Email Templates - entry point
 * 
 * Available templates:
 * - welcome_email: Welcome new users
 * - order_confirmation: Order/sale confirmation
 * - invoice_email: Invoice with detailed items
 * - expiry_alert: Stock expiry alert notification (Phase 3: FEFO)
 */

const fs = require('fs');
const path = require('path');

const templates = {
  welcome_email: fs.readFileSync(path.join(__dirname, 'welcome_email.html'), 'utf-8'),
  order_confirmation: fs.readFileSync(path.join(__dirname, 'order_confirmation.html'), 'utf-8'),
  invoice_email: fs.readFileSync(path.join(__dirname, 'invoice_email.html'), 'utf-8'),
  expiry_alert: fs.readFileSync(path.join(__dirname, 'expiry_alert.html'), 'utf-8'),
};

module.exports = templates;
