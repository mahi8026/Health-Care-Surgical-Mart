/**
 * Routes Configuration
 * Centralized route setup for the Medical Store POS System
 */

const { logger } = require("./logging");

/**
 * Setup all application routes
 * @param {Express} app - Express application instance
 */
const setupRoutes = (app) => {
  try {
    // Authentication routes (no auth required)
    logger.info("Loading authentication routes...");
    app.use("/api/auth", require("../routes/auth-multi-tenant.routes"));

    // Test routes (no auth required) - for testing dashboard functionality
    logger.info("Loading test routes...");
    app.use("/api/test", require("../routes/test.routes"));

    // Super admin routes (super admin auth required)
    logger.info("Loading super admin routes...");
    app.use("/api/super-admin", require("../routes/super-admin.routes"));

    // Protected routes (shop-level auth required)
    logger.info("Loading protected routes...");

    // Products routes
    app.use("/api/products", require("../routes/products.routes"));

    // Categories routes
    app.use("/api/categories", require("../routes/categories.routes"));

    // Sales routes
    app.use("/api/sales", require("../routes/sales.routes"));

    // Customers routes
    app.use("/api/customers", require("../routes/customers.routes"));

    // Suppliers routes
    app.use("/api/suppliers", require("../routes/suppliers.routes"));

    // Stock routes
    app.use("/api/stock", require("../routes/stock.routes"));

    // Reports routes
    app.use("/api/reports", require("../routes/reports.routes"));

    // Users routes
    app.use("/api/users", require("../routes/users.routes"));

    // Purchases routes
    app.use("/api/purchases", require("../routes/purchases.routes"));

    // Settings routes
    app.use("/api/settings", require("../routes/settings.routes"));

    // Returns routes
    app.use("/api/returns", require("../routes/returns.routes"));

    // Financial Reports routes
    app.use(
      "/api/financial-reports",
      require("../routes/financial-reports.routes"),
    );

    // Expense Categories routes
    app.use(
      "/api/expense-categories",
      require("../routes/expense-categories.routes"),
    );

    // Expenses routes
    app.use("/api/expenses", require("../routes/expenses.routes"));

    // Recurring Expenses routes
    app.use(
      "/api/recurring-expenses",
      require("../routes/recurring-expenses.routes"),
    );

    // Expense Analytics routes
    app.use(
      "/api/expense-analytics",
      require("../routes/expense-analytics.routes"),
    );

    // Bulk Products routes
    logger.info("Loading bulk products routes...");
    app.use("/api/bulk-products", require("../routes/bulk-products.routes"));

    // Notifications routes
    logger.info("Loading notifications routes...");
    app.use("/api/notifications", require("../routes/notifications.routes"));

    // Test route (no auth required)
    app.get("/api/test", (req, res) => {
      res.json({
        success: true,
        message: "API is working",
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || "2.0.0",
      });
    });

    // Debug route for development
    if (process.env.NODE_ENV !== "production") {
      app.get("/api/debug-token", (req, res) => {
        const authHeader = req.headers.authorization;
        res.json({
          success: true,
          authHeader: authHeader || "No authorization header",
          user: req.user || "No user in request",
          shopId: req.shopId || "No shop ID",
        });
      });
    }

    logger.info("All routes loaded successfully");
  } catch (error) {
    logger.error("Error loading routes:", error);
    throw error;
  }
};

module.exports = {
  setupRoutes,
};
