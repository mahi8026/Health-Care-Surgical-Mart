// server/src/services/sms/sms.queue.js
const Queue = require("bull");

class SMSQueue {
  constructor() {
    this.queue = new Queue("sms", {
      redis: {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT, 10) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
      },
    });

    this.setupWorker();
  }

  setupWorker() {
    // Lazy require to avoid circular dependency (SMSService -> SMSQueue -> SMSService)
    this.queue.process(async (job) => {
      const { to, message, options } = job.data;
      const SMSService = require("./sms.service");
      return await SMSService.send(to, message, options);
    });

    this.queue.on("completed", (job, result) => {
      console.log(`SMS job ${job.id} completed successfully`);
    });

    this.queue.on("failed", (job, error) => {
      console.error(`SMS job ${job.id} failed:`, error.message);
    });
  }

  async add(smsData) {
    return await this.queue.add(smsData, {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
    });
  }

  async addBulk(smsArray) {
    const jobs = smsArray.map((sms) => ({
      data: sms,
      opts: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
      },
    }));

    return await this.queue.addBulk(jobs);
  }

  async getStats() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
    ]);

    return { waiting, active, completed, failed };
  }
}

module.exports = SMSQueue;
