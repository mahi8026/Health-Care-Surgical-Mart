/**
 * Keep-Alive Service
 * Pings the server's own health endpoint every 10 minutes to prevent
 * Render free-tier cold starts (service sleeps after 15 min of inactivity).
 */

const cron = require('node-cron');
const { logger } = require('../config/logging');

let keepAliveJob = null;

/**
 * Start the keep-alive cron job.
 * Only runs in production to avoid noise in development.
 */
function startKeepAlive() {
  if (process.env.NODE_ENV !== 'production') {
    logger.info('Keep-alive service skipped (not production)');
    return;
  }

  // Derive the server's own base URL
  const baseUrl =
    process.env.RENDER_EXTERNAL_URL ||  // Render sets this automatically
    process.env.APP_URL ||
    `http://localhost:${process.env.PORT || 5000}`;

  const healthUrl = `${baseUrl}/health`;

  logger.info(`Keep-alive service started → pinging ${healthUrl} every 10 minutes`);

  // Run every 10 minutes: at minutes 0, 10, 20, 30, 40, 50 of every hour
  keepAliveJob = cron.schedule('*/10 * * * *', async () => {
    try {
      const fetch = (...args) =>
        import('node-fetch').then(({ default: f }) => f(...args));

      const res = await fetch(healthUrl, {
        method: 'GET',
        timeout: 10000,
      });

      if (res.ok) {
        logger.debug(`Keep-alive ping OK (${res.status})`);
      } else {
        logger.warn(`Keep-alive ping returned ${res.status}`);
      }
    } catch (err) {
      logger.warn('Keep-alive ping failed:', { error: err.message });
    }
  });
}

/**
 * Stop the keep-alive cron job gracefully.
 */
function stopKeepAlive() {
  if (keepAliveJob) {
    keepAliveJob.stop();
    keepAliveJob = null;
    logger.info('Keep-alive service stopped');
  }
}

module.exports = { startKeepAlive, stopKeepAlive };
