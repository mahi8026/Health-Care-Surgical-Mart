/**
 * Setup Admin in MongoDB Atlas
 * Creates shop and admin user in the cloud database
 */

const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: './server/.env' });

async function setupAtlasAdmin() {
  console.log('\n==============================================');
  console.log('  Setup Admin in MongoDB Atlas');
  console.log('==============================================\n');

  const mongoUri = process.env.MONGODB_URI;
  const dbName = process.env.DB_NAME || 'hc_pos';
  
  // Your details
  const shopName = 'Health Care Surgical Mart';
  const shopId = 'hc_mart_01'; // Short ID to keep database name under 38 bytes
  const adminName = 'Mahi M Rahman';
  const adminEmail = 'healthcaresurgicalmart@gmail.com';
  const adminPassword = 'YourPassword123'; // You'll change this

  console.log(`Database: ${dbName}`);
  console.log(`Shop ID: ${shopId}`);
  console.log(`Shop DB will be: ${dbName}_${shopId} (${(dbName + '_' + shopId).length} bytes)`);
  
  if ((dbName + '_' + shopId).length > 38) {
    console.error('\n❌ ERROR: Database name too long!');
    console.error(`Max: 38 bytes, Current: ${(dbName + '_' + shopId).length} bytes`);
    process.exit(1);
  }

  try {
    const client = new MongoClient(mongoUri);
    await client.connect();
    console.log('\n✓ Connected to MongoDB Atlas');

    const db = client.db(dbName);
    const shopDbName = `${dbName}_${shopId}`;
    const shopDb = client.db(shopDbName);

    // Create shop
    console.log('\n--- Creating Shop ---');
    const existingShop = await db.collection('shops').findOne({ shopId });
    if (existingShop) {
      console.log('⚠️  Shop already exists, updating...');
      await db.collection('shops').updateOne(
        { shopId },
        {
          $set: {
            name: shopName,
            status: 'Active',
            updatedAt: new Date()
          }
        }
      );
    } else {
      await db.collection('shops').insertOne({
        shopId,
        name: shopName,
        status: 'Active',
        plan: 'premium',
        createdAt: new Date(),
        updatedAt: new Date(),
        settings: {
          currency: 'USD',
          timezone: 'UTC',
          language: 'en'
        }
      });
    }
    console.log(`✓ Shop "${shopName}" ready`);

    // Create admin user
    console.log('\n--- Creating Admin User ---');
    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    const existingUser = await shopDb.collection('users').findOne({ 
      email: adminEmail.toLowerCase() 
    });

    if (existingUser) {
      console.log('⚠️  User already exists, updating...');
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
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    console.log('✓ Admin user ready');

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
    console.log(`  Email: ${adminEmail}`);
    console.log(`  Password: ${adminPassword}`);
    console.log(`  Shop ID: ${shopId} (auto-detected)`);
    console.log(`  Database: ${shopDbName}`);
    console.log('\n⚠️  IMPORTANT: Change the password in Firebase Console!');
    console.log('   The password above is just for MongoDB.');
    console.log('   Use your Firebase password to login.');
    console.log('==============================================\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

setupAtlasAdmin();
