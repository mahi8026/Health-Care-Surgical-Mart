/**
 * Financial Reports Routes
 * Handles P&L, financial analytics, and business intelligence
 */

const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb");
const {
  authenticate,
  checkShopStatus,
} = require("../middleware/auth-multi-tenant");
const { requirePermission } = require("../utils/rbac");
const { PERMISSIONS } = require("../utils/rbac");
const { getShopDatabase } = require("../config/database");
const { asyncHandler, createError } = require("../config/error-handling");

// Apply authentication to all routes
router.use(authenticate);
router.use(checkShopStatus);

/**
 * GET /api/financial-reports/profit-loss
 * Get Profit & Loss statement
 */
router.get(
  "/profit-loss",
  requirePermission(PERMISSIONS.VIEW_PROFIT_REPORT),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { startDate, endDate, period = "daily" } = req.query;

    // Set default date range if not provided
    const today = new Date();
    const defaultStartDate = startDate
      ? new Date(startDate)
      : new Date(today.getFullYear(), today.getMonth(), 1); // Start of current month
    const defaultEndDate = endDate
      ? new Date(endDate)
      : new Date(today.getFullYear(), today.getMonth() + 1, 0); // End of current month

    // Sales Revenue
    const salesRevenue = await shopDb
      .collection("sales")
      .aggregate([
        {
          $match: {
            saleDate: { $gte: defaultStartDate, $lte: defaultEndDate },
            paymentStatus: "Paid",
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$grandTotal" },
            totalSales: { $sum: 1 },
            totalDiscount: { $sum: "$discount" },
            totalVAT: { $sum: "$vatAmount" },
            netRevenue: { $sum: { $subtract: ["$grandTotal", "$vatAmount"] } },
          },
        },
      ])
      .toArray();

    // Returns Impact
    const returnsImpact = await shopDb
      .collection("returns")
      .aggregate([
        {
          $match: {
            returnDate: { $gte: defaultStartDate, $lte: defaultEndDate },
            status: "completed",
          },
        },
        {
          $group: {
            _id: null,
            totalReturns: { $sum: "$totalRefund" },
            returnCount: { $sum: 1 },
            returnedVAT: { $sum: "$vatAmount" },
          },
        },
      ])
      .toArray();

    // Cost of Goods Sold (COGS)
    const cogs = await shopDb
      .collection("sales")
      .aggregate([
        {
          $match: {
            saleDate: { $gte: defaultStartDate, $lte: defaultEndDate },
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
                $multiply: ["$items.qty", "$product.purchasePrice"],
              },
            },
          },
        },
      ])
      .toArray();

    // Return COGS (add back to inventory)
    const returnCOGS = await shopDb
      .collection("returns")
      .aggregate([
        {
          $match: {
            returnDate: { $gte: defaultStartDate, $lte: defaultEndDate },
            status: "completed",
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
            totalReturnCOGS: {
              $sum: {
                $multiply: ["$items.returnQuantity", "$product.purchasePrice"],
              },
            },
          },
        },
      ])
      .toArray();

    // Calculate financial metrics
    const revenue = salesRevenue[0] || {};
    const returns = returnsImpact[0] || {};
    const costOfGoods = cogs[0] || {};
    const returnedCosts = returnCOGS[0] || {};

    const grossRevenue = revenue.totalRevenue || 0;
    const totalReturns = returns.totalReturns || 0;
    const netRevenue = grossRevenue - totalReturns;

    const totalCOGS =
      (costOfGoods.totalCOGS || 0) - (returnedCosts.totalReturnCOGS || 0);
    const grossProfit = netRevenue - totalCOGS;
    const grossProfitMargin =
      netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;

    // Operating Expenses - calculate from actual expense data
    const expenseData = await shopDb
      .collection("expenses")
      .aggregate([
        {
          $match: {
            expenseDate: { $gte: defaultStartDate, $lte: defaultEndDate },
          },
        },
        {
          $group: {
            _id: null,
            totalExpenses: { $sum: "$amount" },
            expenseCount: { $sum: 1 },
          },
        },
      ])
      .toArray();

    // Expense breakdown by category
    const expensesByCategory = await shopDb
      .collection("expenses")
      .aggregate([
        {
          $match: {
            expenseDate: { $gte: defaultStartDate, $lte: defaultEndDate },
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
      ])
      .toArray();

    const operatingExpenses = expenseData[0]?.totalExpenses || 0;
    const netProfit = grossProfit - operatingExpenses;
    const netProfitMargin = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;

    const profitLoss = {
      period: {
        startDate: defaultStartDate,
        endDate: defaultEndDate,
        period,
      },
      revenue: {
        grossRevenue,
        totalSales: revenue.totalSales || 0,
        totalDiscount: revenue.totalDiscount || 0,
        totalVAT: revenue.totalVAT || 0,
        returns: {
          totalReturns,
          returnCount: returns.returnCount || 0,
          returnedVAT: returns.returnedVAT || 0,
        },
        netRevenue,
      },
      costs: {
        costOfGoodsSold: totalCOGS,
        operatingExpenses,
        expenseBreakdown: expensesByCategory.map((expense) => ({
          categoryId: expense._id,
          categoryName: expense.categoryName,
          categoryType: expense.categoryType,
          totalAmount: expense.totalAmount,
          expenseCount: expense.expenseCount,
        })),
        totalCosts: totalCOGS + operatingExpenses,
      },
      profit: {
        grossProfit,
        grossProfitMargin,
        netProfit,
        netProfitMargin,
      },
      metrics: {
        averageOrderValue:
          revenue.totalSales > 0 ? grossRevenue / revenue.totalSales : 0,
        returnRate:
          revenue.totalSales > 0
            ? ((returns.returnCount || 0) / revenue.totalSales) * 100
            : 0,
        profitPerSale:
          revenue.totalSales > 0 ? netProfit / revenue.totalSales : 0,
      },
    };

    res.json({
      success: true,
      data: profitLoss,
    });
  }),
);

/**
 * GET /api/financial-reports/daily-summary
 * Get daily financial summary
 */
router.get(
  "/daily-summary",
  requirePermission(PERMISSIONS.VIEW_SALES_REPORT),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { date } = req.query;

    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate(),
    );
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    // Daily sales summary
    const dailySales = await shopDb
      .collection("sales")
      .aggregate([
        {
          $match: {
            saleDate: { $gte: startOfDay, $lt: endOfDay },
            paymentStatus: "Paid",
          },
        },
        {
          $group: {
            _id: null,
            totalSales: { $sum: 1 },
            totalRevenue: { $sum: "$grandTotal" },
            totalDiscount: { $sum: "$discount" },
            totalVAT: { $sum: "$vatAmount" },
            cashSales: {
              $sum: {
                $cond: [{ $gt: ["$cashPaid", 0] }, "$cashPaid", 0],
              },
            },
            bankSales: {
              $sum: {
                $cond: [{ $gt: ["$bankPaid", 0] }, "$bankPaid", 0],
              },
            },
          },
        },
      ])
      .toArray();

    // Daily returns summary
    const dailyReturns = await shopDb
      .collection("returns")
      .aggregate([
        {
          $match: {
            returnDate: { $gte: startOfDay, $lt: endOfDay },
            status: "completed",
          },
        },
        {
          $group: {
            _id: null,
            totalReturns: { $sum: 1 },
            totalRefund: { $sum: "$totalRefund" },
          },
        },
      ])
      .toArray();

    // Daily expenses summary
    const dailyExpenses = await shopDb
      .collection("expenses")
      .aggregate([
        {
          $match: {
            expenseDate: { $gte: startOfDay, $lt: endOfDay },
          },
        },
        {
          $group: {
            _id: null,
            totalExpenses: { $sum: 1 },
            totalAmount: { $sum: "$amount" },
            cashExpenses: {
              $sum: {
                $cond: [{ $eq: ["$paymentMethod", "cash"] }, "$amount", 0],
              },
            },
            bankExpenses: {
              $sum: {
                $cond: [{ $eq: ["$paymentMethod", "bank"] }, "$amount", 0],
              },
            },
            cardExpenses: {
              $sum: {
                $cond: [{ $eq: ["$paymentMethod", "card"] }, "$amount", 0],
              },
            },
          },
        },
      ])
      .toArray();

    // Top expense categories today
    const topExpenseCategories = await shopDb
      .collection("expenses")
      .aggregate([
        {
          $match: {
            expenseDate: { $gte: startOfDay, $lt: endOfDay },
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
            totalAmount: { $sum: "$amount" },
            expenseCount: { $sum: 1 },
          },
        },
        { $sort: { totalAmount: -1 } },
        { $limit: 5 },
      ])
      .toArray();
    const topProducts = await shopDb
      .collection("sales")
      .aggregate([
        {
          $match: {
            saleDate: { $gte: startOfDay, $lt: endOfDay },
            paymentStatus: "Paid",
          },
        },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.productId",
            productName: { $first: "$items.name" },
            totalQuantity: { $sum: "$items.qty" },
            totalRevenue: { $sum: "$items.total" },
          },
        },
        { $sort: { totalQuantity: -1 } },
        { $limit: 5 },
      ])
      .toArray();

    // Hourly sales pattern
    const hourlySales = await shopDb
      .collection("sales")
      .aggregate([
        {
          $match: {
            saleDate: { $gte: startOfDay, $lt: endOfDay },
            paymentStatus: "Paid",
          },
        },
        {
          $group: {
            _id: { $hour: "$saleDate" },
            sales: { $sum: 1 },
            revenue: { $sum: "$grandTotal" },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .toArray();

    const sales = dailySales[0] || {};
    const returns = dailyReturns[0] || {};
    const expenses = dailyExpenses[0] || {};

    const summary = {
      date: targetDate,
      sales: {
        count: sales.totalSales || 0,
        revenue: sales.totalRevenue || 0,
        discount: sales.totalDiscount || 0,
        vat: sales.totalVAT || 0,
        cash: sales.cashSales || 0,
        bank: sales.bankSales || 0,
      },
      returns: {
        count: returns.totalReturns || 0,
        refund: returns.totalRefund || 0,
      },
      expenses: {
        count: expenses.totalExpenses || 0,
        amount: expenses.totalAmount || 0,
        cash: expenses.cashExpenses || 0,
        bank: expenses.bankExpenses || 0,
        card: expenses.cardExpenses || 0,
      },
      net: {
        revenue: (sales.totalRevenue || 0) - (returns.totalRefund || 0),
        cashFlow:
          (sales.cashSales || 0) -
          (returns.totalRefund || 0) -
          (expenses.cashExpenses || 0),
        transactions:
          (sales.totalSales || 0) +
          (returns.totalReturns || 0) +
          (expenses.totalExpenses || 0),
      },
      topProducts,
      topExpenseCategories: topExpenseCategories.map((category) => ({
        categoryId: category._id,
        categoryName: category.categoryName,
        totalAmount: category.totalAmount,
        expenseCount: category.expenseCount,
      })),
      hourlySales: hourlySales.map((hour) => ({
        hour: hour._id,
        sales: hour.sales,
        revenue: hour.revenue,
      })),
    };

    res.json({
      success: true,
      data: summary,
    });
  }),
);

/**
 * GET /api/financial-reports/product-profitability
 * Get product profitability analysis
 */
router.get(
  "/product-profitability",
  requirePermission(PERMISSIONS.VIEW_PROFIT_REPORT),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { startDate, endDate, limit = 20 } = req.query;

    const today = new Date();
    const defaultStartDate = startDate
      ? new Date(startDate)
      : new Date(today.getFullYear(), today.getMonth(), 1);
    const defaultEndDate = endDate
      ? new Date(endDate)
      : new Date(today.getFullYear(), today.getMonth() + 1, 0);

    // Product profitability analysis
    const productProfitability = await shopDb
      .collection("sales")
      .aggregate([
        {
          $match: {
            saleDate: { $gte: defaultStartDate, $lte: defaultEndDate },
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
            _id: "$items.productId",
            productName: { $first: "$items.name" },
            sku: { $first: "$product.sku" },
            category: { $first: "$product.category" },
            totalQuantitySold: { $sum: "$items.qty" },
            totalRevenue: { $sum: "$items.total" },
            averageSellingPrice: { $avg: "$items.price" },
            purchasePrice: { $first: "$product.purchasePrice" },
            totalCost: {
              $sum: {
                $multiply: ["$items.qty", "$product.purchasePrice"],
              },
            },
          },
        },
        {
          $addFields: {
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
            profitPerUnit: {
              $cond: [
                { $gt: ["$totalQuantitySold", 0] },
                {
                  $divide: [
                    { $subtract: ["$totalRevenue", "$totalCost"] },
                    "$totalQuantitySold",
                  ],
                },
                0,
              ],
            },
          },
        },
        { $sort: { grossProfit: -1 } },
        { $limit: parseInt(limit) },
      ])
      .toArray();

    // Category profitability
    const categoryProfitability = await shopDb
      .collection("sales")
      .aggregate([
        {
          $match: {
            saleDate: { $gte: defaultStartDate, $lte: defaultEndDate },
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
            _id: "$product.category",
            totalRevenue: { $sum: "$items.total" },
            totalCost: {
              $sum: {
                $multiply: ["$items.qty", "$product.purchasePrice"],
              },
            },
            totalQuantity: { $sum: "$items.qty" },
            productCount: { $addToSet: "$items.productId" },
          },
        },
        {
          $addFields: {
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
            productCount: { $size: "$productCount" },
          },
        },
        { $sort: { grossProfit: -1 } },
      ])
      .toArray();

    res.json({
      success: true,
      data: {
        period: {
          startDate: defaultStartDate,
          endDate: defaultEndDate,
        },
        products: productProfitability,
        categories: categoryProfitability,
        summary: {
          totalProducts: productProfitability.length,
          totalCategories: categoryProfitability.length,
          mostProfitableProduct: productProfitability[0] || null,
          mostProfitableCategory: categoryProfitability[0] || null,
        },
      },
    });
  }),
);

/**
 * GET /api/financial-reports/return-analysis
 * Get return impact analysis
 */
router.get(
  "/return-analysis",
  requirePermission(PERMISSIONS.VIEW_RETURNS),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { startDate, endDate } = req.query;

    const today = new Date();
    const defaultStartDate = startDate
      ? new Date(startDate)
      : new Date(today.getFullYear(), today.getMonth(), 1);
    const defaultEndDate = endDate
      ? new Date(endDate)
      : new Date(today.getFullYear(), today.getMonth() + 1, 0);

    // Return analysis by reason
    const returnsByReason = await shopDb
      .collection("returns")
      .aggregate([
        {
          $match: {
            returnDate: { $gte: defaultStartDate, $lte: defaultEndDate },
            status: "completed",
          },
        },
        {
          $group: {
            _id: "$returnReason",
            count: { $sum: 1 },
            totalRefund: { $sum: "$totalRefund" },
            averageRefund: { $avg: "$totalRefund" },
          },
        },
        { $sort: { count: -1 } },
      ])
      .toArray();

    // Return analysis by product
    const returnsByProduct = await shopDb
      .collection("returns")
      .aggregate([
        {
          $match: {
            returnDate: { $gte: defaultStartDate, $lte: defaultEndDate },
            status: "completed",
          },
        },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.productId",
            productName: { $first: "$items.name" },
            sku: { $first: "$items.sku" },
            totalReturned: { $sum: "$items.returnQuantity" },
            totalRefund: { $sum: "$items.total" },
            returnCount: { $sum: 1 },
          },
        },
        { $sort: { totalReturned: -1 } },
        { $limit: 10 },
      ])
      .toArray();

    // Monthly return trend
    const monthlyTrend = await shopDb
      .collection("returns")
      .aggregate([
        {
          $match: {
            returnDate: {
              $gte: new Date(defaultStartDate.getFullYear() - 1, 0, 1),
            },
            status: "completed",
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$returnDate" },
              month: { $month: "$returnDate" },
            },
            count: { $sum: 1 },
            totalRefund: { $sum: "$totalRefund" },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ])
      .toArray();

    // Return rate calculation
    const totalSales = await shopDb.collection("sales").countDocuments({
      saleDate: { $gte: defaultStartDate, $lte: defaultEndDate },
      paymentStatus: "Paid",
    });

    const totalReturns = await shopDb.collection("returns").countDocuments({
      returnDate: { $gte: defaultStartDate, $lte: defaultEndDate },
      status: "completed",
    });

    const returnRate = totalSales > 0 ? (totalReturns / totalSales) * 100 : 0;

    // Financial impact
    const totalRefundAmount = returnsByReason.reduce(
      (sum, item) => sum + item.totalRefund,
      0,
    );
    const totalSalesRevenue = await shopDb
      .collection("sales")
      .aggregate([
        {
          $match: {
            saleDate: { $gte: defaultStartDate, $lte: defaultEndDate },
            paymentStatus: "Paid",
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$grandTotal" },
          },
        },
      ])
      .toArray();

    const revenueImpact =
      totalSalesRevenue[0]?.totalRevenue > 0
        ? (totalRefundAmount / totalSalesRevenue[0].totalRevenue) * 100
        : 0;

    res.json({
      success: true,
      data: {
        period: {
          startDate: defaultStartDate,
          endDate: defaultEndDate,
        },
        summary: {
          totalReturns,
          totalRefundAmount,
          returnRate,
          revenueImpact,
          averageRefundAmount:
            totalReturns > 0 ? totalRefundAmount / totalReturns : 0,
        },
        byReason: returnsByReason,
        byProduct: returnsByProduct,
        monthlyTrend: monthlyTrend.map((item) => ({
          year: item._id.year,
          month: item._id.month,
          count: item.count,
          totalRefund: item.totalRefund,
        })),
      },
    });
  }),
);

/**
 * GET /api/financial-reports/cash-flow
 * Get cash flow analysis
 */
router.get(
  "/cash-flow",
  requirePermission(PERMISSIONS.VIEW_PROFIT_REPORT),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { startDate, endDate } = req.query;

    const today = new Date();
    const defaultStartDate = startDate
      ? new Date(startDate)
      : new Date(today.getFullYear(), today.getMonth(), 1);
    const defaultEndDate = endDate
      ? new Date(endDate)
      : new Date(today.getFullYear(), today.getMonth() + 1, 0);

    // Cash inflows (sales)
    const cashInflows = await shopDb
      .collection("sales")
      .aggregate([
        {
          $match: {
            saleDate: { $gte: defaultStartDate, $lte: defaultEndDate },
            paymentStatus: "Paid",
          },
        },
        {
          $group: {
            _id: null,
            totalCashSales: { $sum: "$cashPaid" },
            totalBankSales: { $sum: "$bankPaid" },
            totalSales: { $sum: "$grandTotal" },
          },
        },
      ])
      .toArray();

    // Cash outflows (returns and expenses)
    const cashOutflows = await shopDb
      .collection("returns")
      .aggregate([
        {
          $match: {
            returnDate: { $gte: defaultStartDate, $lte: defaultEndDate },
            status: "completed",
          },
        },
        {
          $group: {
            _id: "$refundMethod",
            totalRefund: { $sum: "$totalRefund" },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    // Expense outflows by payment method
    const expenseOutflows = await shopDb
      .collection("expenses")
      .aggregate([
        {
          $match: {
            expenseDate: { $gte: defaultStartDate, $lte: defaultEndDate },
          },
        },
        {
          $group: {
            _id: "$paymentMethod",
            totalExpenses: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    // Purchase outflows
    const purchaseOutflows = await shopDb
      .collection("purchases")
      .aggregate([
        {
          $match: {
            purchaseDate: { $gte: defaultStartDate, $lte: defaultEndDate },
            paymentStatus: { $in: ["Paid", "Partial"] },
          },
        },
        {
          $group: {
            _id: null,
            totalPurchases: { $sum: "$totalAmount" },
            paidAmount: { $sum: "$paidAmount" },
          },
        },
      ])
      .toArray();

    // Daily cash flow
    const dailyCashFlow = await shopDb
      .collection("sales")
      .aggregate([
        {
          $match: {
            saleDate: { $gte: defaultStartDate, $lte: defaultEndDate },
            paymentStatus: "Paid",
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$saleDate" },
            },
            cashIn: { $sum: "$grandTotal" },
            salesCount: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .toArray();

    const inflows = cashInflows[0] || {};
    const purchases = purchaseOutflows[0] || {};

    const totalCashRefunds = cashOutflows
      .filter((item) => item._id === "cash")
      .reduce((sum, item) => sum + item.totalRefund, 0);

    const totalCashExpenses = expenseOutflows
      .filter((item) => item._id === "cash")
      .reduce((sum, item) => sum + item.totalExpenses, 0);

    const totalBankExpenses = expenseOutflows
      .filter((item) => item._id === "bank")
      .reduce((sum, item) => sum + item.totalExpenses, 0);

    const totalCardExpenses = expenseOutflows
      .filter((item) => item._id === "card")
      .reduce((sum, item) => sum + item.totalExpenses, 0);

    const totalExpenseOutflows =
      totalCashExpenses + totalBankExpenses + totalCardExpenses;

    const netCashFlow =
      (inflows.totalCashSales || 0) -
      totalCashRefunds -
      totalCashExpenses -
      (purchases.paidAmount || 0);

    res.json({
      success: true,
      data: {
        period: {
          startDate: defaultStartDate,
          endDate: defaultEndDate,
        },
        inflows: {
          totalSales: inflows.totalSales || 0,
          cashSales: inflows.totalCashSales || 0,
          bankSales: inflows.totalBankSales || 0,
        },
        outflows: {
          returns: cashOutflows,
          expenses: expenseOutflows.map((expense) => ({
            paymentMethod: expense._id,
            totalExpenses: expense.totalExpenses,
            count: expense.count,
          })),
          purchases: purchases.paidAmount || 0,
          totalOutflows:
            totalCashRefunds +
            totalExpenseOutflows +
            (purchases.paidAmount || 0),
        },
        netCashFlow,
        dailyCashFlow: dailyCashFlow.map((day) => ({
          date: day._id,
          cashIn: day.cashIn,
          salesCount: day.salesCount,
        })),
      },
    });
  }),
);

module.exports = router;
