const express = require("express");
const router = express.Router();
const { logger } = require('../config/logging');
const csv = require("csv-parser");
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");
const Product = require("../models/product.schema");
const Stock = require("../models/stock.schema");
const { authenticate } = require("../middleware/auth-multi-tenant");
const { importUpload, processUploadedFiles } = require("../services/file-upload.service");
const { cacheService } = require("../services/cache.service");

/**
 * @swagger
 * /api/bulk-products/import:
 *   post:
 *     summary: Bulk import products from CSV or Excel
 *     description: Upload a CSV or Excel file to import multiple products at once. Supports column mapping for different file formats. Requires authentication.
 *     tags: [Bulk Operations]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: CSV or Excel file (.csv, .xlsx, .xls)
 *     responses:
 *       200:
 *         description: Products imported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     imported: { type: integer, example: 45 }
 *                     skipped: { type: integer, example: 3 }
 *                     errors: { type: array, items: { type: object } }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *
 * /api/bulk-products/bulk-export:
 *   get:
 *     summary: Export all products to CSV
 *     description: Download all shop products as a CSV file. Requires authentication.
 *     tags: [Bulk Operations]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         schema: { type: string, enum: [csv, xlsx], default: csv }
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *         description: Filter by category
 *     responses:
 *       200:
 *         description: Products exported as file download
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *
 * /api/bulk-products/bulk-update:
 *   put:
 *     summary: Bulk update product prices or stock
 *     description: Update multiple products at once (price, cost, stock levels). Requires authentication.
 *     tags: [Bulk Operations]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [products]
 *             properties:
 *               products:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [_id]
 *                   properties:
 *                     _id: { type: string }
 *                     price: { type: number }
 *                     costPrice: { type: number }
 *                     isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: Products updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     updated: { type: integer, example: 20 }
 *                     failed: { type: integer, example: 0 }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *
 * /api/bulk-products/bulk-delete:
 *   post:
 *     summary: Bulk delete products
 *     description: Delete multiple products by ID array. Requires authentication.
 *     tags: [Bulk Operations]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productIds]
 *             properties:
 *               productIds:
 *                 type: array
 *                 items: { type: string }
 *                 example: ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"]
 *     responses:
 *       200:
 *         description: Products deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     deleted: { type: integer, example: 5 }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */

// Parse CSV file
const parseCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", () => resolve(results))
      .on("error", (error) => reject(error));
  });
};

// Parse Excel file
const parseExcel = (filePath) => {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    return data;
  } catch (error) {
    throw new Error("Failed to parse Excel file");
  }
};

// Column mapping function to handle different Excel formats
const mapProductColumns = (rawProduct) => {

  const columnMappings = {
    // Standard mappings
    name: [
      "name",
      "product_name",
      "productname",
      "item_name",
      "itemname",
      "product",
      "item",
      "description",
      "product_description",
      "product description",
    ],
    sku: [
      "sku",
      "code",
      "product_code",
      "productcode",
      "item_code",
      "itemcode",
      "barcode",
      "id",
      "product_id",
      "s/n",
      "sn",
      "serial",
      "serial_number",
    ],
    category: [
      "category",
      "cat",
      "type",
      "group",
      "product_category",
      "item_category",
    ],
    purchasePrice: [
      "purchase_price",
      "purchaseprice",
      "cost_price",
      "costprice",
      "cost",
      "buy_price",
      "buyprice",
      "wholesale_price",
      "distributor price (tk)",
      "distributor_price",
    ],
    sellingPrice: [
      "selling_price",
      "sellingprice",
      "sale_price",
      "saleprice",
      "price",
      "retail_price",
      "retailprice",
      "mrp",
      "price (tk)",
      "price_tk",
    ],
    unit: [
      "unit",
      "uom",
      "unit_of_measure",
      "measure",
      "qty_unit",
      "quantity_unit",
      "pack size",
      "pack_size",
      "packsize",
    ],
    minStockLevel: [
      "min_stock_level",
      "minstocklevel",
      "min_stock",
      "minstock",
      "reorder_level",
      "reorderlevel",
      "minimum_quantity",
      "test/pack",
      "test_pack",
    ],
    description: [
      "description",
      "desc",
      "details",
      "notes",
      "remarks",
      "product_details",
    ],
  };

  const mapped = {};

  // Get all available keys from the raw product (case-insensitive)
  const availableKeys = Object.keys(rawProduct).map((key) =>
    key.toLowerCase().trim(),
  );


  // Map each field
  for (const [standardField, possibleNames] of Object.entries(columnMappings)) {
    let value = null;

    // Try to find a matching column name
    for (const possibleName of possibleNames) {
      const matchingKey = availableKeys.find(
        (key) => key === possibleName.toLowerCase(),
      );
      if (matchingKey) {
        // Find the original key with correct case
        const originalKey = Object.keys(rawProduct).find(
          (k) => k.toLowerCase().trim() === matchingKey,
        );
        value = rawProduct[originalKey];
        break;
      }
    }

    if (!value) {
    }

    mapped[standardField] = value;
  }

  // Special handling for your Excel format
  // If no category found, set a default
  if (!mapped.category || mapped.category === null || mapped.category === "") {
    mapped.category = "Medical Supplies"; // Default category
  }

  // If SKU is just a number, create a proper SKU
  if (mapped.sku && !isNaN(mapped.sku)) {
    mapped.sku = `BIO-${String(mapped.sku).padStart(3, "0")}`;
  }

  return mapped;
};

// Validate product data
const validateProductData = (product, rowIndex) => {
  const errors = [];

  if (!product.name || product.name.trim() === "") {
    errors.push(`Row ${rowIndex}: Product name is required`);
  }

  if (!product.sku || product.sku.trim() === "") {
    errors.push(`Row ${rowIndex}: SKU is required`);
  }

  if (!product.category || product.category.trim() === "") {
    errors.push(`Row ${rowIndex}: Category is required`);
  }

  if (!product.purchasePrice || isNaN(parseFloat(product.purchasePrice))) {
    errors.push(`Row ${rowIndex}: Valid purchase price is required`);
  }

  if (!product.sellingPrice || isNaN(parseFloat(product.sellingPrice))) {
    errors.push(`Row ${rowIndex}: Valid selling price is required`);
  }

  if (parseFloat(product.sellingPrice) < parseFloat(product.purchasePrice)) {
    errors.push(
      `Row ${rowIndex}: Selling price cannot be less than purchase price`,
    );
  }

  if (!product.unit || product.unit.trim() === "") {
    errors.push(`Row ${rowIndex}: Unit is required`);
  }

  return errors;
};

// Bulk import products
router.post(
  "/bulk-import",
  (req, res, next) => {
    next();
  },
  authenticate,
  importUpload.single("file"),
  async (req, res) => {
    let filePath = null;

    try {

      // Validate authentication
      if (!req.user || !req.user.shopId) {
        logger.error("Bulk import - Missing user or shopId:", {
          hasUser: !!req.user,
          shopId: req.user?.shopId,
        });
        return res.status(401).json({
          success: false,
          message: "Authentication failed: Missing shop context",
        });
      }

      if (!req.file) {
        logger.error("Bulk import - No file in request:", {
          hasFile: !!req.file,
          files: req.files,
          body: req.body,
        });
        return res.status(400).json({
          success: false,
          message: "No file uploaded",
        });
      }

      filePath = req.file.path;
      const fileExtension = path.extname(req.file.originalname).toLowerCase();


      // Parse file based on type
      let products = [];
      try {
        if (fileExtension === ".csv") {
          products = await parseCSV(filePath);
        } else if (fileExtension === ".xlsx" || fileExtension === ".xls") {
          products = parseExcel(filePath);
        } else {
          throw new Error("Unsupported file format");
        }
      } catch (parseError) {
        logger.error("File parsing error:", parseError);
        throw new Error(`Failed to parse file: ${parseError.message}`);
      }


      if (products.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No products found in file",
        });
      }

      // Validate and process products
      const results = {
        totalRows: products.length,
        successCount: 0,
        errorCount: 0,
        errors: [],
        imported: [],
      };

      for (let i = 0; i < products.length; i++) {
        const rawProductData = products[i];
        const rowIndex = i + 2; // +2 for header row and 0-based index

        // Map columns to standard format
        const productData = mapProductColumns(rawProductData);


        // Validate product data
        const validationErrors = validateProductData(productData, rowIndex);
        if (validationErrors.length > 0) {
          results.errors.push(...validationErrors);
          results.errorCount++;
          continue;
        }

        try {
          // Check if product with same SKU exists
          const existingProduct = await Product.findOne({
            sku: productData.sku.trim(),
            shopId: req.user.shopId,
          });

          if (existingProduct) {
            results.errors.push(
              `Row ${rowIndex}: Product with SKU ${productData.sku} already exists`,
            );
            results.errorCount++;
            continue;
          }

          // Create product
          const newProduct = new Product({
            name: productData.name.trim(),
            sku: productData.sku.trim(),
            category: productData.category.trim(),
            purchasePrice: parseFloat(productData.purchasePrice),
            sellingPrice: parseFloat(productData.sellingPrice),
            unit: productData.unit.trim(),
            minStockLevel: parseInt(productData.minStockLevel) || 0,
            description: productData.description?.trim() || "",
            shopId: req.user.shopId,
            isActive: true,
          });

          await newProduct.save();

          // Create initial stock entry
          const stock = new Stock({
            productId: newProduct._id,
            shopId: req.user.shopId,
            currentQty: 0,
            minStockLevel: newProduct.minStockLevel,
          });

          await stock.save();

          results.imported.push({
            name: newProduct.name,
            sku: newProduct.sku,
          });
          results.successCount++;
        } catch (error) {
          logger.error(`Row ${rowIndex} import error:`, error);
          results.errors.push(
            `Row ${rowIndex}: ${error.message || "Failed to import product"}`,
          );
          results.errorCount++;
        }
      }


      // Clean up uploaded file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      res.json({
        success: true,
        message: `Import completed: ${results.successCount} products imported, ${results.errorCount} failed`,
        data: results,
      });

      // Invalidate products cache after bulk import
      if (results.successCount > 0) {
        cacheService.invalidateShopCache(req.user.shopId, "products");
      }
    } catch (error) {
      logger.error("Bulk import error:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });

      // Clean up uploaded file on error
      if (filePath && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (cleanupError) {
          logger.error("Failed to cleanup file:", cleanupError);
        }
      }

      // Ensure we always return a valid JSON response
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to import products",
        error: process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  },
);

// Bulk export products
router.get("/bulk-export", authenticate, async (req, res) => {
  try {
    const products = await Product.find({
      shopId: req.user.shopId,
      isActive: true,
    }).select(
      "name sku category purchasePrice sellingPrice unit minStockLevel description",
    );

    // Convert to CSV format
    const csvHeader =
      "name,sku,category,purchasePrice,sellingPrice,unit,minStockLevel,description\n";
    const csvRows = products
      .map(
        (p) =>
          `"${p.name}","${p.sku}","${p.category}",${p.purchasePrice},${p.sellingPrice},"${p.unit}",${p.minStockLevel},"${p.description || ""}"`,
      )
      .join("\n");

    const csv = csvHeader + csvRows;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=products-export-${Date.now()}.csv`,
    );
    res.send(csv);
  } catch (error) {
    logger.error("Export error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export products",
    });
  }
});

// Bulk update products
router.put("/bulk-update", authenticate, async (req, res) => {
  try {
    const { updates } = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No updates provided",
      });
    }

    const results = {
      totalRows: updates.length,
      successCount: 0,
      errorCount: 0,
      errors: [],
    };

    for (let i = 0; i < updates.length; i++) {
      const update = updates[i];

      try {
        if (!update.sku) {
          results.errors.push(`Row ${i + 1}: SKU is required`);
          results.errorCount++;
          continue;
        }

        const product = await Product.findOne({
          sku: update.sku,
          shopId: req.user.shopId,
        });

        if (!product) {
          results.errors.push(
            `Row ${i + 1}: Product with SKU ${update.sku} not found`,
          );
          results.errorCount++;
          continue;
        }

        // Update fields
        if (update.name) product.name = update.name;
        if (update.category) product.category = update.category;
        if (update.purchasePrice)
          product.purchasePrice = parseFloat(update.purchasePrice);
        if (update.sellingPrice)
          product.sellingPrice = parseFloat(update.sellingPrice);
        if (update.unit) product.unit = update.unit;
        if (update.minStockLevel !== undefined)
          product.minStockLevel = parseInt(update.minStockLevel);
        if (update.description !== undefined)
          product.description = update.description;

        await product.save();
        results.successCount++;
      } catch (error) {
        results.errors.push(`Row ${i + 1}: ${error.message}`);
        results.errorCount++;
      }
    }

    res.json({
      success: true,
      message: `Bulk update completed: ${results.successCount} products updated, ${results.errorCount} failed`,
      data: results,
    });

    // Invalidate products cache after bulk update
    if (results.successCount > 0) {
      cacheService.invalidateShopCache(req.user.shopId, "products");
    }
  } catch (error) {
    logger.error("Bulk update error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update products",
    });
  }
});

// Bulk delete products
router.post("/bulk-delete", authenticate, async (req, res) => {
  try {
    const { skus } = req.body;

    if (!Array.isArray(skus) || skus.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No SKUs provided",
      });
    }

    const results = {
      totalRows: skus.length,
      successCount: 0,
      errorCount: 0,
      errors: [],
    };

    for (let i = 0; i < skus.length; i++) {
      const sku = skus[i];

      try {
        const product = await Product.findOne({
          sku,
          shopId: req.user.shopId,
        });

        if (!product) {
          results.errors.push(`SKU ${sku}: Product not found`);
          results.errorCount++;
          continue;
        }

        // Soft delete
        product.isActive = false;
        await product.save();
        results.successCount++;
      } catch (error) {
        results.errors.push(`SKU ${sku}: ${error.message}`);
        results.errorCount++;
      }
    }

    res.json({
      success: true,
      message: `Bulk delete completed: ${results.successCount} products deleted, ${results.errorCount} failed`,
      data: results,
    });

    // Invalidate products cache after bulk delete
    if (results.successCount > 0) {
      cacheService.invalidateShopCache(req.user.shopId, "products");
    }
  } catch (error) {
    logger.error("Bulk delete error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete products",
    });
  }
});

module.exports = router;
