/**
 * Products Routes - Multi-Tenant
 * Handles product CRUD operations for shops
 */

const express = require("express");
const router = express.Router();
const {
  authenticate,
  checkShopStatus,
} = require("../middleware/auth-multi-tenant");
const { requirePermission } = require("../utils/rbac");
const { PERMISSIONS } = require("../utils/rbac");
const { ObjectId } = require("mongodb");

// Apply authentication and shop status check to all routes
router.use(authenticate);
router.use(checkShopStatus);

/**
 * GET /api/products
 * Get all products for the shop
 */
router.get(
  "/",
  requirePermission(PERMISSIONS.VIEW_PRODUCTS),
  async (req, res) => {
    try {
      const { category, search, isActive } = req.query;

      // Build match stage for aggregation
      const matchStage = {};
      if (category) matchStage.category = category;
      if (search) {
        matchStage.$or = [
          { name: { $regex: search, $options: "i" } },
          { sku: { $regex: search, $options: "i" } },
          { brand: { $regex: search, $options: "i" } },
        ];
      }
      if (isActive !== undefined) matchStage.isActive = isActive === "true";

      // Aggregate products with stock data
      const products = await req.shopDb
        .collection("products")
        .aggregate([
          { $match: matchStage },
          {
            $lookup: {
              from: "stock",
              localField: "_id",
              foreignField: "productId",
              as: "stock",
            },
          },
          {
            $addFields: {
              stockQuantity: {
                $ifNull: [{ $arrayElemAt: ["$stock.currentQty", 0] }, 0],
              },
              isLowStock: {
                $cond: {
                  if: { $gt: [{ $size: "$stock" }, 0] },
                  then: {
                    $lte: [
                      { $arrayElemAt: ["$stock.currentQty", 0] },
                      "$minStockLevel",
                    ],
                  },
                  else: true,
                },
              },
              category: {
                _id: { $toLower: "$category" },
                name: "$category",
              },
            },
          },
          { $project: { stock: 0 } }, // Remove the stock array from output
          { $sort: { name: 1 } },
        ])
        .toArray();

      res.json({
        success: true,
        count: products.length,
        data: products,
      });
    } catch (error) {
      console.error("Get products error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch products",
      });
    }
  },
);

/**
 * GET /api/products/:id
 * Get single product by ID
 */
router.get(
  "/:id",
  requirePermission(PERMISSIONS.VIEW_PRODUCTS),
  async (req, res) => {
    try {
      const product = await req.shopDb.collection("products").findOne({
        _id: new ObjectId(req.params.id),
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found",
        });
      }

      res.json({
        success: true,
        data: product,
      });
    } catch (error) {
      console.error("Get product error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch product",
      });
    }
  },
);

/**
 * POST /api/products
 * Create new product
 */
router.post(
  "/",
  requirePermission(PERMISSIONS.CREATE_PRODUCT),
  async (req, res) => {
    try {
      const {
        name,
        category,
        brand,
        sku,
        purchasePrice,
        sellingPrice,
        unit,
        minStockLevel,
        description,
        batchNo,
        expiryDate,
      } = req.body;

      // Validate required fields
      if (
        !name ||
        !category ||
        !sku ||
        !purchasePrice ||
        !sellingPrice ||
        !unit ||
        minStockLevel === undefined
      ) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields",
        });
      }

      // Check if SKU already exists
      const existingProduct = await req.shopDb
        .collection("products")
        .findOne({ sku });
      if (existingProduct) {
        return res.status(400).json({
          success: false,
          message: "SKU already exists",
        });
      }

      const product = {
        name,
        category,
        brand: brand || "",
        sku,
        purchasePrice: parseFloat(purchasePrice),
        sellingPrice: parseFloat(sellingPrice),
        unit,
        minStockLevel: parseInt(minStockLevel),
        description: description || "",
        batchNo: batchNo || "",
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await req.shopDb.collection("products").insertOne(product);

      // Create initial stock record
      await req.shopDb.collection("stock").insertOne({
        productId: result.insertedId,
        productName: name,
        currentQty: 0,
        reservedQty: 0,
        availableQty: 0,
        minStockLevel: parseInt(minStockLevel),
        isLowStock: true,
        lastUpdated: new Date(),
        createdAt: new Date(),
      });

      res.status(201).json({
        success: true,
        message: "Product created successfully",
        data: { _id: result.insertedId, ...product },
      });
    } catch (error) {
      console.error("Create product error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create product",
      });
    }
  },
);

/**
 * PUT /api/products/:id
 * Update product
 */
router.put(
  "/:id",
  requirePermission(PERMISSIONS.EDIT_PRODUCT),
  async (req, res) => {
    try {
      const {
        name,
        category,
        brand,
        sku,
        purchasePrice,
        sellingPrice,
        unit,
        minStockLevel,
        description,
        batchNo,
        expiryDate,
        isActive,
      } = req.body;

      // Check if product exists
      const existingProduct = await req.shopDb.collection("products").findOne({
        _id: new ObjectId(req.params.id),
      });

      if (!existingProduct) {
        return res.status(404).json({
          success: false,
          message: "Product not found",
        });
      }

      // Check if SKU is being changed and if new SKU already exists
      if (sku && sku !== existingProduct.sku) {
        const skuExists = await req.shopDb.collection("products").findOne({
          sku,
          _id: { $ne: new ObjectId(req.params.id) },
        });

        if (skuExists) {
          return res.status(400).json({
            success: false,
            message: "SKU already exists",
          });
        }
      }

      const updateData = {
        ...(name && { name }),
        ...(category && { category }),
        ...(brand !== undefined && { brand }),
        ...(sku && { sku }),
        ...(purchasePrice !== undefined && {
          purchasePrice: parseFloat(purchasePrice),
        }),
        ...(sellingPrice !== undefined && {
          sellingPrice: parseFloat(sellingPrice),
        }),
        ...(unit && { unit }),
        ...(minStockLevel !== undefined && {
          minStockLevel: parseInt(minStockLevel),
        }),
        ...(description !== undefined && { description }),
        ...(batchNo !== undefined && { batchNo }),
        ...(expiryDate !== undefined && {
          expiryDate: expiryDate ? new Date(expiryDate) : null,
        }),
        ...(isActive !== undefined && { isActive }),
        updatedAt: new Date(),
      };

      const result = await req.shopDb
        .collection("products")
        .updateOne({ _id: new ObjectId(req.params.id) }, { $set: updateData });

      // Update stock record if name or minStockLevel changed
      if (name || minStockLevel !== undefined) {
        const stockUpdate = {};
        if (name) stockUpdate.productName = name;
        if (minStockLevel !== undefined) {
          stockUpdate.minStockLevel = parseInt(minStockLevel);
          // Update isLowStock flag
          const stock = await req.shopDb.collection("stock").findOne({
            productId: new ObjectId(req.params.id),
          });
          if (stock) {
            stockUpdate.isLowStock =
              stock.currentQty <= parseInt(minStockLevel);
          }
        }

        if (Object.keys(stockUpdate).length > 0) {
          stockUpdate.lastUpdated = new Date();
          await req.shopDb
            .collection("stock")
            .updateOne(
              { productId: new ObjectId(req.params.id) },
              { $set: stockUpdate },
            );
        }
      }

      res.json({
        success: true,
        message: "Product updated successfully",
      });
    } catch (error) {
      console.error("Update product error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update product",
      });
    }
  },
);

/**
 * DELETE /api/products/:id
 * Delete product (soft delete)
 */
router.delete(
  "/:id",
  requirePermission(PERMISSIONS.DELETE_PRODUCT),
  async (req, res) => {
    try {
      const result = await req.shopDb.collection("products").updateOne(
        { _id: new ObjectId(req.params.id) },
        {
          $set: {
            isActive: false,
            updatedAt: new Date(),
          },
        },
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Product not found",
        });
      }

      res.json({
        success: true,
        message: "Product deleted successfully",
      });
    } catch (error) {
      console.error("Delete product error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete product",
      });
    }
  },
);

module.exports = router;
