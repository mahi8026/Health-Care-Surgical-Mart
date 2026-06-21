/**
 * Backfill costPrice for existing sales
 * 
 * This migration adds costPrice to all sale items that don't have it
 * by using the product's current purchasePrice as a best-effort approximation
 */

const { getSystemDatabase, getShopDatabase, connectToDatabase } = require('../config/database');
const { logger } = require('../config/logging');
const { ObjectId } = require('mongodb');

async function backfillCostPrice() {
  try {
    // Connect to database first
    await connectToDatabase();
    logger.info('Starting costPrice backfill migration...');

    // Get all shops
    const systemDb = getSystemDatabase();
    const shops = await systemDb.collection('shops').find({ status: 'Active' }).toArray();

    let totalShops = 0;
    let totalSales = 0;
    let totalUpdated = 0;
    let totalItemsUpdated = 0;

    for (const shop of shops) {
      totalShops++;
      const shopDb = getShopDatabase(shop._id.toString());
      
      logger.info(`Processing shop: ${shop.name} (${shop._id})`);

      // Find all sales with items missing costPrice
      const sales = await shopDb.collection('sales')
        .find({
          'items': { $exists: true }
        })
        .toArray();

      logger.info(`Found ${sales.length} sales in shop ${shop.name}`);
      totalSales += sales.length;

      for (const sale of sales) {
        let needsUpdate = false;
        const updatedItems = [];

        for (const item of sale.items) {
          // Skip custom items (no productId)
          if (!item.productId) {
            updatedItems.push({
              ...item,
              costPrice: item.costPrice !== undefined ? item.costPrice : 0
            });
            if (item.costPrice === undefined) {
              needsUpdate = true;
              totalItemsUpdated++;
            }
            continue;
          }

          // Check if costPrice exists
          if (item.costPrice !== undefined) {
            updatedItems.push(item);
            continue;
          }

          // Fetch product's current purchasePrice
          const product = await shopDb.collection('products').findOne({
            _id: new ObjectId(item.productId)
          });

          const costPrice = product ? parseFloat(product.purchasePrice || 0) : 0;
          
          updatedItems.push({
            ...item,
            costPrice
          });

          needsUpdate = true;
          totalItemsUpdated++;
        }

        // Update the sale if any items were missing costPrice
        if (needsUpdate) {
          await shopDb.collection('sales').updateOne(
            { _id: sale._id },
            { 
              $set: { 
                items: updatedItems,
                updatedAt: new Date()
              } 
            }
          );
          totalUpdated++;
        }
      }

      logger.info(`Shop ${shop.name}: Updated ${totalUpdated} sales`);
    }

    logger.info('===== MIGRATION COMPLETE =====');
    logger.info(`Shops processed: ${totalShops}`);
    logger.info(`Total sales checked: ${totalSales}`);
    logger.info(`Sales updated: ${totalUpdated}`);
    logger.info(`Items updated: ${totalItemsUpdated}`);
    logger.info('=============================');

    return {
      success: true,
      shopsProcessed: totalShops,
      salesChecked: totalSales,
      salesUpdated: totalUpdated,
      itemsUpdated: totalItemsUpdated
    };

  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  backfillCostPrice()
    .then(result => {
      console.log('Migration completed successfully:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { backfillCostPrice };
