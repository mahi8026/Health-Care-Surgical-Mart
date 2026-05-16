/**
 * Find Sales in All Databases
 */

require('dotenv').config({ path: './server/.env' });
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;

async function findSales() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    // List all databases
    const adminDb = client.db().admin();
    const dbs = await adminDb.listDatabases();
    
    for (const database of dbs.databases) {
      if (database.name === 'admin' || database.name === 'local') continue;
      
      console.log(`\n📚 Database: ${database.name}`);
      const db = client.db(database.name);
      const collections = await db.listCollections().toArray();
      
      for (const col of collections) {
        if (col.name.toLowerCase().includes('sale')) {
          const count = await db.collection(col.name).countDocuments();
          console.log(`  📦 ${col.name}: ${count} documents`);
          
          if (count > 0) {
            const latest = await db.collection(col.name).findOne({}, { sort: { createdAt: -1, saleDate: -1, _id: -1 } });
            console.log(`    Latest sale:`);
            console.log(`      Invoice: ${latest.invoiceNo || latest.invoiceNumber || 'N/A'}`);
            console.log(`      Customer: ${latest.customerName || 'N/A'}`);
            console.log(`      Phone: ${latest.customerPhone || '❌ NOT SAVED'}`);
            console.log(`      Address: ${latest.customerAddress || '❌ NOT SAVED'}`);
            console.log(`      Date: ${latest.createdAt || latest.saleDate || 'N/A'}`);
          }
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
    console.log('\n✅ Connection closed');
  }
}

findSales();
