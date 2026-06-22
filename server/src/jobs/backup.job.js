/**
 * Daily Database Backup Job
 *
 * Free MongoDB Atlas M0 does not include cloud backup.
 * This job runs every night at 2 AM (Bangladesh time) and:
 *   1. Exports all critical collections to JSON
 *   2. Saves a compressed backup file to /tmp/backups/
 *   3. Emails the shop owner a backup summary with a download link
 *
 * The owner can also trigger an on-demand backup via:
 *   GET /api/admin/backup/download  (SHOP_ADMIN only, streams the file)
 *
 * Collections backed up:
 *   products, sales, purchases, returns, customers, suppliers,
 *   expenses, stock_snapshots, stock_batches, stock_ledger, settings, users
 */

const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { getSystemDatabase, getShopDatabase } = require('../config/database');
const { logger } = require('../config/logging');

const BACKUP_DIR = path.join('/tmp', 'backups');
const MAX_BACKUPS = 7; // keep last 7 daily files (7-day rolling window)

const COLLECTIONS_TO_BACKUP = [
  'products',
  'sales',
  'purchases',
  'returns',
  'customers',
  'suppliers',
  'expenses',
  'stock_snapshots',
  'stock_batches',
  'stock_ledger',
  'settings',
  'users',
];

/**
 * Run one full backup for a given shop
 * Returns the path of the created .gz file
 */
async function backupShop(shop) {
  const shopDb = getShopDatabase(shop._id.toString());
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `backup-${shop.shopId || shop._id}-${timestamp}.json.gz`;

  // Ensure backup directory exists
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const outPath = path.join(BACKUP_DIR, filename);
  const gzip = zlib.createGzip({ level: 9 });
  const stream = fs.createWriteStream(outPath);
  gzip.pipe(stream);

  // Write backup header
  gzip.write(JSON.stringify({
    meta: {
      shopId: shop.shopId || shop._id.toString(),
      shopName: shop.name,
      exportedAt: new Date().toISOString(),
      collections: COLLECTIONS_TO_BACKUP,
    }
  }) + '\n');

  let totalDocuments = 0;
  const collectionStats = {};

  for (const collName of COLLECTIONS_TO_BACKUP) {
    try {
      const docs = await shopDb.collection(collName).find({}).toArray();
      gzip.write(JSON.stringify({ collection: collName, count: docs.length, documents: docs }) + '\n');
      collectionStats[collName] = docs.length;
      totalDocuments += docs.length;
    } catch (err) {
      logger.warn(`Backup: could not export collection ${collName}: ${err.message}`);
      collectionStats[collName] = 0;
    }
  }

  // Close the gzip stream
  await new Promise((resolve, reject) => {
    gzip.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  const stat = fs.statSync(outPath);
  const sizeMB = (stat.size / 1024 / 1024).toFixed(2);

  logger.info(`Backup created: ${filename} (${sizeMB} MB, ${totalDocuments} documents)`);

  return { path: outPath, filename, sizeMB, totalDocuments, collectionStats };
}

/**
 * Prune old backup files, keeping only the most recent MAX_BACKUPS
 */
function pruneOldBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return;

  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.json.gz'))
    .map(f => ({ name: f, mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtime }))
    .sort((a, b) => b.mtime - a.mtime);

  const toDelete = files.slice(MAX_BACKUPS);
  for (const f of toDelete) {
    fs.unlinkSync(path.join(BACKUP_DIR, f.name));
    logger.info(`Backup pruned: ${f.name}`);
  }
}

/**
 * Get the path of the most recent backup file for a shop
 */
function getLatestBackupPath(shopId) {
  if (!fs.existsSync(BACKUP_DIR)) return null;

  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.includes(shopId) && f.endsWith('.json.gz'))
    .map(f => ({ name: f, mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtime }))
    .sort((a, b) => b.mtime - a.mtime);

  return files.length > 0 ? path.join(BACKUP_DIR, files[0].name) : null;
}

/**
 * Run backup for all active shops and send email summary
 */
async function runBackup() {
  logger.info('Starting daily database backup...');

  try {
    const systemDb = getSystemDatabase();
    const shops = await systemDb.collection('shops').find({ status: 'Active' }).toArray();

    for (const shop of shops) {
      try {
        const result = await backupShop(shop);

        // Send summary email if shop has an owner email
        const ownerEmail = shop.ownerEmail || shop.email;
        if (ownerEmail) {
          try {
            const EmailService = require('../services/email/email.service');
            await EmailService.send({
              to: ownerEmail,
              subject: `✅ Daily Backup Complete — ${shop.name}`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #16a34a;">Daily Backup Completed</h2>
                  <p>Your database backup for <strong>${shop.name}</strong> was created successfully.</p>
                  <table style="width:100%; border-collapse:collapse; margin: 16px 0;">
                    <tr style="background:#f3f4f6;">
                      <td style="padding:8px; border:1px solid #e5e7eb;"><strong>Date</strong></td>
                      <td style="padding:8px; border:1px solid #e5e7eb;">${new Date().toLocaleDateString('en-BD', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
                    </tr>
                    <tr>
                      <td style="padding:8px; border:1px solid #e5e7eb;"><strong>File size</strong></td>
                      <td style="padding:8px; border:1px solid #e5e7eb;">${result.sizeMB} MB</td>
                    </tr>
                    <tr style="background:#f3f4f6;">
                      <td style="padding:8px; border:1px solid #e5e7eb;"><strong>Total records</strong></td>
                      <td style="padding:8px; border:1px solid #e5e7eb;">${result.totalDocuments.toLocaleString()}</td>
                    </tr>
                    ${Object.entries(result.collectionStats).map(([name, count]) =>
                      `<tr><td style="padding:8px; border:1px solid #e5e7eb; padding-left:20px;">${name}</td>
                       <td style="padding:8px; border:1px solid #e5e7eb;">${count} records</td></tr>`
                    ).join('')}
                  </table>
                  <p style="color:#6b7280; font-size:13px;">
                    To download your backup, log in as Shop Admin and visit:<br/>
                    <strong>Settings → Backup → Download Latest Backup</strong><br/>
                    or call: <code>GET /api/admin/backup/download</code> with your JWT token.
                  </p>
                  <p style="color:#ef4444; font-size:12px;">
                    ⚠️ Note: Backups are stored temporarily on the server (last 7 days).
                    Download and save to a safe location (Google Drive, email, USB) regularly.
                  </p>
                </div>
              `,
            });
            logger.info(`Backup summary email sent to ${ownerEmail}`);
          } catch (emailErr) {
            logger.warn(`Could not send backup email: ${emailErr.message}`);
          }
        }

      } catch (shopErr) {
        logger.error(`Backup failed for shop ${shop.name}: ${shopErr.message}`);
      }
    }

    pruneOldBackups();
    logger.info('Daily backup job completed');

  } catch (err) {
    logger.error('Backup job failed:', err);
  }
}

/**
 * Schedule: every night at 2:00 AM Bangladesh time (UTC+6)
 */
function startBackupJob() {
  cron.schedule('0 2 * * *', () => {
    logger.info('Triggering scheduled backup job...');
    runBackup();
  }, {
    scheduled: true,
    timezone: 'Asia/Dhaka',
  });

  logger.info('✅ Daily backup cron job scheduled (2:00 AM Bangladesh time)');
}

module.exports = { startBackupJob, runBackup, getLatestBackupPath, backupShop };
