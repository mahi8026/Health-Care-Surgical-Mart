const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();

const uri =
  process.env.MONGODB_URI ||
  "mongodb+srv://Health_Care_DB:kp1lkE5Wx9y9bbwP@cluster0.rqyzhey.mongodb.net/?appName=Cluster0";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  maxPoolSize: 50,
  minPoolSize: 10,
  maxIdleTimeMS: 30000,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000,
});

let isConnected = false;

/**
 * Connect to MongoDB Atlas
 */
async function connectToMongoDB() {
  if (isConnected) {
    return client;
  }

  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("✅ Successfully connected to MongoDB Atlas!");
    isConnected = true;
    return client;
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error);
    throw error;
  }
}

/**
 * Get database instance for a specific shop
 * @param {string} shopId - Unique shop identifier
 * @returns {Db} MongoDB database instance
 */
function getShopDatabase(shopId) {
  if (!isConnected) {
    throw new Error("MongoDB not connected. Call connectToMongoDB() first.");
  }

  const dbName = `shop_${shopId}`;
  return client.db(dbName);
}

/**
 * Get the system database (for super admin operations)
 * @returns {Db} MongoDB database instance
 */
function getSystemDatabase() {
  if (!isConnected) {
    throw new Error("MongoDB not connected. Call connectToMongoDB() first.");
  }

  return client.db("medical_store_system");
}

/**
 * Close MongoDB connection
 */
async function closeConnection() {
  try {
    await client.close();
    isConnected = false;
    console.log("MongoDB connection closed.");
  } catch (error) {
    console.error("Error closing MongoDB connection:", error);
  }
}

/**
 * List all shop databases
 * @returns {Promise<Array>} List of shop database names
 */
async function listAllShops() {
  try {
    const adminDb = client.db().admin();
    const { databases } = await adminDb.listDatabases();

    return databases
      .filter((db) => db.name.startsWith("shop_"))
      .map((db) => ({
        shopId: db.name.replace("shop_", ""),
        dbName: db.name,
        sizeOnDisk: db.sizeOnDisk,
        empty: db.empty,
      }));
  } catch (error) {
    console.error("Error listing shops:", error);
    throw error;
  }
}

module.exports = {
  connectToMongoDB,
  getShopDatabase,
  getSystemDatabase,
  closeConnection,
  listAllShops,
  client,
};
