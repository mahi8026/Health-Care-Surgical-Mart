// server/src/queues/sms.worker.js
// Standalone worker script — run separately to process SMS queue jobs.
// Usage: node server/src/queues/sms.worker.js

const SMSQueue = require('../services/sms/sms.queue');
const { logger } = require('../config/logging');

const worker = new SMSQueue();

logger.info('SMS worker started, waiting for jobs...', {
  file: 'sms.worker.js',
  function: 'startup',
});

async function shutdown(signal) {
  logger.info(`Received ${signal}, shutting down SMS worker gracefully...`, {
    file: 'sms.worker.js',
    function: 'shutdown',
    signal,
  });
  try {
    await worker.queue.close();
    logger.info('SMS worker shut down cleanly.', {
      file: 'sms.worker.js',
      function: 'shutdown',
    });
    process.exit(0);
  } catch (err) {
    logger.error('Error during shutdown', {
      file: 'sms.worker.js',
      function: 'shutdown',
      error: err.message,
      stack: err.stack,
    });
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
