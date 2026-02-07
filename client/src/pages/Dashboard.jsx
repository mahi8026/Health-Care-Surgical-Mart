import React, { useState, useEffect } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";
import { Bar, Line, Doughnut } from "react-chartjs-2";
import { apiService } from "../services/api";
import LoadingSpinner from "../components/LoadingSpinner";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
);

const Dashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [stockData, setStockData] = useState(null);
  const [expenseData, setExpenseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    try {
      // Use the working test endpoint temporarily
      const response = await fetch("http://localhost:5000/api/test/dashboard");
      const data = await response.json();

      if (data.success) {
        setDashboardData(data.data);
      } else {
        setError("Failed to fetch dashboard data");
      }
    } catch (error) {
      console.error("Dashboard data error:", error);
      setError("Failed to load dashboard data");
    }
  };

  // Fetch stock valuation data
  const fetchStockData = async () => {
    try {
      // Use the working test endpoint temporarily
      const response = await fetch(
        "http://localhost:5000/api/test/stock-valuation",
      );
      const data = await response.json();

      if (data.success) {
        setStockData(data.data);
      }
    } catch (error) {
      console.error("Stock data error:", error);
    }
  };

  // Fetch expense summary data
  const fetchExpenseData = async () => {
    try {
      // Use the working test endpoint temporarily
      const response = await fetch(
        "http://localhost:5000/api/test/expense-analytics",
      );
      const data = await response.json();

      if (data.success) {
        const currentMonth =
          data.data.comparison[data.data.comparison.length - 1];
        const previousMonth =
          data.data.comparison[data.data.comparison.length - 2];

        setExpenseData({
          currentMonth: currentMonth || {
            totalAmount: 0,
            expenseCount: 0,
            changes: { amount: 0 },
          },
          previousMonth: previousMonth || { totalAmount: 0, expenseCount: 0 },
          categories: data.data.distribution || [], // Use distribution array
          summary: {
            totalAmount: currentMonth?.totalAmount || 0,
            expenseCount: currentMonth?.expenseCount || 0,
          },
        });
      }
    } catch (error) {
      console.error("Expense data error:", error);
    }
  };

  // Initial data load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchDashboardData(),
        fetchStockData(),
        fetchExpenseData(),
      ]);
      setLoading(false);
    };
    loadData();
  }, []);

  // Refresh data
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchDashboardData(),
      fetchStockData(),
      fetchExpenseData(),
    ]);
    setRefreshing(false);
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-BD", {
      style: "currency",
      currency: "BDT",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Chart configurations
  const salesChartData = {
    labels: ["Today", "This Month"],
    datasets: [
      {
        label: "Sales Amount",
        data: [
          dashboardData?.todaySales?.totalSales || 0,
          dashboardData?.monthlySales?.totalSales || 0,
        ],
        backgroundColor: ["#16a34a", "#22c55e"],
        borderColor: ["#15803d", "#16a34a"],
        borderWidth: 1,
      },
    ],
  };

  const ordersChartData = {
    labels: ["Today", "This Month"],
    datasets: [
      {
        label: "Number of Orders",
        data: [
          dashboardData?.todaySales?.totalOrders || 0,
          dashboardData?.monthlySales?.totalOrders || 0,
        ],
        backgroundColor: ["#3b82f6", "#60a5fa"],
        borderColor: ["#2563eb", "#3b82f6"],
        borderWidth: 1,
      },
    ],
  };

  const stockStatusData = {
    labels: ["In Stock", "Low Stock"],
    datasets: [
      {
        data: [
          (stockData?.totalProducts || 0) -
            (dashboardData?.lowStockProducts?.length || 0),
          dashboardData?.lowStockProducts?.length || 0,
        ],
        backgroundColor: ["#22c55e", "#ef4444"],
        borderColor: ["#16a34a", "#dc2626"],
        borderWidth: 2,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
      },
    },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Welcome back! Here's what's happening with your store today.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="btn-primary flex items-center gap-2"
        >
          <i
            className={`fas fa-sync-alt ${refreshing ? "animate-spin" : ""}`}
          ></i>
          {refreshing ? "Refreshing..." : "Refresh Data"}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <div className="flex items-center">
            <i className="fas fa-exclamation-circle mr-2"></i>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {[
          {
            title: "Today's Sales",
            value: formatCurrency(dashboardData?.todaySales?.totalSales || 0),
            subtitle: `${dashboardData?.todaySales?.totalOrders || 0} orders`,
            icon: "fas fa-shopping-cart",
            bgColor: "bg-blue-100",
            textColor: "text-blue-600",
            trend: "+12%",
            trendUp: true,
          },
          {
            title: "Monthly Revenue",
            value: formatCurrency(dashboardData?.monthlySales?.totalSales || 0),
            subtitle: `${dashboardData?.monthlySales?.totalOrders || 0} orders`,
            icon: "fas fa-chart-line",
            bgColor: "bg-green-100",
            textColor: "text-green-600",
            trend: "+8%",
            trendUp: true,
          },
          {
            title: "Monthly Expenses",
            value: formatCurrency(expenseData?.currentMonth?.totalAmount || 0),
            subtitle: `${expenseData?.currentMonth?.expenseCount || 0} expenses`,
            icon: "fas fa-receipt",
            bgColor: "bg-red-100",
            textColor: "text-red-600",
            trend: `${expenseData?.currentMonth?.changes?.amount > 0 ? "+" : ""}${expenseData?.currentMonth?.changes?.amount || 0}%`,
            trendUp: (expenseData?.currentMonth?.changes?.amount || 0) <= 0,
          },
          {
            title: "Total Products",
            value: stockData?.totalProducts || 0,
            subtitle: `${stockData?.totalProducts || 0} items in stock`,
            icon: "fas fa-boxes",
            bgColor: "bg-purple-100",
            textColor: "text-purple-600",
            trend: "+5%",
            trendUp: true,
          },
          {
            title: "Low Stock Alerts",
            value: dashboardData?.lowStockProducts?.length || 0,
            subtitle: "Items need restocking",
            icon: "fas fa-exclamation-triangle",
            bgColor: "bg-orange-100",
            textColor: "text-orange-600",
            trend: "-3%",
            trendUp: false,
          },
          {
            title: "Top Expense Category",
            value: expenseData?.categories?.[0]?.categoryName || "N/A",
            subtitle: expenseData?.categories?.[0]
              ? formatCurrency(expenseData.categories[0].totalAmount)
              : "No expenses",
            icon: "fas fa-tags",
            bgColor: "bg-indigo-100",
            textColor: "text-indigo-600",
            trend: expenseData?.categories?.[0]
              ? `${Math.round(expenseData.categories[0].percentage)}%`
              : "0%",
            trendUp: false,
          },
        ].map((stat, index) => (
          <div key={index} className="card hover:shadow-lg transition-shadow">
            <div className="flex flex-col">
              {/* Icon and Title */}
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2.5 rounded-lg ${stat.bgColor}`}>
                  <i className={`${stat.icon} ${stat.textColor} text-lg`}></i>
                </div>
                <span
                  className={`text-xs font-medium ${
                    stat.trendUp ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {stat.trend}
                </span>
              </div>

              {/* Content */}
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-600 mb-1 truncate">
                  {stat.title}
                </p>
                <p
                  className="text-xl font-bold text-gray-900 mb-1 truncate"
                  title={stat.value}
                >
                  {stat.value}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {stat.subtitle}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Chart */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900">
              Sales Overview
            </h3>
            <p className="text-sm text-gray-600">Today vs This Month</p>
          </div>
          <div className="h-64">
            <Bar data={salesChartData} options={chartOptions} />
          </div>
        </div>

        {/* Orders Chart */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900">
              Orders Overview
            </h3>
            <p className="text-sm text-gray-600">Number of transactions</p>
          </div>
          <div className="h-64">
            <Bar data={ordersChartData} options={chartOptions} />
          </div>
        </div>

        {/* Top Expense Categories */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900">
              Top Expense Categories
            </h3>
            <p className="text-sm text-gray-600">This month's spending</p>
          </div>
          <div className="space-y-3">
            {expenseData?.categories?.length > 0 ? (
              expenseData.categories.map((category, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center text-red-600 font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {category.categoryName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {Math.round(category.percentage)}% of total
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-red-600">
                      {formatCurrency(category.totalAmount)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {Math.round(category.percentage)}%
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <i className="fas fa-receipt text-gray-400 text-3xl mb-2"></i>
                <p className="text-gray-500 text-sm">
                  No expense data available
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top Products Section */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-gray-900">Top Products</h3>
          <p className="text-sm text-gray-600">Best sellers (Last 30 days)</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dashboardData?.topProducts?.length > 0 ? (
            dashboardData.topProducts.slice(0, 6).map((product, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-bold text-sm">
                    {index + 1}
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {product.productName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {product.totalQuantity} sold
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-green-600">
                    {formatCurrency(product.totalRevenue)}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 col-span-full">
              <i className="fas fa-chart-line text-gray-400 text-3xl mb-2"></i>
              <p className="text-gray-500 text-sm">No sales data available</p>
            </div>
          )}
        </div>
      </div>

      {/* Stock Status and Low Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stock Status Chart */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900">
              Stock Status
            </h3>
            <p className="text-sm text-gray-600">Inventory overview</p>
          </div>
          <div className="h-64">
            <Doughnut data={stockStatusData} options={doughnutOptions} />
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="lg:col-span-2 card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900">
              Low Stock Alerts
              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                {dashboardData?.lowStockProducts?.length || 0}
              </span>
            </h3>
            <p className="text-sm text-gray-600">
              Products that need restocking
            </p>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {dashboardData?.lowStockProducts?.length > 0 ? (
              <div className="space-y-3">
                {dashboardData.lowStockProducts.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100"
                  >
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                        <i className="fas fa-box text-red-600"></i>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900">
                          {item.product?.name || item.productName}
                        </p>
                        <p className="text-xs text-gray-500">
                          SKU: {item.product?.sku || "N/A"} | Category:{" "}
                          {item.product?.category || "N/A"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-red-600">
                        {item.currentQty} left
                      </p>
                      <p className="text-xs text-gray-500">
                        Min: {item.minStockLevel || 0}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <i className="fas fa-check-circle text-green-500 text-4xl mb-4"></i>
                <p className="text-gray-500">All products are well stocked!</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stock Valuation Summary */}
      {stockData && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900">
              Stock Valuation
            </h3>
            <p className="text-sm text-gray-600">Current inventory value</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(stockData.summary?.totalPurchaseValue || 0)}
              </p>
              <p className="text-sm text-gray-600">Purchase Value</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(stockData.summary?.totalSellingValue || 0)}
              </p>
              <p className="text-sm text-gray-600">Selling Value</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">
                {formatCurrency(stockData.summary?.totalProfit || 0)}
              </p>
              <p className="text-sm text-gray-600">Potential Profit</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600">
                {stockData.totalProducts || 0}
              </p>
              <p className="text-sm text-gray-600">Total Products</p>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
          <p className="text-sm text-gray-600">Common tasks and shortcuts</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          {[
            {
              title: "New Sale",
              icon: "fas fa-cash-register",
              color: "bg-green-500 hover:bg-green-600",
              href: "/sales",
            },
            {
              title: "Add Product",
              icon: "fas fa-plus-circle",
              color: "bg-blue-500 hover:bg-blue-600",
              href: "/products",
            },
            {
              title: "New Purchase",
              icon: "fas fa-shopping-cart",
              color: "bg-purple-500 hover:bg-purple-600",
              href: "/purchases",
            },
            {
              title: "Add Expense",
              icon: "fas fa-receipt",
              color: "bg-red-500 hover:bg-red-600",
              href: "/expenses/add",
            },
            {
              title: "View Expenses",
              icon: "fas fa-list",
              color: "bg-indigo-500 hover:bg-indigo-600",
              href: "/expenses",
            },
            {
              title: "Stock Report",
              icon: "fas fa-chart-bar",
              color: "bg-orange-500 hover:bg-orange-600",
              href: "/stock-report",
            },
          ].map((action, index) => (
            <a
              key={index}
              href={action.href}
              className={`${action.color} text-white p-4 rounded-lg text-center transition-colors block`}
            >
              <i className={`${action.icon} text-2xl mb-2`}></i>
              <p className="text-sm font-medium">{action.title}</p>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
