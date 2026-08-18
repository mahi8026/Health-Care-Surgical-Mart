/**
 * Expiry Alert Cron Job
 *
 * Runs daily at 8 AM to check for batches expiring soon
 * and sends email alerts to shop owners
 *
 * Phase 3: FEFO Batch Tracking
 */

const cron = require('node-cron');
const { ObjectId: _ObjectId } = require('mongodb');
const { getShopDatabase, getSystemDatabase } = require('../config/database');
const EmailService = require('../services/email/email.service');
const { logger } = require('../config/logging');

/**
 * Check for expiring batches and send alerts
 */
async function checkExpiryAlerts() {
  try {
    logger.info('Starting expiry alert job...');

    // Single-tenant: the shops registry lives in the system database
    // (Health_Care_Shop_DB). Previously this job called getSharedDatabase(),
    // which does not exist — the job crashed on every run.
    const systemDb = getSystemDatabase();
    const shops = await systemDb.collection('shops').find({
      status: 'Active'
    }).toArray();

    let totalAlertsProcessed = 0;

    for (const shop of shops) {
      try {
        // Single-tenant: getShopDatabase() resolves to the pinned
        // SHOP_DB_NAME regardless of the shopId argument
        const shopDb = getShopDatabase(shop.shopId);

        // Get batches expiring within next 30 days
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() + 30);

        const batches = await shopDb.collection('stock_batches')
          .aggregate([
            {
              $match: {
                shopId: shop.shopId,
                status: 'ACTIVE',
                quantity: { $gt: 0 },
                // $lte would also match null expiry dates (null sorts before
                // dates) — exclude them explicitly
                expiryDate: { $ne: null, $lte: thresholdDate }
              }
            },
            {
              $lookup: {
                from: 'products',
                localField: 'productId',
                foreignField: '_id',
                as: 'product'
              }
            },
            {
              $unwind: {
                path: '$product',
                preserveNullAndEmptyArrays: true
              }
            },
            {
              $addFields: {
                daysLeft: {
                  $ceil: {
                    $divide: [
                      { $subtract: ['$expiryDate', new Date()] },
                      1000 * 60 * 60 * 24
                    ]
                  }
                }
              }
            },
            {
              $sort: { expiryDate: 1 }
            }
          ])
          .toArray();

        if (batches.length === 0) {
          logger.info(`No expiring batches found for shop: ${shop.name} (${shop.shopId})`);
          continue;
        }

        // Categorize batches by urgency
        const expired = batches.filter(b => b.daysLeft <= 0);
        const critical = batches.filter(b => b.daysLeft > 0 && b.daysLeft <= 7);
        const warning = batches.filter(b => b.daysLeft > 7 && b.daysLeft <= 30);

        logger.info(`Expiry alert for shop ${shop.name} (${shop.shopId}):`, {
          expired: expired.length,
          critical: critical.length,
          warning: warning.length
        });

        // Send email alert
        if (shop.ownerEmail || shop.email) {
          const emailTo = shop.ownerEmail || shop.email;

          await EmailService.sendTransactionalEmail(
            emailTo,
            'expiry_alert',
            {
              shopName: shop.name,
              totalItems: batches.length,
              expired: expired.map(formatBatchForEmail),
              critical: critical.map(formatBatchForEmail),
              warning: warning.map(formatBatchForEmail),
              reportDate: new Date().toLocaleDateString('en-BD', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })
            }
          );

          totalAlertsProcessed++;
          logger.info(`Expiry alert email sent to ${emailTo} for shop ${shop.name}`);
        } else {
          logger.warn(`No email address found for shop: ${shop.name} (${shop.shopId})`);
        }

      } catch (shopError) {
        logger.error(`Error processing expiry alerts for shop ${shop.shopId}:`, shopError);
        // Continue with next shop
      }
    }

    logger.info(`Expiry alert job completed. Alerts sent: ${totalAlertsProcessed}`);

  } catch (error) {
    logger.error('Expiry alert job failed:', error);
  }
}

/**
 * Format batch data for email
 */
function formatBatchForEmail(batch) {
  return {
    product: batch.product?.name || 'Unknown Product',
    sku: batch.product?.sku || 'N/A',
    batchNo: batch.batchNo,
    qty: batch.quantity,
    unit: batch.product?.unit || 'unit',
    expiryDate: new Date(batch.expiryDate).toLocaleDateString('en-BD', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }),
    daysLeft: batch.daysLeft
  };
}

/**
 * Schedule cron job
 * Runs every day at 8:00 AM Bangladesh time (UTC+6)
 *
 * Cron format: second minute hour day month weekday
 * '0 8 * * *' = At 8:00 AM every day
 */
function startExpiryAlertJob() {
  // Schedule for 8 AM daily
  cron.schedule('0 8 * * *', () => {
    logger.info('Triggering scheduled expiry alert job...');
    checkExpiryAlerts();
  }, {
    scheduled: true,
    timezone: 'Asia/Dhaka'
  });

  logger.info('✅ Expiry alert cron job scheduled (daily at 8:00 AM Bangladesh time)');
}

/**
 * Run manual check (for testing)
 */
async function runManualCheck() {
  logger.info('Running manual expiry alert check...');
  await checkExpiryAlerts();
}

// Start cron job when module is loaded
startExpiryAlertJob();

module.exports = {
  checkExpiryAlerts,
  runManualCheck,
  startExpiryAlertJob
};
