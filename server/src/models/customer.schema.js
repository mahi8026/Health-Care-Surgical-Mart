/**
 * Customer Collection Schema
 * Stores customer information
 */

const customerSchema = {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["name", "phone", "type"],
      properties: {
        _id: {
          bsonType: "objectId",
        },
        name: {
          bsonType: "string",
          description: "Customer name - required",
        },
        phone: {
          bsonType: "string",
          pattern: "^[0-9]{10,15}$",
          description: "Customer phone number - required",
        },
        email: {
          bsonType: "string",
          pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
          description: "Customer email address",
        },
        address: {
          bsonType: "string",
          description: "Customer address",
        },
        type: {
          enum: ["Retail", "Wholesale"],
          description: "Customer type - Retail or Wholesale - required",
        },
        creditLimit: {
          bsonType: "double",
          minimum: 0,
          description: "Credit limit for wholesale customers",
        },
        outstandingBalance: {
          bsonType: "double",
          minimum: 0,
          description: "Outstanding balance",
        },
        isActive: {
          bsonType: "bool",
          description: "Customer active status",
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

const customerIndexes = [
  { key: { phone: 1 }, unique: true, name: "phone_unique" },
  { key: { name: 1 }, name: "name_index" },
  { key: { type: 1 }, name: "type_index" },
  { key: { isActive: 1 }, name: "active_status_index" },
  { key: { name: "text" }, name: "text_search_index" },
];

module.exports = { customerSchema, customerIndexes };
