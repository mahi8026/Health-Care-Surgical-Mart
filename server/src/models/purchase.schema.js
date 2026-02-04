/**
 * Purchase Collection Schema
 * Stores all purchase transactions from suppliers
 */

const purchaseSchema = {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: [
        "supplierName",
        "items",
        "totalAmount",
        "purchaseDate",
        "createdBy",
      ],
      properties: {
        _id: {
          bsonType: "objectId",
        },
        purchaseNo: {
          bsonType: "string",
          description: "Unique purchase order number",
        },
        supplierName: {
          bsonType: "string",
          description: "Supplier name - required",
        },
        supplierPhone: {
          bsonType: "string",
          description: "Supplier phone number",
        },
        supplierAddress: {
          bsonType: "string",
          description: "Supplier address",
        },
        items: {
          bsonType: "array",
          minItems: 1,
          description: "Array of purchased items - required",
          items: {
            bsonType: "object",
            required: ["productId", "name", "rate", "qty", "total"],
            properties: {
              productId: {
                bsonType: "objectId",
                description: "Reference to product",
              },
              name: {
                bsonType: "string",
                description: "Product name",
              },
              rate: {
                bsonType: "double",
                minimum: 0,
                description: "Purchase rate per unit",
              },
              qty: {
                bsonType: "double",
                minimum: 0,
                description: "Quantity purchased",
              },
              total: {
                bsonType: "double",
                minimum: 0,
                description: "Line total (rate * qty)",
              },
              batchNo: {
                bsonType: "string",
                description: "Batch number",
              },
              expiryDate: {
                bsonType: "date",
                description: "Expiry date",
              },
            },
          },
        },
        totalAmount: {
          bsonType: "double",
          minimum: 0,
          description: "Total purchase amount - required",
        },
        paidAmount: {
          bsonType: "double",
          minimum: 0,
          description: "Amount paid",
        },
        dueAmount: {
          bsonType: "double",
          minimum: 0,
          description: "Amount due",
        },
        paymentStatus: {
          enum: ["Paid", "Partial", "Pending"],
          description: "Payment status",
        },
        purchaseDate: {
          bsonType: "date",
          description: "Date of purchase - required",
        },
        createdBy: {
          bsonType: "objectId",
          description: "User who created the purchase - required",
        },
        createdByName: {
          bsonType: "string",
          description: "Name of user who created the purchase",
        },
        notes: {
          bsonType: "string",
          description: "Additional notes",
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

const purchaseIndexes = [
  {
    key: { purchaseNo: 1 },
    unique: true,
    sparse: true,
    name: "purchase_no_unique",
  },
  { key: { purchaseDate: -1 }, name: "purchase_date_desc" },
  { key: { supplierName: 1 }, name: "supplier_index" },
  { key: { createdBy: 1 }, name: "created_by_index" },
  { key: { paymentStatus: 1 }, name: "payment_status_index" },
];

module.exports = { purchaseSchema, purchaseIndexes };
