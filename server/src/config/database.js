/**
 * Database Configuration - Single MongoDB Database
 * Modified to use one database with shop-prefixed collections
 */

const { MongoClient, ServerApiVersion } = require('mongodb');
const { logger } = require('./logging');

// TLS is required for Atlas (mongodb+srv:// or ?ssl=true) but not for local/CI MongoDB
function requiresTls(uri) {
  return Boolean(
    uri &&
      (uri.startsWith('mongodb+srv://') || /\?.*ssl=true(&|$)/.test(uri)),
  );
}

// Connection configuration
const config = {
  uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
  dbName: process.env.DB_NAME || 'Health_Care_DB',
  options: {
    serverApi: {
      version: ServerApiVersion.v1,
      // Non-strict: Atlas still gets the Stable API handshake, but commands like
      // serverStatus and text-index creation remain allowed on any deployment
      strict: false,
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

    // SSL/TLS settings — only for Atlas URIs (mongodb+srv:// or ?ssl=true)
    ssl: requiresTls(process.env.MONGODB_URI),
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
    logger.info(`Connecting to MongoDB database: ${config.dbName}...`);

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

    // Log connection details (best-effort — serverStatus is not in Stable API v1, so it can fail on some deployments)
    try {
      const admin = client.db().admin();
      const serverStatus = await admin.serverStatus();
      logger.info(`MongoDB version: ${serverStatus.version}`);
    } catch (statusError) {
      logger.debug('MongoDB serverStatus unavailable:', statusError.message);
    }
    logger.info(`Connection pool size: ${config.options.maxPoolSize}`);

    return client;
  } catch (error) {
    logger.error('❌ MongoDB connection failed:', error.message);
    throw error;
  }
}

/**
 * Default application database (single-tenant production data).
 * Used as a last-resort fallback so the app keeps working even if the
 * SHOP_DB_NAME / SHOP_ID env vars are missing on a host (e.g. Render before
 * the dashboard env is set). Precedence is:
 *   1. SHOP_DB_NAME  (exact database name)
 *   2. SHOP_ID env (or the legacy shopId argument)  → client.db(`shop_<id>`)
 *   3. This constant
 */
const DEFAULT_APP_DB_NAME =
  process.env.DEFAULT_SHOP_DB_NAME || 'shop_6a020466789ca874348b2557';

/**
 * Get the application database.
 *
 * Single-tenant mode: the whole application serves ONE shop, so every caller
 * resolves to the same database.
 *   - SHOP_DB_NAME (e.g. "shop_6a020466789ca874348b2557") pins the exact
 *     database name (production).
 *   - Otherwise SHOP_ID (e.g. "shop_6a020466789ca874348b2557") selects the DB
 *     using the legacy shop_<id> naming (tests / local single-shop dev).
 *   - Otherwise falls back to the DEFAULT_APP_DB_NAME pin so deployments that
 *     forgot to set the env still serve the single production shop.
 *
 * @param {string} shopId - Ignored in single-tenant mode; kept only for
 *   backward-compatible call sites.
 * @returns {Object} The application database instance
 */
function getShopDatabase(shopId) {
  if (!isConnected || !client) {
    throw new Error('Database not connected. Call connectToDatabase() first.');
  }

  const pinnedDbName = process.env.SHOP_DB_NAME;
  if (pinnedDbName) {
    return client.db(pinnedDbName);
  }

  const effectiveShopId = process.env.SHOP_ID || shopId;
  if (effectiveShopId && typeof effectiveShopId === 'string') {
    return client.db(`shop_${effectiveShopId}`);
  }

  logger.warn(
    'SHOP_DB_NAME / SHOP_ID not set — falling back to default app database',
    { dbName: DEFAULT_APP_DB_NAME }
  );
  return client.db(DEFAULT_APP_DB_NAME);
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
 * Track which shops already had their indexes verified in this process,
 * so we don't re-run ~11 createIndexes commands on every request.
 */
const shopIndexesEnsured = new Set();
const shopIndexesInFlight = new Map();

/**
 * Ensure shop indexes exist, at most once per shop per process.
 *
 * Resolves the target shop key the same way getShopDatabase() does
 * (SHOP_DB_NAME → SHOP_ID → shopId arg → default app DB), then creates
 * indexes only if this process hasn't verified them yet. Concurrent
 * callers share a single in-flight promise, and failures are retried on
 * the next call instead of being cached.
 *
 * @param {string} [shopId] - Legacy shop identifier (ignored when SHOP_DB_NAME/SHOP_ID are set)
 * @returns {Promise<void>}
 */
function ensureShopIndexes(shopId) {
  const key =
    process.env.SHOP_DB_NAME ||
    process.env.SHOP_ID ||
    shopId ||
    DEFAULT_APP_DB_NAME;

  if (shopIndexesEnsured.has(key)) {
    return Promise.resolve();
  }

  if (shopIndexesInFlight.has(key)) {
    return shopIndexesInFlight.get(key);
  }

  const pending = createShopIndexes(key)
    .then(() => {
      shopIndexesEnsured.add(key);
      shopIndexesInFlight.delete(key);
    })
    .catch((error) => {
      shopIndexesInFlight.delete(key);
      throw error;
    });

  shopIndexesInFlight.set(key, pending);
  return pending;
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
  ensureShopIndexes,
  createSystemIndexes,
  healthCheck,
  migrateToSingleDatabase,

  // Legacy compatibility
  connectToMongoDB: connectToDatabase,
  closeConnection: closeDatabaseConnection,
  client: () => client,
  database: () => database,
};
