/**
 * Database Configuration - MongoDB Atlas
 * Enhanced connection management with connection pooling, monitoring, and error handling
 */

const { MongoClient, ServerApiVersion } = require("mongodb");
const { logger } = require("./logging");

// Connection configuration
const config = {
  uri: process.env.MONGODB_URI || "mongodb://localhost:27017",
  options: {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
    // Connection pool settings
    maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE) || 50,
    minPoolSize: parseInt(process.env.DB_MIN_POOL_SIZE) || 5,
    maxIdleTimeMS: parseInt(process.env.DB_MAX_IDLE_TIME) || 30000,

    // Connection timeout settings
    connectTimeoutMS: parseInt(process.env.DB_CONNECT_TIMEOUT) || 10000,
    socketTimeoutMS: parseInt(process.env.DB_SOCKET_TIMEOUT) || 45000,
    serverSelectionTimeoutMS:
      parseInt(process.env.DB_SERVER_SELECTION_TIMEOUT) || 5000,

    // Retry settings
    retryWrites: true,
    retryReads: true,

    // Monitoring
    monitorCommands: process.env.NODE_ENV === "development",
  },
};

let client = null;
let isConnected = false;

/**
 * Connect to MongoDB Atlas with enhanced error handling and monitoring
 */
async function connectToDatabase() {
  if (isConnected && client) {
    return client;
  }

  try {
    logger.info("Connecting to MongoDB Atlas...");

    client = new MongoClient(config.uri, config.options);

    // Connection event listeners
    client.on("connectionPoolCreated", () => {
      logger.info("MongoDB connection pool created");
    });

    client.on("connectionPoolClosed", () => {
      logger.info("MongoDB connection pool closed");
    });

    client.on("connectionCreated", () => {
      // Reduced logging - only log every 10th connection
      if (Math.random() < 0.1) {
        logger.debug("MongoDB connections active");
      }
    });

    client.on("connectionClosed", () => {
      // Reduced logging - only log every 10th closure
      if (Math.random() < 0.1) {
        logger.debug("MongoDB connections closed");
      }
    });

    client.on("error", (error) => {
      logger.error("MongoDB client error:", error);
    });

    // Connect to the server
    await client.connect();

    // Verify connection
    await client.db("admin").command({ ping: 1 });

    isConnected = true;
    logger.info("✅ Successfully connected to MongoDB Atlas");

    // Log connection details (without sensitive info)
    const admin = client.db().admin();
    const serverStatus = await admin.serverStatus();
    logger.info(`MongoDB version: ${serverStatus.version}`);
    logger.info(`Connection pool size: ${config.options.maxPoolSize}`);

    return client;
  } catch (error) {
    logger.error("❌ MongoDB connection failed:", error);
    isConnected = false;
    throw new Error(`Database connection failed: ${error.message}`);
  }
}

/**
 * Get database instance for a specific shop (multi-tenant)
 * @param {string} shopId - Unique shop identifier
 * @returns {Db} MongoDB database instance
 */
function getShopDatabase(shopId) {
  if (!isConnected || !client) {
    throw new Error("Database not connected. Call connectToDatabase() first.");
  }

  if (!shopId || typeof shopId !== "string") {
    throw new Error("Invalid shopId provided");
  }

  const dbName = `shop_${shopId.toLowerCase().replace(/[^a-z0-9_]/g, "_")}`;
  return client.db(dbName);
}

/**
 * Get the system database (for super admin operations)
 * @returns {Db} MongoDB database instance
 */
function getSystemDatabase() {
  if (!isConnected || !client) {
    throw new Error("Database not connected. Call connectToDatabase() first.");
  }

  // Use test database in test environment
  const dbName =
    process.env.NODE_ENV === "test"
      ? "medical_store_system_test"
      : "medical_store_system";

  return client.db(dbName);
}

/**
 * Close MongoDB connection gracefully
 */
async function closeDatabaseConnection() {
  if (!client) {
    return;
  }

  try {
    await client.close();
    isConnected = false;
    client = null;
    logger.info("MongoDB connection closed gracefully");
  } catch (error) {
    logger.error("Error closing MongoDB connection:", error);
    throw error;
  }
}

/**
 * Get database connection status and statistics
 * @returns {Object} Connection status and stats
 */
async function getDatabaseStats() {
  if (!isConnected || !client) {
    return { connected: false };
  }

  try {
    const admin = client.db().admin();
    const serverStatus = await admin.serverStatus();
    const listDatabases = await admin.listDatabases();

    return {
      connected: true,
      serverVersion: serverStatus.version,
      uptime: serverStatus.uptime,
      connections: serverStatus.connections,
      databases: listDatabases.databases.length,
      totalSize: listDatabases.totalSize,
    };
  } catch (error) {
    logger.error("Error getting database stats:", error);
    return { connected: false, error: error.message };
  }
}

/**
 * List all shop databases
 * @returns {Promise<Array>} List of shop database information
 */
async function listAllShops() {
  if (!isConnected || !client) {
    throw new Error("Database not connected");
  }

  try {
    const admin = client.db().admin();
    const { databases } = await admin.listDatabases();

    return databases
      .filter((db) => db.name.startsWith("shop_"))
      .map((db) => ({
        shopId: db.name.replace("shop_", ""),
        dbName: db.name,
        sizeOnDisk: db.sizeOnDisk,
        empty: db.empty,
      }))
      .sort((a, b) => a.shopId.localeCompare(b.shopId));
  } catch (error) {
    logger.error("Error listing shops:", error);
    throw error;
  }
}

/**
 * Create database indexes for optimal performance
 * @param {string} shopId - Shop identifier
 */
async function createShopIndexes(shopId) {
  try {
    const shopDb = getShopDatabase(shopId);

    // Product indexes
    await shopDb.collection("products").createIndexes([
      { key: { sku: 1 }, unique: true, name: "sku_unique" },
      { key: { name: 1 }, name: "name_index" },
      { key: { category: 1 }, name: "category_index" },
      { key: { isActive: 1 }, name: "active_status_index" },
      { key: { name: "text", brand: "text" }, name: "text_search_index" },
    ]);

    // Sales indexes
    await shopDb.collection("sales").createIndexes([
      { key: { invoiceNo: 1 }, unique: true, name: "invoice_unique" },
      { key: { saleDate: -1 }, name: "sale_date_desc" },
      { key: { customerId: 1 }, name: "customer_index" },
      { key: { createdBy: 1 }, name: "created_by_index" },
    ]);

    // Stock indexes
    await shopDb.collection("stock").createIndexes([
      { key: { productId: 1 }, unique: true, name: "product_unique" },
      { key: { isLowStock: 1 }, name: "low_stock_index" },
      { key: { lastUpdated: -1 }, name: "last_updated_desc" },
    ]);

    // Customer indexes
    await shopDb.collection("customers").createIndexes([
      { key: { phone: 1 }, name: "phone_index" },
      { key: { email: 1 }, sparse: true, name: "email_index" },
      { key: { type: 1 }, name: "customer_type_index" },
    ]);

    logger.info(`Database indexes created for shop: ${shopId}`);
  } catch (error) {
    logger.error(`Error creating indexes for shop ${shopId}:`, error);
    throw error;
  }
}

/**
 * Health check for database connection
 * @returns {Promise<boolean>} Connection health status
 */
async function healthCheck() {
  try {
    if (!isConnected || !client) {
      return false;
    }

    await client.db("admin").command({ ping: 1 });
    return true;
  } catch (error) {
    logger.error("Database health check failed:", error);
    return false;
  }
}

module.exports = {
  connectToDatabase,
  getShopDatabase,
  getSystemDatabase,
  closeDatabaseConnection,
  getDatabaseStats,
  listAllShops,
  createShopIndexes,
  healthCheck,

  // Legacy compatibility
  connectToMongoDB: connectToDatabase,
  closeConnection: closeDatabaseConnection,
  client: () => client,
};
