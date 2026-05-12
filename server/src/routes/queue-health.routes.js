/**
 * Queue Health Check Routes
 * Provides monitoring endpoints for Bull queues (Email & SMS)
 */

const express = require("express");
const router = express.Router();
const { logger } = require("../config/logging");

/**
 * @swagger
 * /api/queue-health/health:
 *   get:
 *     summary: Get queue health status
 *     description: Check if email and SMS queues are running and healthy. No authentication required (internal monitoring).
 *     tags: [Settings]
 *     responses:
 *       200:
 *         description: Queue health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     email: { type: object, properties: { status: { type: string }, waiting: { type: integer }, active: { type: integer }, failed: { type: integer } } }
 *                     sms: { type: object, properties: { status: { type: string }, waiting: { type: integer }, active: { type: integer }, failed: { type: integer } } }
 *       500: { $ref: '#/components/responses/ServerError' }
 *
 * /api/queue-health/stats:
 *   get:
 *     summary: Get combined queue statistics
 *     description: Retrieve combined statistics for all queues.
 *     tags: [Settings]
 *     responses:
 *       200:
 *         description: Queue statistics retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: object }
 *       500: { $ref: '#/components/responses/ServerError' }
 *
 * /api/queue-health/email/stats:
 *   get:
 *     summary: Get email queue statistics
 *     description: Retrieve detailed statistics for the email processing queue.
 *     tags: [Email]
 *     responses:
 *       200:
 *         description: Email queue stats retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     waiting: { type: integer }
 *                     active: { type: integer }
 *                     completed: { type: integer }
 *                     failed: { type: integer }
 *       500: { $ref: '#/components/responses/ServerError' }
 *
 * /api/queue-health/sms/stats:
 *   get:
 *     summary: Get SMS queue statistics
 *     description: Retrieve detailed statistics for the SMS processing queue.
 *     tags: [SMS]
 *     responses:
 *       200:
 *         description: SMS queue stats retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     waiting: { type: integer }
 *                     active: { type: integer }
 *                     completed: { type: integer }
 *                     failed: { type: integer }
 *       500: { $ref: '#/components/responses/ServerError' }
 */

// Lazy load queue instances to avoid initialization issues
let emailQueue, smsQueue;

function getQueues() {
  if (!emailQueue || !smsQueue) {
    try {
      const EmailQueue = require("../services/email/email.queue");
      const SMSQueue = require("../services/sms/sms.queue");
      
      // Get singleton instances (assuming they're exported as instances)
      // If they're classes, you'll need to adjust this
      emailQueue = new EmailQueue();
      smsQueue = new SMSQueue();
    } catch (error) {
      logger.error("Failed to load queue instances:", error.message);
    }
  }
  return { emailQueue, smsQueue };
}

/**
 * GET /api/queues/health
 * Get health status of all queues
 */
router.get("/health", async (req, res) => {
  try {
    const { emailQueue, smsQueue } = getQueues();

    const health = {
      timestamp: new Date().toISOString(),
      queues: {
        email: emailQueue ? emailQueue.getStatus() : { enabled: false, error: "Queue not initialized" },
        sms: smsQueue ? smsQueue.getStatus() : { enabled: false, error: "Queue not initialized" },
      },
      overall: "unknown",
    };

    // Determine overall health
    const emailHealthy = emailQueue && emailQueue.isHealthy();
    const smsHealthy = smsQueue && smsQueue.isHealthy();

    if (emailHealthy && smsHealthy) {
      health.overall = "healthy";
    } else if (!emailQueue?.isQueueEnabled && !smsQueue?.isQueueEnabled) {
      health.overall = "disabled";
    } else if (emailHealthy || smsHealthy) {
      health.overall = "degraded";
    } else {
      health.overall = "unhealthy";
    }

    const statusCode = health.overall === "healthy" || health.overall === "disabled" ? 200 : 503;

    res.status(statusCode).json({
      success: true,
      data: health,
    });
  } catch (error) {
    logger.error("Queue health check failed:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check queue health",
      error: error.message,
    });
  }
});

/**
 * GET /api/queues/stats
 * Get detailed statistics for all queues
 */
router.get("/stats", async (req, res) => {
  try {
    const { emailQueue, smsQueue } = getQueues();

    const stats = {
      timestamp: new Date().toISOString(),
      email: emailQueue ? await emailQueue.getJobCounts() : { error: "Queue not initialized" },
      sms: smsQueue ? await smsQueue.getStats() : { error: "Queue not initialized" },
    };

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error("Failed to get queue stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get queue statistics",
      error: error.message,
    });
  }
});

/**
 * GET /api/queues/email/stats
 * Get email queue statistics
 */
router.get("/email/stats", async (req, res) => {
  try {
    const { emailQueue } = getQueues();

    if (!emailQueue) {
      return res.status(503).json({
        success: false,
        message: "Email queue not initialized",
      });
    }

    const stats = await emailQueue.getJobCounts();

    res.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        queue: "email",
        status: emailQueue.getStatus(),
        stats,
      },
    });
  } catch (error) {
    logger.error("Failed to get email queue stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get email queue statistics",
      error: error.message,
    });
  }
});

/**
 * GET /api/queues/sms/stats
 * Get SMS queue statistics
 */
router.get("/sms/stats", async (req, res) => {
  try {
    const { smsQueue } = getQueues();

    if (!smsQueue) {
      return res.status(503).json({
        success: false,
        message: "SMS queue not initialized",
      });
    }

    const stats = await smsQueue.getStats();

    res.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        queue: "sms",
        status: smsQueue.getStatus(),
        stats,
      },
    });
  } catch (error) {
    logger.error("Failed to get SMS queue stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get SMS queue statistics",
      error: error.message,
    });
  }
});

module.exports = router;
