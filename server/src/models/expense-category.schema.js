/**
 * Expense Category Collection Schema
 * Stores expense categories for organizing expenses
 */

const expenseCategorySchema = {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["name", "type", "isActive"],
      properties: {
        _id: {
          bsonType: "objectId",
        },
        name: {
          bsonType: "string",
          minLength: 1,
          maxLength: 100,
          description: "Category name - required",
        },
        description: {
          bsonType: "string",
          maxLength: 500,
          description: "Category description",
        },
        type: {
          enum: ["Fixed", "Variable", "One-time"],
          description: "Expense type - required",
        },
        isActive: {
          bsonType: "bool",
          description: "Active status - required",
        },
        isDefault: {
          bsonType: "bool",
          description: "System default category",
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

const expenseCategoryIndexes = [
  { key: { name: 1 }, unique: true, name: "name_unique" },
  { key: { type: 1 }, name: "type_index" },
  { key: { isActive: 1 }, name: "active_index" },
  { key: { isDefault: 1 }, name: "default_index" },
];

module.exports = { expenseCategorySchema, expenseCategoryIndexes };
