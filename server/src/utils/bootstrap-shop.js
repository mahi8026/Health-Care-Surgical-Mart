/**
 * Bootstrap Script — One-Time Shop & Admin Setup
 *
 * Run this ONCE when your database is empty to create the initial shop
 * and SHOP_ADMIN user so you can log in via Firebase.
 *
 * Usage:
 *   node src/utils/bootstrap-shop.js
 *
 * Edit the CONFIG section below before running.
 */

require('dotenv').config();

// ─── CONFIG — edit these before running ────────────────────────────────────
const CONFIG = {
  // The email address you use to log in via Firebase
  ownerEmail: 'mahimul8026@gmail.com',

  // Shop details
  shopName:    'Health Care Surgical Mart',
  ownerName:   'Mahimul',
  ownerPhone:  '',
  address:     '',

  // The SHOP_ADMIN account that will be created in the shop DB.
  // Use the SAME email as ownerEmail so Firebase login auto-detects it.
  adminName:     'Mahimul',
  adminEmail:    'mahimul8026@gmail.com',
  // Password is only used for the legacy /api/auth/login endpoint.
  // Firebase login ignores this field.
  adminPassword: 'Admin@12345',
};
// ───────────────────────────────────────────────────────────────────────────

const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const { initializeShopDatabase } = require('./database-initializer');

// Monkey-patch the database module so initializeShopDatabase can call
// getShopDatabase without a running server
const MONGO_URI = process.env.MONGODB_URI;
const DB_NAME   = process.env.DB_NAME || 'Health_Care_Shop_DB';

async function run() {
  console.log('🚀 Bootstrap script starting…');
  console.log(`   MongoDB URI : ${MONGO_URI?.split('@')[1] ?? MONGO_URI}`);
  console.log(`   System DB   : ${DB_NAME}`);

  const mongoClient = new MongoClient(MONGO_URI);
  await mongoClient.connect();
  console.log('✅ Connected to MongoDB');

  const systemDb = mongoClient.db(DB_NAME);

  // ── 1. Check if shop already exists ────────────────────────────────────
  const existing = await systemDb
    .collection('shops')
    .findOne({ ownerEmail: CONFIG.ownerEmail });

  if (existing) {
    console.log(`ℹ️  Shop already exists for ${CONFIG.ownerEmail} (shopId: ${existing.shopId})`);
    // Still ensure the user exists — might have been missed by a failed first run
    const shopDbName = `shop_${existing.shopId}`;
    const shopDbRaw  = mongoClient.db(shopDbName);
    const existingUser = await shopDbRaw.collection('users').findOne({ email: CONFIG.adminEmail });
    if (existingUser) {
      console.log(`✅ Admin user already exists: ${CONFIG.adminEmail}`);
      console.log('\nBootstrap already complete — nothing to do.');
    } else {
      console.log('⚠️  Shop exists but admin user is missing — creating user now…');
      const passwordHash = await bcrypt.hash(CONFIG.adminPassword, 10);
      const bootstrapId  = new ObjectId();
      await shopDbRaw.collection('users').insertOne({
        name:         CONFIG.adminName,
        email:        CONFIG.adminEmail,
        passwordHash,
        role:         'SHOP_ADMIN',
        phone:        CONFIG.ownerPhone || '',
        shopId:       existing.shopId,
        isActive:     true,
        permissions:  [],
        lastLogin:    new Date(0),
        createdBy:    bootstrapId,
        createdAt:    new Date(),
        updatedAt:    new Date(),
      });
      console.log(`✅ SHOP_ADMIN user created: ${CONFIG.adminEmail}`);
      console.log('\n🎉 Bootstrap complete!');
      console.log('─'.repeat(50));
      console.log(`   Shop ID  : ${existing.shopId}`);
      console.log(`   Email    : ${CONFIG.adminEmail}`);
      console.log('─'.repeat(50));
      console.log('You can now log in via Firebase at http://localhost:5173');
    }
    await mongoClient.close();
    return;
  }

  // ── 2. Generate shopId OR reuse existing one ──────────────────────────
  let shopId;
  const partialShop = await systemDb
    .collection('shops')
    .findOne({ ownerEmail: CONFIG.ownerEmail });

  if (partialShop) {
    // Shop record already inserted (e.g. from a failed previous run) — reuse it
    shopId = partialShop.shopId;
    console.log(`ℹ️  Existing (partial) shop found — reusing shopId: ${shopId}`);
  } else {
    const cleanName = CONFIG.shopName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .substring(0, 20);
    shopId = `${cleanName}_${Date.now().toString(36)}`;
    console.log(`   Generated shopId: ${shopId}`);
  }

  // ── 3. Create placeholder super-admin ObjectId ─────────────────────────
  const bootstrapId = new ObjectId();

  // ── 4. Insert shop into system DB (upsert — safe if already exists) ────
  const shopRecord = {
    shopId,
    shopName:        CONFIG.shopName,
    ownerName:       CONFIG.ownerName,
    ownerEmail:      CONFIG.ownerEmail,
    ownerPhone:      CONFIG.ownerPhone,
    address:         CONFIG.address,
    status:          'Active',
    subscriptionPlan: 'Professional',
    subscriptionExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    maxUsers:        10,
    currentUsers:    1,
    createdBy:       bootstrapId,
    createdAt:       new Date(),
    updatedAt:       new Date(),
  };

  await systemDb.collection('shops').updateOne(
    { ownerEmail: CONFIG.ownerEmail },
    { $setOnInsert: shopRecord },
    { upsert: true }
  );
  console.log('✅ Shop record ensured in system DB');

  // ── 5. Initialise the shop DB (collections + indexes) ─────────────────
  // We need to provide a db-like proxy that the initializer expects
  const shopDbName = `shop_${shopId}`;
  const shopDbRaw  = mongoClient.db(shopDbName);

  // Proxy wrapping to add getCollectionName helper used by some parts
  const shopDbProxy = new Proxy(shopDbRaw, {
    get(target, prop) {
      if (prop === 'getCollectionName') {return (name) => `${shopDbName}.${name}`;}
      return typeof target[prop] === 'function'
        ? target[prop].bind(target)
        : target[prop];
    },
  });

  const initResult = await initializeShopDatabase(shopDbProxy);
  const errors = initResult.errors ?? [];
  if (errors.length) {
    console.warn('⚠️  Some init warnings:', errors);
  } else {
    console.log('✅ Shop database initialised (collections + indexes)');
  }

  // ── 6. Insert SHOP_ADMIN user into the shop DB ──────────────────────────
  const passwordHash = await bcrypt.hash(CONFIG.adminPassword, 10);
  const adminUser = {
    name:         CONFIG.adminName,
    email:        CONFIG.adminEmail,
    passwordHash,
    role:         'SHOP_ADMIN',
    phone:        CONFIG.ownerPhone || '',
    shopId,
    isActive:     true,
    permissions:  [],
    lastLogin:    new Date(0), // schema requires date type, not null
    createdBy:    bootstrapId,
    createdAt:    new Date(),
    updatedAt:    new Date(),
  };

  // Upsert — safe to re-run if user already exists
  await shopDbRaw.collection('users').updateOne(
    { email: CONFIG.adminEmail },
    { $setOnInsert: adminUser },
    { upsert: true }
  );
  console.log(`✅ SHOP_ADMIN user created: ${CONFIG.adminEmail}`);

  // ── Done ───────────────────────────────────────────────────────────────
  console.log('\n🎉 Bootstrap complete!');
  console.log('─'.repeat(50));
  console.log(`   Shop ID  : ${shopId}`);
  console.log(`   Email    : ${CONFIG.adminEmail}`);
  console.log(`   Role     : SHOP_ADMIN`);
  console.log(`   Password : ${CONFIG.adminPassword}  (legacy login only)`);
  console.log('─'.repeat(50));
  console.log('You can now log in via Firebase at http://localhost:5173');

  await mongoClient.close();
}

run().catch((err) => {
  console.error('❌ Bootstrap failed:', err.message);
  process.exit(1);
});
