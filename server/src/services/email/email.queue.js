// server/src/services/email/email.queue.js
const Queue = require('bull');
const { logger } = require('../../config/logging');

class EmailQueue {
  constructor() {
    this.isQueueEnabled = process.env.ENABLE_QUEUES !== 'false';
    this.queue = null;
    this.redisConnected = false;

    if (this.isQueueEnabled) {
      this.initializeQueue();
    } else {
      logger.warn('Email queue disabled - emails will be sent synchronously');
    }
  }

  /**
   * Initialize Bull queue with Redis connection and graceful fallback
   */
  initializeQueue() {
    try {
      // Parse REDIS_URL if provided (format: redis://:<password>@<host>:<port>)
      const redisUrl = process.env.REDIS_URL;
      let redisConfig;

      if (redisUrl) {
        // Parse Redis URL
        const url = new URL(redisUrl);
        redisConfig = {
          host: url.hostname,
          port: parseInt(url.port, 10) || 6379,
          password: url.password || undefined,
          db: parseInt(url.pathname.slice(1), 10) || 0,
        };
      } else {
        // Use individual environment variables
        redisConfig = {
          host: process.env.REDIS_HOST || '127.0.0.1',
          port: parseInt(process.env.REDIS_PORT, 10) || 6379,
          password: process.env.REDIS_PASSWORD || undefined,
          db: parseInt(process.env.REDIS_DB, 10) || 0,
        };
      }

      // Initialize Bull queue
      this.queue = new Queue('email-queue', {
        redis: redisConfig,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: 100, // Keep last 100 completed jobs
          removeOnFail: 500, // Keep last 500 failed jobs
        },
      });

      // Process jobs
      this.queue.process(async (job) => {
        return await this.processEmailJob(job.data);
      });

      // Event handlers
      this.queue.on('completed', (job) => {
        logger.info(`Email job ${job.id} completed`);
      });

      this.queue.on('failed', (job, err) => {
        logger.error(`Email job ${job.id} failed:`, err.message);
      });

      this.queue.on('error', (error) => {
        logger.error('Email queue error:', error.message);
        this.redisConnected = false;
      });

      this.queue.on('ready', () => {
        logger.info('✅ Email queue connected to Redis');
        this.redisConnected = true;
      });

      // Test Redis connection
      this.queue.isReady().then(() => {
        this.redisConnected = true;
        logger.info('Email queue initialized successfully');
      }).catch((error) => {
        logger.error('Failed to connect to Redis for email queue:', error.message);
        logger.warn('⚠️ Email queue will fall back to synchronous processing');
        this.redisConnected = false;
        this.queue = null;
      });

    } catch (error) {
      logger.error('Error initializing email queue:', error.message);
      logger.warn('⚠️ Email queue disabled - falling back to synchronous processing');
      this.queue = null;
      this.redisConnected = false;
    }
  }

  /**
   * Add an email job to the queue (with graceful fallback)
   * @param {object} emailData - Email job data
   * @param {object} options - Queue options
   * @returns {Promise<Job|any>}
   */
  async addJob(emailData, options = {}) {
    // If queue is available and Redis is connected, use queue
    if (this.queue && this.redisConnected) {
      try {
        return await this.queue.add(emailData, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          ...options,
        });
      } catch (error) {
        logger.error('Failed to add job to email queue:', error.message);
        logger.warn('Falling back to synchronous email processing');
        // Fall through to synchronous processing
      }
    }

    // Fallback: Process email synchronously
    logger.info('Processing email synchronously (queue unavailable)');
    return await this.processEmailJob(emailData);
  }

  /**
   * Process an email job based on type
   * @param {object} data - Job data
   * @returns {Promise<any>}
   */
  async processEmailJob(data) {
    const EmailService = require('./email.service');

    switch (data.type) {
      case 'transactional':
        return await EmailService.sendTransactionalEmail(
          data.to,
          data.templateName,
          data.variables
        );
      case 'invoice':
        return await EmailService.sendInvoice(data.sale, data.customer);
      case 'campaign':
        return await EmailService.sendMarketingCampaign(data.campaignData);
      default:
        throw new Error(`Unknown email job type: ${data.type}`);
    }
  }

  /**
   * Get job counts for monitoring
   * @returns {Promise<object>}
   */
  async getJobCounts() {
    if (!this.queue) {
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        paused: 0,
        message: 'Queue disabled - synchronous processing active',
      };
    }
    return await this.queue.getJobCounts();
  }

  /**
   * Check if queue is healthy
   * @returns {boolean}
   */
  isHealthy() {
    return this.queue !== null && this.redisConnected;
  }

  /**
   * Get queue status
   * @returns {object}
   */
  getStatus() {
    return {
      enabled: this.isQueueEnabled,
      connected: this.redisConnected,
      healthy: this.isHealthy(),
      mode: this.isHealthy() ? 'async' : 'sync',
    };
  }

  /**
   * Close the queue gracefully
   * @returns {Promise<void>}
   */
  async close() {
    if (this.queue) {
      await this.queue.close();
      logger.info('Email queue closed');
    }
  }
}

module.exports = EmailQueue;
