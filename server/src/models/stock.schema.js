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
  { key: { lastUpdated: -1 }, name: "last_updated_desc" },
];

module.exports = { stockSchema, stockIndexes };
