/**
 * Reports Routes - Multi-Tenant
 * Handles dashboard and reporting functionality
 */

const express = require("express");
const router = express.Router();
const {
  authenticate,
  checkShopStatus,
} = require("../middleware/auth-multi-tenant");
const { requirePermission } = require("../utils/rbac");
const { PERMISSIONS } = require("../utils/rbac");
const { getShopDatabase } = require("../config/database");
const { asyncHandler } = require("../config/error-handling");

// Apply authentication and shop status check to all routes
router.use(authenticate);
router.use(checkShopStatus);

/**
 * GET /api/reports/dashboard
 * Get dashboard statistics
 */
router.get(
  "/dashboard",
  requirePermission(PERMISSIONS.VIEW_SALES_REPORT),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);

    const today = new Date();
    const startOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    // Get today's sales
    const todaySales = await shopDb
      .collection("sales")
      .aggregate([
        {
          $match: {
            saleDate: { $gte: startOfDay },
            paymentStatus: "Paid",
          },
        },
        {
          $group: {
            _id: null,
            totalSales: { $sum: "$grandTotal" },
            totalOrders: { $sum: 1 },
            avgOrderValue: { $avg: "$grandTotal" },
          },
        },
      ])
      .toArray();

    // Get weekly sales
    const weeklySales = await shopDb
      .collection("sales")
      .aggregate([
        {
          $match: {
            saleDate: { $gte: startOfWeek },
            paymentStatus: "Paid",
          },
        },
        {
          $group: {
            _id: null,
            totalSales: { $sum: "$grandTotal" },
            totalOrders: { $sum: 1 },
          },
        },
      ])
      .toArray();

    // Get monthly sales
    const monthlySales = await shopDb
      .collection("sales")
      .aggregate([
        {
          $match: {
            saleDate: { $gte: startOfMonth },
            paymentStatus: "Paid",
          },
        },
        {
          $group: {
            _id: null,
            totalSales: { $sum: "$grandTotal" },
            totalOrders: { $sum: 1 },
          },
        },
      ])
      .toArray();

    // Get total products count
    const totalProducts = await shopDb
      .collection("products")
      .countDocuments({ isActive: true });

    // Get low stock products
    const lowStockProducts = await shopDb
      .collection("stock")
      .aggregate([
        {
          $match: {
            isLowStock: true,
          },
        },
        {
          $lookup: {
            from: "products",
            localField: "productId",
            foreignField: "_id",
            as: "product",
          },
        },
        {
          $unwind: "$product",
        },
        {
          $match: {
            "product.isActive": true,
          },
        },
        {
          $project: {
            productName: "$product.name",
            currentQty: 1,
            minStockLevel: 1,
            product: {
              name: 1,
              sku: 1,
              category: 1,
            },
          },
        },
        {
          $sort: { currentQty: 1 },
        },
        {
          $limit: 10,
        },
      ])
      .toArray();

    // Get top selling products (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const topProducts = await shopDb
      .collection("sales")
      .aggregate([
        {
          $match: {
            saleDate: { $gte: thirtyDaysAgo },
            paymentStatus: "Paid",
          },
        },
        {
          $unwind: "$items",
        },
        {
          $group: {
            _id: "$items.productId",
            totalQuantity: { $sum: "$items.qty" },
            totalRevenue: { $sum: "$items.total" },
            productName: { $first: "$items.name" },
          },
        },
        {
          $sort: { totalQuantity: -1 },
        },
        {
          $limit: 5,
        },
      ])
      .toArray();

    // Get today's expenses
    const todayExpenses = await shopDb
      .collection("expenses")
      .aggregate([
        {
          $match: {
            expenseDate: { $gte: startOfDay },
          },
        },
        {
          $group: {
            _id: null,
            totalExpenses: { $sum: "$amount" },
            totalCount: { $sum: 1 },
            avgExpenseAmount: { $avg: "$amount" },
          },
        },
      ])
      .toArray();

    // Get weekly expenses
    const weeklyExpenses = await shopDb
      .collection("expenses")
      .aggregate([
        {
          $match: {
            expenseDate: { $gte: startOfWeek },
          },
        },
        {
          $group: {
            _id: null,
            totalExpenses: { $sum: "$amount" },
            totalCount: { $sum: 1 },
          },
        },
      ])
      .toArray();

    // Get monthly expenses
    const monthlyExpenses = await shopDb
      .collection("expenses")
      .aggregate([
        {
          $match: {
            expenseDate: { $gte: startOfMonth },
          },
        },
        {
          $group: {
            _id: null,
            totalExpenses: { $sum: "$amount" },
            totalCount: { $sum: 1 },
          },
        },
      ])
      .toArray();

    // Get top expense categories (current month)
    const topExpenseCategories = await shopDb
      .collection("expenses")
      .aggregate([
        {
          $match: {
            expenseDate: { $gte: startOfMonth },
          },
        },
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
          $group: {
            _id: "$categoryId",
            categoryName: { $first: "$category.name" },
            categoryType: { $first: "$category.type" },
            totalAmount: { $sum: "$amount" },
            expenseCount: { $sum: 1 },
          },
        },
        { $sort: { totalAmount: -1 } },
        { $limit: 5 },
      ])
      .toArray();

    const dashboardStats = {
      todaySales: {
        totalSales: todaySales[0]?.totalSales || 0,
        totalOrders: todaySales[0]?.totalOrders || 0,
        avgOrderValue: todaySales[0]?.avgOrderValue || 0,
      },
      weeklySales: {
        totalSales: weeklySales[0]?.totalSales || 0,
        totalOrders: weeklySales[0]?.totalOrders || 0,
      },
      monthlySales: {
        totalSales: monthlySales[0]?.totalSales || 0,
        totalOrders: monthlySales[0]?.totalOrders || 0,
      },
      todayExpenses: {
        totalExpenses: todayExpenses[0]?.totalExpenses || 0,
        totalCount: todayExpenses[0]?.totalCount || 0,
        avgExpenseAmount: todayExpenses[0]?.avgExpenseAmount || 0,
      },
      weeklyExpenses: {
        totalExpenses: weeklyExpenses[0]?.totalExpenses || 0,
        totalCount: weeklyExpenses[0]?.totalCount || 0,
      },
      monthlyExpenses: {
        totalExpenses: monthlyExpenses[0]?.totalExpenses || 0,
        totalCount: monthlyExpenses[0]?.totalCount || 0,
      },
      netCashFlow: {
        today:
          (todaySales[0]?.totalSales || 0) -
          (todayExpenses[0]?.totalExpenses || 0),
        week:
          (weeklySales[0]?.totalSales || 0) -
          (weeklyExpenses[0]?.totalExpenses || 0),
        month:
          (monthlySales[0]?.totalSales || 0) -
          (monthlyExpenses[0]?.totalExpenses || 0),
      },
      totalProducts,
      lowStockProducts: lowStockProducts,
      topProducts: topProducts,
      topExpenseCategories: topExpenseCategories.map((category) => ({
        categoryId: category._id,
        categoryName: category.categoryName,
        categoryType: category.categoryType,
        totalAmount: category.totalAmount,
        expenseCount: category.expenseCount,
      })),
    };

    res.json({
      success: true,
      data: dashboardStats,
    });
  }),
);

/**
 * GET /api/reports/stock-valuation
 * Get stock valuation report
 */
router.get(
  "/stock-valuation",
  requirePermission(PERMISSIONS.VIEW_STOCK_REPORT),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);

    const stockValuation = await shopDb
      .collection("stock")
      .aggregate([
        {
          $lookup: {
            from: "products",
            localField: "productId",
            foreignField: "_id",
            as: "product",
          },
        },
        {
          $unwind: "$product",
        },
        {
          $match: {
            "product.isActive": true,
            currentQty: { $gt: 0 },
          },
        },
        {
          $project: {
            productName: "$product.name",
            sku: "$product.sku",
            category: "$product.category",
            currentQty: 1,
            purchasePrice: "$product.purchasePrice",
            sellingPrice: "$product.sellingPrice",
            purchaseValue: {
              $multiply: ["$currentQty", "$product.purchasePrice"],
            },
            sellingValue: {
              $multiply: ["$currentQty", "$product.sellingPrice"],
            },
          },
        },
        {
          $sort: { sellingValue: -1 },
        },
      ])
      .toArray();

    // Calculate totals
    const totals = stockValuation.reduce(
      (acc, item) => {
        acc.totalPurchaseValue += item.purchaseValue;
        acc.totalSellingValue += item.sellingValue;
        acc.totalItems += item.currentQty;
        return acc;
      },
      {
        totalPurchaseValue: 0,
        totalSellingValue: 0,
        totalItems: 0,
      },
    );

    res.json({
      success: true,
      data: {
        items: stockValuation,
        summary: {
          ...totals,
          potentialProfit: totals.totalSellingValue - totals.totalPurchaseValue,
          totalProducts: stockValuation.length,
        },
      },
    });
  }),
);

/**
 * GET /api/reports/stock
 * Get stock report
 */
router.get(
  "/stock",
  requirePermission(PERMISSIONS.VIEW_STOCK_REPORT),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { category, lowStock } = req.query;

    const matchStage = {};
    if (lowStock === "true") {
      matchStage.isLowStock = true;
    }

    const pipeline = [
      {
        $lookup: {
          from: "products",
          localField: "productId",
          foreignField: "_id",
          as: "product",
        },
      },
      {
        $unwind: "$product",
      },
      {
        $match: {
          "product.isActive": true,
          ...matchStage,
        },
      },
    ];

    if (category) {
      pipeline.push({
        $match: {
          "product.category": category,
        },
      });
    }

    pipeline.push(
      {
        $project: {
          productName: "$product.name",
          sku: "$product.sku",
          category: "$product.category",
          brand: "$product.brand",
          unit: "$product.unit",
          currentQty: 1,
          minStockLevel: 1,
          isLowStock: 1,
          lastUpdated: 1,
          lastSaleDate: 1,
          lastPurchaseDate: 1,
          sellingPrice: "$product.sellingPrice",
          purchasePrice: "$product.purchasePrice",
        },
      },
      {
        $sort: { isLowStock: -1, currentQty: 1 },
      },
    );

    const stockReport = await shopDb
      .collection("stock")
      .aggregate(pipeline)
      .toArray();

    res.json({
      success: true,
      count: stockReport.length,
      data: stockReport,
    });
  }),
);

/**
 * GET /api/reports/stock-alerts
 * Get stock alerts and critical items
 */
router.get(
  "/stock-alerts",
  requirePermission(PERMISSIONS.VIEW_STOCK_REPORT),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);

    const pipeline = [
      {
        $lookup: {
          from: "products",
          localField: "productId",
          foreignField: "_id",
          as: "product",
        },
      },
      {
        $unwind: "$product",
      },
      {
        $match: {
          "product.isActive": true,
          $or: [
            { currentQty: 0 }, // Out of stock
            { isLowStock: true }, // Low stock
            {
              $expr: {
                $lte: ["$currentQty", { $multiply: ["$minStockLevel", 0.5] }],
              },
            }, // Critical stock (50% of min level)
          ],
        },
      },
      {
        $project: {
          productName: "$product.name",
          sku: "$product.sku",
          category: "$product.category",
          brand: "$product.brand",
          unit: "$product.unit",
          currentQty: 1,
          minStockLevel: 1,
          isLowStock: 1,
          lastSaleDate: 1,
          lastPurchaseDate: 1,
          alertType: {
            $cond: {
              if: { $eq: ["$currentQty", 0] },
              then: "out_of_stock",
              else: {
                $cond: {
                  if: {
                    $lte: [
                      "$currentQty",
                      { $multiply: ["$minStockLevel", 0.5] },
                    ],
                  },
                  then: "critical",
                  else: "low_stock",
                },
              },
            },
          },
        },
      },
      {
        $sort: {
          alertType: 1, // out_of_stock first, then critical, then low_stock
          currentQty: 1,
        },
      },
    ];

    const stockAlerts = await shopDb
      .collection("stock")
      .aggregate(pipeline)
      .toArray();

    // Group by alert type
    const groupedAlerts = {
      outOfStock: stockAlerts.filter(
        (item) => item.alertType === "out_of_stock",
      ),
      critical: stockAlerts.filter((item) => item.alertType === "critical"),
      lowStock: stockAlerts.filter((item) => item.alertType === "low_stock"),
    };

    res.json({
      success: true,
      data: {
        alerts: stockAlerts,
        grouped: groupedAlerts,
        summary: {
          outOfStockCount: groupedAlerts.outOfStock.length,
          criticalCount: groupedAlerts.critical.length,
          lowStockCount: groupedAlerts.lowStock.length,
          totalAlerts: stockAlerts.length,
        },
      },
    });
  }),
);

/**
 * GET /api/reports/categories
 * Get all product categories for filtering
 */
router.get(
  "/categories",
  requirePermission(PERMISSIONS.VIEW_PRODUCTS),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);

    const categories = await shopDb
      .collection("products")
      .distinct("category", { isActive: true });

    res.json({
      success: true,
      data: categories.filter((cat) => cat && cat.trim() !== ""),
    });
  }),
);

module.exports = router;
