/**
 * Rollback Phase 1 Migration
 * 
 * Safely removes all Phase 1 changes:
 * - Drops stock_ledger collections
 * - Drops stock_snapshots collections
 * - Drops stock_batches collections
 * - Leaves products.currentQty intact
 * 
 * Run: node scripts/stock-migration/rollback-phase-1.js
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');
const readline = require('readline');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

// Create readline interface for confirmation
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askConfirmation(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

async function rollbackPhase1() {
  if (!MONGO_URI) {
    console.error('❌ Error: MONGO_URI not found in environment variables');
    process.exit(1);
  }

  console.log('\n⚠️  ROLLBACK PHASE 1 MIGRATION');
  console.log('═'.repeat(60));
  console.log('\nThis will:');
  console.log('  • Drop stock_ledger collections');
  console.log('  • Drop stock_snapshots collections');
  console.log('  • Drop stock_batches collections');
  console.log('\nThis will NOT:');
  console.log('  • Affect products.currentQty (your data is safe)');
  console.log('  • Delete any products');
  console.log('  • Affect sales, purchases, or other data\n');

  const confirmed = await askConfirmation('Are you sure you want to rollback? (yes/no): ');
  
  if (!confirmed) {
    console.log('\n❌ Rollback cancelled');
    rl.close();
    process.exit(0);
  }

  const client = new MongoClient(MONGO_URI);
  
  try {
    await client.connect();
    console.log('\n✅ Connected to MongoDB\n');
    
    const db = client.db();
    
    // Get all collections
    const collections = await db.listCollections().toArray();
    const shopIds = new Set();
    
    // Find all stock collections
    const stockCollections = [];
    collections.forEach(col => {
      const ledgerMatch = col.name.match(/^(shop\d+)_stock_ledger$/);
      const snapshotMatch = col.name.match(/^(shop\d+)_stock_snapshots$/);
      const batchMatch = col.name.match(/^(shop\d+)_stock_batches$/);
      
      if (ledgerMatch || snapshotMatch || batchMatch) {
        stockCollections.push(col.name);
        const shopMatch = col.name.match(/^(shop\d+)_/);
        if (shopMatch) shopIds.add(shopMatch[1]);
      }
    });
    
    if (stockCollections.length === 0) {
      console.log('ℹ️  No stock collections found to rollback');
      rl.close();
      return;
    }
    
    console.log(`📊 Found ${shopIds.size} shops with stock collections`);
    console.log(`🗑️  Will drop ${stockCollections.length} collections:\n`);
    
    stockCollections.forEach(name => {
      console.log(`   • ${name}`);
    });
    
    console.log('');
    const finalConfirm = await askConfirmation('Proceed with deletion? (yes/no): ');
    
    if (!finalConfirm) {
      console.log('\n❌ Rollback cancelled');
      rl.close();
      process.exit(0);
    }
    
    console.log('\n🗑️  Dropping collections...\n');
    
    let dropped = 0;
    let failed = 0;
    
    for (const collName of stockCollections) {
      try {
        await db.collection(collName).drop();
        console.log(`   ✅ Dropped ${collName}`);
        dropped++;
      } catch (error) {
        if (error.message.includes('ns not found')) {
          console.log(`   ⏭️  ${collName} (already dropped)`);
        } else {
          console.error(`   ❌ Failed to drop ${collName}:`, error.message);
          failed++;
        }
      }
    }
    
    console.log('\n' + '═'.repeat(60));
    console.log('📊 ROLLBACK SUMMARY');
    console.log('═'.repeat(60));
    console.log(`\n✅ Collections dropped: ${dropped}`);
    if (failed > 0) {
      console.log(`❌ Failed: ${failed}`);
    }
    console.log('');
    
    // Verify products are intact
    console.log('🔍 Verifying products.currentQty is intact...\n');
    
    for (const shopId of shopIds) {
      const productCount = await db.collection(`${shopId}_products`).countDocuments();
      const sampleProduct = await db.collection(`${shopId}_products`).findOne({}, {
        projection: { name: 1, currentQty: 1, quantity: 1 }
      });
      
      if (sampleProduct) {
        console.log(`   ✅ ${shopId}: ${productCount} products intact`);
        console.log(`      Sample: "${sampleProduct.name}" qty=${sampleProduct.currentQty || sampleProduct.quantity || 0}`);
      }
    }
    
    console.log('\n✅ ROLLBACK COMPLETE\n');
    console.log('Your system is back to the state before Phase 1.');
    console.log('You can re-run Phase 1 migration if needed.\n');
    
  } catch (error) {
    console.error('\n❌ Rollback failed:', error);
    process.exit(1);
  } finally {
    await client.close();
    rl.close();
  }
}

// Run rollback
rollbackPhase1()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Fatal error:', error);
    rl.close();
    process.exit(1);
  });
