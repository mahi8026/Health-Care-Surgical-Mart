/**
 * Products Controller
 * Handles business logic for product CRUD operations
 */

const BaseController = require('./base.controller');
const { ObjectId } = require('mongodb');
const { logger } = require('../config/logging');
const auditLog = require('../services/audit-log.service');
const { AUDIT_ACTIONS } = require('../models/audit-log.schema');
const { cacheService } = require('../services/cache.service');

class ProductsController extends BaseController {
  /**
   * Get all products with stock information
   */
  async getProducts(req, res) {
    try {
      const { category, search, isActive } = req.query;

      const matchStage = this._buildProductFilter({ category, search, isActive });
      const products = await this._fetchProductsWithStock(req.shopDb, matchStage);

      this.sendSuccess(res, products, 'Products fetched successfully');
    } catch (error) {
      logger.error('Get products error:', error);
      this.sendError(res, 'Failed to fetch products', 500, error);
    }
  }

  /**
   * Get single product by ID
   */
  async getProductById(req, res) {
    try {
      const product = await req.shopDb.collection('products').findOne({
        _id: new ObjectId(req.params.id),
      });

      if (!product) {
        return this.sendError(res, 'Product not found', 404);
      }

      this.sendSuccess(res, product, 'Product fetched successfully');
    } catch (error) {
      logger.error('Get product error:', error);
      this.sendError(res, 'Failed to fetch product', 500, error);
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
        initialQuantity,
        minStockLevel,
        description,
        batchNo,
        lotNo,
        expiryDate,
        reorderPoint,
        maxStock,
      } = req.body;

      // Validate required fields
      this.validateRequired(req.body, [
        'name',
        'category',
        'sku',
        'purchasePrice',
        'sellingPrice',
        'unit',
        'minStockLevel',
      ]);

      // Check if SKU already exists
      const existingProduct = await req.shopDb
        .collection('products')
        .findOne({ sku });

      if (existingProduct) {
        return this.sendError(res, 'SKU already exists', 400);
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
        lotNo,
        expiryDate,
        reorderPoint,
        maxStock,
      });

      // Insert product
      const result = await req.shopDb.collection('products').insertOne(product);

      // Create initial stock record with initial quantity
      const initialQty = initialQuantity !== undefined ? parseInt(initialQuantity) : 0;
      await this._createInitialStock(
        req.shopDb,
        result.insertedId,
        name,
        sku,
        minStockLevel,
        initialQty,
        parseFloat(purchasePrice)
      );

      // Audit: product created
      auditLog.log(req, AUDIT_ACTIONS.PRODUCT_CREATED, 'product', result.insertedId.toString(),
        `Created product "${name}" (SKU: ${sku})`,
        { after: { name, sku, category, sellingPrice, purchasePrice } }
      );

      // Invalidate products cache
      cacheService.invalidateShopCache(req.user.shopId, 'products');

      this.sendSuccess(
        res,
        { _id: result.insertedId, ...product },
        'Product created successfully',
        201,
      );
    } catch (error) {
      logger.error('Create product error:', error);
      this.sendError(res, error.message || 'Failed to create product', 500, error);
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
        lotNo,
        expiryDate,
        reorderPoint,
        maxStock,
        isActive,
      } = req.body;

      // Check if product exists
      const existingProduct = await req.shopDb.collection('products').findOne({
        _id: new ObjectId(req.params.id),
      });

      if (!existingProduct) {
        return this.sendError(res, 'Product not found', 404);
      }

      // Check if SKU is being changed and if new SKU already exists
      if (sku && sku !== existingProduct.sku) {
        const skuExists = await req.shopDb.collection('products').findOne({
          sku,
          _id: { $ne: new ObjectId(req.params.id) },
        });

        if (skuExists) {
          return this.sendError(res, 'SKU already exists', 400);
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
        lotNo,
        expiryDate,
        reorderPoint,
        maxStock,
        isActive,
      });

      // Update product
      await req.shopDb
        .collection('products')
        .updateOne({ _id: new ObjectId(req.params.id) }, { $set: updateData });

      // Update stock record if needed
      await this._updateStockRecord(req.shopDb, req.params.id, name, minStockLevel);

      // Audit: product updated
      auditLog.log(req, AUDIT_ACTIONS.PRODUCT_UPDATED, 'product', req.params.id,
        `Updated product "${existingProduct.name}"`,
        {
          before: { name: existingProduct.name, sku: existingProduct.sku, sellingPrice: existingProduct.sellingPrice, isActive: existingProduct.isActive },
          after: updateData,
        }
      );

      // Invalidate products cache
      cacheService.invalidateShopCache(req.user.shopId, 'products');

      this.sendSuccess(res, null, 'Product updated successfully');
    } catch (error) {
      logger.error('Update product error:', error);
      this.sendError(res, 'Failed to update product', 500, error);
    }
  }

  /**
   * Delete product (soft delete)
   */
  async deleteProduct(req, res) {
    try {
      const result = await req.shopDb.collection('products').updateOne(
        { _id: new ObjectId(req.params.id) },
        {
          $set: {
            isActive: false,
            updatedAt: new Date(),
          },
        },
      );

      if (result.matchedCount === 0) {
        return this.sendError(res, 'Product not found', 404);
      }

      // Audit: product deleted (soft delete)
      auditLog.log(req, AUDIT_ACTIONS.PRODUCT_DELETED, 'product', req.params.id,
        `Deleted (deactivated) product ID ${req.params.id}`,
        { after: { isActive: false } }
      );

      // Invalidate products cache
      cacheService.invalidateShopCache(req.user.shopId, 'products');

      this.sendSuccess(res, null, 'Product deleted successfully');
    } catch (error) {
      logger.error('Delete product error:', error);
      this.sendError(res, 'Failed to delete product', 500, error);
    }
  }

  // ==================== Private Helper Methods ====================

  /**
   * Build product filter for queries
   */
  _buildProductFilter({ category, search, isActive }) {
    const matchStage = {};

    if (category) {matchStage.category = category;}
    if (isActive !== undefined) {matchStage.isActive = isActive === 'true';}
    if (search) {
      matchStage.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
      ];
    }

    return matchStage;
  }

  /**
   * Fetch products with stock information
   */
  async _fetchProductsWithStock(shopDb, matchStage) {
    return await shopDb
      .collection('products')
      .aggregate([
        { $match: matchStage },
        {
          $lookup: {
            from: 'stock',
            localField: '_id',
            foreignField: 'productId',
            as: 'stock',
          },
        },
        {
          $addFields: {
            stockQuantity: {
              $ifNull: [{ $arrayElemAt: ['$stock.currentQty', 0] }, 0],
            },
            isLowStock: {
              $cond: {
                if: { $gt: [{ $size: '$stock' }, 0] },
                then: {
                  $lte: [
                    { $arrayElemAt: ['$stock.currentQty', 0] },
                    '$minStockLevel',
                  ],
                },
                else: true,
              },
            },
            category: {
              _id: { $toLower: '$category' },
              name: '$category',
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
    name, category, brand, sku, purchasePrice, sellingPrice,
    unit, minStockLevel, description, batchNo, lotNo, expiryDate,
    reorderPoint, maxStock,
  }) {
    return {
      name,
      category,
      brand: brand || '',
      sku,
      purchasePrice: parseFloat(purchasePrice),
      sellingPrice: parseFloat(sellingPrice),
      unit,
      minStockLevel: parseInt(minStockLevel),
      description: description || '',
      batchNo: batchNo || '',
      lotNo: lotNo || '',
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      reorderPoint: reorderPoint !== undefined ? parseInt(reorderPoint) : 10,
      maxStock: maxStock !== undefined ? parseInt(maxStock) : null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Build update data object
   */
  _buildUpdateData({
    name, category, brand, sku, purchasePrice, sellingPrice,
    unit, minStockLevel, description, batchNo, lotNo, expiryDate,
    reorderPoint, maxStock, isActive,
  }) {
    const updateData = { updatedAt: new Date() };
    if (name !== undefined) {updateData.name = name;}
    if (category !== undefined) {updateData.category = category;}
    if (brand !== undefined) {updateData.brand = brand;}
    if (sku !== undefined) {updateData.sku = sku;}
    if (purchasePrice !== undefined) {updateData.purchasePrice = parseFloat(purchasePrice);}
    if (sellingPrice !== undefined) {updateData.sellingPrice = parseFloat(sellingPrice);}
    if (unit !== undefined) {updateData.unit = unit;}
    if (minStockLevel !== undefined) {updateData.minStockLevel = parseInt(minStockLevel);}
    if (description !== undefined) {updateData.description = description;}
    if (batchNo !== undefined) {updateData.batchNo = batchNo;}
    if (lotNo !== undefined) {updateData.lotNo = lotNo;}
    if (expiryDate !== undefined) {updateData.expiryDate = expiryDate ? new Date(expiryDate) : null;}
    if (reorderPoint !== undefined) {updateData.reorderPoint = parseInt(reorderPoint);}
    if (maxStock !== undefined) {updateData.maxStock = maxStock ? parseInt(maxStock) : null;}
    if (isActive !== undefined) {updateData.isActive = isActive;}
    return updateData;
  }

  /**
   * Create initial stock record for new product
   */
  async _createInitialStock(shopDb, productId, name, sku, minStockLevel, initialQty = 0, costPrice = 0) {
    const quantity = parseInt(initialQty) || 0;
    const isLowStock = quantity <= parseInt(minStockLevel);

    // Create record in old stock collection (for backward compatibility)
    await shopDb.collection('stock').insertOne({
      productId: productId,
      productName: name,
      currentQty: quantity,
      reservedQty: 0,
      availableQty: quantity,
      minStockLevel: parseInt(minStockLevel),
      isLowStock: isLowStock,
      lastUpdated: new Date(),
      createdAt: new Date(),
    });

    // Create initial snapshot in new event-sourced stock system
    const snapshot = {
      productId: productId,
      productName: name,
      sku: sku || null,
      onHandQty: quantity,
      reservedQty: 0,
      availableQty: quantity,
      avgCostPrice: parseFloat(costPrice) || 0,
      totalCostValue: quantity * (parseFloat(costPrice) || 0),
      reorderPoint: parseInt(minStockLevel),
      lastMovementType: quantity > 0 ? 'INITIAL_STOCK' : null,
      lastMovementDate: quantity > 0 ? new Date() : null,
      batchCount: quantity > 0 ? 1 : 0,
      oldestExpiryDate: null,
      nearestExpiryDate: null,
      version: 0,
      updatedAt: new Date(),
      createdAt: new Date(),
    };

    await shopDb.collection('stock_snapshots').insertOne(snapshot);

    // If initial quantity > 0, create a stock event for audit trail
    if (quantity > 0) {
      await shopDb.collection('stock_events').insertOne({
        productId: productId,
        productName: name,
        sku: sku || null,
        eventType: 'INITIAL_STOCK',
        eventSubtype: 'PRODUCT_CREATION',
        quantityChange: quantity,
        quantityBefore: 0,
        quantityAfter: quantity,
        costPrice: parseFloat(costPrice) || 0,
        totalValue: quantity * (parseFloat(costPrice) || 0),
        reason: 'Initial stock when product was created',
        performedBy: null, // Will be set by middleware if available
        createdAt: new Date(),
        version: 0,
      });
    }
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
      const stock = await shopDb.collection('stock').findOne({
        productId: new ObjectId(productId),
      });

      if (stock) {
        stockUpdate.isLowStock = stock.currentQty <= parseInt(minStockLevel);
      }
    }

    await shopDb
      .collection('stock')
      .updateOne({ productId: new ObjectId(productId) }, { $set: stockUpdate });
  }
}

module.exports = new ProductsController();
