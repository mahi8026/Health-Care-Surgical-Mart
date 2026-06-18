/**
 * Server-Sent Events (SSE) Manager
 * 
 * Manages real-time stock update broadcasts to connected clients
 * - Maintains shop-specific client connections
 * - Broadcasts stock updates to all clients in a shop
 * - Handles connection lifecycle (connect, heartbeat, disconnect)
 * - Works seamlessly across Firebase Hosting ↔ Render deployment
 * 
 * Why SSE over WebSockets:
 * - Works with Firebase Hosting without additional config
 * - One-directional (server → client) is all we need
 * - Native browser support (EventSource API)
 * - Auto-reconnects on disconnect
 * - No additional libraries required
 * - Works on Render free tier
 */

const { logger } = require('../config/logging');

class SSEManager {
  constructor() {
    // Map: shopId → Set of response objects
    this.clients = new Map();
    
    // Connection statistics
    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      messagesSent: 0,
    };
  }

  /**
   * Add a new SSE client
   * 
   * @param {string} shopId - Shop identifier
   * @param {Response} res - Express response object
   */
  addClient(shopId, res) {
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Important for Nginx/proxies
      'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
    });

    // Send initial connection confirmation
    this.sendEvent(res, {
      type: 'CONNECTED',
      shopId,
      timestamp: new Date().toISOString(),
      message: 'Real-time stock updates connected',
    });

    // Add client to shop's client set
    if (!this.clients.has(shopId)) {
      this.clients.set(shopId, new Set());
    }
    this.clients.get(shopId).add(res);

    // Update statistics
    this.stats.totalConnections++;
    this.stats.activeConnections++;

    logger.info(`SSE client connected`, {
      shopId,
      activeConnections: this.stats.activeConnections,
    });

    // Heartbeat to prevent connection timeout
    // Send every 30 seconds to keep connection alive
    const heartbeatInterval = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch (error) {
        // Connection closed, stop heartbeat
        clearInterval(heartbeatInterval);
      }
    }, 30000);

    // Cleanup on client disconnect
    res.on('close', () => {
      clearInterval(heartbeatInterval);
      
      const shopClients = this.clients.get(shopId);
      if (shopClients) {
        shopClients.delete(res);
        
        // Remove shop entry if no more clients
        if (shopClients.size === 0) {
          this.clients.delete(shopId);
        }
      }

      this.stats.activeConnections--;

      logger.info(`SSE client disconnected`, {
        shopId,
        activeConnections: this.stats.activeConnections,
      });
    });

    // Handle errors
    res.on('error', (error) => {
      logger.error('SSE connection error:', error);
      clearInterval(heartbeatInterval);
    });
  }

  /**
   * Broadcast an event to all clients in a shop
   * 
   * @param {string} shopId - Shop identifier
   * @param {Object} data - Event data to broadcast
   */
  broadcast(shopId, data) {
    const shopClients = this.clients.get(shopId);
    
    if (!shopClients || shopClients.size === 0) {
      return; // No clients connected for this shop
    }

    const payload = {
      ...data,
      timestamp: new Date().toISOString(),
    };

    logger.debug(`Broadcasting to ${shopClients.size} clients in ${shopId}`, {
      eventType: data.type,
    });

    // Send to all clients in the shop
    for (const client of shopClients) {
      try {
        this.sendEvent(client, payload);
        this.stats.messagesSent++;
      } catch (error) {
        logger.error('Failed to send SSE event to client:', error);
        // Client will be cleaned up by 'close' event handler
      }
    }
  }

  /**
   * Send an event to a specific client
   * 
   * @param {Response} res - Express response object
   * @param {Object} data - Event data
   */
  sendEvent(res, data) {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    res.write(message);
  }

  /**
   * Handle new SSE connection
   * Express route handler
   * 
   * @param {Request} req - Express request object
   * @param {Response} res - Express response object
   */
  handleConnection(req, res) {
    const { shopId } = req.user;
    
    if (!shopId) {
      res.status(403).json({
        success: false,
        message: 'Shop context required for stock events',
      });
      return;
    }

    this.addClient(shopId, res);
  }

  /**
   * Broadcast stock update event
   * 
   * @param {string} shopId
   * @param {string} productId
   * @param {Object} snapshot
   */
  broadcastStockUpdate(shopId, productId, snapshot) {
    this.broadcast(shopId, {
      type: 'STOCK_UPDATE',
      productId: productId.toString(),
      onHandQty: snapshot.onHandQty,
      availableQty: snapshot.availableQty,
      reservedQty: snapshot.reservedQty,
      lastMovementType: snapshot.lastMovementType,
      updatedAt: snapshot.updatedAt,
    });
  }

  /**
   * Broadcast batch expiry alert
   * 
   * @param {string} shopId
   * @param {Object} batch
   */
  broadcastExpiryAlert(shopId, batch) {
    this.broadcast(shopId, {
      type: 'EXPIRY_ALERT',
      batchId: batch._id.toString(),
      productId: batch.productId.toString(),
      batchNo: batch.batchNo,
      expiryDate: batch.expiryDate,
      quantity: batch.quantity,
    });
  }

  /**
   * Broadcast low stock alert
   * 
   * @param {string} shopId
   * @param {Object} snapshot
   */
  broadcastLowStockAlert(shopId, snapshot) {
    this.broadcast(shopId, {
      type: 'LOW_STOCK_ALERT',
      productId: snapshot.productId.toString(),
      productName: snapshot.productName,
      availableQty: snapshot.availableQty,
      reorderPoint: snapshot.reorderPoint,
    });
  }

  /**
   * Get connection statistics
   * 
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      ...this.stats,
      shopConnections: Array.from(this.clients.entries()).map(([shopId, clients]) => ({
        shopId,
        clientCount: clients.size,
      })),
    };
  }

  /**
   * Close all connections (for graceful shutdown)
   */
  closeAll() {
    logger.info('Closing all SSE connections...');
    
    for (const [shopId, clients] of this.clients.entries()) {
      for (const client of clients) {
        try {
          this.sendEvent(client, {
            type: 'SERVER_SHUTDOWN',
            message: 'Server is shutting down. Will reconnect automatically.',
          });
          client.end();
        } catch (error) {
          // Ignore errors during shutdown
        }
      }
    }
    
    this.clients.clear();
    this.stats.activeConnections = 0;
    
    logger.info('All SSE connections closed');
  }
}

// Export singleton instance
const sseManager = new SSEManager();

// Graceful shutdown handling
process.on('SIGTERM', () => {
  sseManager.closeAll();
});

process.on('SIGINT', () => {
  sseManager.closeAll();
});

module.exports = sseManager;
