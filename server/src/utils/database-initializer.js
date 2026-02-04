/**
 * Database Initializer
 * Creates collections with schemas and indexes for a shop database
 */

const { productSchema, productIndexes } = require("../models/product.schema");
const {
  customerSchema,
  customerIndexes,
} = require("../models/customer.schema");
const { saleSchema, saleIndexes } = require("../models/sale.schema");
const {
  purchaseSchema,
  purchaseIndexes,
} = require("../models/purchase.schema");
const { stockSchema, stockIndexes } = require("../models/stock.schema");
const { userSchema, userIndexes } = require("../models/user.schema");
const {
  expenseCategorySchema,
  expenseCategoryIndexes,
} = require("../models/expense-category.schema");
const { expenseSchema, expenseIndexes } = require("../models/expense.schema");
const {
  seedDefaultExpenseCategories,
} = require("../services/expense-category-seeder");

/**
 * Initialize a shop database with all collections, schemas, and indexes
 * @param {Db} db - MongoDB database instance
 * @returns {Promise<Object>} Result of initialization
 */
async function initializeShopDatabase(db) {
  const results = {
    collections: [],
    indexes: [],
    errors: [],
  };

  try {
    // Collection configurations
    const collections = [
      { name: "products", schema: productSchema, indexes: productIndexes },
      { name: "customers", schema: customerSchema, indexes: customerIndexes },
      { name: "sales", schema: saleSchema, indexes: saleIndexes },
      { name: "purchases", schema: purchaseSchema, indexes: purchaseIndexes },
      { name: "stock", schema: stockSchema, indexes: stockIndexes },
      { name: "users", schema: userSchema, indexes: userIndexes },
      {
        name: "expense_categories",
        schema: expenseCategorySchema,
        indexes: expenseCategoryIndexes,
      },
      { name: "expenses", schema: expenseSchema, indexes: expenseIndexes },
    ];

    // Create collections with validation
    for (const config of collections) {
      try {
        // Check if collection exists
        const existingCollections = await db
          .listCollections({ name: config.name })
          .toArray();

        if (existingCollections.length === 0) {
          // Create collection with schema validation
          await db.createCollection(config.name, config.schema);
          results.collections.push(`✅ Created collection: ${config.name}`);
        } else {
          // Update validation schema for existing collection
          await db.command({
            collMod: config.name,
            validator: config.schema.validator,
          });
          results.collections.push(`✅ Updated validation for: ${config.name}`);
        }

        // Create indexes
        const collection = db.collection(config.name);
        for (const index of config.indexes) {
          try {
            await collection.createIndex(index.key, {
              unique: index.unique || false,
              sparse: index.sparse || false,
              name: index.name,
            });
            results.indexes.push(
              `✅ Created index ${index.name} on ${config.name}`,
            );
          } catch (indexError) {
            if (indexError.code === 85 || indexError.code === 86) {
              // Index already exists or duplicate key, skip
              results.indexes.push(
                `ℹ️  Index ${index.name} already exists on ${config.name}`,
              );
            } else {
              throw indexError;
            }
          }
        }
      } catch (error) {
        results.errors.push(`❌ Error with ${config.name}: ${error.message}`);
      }
    }

    // Seed default expense categories after creating collections
    try {
      const seedResult = await seedDefaultExpenseCategories(db);
      if (seedResult.success) {
        results.collections.push(`✅ ${seedResult.message}`);
      }
    } catch (error) {
      results.errors.push(
        `❌ Error seeding expense categories: ${error.message}`,
      );
    }

    return results;
  } catch (error) {
    console.error("Database initialization error:", error);
    throw error;
  }
}

/**
 * Initialize system database (for super admin operations)
 * @param {Db} systemDb - System database instance
 * @returns {Promise<Object>} Result of initialization
 */
async function initializeSystemDatabase(systemDb) {
  const { shopSchema, shopIndexes } = require("../models/shop.schema");

  const results = {
    collections: [],
    indexes: [],
    errors: [],
  };

  try {
    // Check if shops collection exists
    const existingCollections = await systemDb
      .listCollections({ name: "shops" })
      .toArray();

    if (existingCollections.length === 0) {
      await systemDb.createCollection("shops", shopSchema);
      results.collections.push("✅ Created collection: shops");
    } else {
      await systemDb.command({
        collMod: "shops",
        validator: shopSchema.validator,
      });
      results.collections.push("✅ Updated validation for: shops");
    }

    // Create indexes
    const shopsCollection = systemDb.collection("shops");
    for (const index of shopIndexes) {
      try {
        await shopsCollection.createIndex(index.key, {
          unique: index.unique || false,
          sparse: index.sparse || false,
          name: index.name,
        });
        results.indexes.push(`✅ Created index ${index.name} on shops`);
      } catch (indexError) {
        if (indexError.code === 85 || indexError.code === 86) {
          results.indexes.push(
            `ℹ️  Index ${index.name} already exists on shops`,
          );
        } else {
          throw indexError;
        }
      }
    }

    // Create system users collection
    const systemUserExists = await systemDb
      .listCollections({ name: "system_users" })
      .toArray();
    if (systemUserExists.length === 0) {
      await systemDb.createCollection("system_users", userSchema);
      results.collections.push("✅ Created collection: system_users");

      const systemUsersCollection = systemDb.collection("system_users");
      await systemUsersCollection.createIndex(
        { email: 1 },
        { unique: true, name: "email_unique" },
      );
      results.indexes.push("✅ Created index email_unique on system_users");
    }

    return results;
  } catch (error) {
    console.error("System database initialization error:", error);
    throw error;
  }
}

module.exports = {
  initializeShopDatabase,
  initializeSystemDatabase,
};
