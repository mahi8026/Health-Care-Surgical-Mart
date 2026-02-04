/**
 * Expense Analytics Routes
 * Handles expense analytics, insights, and forecasting
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
 * GET /api/expense-analytics/trends
 * Get expense trend analysis over time
 */
router.get(
  "/trends",
  requirePermission(PERMISSIONS.VIEW_EXPENSES),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { startDate, endDate, period = "monthly", categoryId } = req.query;

    // Set default date range (last 12 months)
    const today = new Date();
    const defaultStartDate = startDate
      ? new Date(startDate)
      : new Date(today.getFullYear() - 1, today.getMonth(), 1);
    const defaultEndDate = endDate
      ? new Date(endDate)
      : new Date(today.getFullYear(), today.getMonth() + 1, 0);

    // Build match query
    let matchQuery = {
      expenseDate: { $gte: defaultStartDate, $lte: defaultEndDate },
    };

    if (categoryId) {
      matchQuery.categoryId = new ObjectId(categoryId);
    }

    // Define grouping based on period
    let groupBy;
    switch (period) {
      case "daily":
        groupBy = {
          year: { $year: "$expenseDate" },
          month: { $month: "$expenseDate" },
          day: { $dayOfMonth: "$expenseDate" },
        };
        break;
      case "weekly":
        groupBy = {
          year: { $year: "$expenseDate" },
          week: { $week: "$expenseDate" },
        };
        break;
      case "yearly":
        groupBy = {
          year: { $year: "$expenseDate" },
        };
        break;
      case "monthly":
      default:
        groupBy = {
          year: { $year: "$expenseDate" },
          month: { $month: "$expenseDate" },
        };
        break;
    }

    // Expense trends aggregation
    const trends = await shopDb
      .collection("expenses")
      .aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: groupBy,
            totalAmount: { $sum: "$amount" },
            expenseCount: { $sum: 1 },
            averageAmount: { $avg: "$amount" },
            minAmount: { $min: "$amount" },
            maxAmount: { $max: "$amount" },
          },
        },
        {
          $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1, "_id.week": 1 },
        },
      ])
      .toArray();

    // Calculate period-over-period changes
    const trendsWithChanges = trends.map((current, index) => {
      const previous = index > 0 ? trends[index - 1] : null;
      let amountChange = 0;
      let countChange = 0;

      if (previous) {
        amountChange =
          previous.totalAmount > 0
            ? ((current.totalAmount - previous.totalAmount) /
                previous.totalAmount) *
              100
            : 0;
        countChange =
          previous.expenseCount > 0
            ? ((current.expenseCount - previous.expenseCount) /
                previous.expenseCount) *
              100
            : 0;
      }

      return {
        ...current,
        amountChange: Math.round(amountChange * 100) / 100,
        countChange: Math.round(countChange * 100) / 100,
      };
    });

    // Calculate overall trend statistics
    const totalAmount = trends.reduce((sum, item) => sum + item.totalAmount, 0);
    const totalCount = trends.reduce((sum, item) => sum + item.expenseCount, 0);
    const averagePerPeriod =
      trends.length > 0 ? totalAmount / trends.length : 0;

    res.json({
      success: true,
      data: {
        period: {
          startDate: defaultStartDate,
          endDate: defaultEndDate,
          period,
        },
        trends: trendsWithChanges,
        summary: {
          totalAmount,
          totalCount,
          averagePerPeriod: Math.round(averagePerPeriod * 100) / 100,
          periodsCount: trends.length,
        },
      },
    });
  }),
);

/**
 * GET /api/expense-analytics/category-distribution
 * Get category-wise expense distribution
 */
router.get(
  "/category-distribution",
  requirePermission(PERMISSIONS.VIEW_EXPENSES),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { startDate, endDate } = req.query;

    // Set default date range (current month)
    const today = new Date();
    const defaultStartDate = startDate
      ? new Date(startDate)
      : new Date(today.getFullYear(), today.getMonth(), 1);
    const defaultEndDate = endDate
      ? new Date(endDate)
      : new Date(today.getFullYear(), today.getMonth() + 1, 0);

    // Category distribution aggregation
    const distribution = await shopDb
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
            averageAmount: { $avg: "$amount" },
            minAmount: { $min: "$amount" },
            maxAmount: { $max: "$amount" },
          },
        },
        { $sort: { totalAmount: -1 } },
      ])
      .toArray();

    // Calculate percentages
    const totalAmount = distribution.reduce(
      (sum, item) => sum + item.totalAmount,
      0,
    );
    const distributionWithPercentages = distribution.map((item) => ({
      ...item,
      percentage:
        totalAmount > 0
          ? Math.round((item.totalAmount / totalAmount) * 10000) / 100
          : 0,
    }));

    // Group by category type
    const byType = distributionWithPercentages.reduce((acc, item) => {
      const type = item.categoryType || "Other";
      if (!acc[type]) {
        acc[type] = {
          totalAmount: 0,
          expenseCount: 0,
          categories: [],
        };
      }
      acc[type].totalAmount += item.totalAmount;
      acc[type].expenseCount += item.expenseCount;
      acc[type].categories.push(item);
      return acc;
    }, {});

    // Calculate type percentages
    Object.keys(byType).forEach((type) => {
      byType[type].percentage =
        totalAmount > 0
          ? Math.round((byType[type].totalAmount / totalAmount) * 10000) / 100
          : 0;
    });

    res.json({
      success: true,
      data: {
        period: {
          startDate: defaultStartDate,
          endDate: defaultEndDate,
        },
        distribution: distributionWithPercentages,
        byType,
        summary: {
          totalAmount,
          totalCategories: distribution.length,
          topCategory: distribution[0] || null,
        },
      },
    });
  }),
);

/**
 * GET /api/expense-analytics/month-over-month
 * Get month-over-month expense comparison
 */
router.get(
  "/month-over-month",
  requirePermission(PERMISSIONS.VIEW_EXPENSES),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { months = 6 } = req.query;

    const today = new Date();
    const startDate = new Date(
      today.getFullYear(),
      today.getMonth() - parseInt(months) + 1,
      1,
    );

    // Monthly comparison aggregation
    const monthlyData = await shopDb
      .collection("expenses")
      .aggregate([
        {
          $match: {
            expenseDate: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$expenseDate" },
              month: { $month: "$expenseDate" },
            },
            totalAmount: { $sum: "$amount" },
            expenseCount: { $sum: 1 },
            averageAmount: { $avg: "$amount" },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ])
      .toArray();

    // Calculate month-over-month changes
    const comparison = monthlyData.map((current, index) => {
      const previous = index > 0 ? monthlyData[index - 1] : null;
      let amountChange = 0;
      let countChange = 0;
      let averageChange = 0;

      if (previous) {
        amountChange =
          previous.totalAmount > 0
            ? ((current.totalAmount - previous.totalAmount) /
                previous.totalAmount) *
              100
            : 0;
        countChange =
          previous.expenseCount > 0
            ? ((current.expenseCount - previous.expenseCount) /
                previous.expenseCount) *
              100
            : 0;
        averageChange =
          previous.averageAmount > 0
            ? ((current.averageAmount - previous.averageAmount) /
                previous.averageAmount) *
              100
            : 0;
      }

      return {
        year: current._id.year,
        month: current._id.month,
        monthName: new Date(
          current._id.year,
          current._id.month - 1,
        ).toLocaleString("default", { month: "long" }),
        totalAmount: current.totalAmount,
        expenseCount: current.expenseCount,
        averageAmount: Math.round(current.averageAmount * 100) / 100,
        changes: {
          amount: Math.round(amountChange * 100) / 100,
          count: Math.round(countChange * 100) / 100,
          average: Math.round(averageChange * 100) / 100,
        },
      };
    });

    // Calculate overall trends
    const totalAmount = monthlyData.reduce(
      (sum, item) => sum + item.totalAmount,
      0,
    );
    const averageMonthlyAmount =
      monthlyData.length > 0 ? totalAmount / monthlyData.length : 0;

    // Find highest and lowest months
    const highestMonth = monthlyData.reduce(
      (max, current) => (current.totalAmount > max.totalAmount ? current : max),
      monthlyData[0] || { totalAmount: 0 },
    );

    const lowestMonth = monthlyData.reduce(
      (min, current) => (current.totalAmount < min.totalAmount ? current : min),
      monthlyData[0] || { totalAmount: 0 },
    );

    res.json({
      success: true,
      data: {
        comparison,
        summary: {
          totalAmount,
          averageMonthlyAmount: Math.round(averageMonthlyAmount * 100) / 100,
          monthsAnalyzed: monthlyData.length,
          highestMonth: {
            year: highestMonth._id?.year,
            month: highestMonth._id?.month,
            amount: highestMonth.totalAmount,
          },
          lowestMonth: {
            year: lowestMonth._id?.year,
            month: lowestMonth._id?.month,
            amount: lowestMonth.totalAmount,
          },
        },
      },
    });
  }),
);

/**
 * GET /api/expense-analytics/expense-ratio
 * Get expense ratio analysis (% of revenue)
 */
router.get(
  "/expense-ratio",
  requirePermission(PERMISSIONS.VIEW_PROFIT_REPORT),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { startDate, endDate } = req.query;

    // Set default date range (current month)
    const today = new Date();
    const defaultStartDate = startDate
      ? new Date(startDate)
      : new Date(today.getFullYear(), today.getMonth(), 1);
    const defaultEndDate = endDate
      ? new Date(endDate)
      : new Date(today.getFullYear(), today.getMonth() + 1, 0);

    // Get total expenses
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

    // Get total revenue from sales
    const revenueData = await shopDb
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
            salesCount: { $sum: 1 },
          },
        },
      ])
      .toArray();

    // Get expense breakdown by category
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

    const totalExpenses = expenseData[0]?.totalExpenses || 0;
    const totalRevenue = revenueData[0]?.totalRevenue || 0;
    const expenseRatio =
      totalRevenue > 0 ? (totalExpenses / totalRevenue) * 100 : 0;

    // Calculate category ratios
    const categoryRatios = expensesByCategory.map((category) => ({
      ...category,
      revenueRatio:
        totalRevenue > 0 ? (category.totalAmount / totalRevenue) * 100 : 0,
      expenseRatio:
        totalExpenses > 0 ? (category.totalAmount / totalExpenses) * 100 : 0,
    }));

    // Monthly expense-to-revenue ratio trend
    const monthlyRatios = await shopDb
      .collection("expenses")
      .aggregate([
        {
          $match: {
            expenseDate: {
              $gte: new Date(
                defaultStartDate.getFullYear(),
                defaultStartDate.getMonth() - 5,
                1,
              ),
            },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$expenseDate" },
              month: { $month: "$expenseDate" },
            },
            totalExpenses: { $sum: "$amount" },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ])
      .toArray();

    // Get corresponding revenue for each month
    const monthlyRevenue = await shopDb
      .collection("sales")
      .aggregate([
        {
          $match: {
            saleDate: {
              $gte: new Date(
                defaultStartDate.getFullYear(),
                defaultStartDate.getMonth() - 5,
                1,
              ),
            },
            paymentStatus: "Paid",
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$saleDate" },
              month: { $month: "$saleDate" },
            },
            totalRevenue: { $sum: "$grandTotal" },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ])
      .toArray();

    // Combine monthly data
    const monthlyTrend = monthlyRatios.map((expenseMonth) => {
      const revenueMonth = monthlyRevenue.find(
        (rev) =>
          rev._id.year === expenseMonth._id.year &&
          rev._id.month === expenseMonth._id.month,
      );

      const revenue = revenueMonth?.totalRevenue || 0;
      const expenses = expenseMonth.totalExpenses;
      const ratio = revenue > 0 ? (expenses / revenue) * 100 : 0;

      return {
        year: expenseMonth._id.year,
        month: expenseMonth._id.month,
        monthName: new Date(
          expenseMonth._id.year,
          expenseMonth._id.month - 1,
        ).toLocaleString("default", { month: "long" }),
        totalExpenses: expenses,
        totalRevenue: revenue,
        expenseRatio: Math.round(ratio * 100) / 100,
      };
    });

    res.json({
      success: true,
      data: {
        period: {
          startDate: defaultStartDate,
          endDate: defaultEndDate,
        },
        summary: {
          totalExpenses,
          totalRevenue,
          expenseRatio: Math.round(expenseRatio * 100) / 100,
          expenseCount: expenseData[0]?.expenseCount || 0,
          salesCount: revenueData[0]?.salesCount || 0,
        },
        categoryRatios,
        monthlyTrend,
      },
    });
  }),
);

module.exports = router;
/**
 * GET /api/expense-analytics/forecast
 * Get expense forecasting based on trends
 */
router.get(
  "/forecast",
  requirePermission(PERMISSIONS.VIEW_EXPENSES),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { months = 3, categoryId, method = "linear" } = req.query;

    const forecastMonths = parseInt(months);
    if (forecastMonths < 1 || forecastMonths > 12) {
      throw createError.badRequest("Forecast months must be between 1 and 12");
    }

    // Get historical data (last 12 months for better accuracy)
    const today = new Date();
    const historicalStartDate = new Date(
      today.getFullYear() - 1,
      today.getMonth(),
      1,
    );
    const historicalEndDate = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0,
    );

    let matchQuery = {
      expenseDate: { $gte: historicalStartDate, $lte: historicalEndDate },
    };

    if (categoryId) {
      matchQuery.categoryId = new ObjectId(categoryId);
    }

    // Get historical monthly data
    const historicalData = await shopDb
      .collection("expenses")
      .aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: {
              year: { $year: "$expenseDate" },
              month: { $month: "$expenseDate" },
            },
            totalAmount: { $sum: "$amount" },
            expenseCount: { $sum: 1 },
            averageAmount: { $avg: "$amount" },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ])
      .toArray();

    if (historicalData.length < 3) {
      throw createError.badRequest(
        "Insufficient historical data for forecasting (minimum 3 months required)",
      );
    }

    // Calculate forecast based on method
    let forecast = [];

    if (method === "linear") {
      // Linear trend forecasting
      const amounts = historicalData.map((d) => d.totalAmount);
      const n = amounts.length;

      // Calculate linear regression
      const xSum = (n * (n + 1)) / 2;
      const ySum = amounts.reduce((sum, val) => sum + val, 0);
      const xySum = amounts.reduce(
        (sum, val, index) => sum + val * (index + 1),
        0,
      );
      const x2Sum = (n * (n + 1) * (2 * n + 1)) / 6;

      const slope = (n * xySum - xSum * ySum) / (n * x2Sum - xSum * xSum);
      const intercept = (ySum - slope * xSum) / n;

      // Generate forecast
      for (let i = 1; i <= forecastMonths; i++) {
        const forecastDate = new Date(
          today.getFullYear(),
          today.getMonth() + i,
          1,
        );
        const predictedAmount = Math.max(0, intercept + slope * (n + i));

        forecast.push({
          year: forecastDate.getFullYear(),
          month: forecastDate.getMonth() + 1,
          monthName: forecastDate.toLocaleString("default", { month: "long" }),
          predictedAmount: Math.round(predictedAmount * 100) / 100,
          confidence: Math.max(0.5, 1 - i * 0.1), // Decreasing confidence over time
          method: "linear",
        });
      }
    } else if (method === "average") {
      // Simple moving average forecasting
      const recentMonths = Math.min(6, historicalData.length);
      const recentData = historicalData.slice(-recentMonths);
      const averageAmount =
        recentData.reduce((sum, d) => sum + d.totalAmount, 0) /
        recentData.length;

      for (let i = 1; i <= forecastMonths; i++) {
        const forecastDate = new Date(
          today.getFullYear(),
          today.getMonth() + i,
          1,
        );

        forecast.push({
          year: forecastDate.getFullYear(),
          month: forecastDate.getMonth() + 1,
          monthName: forecastDate.toLocaleString("default", { month: "long" }),
          predictedAmount: Math.round(averageAmount * 100) / 100,
          confidence: 0.8,
          method: "average",
        });
      }
    } else if (method === "seasonal") {
      // Seasonal forecasting (same month previous year)
      for (let i = 1; i <= forecastMonths; i++) {
        const forecastDate = new Date(
          today.getFullYear(),
          today.getMonth() + i,
          1,
        );
        const sameMonthLastYear = historicalData.find(
          (d) =>
            d._id.month === forecastDate.getMonth() + 1 &&
            d._id.year === forecastDate.getFullYear() - 1,
        );

        // If no data for same month last year, use average
        const averageAmount =
          historicalData.reduce((sum, d) => sum + d.totalAmount, 0) /
          historicalData.length;
        const predictedAmount = sameMonthLastYear
          ? sameMonthLastYear.totalAmount
          : averageAmount;

        forecast.push({
          year: forecastDate.getFullYear(),
          month: forecastDate.getMonth() + 1,
          monthName: forecastDate.toLocaleString("default", { month: "long" }),
          predictedAmount: Math.round(predictedAmount * 100) / 100,
          confidence: sameMonthLastYear ? 0.7 : 0.5,
          method: "seasonal",
        });
      }
    }

    // Calculate forecast summary
    const totalForecast = forecast.reduce(
      (sum, f) => sum + f.predictedAmount,
      0,
    );
    const averageForecast =
      forecast.length > 0 ? totalForecast / forecast.length : 0;
    const historicalAverage =
      historicalData.reduce((sum, d) => sum + d.totalAmount, 0) /
      historicalData.length;
    const forecastChange =
      historicalAverage > 0
        ? ((averageForecast - historicalAverage) / historicalAverage) * 100
        : 0;

    res.json({
      success: true,
      data: {
        forecast,
        historical: historicalData.map((d) => ({
          year: d._id.year,
          month: d._id.month,
          monthName: new Date(d._id.year, d._id.month - 1).toLocaleString(
            "default",
            { month: "long" },
          ),
          totalAmount: d.totalAmount,
          expenseCount: d.expenseCount,
          averageAmount: Math.round(d.averageAmount * 100) / 100,
        })),
        summary: {
          forecastMonths,
          method,
          totalForecast: Math.round(totalForecast * 100) / 100,
          averageForecast: Math.round(averageForecast * 100) / 100,
          historicalAverage: Math.round(historicalAverage * 100) / 100,
          forecastChange: Math.round(forecastChange * 100) / 100,
          dataPoints: historicalData.length,
        },
      },
    });
  }),
);

/**
 * GET /api/expense-analytics/top-categories
 * Get top expense categories with insights
 */
router.get(
  "/top-categories",
  requirePermission(PERMISSIONS.VIEW_EXPENSES),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { startDate, endDate, limit = 10 } = req.query;

    // Set default date range (current month)
    const today = new Date();
    const defaultStartDate = startDate
      ? new Date(startDate)
      : new Date(today.getFullYear(), today.getMonth(), 1);
    const defaultEndDate = endDate
      ? new Date(endDate)
      : new Date(today.getFullYear(), today.getMonth() + 1, 0);

    // Get top categories with detailed analytics
    const topCategories = await shopDb
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
            averageAmount: { $avg: "$amount" },
            minAmount: { $min: "$amount" },
            maxAmount: { $max: "$amount" },
            expenses: {
              $push: {
                amount: "$amount",
                expenseDate: "$expenseDate",
                description: "$description",
              },
            },
          },
        },
        {
          $addFields: {
            // Calculate standard deviation for amount variability
            amountVariability: {
              $stdDevPop: "$expenses.amount",
            },
          },
        },
        { $sort: { totalAmount: -1 } },
        { $limit: parseInt(limit) },
      ])
      .toArray();

    // Calculate insights for each category
    const categoriesWithInsights = topCategories.map((category) => {
      const amounts = category.expenses.map((e) => e.amount);
      const sortedAmounts = amounts.sort((a, b) => a - b);
      const median =
        sortedAmounts.length % 2 === 0
          ? (sortedAmounts[sortedAmounts.length / 2 - 1] +
              sortedAmounts[sortedAmounts.length / 2]) /
            2
          : sortedAmounts[Math.floor(sortedAmounts.length / 2)];

      // Identify spending patterns
      const recentExpenses = category.expenses.filter(
        (e) =>
          new Date(e.expenseDate) >=
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      ).length;

      const isHighVariability =
        category.amountVariability > category.averageAmount * 0.5;
      const isFrequentCategory = category.expenseCount > 5;
      const isHighValue = category.totalAmount > 1000; // Configurable threshold

      return {
        categoryId: category._id,
        categoryName: category.categoryName,
        categoryType: category.categoryType,
        totalAmount: category.totalAmount,
        expenseCount: category.expenseCount,
        averageAmount: Math.round(category.averageAmount * 100) / 100,
        medianAmount: Math.round(median * 100) / 100,
        minAmount: category.minAmount,
        maxAmount: category.maxAmount,
        amountVariability: Math.round(category.amountVariability * 100) / 100,
        recentExpenses,
        insights: {
          isHighVariability,
          isFrequentCategory,
          isHighValue,
          pattern: isFrequentCategory ? "frequent" : "occasional",
          riskLevel:
            isHighVariability && isHighValue
              ? "high"
              : isHighVariability || isHighValue
                ? "medium"
                : "low",
        },
      };
    });

    // Calculate total for percentages
    const totalAmount = categoriesWithInsights.reduce(
      (sum, cat) => sum + cat.totalAmount,
      0,
    );
    const categoriesWithPercentages = categoriesWithInsights.map((cat) => ({
      ...cat,
      percentage:
        totalAmount > 0
          ? Math.round((cat.totalAmount / totalAmount) * 10000) / 100
          : 0,
    }));

    res.json({
      success: true,
      data: {
        period: {
          startDate: defaultStartDate,
          endDate: defaultEndDate,
        },
        categories: categoriesWithPercentages,
        summary: {
          totalAmount,
          categoriesAnalyzed: categoriesWithPercentages.length,
          highRiskCategories: categoriesWithPercentages.filter(
            (c) => c.insights.riskLevel === "high",
          ).length,
          frequentCategories: categoriesWithPercentages.filter(
            (c) => c.insights.isFrequentCategory,
          ).length,
        },
      },
    });
  }),
);
