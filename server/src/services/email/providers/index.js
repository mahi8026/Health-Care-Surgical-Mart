// Email Providers - entry point
const BaseEmailAdapter = require('./base.adapter');
const SendGridAdapter = require('./sendgrid.adapter');
const MailchimpAdapter = require('./mailchimp.adapter');

module.exports = { BaseEmailAdapter, SendGridAdapter, MailchimpAdapter };
