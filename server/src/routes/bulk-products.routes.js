const express = require('express');
const router = express.Router();
const { logger } = require('../config/logging');
const csv = require('csv-parser');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const { ObjectId: _ObjectId } = require('mongodb');
const { authenticate } = require('../middleware/auth-multi-tenant');
const { importUpload } = require('../services/file-upload.service');
const { cacheService } = require('../services/cache.service');

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
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
};

// Parse Excel file
const parseExcel = async (filePath) => {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      throw new Error('No worksheets found in Excel file');
    }

    const data = [];
    const headers = [];

    // Get headers from first row
    worksheet.getRow(1).eachCell((cell, colNumber) => {
      headers[colNumber] = cell.value?.toString() || `column_${colNumber}`;
    });

    // Get data rows
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {return;} // Skip header row

      const rowData = {};
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber];
        if (header) {
          rowData[header] = cell.value;
        }
      });

      // Only add non-empty rows
      if (Object.keys(rowData).length > 0) {
        data.push(rowData);
      }
    });

    return data;
  } catch (error) {
    throw new Error(`Failed to parse Excel file: ${error.message}`);
  }
};

// Column mapping function to handle different Excel formats
const mapProductColumns = (rawProduct) => {

  const columnMappings = {
    // Standard mappings
    name: [
      'name', 'product_name', 'productname', 'item_name', 'itemname',
      'product', 'item', 'description', 'product_description', 'product description',
    ],
    sku: [
      'sku', 'code', 'product_code', 'productcode', 'item_code', 'itemcode',
      'barcode', 'id', 'product_id', 's/n', 'sn', 'serial', 'serial_number',
    ],
    category: [
      'category', 'cat', 'type', 'group', 'product_category', 'item_category',
    ],
    brand: [
      'brand', 'brand_name', 'brandname', 'manufacturer', 'company', 'make',
    ],
    purchasePrice: [
      'purchase_price', 'purchaseprice', 'cost_price', 'costprice', 'cost',
      'buy_price', 'buyprice', 'wholesale_price', 'distributor price (tk)',
      'distributor_price',
    ],
    sellingPrice: [
      'selling_price', 'sellingprice', 'sale_price', 'saleprice', 'price',
      'retail_price', 'retailprice', 'mrp', 'price (tk)', 'price_tk',
    ],
    unit: [
      'unit', 'uom', 'unit_of_measure', 'measure', 'qty_unit', 'quantity_unit',
      'pack size', 'pack_size', 'packsize',
    ],
    minStockLevel: [
      'min_stock_level', 'minstocklevel', 'min_stock', 'minstock',
      'reorder_level', 'reorderlevel', 'minimum_quantity', 'test/pack', 'test_pack',
    ],
    initialStock: [
      'initial_stock', 'initialstock', 'opening_stock', 'openingstock',
      'quantity', 'qty', 'stock', 'current_stock', 'currentstock',
      'on_hand', 'onhand', 'stock_qty', 'stockqty',
    ],
    expiryDate: [
      'expiry_date', 'expirydate', 'expiry', 'expiration_date', 'exp_date',
      'expdate', 'best_before', 'bestbefore',
    ],
    description: [
      'description', 'desc', 'details', 'notes', 'remarks', 'product_details',
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
  if (!mapped.category || mapped.category === null || mapped.category === '') {
    mapped.category = 'Medical Supplies'; // Default category
  }

  // If SKU is just a number, create a proper SKU
  if (mapped.sku && !isNaN(mapped.sku)) {
    mapped.sku = `BIO-${String(mapped.sku).padStart(3, '0')}`;
  }

  return mapped;
};

// Validate product data
const validateProductData = (product, rowIndex) => {
  const errors = [];

  if (!product.name || product.name.trim() === '') {
    errors.push(`Row ${rowIndex}: Product name is required`);
  }

  if (!product.sku || product.sku.trim() === '') {
    errors.push(`Row ${rowIndex}: SKU is required`);
  }

  if (!product.category || product.category.trim() === '') {
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

  if (!product.unit || product.unit.trim() === '') {
    errors.push(`Row ${rowIndex}: Unit is required`);
  }

  return errors;
};

// Bulk import products
router.post(
  '/bulk-import',
  (req, res, next) => {
    next();
  },
  authenticate,
  importUpload.single('file'),
  async (req, res) => {
    let filePath = null;

    try {

      // Validate authentication
      if (!req.user || !req.user.shopId) {
        logger.error('Bulk import - Missing user or shopId:', {
          hasUser: !!req.user,
          shopId: req.user?.shopId,
        });
        return res.status(401).json({
          success: false,
          message: 'Authentication failed: Missing shop context',
        });
      }

      if (!req.file) {
        logger.error('Bulk import - No file in request:', {
          hasFile: !!req.file,
          files: req.files,
          body: req.body,
        });
        return res.status(400).json({
          success: false,
          message: 'No file uploaded',
        });
      }

      filePath = req.file.path;
      const fileExtension = path.extname(req.file.originalname).toLowerCase();


      // Parse file based on type
      let products = [];
      try {
        if (fileExtension === '.csv') {
          products = await parseCSV(filePath);
        } else if (fileExtension === '.xlsx' || fileExtension === '.xls') {
          products = await parseExcel(filePath);
        } else {
          throw new Error('Unsupported file format');
        }
      } catch (parseError) {
        logger.error('File parsing error:', parseError);
        throw new Error(`Failed to parse file: ${parseError.message}`);
      }


      if (products.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No products found in file',
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
          const existingProduct = await req.shopDb.collection('products').findOne({
            sku: productData.sku.trim(),
          });

          if (existingProduct) {
            results.errors.push(
              `Row ${rowIndex}: Product with SKU ${productData.sku} already exists`,
            );
            results.errorCount++;
            continue;
          }

          // Create product
          const initialQty = parseInt(productData.initialStock) || 0;
          const newProduct = {
            name: productData.name.trim(),
            sku: productData.sku.trim(),
            category: productData.category.trim(),
            brand: productData.brand?.trim() || '',
            purchasePrice: parseFloat(productData.purchasePrice),
            sellingPrice: parseFloat(productData.sellingPrice),
            unit: productData.unit.trim(),
            minStockLevel: parseInt(productData.minStockLevel) || 10,
            reorderPoint: parseInt(productData.minStockLevel) || 10,
            expiryDate: productData.expiryDate ? new Date(productData.expiryDate) : null,
            description: productData.description?.trim() || '',
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const productResult = await req.shopDb.collection('products').insertOne(newProduct);
          const newProductId = productResult.insertedId;

          // Create legacy stock entry
          await req.shopDb.collection('stock').insertOne({
            productId: newProductId,
            productName: newProduct.name,
            currentQty: initialQty,
            reservedQty: 0,
            availableQty: initialQty,
            minStockLevel: newProduct.minStockLevel,
            isLowStock: initialQty <= newProduct.minStockLevel,
            lastUpdated: new Date(),
            createdAt: new Date(),
          });

          // Create stock_snapshot (single source of truth for stock quantities)
          await req.shopDb.collection('stock_snapshots').insertOne({
            productId: newProductId,
            productName: newProduct.name,
            sku: newProduct.sku,
            category: newProduct.category,
            unit: newProduct.unit,
            onHandQty: initialQty,
            reservedQty: 0,
            availableQty: initialQty,
            avgCostPrice: newProduct.purchasePrice,
            totalCostValue: initialQty * newProduct.purchasePrice,
            reorderPoint: newProduct.reorderPoint,
            lastMovementType: initialQty > 0 ? 'OPENING_STOCK' : null,
            lastMovementDate: initialQty > 0 ? new Date() : null,
            lastLedgerVersion: 0,
            lastLedgerEntryId: null,
            version: 0,
            updatedAt: new Date(),
            createdAt: new Date(),
          });

          // If initial stock > 0, record a ledger event for audit trail
          if (initialQty > 0) {
            await req.shopDb.collection('stock_ledger').insertOne({
              productId: newProductId,
              movementType: 'OPENING_STOCK',
              direction: 'IN',
              quantity: initialQty,
              runningBalance: initialQty,
              version: 1,
              referenceType: 'BULK_IMPORT',
              referenceId: null,
              costPrice: newProduct.purchasePrice,
              userId: req.user?._id || null,
              timestamp: new Date(),
              note: 'Opening stock from bulk import',
              metadata: { source: 'bulk_import' },
            });
          }

          results.imported.push({
            name: newProduct.name,
            sku: newProduct.sku,
          });
          results.successCount++;
        } catch (error) {
          logger.error(`Row ${rowIndex} import error:`, error);
          results.errors.push(
            `Row ${rowIndex}: ${error.message || 'Failed to import product'}`,
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
        cacheService.invalidateShopCache(req.user.shopId, 'products');
      }
    } catch (error) {
      logger.error('Bulk import error:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });

      // Clean up uploaded file on error
      if (filePath && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (cleanupError) {
          logger.error('Failed to cleanup file:', cleanupError);
        }
      }

      // Ensure we always return a valid JSON response
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to import products',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  },
);

// Bulk export products
router.get('/bulk-export', authenticate, async (req, res) => {
  try {
    const products = await req.shopDb.collection('products').find({
      isActive: true,
    }).project({
      name: 1, sku: 1, category: 1, purchasePrice: 1, sellingPrice: 1, unit: 1, minStockLevel: 1, description: 1,
    }).toArray();

    // Convert to CSV format
    const csvHeader =
      'name,sku,category,purchasePrice,sellingPrice,unit,minStockLevel,description\n';
    const csvRows = products
      .map(
        (p) =>
          `"${p.name}","${p.sku}","${p.category}",${p.purchasePrice},${p.sellingPrice},"${p.unit}",${p.minStockLevel},"${p.description || ''}"`,
      )
      .join('\n');

    const csv = csvHeader + csvRows;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=products-export-${Date.now()}.csv`,
    );
    res.send(csv);
  } catch (error) {
    logger.error('Export error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export products',
    });
  }
});

// Bulk update products
router.put('/bulk-update', authenticate, async (req, res) => {
  try {
    const { updates } = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No updates provided',
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

        const product = await req.shopDb.collection('products').findOne({
          sku: update.sku,
        });

        if (!product) {
          results.errors.push(
            `Row ${i + 1}: Product with SKU ${update.sku} not found`,
          );
          results.errorCount++;
          continue;
        }

        // Build update fields
        const updateFields = { updatedAt: new Date() };
        if (update.name) {updateFields.name = update.name;}
        if (update.category) {updateFields.category = update.category;}
        if (update.purchasePrice) {updateFields.purchasePrice = parseFloat(update.purchasePrice);}
        if (update.sellingPrice) {updateFields.sellingPrice = parseFloat(update.sellingPrice);}
        if (update.unit) {updateFields.unit = update.unit;}
        if (update.minStockLevel !== undefined) {updateFields.minStockLevel = parseInt(update.minStockLevel);}
        if (update.description !== undefined) {updateFields.description = update.description;}

        await req.shopDb.collection('products').updateOne(
          { _id: product._id },
          { $set: updateFields },
        );
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
      cacheService.invalidateShopCache(req.user.shopId, 'products');
    }
  } catch (error) {
    logger.error('Bulk update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update products',
    });
  }
});

// Bulk delete products
router.post('/bulk-delete', authenticate, async (req, res) => {
  try {
    const { skus } = req.body;

    if (!Array.isArray(skus) || skus.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No SKUs provided',
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
        const product = await req.shopDb.collection('products').findOne({ sku });

        if (!product) {
          results.errors.push(`SKU ${sku}: Product not found`);
          results.errorCount++;
          continue;
        }

        // Soft delete
        await req.shopDb.collection('products').updateOne(
          { _id: product._id },
          { $set: { isActive: false, updatedAt: new Date() } },
        );
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
      cacheService.invalidateShopCache(req.user.shopId, 'products');
    }
  } catch (error) {
    logger.error('Bulk delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete products',
    });
  }
});

module.exports = router;
