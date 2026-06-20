/**
 * Migration: Remove outstandingBalance field from customers
 *
 * This migration handles the removal of the legacy outstandingBalance field.
 * For any customer where currentDue is 0 but outstandingBalance > 0,
 * it copies outstandingBalance to currentDue before removing the field.
 *
 * Run with: node src/utils/migrations/remove-outstanding-balance.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
const { MongoClient } = require('mongodb');
const { logger } = require('../../config/logging');

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || 'medical_store_system';

async function migrateOutstandingBalance() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    logger.info('Connected to MongoDB for outstandingBalance migration');

    const systemDb = client.db(DB_NAME);

    // Get all shops
    const shops = await systemDb.collection('shops').find({}).toArray();
    logger.info(`Found ${shops.length} shops to migrate`);

    let totalUpdated = 0;
    let totalRemoved = 0;

    for (const shop of shops) {
      const shopDb = client.db(`${shop.shopId}_db`);
      const customersCollection = shopDb.collection('customers');

      // Find customers where currentDue is 0 but outstandingBalance > 0
      const customersToUpdate = await customersCollection
        .find({
          currentDue: 0,
          outstandingBalance: { $gt: 0 },
        })
        .toArray();

      if (customersToUpdate.length > 0) {
        logger.info(
          `Shop ${shop.shopId}: Found ${customersToUpdate.length} customers with outstandingBalance > 0 and currentDue = 0`
        );

        // Update currentDue from outstandingBalance
        for (const customer of customersToUpdate) {
          await customersCollection.updateOne(
            { _id: customer._id },
            {
              $set: {
                currentDue: customer.outstandingBalance,
                updatedAt: new Date(),
              },
            }
          );
          logger.info(
            `  Updated customer ${customer.name}: currentDue set to ${customer.outstandingBalance}`
          );
          totalUpdated++;
        }
      }

      // Remove outstandingBalance field from all customers
      const removeResult = await customersCollection.updateMany(
        { outstandingBalance: { $exists: true } },
        { $unset: { outstandingBalance: '' } }
      );

      if (removeResult.modifiedCount > 0) {
        logger.info(
          `Shop ${shop.shopId}: Removed outstandingBalance field from ${removeResult.modifiedCount} customers`
        );
        totalRemoved += removeResult.modifiedCount;
      }
    }

    logger.info('Migration completed successfully');
    logger.info(`Total customers updated (currentDue copied): ${totalUpdated}`);
    logger.info(`Total customers with outstandingBalance removed: ${totalRemoved}`);
  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  } finally {
    await client.close();
    logger.info('Database connection closed');
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateOutstandingBalance()
    .then(() => {
      console.log('✅ Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateOutstandingBalance };
