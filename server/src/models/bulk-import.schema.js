/**
 * Bulk Import Schema (native MongoDB driver)
 * Defines the $jsonSchema validator and indexes for bulk_imports collection.
 * Replaces the previous Mongoose model.
 */

const bulkImportSchema = {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["shopId", "fileName", "fileSize", "fileType", "status", "uploadedBy"],
      properties: {
        _id: { bsonType: "objectId" },
        shopId: { bsonType: "objectId", description: "Reference to shop - required" },
        fileName: { bsonType: "string", description: "Original file name - required" },
        fileSize: { bsonType: "number", description: "File size in bytes - required" },
        fileType: {
          enum: ["csv", "xlsx", "xls"],
          description: "File type - required",
        },
        status: {
          enum: ["pending", "processing", "completed", "failed", "partial"],
          description: "Import status - required",
        },
        totalRows: { bsonType: "number", description: "Total rows in file" },
        processedRows: { bsonType: "number", description: "Rows processed so far" },
        successCount: { bsonType: "number", description: "Successfully imported rows" },
        failureCount: { bsonType: "number", description: "Failed rows" },
        skippedCount: { bsonType: "number", description: "Skipped rows" },
        errors: {
          bsonType: "array",
          items: {
            bsonType: "object",
            properties: {
              row: { bsonType: "number" },
              field: { bsonType: "string" },
              value: { bsonType: "string" },
              message: { bsonType: "string" },
              severity: { enum: ["error", "warning"] },
            },
          },
        },
        warnings: {
          bsonType: "array",
          items: {
            bsonType: "object",
            properties: {
              row: { bsonType: "number" },
              field: { bsonType: "string" },
              message: { bsonType: "string" },
            },
          },
        },
        importType: {
          enum: ["create", "update", "upsert"],
          description: "Import mode",
        },
        options: {
          bsonType: "object",
          properties: {
            skipDuplicates: { bsonType: "bool" },
            updateExisting: { bsonType: "bool" },
            validateOnly: { bsonType: "bool" },
            autoGenerateSKU: { bsonType: "bool" },
          },
        },
        startedAt: { bsonType: "date" },
        completedAt: { bsonType: "date" },
        uploadedBy: { bsonType: "objectId", description: "User who uploaded - required" },
        filePath: { bsonType: "string" },
        processedData: { bsonType: "object" },
        createdAt: { bsonType: "date" },
        updatedAt: { bsonType: "date" },
      },
    },
  },
};

const bulkImportIndexes = [
  { key: { shopId: 1, status: 1 }, name: "shop_status_compound" },
  { key: { uploadedBy: 1, createdAt: -1 }, name: "uploader_date_compound" },
  { key: { createdAt: -1 }, name: "created_at_desc" },
];

module.exports = { bulkImportSchema, bulkImportIndexes };
