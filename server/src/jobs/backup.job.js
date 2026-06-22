/**
 * Daily Database Backup Job
 *
 * Free MongoDB Atlas M0 does not include cloud backup.
 * This job runs every night at 2 AM (Bangladesh time) and:
 *   1. Exports all critical collections to a compressed JSON (.json.gz) file
 *   2. Emails the backup file as an attachment to the shop owner via SendGrid
 *      — if the file is >10 MB, sends a summary-only email instead
 *   3. Saves a copy to /tmp/backups/ so the download endpoint can serve it
 *      while the server is warm (file is lost on next Render restart/deploy)
 *
 * Collections backed up:
 *   products, sales, purchases, returns, customers, suppliers,
 *   expenses, stock_snapshots, stock_batches, stock_ledger, settings, users
 *
 * API endpoints (SHOP_ADMIN only):
 *   GET  /api/settings/backup/download  — stream latest backup file
 *   POST /api/settings/backup/trigger   — run backup immediately
 */

const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { getSystemDatabase, getShopDatabase } = require('../config/database');
const { logger } = require('../config/logging');

const BACKUP_DIR = path.join('/tmp', 'backups');
const MAX_BACKUPS = 7;           // keep last 7 daily files on disk
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB SendGrid attachment limit

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
 * Run one full backup for a given shop.
 * Writes a compressed .json.gz to disk and returns metadata.
 */
async function backupShop(shop) {
  const shopDb = getShopDatabase(shop._id.toString());
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `backup-${shop.shopId || shop._id}-${timestamp}.json.gz`;

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const outPath = path.join(BACKUP_DIR, filename);
  const gzip = zlib.createGzip({ level: 9 });
  const stream = fs.createWriteStream(outPath);
  gzip.pipe(stream);

  // Header line
  gzip.write(JSON.stringify({
    meta: {
      shopId: shop.shopId || shop._id.toString(),
      shopName: shop.name,
      exportedAt: now.toISOString(),
      collections: COLLECTIONS_TO_BACKUP,
    },
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

  // Wait for write to finish
  await new Promise((resolve, reject) => {
    gzip.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  const stat = fs.statSync(outPath);
  const sizeBytes = stat.size;
  const sizeMB = (sizeBytes / 1024 / 1024).toFixed(2);

  logger.info(`Backup created: ${filename} (${sizeMB} MB, ${totalDocuments} documents)`);

  return { path: outPath, filename, sizeBytes, sizeMB, totalDocuments, collectionStats, exportedAt: now };
}

/**
 * Email the backup to the shop owner.
 *  - If file <= 10 MB: attach the .json.gz file directly
 *  - If file > 10 MB: send summary-only email with download instructions
 */
async function emailBackup(ownerEmail, shopName, result) {
  const EmailService = require('../services/email.service');

  const dateStr = result.exportedAt.toLocaleDateString('en-GB', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  const attachmentFilename = `backup-${result.exportedAt.toISOString().slice(0, 10)}.json.gz`;
  const subject = `Daily Backup - ${shopName} - ${dateStr}`;

  // Stats table rows
  const statsRows = Object.entries(result.collectionStats)
    .map(([name, count]) =>
      `<tr><td style="padding:6px 8px; border:1px solid #e5e7eb; padding-left:24px;">${name}</td>
       <td style="padding:6px 8px; border:1px solid #e5e7eb;">${count.toLocaleString()} records</td></tr>`
    ).join('');

  if (result.sizeBytes <= MAX_ATTACHMENT_BYTES) {
    // ── Attach the file ──────────────────────────────────────────────────
    const fileContent = fs.readFileSync(result.path);
    const base64Content = fileContent.toString('base64');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #16a34a;">✅ Daily Backup — ${shopName}</h2>
        <p>Your database backup is attached to this email as <strong>${attachmentFilename}</strong>.</p>
        <p style="color:#dc2626; font-size:13px;">
          ⚠️ <strong>Action required:</strong> Save the attached file to a safe location
          (Google Drive, email folder, USB drive) — it will be deleted from the server on the next restart.
        </p>
        <table style="width:100%; border-collapse:collapse; margin: 16px 0;">
          <tr style="background:#f3f4f6;">
            <td style="padding:8px; border:1px solid #e5e7eb;"><strong>Date</strong></td>
            <td style="padding:8px; border:1px solid #e5e7eb;">${dateStr}</td>
          </tr>
          <tr>
            <td style="padding:8px; border:1px solid #e5e7eb;"><strong>File size</strong></td>
            <td style="padding:8px; border:1px solid #e5e7eb;">${result.sizeMB} MB (compressed)</td>
          </tr>
          <tr style="background:#f3f4f6;">
            <td style="padding:8px; border:1px solid #e5e7eb;"><strong>Total records</strong></td>
            <td style="padding:8px; border:1px solid #e5e7eb;">${result.totalDocuments.toLocaleString()}</td>
          </tr>
          ${statsRows}
        </table>
        <p style="color:#6b7280; font-size:12px;">
          To restore: extract the .json.gz file and import each collection back into MongoDB using mongoimport.
        </p>
      </div>`;

    const emailResult = await EmailService.send({
      to: ownerEmail,
      subject,
      html,
      attachments: [{
        content: base64Content,
        filename: attachmentFilename,
        type: 'application/gzip',
        disposition: 'attachment',
      }],
    });

    if (emailResult.success) {
      logger.info(`Backup emailed to ${ownerEmail} (with attachment, ${result.sizeMB} MB)`);
    } else {
      logger.warn(`Backup email failed for ${ownerEmail}: ${emailResult.error}`);
    }

    return emailResult;

  } else {
    // ── File too large — summary only ────────────────────────────────────
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f59e0b;">⚠️ Daily Backup — ${shopName} (File Too Large to Attach)</h2>
        <p>Your backup was created successfully but the file is <strong>${result.sizeMB} MB</strong>,
           which exceeds the 10 MB email attachment limit.</p>
        <p style="color:#dc2626;">
          <strong>Download it now while the server is warm:</strong><br/>
          <code>GET /api/settings/backup/download</code><br/>
          (requires SHOP_ADMIN JWT token — file will be deleted on next server restart)
        </p>
        <table style="width:100%; border-collapse:collapse; margin: 16px 0;">
          <tr style="background:#f3f4f6;">
            <td style="padding:8px; border:1px solid #e5e7eb;"><strong>Date</strong></td>
            <td style="padding:8px; border:1px solid #e5e7eb;">${dateStr}</td>
          </tr>
          <tr>
            <td style="padding:8px; border:1px solid #e5e7eb;"><strong>File size</strong></td>
            <td style="padding:8px; border:1px solid #e5e7eb;">${result.sizeMB} MB — too large to attach</td>
          </tr>
          <tr style="background:#f3f4f6;">
            <td style="padding:8px; border:1px solid #e5e7eb;"><strong>Total records</strong></td>
            <td style="padding:8px; border:1px solid #e5e7eb;">${result.totalDocuments.toLocaleString()}</td>
          </tr>
          ${statsRows}
        </table>
        <p style="color:#6b7280; font-size:12px;">
          Tip: You can trigger a manual backup and download at any time via the API.
          Once your data grows beyond 10 MB, switch to cloud storage for automated offsite backups.
        </p>
      </div>`;

    const emailResult = await EmailService.send({ to: ownerEmail, subject, html });

    if (emailResult.success) {
      logger.info(`Backup summary email sent to ${ownerEmail} (file too large to attach: ${result.sizeMB} MB)`);
    } else {
      logger.warn(`Backup summary email failed for ${ownerEmail}: ${emailResult.error}`);
    }

    return emailResult;
  }
}

/**
 * Prune old backup files from /tmp/backups/, keeping only the most recent MAX_BACKUPS.
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
 * Get the path of the most recent backup file for a shop (on current server instance).
 * Returns null if not found — caller should generate a fresh backup.
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
 * Run backup for all active shops:
 *   1. Write backup file to /tmp/backups/
 *   2. Email file as attachment (or summary if >10 MB)
 *   3. Prune old local files
 */
async function runBackup() {
  logger.info('Starting daily database backup...');

  try {
    const systemDb = getSystemDatabase();
    const shops = await systemDb.collection('shops').find({ status: 'Active' }).toArray();

    if (shops.length === 0) {
      logger.warn('Backup: no active shops found');
      return;
    }

    for (const shop of shops) {
      try {
        const result = await backupShop(shop);

        const ownerEmail = shop.ownerEmail || shop.email;
        if (ownerEmail) {
          await emailBackup(ownerEmail, shop.name || shop.shopName || 'Health Care Surgical Mart', result);
        } else {
          logger.warn(`Backup: no owner email for shop ${shop.shopId || shop._id} — skipping email`);
        }
      } catch (shopErr) {
        logger.error(`Backup failed for shop ${shop.name || shop._id}: ${shopErr.message}`, shopErr);
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
