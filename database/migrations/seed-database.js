#!/usr/bin/env node

/**
 * Database Seeding Script
 * Seeds the database with sample data for development and testing
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../server/.env") });

const {
  connectToDatabase,
  getShopDatabase,
  getSystemDatabase,
} = require("../../server/src/config/database");
const { logger } = require("../../server/src/config/logging");
const bcrypt = require("bcryptjs");
const { ObjectId } = require("mongodb");
const {
  seedDefaultExpenseCategories,
} = require("../../server/src/services/expense-category-seeder");

// Sample data
const sampleShops = [
  {
    _id: "healthcare_plus_phar_mktwtpnv",
    name: "Healthcare Plus Pharmacy",
    address: "123 Medical Street, Health City",
    phone: "+1234567890",
    email: "info@healthcareplus.com",
    isActive: true,
    createdAt: new Date(),
  },
  {
    _id: "medicare_store_mktwtss2",
    name: "Medicare Store",
    address: "456 Wellness Avenue, Care Town",
    phone: "+1234567891",
    email: "contact@medicarestore.com",
    isActive: true,
    createdAt: new Date(),
  },
  {
    _id: "city_medical_supplie_mktwtvhw",
    name: "City Medical Supplies",
    address: "789 Supply Road, Med City",
    phone: "+1234567892",
    email: "orders@citymedical.com",
    isActive: true,
    createdAt: new Date(),
  },
];

const sampleUsers = [
  {
    name: "Super Administrator",
    email: "superadmin@medicalpos.com",
    password: "SuperAdmin@123",
    role: "SUPER_ADMIN",
    isActive: true,
  },
  {
    name: "John Smith",
    email: "john@healthcareplus.com",
    password: "Admin@123",
    role: "SHOP_ADMIN",
    shopId: "healthcare_plus_phar_mktwtpnv",
  },
  {
    name: "Sarah Johnson",
    email: "sarah@medicarestore.com",
    password: "Admin@123",
    role: "SHOP_ADMIN",
    shopId: "medicare_store_mktwtss2",
  },
  {
    name: "Mike Wilson",
    email: "mike@citymedical.com",
    password: "Admin@123",
    role: "SHOP_ADMIN",
    shopId: "city_medical_supplie_mktwtvhw",
  },
];

const sampleProducts = [
  {
    name: "Paracetamol 500mg",
    sku: "PAR500",
    brand: "MediCorp",
    category: "Medical",
    purchasePrice: 0.5,
    sellingPrice: 1.0,
    unit: "strip",
    minStockLevel: 50,
    description: "Pain relief and fever reducer",
    isActive: true,
  },
  {
    name: "Amoxicillin 250mg",
    sku: "AMX250",
    brand: "PharmaCorp",
    category: "Medical",
    purchasePrice: 2.0,
    sellingPrice: 3.5,
    unit: "strip",
    minStockLevel: 30,
    description: "Antibiotic for bacterial infections",
    isActive: true,
  },
  {
    name: "Digital Thermometer",
    sku: "THERM001",
    brand: "MedTech",
    category: "Medical",
    purchasePrice: 15.0,
    sellingPrice: 25.0,
    unit: "pcs",
    minStockLevel: 10,
    description: "Digital fever thermometer",
    isActive: true,
  },
];

const sampleCategories = [
  { name: "Medical", description: "General medical supplies and medicines" },
  { name: "Lab", description: "Laboratory equipment and supplies" },
  { name: "Surgical", description: "Surgical instruments and supplies" },
];

const sampleCustomers = [
  {
    name: "Alice Brown",
    phone: "+1234567800",
    email: "alice@email.com",
    address: "123 Customer Street",
    type: "Regular",
  },
  {
    name: "Bob Davis",
    phone: "+1234567801",
    email: "bob@email.com",
    address: "456 Client Avenue",
    type: "VIP",
  },
];

const sampleSuppliers = [
  {
    name: "MediCorp Supplies",
    company: "MediCorp Ltd.",
    phone: "+1234567900",
    email: "orders@medicorp.com",
    address: "789 Supplier Road",
    contactPerson: "Jane Supplier",
    isActive: true,
  },
  {
    name: "PharmaCorp Distribution",
    company: "PharmaCorp Inc.",
    phone: "+1234567901",
    email: "sales@pharmacorp.com",
    address: "321 Distribution Center",
    contactPerson: "John Distributor",
    isActive: true,
  },
];

/**
 * Seed system database with shops and super admin
 */
async function seedSystemDatabase() {
  try {
    const systemDb = getSystemDatabase();

    logger.info("Seeding system database...");

    // Create shops collection
    const shopsCollection = systemDb.collection("shops");
    await shopsCollection.deleteMany({}); // Clear existing
    await shopsCollection.insertMany(sampleShops);
    logger.info(`Inserted ${sampleShops.length} shops`);

    // Create super admin user
    const usersCollection = systemDb.collection("users");
    await usersCollection.deleteMany({ role: "SUPER_ADMIN" }); // Clear existing super admins

    const superAdmin = sampleUsers.find((u) => u.role === "SUPER_ADMIN");
    const hashedPassword = await bcrypt.hash(superAdmin.password, 12);

    await usersCollection.insertOne({
      ...superAdmin,
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    logger.info("Created super admin user");
  } catch (error) {
    logger.error("Error seeding system database:", error);
    throw error;
  }
}

/**
 * Seed individual shop database
 */
async function seedShopDatabase(shopId) {
  try {
    const shopDb = getShopDatabase(shopId);

    logger.info(`Seeding shop database: ${shopId}`);

    // Seed categories
    const categoriesCollection = shopDb.collection("categories");
    await categoriesCollection.deleteMany({});
    const categoryResults = await categoriesCollection.insertMany(
      sampleCategories.map((cat) => ({
        ...cat,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    );
    logger.info(`Inserted ${sampleCategories.length} categories`);

    // Seed products
    const productsCollection = shopDb.collection("products");
    await productsCollection.deleteMany({});
    const productResults = await productsCollection.insertMany(
      sampleProducts.map((product) => ({
        ...product,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    );
    logger.info(`Inserted ${sampleProducts.length} products`);

    // Seed stock for products
    const stockCollection = shopDb.collection("stock");
    await stockCollection.deleteMany({});
    const stockData = productResults.insertedIds.map((productId, index) => ({
      productId,
      productName: sampleProducts[index].name,
      currentQty: Math.floor(Math.random() * 100) + 20, // Random stock between 20-120
      reservedQty: 0,
      availableQty: Math.floor(Math.random() * 100) + 20,
      minStockLevel: sampleProducts[index].minStockLevel,
      isLowStock: false,
      lastUpdated: new Date(),
      createdAt: new Date(),
    }));
    await stockCollection.insertMany(stockData);
    logger.info(`Inserted stock data for ${stockData.length} products`);

    // Seed customers
    const customersCollection = shopDb.collection("customers");
    await customersCollection.deleteMany({});
    await customersCollection.insertMany(
      sampleCustomers.map((customer) => ({
        ...customer,
        totalPurchases: 0,
        lastPurchaseDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    );
    logger.info(`Inserted ${sampleCustomers.length} customers`);

    // Seed suppliers
    const suppliersCollection = shopDb.collection("suppliers");
    await suppliersCollection.deleteMany({});
    await suppliersCollection.insertMany(
      sampleSuppliers.map((supplier) => ({
        ...supplier,
        totalPurchases: 0,
        lastPurchaseDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    );
    logger.info(`Inserted ${sampleSuppliers.length} suppliers`);

    // Seed shop users
    const usersCollection = shopDb.collection("users");
    await usersCollection.deleteMany({});

    const shopUsers = sampleUsers.filter((u) => u.shopId === shopId);
    for (const user of shopUsers) {
      const hashedPassword = await bcrypt.hash(user.password, 12);
      await usersCollection.insertOne({
        ...user,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    logger.info(`Inserted ${shopUsers.length} users for shop ${shopId}`);

    // Seed default expense categories
    try {
      const expenseResult = await seedDefaultExpenseCategories(shopDb);
      if (expenseResult.success) {
        logger.info(
          `Seeded ${expenseResult.categoriesCreated} expense categories`,
        );
      }
    } catch (error) {
      logger.error(`Error seeding expense categories for ${shopId}:`, error);
    }

    // Create indexes for better performance
    await createIndexes(shopDb);

    logger.info(`Successfully seeded shop database: ${shopId}`);
  } catch (error) {
    logger.error(`Error seeding shop database ${shopId}:`, error);
    throw error;
  }
}

/**
 * Create database indexes
 */
async function createIndexes(shopDb) {
  try {
    // Product indexes
    await shopDb.collection("products").createIndexes([
      { key: { sku: 1 }, unique: true, name: "sku_unique" },
      { key: { name: 1 }, name: "name_index" },
      { key: { category: 1 }, name: "category_index" },
      { key: { isActive: 1 }, name: "active_status_index" },
    ]);

    // Stock indexes
    await shopDb.collection("stock").createIndexes([
      { key: { productId: 1 }, unique: true, name: "product_unique" },
      { key: { isLowStock: 1 }, name: "low_stock_index" },
    ]);

    // Customer indexes
    await shopDb.collection("customers").createIndexes([
      { key: { phone: 1 }, name: "phone_index" },
      { key: { email: 1 }, sparse: true, name: "email_index" },
    ]);

    // User indexes
    await shopDb.collection("users").createIndexes([
      { key: { email: 1 }, unique: true, name: "email_unique" },
      { key: { role: 1 }, name: "role_index" },
    ]);

    logger.info("Database indexes created successfully");
  } catch (error) {
    logger.error("Error creating indexes:", error);
    throw error;
  }
}

/**
 * Main seeding function
 */
async function seedDatabase() {
  try {
    logger.info("Starting database seeding process...");

    // Connect to database
    await connectToDatabase();

    // Seed system database
    await seedSystemDatabase();

    // Seed each shop database
    for (const shop of sampleShops) {
      await seedShopDatabase(shop._id);
    }

    logger.info("✅ Database seeding completed successfully!");
    logger.info("\n📋 Login Credentials:");
    logger.info("Super Admin: superadmin@medicalpos.com / SuperAdmin@123");
    logger.info(
      "Shop Admin (Healthcare Plus): john@healthcareplus.com / Admin@123",
    );
    logger.info(
      "Shop Admin (Medicare Store): sarah@medicarestore.com / Admin@123",
    );
    logger.info("Shop Admin (City Medical): mike@citymedical.com / Admin@123");
  } catch (error) {
    logger.error("❌ Database seeding failed:", error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run seeding if called directly
if (require.main === module) {
  seedDatabase();
}

module.exports = {
  seedDatabase,
  seedSystemDatabase,
  seedShopDatabase,
};
