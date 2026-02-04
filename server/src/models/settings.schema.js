/**
 * Settings Collection Schema
 * Stores various system settings and configurations
 */

const settingsSchema = {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["type"],
      properties: {
        _id: {
          bsonType: "objectId",
        },
        type: {
          enum: ["shop", "tax", "system", "receipt"],
          description: "Type of settings - required",
        },
        // Shop settings
        name: {
          bsonType: "string",
          description: "Shop name",
        },
        address: {
          bsonType: "string",
          description: "Shop address",
        },
        phone: {
          bsonType: "string",
          description: "Shop phone number",
        },
        email: {
          bsonType: "string",
          description: "Shop email address",
        },
        website: {
          bsonType: "string",
          description: "Shop website URL",
        },
        logo: {
          bsonType: "string",
          description: "Shop logo URL or path",
        },
        description: {
          bsonType: "string",
          description: "Shop description",
        },
        registrationNumber: {
          bsonType: "string",
          description: "Business registration number",
        },
        taxNumber: {
          bsonType: "string",
          description: "Tax registration number",
        },
        currency: {
          bsonType: "string",
          description: "Default currency code",
        },
        timezone: {
          bsonType: "string",
          description: "Shop timezone",
        },
        // Tax settings
        defaultTaxRate: {
          bsonType: "double",
          minimum: 0,
          maximum: 100,
          description: "Default tax rate percentage",
        },
        enableTax: {
          bsonType: "bool",
          description: "Enable tax calculations",
        },
        taxName: {
          bsonType: "string",
          description: "Tax name (VAT, GST, etc.)",
        },
        taxInclusive: {
          bsonType: "bool",
          description: "Tax inclusive pricing",
        },
        // System settings
        lowStockThreshold: {
          bsonType: "int",
          minimum: 1,
          description: "Low stock alert threshold",
        },
        autoBackup: {
          bsonType: "bool",
          description: "Enable automatic backups",
        },
        backupFrequency: {
          enum: ["daily", "weekly", "monthly"],
          description: "Backup frequency",
        },
        emailNotifications: {
          bsonType: "bool",
          description: "Enable email notifications",
        },
        smsNotifications: {
          bsonType: "bool",
          description: "Enable SMS notifications",
        },
        printReceipts: {
          bsonType: "bool",
          description: "Auto print receipts",
        },
        defaultPaymentMethod: {
          enum: ["cash", "card", "bank", "mobile"],
          description: "Default payment method",
        },
        invoicePrefix: {
          bsonType: "string",
          description: "Invoice number prefix",
        },
        invoiceStartNumber: {
          bsonType: "int",
          minimum: 1,
          description: "Starting invoice number",
        },
        dateFormat: {
          enum: ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"],
          description: "Date display format",
        },
        timeFormat: {
          enum: ["12", "24"],
          description: "Time display format",
        },
        // Receipt settings
        showLogo: {
          bsonType: "bool",
          description: "Show logo on receipts",
        },
        showAddress: {
          bsonType: "bool",
          description: "Show address on receipts",
        },
        showPhone: {
          bsonType: "bool",
          description: "Show phone on receipts",
        },
        showEmail: {
          bsonType: "bool",
          description: "Show email on receipts",
        },
        showWebsite: {
          bsonType: "bool",
          description: "Show website on receipts",
        },
        footerText: {
          bsonType: "string",
          description: "Receipt footer text",
        },
        headerText: {
          bsonType: "string",
          description: "Receipt header text",
        },
        paperSize: {
          enum: ["80mm", "58mm", "A4"],
          description: "Receipt paper size",
        },
        // Audit fields
        createdAt: {
          bsonType: "date",
          description: "Record creation timestamp",
        },
        updatedAt: {
          bsonType: "date",
          description: "Record update timestamp",
        },
        createdBy: {
          bsonType: "objectId",
          description: "User who created the record",
        },
        updatedBy: {
          bsonType: "objectId",
          description: "User who last updated the record",
        },
      },
    },
  },
};

const settingsIndexes = [
  { key: { type: 1 }, unique: true, name: "type_unique" },
  { key: { updatedAt: -1 }, name: "updated_desc" },
];

// Backup History Schema
const backupHistorySchema = {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["shopId", "timestamp", "type", "status"],
      properties: {
        _id: {
          bsonType: "objectId",
        },
        shopId: {
          bsonType: "string",
          description: "Shop identifier - required",
        },
        timestamp: {
          bsonType: "date",
          description: "Backup timestamp - required",
        },
        type: {
          enum: ["manual", "automatic", "scheduled"],
          description: "Backup type - required",
        },
        status: {
          enum: ["pending", "in_progress", "completed", "failed"],
          description: "Backup status - required",
        },
        size: {
          bsonType: "string",
          description: "Backup file size",
        },
        collections: {
          bsonType: "array",
          items: {
            bsonType: "string",
          },
          description: "List of backed up collections",
        },
        filePath: {
          bsonType: "string",
          description: "Backup file path",
        },
        error: {
          bsonType: "string",
          description: "Error message if backup failed",
        },
        createdBy: {
          bsonType: "objectId",
          description: "User who initiated the backup",
        },
      },
    },
  },
};

const backupHistoryIndexes = [
  { key: { shopId: 1, timestamp: -1 }, name: "shop_timestamp_desc" },
  { key: { status: 1 }, name: "status_index" },
  { key: { type: 1 }, name: "type_index" },
];

module.exports = {
  settingsSchema,
  settingsIndexes,
  backupHistorySchema,
  backupHistoryIndexes,
};
