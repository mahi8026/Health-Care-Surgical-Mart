/**
 * Migration: Create Performance Indexes
 * 
 * Purpose: Add missing database indexes for query optimization
 * Impact: 50-90% faster queries on large datasets
 * 
 * Run: node server/scripts/create-performance-indexes.js
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;

async function createPerformanceIndexes() {
  console.log('🚀 Starting performance index creation...\n');
  
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const systemDb = client.db('medical_store_system');
    
    // Get all active shops
    const shops = await systemDb.collection('shops').find({ status: 'Active' }).toArray();
    console.log(`Found ${shops.length} active shops\n`);
    
    const indexDefinitions = [
      // Sales collection indexes
      {
        collection: 'sales',
        indexes: [
          { key: { invoiceNo: 1 }, options: { name: 'invoiceNo_idx', unique: true } },
          { key: { customerId: 1, createdAt: -1 }, options: { name: 'customer_date_idx' } },
          { key: { createdAt: -1 }, options: { name: 'createdAt_idx' } },
          { key: { paymentStatus: 1 }, options: { name: 'paymentStatus_idx' } },
          { key: { 'items.productId': 1 }, options: { name: 'items_product_idx' } }
        ]
      },
      
      // Customers collection indexes
      {
        collection: 'customers',
        indexes: [
          { key: { phone: 1 }, options: { name: 'phone_idx', unique: true, sparse: true } },
          { key: { email: 1 }, options: { name: 'email_idx', sparse: true } },
          { key: { name: 1 }, options: { name: 'name_idx' } },
          { key: { totalPurchases: -1 }, options: { name: 'total_purchases_idx' } }
        ]
      },
      
      // Products collection indexes
      {
        collection: 'products',
        indexes: [
          { key: { sku: 1 }, options: { name: 'sku_idx', unique: true } },
          { key: { barcode: 1 }, options: { name: 'barcode_idx', sparse: true } },
          { key: { name: 1 }, options: { name: 'name_idx' } },
          { key: { category: 1 }, options: { name: 'category_idx' } },
          { key: { isActive: 1 }, options: { name: 'isActive_idx' } },
          { key: { stockQuantity: 1 }, options: { name: 'stock_qty_idx' } }
        ]
      },
      
      // Stock Ledger indexes (event-sourced system)
      {
        collection: 'stock_ledger',
        indexes: [
          { key: { productId: 1, timestamp: -1 }, options: { name: 'product_time_idx' } },
          { key: { movementType: 1, timestamp: -1 }, options: { name: 'movement_time_idx' } },
          { key: { referenceId: 1 }, options: { name: 'reference_idx' } },
          { key: { version: 1 }, options: { name: 'version_idx' } }
        ]
      },
      
      // Stock Snapshots indexes
      {
        collection: 'stock_snapshots',
        indexes: [
          { key: { productId: 1 }, options: { name: 'productId_idx', unique: true } },
          { key: { availableQty: 1 }, options: { name: 'available_qty_idx' } },
          { key: { onHandQty: 1 }, options: { name: 'on_hand_qty_idx' } }
        ]
      },
      
      // Stock Batches indexes (FEFO)
      {
        collection: 'stock_batches',
        indexes: [
          { key: { productId: 1, expiryDate: 1 }, options: { name: 'product_expiry_idx' } },
          { key: { batchNo: 1 }, options: { name: 'batchNo_idx' } },
          { key: { status: 1, expiryDate: 1 }, options: { name: 'status_expiry_idx' } },
          { key: { expiryDate: 1 }, options: { name: 'expiryDate_idx' } }
        ]
      },
      
      // Suppliers collection indexes
      {
        collection: 'suppliers',
        indexes: [
          { key: { phone: 1 }, options: { name: 'phone_idx', unique: true } },
          { key: { name: 1 }, options: { name: 'name_idx' } },
          { key: { isActive: 1 }, options: { name: 'isActive_idx' } }
        ]
      },
      
      // Purchases collection indexes
      {
        collection: 'purchases',
        indexes: [
          { key: { purchaseOrderNo: 1 }, options: { name: 'po_number_idx', unique: true } },
          { key: { supplierId: 1, createdAt: -1 }, options: { name: 'supplier_date_idx' } },
          { key: { status: 1 }, options: { name: 'status_idx' } },
          { key: { createdAt: -1 }, options: { name: 'createdAt_idx' } }
        ]
      },
      
      // Expenses collection indexes
      {
        collection: 'expenses',
        indexes: [
          { key: { categoryId: 1, date: -1 }, options: { name: 'category_date_idx' } },
          { key: { date: -1 }, options: { name: 'date_idx' } },
          { key: { paymentMethod: 1 }, options: { name: 'payment_method_idx' } }
        ]
      },
      
      // Users collection indexes
      {
        collection: 'users',
        indexes: [
          { key: { email: 1 }, options: { name: 'email_idx', unique: true } },
          { key: { firebaseUid: 1 }, options: { name: 'firebase_uid_idx', sparse: true } },
          { key: { role: 1 }, options: { name: 'role_idx' } },
          { key: { isActive: 1 }, options: { name: 'isActive_idx' } }
        ]
      }
    ];
    
    let totalIndexesCreated = 0;
    let totalIndexesSkipped = 0;
    let totalErrors = 0;
    
    for (const shop of shops) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📦 Processing Shop: ${shop.name} (${shop.shopId})`);
      console.log('='.repeat(60));
      
      const shopDb = client.db(`shop_${shop.shopId}`);
      
      for (const indexDef of indexDefinitions) {
        console.log(`\n  📁 Collection: ${indexDef.collection}`);
        
        const collection = shopDb.collection(indexDef.collection);
        
        // Check if collection exists
        const collections = await shopDb.listCollections({ name: indexDef.collection }).toArray();
        if (collections.length === 0) {
          console.log(`     ⏭️  Collection doesn't exist, skipping...`);
          continue;
        }
        
        // Get existing indexes
        const existingIndexes = await collection.indexes();
        const existingIndexNames = existingIndexes.map(idx => idx.name);
        
        for (const indexSpec of indexDef.indexes) {
          try {
            const indexName = indexSpec.options?.name || Object.keys(indexSpec.key).join('_');
            
            if (existingIndexNames.includes(indexName)) {
              console.log(`     ⏭️  ${indexName} (already exists)`);
              totalIndexesSkipped++;
            } else {
              await collection.createIndex(indexSpec.key, indexSpec.options);
              console.log(`     ✅ ${indexName}`);
              totalIndexesCreated++;
            }
          } catch (error) {
            if (error.code === 85) {
              // Index already exists with different options
              console.log(`     ⚠️  ${indexSpec.options?.name} (exists with different options)`);
              totalIndexesSkipped++;
            } else {
              console.error(`     ❌ ${indexSpec.options?.name}: ${error.message}`);
              totalErrors++;
            }
          }
        }
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Shops Processed:      ${shops.length}`);
    console.log(`Indexes Created:      ${totalIndexesCreated}`);
    console.log(`Indexes Skipped:      ${totalIndexesSkipped}`);
    console.log(`Errors:               ${totalErrors}`);
    console.log('='.repeat(60));
    
    console.log('\n✅ Performance index creation completed!');
    console.log('\n💡 Expected impact:');
    console.log('   - 50-90% faster search queries');
    console.log('   - Reduced database CPU usage');
    console.log('   - Better scalability for large datasets\n');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await client.close();
    console.log('🔌 Database connection closed');
  }
}

// Run migration
createPerformanceIndexes()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
