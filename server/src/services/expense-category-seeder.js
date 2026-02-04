/**
 * Expense Category Seeder Service
 * Creates default expense categories for new shops
 */

const { logger } = require("../config/logging");

/**
 * Default expense categories to be created for new shops
 */
const defaultExpenseCategories = [
  // Fixed Expenses
  {
    name: "Rent",
    description: "Monthly rent for shop premises",
    type: "Fixed",
    isActive: true,
    isDefault: true,
  },
  {
    name: "Insurance",
    description: "Business and property insurance premiums",
    type: "Fixed",
    isActive: true,
    isDefault: true,
  },
  {
    name: "Loan Payments",
    description: "Business loan EMIs and interest payments",
    type: "Fixed",
    isActive: true,
    isDefault: true,
  },

  // Variable Expenses
  {
    name: "Utilities",
    description: "Electricity, water, gas, and other utility bills",
    type: "Variable",
    isActive: true,
    isDefault: true,
  },
  {
    name: "Phone/Internet",
    description: "Telephone and internet connectivity charges",
    type: "Variable",
    isActive: true,
    isDefault: true,
  },
  {
    name: "Maintenance",
    description: "Equipment maintenance and repair costs",
    type: "Variable",
    isActive: true,
    isDefault: true,
  },

  // Staff Expenses
  {
    name: "Salaries",
    description: "Employee salaries and wages",
    type: "Fixed",
    isActive: true,
    isDefault: true,
  },
  {
    name: "Benefits",
    description: "Employee benefits, PF, ESI, and other allowances",
    type: "Fixed",
    isActive: true,
    isDefault: true,
  },
  {
    name: "Training",
    description: "Staff training and development expenses",
    type: "Variable",
    isActive: true,
    isDefault: true,
  },

  // Marketing Expenses
  {
    name: "Advertising",
    description: "Marketing and advertising expenses",
    type: "Variable",
    isActive: true,
    isDefault: true,
  },
  {
    name: "Promotions",
    description: "Customer promotions and discount campaigns",
    type: "Variable",
    isActive: true,
    isDefault: true,
  },
  {
    name: "Events",
    description: "Health camps, awareness programs, and events",
    type: "Variable",
    isActive: true,
    isDefault: true,
  },

  // Administrative Expenses
  {
    name: "Office Supplies",
    description: "Stationery, printing, and office consumables",
    type: "Variable",
    isActive: true,
    isDefault: true,
  },
  {
    name: "Legal",
    description: "Legal consultation and compliance costs",
    type: "Variable",
    isActive: true,
    isDefault: true,
  },
  {
    name: "Accounting",
    description: "Accounting and bookkeeping services",
    type: "Variable",
    isActive: true,
    isDefault: true,
  },

  // Other Expenses
  {
    name: "Other",
    description: "Miscellaneous expenses not covered in other categories",
    type: "Variable",
    isActive: true,
    isDefault: true,
  },
];

/**
 * Seed default expense categories for a shop
 * @param {Db} shopDb - Shop database instance
 * @returns {Promise<Object>} Result of seeding operation
 */
async function seedDefaultExpenseCategories(shopDb) {
  try {
    const expenseCategoriesCollection = shopDb.collection("expense_categories");

    // Check if default categories already exist
    const existingDefaultCategories = await expenseCategoriesCollection
      .find({ isDefault: true })
      .toArray();

    if (existingDefaultCategories.length > 0) {
      logger.info("Default expense categories already exist, skipping seeding");
      return {
        success: true,
        message: "Default categories already exist",
        categoriesCreated: 0,
      };
    }

    // Add timestamps to categories
    const categoriesToInsert = defaultExpenseCategories.map((category) => ({
      ...category,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    // Insert default categories
    const result =
      await expenseCategoriesCollection.insertMany(categoriesToInsert);

    logger.info(
      `Successfully created ${result.insertedCount} default expense categories`,
    );

    return {
      success: true,
      message: `Created ${result.insertedCount} default expense categories`,
      categoriesCreated: result.insertedCount,
      categoryIds: Object.values(result.insertedIds),
    };
  } catch (error) {
    logger.error("Error seeding default expense categories:", error);
    throw new Error(
      `Failed to seed default expense categories: ${error.message}`,
    );
  }
}

/**
 * Get list of default expense categories (without inserting)
 * @returns {Array} Array of default expense categories
 */
function getDefaultExpenseCategories() {
  return defaultExpenseCategories.map((category) => ({
    ...category,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
}

/**
 * Check if default categories exist in a shop
 * @param {Db} shopDb - Shop database instance
 * @returns {Promise<boolean>} Whether default categories exist
 */
async function defaultCategoriesExist(shopDb) {
  try {
    const expenseCategoriesCollection = shopDb.collection("expense_categories");
    const count = await expenseCategoriesCollection.countDocuments({
      isDefault: true,
    });
    return count > 0;
  } catch (error) {
    logger.error("Error checking default categories:", error);
    return false;
  }
}

module.exports = {
  seedDefaultExpenseCategories,
  getDefaultExpenseCategories,
  defaultCategoriesExist,
  defaultExpenseCategories,
};
