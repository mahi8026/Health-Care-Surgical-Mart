/**
 * Find where products are stored
 */

const { MongoClient } = require("mongodb");
require("dotenv").config({ path: "./server/.env" });

const MONGO_URI = process.env.MONGODB_URI;

async function findProducts() {
  let client;
  
  try {
    console.log("Connecting to MongoDB...");
    client = new MongoClient(MONGO_URI);
    await client.connect();
    console.log("✓ Connected\n");

    // List all databases
    const adminDb = client.db().admin();
    const dbs = await adminDb.listDatabases();
    
    console.log("=== SEARCHING ALL DATABASES ===\n");
    
    for (const dbInfo of dbs.databases) {
      const dbName = dbInfo.name;
      
      // Skip system databases
      if (dbName === "admin" || dbName === "local" || dbName === "config") {
        continue;
      }
      
      const db = client.db(dbName);
      const collections = await db.listCollections().toArray();
      const collectionNames = collections.map(c => c.name);
      
      // Check if products collection exists
      if (collectionNames.includes("products")) {
        const productsCount = await db.collection("products").countDocuments();
        
        if (productsCount > 0) {
          console.log(`✓ FOUND: ${dbName}`);
          console.log(`  Products: ${productsCount}`);
          
          const sampleProducts = await db.collection("products").find({}).limit(3).toArray();
          console.log(`  Sample products:`);
          sampleProducts.forEach(p => {
            console.log(`    - ${p.name} (${p.sku})`);
          });
          console.log();
        }
      }
    }

  } catch (error) {
    console.error("Error:", error);
  } finally {
    if (client) {
      await client.close();
      console.log("✓ Connection closed");
    }
  }
}

findProducts();
