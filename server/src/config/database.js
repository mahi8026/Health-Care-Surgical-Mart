/**
 * Database Configuration - Single MongoDB Database
 * Modified to use one database with shop-prefixed collections
 */

const { MongoClient, ServerApiVersion } = require('mongodb');
const { logger } = require('./logging');

// Connection configuration
const config = {
  uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
  dbName: process.env.DB_NAME || 'Health_Care_DB',
  options: {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
    // Connection pool settings (optimized for multi-tenant workload)
    maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE) || 50, // Increased for concurrent shops
    minPoolSize: parseInt(process.env.DB_MIN_POOL_SIZE) || 10, // Keep warm connections
    maxIdleTimeMS: parseInt(process.env.DB_MAX_IDLE_TIME) || 30000, // Close idle after 30s

    // Connection timeout settings
    connectTimeoutMS: parseInt(process.env.DB_CONNECT_TIMEOUT) || 30000,
    socketTimeoutMS: parseInt(process.env.DB_SOCKET_TIMEOUT) || 60000,
    serverSelectionTimeoutMS:
      parseInt(process.env.DB_SERVER_SELECTION_TIMEOUT) || 5000, // Reduced for faster failover

    // Retry settings
    retryWrites: true,
    retryReads: true,

    // SSL/TLS settings for compatibility
    ssl: true,
    tlsAllowInvalidCertificates: true,
    tlsAllowInvalidHostnames: true,

    // Monitoring
    monitorCommands: process.env.NODE_ENV === 'development',

    // Compression (reduces network bandwidth)
    compressors: ['zlib'],
  },
};

let client = null;
let database = null;
let isConnected = false;

/**
 * Connect to MongoDB Atlas - Single Database
 */
async function connectToDatabase() {
  if (isConnected && client && database) {
    return client;
  }

  try {
    logger.info(`Connecting to MongoDB Atlas database: ${config.dbName}...`);

    client = new MongoClient(config.uri, config.options);

    // Connection event listeners
    client.on('connectionPoolCreated', () => {
      logger.info('MongoDB connection pool created');
    });

    client.on('connectionPoolClosed', () => {
      logger.info('MongoDB connection pool closed');
    });

    client.on('error', (error) => {
      logger.error('MongoDB client error:', error);
    });

    // Connect to the server
    await client.connect();

    // Get the single database instance
    database = client.db(config.dbName);

    // Verify connection
    await database.command({ ping: 1 });

    isConnected = true;
    logger.info(
      `✅ Successfully connected to MongoDB database: ${config.dbName}`,
    );

    // Log connection details
    const admin = client.db().admin();
    const serverStatus = await admin.serverStatus();
    logger.info(`MongoDB version: ${serverStatus.version}`);
    logger.info(`Connection pool size: ${config.options.maxPoolSize}`);

    return client;
  } catch (error) {
    logger.error('❌ MongoDB connection failed:', error.message);
    throw error;
  }
}

/**
 * Get database instance for a specific shop
 * Returns the same database but with shop-prefixed collection names
 * @param {string} shopId - Unique shop identifier
 * @returns {Object} Database wrapper with shop-specific collection access
 */
function getShopDatabase(shopId) {
  if (!isConnected || !client) {
    throw new Error('Database not connected. Call connectToDatabase() first.');
  }

  if (!shopId || typeof shopId !== 'string') {
    throw new Error('Invalid shopId provided');
  }

  // Return shop-specific database (Phase 5A architecture)
  // Each shop has its own database: shop_6a020466789ca874348b2557
  const shopDbName = `shop_${shopId}`;
  const shopDatabase = client.db(shopDbName);

  return shopDatabase;
}

/**
 * Get the system database (for super admin operations)
 * Uses collections without shop prefix for system-wide data
 * @returns {Db} MongoDB database instance
 */
function getSystemDatabase() {
  if (!isConnected || !database) {
    throw new Error('Database not connected. Call connectToDatabase() first.');
  }

  // Return the database directly for system collections
  // System collections: shops, system_users, system_settings, etc.
  return database;
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
    database = null;
    client = null;
    logger.info('Database connection closed gracefully');
  } catch (error) {
    logger.error('Error closing database connection:', error);
    throw error;
  }
}

/**
 * Get database connection status and statistics
 * @returns {Object} Connection status and stats
 */
async function getDatabaseStats() {
  if (!isConnected || !client || !database) {
    return { connected: false };
  }

  try {
    const admin = client.db().admin();
    const serverStatus = await admin.serverStatus();
    const dbStats = await database.stats();

    return {
      connected: true,
      databaseName: config.dbName,
      serverVersion: serverStatus.version,
      uptime: serverStatus.uptime,
      connections: serverStatus.connections,
      collections: dbStats.collections,
      dataSize: dbStats.dataSize,
      storageSize: dbStats.storageSize,
      indexes: dbStats.indexes,
      indexSize: dbStats.indexSize,
    };
  } catch (error) {
    logger.error('Error getting database stats:', error);
    return { connected: false, error: error.message };
  }
}

/**
 * List all shops from the system database
 * @returns {Promise<Array>} List of shop information
 */
async function listAllShops() {
  if (!isConnected || !database) {
    throw new Error('Database not connected');
  }

  try {
    // Get list of shops from system collection
    const shops = await database.collection('shops').find({}).toArray();

    // Get all collections to count shop-specific collections
    const collections = await database.listCollections().toArray();

    return shops
      .map((shop) => {
        // Count collections for this shop
        const shopCollections = collections.filter((col) =>
          col.name.startsWith(`${shop.shopId}_`),
        );

        return {
          shopId: shop.shopId,
          shopName: shop.name,
          status: shop.status,
          collectionsCount: shopCollections.length,
          collections: shopCollections.map((c) => c.name),
        };
      })
      .sort((a, b) => a.shopId.localeCompare(b.shopId));
  } catch (error) {
    logger.error('Error listing shops:', error);
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
    await shopDb.collection('products').createIndexes([
      { key: { sku: 1 }, unique: true, name: 'sku_unique' },
      { key: { name: 1 }, name: 'name_index' },
      { key: { category: 1 }, name: 'category_index' },
      { key: { isActive: 1 }, name: 'active_status_index' },
      { key: { name: 'text', brand: 'text' }, name: 'text_search_index' },
    ]);

    // Sales indexes
    await shopDb.collection('sales').createIndexes([
      { key: { invoiceNo: 1 }, unique: true, name: 'invoice_unique' },
      { key: { saleDate: -1 }, name: 'sale_date_desc' },
      { key: { customerId: 1 }, name: 'customer_index' },
      { key: { createdBy: 1 }, name: 'created_by_index' },
    ]);

    // Stock indexes
    await shopDb.collection('stock').createIndexes([
      { key: { productId: 1 }, unique: true, name: 'product_unique' },
      { key: { isLowStock: 1 }, name: 'low_stock_index' },
      { key: { lastUpdated: -1 }, name: 'last_updated_desc' },
    ]);

    // Customer indexes
    await shopDb.collection('customers').createIndexes([
      { key: { phone: 1 }, name: 'phone_index' },
      { key: { email: 1 }, sparse: true, name: 'email_index' },
      { key: { type: 1 }, name: 'customer_type_index' },
    ]);

    // User indexes
    await shopDb.collection('users').createIndexes([
      { key: { email: 1 }, unique: true, name: 'email_unique' },
      { key: { role: 1 }, name: 'role_index' },
      { key: { isActive: 1 }, name: 'active_status_index' },
    ]);

    // Expense indexes
    await shopDb.collection('expenses').createIndexes([
      { key: { expenseDate: -1 }, name: 'expense_date_desc' },
      { key: { categoryId: 1 }, name: 'category_index' },
      { key: { createdBy: 1 }, name: 'created_by_index' },
    ]);

    logger.info(`Database indexes created for shop: ${shopId}`);
  } catch (error) {
    logger.error(`Error creating indexes for shop ${shopId}:`, error);
    throw error;
  }
}

/**
 * Create system-level indexes
 */
async function createSystemIndexes() {
  try {
    const systemDb = getSystemDatabase();

    // Shops collection indexes
    await systemDb.collection('shops').createIndexes([
      { key: { shopId: 1 }, unique: true, name: 'shopId_unique' },
      { key: { email: 1 }, unique: true, name: 'email_unique' },
      { key: { status: 1 }, name: 'status_index' },
    ]);

    logger.info('System database indexes created');
  } catch (error) {
    logger.error('Error creating system indexes:', error);
    throw error;
  }
}

/**
 * Health check for database connection
 * @returns {Promise<boolean>} Connection health status
 */
async function healthCheck() {
  try {
    if (!isConnected || !database) {
      return false;
    }

    await database.command({ ping: 1 });
    return true;
  } catch (error) {
    logger.error('Database health check failed:', error);
    return false;
  }
}

/**
 * Migrate data from multiple databases to single database
 * This is a utility function for one-time migration
 */
async function migrateToSingleDatabase() {
  logger.info('Starting migration to single database...');

  try {
    const admin = client.db().admin();
    const { databases } = await admin.listDatabases();

    // Find all shop databases (exclude system databases)
    const shopDatabases = databases.filter(
      (db) =>
        ![
          'admin',
          'local',
          'config',
          'Health_Care_DB',
          'medical_store_system',
        ].includes(db.name),
    );

    logger.info(`Found ${shopDatabases.length} shop databases to migrate`);

    for (const dbInfo of shopDatabases) {
      const sourceDb = client.db(dbInfo.name);
      const shopId = dbInfo.name; // Use database name as shopId

      logger.info(`Migrating database: ${dbInfo.name}`);

      // Get all collections from source database
      const collections = await sourceDb.listCollections().toArray();

      for (const collInfo of collections) {
        const collectionName = collInfo.name;
        const sourceCollection = sourceDb.collection(collectionName);
        const targetCollectionName = `${shopId}_${collectionName}`;
        const targetCollection = database.collection(targetCollectionName);

        // Get all documents
        const documents = await sourceCollection.find({}).toArray();

        if (documents.length > 0) {
          // Insert into target collection
          await targetCollection.insertMany(documents);
          logger.info(
            `Migrated ${documents.length} documents from ${dbInfo.name}.${collectionName} to ${targetCollectionName}`,
          );
        }
      }
    }

    logger.info('✅ Migration completed successfully!');
    return { success: true, migratedDatabases: shopDatabases.length };
  } catch (error) {
    logger.error('❌ Migration failed:', error);
    throw error;
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
  createSystemIndexes,
  healthCheck,
  migrateToSingleDatabase,

  // Legacy compatibility
  connectToMongoDB: connectToDatabase,
  closeConnection: closeDatabaseConnection,
  client: () => client,
  database: () => database,
};
