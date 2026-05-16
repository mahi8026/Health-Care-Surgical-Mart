/**
 * Get All Users from Database
 */

require('dotenv').config({ path: './server/.env' });
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;

async function getUsers() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    // Check all databases for users
    const adminDb = client.db().admin();
    const dbs = await adminDb.listDatabases();
    
    for (const database of dbs.databases) {
      if (database.name === 'admin' || database.name === 'local') continue;
      
      const db = client.db(database.name);
      const collections = await db.listCollections().toArray();
      
      for (const col of collections) {
        if (col.name === 'users' || col.name === 'system_users') {
          const users = await db.collection(col.name).find({}).toArray();
          
          if (users.length > 0) {
            console.log(`\n📚 Database: ${database.name}`);
            console.log(`📦 Collection: ${col.name}`);
            console.log(`👥 Users (${users.length}):\n`);
            
            users.forEach((user, index) => {
              console.log(`${index + 1}. ${user.name || 'No Name'}`);
              console.log(`   Email: ${user.email}`);
              console.log(`   Role: ${user.role}`);
              console.log(`   Active: ${user.isActive !== false ? 'Yes' : 'No'}`);
              console.log(`   Shop ID: ${user.shopId || 'N/A'}`);
              console.log('');
            });
          }
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
    console.log('✅ Connection closed');
  }
}

getUsers();
