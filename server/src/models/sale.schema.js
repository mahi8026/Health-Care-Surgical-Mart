/**
 * Sales Collection Schema
 * Stores all sales transactions
 */

const saleSchema = {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["invoiceNo", "items", "grandTotal", "saleDate", "createdBy"],
      properties: {
        _id: {
          bsonType: "objectId",
        },
        invoiceNo: {
          bsonType: "string",
          description: "Unique invoice number - required",
        },
        customerId: {
          bsonType: ["objectId", "null"],
          description: "Reference to customer (null for walk-in)",
        },
        customerName: {
          bsonType: "string",
          description: "Customer name for quick access",
        },
        customerType: {
          enum: ["Walk-in", "Hospital/Clinic", "Diagnostic", "Wholesaler"],
          description: "Customer type - Walk-in, Hospital/Clinic, Diagnostic, or Wholesaler",
        },
        items: {
          bsonType: "array",
          minItems: 1,
          description: "Array of sale items - required",
          items: {
            bsonType: "object",
            required: ["name", "rate", "qty", "total"],
            properties: {
              productId: {
                bsonType: ["objectId", "null"],
                description: "Reference to product (null for custom items)",
              },
              customName: {
                bsonType: "string",
                description: "Custom item name (for non-inventory items)",
              },
              name: {
                bsonType: "string",
                description: "Product or custom item name",
              },
              rate: {
                bsonType: "double",
                minimum: 0,
                description: "Selling rate per unit",
              },
              qty: {
                bsonType: "double",
                minimum: 0,
                description: "Quantity sold",
              },
              total: {
                bsonType: "double",
                minimum: 0,
                description: "Line total (rate * qty)",
              },
            },
          },
        },
        subtotal: {
          bsonType: "double",
          minimum: 0,
          description: "Subtotal before discount and VAT",
        },
        discountAmount: {
          bsonType: "double",
          minimum: 0,
          description: "Discount amount",
        },
        discountPercent: {
          bsonType: "double",
          minimum: 0,
          maximum: 100,
          description: "Discount percentage",
        },
        vatAmount: {
          bsonType: "double",
          minimum: 0,
          description: "VAT/Tax amount",
        },
        vatPercent: {
          bsonType: "double",
          minimum: 0,
          description: "VAT/Tax percentage",
        },
        grandTotal: {
          bsonType: "double",
          minimum: 0,
          description: "Final total amount - required",
        },
        cashPaid: {
          bsonType: "double",
          minimum: 0,
          description: "Cash payment received",
        },
        bankPaid: {
          bsonType: "double",
          minimum: 0,
          description: "Bank/card payment received",
        },
        returnAmount: {
          bsonType: "double",
          minimum: 0,
          description: "Change returned to customer",
        },
        dueAmount: {
          bsonType: "double",
          minimum: 0,
          description: "Amount still owed by customer",
        },
        paymentStatus: {
          enum: ["Paid", "Partial", "Pending", "Credit"],
          description: "Payment status",
        },
        paymentMethod: {
          bsonType: "string",
          description: "Payment method (cash, bank, card, credit)",
        },
        saleDate: {
          bsonType: "date",
          description: "Date of sale - required",
        },
        createdBy: {
          bsonType: "objectId",
          description: "User who created the sale - required",
        },
        createdByName: {
          bsonType: "string",
          description: "Name of user who created the sale",
        },
        notes: {
          bsonType: "string",
          description: "Additional notes",
        },
        createdAt: {
          bsonType: "date",
          description: "Record creation timestamp",
        },
      },
    },
  },
};

const saleIndexes = [
  { key: { invoiceNo: 1 }, unique: true, name: "invoice_unique" },
  { key: { saleDate: -1 }, name: "sale_date_desc" },
  { key: { customerId: 1 }, name: "customer_index" },
  { key: { customerType: 1 }, name: "customer_type_index" },
  { key: { createdBy: 1 }, name: "created_by_index" },
  { key: { paymentStatus: 1 }, name: "payment_status_index" },
  { key: { saleDate: -1, grandTotal: -1 }, name: "date_amount_compound" },
  // Additional compound indexes for common queries
  { key: { customerId: 1, saleDate: -1 }, name: "customer_date_compound" },
  { key: { paymentStatus: 1, saleDate: -1 }, name: "payment_date_compound" },
  { key: { customerType: 1, saleDate: -1 }, name: "type_date_compound" },
  // PERF-008: Financial report optimization
  { key: { saleDate: 1, paymentStatus: 1 }, name: "sale_date_payment_compound" },
];

module.exports = { saleSchema, saleIndexes };
