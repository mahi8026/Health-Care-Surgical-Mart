require('dotenv').config();
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

async function countProducts() {
  const client = new MongoClient(MONGO_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db();
    
    const count = await db.collection('shop_health_care_01_products').countDocuments();
    console.log(`📦 shop_health_care_01_products: ${count} products`);
    
    if (count > 0) {
      const sample = await db.collection('shop_health_care_01_products').findOne();
      console.log('\n📄 Sample product:', JSON.stringify(sample, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

countProducts();
