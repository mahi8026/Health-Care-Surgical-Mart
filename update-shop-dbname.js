/**
 * Update shop dbName to point to the correct database
 */

const { MongoClient } = require("mongodb");
require("dotenv").config({ path: "./server/.env" });

const MONGO_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || "Health_Care_Shop_DB";

async function updateShopDbName() {
  let client;
  
  try {
    console.log("Connecting to MongoDB...");
    client = new MongoClient(MONGO_URI);
    await client.connect();
    console.log("✓ Connected\n");

    const db = client.db(DB_NAME);
    
    // Find the shop
    const shop = await db.collection("shops").findOne({ name: "Health Care Surgical Mart" });
    
    if (!shop) {
      console.log("❌ Shop not found!");
      return;
    }
    
    console.log(`Found shop: ${shop.name}`);
    console.log(`Current dbName: ${shop.dbName}`);
    console.log(`Shop ID: ${shop._id || shop.shopId}\n`);
    
    // Update the shop to use the main database
    const correctDbName = DB_NAME;
    
    console.log(`Updating shop dbName to: ${correctDbName}`);
    
    await db.collection("shops").updateOne(
      { _id: shop._id },
      { 
        $set: { 
          dbName: correctDbName,
          shopId: shop.shopId || shop._id.toString(),
          updatedAt: new Date()
        } 
      }
    );
    
    console.log("✓ Shop updated successfully!\n");
    
    // Verify
    const updatedShop = await db.collection("shops").findOne({ _id: shop._id });
    console.log("Verification:");
    console.log(`  Name: ${updatedShop.name}`);
    console.log(`  dbName: ${updatedShop.dbName}`);
    console.log(`  shopId: ${updatedShop.shopId}`);
    
    // Check products
    const productsCount = await db.collection("products").countDocuments();
    console.log(`  Products in database: ${productsCount}`);

  } catch (error) {
    console.error("Error:", error);
  } finally {
    if (client) {
      await client.close();
      console.log("\n✓ Connection closed");
    }
  }
}

updateShopDbName();
