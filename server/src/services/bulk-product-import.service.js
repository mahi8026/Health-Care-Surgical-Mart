/**
 * Bulk Product Import Service (native MongoDB driver)
 * Handles CSV/Excel parsing and product import logic.
 * All DB operations use the shopDb wrapper passed in from the route.
 */

const XLSX = require("xlsx");
const csv = require("csv-parser");
const fs = require("fs");
const { ObjectId } = require("mongodb");

class BulkProductImportService {
  constructor() {
    this.requiredFields = ["name", "category"];
    this.optionalFields = [
      "sku", "description", "manufacturer", "unit",
      "purchasePrice", "sellingPrice", "mrp", "minStockLevel",
      "maxStockLevel", "reorderPoint", "initialStock",
      "batchNumber", "expiryDate", "barcode", "hsnCode", "taxRate", "isActive",
    ];
  }

  // ── File parsing ──────────────────────────────────────────────────────────

  async parseFile(filePath, fileType) {
    try {
      if (fileType === "csv") return await this.parseCSV(filePath);
      if (fileType === "xlsx" || fileType === "xls") return this.parseExcel(filePath);
      throw new Error("Unsupported file type");
    } catch (error) {
      throw new Error(`File parsing error: ${error.message}`);
    }
  }

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

  parseExcel(filePath) {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      return XLSX.utils.sheet_to_json(worksheet);
    } catch (error) {
      throw new Error(`Excel parsing error: ${error.message}`);
    }
  }

  // ── Validation ────────────────────────────────────────────────────────────

  validateRow(row, rowIndex, options = {}) {
    const errors = [];
    const warnings = [];

    for (const field of this.requiredFields) {
      if (!row[field] || row[field].toString().trim() === "") {
        errors.push({ row: rowIndex, field, value: row[field], message: `${field} is required`, severity: "error" });
      }
    }

    if (row.name && row.name.length > 200) {
      errors.push({ row: rowIndex, field: "name", value: row.name, message: "Product name must be less than 200 characters", severity: "error" });
    }

    if (row.purchasePrice && isNaN(parseFloat(row.purchasePrice))) {
      errors.push({ row: rowIndex, field: "purchasePrice", value: row.purchasePrice, message: "Purchase price must be a valid number", severity: "error" });
    }

    if (row.sellingPrice && isNaN(parseFloat(row.sellingPrice))) {
      errors.push({ row: rowIndex, field: "sellingPrice", value: row.sellingPrice, message: "Selling price must be a valid number", severity: "error" });
    }

    if (row.purchasePrice && row.sellingPrice && parseFloat(row.sellingPrice) < parseFloat(row.purchasePrice)) {
      warnings.push({ row: rowIndex, field: "sellingPrice", message: "Selling price is less than purchase price" });
    }

    if (row.minStockLevel && isNaN(parseInt(row.minStockLevel))) {
      errors.push({ row: rowIndex, field: "minStockLevel", value: row.minStockLevel, message: "Min stock level must be a valid number", severity: "error" });
    }

    if (row.initialStock && isNaN(parseInt(row.initialStock))) {
      errors.push({ row: rowIndex, field: "initialStock", value: row.initialStock, message: "Initial stock must be a valid number", severity: "error" });
    }

    if (row.expiryDate && !this.isValidDate(row.expiryDate)) {
      errors.push({ row: rowIndex, field: "expiryDate", value: row.expiryDate, message: "Invalid date format. Use YYYY-MM-DD or DD/MM/YYYY", severity: "error" });
    }

    if (row.taxRate && (isNaN(parseFloat(row.taxRate)) || parseFloat(row.taxRate) < 0 || parseFloat(row.taxRate) > 100)) {
      errors.push({ row: rowIndex, field: "taxRate", value: row.taxRate, message: "Tax rate must be between 0 and 100", severity: "error" });
    }

    return { errors, warnings };
  }

  isValidDate(dateString) {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  generateSKU(productName, category) {
    const prefix = category.substring(0, 3).toUpperCase();
    const namePart = productName.substring(0, 3).toUpperCase();
    const timestamp = Date.now().toString().slice(-6);
    return `${prefix}-${namePart}-${timestamp}`;
  }

  transformRowToProduct(row, options = {}) {
    const product = {
      name: row.name.trim(),
      category: row.category.trim(),
      description: row.description || "",
      brand: row.manufacturer || "",
      unit: row.unit || "pcs",
      purchasePrice: parseFloat(row.purchasePrice) || 0,
      sellingPrice: parseFloat(row.sellingPrice) || 0,
      minStockLevel: parseInt(row.minStockLevel) || 0,
      reorderPoint: parseInt(row.reorderPoint) || parseInt(row.minStockLevel) || 10,
      maxStock: parseInt(row.maxStockLevel) || undefined,
      isActive: row.isActive === "false" || row.isActive === false ? false : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (row.expiryDate) product.expiryDate = new Date(row.expiryDate);
    if (row.batchNumber) product.batchNo = row.batchNumber;

    product.sku = (options.autoGenerateSKU || !row.sku)
      ? this.generateSKU(product.name, product.category)
      : row.sku.trim();

    return product;
  }

  // ── Core import logic (uses shopDb — native MongoDB wrapper) ─────────────

  /**
   * Process a bulk import job.
   * @param {string} bulkImportId - ObjectId string of the bulk_imports document
   * @param {string} shopId - Shop identifier
   * @param {Object} shopDb - Native MongoDB shopDb wrapper from req.shopDb
   */
  async processBulkImport(bulkImportId, shopId, shopDb) {
    const bulkImportOid = new ObjectId(bulkImportId);

    const bulkImport = await shopDb.collection("bulk_imports").findOne({ _id: bulkImportOid });
    if (!bulkImport) throw new Error("Bulk import record not found");

    const _save = async (fields) => {
      await shopDb.collection("bulk_imports").updateOne(
        { _id: bulkImportOid },
        { $set: { ...fields, updatedAt: new Date() } },
      );
    };

    try {
      await _save({ status: "processing", startedAt: new Date() });

      const data = await this.parseFile(bulkImport.filePath, bulkImport.fileType);
      await _save({ totalRows: data.length });

      const results = { success: [], failed: [], skipped: [] };
      const errors = [];
      const warnings = [];
      let successCount = 0, failureCount = 0, skippedCount = 0;

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowIndex = i + 2;

        try {
          const validation = this.validateRow(row, rowIndex, bulkImport.options || {});

          if (validation.errors.length > 0) {
            errors.push(...validation.errors);
            results.failed.push({ row: rowIndex, errors: validation.errors });
            failureCount++;
          } else {
            if (validation.warnings.length > 0) warnings.push(...validation.warnings);

            if (bulkImport.options?.validateOnly) {
              results.skipped.push({ row: rowIndex, reason: "Validation only mode" });
              skippedCount++;
            } else {
              const productData = this.transformRowToProduct(row, bulkImport.options || {});
              const existingProduct = await shopDb.collection("products").findOne({
                $or: [{ sku: productData.sku }, { name: productData.name }],
              });

              if (existingProduct) {
                if (bulkImport.options?.skipDuplicates) {
                  results.skipped.push({ row: rowIndex, reason: "Duplicate SKU or name" });
                  skippedCount++;
                } else if (bulkImport.options?.updateExisting) {
                  await shopDb.collection("products").updateOne(
                    { _id: existingProduct._id },
                    { $set: { ...productData, updatedAt: new Date() } },
                  );
                  if (row.initialStock) {
                    await shopDb.collection("stock").updateOne(
                      { productId: existingProduct._id },
                      { $set: { currentQty: parseInt(row.initialStock), updatedAt: new Date() } },
                      { upsert: true },
                    );
                  }
                  results.success.push({ row: rowIndex, productId: existingProduct._id, action: "updated" });
                  successCount++;
                } else {
                  results.failed.push({ row: rowIndex, errors: [{ message: "Duplicate product found" }] });
                  failureCount++;
                }
              } else {
                const insertResult = await shopDb.collection("products").insertOne(productData);
                const newProductId = insertResult.insertedId;

                if (row.initialStock) {
                  await shopDb.collection("stock").insertOne({
                    productId: newProductId,
                    productName: productData.name,
                    currentQty: parseInt(row.initialStock),
                    reservedQty: 0,
                    availableQty: parseInt(row.initialStock),
                    minStockLevel: productData.minStockLevel || 0,
                    isLowStock: parseInt(row.initialStock) <= (productData.minStockLevel || 0),
                    batchNo: row.batchNumber || undefined,
                    expiryDate: row.expiryDate ? new Date(row.expiryDate) : undefined,
                    lastUpdated: new Date(),
                    createdAt: new Date(),
                  });
                }

                results.success.push({ row: rowIndex, productId: newProductId, action: "created" });
                successCount++;
              }
            }
          }
        } catch (error) {
          errors.push({ row: rowIndex, field: "general", message: error.message, severity: "error" });
          results.failed.push({ row: rowIndex, errors: [{ message: error.message }] });
          failureCount++;
        }

        // Save progress every 10 rows
        if ((i + 1) % 10 === 0) {
          await _save({ processedRows: i + 1, successCount, failureCount, skippedCount, errors, warnings });
        }
      }

      const finalStatus = failureCount === 0 ? "completed" : successCount > 0 ? "partial" : "failed";
      await _save({
        status: finalStatus,
        completedAt: new Date(),
        processedRows: data.length,
        successCount,
        failureCount,
        skippedCount,
        errors,
        warnings,
        processedData: results,
      });

      return { ...bulkImport, status: finalStatus, successCount, failureCount, skippedCount, processedData: results };
    } catch (error) {
      await _save({
        status: "failed",
        errors: [{ row: 0, field: "general", message: error.message, severity: "error" }],
      });
      throw error;
    }
  }

  // ── Template generation ───────────────────────────────────────────────────

  getSampleTemplate() {
    return [
      {
        name: "Surgical Gloves - Latex", sku: "SUR-GLA-001", category: "Surgical",
        description: "Sterile latex surgical gloves, size M", manufacturer: "MediCare Inc",
        unit: "box", purchasePrice: 150, sellingPrice: 200, mrp: 220,
        minStockLevel: 20, maxStockLevel: 500, reorderPoint: 30, initialStock: 100,
        batchNumber: "BATCH-2024-001", expiryDate: "2025-12-31",
        barcode: "1234567890123", hsnCode: "40151100", taxRate: 12, isActive: true,
      },
      {
        name: "Digital Thermometer", sku: "MED-THE-002", category: "Medical",
        description: "Digital thermometer with LCD display", manufacturer: "HealthTech",
        unit: "pcs", purchasePrice: 80, sellingPrice: 120, mrp: 150,
        minStockLevel: 10, maxStockLevel: 200, reorderPoint: 15, initialStock: 50,
        batchNumber: "", expiryDate: "", barcode: "9876543210987",
        hsnCode: "90251100", taxRate: 18, isActive: true,
      },
    ];
  }

  generateExcelTemplate() {
    const template = this.getSampleTemplate();
    const worksheet = XLSX.utils.json_to_sheet(template);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Products");
    return workbook;
  }

  generateCSVTemplate() {
    const template = this.getSampleTemplate();
    const worksheet = XLSX.utils.json_to_sheet(template);
    return XLSX.utils.sheet_to_csv(worksheet);
  }
}

module.exports = new BulkProductImportService();
