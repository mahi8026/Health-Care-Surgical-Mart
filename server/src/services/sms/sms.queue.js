// server/src/services/sms/sms.queue.js
const Queue = require('bull');
const { logger } = require('../../config/logging');

class SMSQueue {
  constructor() {
    this.isQueueEnabled = process.env.ENABLE_QUEUES !== 'false';
    this.queue = null;
    this.redisConnected = false;

    if (this.isQueueEnabled) {
      this.initializeQueue();
    } else {
      logger.warn('SMS queue disabled - SMS will be sent synchronously');
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
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT, 10) || 6379,
          password: process.env.REDIS_PASSWORD || undefined,
          db: parseInt(process.env.REDIS_DB, 10) || 0,
        };
      }

      // Initialize Bull queue
      this.queue = new Queue('sms-queue', {
        redis: redisConfig,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: 100, // Keep last 100 completed jobs
          removeOnFail: 500, // Keep last 500 failed jobs
        },
      });

      this.setupWorker();

      // Event handlers
      this.queue.on('error', (error) => {
        logger.error('SMS queue error:', error.message);
        this.redisConnected = false;
      });

      this.queue.on('ready', () => {
        logger.info('? SMS queue connected to Redis');
        this.redisConnected = true;
      });

      // Test Redis connection
      this.queue.isReady().then(() => {
        this.redisConnected = true;
        logger.info('SMS queue initialized successfully');
      }).catch((error) => {
        logger.error('Failed to connect to Redis for SMS queue:', error.message);
        logger.warn('?? SMS queue will fall back to synchronous processing');
        this.redisConnected = false;
        this.queue = null;
      });

    } catch (error) {
      logger.error('Error initializing SMS queue:', error.message);
      logger.warn('?? SMS queue disabled - falling back to synchronous processing');
      this.queue = null;
      this.redisConnected = false;
    }
  }

  setupWorker() {
    if (!this.queue) {return;}

    // Lazy require to avoid circular dependency (SMSService -> SMSQueue -> SMSService)
    this.queue.process(async (job) => {
      const { to, message, options } = job.data;
      const SMSService = require('./sms.service');
      return await SMSService.send(to, message, options);
    });

    this.queue.on('completed', (job, _result) => {
      logger.info(`SMS job ${job.id} completed successfully`);
    });

    this.queue.on('failed', (job, error) => {
      logger.error(`SMS job ${job.id} failed:`, error.message);
    });
  }

  /**
   * Add SMS job to queue (with graceful fallback)
   * @param {object} smsData - SMS job data
   * @returns {Promise<Job|any>}
   */
  async add(smsData) {
    // If queue is available and Redis is connected, use queue
    if (this.queue && this.redisConnected) {
      try {
        return await this.queue.add(smsData, {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        });
      } catch (error) {
        logger.error('Failed to add job to SMS queue:', error.message);
        logger.warn('Falling back to synchronous SMS processing');
        // Fall through to synchronous processing
      }
    }

    // Fallback: Process SMS synchronously
    logger.info('Processing SMS synchronously (queue unavailable)');
    const { to, message, options } = smsData;
    const SMSService = require('./sms.service');
    return await SMSService.send(to, message, options);
  }

  /**
   * Add multiple SMS jobs to queue (with graceful fallback)
   * @param {Array} smsArray - Array of SMS job data
   * @returns {Promise<Array>}
   */
  async addBulk(smsArray) {
    // If queue is available and Redis is connected, use queue
    if (this.queue && this.redisConnected) {
      try {
        const jobs = smsArray.map((sms) => ({
          data: sms,
          opts: {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
          },
        }));

        return await this.queue.addBulk(jobs);
      } catch (error) {
        logger.error('Failed to add bulk jobs to SMS queue:', error.message);
        logger.warn('Falling back to synchronous SMS processing');
        // Fall through to synchronous processing
      }
    }

    // Fallback: Process all SMS synchronously
    logger.info(`Processing ${smsArray.length} SMS synchronously (queue unavailable)`);
    const SMSService = require('./sms.service');
    const results = [];

    for (const smsData of smsArray) {
      try {
        const { to, message, options } = smsData;
        const result = await SMSService.send(to, message, options);
        results.push(result);
      } catch (error) {
        logger.error(`Failed to send SMS to ${smsData.to}:`, error.message);
        results.push({ success: false, error: error.message });
      }
    }

    return results;
  }

  /**
   * Get queue statistics
   * @returns {Promise<object>}
   */
  async getStats() {
    if (!this.queue) {
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        message: 'Queue disabled - synchronous processing active',
      };
    }

    try {
      const [waiting, active, completed, failed] = await Promise.all([
        this.queue.getWaitingCount(),
        this.queue.getActiveCount(),
        this.queue.getCompletedCount(),
        this.queue.getFailedCount(),
      ]);

      return { waiting, active, completed, failed };
    } catch (error) {
      logger.error('Failed to get SMS queue stats:', error.message);
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        error: error.message,
      };
    }
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
      logger.info('SMS queue closed');
    }
  }
}

module.exports = SMSQueue;
