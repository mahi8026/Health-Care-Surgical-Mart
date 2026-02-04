#!/usr/bin/env node

/**
 * Migration Script: Add Expense Tracking
 * Adds expense tracking collections and default categories to existing shops
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const {
  connectToDatabase,
  getShopDatabase,
  listAllShops,
} = require("../../server/src/config/database");
const { logger } = require("../../server/src/config/logging");
const {
  expenseCategorySchema,
  expenseCategoryIndexes,
} = require("../../server/src/models/expense-category.schema");
const {
  expenseSchema,
  expenseIndexes,
} = require("../../server/src/models/expense.schema");
const {
  seedDefaultExpenseCategories,
} = require("../../server/src/services/expense-category-seeder");

/**
 * Add expense tracking collections to a shop database
 * @param {string} shopId - Shop identifier
 * @returns {Promise<Object>} Migration result
 */
async function addExpenseTrackingToShop(shopId) {
  const result = {
    shopId,
    collections: [],
    indexes: [],
    seeding: [],
    errors: [],
  };

  try {
    const shopDb = getShopDatabase(shopId);

    // Collection configurations for expense tracking
    const expenseCollections = [
      {
        name: "expense_categories",
        schema: expenseCategorySchema,
        indexes: expenseCategoryIndexes,
      },
      { name: "expenses", schema: expenseSchema, indexes: expenseIndexes },
    ];

    // Create collections with validation
    for (const config of expenseCollections) {
      try {
        // Check if collection exists
        const existingCollections = await shopDb
          .listCollections({ name: config.name })
          .toArray();

        if (existingCollections.length === 0) {
          // Create collection with schema validation
          await shopDb.createCollection(config.name, config.schema);
          result.collections.push(`✅ Created collection: ${config.name}`);
        } else {
          // Update validation schema for existing collection
          await shopDb.command({
            collMod: config.name,
            validator: config.schema.validator,
          });
          result.collections.push(`✅ Updated validation for: ${config.name}`);
        }

        // Create indexes
        const collection = shopDb.collection(config.name);
        for (const index of config.indexes) {
          try {
            await collection.createIndex(index.key, {
              unique: index.unique || false,
              sparse: index.sparse || false,
              name: index.name,
            });
            result.indexes.push(
              `✅ Created index ${index.name} on ${config.name}`,
            );
          } catch (indexError) {
            if (indexError.code === 85 || indexError.code === 86) {
              // Index already exists or duplicate key, skip
              result.indexes.push(
                `ℹ️  Index ${index.name} already exists on ${config.name}`,
              );
            } else {
              throw indexError;
            }
          }
        }
      } catch (error) {
        result.errors.push(`❌ Error with ${config.name}: ${error.message}`);
      }
    }

    // Seed default expense categories
    try {
      const seedResult = await seedDefaultExpenseCategories(shopDb);
      if (seedResult.success) {
        result.seeding.push(`✅ ${seedResult.message}`);
      }
    } catch (error) {
      result.errors.push(`❌ Error seeding categories: ${error.message}`);
    }

    return result;
  } catch (error) {
    result.errors.push(`❌ Shop migration error: ${error.message}`);
    return result;
  }
}

/**
 * Main migration function
 */
async function migrateExpenseTracking() {
  try {
    logger.info("Starting expense tracking migration...");

    // Connect to database
    await connectToDatabase();

    // Get all existing shops
    const shops = await listAllShops();
    logger.info(`Found ${shops.length} shops to migrate`);

    const migrationResults = [];

    // Migrate each shop
    for (const shop of shops) {
      logger.info(`Migrating shop: ${shop.shopId}`);
      const result = await addExpenseTrackingToShop(shop.shopId);
      migrationResults.push(result);

      // Log results for this shop
      if (result.collections.length > 0) {
        result.collections.forEach((msg) => logger.info(`  ${msg}`));
      }
      if (result.indexes.length > 0) {
        result.indexes.forEach((msg) => logger.info(`  ${msg}`));
      }
      if (result.seeding.length > 0) {
        result.seeding.forEach((msg) => logger.info(`  ${msg}`));
      }
      if (result.errors.length > 0) {
        result.errors.forEach((msg) => logger.error(`  ${msg}`));
      }
    }

    // Summary
    const totalErrors = migrationResults.reduce(
      (sum, result) => sum + result.errors.length,
      0,
    );
    const successfulMigrations = migrationResults.filter(
      (result) => result.errors.length === 0,
    ).length;

    logger.info("\n📊 Migration Summary:");
    logger.info(`Total shops: ${shops.length}`);
    logger.info(`Successful migrations: ${successfulMigrations}`);
    logger.info(`Failed migrations: ${shops.length - successfulMigrations}`);
    logger.info(`Total errors: ${totalErrors}`);

    if (totalErrors === 0) {
      logger.info("✅ Expense tracking migration completed successfully!");
    } else {
      logger.warn(
        "⚠️  Migration completed with some errors. Check logs above.",
      );
    }
  } catch (error) {
    logger.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateExpenseTracking();
}

module.exports = {
  migrateExpenseTracking,
  addExpenseTrackingToShop,
};
