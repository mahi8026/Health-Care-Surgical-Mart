/**
 * Stock Collection Schema
 * Tracks current stock levels for all products
 */

const stockSchema = {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["productId", "currentQty"],
      properties: {
        _id: {
          bsonType: "objectId",
        },
        productId: {
          bsonType: "objectId",
          description: "Reference to product - required",
        },
        productName: {
          bsonType: "string",
          description: "Product name for quick access",
        },
        currentQty: {
          bsonType: "double",
          minimum: 0,
          description: "Current stock quantity - required",
        },
        reservedQty: {
          bsonType: "double",
          minimum: 0,
          description: "Reserved/allocated quantity",
        },
        availableQty: {
          bsonType: "double",
          minimum: 0,
          description: "Available quantity (current - reserved)",
        },
        minStockLevel: {
          bsonType: "int",
          minimum: 0,
          description: "Minimum stock level threshold",
        },
        isLowStock: {
          bsonType: "bool",
          description: "Flag for low stock alert",
        },
        batchNo: {
          bsonType: "string",
          description: "Batch number for pharmaceutical tracking",
        },
        lotNo: {
          bsonType: "string",
          description: "Lot number for pharmaceutical tracking",
        },
        expiryDate: {
          bsonType: "date",
          description: "Expiry date — null means no expiry tracked",
        },
        reorderPoint: {
          bsonType: "int",
          minimum: 0,
          description: "Reorder trigger level (default 10)",
        },
        maxStock: {
          bsonType: "int",
          minimum: 0,
          description: "Maximum stock capacity (optional)",
        },
        lastPurchaseDate: {
          bsonType: "date",
          description: "Last purchase date",
        },
        lastSaleDate: {
          bsonType: "date",
          description: "Last sale date",
        },
        lastUpdated: {
          bsonType: "date",
          description: "Last stock update timestamp",
        },
        createdAt: {
          bsonType: "date",
          description: "Record creation timestamp",
        },
      },
    },
  },
};

const stockIndexes = [
  { key: { productId: 1 }, unique: true, name: "product_unique" },
  { key: { isLowStock: 1 }, name: "low_stock_index" },
  { key: { currentQty: 1 }, name: "current_qty_index" },
  { key: { expiryDate: 1 }, name: "expiry_date_index" },
  { key: { lastUpdated: -1 }, name: "last_updated_desc" },
  // Compound indexes for common query patterns
  { key: { isLowStock: 1, currentQty: 1 }, name: "low_stock_qty_compound" },
  { key: { expiryDate: 1, currentQty: 1 }, name: "expiry_qty_compound" },
  { key: { currentQty: 1, lastUpdated: -1 }, name: "qty_updated_compound" },
];

module.exports = { stockSchema, stockIndexes };
