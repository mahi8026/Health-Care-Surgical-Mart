/**
 * SMS Service Tests
 * Tests for sms.validator.js, sms.template.js, and SMSService
 */

// Mock external dependencies before any requires
jest.mock("twilio");
jest.mock("bull");
jest.mock("ioredis");
jest.mock("../src/config/database");

const { validatePhoneNumber, formatPhoneNumber, isValidIndianNumber } = require("../src/services/sms/sms.validator");
const SMSTemplate = require("../src/services/sms/sms.template");

// --- sms.validator.js ---

describe("sms.validator - validatePhoneNumber", () => {
  it("accepts valid E.164 numbers", () => {
    expect(validatePhoneNumber("+919876543210")).toBe(true);
    expect(validatePhoneNumber("+14155552671")).toBe(true);
    expect(validatePhoneNumber("+447911123456")).toBe(true);
  });

  it("rejects numbers without leading +", () => {
    expect(validatePhoneNumber("919876543210")).toBe(false);
  });

  it("rejects numbers with spaces or dashes", () => {
    expect(validatePhoneNumber("+91 98765 43210")).toBe(false);
    expect(validatePhoneNumber("+91-9876543210")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(validatePhoneNumber("")).toBe(false);
  });

  it("rejects numbers that are too long (>15 digits)", () => {
    expect(validatePhoneNumber("+1234567890123456")).toBe(false);
  });
});

describe("sms.validator - formatPhoneNumber", () => {
  it("returns E.164 number unchanged", () => {
    expect(formatPhoneNumber("+919876543210")).toBe("+919876543210");
  });

  it("prepends country code to a bare 10-digit number", () => {
    expect(formatPhoneNumber("9876543210", "91")).toBe("+919876543210");
  });

  it("strips leading zeros before prepending country code", () => {
    expect(formatPhoneNumber("09876543210", "91")).toBe("+919876543210");
  });

  it("strips non-digit characters (spaces, dashes)", () => {
    expect(formatPhoneNumber("98765-43210", "91")).toBe("+9198765-43210".replace("-", ""));
  });

  it("defaults to Indian country code 91", () => {
    expect(formatPhoneNumber("9876543210")).toBe("+919876543210");
  });
});

describe("sms.validator - isValidIndianNumber", () => {
  it("accepts valid Indian E.164 numbers", () => {
    expect(isValidIndianNumber("+919876543210")).toBe(true);
    expect(isValidIndianNumber("+916543210987")).toBe(true);
  });

  it("accepts valid 10-digit local numbers starting with 6-9", () => {
    expect(isValidIndianNumber("9876543210")).toBe(true);
    expect(isValidIndianNumber("7654321098")).toBe(true);
    expect(isValidIndianNumber("6543210987")).toBe(true);
  });

  it("rejects numbers starting with digits below 6", () => {
    expect(isValidIndianNumber("5876543210")).toBe(false);
    expect(isValidIndianNumber("+915876543210")).toBe(false);
  });

  it("rejects numbers with wrong length", () => {
    expect(isValidIndianNumber("987654321")).toBe(false);   // 9 digits
    expect(isValidIndianNumber("98765432101")).toBe(false); // 11 digits
  });
});

// --- sms.template.js ---

describe("SMSTemplate - get()", () => {
  let tmpl;

  beforeEach(() => {
    tmpl = new SMSTemplate();
  });

  it("returns a built-in template by name", async () => {
    const t = await tmpl.get("otp");
    expect(t).toBeDefined();
    expect(t.name).toBe("otp");
    expect(t.content).toContain("{{otp}}");
  });

  it("throws for an unknown template name", async () => {
    await expect(tmpl.get("nonexistent_template")).rejects.toThrow("Template nonexistent_template not found");
  });
});

describe("SMSTemplate - render()", () => {
  let tmpl;

  beforeEach(() => {
    tmpl = new SMSTemplate();
  });

  it("renders a template with all variables provided", async () => {
    const t = await tmpl.get("otp");
    const result = tmpl.render(t, { otp: "123456", validity: "10" });
    expect(result).toContain("123456");
    expect(result).toContain("10");
    expect(result).not.toContain("{{");
  });

  it("renders order_confirmation template correctly", async () => {
    const t = await tmpl.get("order_confirmation");
    const result = tmpl.render(t, {
      customerName: "Ravi",
      orderNo: "ORD-001",
      amount: "500",
    });
    expect(result).toContain("Ravi");
    expect(result).toContain("ORD-001");
    expect(result).toContain("500");
  });

  it("throws when template variables are missing", async () => {
    const t = await tmpl.get("otp");
    // Only provide otp, omit validity
    expect(() => tmpl.render(t, { otp: "123456" })).toThrow("Missing template variables");
  });
});

// --- SMSService ---

describe("SMSService", () => {
  let SMSService;
  let mockTwilioSend;
  let mockQueueAddBulk;
  let mockDbInsert;

  beforeEach(() => {
    jest.resetModules();

    // Mock Bull queue
    mockQueueAddBulk = jest.fn().mockResolvedValue([]);
    const mockQueueProcess = jest.fn();
    const mockQueueOn = jest.fn();
    const mockQueueAdd = jest.fn().mockResolvedValue({ id: "job-1" });

    jest.mock("bull", () => {
      return jest.fn().mockImplementation(() => ({
        process: mockQueueProcess,
        on: mockQueueOn,
        add: mockQueueAdd,
        addBulk: mockQueueAddBulk,
        getWaitingCount: jest.fn().mockResolvedValue(0),
        getActiveCount: jest.fn().mockResolvedValue(0),
        getCompletedCount: jest.fn().mockResolvedValue(0),
        getFailedCount: jest.fn().mockResolvedValue(0),
      }));
    });

    // Mock Twilio
    mockTwilioSend = jest.fn().mockResolvedValue({
      sid: "SM123",
      status: "queued",
      body: "test message",
    });
    jest.mock("twilio", () => {
      return jest.fn().mockReturnValue({
        messages: {
          create: mockTwilioSend,
        },
      });
    });

    // Mock database
    mockDbInsert = jest.fn().mockResolvedValue({ insertedId: "abc" });
    jest.mock("../src/config/database", () => ({
      getShopDatabase: jest.fn().mockReturnValue({
        collection: jest.fn().mockReturnValue({
          insertOne: mockDbInsert,
          find: jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) }),
        }),
      }),
    }));

    SMSService = require("../src/services/sms/sms.service");
  });

  describe("validatePhoneNumber", () => {
    it("returns true for valid E.164 number", () => {
      expect(SMSService.validatePhoneNumber("+919876543210")).toBe(true);
    });

    it("returns false for invalid number", () => {
      expect(SMSService.validatePhoneNumber("not-a-number")).toBe(false);
    });
  });

  describe("sendOTP", () => {
    it("calls the provider and returns a result", async () => {
      const result = await SMSService.sendOTP("+919876543210", "654321");
      expect(mockTwilioSend).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
      expect(result.messageId).toBe("SM123");
    });

    it("logs the SMS to the database", async () => {
      await SMSService.sendOTP("+919876543210", "654321");
      expect(mockDbInsert).toHaveBeenCalledTimes(1);
    });
  });

  describe("sendBulkSMS", () => {
    it("queues jobs for each recipient", async () => {
      const recipients = ["+919876543210", "+919876543211", "+919876543212"];
      const result = await SMSService.sendBulkSMS(recipients, "Hello!", {});
      expect(result.success).toBe(true);
      expect(result.queued).toBe(3);
      expect(mockQueueAddBulk).toHaveBeenCalledTimes(1);
    });

    it("returns estimated time proportional to recipient count", async () => {
      const recipients = ["+919876543210", "+919876543211", "+919876543212", "+919876543213"];
      const result = await SMSService.sendBulkSMS(recipients, "Promo!", {});
      expect(result.estimatedTime).toBe(recipients.length * 0.5);
    });
  });
});
