/**
 * Migration Script: Create stock snapshots for products without them
 * 
 * Run this script to fix products created before the snapshot system was implemented
 * 
 * Usage: node server/scripts/migrate-missing-snapshots.js
 */

const { MongoClient, ObjectId } = require('mongodb');

// Configuration
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://your-connection-string';
const DB_NAME = process.env.DB_NAME || 'medical-store-pos';

async function migrateSnapshots() {
  console.log('Starting snapshot migration...');
  
  const client = new MongoClient(MONGO_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(DB_NAME);
    
    // Get all shops
    const shops = await db.collection('shops').find({ isActive: true }).toArray();
    console.log(`Found ${shops.length} active shops`);
    
    let totalProductsProcessed = 0;
    let totalSnapshotsCreated = 0;
    
    for (const shop of shops) {
      console.log(`\nProcessing shop: ${shop.name} (${shop._id})`);
      
      // Get shop's database
      const shopDbName = `shop_${shop._id}`;
      const shopDb = client.db(shopDbName);
      
      // Get all products
      const products = await shopDb.collection('products').find({}).toArray();
      console.log(`  Found ${products.length} products`);
      
      for (const product of products) {
        totalProductsProcessed++;
        
        // Check if snapshot already exists
        const existingSnapshot = await shopDb.collection('stock_snapshots').findOne({
          productId: product._id
        });
        
        if (existingSnapshot) {
          console.log(`  ✓ Product ${product.name} (${product.sku}) already has snapshot`);
          continue;
        }
        
        // Create new snapshot
        const snapshot = {
          productId: product._id,
          productName: product.name,
          sku: product.sku || null,
          onHandQty: product.stockQuantity || 0,
          reservedQty: 0,
          availableQty: product.stockQuantity || 0,
          avgCostPrice: product.purchasePrice || 0,
          totalCostValue: (product.stockQuantity || 0) * (product.purchasePrice || 0),
          reorderPoint: product.minStockLevel || product.reorderPoint || 10,
          lastMovementType: product.stockQuantity > 0 ? 'OPENING_STOCK' : null,
          lastMovementDate: product.stockQuantity > 0 ? new Date() : null,
          batchCount: 0,
          oldestExpiryDate: null,
          nearestExpiryDate: null,
          lastLedgerVersion: 0,
          lastLedgerEntryId: null,
          version: 0,
          updatedAt: new Date(),
          createdAt: new Date(),
        };
        
        await shopDb.collection('stock_snapshots').insertOne(snapshot);
        totalSnapshotsCreated++;
        
        console.log(`  ✓ Created snapshot for ${product.name} (${product.sku}) with qty: ${product.stockQuantity || 0}`);
      }
    }
    
    console.log('\n=================================');
    console.log('Migration Complete!');
    console.log(`Total products processed: ${totalProductsProcessed}`);
    console.log(`New snapshots created: ${totalSnapshotsCreated}`);
    console.log('=================================\n');
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('Disconnected from MongoDB');
  }
}

// Run migration
migrateSnapshots()
  .then(() => {
    console.log('Migration script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });
