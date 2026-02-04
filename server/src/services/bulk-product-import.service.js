const XLSX = require("xlsx");
const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");
const Product = require("../models/product.schema");
const Stock = require("../models/stock.schema");
const BulkImport = require("../models/bulk-import.schema");

class BulkProductImportService {
  constructor() {
    this.requiredFields = ["name", "category"];
    this.optionalFields = [
      "sku",
      "description",
      "manufacturer",
      "unit",
      "purchasePrice",
      "sellingPrice",
      "mrp",
      "minStockLevel",
      "maxStockLevel",
      "reorderPoint",
      "initialStock",
      "batchNumber",
      "expiryDate",
      "barcode",
      "hsnCode",
      "taxRate",
      "isActive",
    ];
  }

  /**
   * Parse uploaded file (CSV or Excel)
   */
  async parseFile(filePath, fileType) {
    try {
      if (fileType === "csv") {
        return await this.parseCSV(filePath);
      } else if (fileType === "xlsx" || fileType === "xls") {
        return await this.parseExcel(filePath);
      } else {
        throw new Error("Unsupported file type");
      }
    } catch (error) {
      throw new Error(`File parsing error: ${error.message}`);
    }
  }

  /**
   * Parse CSV file
   */
  async parseCSV(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      fs.createReadStream(filePath)
        .pipe(csv())
        .on("data", (data) => results.push(data))
        .on("end", () => resolve(results))
        .on("error", (error) => reject(error));
    });
  }

  /**
   * Parse Excel file
   */
  async parseExcel(filePath) {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);
      return data;
    } catch (error) {
      throw new Error(`Excel parsing error: ${error.message}`);
    }
  }

  /**
   * Validate row data
   */
  validateRow(row, rowIndex, options = {}) {
    const errors = [];
    const warnings = [];

    // Check required fields
    for (const field of this.requiredFields) {
      if (!row[field] || row[field].toString().trim() === "") {
        errors.push({
          row: rowIndex,
          field,
          value: row[field],
          message: `${field} is required`,
          severity: "error",
        });
      }
    }

    // Validate name length
    if (row.name && row.name.length > 200) {
      errors.push({
        row: rowIndex,
        field: "name",
        value: row.name,
        message: "Product name must be less than 200 characters",
        severity: "error",
      });
    }

    // Validate prices
    if (row.purchasePrice && isNaN(parseFloat(row.purchasePrice))) {
      errors.push({
        row: rowIndex,
        field: "purchasePrice",
        value: row.purchasePrice,
        message: "Purchase price must be a valid number",
        severity: "error",
      });
    }

    if (row.sellingPrice && isNaN(parseFloat(row.sellingPrice))) {
      errors.push({
        row: rowIndex,
        field: "sellingPrice",
        value: row.sellingPrice,
        message: "Selling price must be a valid number",
        severity: "error",
      });
    }

    // Validate selling price > purchase price
    if (
      row.purchasePrice &&
      row.sellingPrice &&
      parseFloat(row.sellingPrice) < parseFloat(row.purchasePrice)
    ) {
      warnings.push({
        row: rowIndex,
        field: "sellingPrice",
        message: "Selling price is less than purchase price",
      });
    }

    // Validate stock levels
    if (row.minStockLevel && isNaN(parseInt(row.minStockLevel))) {
      errors.push({
        row: rowIndex,
        field: "minStockLevel",
        value: row.minStockLevel,
        message: "Min stock level must be a valid number",
        severity: "error",
      });
    }

    // Validate initial stock
    if (row.initialStock && isNaN(parseInt(row.initialStock))) {
      errors.push({
        row: rowIndex,
        field: "initialStock",
        value: row.initialStock,
        message: "Initial stock must be a valid number",
        severity: "error",
      });
    }

    // Validate expiry date format
    if (row.expiryDate && !this.isValidDate(row.expiryDate)) {
      errors.push({
        row: rowIndex,
        field: "expiryDate",
        value: row.expiryDate,
        message: "Invalid date format. Use YYYY-MM-DD or DD/MM/YYYY",
        severity: "error",
      });
    }

    // Validate tax rate
    if (
      row.taxRate &&
      (isNaN(parseFloat(row.taxRate)) ||
        parseFloat(row.taxRate) < 0 ||
        parseFloat(row.taxRate) > 100)
    ) {
      errors.push({
        row: rowIndex,
        field: "taxRate",
        value: row.taxRate,
        message: "Tax rate must be between 0 and 100",
        severity: "error",
      });
    }

    return { errors, warnings };
  }

  /**
   * Validate date format
   */
  isValidDate(dateString) {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
  }

  /**
   * Generate SKU if not provided
   */
  generateSKU(productName, category) {
    const prefix = category.substring(0, 3).toUpperCase();
    const namePart = productName.substring(0, 3).toUpperCase();
    const timestamp = Date.now().toString().slice(-6);
    return `${prefix}-${namePart}-${timestamp}`;
  }

  /**
   * Transform row data to product format
   */
  transformRowToProduct(row, shopId, options = {}) {
    const product = {
      shopId,
      name: row.name.trim(),
      category: row.category.trim(),
      description: row.description || "",
      manufacturer: row.manufacturer || "",
      unit: row.unit || "piece",
      purchasePrice: parseFloat(row.purchasePrice) || 0,
      sellingPrice: parseFloat(row.sellingPrice) || 0,
      mrp: parseFloat(row.mrp) || parseFloat(row.sellingPrice) || 0,
      minStockLevel: parseInt(row.minStockLevel) || 10,
      maxStockLevel: parseInt(row.maxStockLevel) || 1000,
      reorderPoint:
        parseInt(row.reorderPoint) || parseInt(row.minStockLevel) || 10,
      barcode: row.barcode || "",
      hsnCode: row.hsnCode || "",
      taxRate: parseFloat(row.taxRate) || 0,
      isActive:
        row.isActive === "false" || row.isActive === false ? false : true,
    };

    // Generate or use provided SKU
    if (options.autoGenerateSKU || !row.sku) {
      product.sku = this.generateSKU(product.name, product.category);
    } else {
      product.sku = row.sku.trim();
    }

    return product;
  }

  /**
   * Process bulk import
   */
  async processBulkImport(bulkImportId, shopId, userId) {
    const bulkImport = await BulkImport.findById(bulkImportId);
    if (!bulkImport) {
      throw new Error("Bulk import record not found");
    }

    try {
      // Update status to processing
      bulkImport.status = "processing";
      bulkImport.startedAt = new Date();
      await bulkImport.save();

      // Parse file
      const data = await this.parseFile(
        bulkImport.filePath,
        bulkImport.fileType,
      );
      bulkImport.totalRows = data.length;
      await bulkImport.save();

      const results = {
        success: [],
        failed: [],
        skipped: [],
      };

      // Process each row
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowIndex = i + 2; // +2 for header row and 0-based index

        try {
          // Validate row
          const validation = this.validateRow(
            row,
            rowIndex,
            bulkImport.options,
          );

          if (validation.errors.length > 0) {
            bulkImport.errors.push(...validation.errors);
            results.failed.push({ row: rowIndex, errors: validation.errors });
            bulkImport.failureCount++;
          } else {
            if (validation.warnings.length > 0) {
              bulkImport.warnings.push(...validation.warnings);
            }

            // Skip if validate only mode
            if (bulkImport.options.validateOnly) {
              results.skipped.push({
                row: rowIndex,
                reason: "Validation only mode",
              });
              bulkImport.skippedCount++;
            } else {
              // Transform and save product
              const productData = this.transformRowToProduct(
                row,
                shopId,
                bulkImport.options,
              );

              // Check for duplicates
              const existingProduct = await Product.findOne({
                shopId,
                $or: [{ sku: productData.sku }, { name: productData.name }],
              });

              if (existingProduct) {
                if (bulkImport.options.skipDuplicates) {
                  results.skipped.push({
                    row: rowIndex,
                    reason: "Duplicate SKU or name",
                  });
                  bulkImport.skippedCount++;
                } else if (bulkImport.options.updateExisting) {
                  // Update existing product
                  await Product.findByIdAndUpdate(
                    existingProduct._id,
                    productData,
                  );

                  // Update stock if provided
                  if (row.initialStock) {
                    await Stock.findOneAndUpdate(
                      { productId: existingProduct._id, shopId },
                      { currentQty: parseInt(row.initialStock) },
                      { upsert: true },
                    );
                  }

                  results.success.push({
                    row: rowIndex,
                    productId: existingProduct._id,
                    action: "updated",
                  });
                  bulkImport.successCount++;
                } else {
                  results.failed.push({
                    row: rowIndex,
                    errors: [{ message: "Duplicate product found" }],
                  });
                  bulkImport.failureCount++;
                }
              } else {
                // Create new product
                const product = await Product.create(productData);

                // Create stock record if initial stock provided
                if (row.initialStock) {
                  await Stock.create({
                    shopId,
                    productId: product._id,
                    currentQty: parseInt(row.initialStock),
                    minStockLevel: product.minStockLevel,
                    maxStockLevel: product.maxStockLevel,
                    reorderPoint: product.reorderPoint,
                    batchNumber: row.batchNumber || "",
                    expiryDate: row.expiryDate
                      ? new Date(row.expiryDate)
                      : null,
                  });
                }

                results.success.push({
                  row: rowIndex,
                  productId: product._id,
                  action: "created",
                });
                bulkImport.successCount++;
              }
            }
          }
        } catch (error) {
          bulkImport.errors.push({
            row: rowIndex,
            field: "general",
            message: error.message,
            severity: "error",
          });
          results.failed.push({
            row: rowIndex,
            errors: [{ message: error.message }],
          });
          bulkImport.failureCount++;
        }

        bulkImport.processedRows = i + 1;

        // Save progress every 10 rows
        if ((i + 1) % 10 === 0) {
          await bulkImport.save();
        }
      }

      // Update final status
      bulkImport.completedAt = new Date();
      if (bulkImport.failureCount === 0) {
        bulkImport.status = "completed";
      } else if (bulkImport.successCount > 0) {
        bulkImport.status = "partial";
      } else {
        bulkImport.status = "failed";
      }

      bulkImport.processedData = results;
      await bulkImport.save();

      return bulkImport;
    } catch (error) {
      bulkImport.status = "failed";
      bulkImport.errors.push({
        row: 0,
        field: "general",
        message: error.message,
        severity: "error",
      });
      await bulkImport.save();
      throw error;
    }
  }

  /**
   * Get sample template data
   */
  getSampleTemplate() {
    return [
      {
        name: "Surgical Gloves - Latex",
        sku: "SUR-GLA-001",
        category: "Surgical Supplies",
        description: "Sterile latex surgical gloves, size M",
        manufacturer: "MediCare Inc",
        unit: "box",
        purchasePrice: 150,
        sellingPrice: 200,
        mrp: 220,
        minStockLevel: 20,
        maxStockLevel: 500,
        reorderPoint: 30,
        initialStock: 100,
        batchNumber: "BATCH-2024-001",
        expiryDate: "2025-12-31",
        barcode: "1234567890123",
        hsnCode: "40151100",
        taxRate: 12,
        isActive: true,
      },
      {
        name: "Digital Thermometer",
        sku: "MED-THE-002",
        category: "Medical Equipment",
        description: "Digital thermometer with LCD display",
        manufacturer: "HealthTech",
        unit: "piece",
        purchasePrice: 80,
        sellingPrice: 120,
        mrp: 150,
        minStockLevel: 10,
        maxStockLevel: 200,
        reorderPoint: 15,
        initialStock: 50,
        batchNumber: "",
        expiryDate: "",
        barcode: "9876543210987",
        hsnCode: "90251100",
        taxRate: 18,
        isActive: true,
      },
    ];
  }

  /**
   * Generate Excel template
   */
  generateExcelTemplate() {
    const template = this.getSampleTemplate();
    const worksheet = XLSX.utils.json_to_sheet(template);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Products");
    return workbook;
  }

  /**
   * Generate CSV template
   */
  generateCSVTemplate() {
    const template = this.getSampleTemplate();
    const worksheet = XLSX.utils.json_to_sheet(template);
    return XLSX.utils.sheet_to_csv(worksheet);
  }
}

module.exports = new BulkProductImportService();
