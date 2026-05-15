/**
 * Setup Admin Account Script
 * Run this script to create your first admin account for your shop
 * 
 * Usage: node setup-admin.js
 */

const readline = require('readline');
const bcrypt = require('bcryptjs');
const { MongoClient } = require('mongodb');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function setupAdmin() {
  console.log('\n==============================================');
  console.log('  Health Care Surgical Mart - Admin Setup');
  console.log('==============================================\n');

  try {
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

    console.log('\n--- Connecting to MongoDB ---');
    const client = new MongoClient(mongoUri);
    await client.connect();
    console.log('✓ Connected to MongoDB');

    const db = client.db(dbName);

    // Create shop database
    const shopDbName = `${dbName}_${shopId}`;
    const shopDb = client.db(shopDbName);

    // Check if shop already exists
    const existingShop = await db.collection('shops').findOne({ shopId });
    if (existingShop) {
      console.log('\n⚠️  Shop already exists!');
      const overwrite = await question('Do you want to create a new admin for this shop? (yes/no): ');
      if (overwrite.toLowerCase() !== 'yes') {
        console.log('Setup cancelled.');
        await client.close();
        process.exit(0);
      }
    } else {
      // Create shop in main database
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

    // Check if admin email already exists
    const existingUser = await shopDb.collection('users').findOne({ 
      email: adminEmail.toLowerCase() 
    });

    if (existingUser) {
      console.log('\n⚠️  User with this email already exists!');
      const update = await question('Do you want to update this user to SHOP_ADMIN? (yes/no): ');
      if (update.toLowerCase() === 'yes') {
        const hashedPassword = await bcrypt.hash(adminPassword, 12);
        await shopDb.collection('users').updateOne(
          { email: adminEmail.toLowerCase() },
          {
            $set: {
              name: adminName,
              password: hashedPassword,
              role: 'SHOP_ADMIN',
              isActive: true,
              updatedAt: new Date()
            }
          }
        );
        console.log('✓ User updated to SHOP_ADMIN');
      } else {
        console.log('Setup cancelled.');
        await client.close();
        process.exit(0);
      }
    } else {
      // Create admin user
      console.log('\n--- Creating Admin User ---');
      const hashedPassword = await bcrypt.hash(adminPassword, 12);

      await shopDb.collection('users').insertOne({
        name: adminName,
        email: adminEmail.toLowerCase(),
        password: hashedPassword,
        role: 'SHOP_ADMIN',
        shopId,
        isActive: true,
        permissions: [],
        lastLogin: null,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log('✓ Admin user created');
    }

    // Create indexes
    console.log('\n--- Creating Indexes ---');
    await shopDb.collection('users').createIndex({ email: 1 }, { unique: true });
    await shopDb.collection('products').createIndex({ barcode: 1 });
    await shopDb.collection('products').createIndex({ name: 'text' });
    await shopDb.collection('sales').createIndex({ createdAt: -1 });
    await shopDb.collection('customers').createIndex({ phone: 1 });
    console.log('✓ Indexes created');

    await client.close();

    console.log('\n==============================================');
    console.log('  ✅ Setup Complete!');
    console.log('==============================================\n');
    console.log('Your login credentials:');
    console.log(`  Shop ID: ${shopId}`);
    console.log(`  Email: ${adminEmail}`);
    console.log(`  Password: ${adminPassword}`);
    console.log(`  Role: SHOP_ADMIN`);
    console.log('\nYou can now login to your shop management system!');
    console.log('==============================================\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run setup
setupAdmin();
