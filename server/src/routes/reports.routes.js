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

/**
 * GET /api/reports/financial/profit-loss
 * Get profit and loss statement
 */
router.get(
  "/financial/profit-loss",
  requirePermission(PERMISSIONS.VIEW_SALES_REPORT),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    // Get sales data
    const salesData = await shopDb
      .collection("sales")
      .aggregate([
        {
          $match: {
            ...(Object.keys(dateFilter).length > 0 && {
              saleDate: dateFilter,
            }),
            paymentStatus: "Paid",
          },
        },
        {
          $group: {
            _id: null,
            totalSales: { $sum: 1 },
            grossRevenue: { $sum: "$totalAmount" },
            totalVAT: { $sum: "$vatAmount" },
            totalDiscount: { $sum: "$discountAmount" },
          },
        },
      ])
      .toArray();

    // Get returns data
    const returnsData = await shopDb
      .collection("returns")
      .aggregate([
        {
          $match: {
            ...(Object.keys(dateFilter).length > 0 && {
              returnDate: dateFilter,
            }),
            status: "Approved",
          },
        },
        {
          $group: {
            _id: null,
            totalReturns: { $sum: 1 },
            totalRefund: { $sum: "$refundAmount" },
          },
        },
      ])
      .toArray();

    // Get expenses data
    const expensesData = await shopDb
      .collection("expenses")
      .aggregate([
        {
          $match: {
            ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
          },
        },
        {
          $group: {
            _id: null,
            totalExpenses: { $sum: "$amount" },
          },
        },
      ])
      .toArray();

    // Get COGS (Cost of Goods Sold)
    const cogsData = await shopDb
      .collection("sales")
      .aggregate([
        {
          $match: {
            ...(Object.keys(dateFilter).length > 0 && {
              saleDate: dateFilter,
            }),
            paymentStatus: "Paid",
          },
        },
        { $unwind: "$items" },
        {
          $lookup: {
            from: "products",
            localField: "items.productId",
            foreignField: "_id",
            as: "product",
          },
        },
        { $unwind: "$product" },
        {
          $group: {
            _id: null,
            totalCOGS: {
              $sum: {
                $multiply: ["$items.quantity", "$product.purchasePrice"],
              },
            },
          },
        },
      ])
      .toArray();

    const sales = salesData[0] || {
      totalSales: 0,
      grossRevenue: 0,
      totalVAT: 0,
      totalDiscount: 0,
    };
    const returns = returnsData[0] || { totalReturns: 0, totalRefund: 0 };
    const expenses = expensesData[0] || { totalExpenses: 0 };
    const cogs = cogsData[0] || { totalCOGS: 0 };

    const netRevenue = sales.grossRevenue - returns.totalRefund;
    const grossProfit = netRevenue - cogs.totalCOGS;
    const netProfit = grossProfit - expenses.totalExpenses;

    res.json({
      success: true,
      data: {
        revenue: {
          grossRevenue: sales.grossRevenue,
          totalSales: sales.totalSales,
          totalVAT: sales.totalVAT,
          totalDiscount: sales.totalDiscount,
          returns: {
            totalReturns: returns.totalRefund,
            count: returns.totalReturns,
          },
          netRevenue,
        },
        costs: {
          costOfGoodsSold: cogs.totalCOGS,
          operatingExpenses: expenses.totalExpenses,
          totalCosts: cogs.totalCOGS + expenses.totalExpenses,
        },
        profit: {
          grossProfit,
          netProfit,
          grossProfitMargin:
            netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0,
          netProfitMargin: netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0,
        },
        metrics: {
          averageOrderValue:
            sales.totalSales > 0 ? netRevenue / sales.totalSales : 0,
          profitPerSale:
            sales.totalSales > 0 ? netProfit / sales.totalSales : 0,
          returnRate:
            sales.totalSales > 0
              ? (returns.totalReturns / sales.totalSales) * 100
              : 0,
        },
      },
    });
  }),
);

/**
 * GET /api/reports/financial/daily-summary
 * Get daily financial summary
 */
router.get(
  "/financial/daily-summary",
  requirePermission(PERMISSIONS.VIEW_SALES_REPORT),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const today = new Date();
    const startOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );

    // Get today's sales
    const salesData = await shopDb
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
            count: { $sum: 1 },
            revenue: { $sum: "$totalAmount" },
            cash: {
              $sum: {
                $cond: [{ $eq: ["$paymentMethod", "Cash"] }, "$totalAmount", 0],
              },
            },
            bank: {
              $sum: {
                $cond: [{ $eq: ["$paymentMethod", "Bank"] }, "$totalAmount", 0],
              },
            },
          },
        },
      ])
      .toArray();

    // Get today's returns
    const returnsData = await shopDb
      .collection("returns")
      .aggregate([
        {
          $match: {
            returnDate: { $gte: startOfDay },
            status: "Approved",
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            refund: { $sum: "$refundAmount" },
          },
        },
      ])
      .toArray();

    // Get hourly sales pattern
    const hourlySales = await shopDb
      .collection("sales")
      .aggregate([
        {
          $match: {
            saleDate: { $gte: startOfDay },
            paymentStatus: "Paid",
          },
        },
        {
          $project: {
            hour: { $hour: "$saleDate" },
          },
        },
        {
          $group: {
            _id: "$hour",
            sales: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            hour: "$_id",
            sales: 1,
          },
        },
        { $sort: { hour: 1 } },
      ])
      .toArray();

    // Get top products today
    const topProducts = await shopDb
      .collection("sales")
      .aggregate([
        {
          $match: {
            saleDate: { $gte: startOfDay },
            paymentStatus: "Paid",
          },
        },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.productId",
            productName: { $first: "$items.productName" },
            totalQuantity: { $sum: "$items.quantity" },
            totalRevenue: { $sum: "$items.subtotal" },
          },
        },
        { $sort: { totalRevenue: -1 } },
        { $limit: 10 },
      ])
      .toArray();

    const sales = salesData[0] || { count: 0, revenue: 0, cash: 0, bank: 0 };
    const returns = returnsData[0] || { count: 0, refund: 0 };

    res.json({
      success: true,
      data: {
        sales,
        returns,
        net: {
          revenue: sales.revenue - returns.refund,
          transactions: sales.count - returns.count,
        },
        hourlySales,
        topProducts,
      },
    });
  }),
);

/**
 * GET /api/reports/financial/product-profitability
 * Get product profitability analysis
 */
router.get(
  "/financial/product-profitability",
  requirePermission(PERMISSIONS.VIEW_SALES_REPORT),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);

    // Get product profitability
    const products = await shopDb
      .collection("sales")
      .aggregate([
        { $match: { paymentStatus: "Paid" } },
        { $unwind: "$items" },
        {
          $lookup: {
            from: "products",
            localField: "items.productId",
            foreignField: "_id",
            as: "product",
          },
        },
        { $unwind: "$product" },
        {
          $group: {
            _id: "$items.productId",
            productName: { $first: "$items.productName" },
            sku: { $first: "$product.sku" },
            category: { $first: "$product.category" },
            totalQuantitySold: { $sum: "$items.quantity" },
            totalRevenue: { $sum: "$items.subtotal" },
            totalCost: {
              $sum: {
                $multiply: ["$items.quantity", "$product.purchasePrice"],
              },
            },
          },
        },
        {
          $project: {
            productName: 1,
            sku: 1,
            category: 1,
            totalQuantitySold: 1,
            totalRevenue: 1,
            totalCost: 1,
            grossProfit: { $subtract: ["$totalRevenue", "$totalCost"] },
            profitMargin: {
              $cond: [
                { $gt: ["$totalRevenue", 0] },
                {
                  $multiply: [
                    {
                      $divide: [
                        { $subtract: ["$totalRevenue", "$totalCost"] },
                        "$totalRevenue",
                      ],
                    },
                    100,
                  ],
                },
                0,
              ],
            },
          },
        },
        { $sort: { grossProfit: -1 } },
        { $limit: 50 },
      ])
      .toArray();

    // Get category profitability
    const categories = await shopDb
      .collection("sales")
      .aggregate([
        { $match: { paymentStatus: "Paid" } },
        { $unwind: "$items" },
        {
          $lookup: {
            from: "products",
            localField: "items.productId",
            foreignField: "_id",
            as: "product",
          },
        },
        { $unwind: "$product" },
        {
          $group: {
            _id: "$product.category",
            productCount: { $addToSet: "$items.productId" },
            totalRevenue: { $sum: "$items.subtotal" },
            totalCost: {
              $sum: {
                $multiply: ["$items.quantity", "$product.purchasePrice"],
              },
            },
          },
        },
        {
          $project: {
            productCount: { $size: "$productCount" },
            totalRevenue: 1,
            totalCost: 1,
            grossProfit: { $subtract: ["$totalRevenue", "$totalCost"] },
            profitMargin: {
              $cond: [
                { $gt: ["$totalRevenue", 0] },
                {
                  $multiply: [
                    {
                      $divide: [
                        { $subtract: ["$totalRevenue", "$totalCost"] },
                        "$totalRevenue",
                      ],
                    },
                    100,
                  ],
                },
                0,
              ],
            },
          },
        },
        { $sort: { grossProfit: -1 } },
      ])
      .toArray();

    res.json({
      success: true,
      data: {
        products,
        categories,
      },
    });
  }),
);

/**
 * GET /api/reports/financial/return-analysis
 * Get return analysis
 */
router.get(
  "/financial/return-analysis",
  requirePermission(PERMISSIONS.VIEW_SALES_REPORT),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);

    // Get total sales for return rate calculation
    const totalSales = await shopDb.collection("sales").countDocuments({
      paymentStatus: "Paid",
    });

    // Get returns summary
    const returnsSummary = await shopDb
      .collection("returns")
      .aggregate([
        { $match: { status: "Approved" } },
        {
          $group: {
            _id: null,
            totalReturns: { $sum: 1 },
            totalRefund: { $sum: "$refundAmount" },
          },
        },
      ])
      .toArray();

    // Get returns by reason
    const byReason = await shopDb
      .collection("returns")
      .aggregate([
        { $match: { status: "Approved" } },
        {
          $group: {
            _id: "$reason",
            count: { $sum: 1 },
            totalRefund: { $sum: "$refundAmount" },
          },
        },
        { $sort: { count: -1 } },
      ])
      .toArray();

    // Get returns by product
    const byProduct = await shopDb
      .collection("returns")
      .aggregate([
        { $match: { status: "Approved" } },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.productId",
            productName: { $first: "$items.productName" },
            returnCount: { $sum: 1 },
            totalQuantity: { $sum: "$items.quantity" },
            totalRefund: { $sum: "$items.subtotal" },
          },
        },
        { $sort: { returnCount: -1 } },
        { $limit: 10 },
      ])
      .toArray();

    const summary = returnsSummary[0] || { totalReturns: 0, totalRefund: 0 };

    res.json({
      success: true,
      data: {
        summary: {
          totalReturns: summary.totalReturns,
          totalRefund: summary.totalRefund,
          returnRate:
            totalSales > 0 ? (summary.totalReturns / totalSales) * 100 : 0,
        },
        byReason,
        byProduct,
      },
    });
  }),
);

/**
 * GET /api/reports/financial/cash-flow
 * Get cash flow analysis
 */
router.get(
  "/financial/cash-flow",
  requirePermission(PERMISSIONS.VIEW_SALES_REPORT),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    // Get cash inflows (sales)
    const cashInflows = await shopDb
      .collection("sales")
      .aggregate([
        {
          $match: {
            ...(Object.keys(dateFilter).length > 0 && {
              saleDate: dateFilter,
            }),
            paymentStatus: "Paid",
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$saleDate" },
            },
            totalInflow: { $sum: "$totalAmount" },
            cash: {
              $sum: {
                $cond: [{ $eq: ["$paymentMethod", "Cash"] }, "$totalAmount", 0],
              },
            },
            bank: {
              $sum: {
                $cond: [{ $eq: ["$paymentMethod", "Bank"] }, "$totalAmount", 0],
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .toArray();

    // Get cash outflows (expenses + purchases)
    const expenses = await shopDb
      .collection("expenses")
      .aggregate([
        {
          $match: {
            ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
            totalExpenses: { $sum: "$amount" },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .toArray();

    const purchases = await shopDb
      .collection("purchases")
      .aggregate([
        {
          $match: {
            ...(Object.keys(dateFilter).length > 0 && {
              purchaseDate: dateFilter,
            }),
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$purchaseDate" },
            },
            totalPurchases: { $sum: "$totalAmount" },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .toArray();

    // Calculate net cash flow
    const cashFlowData = {};

    cashInflows.forEach((item) => {
      if (!cashFlowData[item._id]) {
        cashFlowData[item._id] = {
          date: item._id,
          inflow: 0,
          outflow: 0,
          netFlow: 0,
        };
      }
      cashFlowData[item._id].inflow = item.totalInflow;
    });

    expenses.forEach((item) => {
      if (!cashFlowData[item._id]) {
        cashFlowData[item._id] = {
          date: item._id,
          inflow: 0,
          outflow: 0,
          netFlow: 0,
        };
      }
      cashFlowData[item._id].outflow += item.totalExpenses;
    });

    purchases.forEach((item) => {
      if (!cashFlowData[item._id]) {
        cashFlowData[item._id] = {
          date: item._id,
          inflow: 0,
          outflow: 0,
          netFlow: 0,
        };
      }
      cashFlowData[item._id].outflow += item.totalPurchases;
    });

    // Calculate net flow
    Object.keys(cashFlowData).forEach((date) => {
      cashFlowData[date].netFlow =
        cashFlowData[date].inflow - cashFlowData[date].outflow;
    });

    const cashFlowArray = Object.values(cashFlowData).sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    res.json({
      success: true,
      data: {
        cashFlow: cashFlowArray,
        summary: {
          totalInflow: cashFlowArray.reduce(
            (sum, item) => sum + item.inflow,
            0,
          ),
          totalOutflow: cashFlowArray.reduce(
            (sum, item) => sum + item.outflow,
            0,
          ),
          netCashFlow: cashFlowArray.reduce(
            (sum, item) => sum + item.netFlow,
            0,
          ),
        },
      },
    });
  }),
);

module.exports = router;
