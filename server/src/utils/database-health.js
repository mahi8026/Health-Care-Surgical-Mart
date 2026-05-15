/**
 * Database Health Monitoring and Optimization
 * Provides comprehensive database health checks and performance monitoring
 */

const { client: getMongoClient, database: getDatabase } = require('../config/database');
const { logger } = require('../config/logging');

/**
 * Comprehensive database health check
 * @returns {Promise<Object>} Health status with detailed metrics
 */
async function comprehensiveHealthCheck() {
  const mongoClient = getMongoClient();
  const database = getDatabase();

  if (!mongoClient || !database) {
    return {
      healthy: false,
      error: 'Database not connected',
      timestamp: new Date().toISOString()
    };
  }

  try {
    const startTime = Date.now();

    // 1. Basic ping test
    await database.command({ ping: 1 });
    const pingTime = Date.now() - startTime;

    // 2. Get server status
    const admin = mongoClient.db().admin();
    const serverStatus = await admin.serverStatus();

    // 3. Get database stats
    const dbStats = await database.stats();

    // 4. Check connection pool
    const connectionStatus = {
      current: serverStatus.connections.current,
      available: serverStatus.connections.available,
      totalCreated: serverStatus.connections.totalCreated,
      active: serverStatus.connections.active || 0
    };

    // 5. Check replica set status (if applicable)
    let replicaSetStatus = null;
    try {
      replicaSetStatus = await admin.command({ replSetGetStatus: 1 });
    } catch (err) {
      // Not a replica set or not authorized
      replicaSetStatus = { error: 'Not a replica set or not authorized' };
    }

    // 6. Check operation counters
    const opcounters = serverStatus.opcounters;

    // 7. Check memory usage
    const memory = {
      resident: serverStatus.mem.resident,
      virtual: serverStatus.mem.virtual,
      mapped: serverStatus.mem.mapped || 0,
      mappedWithJournal: serverStatus.mem.mappedWithJournal || 0
    };

    // 8. Check network metrics
    const network = {
      bytesIn: serverStatus.network.bytesIn,
      bytesOut: serverStatus.network.bytesOut,
      numRequests: serverStatus.network.numRequests
    };

    // 9. Calculate health score
    const healthScore = calculateHealthScore({
      pingTime,
      connectionStatus,
      memory,
      dbStats
    });

    return {
      healthy: healthScore >= 70,
      healthScore,
      timestamp: new Date().toISOString(),
      metrics: {
        ping: {
          responseTime: pingTime,
          status: pingTime < 100 ? 'excellent' : pingTime < 500 ? 'good' : 'slow'
        },
        server: {
          version: serverStatus.version,
          uptime: serverStatus.uptime,
          uptimeEstimate: serverStatus.uptimeEstimate
        },
        connections: connectionStatus,
        database: {
          name: dbStats.db,
          collections: dbStats.collections,
          dataSize: dbStats.dataSize,
          storageSize: dbStats.storageSize,
          indexes: dbStats.indexes,
          indexSize: dbStats.indexSize,
          avgObjSize: dbStats.avgObjSize
        },
        operations: {
          insert: opcounters.insert,
          query: opcounters.query,
          update: opcounters.update,
          delete: opcounters.delete,
          getmore: opcounters.getmore,
          command: opcounters.command
        },
        memory,
        network,
        replicaSet: replicaSetStatus.error ? null : {
          name: replicaSetStatus.set,
          members: replicaSetStatus.members?.length || 0,
          primary: replicaSetStatus.members?.find(m => m.stateStr === 'PRIMARY')?.name || 'unknown'
        }
      },
      warnings: generateHealthWarnings({
        pingTime,
        connectionStatus,
        memory,
        dbStats
      })
    };
  } catch (error) {
    logger.error('Database health check failed:', error);
    return {
      healthy: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Calculate overall health score (0-100)
 */
function calculateHealthScore(metrics) {
  let score = 100;

  // Deduct points for slow ping
  if (metrics.pingTime > 500) score -= 20;
  else if (metrics.pingTime > 200) score -= 10;
  else if (metrics.pingTime > 100) score -= 5;

  // Deduct points for connection pool issues
  const connectionUtilization = metrics.connectionStatus.current / 
    (metrics.connectionStatus.current + metrics.connectionStatus.available);
  
  if (connectionUtilization > 0.9) score -= 20;
  else if (connectionUtilization > 0.7) score -= 10;

  // Deduct points for high memory usage
  if (metrics.memory.resident > 2000) score -= 15; // > 2GB
  else if (metrics.memory.resident > 1000) score -= 5; // > 1GB

  // Deduct points for large database size without indexes
  const indexRatio = metrics.dbStats.indexSize / metrics.dbStats.dataSize;
  if (indexRatio < 0.05 && metrics.dbStats.dataSize > 1000000) score -= 10;

  return Math.max(0, Math.min(100, score));
}

/**
 * Generate health warnings
 */
function generateHealthWarnings(metrics) {
  const warnings = [];

  if (metrics.pingTime > 500) {
    warnings.push('High database latency detected (>500ms)');
  }

  const connectionUtilization = metrics.connectionStatus.current / 
    (metrics.connectionStatus.current + metrics.connectionStatus.available);
  
  if (connectionUtilization > 0.9) {
    warnings.push('Connection pool nearly exhausted (>90% utilization)');
  }

  if (metrics.memory.resident > 2000) {
    warnings.push('High memory usage (>2GB)');
  }

  const indexRatio = metrics.dbStats.indexSize / metrics.dbStats.dataSize;
  if (indexRatio < 0.05 && metrics.dbStats.dataSize > 1000000) {
    warnings.push('Low index-to-data ratio - consider adding indexes');
  }

  if (metrics.dbStats.dataSize > 1000000000) { // 1GB
    warnings.push('Large database size - consider archiving old data');
  }

  return warnings;
}

/**
 * Monitor slow queries
 * @param {number} thresholdMs - Threshold in milliseconds
 * @returns {Promise<Array>} List of slow queries
 */
async function getSlowQueries(thresholdMs = 100) {
  const mongoClient = getMongoClient();
  
  if (!mongoClient) {
    throw new Error('Database not connected');
  }

  try {
    const admin = mongoClient.db().admin();
    const currentOps = await admin.command({
      currentOp: 1,
      $all: true,
      secs_running: { $gte: thresholdMs / 1000 }
    });

    return currentOps.inprog.map(op => ({
      opid: op.opid,
      operation: op.op,
      namespace: op.ns,
      duration: op.secs_running,
      query: op.command,
      client: op.client
    }));
  } catch (error) {
    logger.error('Failed to get slow queries:', error);
    return [];
  }
}

/**
 * Get index usage statistics
 * @param {string} shopId - Shop identifier
 * @returns {Promise<Object>} Index usage stats
 */
async function getIndexStats(shopId) {
  const { getShopDatabase } = require('../config/database');
  const shopDb = getShopDatabase(shopId);

  const collections = ['products', 'sales', 'customers', 'stock', 'expenses'];
  const stats = {};

  for (const collectionName of collections) {
    try {
      const collection = shopDb.collection(collectionName);
      const indexStats = await collection.aggregate([
        { $indexStats: {} }
      ]).toArray();

      stats[collectionName] = indexStats.map(stat => ({
        name: stat.name,
        usageCount: stat.accesses.ops,
        since: stat.accesses.since
      }));
    } catch (error) {
      logger.error(`Failed to get index stats for ${collectionName}:`, error);
      stats[collectionName] = [];
    }
  }

  return stats;
}

/**
 * Optimize database by rebuilding indexes
 * @param {string} shopId - Shop identifier
 * @returns {Promise<Object>} Optimization results
 */
async function optimizeDatabase(shopId) {
  const { getShopDatabase } = require('../config/database');
  const shopDb = getShopDatabase(shopId);

  const collections = ['products', 'sales', 'customers', 'stock', 'expenses'];
  const results = {};

  for (const collectionName of collections) {
    try {
      const collection = shopDb.collection(collectionName);
      
      // Reindex collection
      await collection.reIndex();
      
      // Get collection stats
      const stats = await collection.stats();
      
      results[collectionName] = {
        success: true,
        documentsCount: stats.count,
        storageSize: stats.storageSize,
        indexCount: stats.nindexes,
        totalIndexSize: stats.totalIndexSize
      };
    } catch (error) {
      logger.error(`Failed to optimize ${collectionName}:`, error);
      results[collectionName] = {
        success: false,
        error: error.message
      };
    }
  }

  return results;
}

/**
 * Check for missing indexes
 * @param {string} shopId - Shop identifier
 * @returns {Promise<Array>} List of recommended indexes
 */
async function checkMissingIndexes(shopId) {
  const { getShopDatabase } = require('../config/database');
  const shopDb = getShopDatabase(shopId);

  const recommendations = [];

  // Expected indexes for each collection
  const expectedIndexes = {
    products: ['sku', 'name', 'category', 'isActive'],
    sales: ['invoiceNo', 'saleDate', 'customerId', 'createdBy'],
    customers: ['phone', 'email', 'type'],
    stock: ['productId', 'isLowStock', 'lastUpdated'],
    expenses: ['expenseDate', 'categoryId', 'createdBy'],
    users: ['email', 'role', 'isActive']
  };

  for (const [collectionName, expectedFields] of Object.entries(expectedIndexes)) {
    try {
      const collection = shopDb.collection(collectionName);
      const indexes = await collection.indexes();
      const indexedFields = indexes.map(idx => Object.keys(idx.key)[0]);

      for (const field of expectedFields) {
        if (!indexedFields.includes(field)) {
          recommendations.push({
            collection: collectionName,
            field,
            reason: `Missing index on frequently queried field: ${field}`,
            command: `db.${shopId}_${collectionName}.createIndex({ ${field}: 1 })`
          });
        }
      }
    } catch (error) {
      logger.error(`Failed to check indexes for ${collectionName}:`, error);
    }
  }

  return recommendations;
}

/**
 * Get database size breakdown
 * @returns {Promise<Object>} Size breakdown by collection
 */
async function getDatabaseSizeBreakdown() {
  const database = getDatabase();
  
  if (!database) {
    throw new Error('Database not connected');
  }

  try {
    const collections = await database.listCollections().toArray();
    const breakdown = [];

    for (const collInfo of collections) {
      const collection = database.collection(collInfo.name);
      const stats = await collection.stats();

      breakdown.push({
        name: collInfo.name,
        count: stats.count,
        size: stats.size,
        storageSize: stats.storageSize,
        avgObjSize: stats.avgObjSize,
        indexCount: stats.nindexes,
        totalIndexSize: stats.totalIndexSize
      });
    }

    // Sort by size descending
    breakdown.sort((a, b) => b.storageSize - a.storageSize);

    return {
      collections: breakdown,
      totalSize: breakdown.reduce((sum, col) => sum + col.storageSize, 0),
      totalIndexSize: breakdown.reduce((sum, col) => sum + col.totalIndexSize, 0),
      totalDocuments: breakdown.reduce((sum, col) => sum + col.count, 0)
    };
  } catch (error) {
    logger.error('Failed to get database size breakdown:', error);
    throw error;
  }
}

/**
 * Monitor connection pool health
 * @returns {Promise<Object>} Connection pool metrics
 */
async function monitorConnectionPool() {
  const mongoClient = getMongoClient();
  
  if (!mongoClient) {
    throw new Error('Database not connected');
  }

  try {
    const admin = mongoClient.db().admin();
    const serverStatus = await admin.serverStatus();

    const connections = serverStatus.connections;
    const utilization = connections.current / (connections.current + connections.available);

    return {
      current: connections.current,
      available: connections.available,
      totalCreated: connections.totalCreated,
      active: connections.active || 0,
      utilization: Math.round(utilization * 100),
      status: utilization > 0.9 ? 'critical' : utilization > 0.7 ? 'warning' : 'healthy',
      recommendation: utilization > 0.9 
        ? 'Consider increasing DB_MAX_POOL_SIZE in environment variables'
        : utilization > 0.7
        ? 'Monitor connection pool usage closely'
        : 'Connection pool is healthy'
    };
  } catch (error) {
    logger.error('Failed to monitor connection pool:', error);
    throw error;
  }
}

module.exports = {
  comprehensiveHealthCheck,
  getSlowQueries,
  getIndexStats,
  optimizeDatabase,
  checkMissingIndexes,
  getDatabaseSizeBreakdown,
  monitorConnectionPool
};
