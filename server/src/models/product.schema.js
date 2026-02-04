/**
 * Product Collection Schema
 * Stores all products/medicines in the medical store
 */

const productSchema = {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: [
        "name",
        "category",
        "sku",
        "purchasePrice",
        "sellingPrice",
        "unit",
        "minStockLevel",
      ],
      properties: {
        _id: {
          bsonType: "objectId",
        },
        name: {
          bsonType: "string",
          description: "Product name - required",
        },
        category: {
          enum: ["Medical", "Lab", "Surgical"],
          description: "Product category - must be Medical, Lab, or Surgical",
        },
        brand: {
          bsonType: "string",
          description: "Brand/manufacturer name",
        },
        sku: {
          bsonType: "string",
          description: "Stock Keeping Unit - unique identifier - required",
        },
        purchasePrice: {
          bsonType: "double",
          minimum: 0,
          description: "Purchase price from supplier - required",
        },
        sellingPrice: {
          bsonType: "double",
          minimum: 0,
          description: "Selling price to customer - required",
        },
        unit: {
          enum: ["pcs", "box", "pack", "bottle", "strip", "vial"],
          description: "Unit of measurement - required",
        },
        minStockLevel: {
          bsonType: "int",
          minimum: 0,
          description: "Minimum stock level for alerts - required",
        },
        description: {
          bsonType: "string",
          description: "Product description",
        },
        batchNo: {
          bsonType: "string",
          description: "Batch number",
        },
        expiryDate: {
          bsonType: "date",
          description: "Product expiry date",
        },
        isActive: {
          bsonType: "bool",
          description: "Product active status",
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

const productIndexes = [
  { key: { sku: 1 }, unique: true, name: "sku_unique" },
  { key: { name: 1 }, name: "name_index" },
  { key: { category: 1 }, name: "category_index" },
  { key: { brand: 1 }, name: "brand_index" },
  { key: { isActive: 1 }, name: "active_status_index" },
  { key: { name: "text", brand: "text" }, name: "text_search_index" },
];

module.exports = { productSchema, productIndexes };
