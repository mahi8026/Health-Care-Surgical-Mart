/**
 * Return Collection Schema
 * Stores sale return/refund information
 */

const returnSchema = {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: [
        "returnNumber",
        "originalSaleId",
        "originalInvoiceNumber",
        "items",
        "returnReason",
        "returnType",
        "totalRefund",
        "status",
        "returnDate",
      ],
      properties: {
        _id: {
          bsonType: "objectId",
        },
        returnNumber: {
          bsonType: "string",
          description: "Unique return number - required",
        },
        originalSaleId: {
          bsonType: "string",
          description: "Reference to original sale ID - required",
        },
        originalInvoiceNumber: {
          bsonType: "string",
          description: "Original invoice number - required",
        },
        customer: {
          bsonType: "object",
          properties: {
            id: {
              bsonType: "string",
              description: "Customer ID if registered customer",
            },
            name: {
              bsonType: "string",
              description: "Customer name",
            },
            phone: {
              bsonType: "string",
              description: "Customer phone number",
            },
            type: {
              enum: ["Retail", "Wholesale"],
              description: "Customer type",
            },
          },
          description: "Customer information",
        },
        items: {
          bsonType: "array",
          minItems: 1,
          items: {
            bsonType: "object",
            required: ["productId", "name", "returnQuantity", "price", "total"],
            properties: {
              productId: {
                bsonType: "objectId",
                description: "Product ID - required",
              },
              name: {
                bsonType: "string",
                description: "Product name - required",
              },
              sku: {
                bsonType: "string",
                description: "Product SKU",
              },
              originalQuantity: {
                bsonType: "int",
                minimum: 1,
                description: "Original quantity sold",
              },
              returnQuantity: {
                bsonType: "int",
                minimum: 1,
                description: "Quantity being returned - required",
              },
              price: {
                bsonType: "double",
                minimum: 0,
                description: "Unit price - required",
              },
              total: {
                bsonType: "double",
                minimum: 0,
                description: "Total amount for returned quantity - required",
              },
              returnReason: {
                bsonType: "string",
                description: "Reason for returning this item",
              },
              batchNumber: {
                bsonType: "string",
                description: "Batch number if applicable",
              },
              expiryDate: {
                bsonType: "date",
                description: "Expiry date if applicable",
              },
            },
          },
          description: "Array of returned items - required",
        },
        returnReason: {
          enum: [
            "Expired Product",
            "Damaged Product",
            "Wrong Product",
            "Customer Changed Mind",
            "Quality Issue",
            "Prescription Change",
            "Duplicate Purchase",
            "Other",
          ],
          description: "Primary reason for return - required",
        },
        returnType: {
          enum: ["full", "partial"],
          description: "Type of return - required",
        },
        refundMethod: {
          enum: ["cash", "bank", "store_credit", "original_payment"],
          description: "Method of refund",
        },
        subtotal: {
          bsonType: "double",
          minimum: 0,
          description: "Subtotal of returned items",
        },
        discount: {
          bsonType: "double",
          minimum: 0,
          description: "Proportional discount amount",
        },
        vatAmount: {
          bsonType: "double",
          minimum: 0,
          description: "VAT amount on return",
        },
        totalRefund: {
          bsonType: "double",
          minimum: 0,
          description: "Total refund amount - required",
        },
        status: {
          enum: ["pending", "completed", "cancelled"],
          description: "Return status - required",
        },
        returnDate: {
          bsonType: "date",
          description: "Date of return - required",
        },
        approvedBy: {
          bsonType: "objectId",
          description: "User who approved the return",
        },
        approvedAt: {
          bsonType: "date",
          description: "Approval timestamp",
        },
        notes: {
          bsonType: "string",
          description: "Additional notes about the return",
        },
        attachments: {
          bsonType: "array",
          items: {
            bsonType: "object",
            properties: {
              filename: {
                bsonType: "string",
                description: "File name",
              },
              url: {
                bsonType: "string",
                description: "File URL",
              },
              type: {
                bsonType: "string",
                description: "File type",
              },
            },
          },
          description: "Supporting documents/images",
        },
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
          description: "User who created the return",
        },
        updatedBy: {
          bsonType: "objectId",
          description: "User who last updated the return",
        },
      },
    },
  },
};

const returnIndexes = [
  { key: { returnNumber: 1 }, unique: true, name: "return_number_unique" },
  { key: { originalSaleId: 1 }, name: "original_sale_index" },
  { key: { originalInvoiceNumber: 1 }, name: "original_invoice_index" },
  { key: { returnDate: -1 }, name: "return_date_desc" },
  { key: { status: 1 }, name: "status_index" },
  { key: { returnReason: 1 }, name: "return_reason_index" },
  { key: { "customer.phone": 1 }, name: "customer_phone_index" },
  { key: { createdAt: -1 }, name: "created_desc" },
];

// Stock Movement Schema (for tracking return-related stock changes)
const stockMovementSchema = {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: [
        "productId",
        "productName",
        "movementType",
        "quantity",
        "referenceType",
        "referenceId",
      ],
      properties: {
        _id: {
          bsonType: "objectId",
        },
        productId: {
          bsonType: "objectId",
          description: "Product ID - required",
        },
        productName: {
          bsonType: "string",
          description: "Product name - required",
        },
        movementType: {
          enum: ["sale", "purchase", "return", "adjustment", "transfer"],
          description: "Type of stock movement - required",
        },
        quantity: {
          bsonType: "int",
          description:
            "Quantity moved (positive for in, negative for out) - required",
        },
        previousQty: {
          bsonType: "int",
          description: "Stock quantity before movement",
        },
        newQty: {
          bsonType: "int",
          description: "Stock quantity after movement",
        },
        referenceType: {
          enum: ["sale", "purchase", "return", "adjustment", "transfer"],
          description: "Type of reference document - required",
        },
        referenceId: {
          bsonType: "string",
          description: "Reference document ID - required",
        },
        referenceNumber: {
          bsonType: "string",
          description: "Reference document number",
        },
        notes: {
          bsonType: "string",
          description: "Movement notes",
        },
        createdAt: {
          bsonType: "date",
          description: "Movement timestamp",
        },
        createdBy: {
          bsonType: "objectId",
          description: "User who created the movement",
        },
      },
    },
  },
};

const stockMovementIndexes = [
  { key: { productId: 1, createdAt: -1 }, name: "product_date_desc" },
  { key: { movementType: 1 }, name: "movement_type_index" },
  { key: { referenceType: 1, referenceId: 1 }, name: "reference_index" },
  { key: { createdAt: -1 }, name: "created_desc" },
];

module.exports = {
  returnSchema,
  returnIndexes,
  stockMovementSchema,
  stockMovementIndexes,
};
