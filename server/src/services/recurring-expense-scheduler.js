/**
 * Recurring Expense Scheduler
 * Scheduled job to process recurring expenses daily
 */

const cron = require("node-cron");
const { processAllRecurringExpenses } = require("./recurring-expense.service");
const { logger } = require("../config/logging");

/**
 * Start the recurring expense processing scheduler
 * Runs daily at 2:00 AM
 */
function startRecurringExpenseScheduler() {
  // Schedule to run daily at 2:00 AM
  const task = cron.schedule(
    "0 2 * * *",
    async () => {
      logger.info("Starting scheduled recurring expense processing...");

      try {
        const results = await processAllRecurringExpenses();

        logger.info("Scheduled recurring expense processing completed", {
          totalShopsProcessed: results.totalShopsProcessed,
          totalExpensesCreated: results.totalExpensesCreated,
          errors: results.errors.length,
        });

        // Log any errors
        if (results.errors.length > 0) {
          logger.error(
            "Errors during recurring expense processing:",
            results.errors,
          );
        }
      } catch (error) {
        logger.error("Error in scheduled recurring expense processing:", error);
      }
    },
    {
      scheduled: false, // Don't start immediately
      timezone: "UTC", // Use UTC timezone
    },
  );

  // Start the task
  task.start();

  logger.info(
    "Recurring expense scheduler started - will run daily at 2:00 AM UTC",
  );

  return task;
}

/**
 * Stop the recurring expense scheduler
 * @param {Object} task - The cron task to stop
 */
function stopRecurringExpenseScheduler(task) {
  if (task) {
    task.stop();
    logger.info("Recurring expense scheduler stopped");
  }
}

/**
 * Run recurring expense processing immediately (for testing/manual trigger)
 */
async function runRecurringExpenseProcessingNow() {
  logger.info("Running recurring expense processing manually...");

  try {
    const results = await processAllRecurringExpenses();

    logger.info("Manual recurring expense processing completed", {
      totalShopsProcessed: results.totalShopsProcessed,
      totalExpensesCreated: results.totalExpensesCreated,
      errors: results.errors.length,
    });

    return results;
  } catch (error) {
    logger.error("Error in manual recurring expense processing:", error);
    throw error;
  }
}

module.exports = {
  startRecurringExpenseScheduler,
  stopRecurringExpenseScheduler,
  runRecurringExpenseProcessingNow,
};
