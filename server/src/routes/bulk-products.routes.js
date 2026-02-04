const express = require("express");
const router = express.Router();
const multer = require("multer");
const csv = require("csv-parser");
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");
const Product = require("../models/product.schema");
const Stock = require("../models/stock.schema");
const { authenticateToken } = require("../middleware/auth-multi-tenant");

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../../uploads/bulk");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `bulk-${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only CSV and Excel files are allowed."));
    }
  },
});

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
  authenticateToken,
  upload.single("file"),
  async (req, res) => {
    let filePath = null;

    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded",
        });
      }

      filePath = req.file.path;
      const fileExtension = path.extname(req.file.originalname).toLowerCase();

      // Parse file based on type
      let products = [];
      if (fileExtension === ".csv") {
        products = await parseCSV(filePath);
      } else if (fileExtension === ".xlsx" || fileExtension === ".xls") {
        products = parseExcel(filePath);
      } else {
        throw new Error("Unsupported file format");
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
        const productData = products[i];
        const rowIndex = i + 2; // +2 for header row and 0-based index

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
    } catch (error) {
      console.error("Bulk import error:", error);

      // Clean up uploaded file on error
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      res.status(500).json({
        success: false,
        message: error.message || "Failed to import products",
      });
    }
  },
);

// Bulk export products
router.get("/bulk-export", authenticateToken, async (req, res) => {
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
    console.error("Export error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export products",
    });
  }
});

// Bulk update products
router.put("/bulk-update", authenticateToken, async (req, res) => {
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
  } catch (error) {
    console.error("Bulk update error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update products",
    });
  }
});

// Bulk delete products
router.post("/bulk-delete", authenticateToken, async (req, res) => {
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
  } catch (error) {
    console.error("Bulk delete error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete products",
    });
  }
});

module.exports = router;
