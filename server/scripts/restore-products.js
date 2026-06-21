/**
 * Restore deleted products
 */

const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function restoreProducts() {
  const mongoUri = process.env.MONGODB_URI;
  const shopId = '6a020466789ca874348b2557';

  if (!mongoUri) {
    console.error('❌ MONGODB_URI not found');
    process.exit(1);
  }

  const client = new MongoClient(mongoUri);

  try {
    console.log('🔄 Connecting to MongoDB...');
    await client.connect();

    const shopDb = client.db(`shop_${shopId}`);

    const result = await shopDb.collection('products').updateMany(
      { isActive: false },
      { $set: { isActive: true, updatedAt: new Date() } }
    );

    console.log(`✅ Restored ${result.modifiedCount} products to active status`);

    const activeCount = await shopDb.collection('products').countDocuments({ isActive: true });
    console.log(`   Total active products: ${activeCount}`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

restoreProducts();
