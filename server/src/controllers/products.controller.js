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
   * CRITICAL FIX: Check for active stock before deletion
   */
  async deleteProduct(req, res) {
    try {
      // Check if product exists
      const product = await req.shopDb.collection('products').findOne({
        _id: new ObjectId(req.params.id),
      });

      if (!product) {
        return this.sendError(res, 'Product not found', 404);
      }

      // CRITICAL: Check if product has active stock (snapshot is source of truth)
      const snapshot = await req.shopDb.collection('stock_snapshots').findOne({
        productId: new ObjectId(req.params.id),
      });

      if (snapshot && snapshot.onHandQty > 0) {
        return this.sendError(
          res,
          `Cannot delete product "${product.name}". It has ${snapshot.onHandQty} units in stock. Please adjust stock to zero before deleting.`,
          409
        );
      }

      // Snapshot is 0 (or missing) — auto-clear all stale legacy data before deleting

      // Clear legacy stock collection (stale data from old system)
      await req.shopDb.collection('stock').updateMany(
        { productId: new ObjectId(req.params.id) },
        { $set: { currentQty: 0, availableQty: 0, updatedAt: new Date() } }
      );

      // Mark all batches as DEPLETED so they don't block deletion
      await req.shopDb.collection('stock_batches').updateMany(
        { productId: new ObjectId(req.params.id), status: 'ACTIVE' },
        { $set: { status: 'DEPLETED', quantity: 0, updatedAt: new Date() } }
      );

      // Soft delete the product
      const result = await req.shopDb.collection('products').updateOne(
        { _id: new ObjectId(req.params.id) },
        {
          $set: {
            isActive: false,
            deletedAt: new Date(),
            updatedAt: new Date(),
          },
        },
      );

      if (result.matchedCount === 0) {
        return this.sendError(res, 'Product not found', 404);
      }

      // Audit: product deleted (soft delete)
      auditLog.log(req, AUDIT_ACTIONS.PRODUCT_DELETED, 'product', req.params.id,
        `Deleted (deactivated) product "${product.name}" (SKU: ${product.sku})`,
        {
          before: { name: product.name, sku: product.sku, isActive: true },
          after: { isActive: false, deletedAt: new Date() }
        }
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

    // Default to showing only active products unless explicitly specified
    if (isActive !== undefined) {
      matchStage.isActive = isActive === 'true';
    } else {
      matchStage.isActive = true; // Default: only show active products
    }

    if (category) {matchStage.category = category;}
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
   * Uses stock_snapshots as the single source of truth for stock quantities.
   * Falls back to the legacy stock collection if no snapshot exists.
   */
  async _fetchProductsWithStock(shopDb, matchStage) {
    return await shopDb
      .collection('products')
      .aggregate([
        { $match: matchStage },
        // Primary: join stock_snapshots (new event-sourced system)
        {
          $lookup: {
            from: 'stock_snapshots',
            localField: '_id',
            foreignField: 'productId',
            as: 'snapshot',
          },
        },
        // Fallback: join legacy stock collection
        {
          $lookup: {
            from: 'stock',
            localField: '_id',
            foreignField: 'productId',
            as: 'legacyStock',
          },
        },
        {
          $addFields: {
            // Use snapshot.onHandQty if available, fall back to legacy stock.currentQty
            stockQuantity: {
              $cond: {
                if: { $gt: [{ $size: '$snapshot' }, 0] },
                then: { $ifNull: [{ $arrayElemAt: ['$snapshot.onHandQty', 0] }, 0] },
                else: { $ifNull: [{ $arrayElemAt: ['$legacyStock.currentQty', 0] }, 0] },
              },
            },
            isLowStock: {
              $cond: {
                if: { $gt: [{ $size: '$snapshot' }, 0] },
                then: {
                  $lte: [
                    { $ifNull: [{ $arrayElemAt: ['$snapshot.onHandQty', 0] }, 0] },
                    '$minStockLevel',
                  ],
                },
                else: {
                  $cond: {
                    if: { $gt: [{ $size: '$legacyStock' }, 0] },
                    then: {
                      $lte: [
                        { $ifNull: [{ $arrayElemAt: ['$legacyStock.currentQty', 0] }, 0] },
                        '$minStockLevel',
                      ],
                    },
                    else: true,
                  },
                },
              },
            },
            // Keep category as-is (string)
            // Frontend now loads categories from /api/categories endpoint
          },
        },
        { $project: { snapshot: 0, legacyStock: 0 } },
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

    // If initial quantity > 0, create stock batch and ledger entry
    if (quantity > 0) {
      // Create a stock batch (required for FEFO allocation)
      const batch = {
        productId: productId,
        productName: name,
        sku: sku || null,
        batchNo: `INIT-${Date.now()}`,
        lotNo: null,
        quantity: quantity,
        originalQuantity: quantity,
        costPrice: parseFloat(costPrice) || 0,
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Default 1 year from now
        receivedDate: new Date(),
        status: 'ACTIVE',
        supplierId: null,
        supplierName: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const batchResult = await shopDb.collection('stock_batches').insertOne(batch);

      // Create ledger entry via stock command service
      const stockCommand = require('../services/stock-command.service');
      try {
        await stockCommand.recordMovement({
          shopId: shopId,
          productId: productId,
          movementType: 'OPENING_STOCK',
          quantity: quantity,
          userId: null,
          referenceType: 'PRODUCT_CREATION',
          referenceId: productId,
          batchNo: batch.batchNo,
          expiryDate: batch.expiryDate,
          costPrice: parseFloat(costPrice) || 0,
          note: `Initial stock when product was created: ${name}`,
          metadata: {
            source: 'product_creation',
            batchId: batchResult.insertedId.toString()
          }
        });
      } catch (ledgerError) {
        logger.error('Failed to create ledger entry for initial stock:', ledgerError);
        // Don't fail product creation, but log it
      }

      // Create stock event for audit trail (legacy)
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
        batchId: batchResult.insertedId,
        batchNo: batch.batchNo,
        createdAt: new Date(),
        version: 0,
      });
    }
  }

  /**
   * Update stock record when product name/minStockLevel changes
   */
  async _updateStockRecord(shopDb, productId, name, minStockLevel) {
    if (!name && minStockLevel === undefined) {
      return; // Nothing to update
    }

    const legacyUpdate = { lastUpdated: new Date() };
    const snapshotUpdate = { updatedAt: new Date() };

    if (name) {
      legacyUpdate.productName = name;
      snapshotUpdate.productName = name;
    }

    if (minStockLevel !== undefined) {
      const parsedLevel = parseInt(minStockLevel);
      legacyUpdate.minStockLevel = parsedLevel;
      snapshotUpdate.reorderPoint = parsedLevel;

      // Update isLowStock on legacy collection based on current qty
      const legacyStock = await shopDb.collection('stock').findOne({
        productId: new ObjectId(productId),
      });
      if (legacyStock) {
        legacyUpdate.isLowStock = legacyStock.currentQty <= parsedLevel;
      }
    }

    // Update legacy stock collection
    await shopDb
      .collection('stock')
      .updateOne({ productId: new ObjectId(productId) }, { $set: legacyUpdate });

    // Update stock_snapshots to keep in sync
    await shopDb
      .collection('stock_snapshots')
      .updateOne({ productId: new ObjectId(productId) }, { $set: snapshotUpdate });
  }
}

module.exports = new ProductsController();
