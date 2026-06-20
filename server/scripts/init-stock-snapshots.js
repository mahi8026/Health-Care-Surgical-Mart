/**
 * Initialize Stock Snapshots for Existing Products
 * 
 * This script creates stock_snapshots records for products that don't have them.
 * Needed after upgrading to Phase 5A event-sourced stock system.
 */

const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function initStockSnapshots() {
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
    console.log(`📊 Database: ${dbName}\n`);
    
    // Get system DB
    const systemDb = client.db(dbName);
    const shops = await systemDb.collection('shops').find({}).toArray();
    
    console.log(`🏪 Found ${shops.length} shops\n`);
    
    let totalCreated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    
    for (const shop of shops) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Processing: ${shop.shopName} (${shop._id})`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      
      const shopDb = client.db(`shop_${shop._id}`);
      
      // Ensure stock_snapshots collection exists with indexes
      try {
        await shopDb.createCollection('stock_snapshots');
        console.log('  ✅ Collection created');
      } catch (err) {
        // Collection already exists
      }
      
      // Create indexes
      await shopDb.collection('stock_snapshots').createIndex({ shopId: 1, productId: 1 }, { unique: true });
      await shopDb.collection('stock_snapshots').createIndex({ shopId: 1, sku: 1 });
      await shopDb.collection('stock_snapshots').createIndex({ shopId: 1, productName: 1 });
      
      // Get all products
      const products = await shopDb.collection('products').find({}).toArray();
      console.log(`  📦 Found ${products.length} products`);
      
      if (products.length === 0) {
        console.log('  ⚠️  No products found - skipping shop\n');
        continue;
      }
      
      let created = 0;
      let skipped = 0;
      let errors = 0;
      
      for (const product of products) {
        try {
          // Check if snapshot exists
          const existingSnapshot = await shopDb.collection('stock_snapshots').findOne({
            shopId: shop._id.toString(),
            productId: product._id
          });
          
          if (existingSnapshot) {
            skipped++;
            continue;
          }
          
          // Create snapshot
          const snapshot = {
            shopId: shop._id.toString(),
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
          created++;
          
          // Log progress every 50 products
          if ((created + skipped) % 50 === 0) {
            console.log(`    Progress: ${created + skipped}/${products.length}`);
          }
          
        } catch (err) {
          console.error(`    ❌ Error for product ${product.name}:`, err.message);
          errors++;
        }
      }
      
      console.log(`\n  📊 Results:`);
      console.log(`     ✅ Created: ${created}`);
      console.log(`     ⏭️  Skipped: ${skipped}`);
      if (errors > 0) {
        console.log(`     ❌ Errors: ${errors}`);
      }
      console.log('');
      
      totalCreated += created;
      totalSkipped += skipped;
      totalErrors += errors;
    }
    
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✨ COMPLETE!`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`\n📊 Summary:`);
    console.log(`   🏪 Shops processed: ${shops.length}`);
    console.log(`   ✅ Snapshots created: ${totalCreated}`);
    console.log(`   ⏭️  Already existed: ${totalSkipped}`);
    if (totalErrors > 0) {
      console.log(`   ❌ Errors: ${totalErrors}`);
    }
    console.log(`\n✅ Stock display should now work! Refresh your browser.\n`);
    
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
console.log('║  Stock Snapshot Initialization Script        ║');
console.log('║  Phase 5A: Event-Sourced Stock System        ║');
console.log('╚═══════════════════════════════════════════════╝');
console.log('');

initStockSnapshots()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Script failed:', err);
    process.exit(1);
  });
