/**
 * Migrate Old Schema to New Schema
 * 
 * Migrates products, customers, sales, and stock from old schema (system DB with prefix)
 * to new schema (shop-specific databases with event-sourced stock system).
 * 
 * OLD SCHEMA: shop_health_care_01_products in system DB
 * NEW SCHEMA: products in shop_6a020466789ca874348b2557 DB
 */

const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function migrateToNewSchema() {
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
    console.log('✅ Connected to MongoDB');
    console.log(`📊 System Database: ${dbName}\n`);
    
    const systemDb = client.db(dbName);
    
    // Get the shop
    const shops = await systemDb.collection('shops').find({}).toArray();
    
    if (shops.length === 0) {
      console.error('❌ No shops found in database');
      process.exit(1);
    }
    
    const shop = shops[0]; // Assuming single shop
    const shopId = shop._id.toString();
    const shopPrefix = 'shop_health_care_01_';
    
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Shop: ${shop.shopName || 'Unnamed'} (${shopId})`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    const shopDb = client.db(`shop_${shopId}`);
    
    // ============================================
    // 1. MIGRATE PRODUCTS
    // ============================================
    console.log('📦 Migrating Products...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const oldProducts = await systemDb
      .collection(`${shopPrefix}products`)
      .find({})
      .toArray();
    
    console.log(`  Found ${oldProducts.length} products in old schema`);
    
    let productsCreated = 0;
    let productsSkipped = 0;
    
    for (const oldProduct of oldProducts) {
      try {
        // Check if product already exists in new schema
        const existingProduct = await shopDb
          .collection('products')
          .findOne({ _id: oldProduct._id });
        
        if (existingProduct) {
          console.log(`  ⏭️  Product already exists: ${oldProduct.name}`);
          productsSkipped++;
          continue;
        }
        
        // Prepare product for new schema
        const newProduct = {
          ...oldProduct,
          shopId: shopId,
          createdAt: oldProduct.createdAt || new Date(),
          updatedAt: oldProduct.updatedAt || new Date()
        };
        
        // Insert into new schema
        await shopDb.collection('products').insertOne(newProduct);
        console.log(`  ✅ Migrated: ${oldProduct.name} (SKU: ${oldProduct.sku})`);
        productsCreated++;
        
      } catch (err) {
        console.error(`  ❌ Error migrating product ${oldProduct.name}:`, err.message);
      }
    }
    
    console.log(`\n  📊 Products Migration Result:`);
    console.log(`     ✅ Created: ${productsCreated}`);
    console.log(`     ⏭️  Skipped: ${productsSkipped}\n`);
    
    // ============================================
    // 2. CREATE STOCK SNAPSHOTS
    // ============================================
    console.log('📊 Creating Stock Snapshots...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Ensure collection exists with indexes
    try {
      await shopDb.createCollection('stock_snapshots');
    } catch (err) {
      // Collection already exists
    }
    
    // Create indexes
    await shopDb.collection('stock_snapshots').createIndex(
      { shopId: 1, productId: 1 },
      { unique: true }
    );
    await shopDb.collection('stock_snapshots').createIndex({ shopId: 1, sku: 1 });
    await shopDb.collection('stock_snapshots').createIndex({ shopId: 1, productName: 1 });
    
    console.log('  ✅ Indexes created');
    
    // Get all products from new schema
    const products = await shopDb.collection('products').find({}).toArray();
    console.log(`  Found ${products.length} products in new schema`);
    
    let snapshotsCreated = 0;
    let snapshotsSkipped = 0;
    
    for (const product of products) {
      try {
        // Check if snapshot exists
        const existingSnapshot = await shopDb
          .collection('stock_snapshots')
          .findOne({
            shopId: shopId,
            productId: product._id
          });
        
        if (existingSnapshot) {
          console.log(`  ⏭️  Snapshot already exists: ${product.name}`);
          snapshotsSkipped++;
          continue;
        }
        
        // Create snapshot from product data
        const snapshot = {
          shopId: shopId,
          productId: product._id,
          productName: product.name,
          sku: product.sku || '',
          
          // Stock quantities
          onHandQty: product.quantity || 0,
          reservedQty: 0,
          availableQty: product.quantity || 0,
          committedQty: 0,
          inTransitQty: 0,
          
          // Reorder point
          reorderPoint: product.reorderPoint || product.minStockLevel || 10,
          
          // Pricing
          avgCostPrice: product.purchasePrice || 0,
          
          // Timestamps
          lastUpdated: new Date(),
          createdAt: new Date(),
          
          // Version for optimistic locking
          version: 1,
          
          // Optional fields
          category: product.category || '',
          unit: product.unit || '',
          supplier: product.supplier || ''
        };
        
        await shopDb.collection('stock_snapshots').insertOne(snapshot);
        console.log(`  ✅ Snapshot created: ${product.name} (Qty: ${product.quantity || 0})`);
        snapshotsCreated++;
        
      } catch (err) {
        console.error(`  ❌ Error creating snapshot for ${product.name}:`, err.message);
      }
    }
    
    console.log(`\n  📊 Stock Snapshots Result:`);
    console.log(`     ✅ Created: ${snapshotsCreated}`);
    console.log(`     ⏭️  Skipped: ${snapshotsSkipped}\n`);
    
    // ============================================
    // 3. VERIFICATION
    // ============================================
    console.log('✅ Verification...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const finalProductCount = await shopDb.collection('products').countDocuments();
    const finalSnapshotCount = await shopDb.collection('stock_snapshots').countDocuments();
    
    console.log(`  📦 Products in new schema: ${finalProductCount}`);
    console.log(`  📊 Stock snapshots: ${finalSnapshotCount}`);
    
    if (finalProductCount === finalSnapshotCount) {
      console.log(`  ✅ All products have stock snapshots!\n`);
    } else {
      console.log(`  ⚠️  Mismatch: ${finalProductCount} products but ${finalSnapshotCount} snapshots\n`);
    }
    
    // Sample data
    const sampleSnapshot = await shopDb
      .collection('stock_snapshots')
      .findOne({});
    
    if (sampleSnapshot) {
      console.log('  📋 Sample Stock Snapshot:');
      console.log(`     Name: ${sampleSnapshot.productName}`);
      console.log(`     SKU: ${sampleSnapshot.sku}`);
      console.log(`     Available Qty: ${sampleSnapshot.availableQty}`);
      console.log(`     Reorder Point: ${sampleSnapshot.reorderPoint}`);
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✨ MIGRATION COMPLETE!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📊 Summary:');
    console.log(`   📦 Products migrated: ${productsCreated}`);
    console.log(`   📊 Stock snapshots created: ${snapshotsCreated}`);
    console.log('\n✅ Stock Report should now display products!');
    console.log('   Refresh your browser to see the changes.\n');
    
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
console.log('║  Old Schema → New Schema Migration           ║');
console.log('║  Phase 5A: Event-Sourced Stock System        ║');
console.log('╚═══════════════════════════════════════════════╝');
console.log('');

migrateToNewSchema()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Script failed:', err);
    process.exit(1);
  });
