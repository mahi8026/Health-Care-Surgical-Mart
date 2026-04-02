/**
 * SendGrid Event Webhook Handler
 * Receives delivery events from SendGrid and updates email logs
 *
 * Events handled: delivered, open, click, bounce, unsubscribe
 * Authentication: HMAC signature validation using SENDGRID_WEBHOOK_SECRET
 */

const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const { getShopDatabase } = require("../../config/database");
const { logger } = require("../../config/logging");

/**
 * Validate SendGrid webhook signature
 * Uses timing-safe comparison to prevent timing attacks
 * @param {Buffer} rawBody - Raw request body buffer
 * @param {string} signature - X-Twilio-Email-Event-Webhook-Signature header
 * @param {string} timestamp - X-Twilio-Email-Event-Webhook-Timestamp header
 * @returns {boolean}
 */
function validateSendGridSignature(rawBody, signature, timestamp) {
  const secret = process.env.SENDGRID_WEBHOOK_SECRET;
  if (!secret) {
    logger.warn("SENDGRID_WEBHOOK_SECRET not configured");
    return false;
  }

  if (!signature || !timestamp) {
    return false;
  }

  try {
    // SendGrid signs: timestamp + rawBody
    const payload = timestamp + rawBody.toString("utf8");
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(payload);
    const expectedSignature = hmac.digest("base64");

    const sigBuffer = Buffer.from(signature, "base64");
    const expectedBuffer = Buffer.from(expectedSignature, "base64");

    if (sigBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  } catch (err) {
    logger.error("SendGrid signature validation error:", err.message);
    return false;
  }
}

/**
 * Map SendGrid event type to email_logs status
 * @param {string} event - SendGrid event name
 * @returns {string} status value
 */
function mapEventToStatus(event) {
  const statusMap = {
    delivered: "delivered",
    open: "opened",
    click: "clicked",
    bounce: "bounced",
    unsubscribe: "unsubscribed",
    spamreport: "spam",
    deferred: "deferred",
    dropped: "dropped",
  };
  return statusMap[event] || event;
}

/**
 * POST /api/webhooks/sendgrid
 * Receives SendGrid event webhook payload (array of events)
 */
router.post(
  "/",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["x-twilio-email-event-webhook-signature"];
    const timestamp = req.headers["x-twilio-email-event-webhook-timestamp"];

    // Validate signature
    if (!validateSendGridSignature(req.body, signature, timestamp)) {
      logger.warn("SendGrid webhook: invalid signature");
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    let events;
    try {
      events = JSON.parse(req.body.toString("utf8"));
    } catch (err) {
      logger.error("SendGrid webhook: failed to parse body", err.message);
      return res.status(400).json({ success: false, message: "Invalid JSON" });
    }

    if (!Array.isArray(events)) {
      return res
        .status(400)
        .json({ success: false, message: "Expected array of events" });
    }

    try {
      // Use a shared/system-level store for webhook events
      // shopId is embedded in customArgs sent during email dispatch
      const db = getShopDatabase("main_store");

      for (const event of events) {
        const {
          event: eventType,
          sg_message_id,
          email,
          timestamp: eventTimestamp,
          shopId,
          ...rest
        } = event;

        const eventDoc = {
          event: eventType,
          messageId: sg_message_id,
          email,
          shopId: shopId || null,
          timestamp: eventTimestamp
            ? new Date(eventTimestamp * 1000)
            : new Date(),
          raw: rest,
          receivedAt: new Date(),
        };

        // Store event in email_events collection
        await db.collection("email_events").insertOne(eventDoc);

        // Update email_logs status if we have a messageId
        if (sg_message_id) {
          const status = mapEventToStatus(eventType);
          const updateFields = { status };

          if (eventType === "delivered") updateFields.deliveredAt = new Date();
          if (eventType === "open") updateFields.openedAt = new Date();
          if (eventType === "click") updateFields.clickedAt = new Date();

          await db.collection("email_logs").updateOne(
            { messageId: sg_message_id },
            { $set: updateFields },
          );
        }
      }

      logger.info(`SendGrid webhook: processed ${events.length} event(s)`);
      res.status(200).json({ success: true, processed: events.length });
    } catch (err) {
      logger.error("SendGrid webhook: processing error", err.message);
      // Return 200 to prevent SendGrid from retrying on our internal errors
      res.status(200).json({ success: false, message: "Processing error" });
    }
  },
);

module.exports = router;
