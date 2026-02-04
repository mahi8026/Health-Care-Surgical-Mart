/**
 * Shop Collection Schema (System Database)
 * Stores information about all registered shops
 */

const shopSchema = {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["shopId", "shopName", "ownerName", "ownerEmail", "status"],
      properties: {
        _id: {
          bsonType: "objectId",
        },
        shopId: {
          bsonType: "string",
          description: "Unique shop identifier - required",
        },
        shopName: {
          bsonType: "string",
          description: "Shop/business name - required",
        },
        ownerName: {
          bsonType: "string",
          description: "Shop owner name - required",
        },
        ownerEmail: {
          bsonType: "string",
          pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
          description: "Shop owner email - required",
        },
        ownerPhone: {
          bsonType: "string",
          description: "Shop owner phone",
        },
        address: {
          bsonType: "string",
          description: "Shop address",
        },
        city: {
          bsonType: "string",
          description: "City",
        },
        state: {
          bsonType: "string",
          description: "State/Province",
        },
        country: {
          bsonType: "string",
          description: "Country",
        },
        licenseNo: {
          bsonType: "string",
          description: "Medical store license number",
        },
        gstNo: {
          bsonType: "string",
          description: "GST/Tax registration number",
        },
        status: {
          enum: ["Active", "Suspended", "Inactive"],
          description: "Shop status - required",
        },
        subscriptionPlan: {
          enum: ["Trial", "Basic", "Premium", "Enterprise"],
          description: "Subscription plan",
        },
        subscriptionExpiry: {
          bsonType: "date",
          description: "Subscription expiry date",
        },
        maxUsers: {
          bsonType: "int",
          minimum: 1,
          description: "Maximum allowed users",
        },
        currentUsers: {
          bsonType: "int",
          minimum: 0,
          description: "Current number of users",
        },
        createdBy: {
          bsonType: "objectId",
          description: "Super admin who created this shop",
        },
        createdAt: {
          bsonType: "date",
          description: "Record creation timestamp",
        },
        updatedAt: {
          bsonType: "date",
          description: "Record update timestamp",
        },
      },
    },
  },
};

const shopIndexes = [
  { key: { shopId: 1 }, unique: true, name: "shop_id_unique" },
  { key: { ownerEmail: 1 }, unique: true, name: "owner_email_unique" },
  { key: { status: 1 }, name: "status_index" },
  { key: { subscriptionExpiry: 1 }, name: "subscription_expiry_index" },
];

module.exports = { shopSchema, shopIndexes };
