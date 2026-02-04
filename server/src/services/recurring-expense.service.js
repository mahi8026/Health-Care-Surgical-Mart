/**
 * Recurring Expense Processing Service
 * Handles scheduled processing of recurring expenses
 */

const { ObjectId } = require("mongodb");
const { getShopDatabase } = require("../config/database");
const { generateExpenseNumber } = require("./expense-number-generator");
const { logger } = require("../config/logging");

/**
 * Calculate next due date based on frequency and interval
 * @param {Date} currentDate - Current due date
 * @param {string} frequency - Frequency type (daily, weekly, monthly, yearly)
 * @param {number} interval - Interval multiplier
 * @returns {Date} Next due date
 */
function calculateNextDueDate(currentDate, frequency, interval = 1) {
  const nextDate = new Date(currentDate);

  switch (frequency) {
    case "daily":
      nextDate.setDate(nextDate.getDate() + interval);
      break;
    case "weekly":
      nextDate.setDate(nextDate.getDate() + interval * 7);
      break;
    case "monthly":
      nextDate.setMonth(nextDate.getMonth() + interval);
      break;
    case "yearly":
      nextDate.setFullYear(nextDate.getFullYear() + interval);
      break;
    default:
      throw new Error(`Invalid frequency: ${frequency}`);
  }

  return nextDate;
}

/**
 * Check if a recurring expense is still active
 * @param {Object} recurringConfig - Recurring configuration
 * @param {Date} currentDate - Current date to check against
 * @returns {boolean} True if still active
 */
function isRecurringActive(recurringConfig, currentDate = new Date()) {
  if (!recurringConfig.endDate) {
    return true; // No end date means it runs indefinitely
  }

  return new Date(recurringConfig.endDate) >= currentDate;
}

/**
 * Create a new expense from a recurring template
 * @param {Object} template - Recurring expense template
 * @param {Object} shopDb - Shop database connection
 * @param {Date} dueDate - Date for the new expense
 * @returns {Object} Created expense data
 */
async function createExpenseFromTemplate(template, shopDb, dueDate) {
  // Generate new expense number
  const expenseNumber = await generateExpenseNumber(shopDb);

  // Create new expense based on template
  const newExpense = {
    expenseNumber,
    categoryId: template.categoryId,
    categoryName: template.categoryName,
    amount: template.amount,
    description: template.description,
    expenseDate: dueDate,
    paymentMethod: template.paymentMethod,
    vendor: template.vendor,
    attachments: [], // New expenses don't inherit attachments
    isRecurring: false, // Generated expenses are not recurring themselves
    recurringConfig: null,
    tags: [...(template.tags || [])],
    notes: template.notes
      ? `${template.notes} (Generated from recurring expense)`
      : "Generated from recurring expense",
    createdBy: template.createdBy,
    createdAt: new Date(),
    updatedAt: new Date(),
    recurringTemplateId: template._id, // Reference to the template
  };

  const result = await shopDb.collection("expenses").insertOne(newExpense);

  return {
    _id: result.insertedId,
    ...newExpense,
  };
}

/**
 * Process due recurring expenses for a specific shop
 * @param {string} shopId - Shop ID
 * @param {Date} processDate - Date to process (defaults to today)
 * @returns {Object} Processing results
 */
async function processShopRecurringExpenses(shopId, processDate = new Date()) {
  const shopDb = getShopDatabase(shopId);
  const results = {
    shopId,
    processedCount: 0,
    createdExpenses: [],
    updatedTemplates: [],
    errors: [],
  };

  try {
    // Find all recurring expenses that are due
    const dueRecurringExpenses = await shopDb
      .collection("expenses")
      .find({
        isRecurring: true,
        "recurringConfig.nextDueDate": { $lte: processDate },
      })
      .toArray();

    logger.info(
      `Found ${dueRecurringExpenses.length} due recurring expenses for shop ${shopId}`,
    );

    for (const template of dueRecurringExpenses) {
      try {
        const { recurringConfig } = template;

        // Check if recurring expense is still active
        if (!isRecurringActive(recurringConfig, processDate)) {
          logger.info(`Recurring expense ${template._id} has ended, skipping`);
          continue;
        }

        // Create new expense from template
        const newExpense = await createExpenseFromTemplate(
          template,
          shopDb,
          new Date(recurringConfig.nextDueDate),
        );

        results.createdExpenses.push(newExpense);

        // Calculate next due date
        const nextDueDate = calculateNextDueDate(
          new Date(recurringConfig.nextDueDate),
          recurringConfig.frequency,
          recurringConfig.interval,
        );

        // Update the template's next due date
        await shopDb.collection("expenses").updateOne(
          { _id: template._id },
          {
            $set: {
              "recurringConfig.nextDueDate": nextDueDate,
              updatedAt: new Date(),
            },
          },
        );

        results.updatedTemplates.push({
          templateId: template._id,
          previousDueDate: recurringConfig.nextDueDate,
          nextDueDate,
        });

        results.processedCount++;

        logger.info(
          `Processed recurring expense ${template._id}, created expense ${newExpense._id}`,
        );
      } catch (error) {
        logger.error(
          `Error processing recurring expense ${template._id}:`,
          error,
        );
        results.errors.push({
          templateId: template._id,
          error: error.message,
        });
      }
    }
  } catch (error) {
    logger.error(
      `Error processing recurring expenses for shop ${shopId}:`,
      error,
    );
    results.errors.push({
      shopId,
      error: error.message,
    });
  }

  return results;
}

/**
 * Process recurring expenses for all shops
 * @param {Date} processDate - Date to process (defaults to today)
 * @returns {Object} Overall processing results
 */
async function processAllRecurringExpenses(processDate = new Date()) {
  const { MongoClient } = require("mongodb");
  const client = new MongoClient(process.env.MONGODB_URI);

  const overallResults = {
    processDate,
    totalShopsProcessed: 0,
    totalExpensesCreated: 0,
    shopResults: [],
    errors: [],
  };

  try {
    await client.connect();
    const adminDb = client.db("admin");

    // Get list of all shop databases
    const databases = await adminDb.admin().listDatabases();
    const shopDatabases = databases.databases.filter(
      (db) => db.name.startsWith("shop_") && db.name !== "shop_template",
    );

    logger.info(
      `Processing recurring expenses for ${shopDatabases.length} shops`,
    );

    for (const dbInfo of shopDatabases) {
      const shopId = dbInfo.name.replace("shop_", "");

      try {
        const shopResults = await processShopRecurringExpenses(
          shopId,
          processDate,
        );
        overallResults.shopResults.push(shopResults);
        overallResults.totalExpensesCreated +=
          shopResults.createdExpenses.length;
        overallResults.totalShopsProcessed++;
      } catch (error) {
        logger.error(`Error processing shop ${shopId}:`, error);
        overallResults.errors.push({
          shopId,
          error: error.message,
        });
      }
    }
  } catch (error) {
    logger.error("Error in processAllRecurringExpenses:", error);
    overallResults.errors.push({
      error: error.message,
    });
  } finally {
    await client.close();
  }

  logger.info(
    `Recurring expense processing completed. Created ${overallResults.totalExpensesCreated} expenses across ${overallResults.totalShopsProcessed} shops`,
  );

  return overallResults;
}

/**
 * Update recurring expense template
 * @param {string} shopId - Shop ID
 * @param {string} templateId - Template expense ID
 * @param {Object} updates - Updates to apply
 * @returns {Object} Update result
 */
async function updateRecurringTemplate(shopId, templateId, updates) {
  const shopDb = getShopDatabase(shopId);

  // Validate template exists and is recurring
  const template = await shopDb
    .collection("expenses")
    .findOne({ _id: new ObjectId(templateId), isRecurring: true });

  if (!template) {
    throw new Error("Recurring expense template not found");
  }

  // Prepare update data
  const updateData = {
    updatedAt: new Date(),
  };

  // Handle recurring configuration updates
  if (updates.recurringConfig) {
    const { recurringConfig } = updates;

    // Validate frequency if provided
    if (recurringConfig.frequency) {
      const validFrequencies = ["daily", "weekly", "monthly", "yearly"];
      if (!validFrequencies.includes(recurringConfig.frequency)) {
        throw new Error("Invalid recurring frequency");
      }
    }

    // Validate interval if provided
    if (recurringConfig.interval && recurringConfig.interval < 1) {
      throw new Error("Recurring interval must be at least 1");
    }

    // Validate date range if provided
    if (recurringConfig.endDate && recurringConfig.startDate) {
      if (
        new Date(recurringConfig.endDate) <= new Date(recurringConfig.startDate)
      ) {
        throw new Error("Recurring end date must be after start date");
      }
    }

    // Update recurring configuration
    updateData.recurringConfig = {
      ...template.recurringConfig,
      ...recurringConfig,
    };

    // If frequency or interval changed, recalculate next due date
    if (recurringConfig.frequency || recurringConfig.interval) {
      const nextDueDate = calculateNextDueDate(
        new Date(template.recurringConfig.nextDueDate),
        updateData.recurringConfig.frequency,
        updateData.recurringConfig.interval,
      );
      updateData.recurringConfig.nextDueDate = nextDueDate;
    }
  }

  // Handle other field updates
  const allowedFields = [
    "categoryId",
    "categoryName",
    "amount",
    "description",
    "paymentMethod",
    "vendor",
    "tags",
    "notes",
  ];

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      updateData[field] = updates[field];
    }
  }

  // Update the template
  const result = await shopDb
    .collection("expenses")
    .updateOne({ _id: new ObjectId(templateId) }, { $set: updateData });

  return {
    success: result.modifiedCount > 0,
    modifiedCount: result.modifiedCount,
  };
}

/**
 * Stop a recurring expense (set end date to today)
 * @param {string} shopId - Shop ID
 * @param {string} templateId - Template expense ID
 * @returns {Object} Stop result
 */
async function stopRecurringExpense(shopId, templateId) {
  const shopDb = getShopDatabase(shopId);

  // Validate template exists and is recurring
  const template = await shopDb
    .collection("expenses")
    .findOne({ _id: new ObjectId(templateId), isRecurring: true });

  if (!template) {
    throw new Error("Recurring expense template not found");
  }

  // Set end date to today to stop future processing
  const result = await shopDb.collection("expenses").updateOne(
    { _id: new ObjectId(templateId) },
    {
      $set: {
        "recurringConfig.endDate": new Date(),
        updatedAt: new Date(),
      },
    },
  );

  return {
    success: result.modifiedCount > 0,
    modifiedCount: result.modifiedCount,
  };
}

/**
 * Get recurring expense templates for a shop
 * @param {string} shopId - Shop ID
 * @param {Object} filters - Optional filters
 * @returns {Array} Recurring expense templates
 */
async function getRecurringTemplates(shopId, filters = {}) {
  const shopDb = getShopDatabase(shopId);

  const matchQuery = {
    isRecurring: true,
  };

  // Add filters
  if (filters.categoryId) {
    matchQuery.categoryId = new ObjectId(filters.categoryId);
  }

  if (filters.isActive !== undefined) {
    if (filters.isActive) {
      // Active means no end date or end date in future
      matchQuery.$or = [
        { "recurringConfig.endDate": { $exists: false } },
        { "recurringConfig.endDate": null },
        { "recurringConfig.endDate": { $gt: new Date() } },
      ];
    } else {
      // Inactive means end date in past
      matchQuery["recurringConfig.endDate"] = { $lte: new Date() };
    }
  }

  const templates = await shopDb
    .collection("expenses")
    .aggregate([
      { $match: matchQuery },
      {
        $lookup: {
          from: "expenseCategories",
          localField: "categoryId",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: "$category" },
      {
        $lookup: {
          from: "users",
          localField: "createdBy",
          foreignField: "_id",
          as: "createdByUser",
        },
      },
      { $unwind: "$createdByUser" },
      { $sort: { "recurringConfig.nextDueDate": 1 } },
    ])
    .toArray();

  return templates;
}

module.exports = {
  calculateNextDueDate,
  isRecurringActive,
  createExpenseFromTemplate,
  processShopRecurringExpenses,
  processAllRecurringExpenses,
  updateRecurringTemplate,
  stopRecurringExpense,
  getRecurringTemplates,
};
