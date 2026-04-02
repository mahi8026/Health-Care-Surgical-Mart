/**
 * Webhook Handler Tests
 * Tests for SendGrid and Twilio webhook signature validation and route handlers
 */

const crypto = require("crypto");

// Mock external dependencies before any requires
jest.mock("twilio");
jest.mock("@sendgrid/mail");
jest.mock("@mailchimp/mailchimp_marketing");
jest.mock("bull");
jest.mock("ioredis");

// Set up env vars used by webhook validators
process.env.SENDGRID_WEBHOOK_SECRET = "test_sendgrid_secret";
process.env.TWILIO_AUTH_TOKEN = "test_twilio_auth_token";
process.env.TWILIO_ACCOUNT_SID = "ACtest";
process.env.TWILIO_PHONE_NUMBER = "+15005550006";

// Mock database with connectToDatabase included
const mockInsertOne = jest.fn().mockResolvedValue({ insertedId: "id1" });
const mockUpdateOne = jest.fn().mockResolvedValue({ modifiedCount: 1 });
jest.mock("../src/config/database", () => ({
  connectToDatabase: jest.fn().mockResolvedValue(true),
  closeDatabaseConnection: jest.fn().mockResolvedValue(true),
  getShopDatabase: jest.fn().mockReturnValue({
    collection: jest.fn().mockReturnValue({
      insertOne: mockInsertOne,
      updateOne: mockUpdateOne,
      find: jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) }),
    }),
  }),
}));

// Mock twilio validateRequest
const mockValidateRequest = jest.fn();
jest.mock("twilio", () => {
  return Object.assign(
    jest.fn().mockReturnValue({
      messages: { create: jest.fn().mockResolvedValue({ sid: "SM1", status: "queued", body: "test" }) },
    }),
    { validateRequest: mockValidateRequest }
  );
});

// Mock logging to avoid file system writes
jest.mock("../src/config/logging", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  setupLogging: jest.fn(),
}));

const request = require("supertest");
const express = require("express");

// Build a minimal express app with just the webhook routes
function buildTestApp() {
  const app = express();
  const sendgridRouter = require("../src/routes/webhooks/sendgrid.webhook");
  const twilioRouter = require("../src/routes/webhooks/twilio.webhook");
  app.use("/api/webhooks/sendgrid", sendgridRouter);
  app.use("/api/webhooks/twilio", twilioRouter);
  return app;
}

// Helper: build a valid SendGrid HMAC signature
function buildSendGridSignature(body, timestamp, secret) {
  const payload = timestamp + (typeof body === "string" ? body : body.toString("utf8"));
  return crypto.createHmac("sha256", secret).update(payload).digest("base64");
}

// --- SendGrid Webhook ---

describe("POST /api/webhooks/sendgrid", () => {
  let app;
  const TIMESTAMP = String(Math.floor(Date.now() / 1000));
  const EVENTS = JSON.stringify([
    { event: "delivered", sg_message_id: "msg-001", email: "user@example.com", timestamp: Math.floor(Date.now() / 1000) },
  ]);

  beforeEach(() => {
    jest.resetModules();
    mockInsertOne.mockClear();
    mockUpdateOne.mockClear();
    app = buildTestApp();
  });

  it("returns 403 when signature header is missing", async () => {
    const res = await request(app)
      .post("/api/webhooks/sendgrid")
      .set("Content-Type", "application/json")
      .send(EVENTS);

    expect(res.status).toBe(403);
  });

  it("returns 403 when signature is invalid", async () => {
    const res = await request(app)
      .post("/api/webhooks/sendgrid")
      .set("Content-Type", "application/json")
      .set("x-twilio-email-event-webhook-signature", "invalidsignature==")
      .set("x-twilio-email-event-webhook-timestamp", TIMESTAMP)
      .send(EVENTS);

    expect(res.status).toBe(403);
  });

  it("returns 200 and processes events with valid signature", async () => {
    const sig = buildSendGridSignature(EVENTS, TIMESTAMP, process.env.SENDGRID_WEBHOOK_SECRET);

    const res = await request(app)
      .post("/api/webhooks/sendgrid")
      .set("Content-Type", "application/json")
      .set("x-twilio-email-event-webhook-signature", sig)
      .set("x-twilio-email-event-webhook-timestamp", TIMESTAMP)
      .send(EVENTS);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.processed).toBe(1);
  });

  it("returns 400 for non-array body with valid signature", async () => {
    const body = JSON.stringify({ event: "delivered" });
    const sig = buildSendGridSignature(body, TIMESTAMP, process.env.SENDGRID_WEBHOOK_SECRET);

    const res = await request(app)
      .post("/api/webhooks/sendgrid")
      .set("Content-Type", "application/json")
      .set("x-twilio-email-event-webhook-signature", sig)
      .set("x-twilio-email-event-webhook-timestamp", TIMESTAMP)
      .send(body);

    expect(res.status).toBe(400);
  });
});

// --- Twilio Webhook ---

describe("POST /api/webhooks/twilio", () => {
  let app;

  beforeEach(() => {
    jest.resetModules();
    mockInsertOne.mockClear();
    mockUpdateOne.mockClear();
    mockValidateRequest.mockReset();
    app = buildTestApp();
  });

  it("returns 403 when Twilio signature is missing", async () => {
    mockValidateRequest.mockReturnValue(false);

    const res = await request(app)
      .post("/api/webhooks/twilio")
      .set("Content-Type", "application/x-www-form-urlencoded")
      .send("MessageSid=SM123&MessageStatus=delivered&To=%2B919876543210&From=%2B15005550006");

    expect(res.status).toBe(403);
  });

  it("returns 403 when Twilio signature is invalid", async () => {
    mockValidateRequest.mockReturnValue(false);

    const res = await request(app)
      .post("/api/webhooks/twilio")
      .set("Content-Type", "application/x-www-form-urlencoded")
      .set("x-twilio-signature", "bad-signature")
      .send("MessageSid=SM123&MessageStatus=delivered&To=%2B919876543210&From=%2B15005550006");

    expect(res.status).toBe(403);
  });

  it("returns 200 and updates sms_logs with valid signature", async () => {
    mockValidateRequest.mockReturnValue(true);

    const res = await request(app)
      .post("/api/webhooks/twilio")
      .set("Content-Type", "application/x-www-form-urlencoded")
      .set("x-twilio-signature", "valid-sig")
      .send("MessageSid=SM123&MessageStatus=delivered&To=%2B919876543210&From=%2B15005550006");

    expect(res.status).toBe(200);
    expect(mockUpdateOne).toHaveBeenCalledTimes(1);
    const [filter, update] = mockUpdateOne.mock.calls[0];
    expect(filter).toEqual({ messageId: "SM123" });
    expect(update.$set.status).toBe("delivered");
  });

  it("returns 400 when required fields are missing", async () => {
    mockValidateRequest.mockReturnValue(true);

    const res = await request(app)
      .post("/api/webhooks/twilio")
      .set("Content-Type", "application/x-www-form-urlencoded")
      .set("x-twilio-signature", "valid-sig")
      .send("To=%2B919876543210");

    expect(res.status).toBe(400);
  });
});
