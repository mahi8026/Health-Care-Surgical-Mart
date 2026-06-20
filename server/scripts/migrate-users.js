/**
 * Migrate Users from Old Schema to New Schema
 */

const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function migrateUsers() {
  const mongoUri = process.env.MONGODB_URI;
  const dbName = process.env.DB_NAME || 'Health_Care_Shop_DB';
  
  if (!mongoUri) {
    console.error('❌ MONGODB_URI not found in environment variables');
    process.exit(1);
  }
  
  const client = new MongoClient(mongoUri);
  
  try {
    console.log('🔄 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const systemDb = client.db(dbName);
    
    // Get the shop
    const shops = await systemDb.collection('shops').find({}).toArray();
    if (shops.length === 0) {
      console.error('❌ No shops found');
      process.exit(1);
    }
    
    const shop = shops[0];
    const shopIdNew = shop._id.toString();
    const shopIdOld = shop.shopId;
    
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Shop: ${shop.name || 'Unnamed'}`);
    console.log(`Old shopId: ${shopIdOld}`);
    console.log(`New shopId: ${shopIdNew}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    const shopDb = client.db(`shop_${shopIdNew}`);
    
    // ============================================
    // MIGRATE USERS
    // ============================================
    console.log('👥 Migrating Users...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const oldUsers = await systemDb
      .collection(`${shopIdOld}_users`)
      .find({})
      .toArray();
    
    console.log(`  Found ${oldUsers.length} users in old schema`);
    
    let usersCreated = 0;
    let usersSkipped = 0;
    
    for (const oldUser of oldUsers) {
      try {
        // Check if user already exists
        const existingUser = await shopDb
          .collection('users')
          .findOne({ _id: oldUser._id });
        
        if (existingUser) {
          console.log(`  ⏭️  User already exists: ${oldUser.email}`);
          usersSkipped++;
          continue;
        }
        
        // Update shopId to new format
        const newUser = {
          ...oldUser,
          shopId: shopIdNew, // Update to new shopId format
          migratedFrom: shopIdOld,
          migratedAt: new Date()
        };
        
        await shopDb.collection('users').insertOne(newUser);
        console.log(`  ✅ Migrated: ${oldUser.email} (${oldUser.role})`);
        usersCreated++;
        
      } catch (err) {
        console.error(`  ❌ Error migrating user ${oldUser.email}:`, err.message);
      }
    }
    
    console.log(`\n  📊 Users Migration Result:`);
    console.log(`     ✅ Created: ${usersCreated}`);
    console.log(`     ⏭️  Skipped: ${usersSkipped}\n`);
    
    // ============================================
    // VERIFICATION
    // ============================================
    console.log('✅ Verification...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const finalUserCount = await shopDb.collection('users').countDocuments();
    console.log(`  👥 Users in new schema: ${finalUserCount}`);
    
    const adminUser = await shopDb.collection('users').findOne({ role: 'SHOP_ADMIN' });
    if (adminUser) {
      console.log(`\n  📋 Sample Admin User:`);
      console.log(`     Email: ${adminUser.email}`);
      console.log(`     Role: ${adminUser.role}`);
      console.log(`     ShopId: ${adminUser.shopId}`);
      console.log(`     Active: ${adminUser.isActive}`);
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✨ MIGRATION COMPLETE!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📊 Summary:');
    console.log(`   👥 Users migrated: ${usersCreated}`);
    console.log('\n✅ You can now login with your credentials!\n');
    
  } catch (error) {
    console.error('\n❌ Fatal Error:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('👋 MongoDB connection closed');
  }
}

// Run the script
console.log('');
console.log('╔═══════════════════════════════════════════════╗');
console.log('║  Users Migration Script                       ║');
console.log('║  Old Schema → New Schema                      ║');
console.log('╚═══════════════════════════════════════════════╝');
console.log('');

migrateUsers()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Script failed:', err);
    process.exit(1);
  });
