/**
 * Move products from plain collection to shop-prefixed collection
 */

const { MongoClient } = require("mongodb");
require("dotenv").config({ path: "./server/.env" });

const MONGO_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || "Health_Care_Shop_DB";

async function moveProducts() {
  let client;
  
  try {
    console.log("Connecting to MongoDB...");
    client = new MongoClient(MONGO_URI);
    await client.connect();
    console.log("✓ Connected\n");

    const db = client.db(DB_NAME);
    
    // Get shop info
    const shop = await db.collection("shops").findOne({ name: "Health Care Surgical Mart" });
    const shopId = shop.shopId;
    
    console.log(`Shop: ${shop.name}`);
    console.log(`ShopId: ${shopId}\n`);
    
    // Get products from plain collection
    const products = await db.collection("products").find({}).toArray();
    console.log(`Found ${products.length} products in 'products' collection`);
    
    if (products.length === 0) {
      console.log("No products to move!");
      return;
    }
    
    // Insert into prefixed collection
    const prefixedName = `${shopId}_products`;
    console.log(`Moving to '${prefixedName}' collection...`);
    
    await db.collection(prefixedName).insertMany(products);
    console.log(`✓ Inserted ${products.length} products into ${prefixedName}`);
    
    // Move stock entries too
    const stock = await db.collection("stock").find({}).toArray();
    console.log(`\nFound ${stock.length} stock entries in 'stock' collection`);
    
    if (stock.length > 0) {
      const prefixedStockName = `${shopId}_stock`;
      console.log(`Moving to '${prefixedStockName}' collection...`);
      
      await db.collection(prefixedStockName).insertMany(stock);
      console.log(`✓ Inserted ${stock.length} stock entries into ${prefixedStockName}`);
    }
    
    console.log("\n=== VERIFICATION ===");
    const verifyProducts = await db.collection(prefixedName).countDocuments();
    const verifyStock = await db.collection(`${shopId}_stock`).countDocuments();
    console.log(`${prefixedName}: ${verifyProducts} products`);
    console.log(`${shopId}_stock: ${verifyStock} stock entries`);
    
    console.log("\n✓ Migration completed successfully!");
    console.log("\nNote: Old 'products' and 'stock' collections still exist.");
    console.log("You can delete them manually if needed.");

  } catch (error) {
    console.error("Error:", error);
  } finally {
    if (client) {
      await client.close();
      console.log("\n✓ Connection closed");
    }
  }
}

moveProducts();
