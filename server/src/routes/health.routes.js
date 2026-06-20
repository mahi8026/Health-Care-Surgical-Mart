/**
 * Health Check Routes
 * Comprehensive health monitoring endpoints
 */

const express = require('express');
const router = express.Router();
const { healthCheck } = require('../config/database');
const {
  comprehensiveHealthCheck,
  getSlowQueries,
  monitorConnectionPool,
  getDatabaseSizeBreakdown
} = require('../utils/database-health');
const { authenticate } = require('../middleware/auth-multi-tenant');
const { requirePermission } = require('../utils/rbac');

/**
 * @route GET /health
 * @desc Basic health check (public)
 * @access Public
 */
router.get('/', async (req, res) => {
  try {
    const isHealthy = await healthCheck();

    if (isHealthy) {
      res.status(200).json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV
      });
    } else {
      res.status(503).json({
        success: false,
        status: 'unhealthy',
        message: 'Database connection failed',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route GET /health/detailed
 * @desc Comprehensive health check with metrics
 * @access Private (Admin only)
 */
router.get('/detailed', authenticate, requirePermission('VIEW_SETTINGS'), async (req, res) => {
  try {
    const healthData = await comprehensiveHealthCheck();

    res.status(healthData.healthy ? 200 : 503).json({
      success: healthData.healthy,
      ...healthData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route GET /health/database
 * @desc Database-specific health metrics
 * @access Private (Admin only)
 */
router.get('/database', authenticate, requirePermission('VIEW_SETTINGS'), async (req, res) => {
  try {
    const [healthData, connectionPool, sizeBreakdown] = await Promise.all([
      comprehensiveHealthCheck(),
      monitorConnectionPool(),
      getDatabaseSizeBreakdown()
    ]);

    res.json({
      success: true,
      database: {
        healthy: healthData.healthy,
        healthScore: healthData.healthScore,
        metrics: healthData.metrics.database,
        connectionPool,
        sizeBreakdown,
        warnings: healthData.warnings
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /health/slow-queries
 * @desc Get list of slow queries
 * @access Private (Admin only)
 */
router.get('/slow-queries', authenticate, requirePermission('VIEW_SETTINGS'), async (req, res) => {
  try {
    const threshold = parseInt(req.query.threshold) || 100; // milliseconds
    const slowQueries = await getSlowQueries(threshold);

    res.json({
      success: true,
      threshold,
      count: slowQueries.length,
      queries: slowQueries
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /health/connection-pool
 * @desc Monitor connection pool health
 * @access Private (Admin only)
 */
router.get('/connection-pool', authenticate, requirePermission('VIEW_SETTINGS'), async (req, res) => {
  try {
    const poolMetrics = await monitorConnectionPool();

    res.json({
      success: true,
      ...poolMetrics
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
