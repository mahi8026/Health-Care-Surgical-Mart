// server/src/queues/sms.worker.js
// Standalone worker script — run separately to process SMS queue jobs.
// Usage: node server/src/queues/sms.worker.js

const SMSQueue = require("../services/sms/sms.queue");

const worker = new SMSQueue();

console.log("SMS worker started, waiting for jobs...");

async function shutdown(signal) {
  console.log(`Received ${signal}, shutting down SMS worker gracefully...`);
  try {
    await worker.queue.close();
    console.log("SMS worker shut down cleanly.");
    process.exit(0);
  } catch (err) {
    console.error("Error during shutdown:", err.message);
    process.exit(1);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
