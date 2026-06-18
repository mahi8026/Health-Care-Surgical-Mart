/**
 * Phase 1 - Step 1: Create Stock Collections
 * 
 * Creates the three new collections for event-sourced stock management:
 * - stock_ledger: Immutable event log
 * - stock_snapshots: Materialized view (current state)
 * - stock_batches: FEFO batch tracking
 * 
 * Run: node scripts/stock-migration/01-create-collections.js
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

async function createStockCollections() {
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
    
    // Extract unique shopIds from existing collections
    collections.forEach(col => {
      const match = col.name.match(/^(shop_[a-zA-Z0-9_]+?)_/);
      if (match && !col.name.match(/_stock_ledger$|_stock_snapshots$|_stock_batches$/)) {
        shopIds.add(match[1]);
      }
    });
    
    console.log(`\n📊 Found ${shopIds.size} shops: ${Array.from(shopIds).join(', ')}`);
    
    // Create stock collections for each shop
    for (const shopId of shopIds) {
      console.log(`\n🏪 Processing ${shopId}...`);
      
      const collections = [
        `${shopId}_stock_ledger`,
        `${shopId}_stock_snapshots`,
        `${shopId}_stock_batches`
      ];
      
      for (const collectionName of collections) {
        try {
          // Check if collection already exists
          const existing = await db.listCollections({ name: collectionName }).toArray();
          
          if (existing.length > 0) {
            console.log(`   ⏭️  ${collectionName} already exists, skipping...`);
          } else {
            await db.createCollection(collectionName);
            console.log(`   ✅ Created ${collectionName}`);
          }
        } catch (error) {
          console.error(`   ❌ Error creating ${collectionName}:`, error.message);
        }
      }
    }
    
    console.log('\n🎉 Stock collections created successfully!');
    console.log('\n📝 Next step: Run 02-create-indexes.js');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Run the script
createStockCollections()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
