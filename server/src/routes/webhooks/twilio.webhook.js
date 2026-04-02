/**
 * Twilio Status Callback Webhook Handler
 * Receives SMS delivery status updates from Twilio
 *
 * Statuses handled: delivered, failed, undelivered, sent, queued
 * Authentication: Twilio request signature validation
 */

const express = require("express");
const router = express.Router();
const twilio = require("twilio");
const { getShopDatabase } = require("../../config/database");
const { logger } = require("../../config/logging");

/**
 * Validate Twilio webhook signature
 * @param {import('express').Request} req
 * @returns {boolean}
 */
function validateTwilioSignature(req) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    logger.warn("TWILIO_AUTH_TOKEN not configured");
    return false;
  }

  const twilioSignature = req.headers["x-twilio-signature"];
  if (!twilioSignature) {
    return false;
  }

  // Build the full URL that Twilio signed
  const protocol = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const url = `${protocol}://${host}${req.originalUrl}`;

  return twilio.validateRequest(authToken, twilioSignature, url, req.body);
}

/**
 * Map Twilio MessageStatus to internal sms_logs status
 * @param {string} messageStatus - Twilio MessageStatus value
 * @returns {string}
 */
function mapTwilioStatus(messageStatus) {
  const statusMap = {
    delivered: "delivered",
    failed: "failed",
    undelivered: "failed",
    sent: "sent",
    queued: "queued",
    sending: "sending",
    canceled: "cancelled",
  };
  return statusMap[messageStatus] || messageStatus;
}

/**
 * POST /api/webhooks/twilio
 * Receives Twilio status callback (application/x-www-form-urlencoded)
 */
router.post(
  "/",
  express.urlencoded({ extended: false }),
  async (req, res) => {
    // Validate Twilio signature
    if (!validateTwilioSignature(req)) {
      logger.warn("Twilio webhook: invalid signature");
      return res.status(403).send("Forbidden");
    }

    const {
      MessageSid,
      MessageStatus,
      To,
      From,
      ErrorCode,
      ErrorMessage,
    } = req.body;

    if (!MessageSid || !MessageStatus) {
      return res.status(400).send("Missing required fields");
    }

    try {
      const db = getShopDatabase("main_store");
      const status = mapTwilioStatus(MessageStatus);

      const updateFields = {
        status,
        updatedAt: new Date(),
      };

      if (MessageStatus === "delivered") {
        updateFields.deliveredAt = new Date();
      }

      if (ErrorCode) {
        updateFields.errorCode = ErrorCode;
        updateFields.errorMessage = ErrorMessage || null;
      }

      await db
        .collection("sms_logs")
        .updateOne({ messageId: MessageSid }, { $set: updateFields });

      logger.info(
        `Twilio webhook: ${MessageSid} status updated to ${MessageStatus}`,
      );

      // Twilio expects a 200 with empty TwiML or plain response
      res.status(200).send("");
    } catch (err) {
      logger.error("Twilio webhook: processing error", err.message);
      // Return 200 to avoid Twilio retrying on internal errors
      res.status(200).send("");
    }
  },
);

module.exports = router;
