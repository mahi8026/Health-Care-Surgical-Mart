/**
 * Products Controller
 * Handles business logic for product CRUD operations
 */

const BaseController = require("./base.controller");
const { ObjectId } = require("mongodb");
const { logger } = require("../config/logging");

class ProductsController extends BaseController {
  /**
   * Get all products with stock information
   */
  async getProducts(req, res) {
    try {
      const { category, search, isActive } = req.query;

      const matchStage = this._buildProductFilter({ category, search, isActive });
      const products = await this._fetchProductsWithStock(req.shopDb, matchStage);

      this.sendSuccess(res, products, "Products fetched successfully");
    } catch (error) {
      logger.error("Get products error:", error);
      this.sendError(res, "Failed to fetch products", 500, error);
    }
  }

  /**
   * Get single product by ID
   */
  async getProductById(req, res) {
    try {
      const product = await req.shopDb.collection("products").findOne({
        _id: new ObjectId(req.params.id),
      });

      if (!product) {
        return this.sendError(res, "Product not found", 404);
      }

      this.sendSuccess(res, product, "Product fetched successfully");
    } catch (error) {
      logger.error("Get product error:", error);
      this.sendError(res, "Failed to fetch product", 500, error);
    }
  }

  /**
   * Create new product
   */
  async createProduct(req, res) {
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
      this.validateRequired(req.body, [
        "name",
        "category",
        "sku",
        "purchasePrice",
        "sellingPrice",
        "unit",
        "minStockLevel",
      ]);

      // Check if SKU already exists
      const existingProduct = await req.shopDb
        .collection("products")
        .findOne({ sku });

      if (existingProduct) {
        return this.sendError(res, "SKU already exists", 400);
      }

      // Build product object
      const product = this._buildProductObject({
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
      });

      // Insert product
      const result = await req.shopDb.collection("products").insertOne(product);

      // Create initial stock record
      await this._createInitialStock(req.shopDb, result.insertedId, name, minStockLevel);

      this.sendSuccess(
        res,
        { _id: result.insertedId, ...product },
        "Product created successfully",
        201,
      );
    } catch (error) {
      logger.error("Create product error:", error);
      this.sendError(res, error.message || "Failed to create product", 500, error);
    }
  }

  /**
   * Update product
   */
  async updateProduct(req, res) {
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
        return this.sendError(res, "Product not found", 404);
      }

      // Check if SKU is being changed and if new SKU already exists
      if (sku && sku !== existingProduct.sku) {
        const skuExists = await req.shopDb.collection("products").findOne({
          sku,
          _id: { $ne: new ObjectId(req.params.id) },
        });

        if (skuExists) {
          return this.sendError(res, "SKU already exists", 400);
        }
      }

      // Build update data
      const updateData = this._buildUpdateData({
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
      });

      // Update product
      await req.shopDb
        .collection("products")
        .updateOne({ _id: new ObjectId(req.params.id) }, { $set: updateData });

      // Update stock record if needed
      await this._updateStockRecord(req.shopDb, req.params.id, name, minStockLevel);

      this.sendSuccess(res, null, "Product updated successfully");
    } catch (error) {
      logger.error("Update product error:", error);
      this.sendError(res, "Failed to update product", 500, error);
    }
  }

  /**
   * Delete product (soft delete)
   */
  async deleteProduct(req, res) {
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
        return this.sendError(res, "Product not found", 404);
      }

      this.sendSuccess(res, null, "Product deleted successfully");
    } catch (error) {
      logger.error("Delete product error:", error);
      this.sendError(res, "Failed to delete product", 500, error);
    }
  }

  // ==================== Private Helper Methods ====================

  /**
   * Build product filter for queries
   */
  _buildProductFilter({ category, search, isActive }) {
    const matchStage = {};

    if (category) matchStage.category = category;
    if (isActive !== undefined) matchStage.isActive = isActive === "true";
    if (search) {
      matchStage.$or = [
        { name: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } },
        { brand: { $regex: search, $options: "i" } },
      ];
    }

    return matchStage;
  }

  /**
   * Fetch products with stock information
   */
  async _fetchProductsWithStock(shopDb, matchStage) {
    const stockCollectionName = shopDb.getCollectionName("stock");

    return await shopDb
      .collection("products")
      .aggregate([
        { $match: matchStage },
        {
          $lookup: {
            from: stockCollectionName,
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
        { $project: { stock: 0 } },
        { $sort: { name: 1 } },
      ])
      .toArray();
  }

  /**
   * Build product object for creation
   */
  _buildProductObject({
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
  }) {
    return {
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
  }

  /**
   * Build update data object
   */
  _buildUpdateData({
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
  }) {
    const updateData = {
      updatedAt: new Date(),
    };

    if (name) updateData.name = name;
    if (category) updateData.category = category;
    if (brand !== undefined) updateData.brand = brand;
    if (sku) updateData.sku = sku;
    if (purchasePrice !== undefined)
      updateData.purchasePrice = parseFloat(purchasePrice);
    if (sellingPrice !== undefined)
      updateData.sellingPrice = parseFloat(sellingPrice);
    if (unit) updateData.unit = unit;
    if (minStockLevel !== undefined)
      updateData.minStockLevel = parseInt(minStockLevel);
    if (description !== undefined) updateData.description = description;
    if (batchNo !== undefined) updateData.batchNo = batchNo;
    if (expiryDate !== undefined)
      updateData.expiryDate = expiryDate ? new Date(expiryDate) : null;
    if (isActive !== undefined) updateData.isActive = isActive;

    return updateData;
  }

  /**
   * Create initial stock record for new product
   */
  async _createInitialStock(shopDb, productId, name, minStockLevel) {
    await shopDb.collection("stock").insertOne({
      productId: productId,
      productName: name,
      currentQty: 0,
      reservedQty: 0,
      availableQty: 0,
      minStockLevel: parseInt(minStockLevel),
      isLowStock: true,
      lastUpdated: new Date(),
      createdAt: new Date(),
    });
  }

  /**
   * Update stock record when product is updated
   */
  async _updateStockRecord(shopDb, productId, name, minStockLevel) {
    if (!name && minStockLevel === undefined) {
      return; // Nothing to update
    }

    const stockUpdate = { lastUpdated: new Date() };

    if (name) {
      stockUpdate.productName = name;
    }

    if (minStockLevel !== undefined) {
      stockUpdate.minStockLevel = parseInt(minStockLevel);

      // Update isLowStock flag
      const stock = await shopDb.collection("stock").findOne({
        productId: new ObjectId(productId),
      });

      if (stock) {
        stockUpdate.isLowStock = stock.currentQty <= parseInt(minStockLevel);
      }
    }

    await shopDb
      .collection("stock")
      .updateOne({ productId: new ObjectId(productId) }, { $set: stockUpdate });
  }
}

module.exports = new ProductsController();
