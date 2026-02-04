/**
 * Expense Collection Schema
 * Stores all expense transactions
 */

const expenseSchema = {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: [
        "expenseNumber",
        "categoryId",
        "amount",
        "expenseDate",
        "createdBy",
      ],
      properties: {
        _id: {
          bsonType: "objectId",
        },
        expenseNumber: {
          bsonType: "string",
          pattern: "^EXP-\\d{4}-\\d{3,}$",
          description: "Unique expense number - required",
        },
        categoryId: {
          bsonType: "objectId",
          description: "Category reference - required",
        },
        categoryName: {
          bsonType: "string",
          description: "Denormalized category name for reporting",
        },
        amount: {
          bsonType: "double",
          minimum: 0.01,
          description: "Expense amount - required",
        },
        description: {
          bsonType: "string",
          maxLength: 1000,
          description: "Expense description",
        },
        expenseDate: {
          bsonType: "date",
          description: "Expense date - required",
        },
        paymentMethod: {
          enum: ["cash", "bank", "card"],
          description: "Payment method",
        },
        vendor: {
          bsonType: "object",
          properties: {
            name: {
              bsonType: "string",
              maxLength: 200,
              description: "Vendor name",
            },
            phone: {
              bsonType: "string",
              maxLength: 20,
              description: "Vendor phone number",
            },
            email: {
              bsonType: "string",
              pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
              description: "Vendor email address",
            },
          },
        },
        attachments: {
          bsonType: "array",
          items: {
            bsonType: "object",
            properties: {
              filename: {
                bsonType: "string",
                description: "Original filename",
              },
              url: {
                bsonType: "string",
                description: "File storage URL",
              },
              uploadDate: {
                bsonType: "date",
                description: "File upload timestamp",
              },
            },
          },
        },
        isRecurring: {
          bsonType: "bool",
          description: "Whether this is a recurring expense",
        },
        recurringConfig: {
          bsonType: "object",
          properties: {
            frequency: {
              enum: ["daily", "weekly", "monthly", "yearly"],
              description: "Recurring frequency",
            },
            interval: {
              bsonType: "int",
              minimum: 1,
              description: "Every N periods",
            },
            startDate: {
              bsonType: "date",
              description: "Recurring start date",
            },
            endDate: {
              bsonType: "date",
              description: "Recurring end date",
            },
            nextDueDate: {
              bsonType: "date",
              description: "Next due date for recurring expense",
            },
          },
        },
        tags: {
          bsonType: "array",
          items: {
            bsonType: "string",
          },
          description: "Additional categorization tags",
        },
        notes: {
          bsonType: "string",
          maxLength: 2000,
          description: "Additional notes",
        },
        createdBy: {
          bsonType: "objectId",
          description: "User who created expense - required",
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

const expenseIndexes = [
  { key: { expenseNumber: 1 }, unique: true, name: "expense_number_unique" },
  { key: { expenseDate: -1 }, name: "expense_date_desc" },
  { key: { categoryId: 1 }, name: "category_index" },
  { key: { createdBy: 1 }, name: "created_by_index" },
  { key: { paymentMethod: 1 }, name: "payment_method_index" },
  { key: { expenseDate: -1, amount: -1 }, name: "date_amount_compound" },
  {
    key: { isRecurring: 1, "recurringConfig.nextDueDate": 1 },
    name: "recurring_due_index",
  },
  { key: { tags: 1 }, name: "tags_index" },
  { key: { "vendor.name": 1 }, name: "vendor_name_index" },
];

module.exports = { expenseSchema, expenseIndexes };
