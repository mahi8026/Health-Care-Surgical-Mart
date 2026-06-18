/**
 * Phase 1 - Step 2: Create Stock Indexes
 * 
 * Creates performance indexes for stock collections
 * 
 * Run: node scripts/stock-migration/02-create-indexes.js
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

async function createStockIndexes() {
  if (!MONGO_URI) {
    console.error('❌ Error: MONGO_URI not found in environment variables');
    process.exit(1);
  }

  const client = new MongoClient(MONGO_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db();
    
    // Get all collections to find shop-prefixed ones
    const collections = await db.listCollections().toArray();
    const shopIds = new Set();
    
    collections.forEach(col => {
      const match = col.name.match(/^(shop_[a-zA-Z0-9_]+?)_/);
      if (match && !col.name.match(/_stock_ledger$|_stock_snapshots$|_stock_batches$/)) {
        shopIds.add(match[1]);
      }
    });
    
    console.log(`\n📊 Found ${shopIds.size} shops: ${Array.from(shopIds).join(', ')}`);
    
    for (const shopId of shopIds) {
      console.log(`\n🏪 Creating indexes for ${shopId}...`);
      
      // Stock Ledger Indexes
      console.log('   📚 Stock Ledger indexes...');
      const ledger = db.collection(`${shopId}_stock_ledger`);
      
      await ledger.createIndex(
        { shopId: 1, productId: 1, timestamp: -1 },
        { name: 'product_timeline' }
      );
      console.log('      ✅ product_timeline');
      
      await ledger.createIndex(
        { shopId: 1, referenceId: 1, referenceType: 1 },
        { name: 'reference_lookup' }
      );
      console.log('      ✅ reference_lookup');
      
      await ledger.createIndex(
        { shopId: 1, movementType: 1, timestamp: -1 },
        { name: 'type_timeline' }
      );
      console.log('      ✅ type_timeline');
      
      await ledger.createIndex(
        { shopId: 1, batchNo: 1 },
        { name: 'batch_lookup', sparse: true }
      );
      console.log('      ✅ batch_lookup');
      
      await ledger.createIndex(
        { shopId: 1, expiryDate: 1 },
        { name: 'expiry_scan', sparse: true }
      );
      console.log('      ✅ expiry_scan');
      
      await ledger.createIndex(
        { shopId: 1, userId: 1, timestamp: -1 },
        { name: 'user_activity' }
      );
      console.log('      ✅ user_activity');
      
      await ledger.createIndex(
        { shopId: 1, productId: 1, version: 1 },
        { name: 'version_lock', unique: true }
      );
      console.log('      ✅ version_lock (unique)');
      
      // Stock Snapshots Indexes
      console.log('   📸 Stock Snapshot indexes...');
      const snapshots = db.collection(`${shopId}_stock_snapshots`);
      
      await snapshots.createIndex(
        { shopId: 1, productId: 1 },
        { name: 'product_lookup', unique: true }
      );
      console.log('      ✅ product_lookup (unique)');
      
      await snapshots.createIndex(
        { shopId: 1, availableQty: 1, reorderPoint: 1 },
        { name: 'reorder_scan' }
      );
      console.log('      ✅ reorder_scan');
      
      await snapshots.createIndex(
        { shopId: 1, lastMovementAt: -1 },
        { name: 'recent_activity' }
      );
      console.log('      ✅ recent_activity');
      
      // Stock Batches Indexes
      console.log('   📦 Stock Batch indexes...');
      const batches = db.collection(`${shopId}_stock_batches`);
      
      await batches.createIndex(
        { shopId: 1, productId: 1, expiryDate: 1, status: 1 },
        { name: 'fefo_query' }
      );
      console.log('      ✅ fefo_query');
      
      await batches.createIndex(
        { shopId: 1, expiryDate: 1, status: 1 },
        { name: 'expiry_alert' }
      );
      console.log('      ✅ expiry_alert');
      
      await batches.createIndex(
        { shopId: 1, batchNo: 1, productId: 1 },
        { name: 'batch_product', unique: true }
      );
      console.log('      ✅ batch_product (unique)');
    }
    
    console.log('\n🎉 All indexes created successfully!');
    console.log('\n📝 Next step: Run 03-seed-snapshots.js');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Run the script
createStockIndexes()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
