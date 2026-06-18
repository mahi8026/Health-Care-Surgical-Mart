/**
 * Phase 1 - Step 3: Seed Stock Snapshots
 * 
 * Migrates current stock from products.currentQty to stock_snapshots
 * Creates initial snapshot for each product
 * 
 * Run: node scripts/stock-migration/03-seed-snapshots.js
 */

require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

async function seedSnapshots() {
  if (!MONGO_URI) {
    console.error('❌ Error: MONGO_URI not found in environment variables');
    process.exit(1);
  }

  const client = new MongoClient(MONGO_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db();
    
    // Get all collections to find shop-prefixed product collections
    const collections = await db.listCollections().toArray();
    const shopIds = new Set();
    
    collections.forEach(col => {
      const match = col.name.match(/^(shop_[a-zA-Z0-9_]+?)_products$/);
      if (match) {
        shopIds.add(match[1]);
      }
    });
    
    console.log(`\n📊 Found ${shopIds.size} shops: ${Array.from(shopIds).join(', ')}`);
    
    let totalProducts = 0;
    let totalSnapshots = 0;
    
    for (const shopId of shopIds) {
      console.log(`\n🏪 Processing ${shopId}...`);
      
      const productsCollection = db.collection(`${shopId}_products`);
      const snapshotsCollection = db.collection(`${shopId}_stock_snapshots`);
      const ledgerCollection = db.collection(`${shopId}_stock_ledger`);
      
      // Check if snapshots already exist
      const existingCount = await snapshotsCollection.countDocuments();
      if (existingCount > 0) {
        console.log(`   ⏭️  ${existingCount} snapshots already exist, skipping...`);
        continue;
      }
      
      // Get all products
      const products = await productsCollection.find({}).toArray();
      totalProducts += products.length;
      
      if (products.length === 0) {
        console.log('   ℹ️  No products found');
        continue;
      }
      
      console.log(`   📦 Found ${products.length} products`);
      
      const snapshots = [];
      const ledgerEntries = [];
      
      for (const product of products) {
        const currentQty = product.currentQty || product.quantity || 0;
        const timestamp = new Date();
        
        // Create initial snapshot
        const snapshot = {
          productId: product._id,
          shopId,
          onHandQty: currentQty,
          reservedQty: 0,
          availableQty: currentQty,
          lastLedgerEntryId: null, // Will be updated after ledger insert
          lastLedgerVersion: 0,
          productName: product.name,
          sku: product.sku || '',
          category: typeof product.category === 'object' 
            ? product.category?.name || '' 
            : product.category || '',
          unit: product.unit || 'pcs',
          reorderPoint: product.reorderPoint || product.minStockLevel || 10,
          maxStockLevel: product.maxStockLevel || null,
          lastMovementAt: timestamp,
          lastMovementType: 'OPENING_STOCK',
          updatedAt: timestamp
        };
        
        snapshots.push(snapshot);
        
        // Create opening stock ledger entry if quantity > 0
        if (currentQty > 0) {
          const ledgerEntry = {
            productId: product._id,
            shopId,
            movementType: 'OPENING_STOCK',
            direction: 'IN',
            quantity: currentQty,
            runningBalance: currentQty,
            version: 0,
            referenceType: 'OPENING',
            referenceId: product._id,
            batchNo: null,
            lotNo: null,
            expiryDate: null,
            costPrice: product.purchasePrice || product.costPrice || 0,
            userId: null, // System migration
            timestamp,
            note: `Initial stock migration from products.currentQty`,
            metadata: {
              source: 'migration',
              originalCurrentQty: currentQty
            }
          };
          
          ledgerEntries.push(ledgerEntry);
        }
      }
      
      // Insert snapshots
      if (snapshots.length > 0) {
        const snapshotResult = await snapshotsCollection.insertMany(snapshots);
        console.log(`   ✅ Created ${snapshotResult.insertedCount} snapshots`);
        totalSnapshots += snapshotResult.insertedCount;
      }
      
      // Insert opening stock ledger entries
      if (ledgerEntries.length > 0) {
        const ledgerResult = await ledgerCollection.insertMany(ledgerEntries);
        console.log(`   ✅ Created ${ledgerResult.insertedCount} opening stock entries`);
        
        // Update snapshots with ledger entry IDs
        for (let i = 0; i < ledgerEntries.length; i++) {
          const ledgerEntry = ledgerEntries[i];
          const ledgerId = ledgerResult.insertedIds[i];
          
          await snapshotsCollection.updateOne(
            { productId: ledgerEntry.productId, shopId },
            { 
              $set: { 
                lastLedgerEntryId: ledgerId,
                lastLedgerVersion: 1
              } 
            }
          );
        }
        console.log(`   ✅ Updated ${ledgerEntries.length} snapshots with ledger references`);
      }
    }
    
    console.log('\n🎉 Migration completed successfully!');
    console.log(`\n📊 Summary:`);
    console.log(`   • Total products processed: ${totalProducts}`);
    console.log(`   • Total snapshots created: ${totalSnapshots}`);
    console.log(`\n📝 Next step: Deploy StockCommandService (Phase 1 Step 4)`);
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Run the script
seedSnapshots()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
