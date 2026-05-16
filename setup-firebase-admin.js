/**
 * Setup Firebase + MongoDB Admin Account
 * This script creates a complete admin account in both Firebase and MongoDB
 * 
 * Usage: node setup-firebase-admin.js
 */

const readline = require('readline');
const bcrypt = require('bcryptjs');
const { MongoClient } = require('mongodb');
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function setupFirebaseAdmin() {
  console.log('\n==============================================');
  console.log('  Health Care Surgical Mart - Complete Setup');
  console.log('  (Firebase + MongoDB)');
  console.log('==============================================\n');

  try {
    // Check for Firebase service account
    const serviceAccountPath = path.join(__dirname, 'server', 'serviceAccountKey.json');
    if (!fs.existsSync(serviceAccountPath)) {
      console.error('❌ Firebase service account key not found!');
      console.log('\nPlease follow these steps:');
      console.log('1. Go to Firebase Console: https://console.firebase.google.com/');
      console.log('2. Select your project');
      console.log('3. Go to Project Settings → Service Accounts');
      console.log('4. Click "Generate New Private Key"');
      console.log('5. Save the file as "serviceAccountKey.json" in the server folder');
      console.log('\nThen run this script again.');
      process.exit(1);
    }

    // Initialize Firebase Admin
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    console.log('✓ Firebase Admin initialized\n');

    // Get MongoDB connection details
    const mongoUri = await question('MongoDB URI (default: mongodb://localhost:27017): ') || 'mongodb://localhost:27017';
    const dbName = await question('Database name (default: health_care_pos): ') || 'health_care_pos';
    
    console.log('\n--- Shop Information ---');
    const shopName = await question('Shop Name (e.g., "Health Care Plus"): ');
    if (!shopName.trim()) {
      console.error('❌ Shop name is required!');
      process.exit(1);
    }

    const shopId = shopName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    console.log(`✓ Shop ID will be: ${shopId}`);

    console.log('\n--- Admin Account ---');
    const adminName = await question('Admin Full Name: ');
    const adminEmail = await question('Admin Email: ');
    const adminPassword = await question('Admin Password (min 6 characters): ');

    if (!adminName.trim() || !adminEmail.trim() || !adminPassword.trim()) {
      console.error('❌ All fields are required!');
      process.exit(1);
    }

    if (adminPassword.length < 6) {
      console.error('❌ Password must be at least 6 characters!');
      process.exit(1);
    }

    // Create Firebase user
    console.log('\n--- Creating Firebase User ---');
    let firebaseUser;
    try {
      firebaseUser = await admin.auth().createUser({
        email: adminEmail,
        password: adminPassword,
        displayName: adminName,
        emailVerified: true // Auto-verify for admin
      });
      console.log(`✓ Firebase user created: ${firebaseUser.uid}`);
    } catch (error) {
      if (error.code === 'auth/email-already-exists') {
        console.log('⚠️  Firebase user already exists');
        const update = await question('Do you want to update this user? (yes/no): ');
        if (update.toLowerCase() === 'yes') {
          const existingUser = await admin.auth().getUserByEmail(adminEmail);
          await admin.auth().updateUser(existingUser.uid, {
            password: adminPassword,
            displayName: adminName,
            emailVerified: true
          });
          firebaseUser = existingUser;
          console.log('✓ Firebase user updated');
        } else {
          console.log('Setup cancelled.');
          process.exit(0);
        }
      } else {
        throw error;
      }
    }

    // Connect to MongoDB
    console.log('\n--- Connecting to MongoDB ---');
    const client = new MongoClient(mongoUri);
    await client.connect();
    console.log('✓ Connected to MongoDB');

    const db = client.db(dbName);
    const shopDbName = `${dbName}_${shopId}`;
    const shopDb = client.db(shopDbName);

    // Create/update shop
    const existingShop = await db.collection('shops').findOne({ shopId });
    if (existingShop) {
      console.log('\n⚠️  Shop already exists');
    } else {
      console.log('\n--- Creating Shop ---');
      await db.collection('shops').insertOne({
        shopId,
        name: shopName,
        status: 'active',
        plan: 'premium',
        createdAt: new Date(),
        updatedAt: new Date(),
        settings: {
          currency: 'USD',
          timezone: 'UTC',
          language: 'en'
        }
      });
      console.log(`✓ Shop "${shopName}" created`);
    }

    // Create/update MongoDB user
    console.log('\n--- Creating MongoDB User ---');
    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    const existingUser = await shopDb.collection('users').findOne({ 
      email: adminEmail.toLowerCase() 
    });

    if (existingUser) {
      await shopDb.collection('users').updateOne(
        { email: adminEmail.toLowerCase() },
        {
          $set: {
            name: adminName,
            password: hashedPassword,
            role: 'SHOP_ADMIN',
            isActive: true,
            firebaseUid: firebaseUser.uid,
            updatedAt: new Date()
          }
        }
      );
      console.log('✓ MongoDB user updated');
    } else {
      await shopDb.collection('users').insertOne({
        name: adminName,
        email: adminEmail.toLowerCase(),
        password: hashedPassword,
        role: 'SHOP_ADMIN',
        shopId,
        isActive: true,
        permissions: [],
        lastLogin: null,
        firebaseUid: firebaseUser.uid,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log('✓ MongoDB user created');
    }

    // Create indexes
    console.log('\n--- Creating Indexes ---');
    await shopDb.collection('users').createIndex({ email: 1 }, { unique: true });
    await shopDb.collection('users').createIndex({ firebaseUid: 1 });
    await shopDb.collection('products').createIndex({ barcode: 1 });
    await shopDb.collection('products').createIndex({ name: 'text' });
    await shopDb.collection('sales').createIndex({ createdAt: -1 });
    await shopDb.collection('customers').createIndex({ phone: 1 });
    console.log('✓ Indexes created');

    await client.close();

    console.log('\n==============================================');
    console.log('  ✅ Complete Setup Successful!');
    console.log('==============================================\n');
    console.log('Your login credentials:');
    console.log(`  Shop ID: ${shopId} (auto-detected)`);
    console.log(`  Email: ${adminEmail}`);
    console.log(`  Password: ${adminPassword}`);
    console.log(`  Role: SHOP_ADMIN`);
    console.log(`  Firebase UID: ${firebaseUser.uid}`);
    console.log('\n✅ Both Firebase and MongoDB accounts created!');
    console.log('✅ You can now login to your shop management system!');
    console.log('==============================================\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack && process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    rl.close();
    process.exit(0);
  }
}

// Run setup
setupFirebaseAdmin();
