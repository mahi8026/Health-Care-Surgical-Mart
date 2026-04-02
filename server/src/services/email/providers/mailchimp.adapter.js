// server/src/services/email/providers/mailchimp.adapter.js
const mailchimp = require("@mailchimp/mailchimp_marketing");
const BaseEmailAdapter = require("./base.adapter");

class MailchimpAdapter extends BaseEmailAdapter {
  constructor() {
    super();
    mailchimp.setConfig({
      apiKey: process.env.MAILCHIMP_API_KEY,
      server: process.env.MAILCHIMP_SERVER_PREFIX,
    });
    this.listId = process.env.MAILCHIMP_LIST_ID;
    this.fromEmail = process.env.SENDGRID_FROM_EMAIL; // shared sender
  }

  /**
   * Mailchimp is primarily a campaign/marketing tool.
   * sendEmail here creates and immediately sends a single campaign.
   */
  async sendEmail(to, subject, content, options = {}) {
    if (!this.validateEmail(to)) {
      return {
        success: false,
        error: "Invalid email address",
        provider: "mailchimp",
      };
    }

    try {
      // Add recipient to list first
      await mailchimp.lists.addListMember(this.listId, {
        email_address: to,
        status: "subscribed",
      });

      // Create a single-recipient campaign
      const campaign = await mailchimp.campaigns.create({
        type: "regular",
        recipients: { list_id: this.listId },
        settings: {
          subject_line: subject,
          from_name: options.fromName || "Healthcare Plus",
          reply_to: options.replyTo || this.fromEmail,
          title: options.title || subject,
        },
      });

      await mailchimp.campaigns.setContent(campaign.id, { html: content });
      await mailchimp.campaigns.send(campaign.id);

      return {
        success: true,
        messageId: campaign.id,
        provider: "mailchimp",
        status: "sent",
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        provider: "mailchimp",
      };
    }
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

  async getEmailStats(campaignId) {
    try {
      const report = await mailchimp.reports.getCampaignReport(campaignId);

      return {
        delivered: report.emails_sent > 0,
        opened: report.opens.opens_total > 0,
        clicked: report.clicks.clicks_total > 0,
        bounced: false,
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
