const mongoose = require("mongoose");

const bulkImportSchema = new mongoose.Schema(
  {
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
      index: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    fileType: {
      type: String,
      enum: ["csv", "xlsx", "xls"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed", "partial"],
      default: "pending",
      index: true,
    },
    totalRows: {
      type: Number,
      default: 0,
    },
    processedRows: {
      type: Number,
      default: 0,
    },
    successCount: {
      type: Number,
      default: 0,
    },
    failureCount: {
      type: Number,
      default: 0,
    },
    skippedCount: {
      type: Number,
      default: 0,
    },
    errors: [
      {
        row: Number,
        field: String,
        value: String,
        message: String,
        severity: {
          type: String,
          enum: ["error", "warning"],
          default: "error",
        },
      },
    ],
    warnings: [
      {
        row: Number,
        field: String,
        message: String,
      },
    ],
    importType: {
      type: String,
      enum: ["create", "update", "upsert"],
      default: "create",
    },
    mapping: {
      type: Map,
      of: String,
    },
    options: {
      skipDuplicates: {
        type: Boolean,
        default: false,
      },
      updateExisting: {
        type: Boolean,
        default: false,
      },
      validateOnly: {
        type: Boolean,
        default: false,
      },
      autoGenerateSKU: {
        type: Boolean,
        default: false,
      },
    },
    startedAt: Date,
    completedAt: Date,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    filePath: String,
    processedData: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for performance
bulkImportSchema.index({ shopId: 1, status: 1 });
bulkImportSchema.index({ uploadedBy: 1, createdAt: -1 });
bulkImportSchema.index({ createdAt: -1 });

// Virtual for success rate
bulkImportSchema.virtual("successRate").get(function () {
  if (this.totalRows === 0) return 0;
  return ((this.successCount / this.totalRows) * 100).toFixed(2);
});

// Virtual for progress percentage
bulkImportSchema.virtual("progress").get(function () {
  if (this.totalRows === 0) return 0;
  return ((this.processedRows / this.totalRows) * 100).toFixed(2);
});

bulkImportSchema.set("toJSON", { virtuals: true });
bulkImportSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("BulkImport", bulkImportSchema);
