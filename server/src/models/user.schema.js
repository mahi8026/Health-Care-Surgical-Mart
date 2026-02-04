/**
 * User Collection Schema
 * Stores user accounts with role-based access
 */

const userSchema = {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["name", "email", "passwordHash", "role"],
      properties: {
        _id: {
          bsonType: "objectId",
        },
        name: {
          bsonType: "string",
          description: "User full name - required",
        },
        email: {
          bsonType: "string",
          pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
          description: "User email - required and unique",
        },
        passwordHash: {
          bsonType: "string",
          description: "Bcrypt hashed password - required",
        },
        role: {
          enum: ["SUPER_ADMIN", "SHOP_ADMIN", "STAFF"],
          description: "User role - required",
        },
        phone: {
          bsonType: "string",
          description: "User phone number",
        },
        shopId: {
          bsonType: "string",
          description: "Shop identifier (for SHOP_ADMIN and STAFF)",
        },
        permissions: {
          bsonType: "array",
          description: "Array of specific permissions",
          items: {
            bsonType: "string",
          },
        },
        isActive: {
          bsonType: "bool",
          description: "User active status",
        },
        lastLogin: {
          bsonType: "date",
          description: "Last login timestamp",
        },
        createdBy: {
          bsonType: "objectId",
          description: "User who created this account",
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

const userIndexes = [
  { key: { email: 1 }, unique: true, name: "email_unique" },
  { key: { role: 1 }, name: "role_index" },
  { key: { shopId: 1 }, name: "shop_index" },
  { key: { isActive: 1 }, name: "active_status_index" },
];

module.exports = { userSchema, userIndexes };
