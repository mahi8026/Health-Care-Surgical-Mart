/**
 * Email Service Tests
 * Tests for email.validator.js, EmailTemplate, and EmailService
 */

// Mock external dependencies before any requires
jest.mock("@sendgrid/mail");
jest.mock("@mailchimp/mailchimp_marketing");
jest.mock("bull");
jest.mock("ioredis");
jest.mock("../src/config/database");

const { validateEmail, validateEmailList, sanitizeEmail } = require("../src/services/email/email.validator");
const EmailTemplate = require("../src/services/email/email.template");

// --- email.validator.js ---

describe("email.validator - validateEmail", () => {
  it("accepts valid email addresses", () => {
    expect(validateEmail("user@example.com")).toBe(true);
    expect(validateEmail("user.name+tag@sub.domain.org")).toBe(true);
  });

  it("rejects addresses without @", () => {
    expect(validateEmail("userexample.com")).toBe(false);
  });

  it("rejects addresses without domain", () => {
    expect(validateEmail("user@")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(validateEmail("")).toBe(false);
  });

  it("rejects addresses with spaces", () => {
    expect(validateEmail("user @example.com")).toBe(false);
  });
});

describe("email.validator - validateEmailList", () => {
  it("splits valid and invalid emails correctly", () => {
    const result = validateEmailList([
      "good@example.com",
      "bad-email",
      "also.good@test.org",
      "missing-at.com",
    ]);
    expect(result.valid).toEqual(["good@example.com", "also.good@test.org"]);
    expect(result.invalid).toEqual(["bad-email", "missing-at.com"]);
  });

  it("returns empty arrays for empty input", () => {
    const result = validateEmailList([]);
    expect(result.valid).toHaveLength(0);
    expect(result.invalid).toHaveLength(0);
  });

  it("handles all-valid list", () => {
    const emails = ["a@b.com", "c@d.org"];
    const result = validateEmailList(emails);
    expect(result.valid).toHaveLength(2);
    expect(result.invalid).toHaveLength(0);
  });
});

describe("email.validator - sanitizeEmail", () => {
  it("lowercases the email", () => {
    expect(sanitizeEmail("User@Example.COM")).toBe("user@example.com");
  });

  it("trims surrounding whitespace", () => {
    expect(sanitizeEmail("  user@example.com  ")).toBe("user@example.com");
  });

  it("handles already clean email", () => {
    expect(sanitizeEmail("user@example.com")).toBe("user@example.com");
  });
});

// --- EmailTemplate ---

describe("EmailTemplate - get()", () => {
  let tmpl;

  beforeEach(() => {
    tmpl = new EmailTemplate();
  });

  it("returns a built-in template by name", async () => {
    const t = await tmpl.get("order_confirmation");
    expect(t).toBeDefined();
    expect(t.name).toBe("order_confirmation");
    expect(t.subject).toBeDefined();
    expect(t.html).toBeDefined();
  });

  it("throws for an unknown template name", async () => {
    await expect(tmpl.get("no_such_template")).rejects.toThrow("Template no_such_template not found");
  });
});

describe("EmailTemplate - render()", () => {
  let tmpl;

  beforeEach(() => {
    tmpl = new EmailTemplate();
  });

  it("renders subject and html with provided variables", async () => {
    const t = await tmpl.get("order_confirmation");
    const { subject, html } = tmpl.render(t, {
      customerName: "Priya",
      orderNo: "ORD-999",
      orderDate: "2024-01-01",
      items: [],
      total: "1500",
    });
    expect(subject).toContain("ORD-999");
    expect(html).toBeDefined();
    expect(typeof html).toBe("string");
  });

  it("renders welcome_email template", async () => {
    const t = await tmpl.get("welcome_email");
    const { subject, html } = tmpl.render(t, {
      customerName: "Amit",
      storeName: "Healthcare Plus",
    });
    expect(subject).toContain("Healthcare Plus");
    expect(html).toContain("Amit");
  });

  it("renders with missing variables gracefully (Handlebars leaves them empty)", async () => {
    const t = await tmpl.get("welcome_email");
    // Handlebars renders missing vars as empty string — no throw
    const { subject } = tmpl.render(t, {});
    expect(typeof subject).toBe("string");
  });
});

// --- EmailService ---

describe("EmailService", () => {
  let emailService;
  let mockSgSend;
  let mockDbInsert;

  beforeEach(() => {
    jest.resetModules();

    // Mock SendGrid
    mockSgSend = jest.fn().mockResolvedValue([{ headers: { "x-message-id": "sg-msg-001" } }]);
    const sgMail = require("@sendgrid/mail");
    sgMail.setApiKey = jest.fn();
    sgMail.send = mockSgSend;

    // Mock Mailchimp
    const mailchimp = require("@mailchimp/mailchimp_marketing");
    mailchimp.setConfig = jest.fn();
    mailchimp.campaigns = {
      create: jest.fn().mockResolvedValue({ id: "mc-campaign-1", web_id: 42 }),
      setContent: jest.fn().mockResolvedValue({}),
      send: jest.fn().mockResolvedValue({}),
    };
    mailchimp.lists = {
      batchListMembers: jest.fn().mockResolvedValue({
        new_members: [],
        updated_members: [],
        errors: [],
      }),
    };

    // Mock Bull
    jest.mock("bull", () => jest.fn().mockImplementation(() => ({
      process: jest.fn(),
      on: jest.fn(),
      add: jest.fn().mockResolvedValue({ id: "job-1" }),
      addBulk: jest.fn().mockResolvedValue([]),
    })));

    // Mock database
    mockDbInsert = jest.fn().mockResolvedValue({ insertedId: "xyz" });
    jest.mock("../src/config/database", () => ({
      getShopDatabase: jest.fn().mockReturnValue({
        collection: jest.fn().mockReturnValue({
          insertOne: mockDbInsert,
          find: jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) }),
        }),
      }),
    }));

    // Re-require after mocks are set up
    jest.mock("@sendgrid/mail", () => ({
      setApiKey: jest.fn(),
      send: mockSgSend,
    }));

    emailService = require("../src/services/email/email.service");
  });

  describe("validateEmail", () => {
    it("returns true for a valid email", () => {
      expect(emailService.validateEmail("test@example.com")).toBe(true);
    });

    it("returns false for an invalid email", () => {
      expect(emailService.validateEmail("not-an-email")).toBe(false);
    });
  });

  describe("sendOrderConfirmation", () => {
    it("calls sendgrid with order and customer data", async () => {
      const order = {
        invoiceNo: "INV-001",
        saleDate: "2024-01-15",
        items: [],
        grandTotal: 2500,
        shopId: "shop_1",
      };
      const customer = {
        name: "Sunita Sharma",
        email: "sunita@example.com",
      };

      const result = await emailService.sendOrderConfirmation(order, customer);
      expect(mockSgSend).toHaveBeenCalledTimes(1);
      const callArg = mockSgSend.mock.calls[0][0];
      expect(callArg.to).toBe("sunita@example.com");
      expect(callArg.subject).toContain("INV-001");
    });

    it("throws for invalid customer email", async () => {
      const order = { invoiceNo: "INV-002", saleDate: "2024-01-15", items: [], grandTotal: 100, shopId: "shop_1" };
      const customer = { name: "Bad User", email: "not-valid" };

      await expect(emailService.sendOrderConfirmation(order, customer)).rejects.toThrow("Invalid email address");
    });
  });
});
