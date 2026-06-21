/**
 * Repair Missing Ledger Entries
 * 
 * Creates corrective OPENING_STOCK ledger entries for products where:
 * - Batch total > (ledger IN total - ledger OUT total)
 * - This indicates stock was added without ledger entries
 */

// Load environment variables FIRST
require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });

const { getSystemDatabase, getShopDatabase, connectToDatabase } = require('../config/database');
const { logger } = require('../config/logging');
const { ObjectId } = require('mongodb');

async function repairLedgerEntries() {
  try {
    await connectToDatabase();
    logger.info('Starting ledger repair migration...');

    const systemDb = getSystemDatabase();
    const shops = await systemDb.collection('shops').find({ status: 'Active' }).toArray();

    let totalShops = 0;
    let totalProducts = 0;
    let totalEntriesCreated = 0;

    for (const shop of shops) {
      totalShops++;
      const shopDb = getShopDatabase(shop._id.toString());
      
      logger.info(`Processing shop: ${shop.name} (${shop._id})`);

      // Get all products
      const products = await shopDb.collection('products').find({ isActive: true }).toArray();
      
      for (const product of products) {
        totalProducts++;

        // Calculate batch total
        const batches = await shopDb.collection('stock_batches')
          .find({
            productId: product._id,
            status: 'ACTIVE'
          })
          .toArray();
        
        const batchTotal = batches.reduce((sum, b) => sum + (b.quantity || 0), 0);

        // Calculate ledger balance
        const ledgerEntries = await shopDb.collection('stock_ledger')
          .find({ productId: product._id })
          .sort({ version: 1 })
          .toArray();

        let ledgerBalance = 0;
        for (const entry of ledgerEntries) {
          if (entry.direction === 'IN') {
            ledgerBalance += entry.quantity;
          } else if (entry.direction === 'OUT') {
            ledgerBalance -= entry.quantity;
          } else if (entry.direction === 'SET') {
            ledgerBalance = entry.quantity;
          }
        }

        const missing = batchTotal - ledgerBalance;

        if (missing > 0) {
          logger.info(`  → ${product.name}: Missing ${missing} units (Batches: ${batchTotal}, Ledger: ${ledgerBalance})`);

          // Get current snapshot
          const snapshot = await shopDb.collection('stock_snapshots').findOne({
            productId: product._id
          });

          const currentVersion = snapshot ? snapshot.lastLedgerVersion || 0 : 0;

          // Create corrective ledger entry
          const correctionEntry = {
            productId: product._id,
            movementType: 'OPENING_STOCK',
            direction: 'IN',
            quantity: missing,
            runningBalance: batchTotal,
            version: currentVersion + 1,
            referenceType: 'CORRECTION',
            referenceId: null,
            batchNo: null,
            lotNo: null,
            expiryDate: null,
            costPrice: product.purchasePrice || 0,
            userId: null,
            timestamp: new Date(),
            note: `Corrective entry - opening stock not recorded in ledger. Batch total: ${batchTotal}, Previous ledger balance: ${ledgerBalance}`,
            metadata: {
              correction: true,
              batchTotal,
              previousLedgerBalance: ledgerBalance,
              difference: missing
            }
          };

          await shopDb.collection('stock_ledger').insertOne(correctionEntry);

          // Update snapshot
          if (snapshot) {
            await shopDb.collection('stock_snapshots').updateOne(
              { _id: snapshot._id },
              {
                $set: {
                  onHandQty: batchTotal,
                  availableQty: batchTotal - (snapshot.reservedQty || 0),
                  lastLedgerEntryId: correctionEntry._id,
                  lastLedgerVersion: correctionEntry.version,
                  lastMovementAt: new Date(),
                  lastMovementType: 'OPENING_STOCK',
                  updatedAt: new Date()
                }
              }
            );
          }

          totalEntriesCreated++;
        }
      }

      logger.info(`Shop ${shop.name}: Created ${totalEntriesCreated} correction entries`);
    }

    logger.info('===== REPAIR COMPLETE =====');
    logger.info(`Shops processed: ${totalShops}`);
    logger.info(`Products checked: ${totalProducts}`);
    logger.info(`Ledger entries created: ${totalEntriesCreated}`);
    logger.info('============================');

    return {
      success: true,
      shopsProcessed: totalShops,
      productsChecked: totalProducts,
      entriesCreated: totalEntriesCreated
    };

  } catch (error) {
    logger.error('Repair failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  repairLedgerEntries()
    .then(result => {
      console.log('Repair completed successfully:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('Repair failed:', error);
      process.exit(1);
    });
}

module.exports = { repairLedgerEntries };
