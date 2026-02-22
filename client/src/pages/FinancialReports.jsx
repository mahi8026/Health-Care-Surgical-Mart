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

const FinancialReports = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("profit-loss");

  // Data states
  const [profitLossData, setProfitLossData] = useState(null);
  const [dailySummary, setDailySummary] = useState(null);
  const [productProfitability, setProductProfitability] = useState(null);
  const [returnAnalysis, setReturnAnalysis] = useState(null);
  const [cashFlow, setCashFlow] = useState(null);

  // Filter states
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
  });

  // Fetch all financial data
  const fetchFinancialData = async () => {
    try {
      setLoading(true);
      setError("");

      // Use real MongoDB endpoints
      const [plData, dsData, ppData, raData, cfData] = await Promise.all([
        apiService.get("/reports/financial/profit-loss"),
        apiService.get("/reports/financial/daily-summary"),
        apiService.get("/reports/financial/product-profitability"),
        apiService.get("/reports/financial/return-analysis"),
        apiService.get("/reports/financial/cash-flow"),
      ]);

      if (plData?.success) setProfitLossData(plData.data);
      if (dsData?.success) setDailySummary(dsData.data);
      if (ppData?.success) setProductProfitability(ppData.data);
      if (raData?.success) setReturnAnalysis(raData.data);
      if (cfData?.success) setCashFlow(cfData.data);
    } catch (error) {
      console.error("Financial data fetch error:", error);

      // Handle authentication errors
      if (error.response?.status === 401 || error.response?.status === 403) {
        setError("Authentication failed. Please login again.");
        setTimeout(() => {
          window.location.href = "/login";
        }, 2000);
      } else {
        setError("Failed to fetch financial data");
      }
    } finally {
      setLoading(false);
    }
  };

  // Initial data load
  useEffect(() => {
    fetchFinancialData();
  }, []);

  // Refetch when date range changes
  useEffect(() => {
    const delayedFetch = setTimeout(() => {
      fetchFinancialData();
    }, 500);

    return () => clearTimeout(delayedFetch);
  }, [dateRange.startDate, dateRange.endDate]);

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-BD", {
      style: "currency",
      currency: "BDT",
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  // Format percentage
  const formatPercentage = (value) => {
    return `${(value || 0).toFixed(1)}%`;
  };

  // Handle date range change
  const handleDateRangeChange = (field, value) => {
    setDateRange((prev) => ({ ...prev, [field]: value }));
  };

  if (loading && !profitLossData) {
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
          <h1 className="text-3xl font-bold text-gray-900">
            Financial Reports
          </h1>
          <p className="text-gray-600 mt-1">
            Comprehensive financial analysis and business intelligence
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">From:</label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) =>
                handleDateRangeChange("startDate", e.target.value)
              }
              className="input-field w-auto"
            />
          </div>
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">To:</label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => handleDateRangeChange("endDate", e.target.value)}
              className="input-field w-auto"
            />
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <div className="flex items-center">
            <i className="fas fa-exclamation-circle mr-2"></i>
            <span>{error}</span>
            <button
              onClick={() => setError("")}
              className="ml-auto text-red-500 hover:text-red-700"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>
      )}

      {/* Key Metrics Cards */}
      {profitLossData && profitLossData.profit && profitLossData.revenue && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            {
              title: "Net Revenue",
              value: formatCurrency(profitLossData.revenue.netRevenue || 0),
              change: "+12.5%",
              icon: "fas fa-dollar-sign",
              color: "text-green-600",
              bg: "bg-green-100",
            },
            {
              title: "Gross Profit",
              value: formatCurrency(profitLossData.profit.grossProfit || 0),
              change: formatPercentage(
                profitLossData.profit.grossProfitMargin || 0,
              ),
              icon: "fas fa-chart-line",
              color: "text-blue-600",
              bg: "bg-blue-100",
            },
            {
              title: "Net Profit",
              value: formatCurrency(profitLossData.profit.netProfit || 0),
              change: formatPercentage(
                profitLossData.profit.netProfitMargin || 0,
              ),
              icon: "fas fa-coins",
              color: "text-purple-600",
              bg: "bg-purple-100",
            },
            {
              title: "Return Rate",
              value: formatPercentage(profitLossData.metrics?.returnRate || 0),
              change: formatCurrency(
                profitLossData.revenue.returns?.totalReturns || 0,
              ),
              icon: "fas fa-undo",
              color: "text-orange-600",
              bg: "bg-orange-100",
            },
          ].map((metric, index) => (
            <div key={index} className="card">
              <div className="flex items-center">
                <div className={`p-3 rounded-lg ${metric.bg}`}>
                  <i className={`${metric.icon} ${metric.color} text-xl`}></i>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">
                    {metric.title}
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {metric.value}
                  </p>
                  <p className="text-sm text-gray-500">{metric.change}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="card">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              {
                id: "profit-loss",
                name: "P&L Statement",
                icon: "fas fa-chart-bar",
              },
              {
                id: "daily-summary",
                name: "Daily Summary",
                icon: "fas fa-calendar-day",
              },
              {
                id: "product-analysis",
                name: "Product Analysis",
                icon: "fas fa-boxes",
              },
              {
                id: "return-analysis",
                name: "Return Analysis",
                icon: "fas fa-undo",
              },
              {
                id: "cash-flow",
                name: "Cash Flow",
                icon: "fas fa-money-bill-wave",
              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  activeTab === tab.id
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <i className={tab.icon}></i>
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === "profit-loss" && profitLossData && (
            <ProfitLossTab
              data={profitLossData}
              formatCurrency={formatCurrency}
              formatPercentage={formatPercentage}
            />
          )}

          {activeTab === "daily-summary" && dailySummary && (
            <DailySummaryTab
              data={dailySummary}
              formatCurrency={formatCurrency}
            />
          )}

          {activeTab === "product-analysis" && productProfitability && (
            <ProductAnalysisTab
              data={productProfitability}
              formatCurrency={formatCurrency}
              formatPercentage={formatPercentage}
            />
          )}

          {activeTab === "return-analysis" && returnAnalysis && (
            <ReturnAnalysisTab
              data={returnAnalysis}
              formatCurrency={formatCurrency}
              formatPercentage={formatPercentage}
            />
          )}

          {activeTab === "cash-flow" && cashFlow && (
            <CashFlowTab data={cashFlow} formatCurrency={formatCurrency} />
          )}
        </div>
      </div>
    </div>
  );
};

// Profit & Loss Tab Component
const ProfitLossTab = ({ data, formatCurrency, formatPercentage }) => {
  return (
    <div className="space-y-6">
      {/* P&L Statement */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Profit & Loss Statement
          </h3>
          <div className="space-y-3">
            {/* Revenue Section */}
            <div className="border-b pb-3">
              <h4 className="font-medium text-gray-900 mb-2">Revenue</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Gross Revenue:</span>
                  <span className="font-medium">
                    {formatCurrency(data.revenue.grossRevenue)}
                  </span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>Less: Returns:</span>
                  <span>
                    -{formatCurrency(data.revenue.returns.totalReturns)}
                  </span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Net Revenue:</span>
                  <span>{formatCurrency(data.revenue.netRevenue)}</span>
                </div>
              </div>
            </div>

            {/* Costs Section */}
            <div className="border-b pb-3">
              <h4 className="font-medium text-gray-900 mb-2">Costs</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Cost of Goods Sold:</span>
                  <span className="font-medium">
                    {formatCurrency(data.costs.costOfGoodsSold)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Operating Expenses:</span>
                  <span className="font-medium">
                    {formatCurrency(data.costs.operatingExpenses)}
                  </span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Total Costs:</span>
                  <span>{formatCurrency(data.costs.totalCosts)}</span>
                </div>
              </div>
            </div>

            {/* Profit Section */}
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Profit</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Gross Profit:</span>
                  <span className="font-medium text-green-600">
                    {formatCurrency(data.profit.grossProfit)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Gross Margin:</span>
                  <span className="font-medium">
                    {formatPercentage(data.profit.grossProfitMargin)}
                  </span>
                </div>
                <div className="flex justify-between font-semibold text-lg">
                  <span>Net Profit:</span>
                  <span className="text-green-600">
                    {formatCurrency(data.profit.netProfit)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Net Margin:</span>
                  <span className="font-medium">
                    {formatPercentage(data.profit.netProfitMargin)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Key Metrics
          </h3>
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-blue-700 font-medium">
                  Average Order Value
                </span>
                <span className="text-blue-900 font-bold text-lg">
                  {formatCurrency(data.metrics.averageOrderValue)}
                </span>
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-green-700 font-medium">
                  Profit per Sale
                </span>
                <span className="text-green-900 font-bold text-lg">
                  {formatCurrency(data.metrics.profitPerSale)}
                </span>
              </div>
            </div>

            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-orange-700 font-medium">Return Rate</span>
                <span className="text-orange-900 font-bold text-lg">
                  {formatPercentage(data.metrics.returnRate)}
                </span>
              </div>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-purple-700 font-medium">Total Sales</span>
                <span className="text-purple-900 font-bold text-lg">
                  {data.revenue.totalSales}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Breakdown Chart */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Revenue Breakdown
        </h3>
        <div className="h-64">
          <Doughnut
            data={{
              labels: ["Net Revenue", "Returns", "VAT"],
              datasets: [
                {
                  data: [
                    data.revenue.netRevenue,
                    data.revenue.returns.totalReturns,
                    data.revenue.totalVAT,
                  ],
                  backgroundColor: ["#10B981", "#EF4444", "#3B82F6"],
                  borderWidth: 2,
                  borderColor: "#ffffff",
                },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: "bottom",
                },
                tooltip: {
                  callbacks: {
                    label: (context) => {
                      const value = formatCurrency(context.raw);
                      return `${context.label}: ${value}`;
                    },
                  },
                },
              },
            }}
          />
        </div>
      </div>
    </div>
  );
};

// Daily Summary Tab Component
const DailySummaryTab = ({ data, formatCurrency }) => {
  const hourlyChartData = {
    labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
    datasets: [
      {
        label: "Sales",
        data: Array.from({ length: 24 }, (_, hour) => {
          const hourData = data.hourlySales.find((h) => h.hour === hour);
          return hourData ? hourData.sales : 0;
        }),
        backgroundColor: "rgba(59, 130, 246, 0.5)",
        borderColor: "rgb(59, 130, 246)",
        borderWidth: 2,
      },
    ],
  };

  return (
    <div className="space-y-6">
      {/* Daily Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card bg-green-50 border-green-200">
          <h3 className="text-lg font-semibold text-green-900 mb-4">
            Sales Summary
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Total Sales:</span>
              <span className="font-bold">{data.sales.count}</span>
            </div>
            <div className="flex justify-between">
              <span>Revenue:</span>
              <span className="font-bold">
                {formatCurrency(data.sales.revenue)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Cash:</span>
              <span>{formatCurrency(data.sales.cash)}</span>
            </div>
            <div className="flex justify-between">
              <span>Bank:</span>
              <span>{formatCurrency(data.sales.bank)}</span>
            </div>
          </div>
        </div>

        <div className="card bg-red-50 border-red-200">
          <h3 className="text-lg font-semibold text-red-900 mb-4">
            Returns Summary
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Total Returns:</span>
              <span className="font-bold">{data.returns.count}</span>
            </div>
            <div className="flex justify-between">
              <span>Refund Amount:</span>
              <span className="font-bold">
                {formatCurrency(data.returns.refund)}
              </span>
            </div>
          </div>
        </div>

        <div className="card bg-blue-50 border-blue-200">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">
            Net Summary
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Net Revenue:</span>
              <span className="font-bold">
                {formatCurrency(data.net.revenue)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Total Transactions:</span>
              <span className="font-bold">{data.net.transactions}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Hourly Sales Pattern */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Hourly Sales Pattern
        </h3>
        <div className="h-64">
          <Bar
            data={hourlyChartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  display: false,
                },
              },
              scales: {
                y: {
                  beginAtZero: true,
                  ticks: {
                    stepSize: 1,
                  },
                },
              },
            }}
          />
        </div>
      </div>

      {/* Top Products */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Top Selling Products Today
        </h3>
        <div className="table-container">
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="table-header-cell">Product</th>
                <th className="table-header-cell">Quantity Sold</th>
                <th className="table-header-cell">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.topProducts.length === 0 ? (
                <tr>
                  <td colSpan="3" className="table-cell text-center py-4">
                    No sales data available for today
                  </td>
                </tr>
              ) : (
                data.topProducts.map((product, index) => (
                  <tr key={index}>
                    <td className="table-cell">
                      <span className="font-medium">{product.productName}</span>
                    </td>
                    <td className="table-cell">
                      <span className="font-semibold">
                        {product.totalQuantity}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className="font-semibold text-green-600">
                        {formatCurrency(product.totalRevenue)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Product Analysis Tab Component
const ProductAnalysisTab = ({ data, formatCurrency, formatPercentage }) => {
  return (
    <div className="space-y-6">
      {/* Category Profitability */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Category Profitability
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data.categories.map((category, index) => (
            <div key={index} className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900">{category._id}</h4>
              <div className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Revenue:</span>
                  <span className="font-medium">
                    {formatCurrency(category.totalRevenue)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Profit:</span>
                  <span className="font-medium text-green-600">
                    {formatCurrency(category.grossProfit)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Margin:</span>
                  <span className="font-medium">
                    {formatPercentage(category.profitMargin)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Products:</span>
                  <span className="font-medium">{category.productCount}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Profitable Products */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Most Profitable Products
        </h3>
        <div className="table-container">
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="table-header-cell">Product</th>
                <th className="table-header-cell">Category</th>
                <th className="table-header-cell">Qty Sold</th>
                <th className="table-header-cell">Revenue</th>
                <th className="table-header-cell">Profit</th>
                <th className="table-header-cell">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.products.map((product, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="table-cell">
                    <div>
                      <div className="font-medium text-gray-900">
                        {product.productName}
                      </div>
                      <div className="text-sm text-gray-500">{product.sku}</div>
                    </div>
                  </td>
                  <td className="table-cell">
                    <span className="badge bg-gray-100 text-gray-800">
                      {product.category}
                    </span>
                  </td>
                  <td className="table-cell">
                    <span className="font-semibold">
                      {product.totalQuantitySold}
                    </span>
                  </td>
                  <td className="table-cell">
                    <span className="font-semibold">
                      {formatCurrency(product.totalRevenue)}
                    </span>
                  </td>
                  <td className="table-cell">
                    <span
                      className={`font-semibold ${
                        product.grossProfit >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {formatCurrency(product.grossProfit)}
                    </span>
                  </td>
                  <td className="table-cell">
                    <span
                      className={`badge ${
                        product.profitMargin >= 20
                          ? "bg-green-100 text-green-800"
                          : product.profitMargin >= 10
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                      }`}
                    >
                      {formatPercentage(product.profitMargin)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Return Analysis Tab Component
const ReturnAnalysisTab = ({ data, formatCurrency, formatPercentage }) => {
  const returnReasonChart = {
    labels: data.byReason.map((item) => item._id),
    datasets: [
      {
        data: data.byReason.map((item) => item.count),
        backgroundColor: [
          "#EF4444",
          "#F97316",
          "#EAB308",
          "#22C55E",
          "#3B82F6",
          "#8B5CF6",
          "#EC4899",
        ],
        borderWidth: 2,
        borderColor: "#ffffff",
      },
    ],
  };

  return (
    <div className="space-y-6">
      {/* Return Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card bg-red-50 border-red-200">
          <div className="text-center">
            <p className="text-sm font-medium text-red-700">Total Returns</p>
            <p className="text-2xl font-bold text-red-900">
              {data.summary.totalReturns}
            </p>
          </div>
        </div>
        <div className="card bg-orange-50 border-orange-200">
          <div className="text-center">
            <p className="text-sm font-medium text-orange-700">Return Rate</p>
            <p className="text-2xl font-bold text-orange-900">
              {formatPercentage(data.summary.returnRate)}
            </p>
          </div>
        </div>
        <div className="card bg-yellow-50 border-yellow-200">
          <div className="text-center">
            <p className="text-sm font-medium text-yellow-700">
              Revenue Impact
            </p>
            <p className="text-2xl font-bold text-yellow-900">
              {formatPercentage(data.summary.revenueImpact)}
            </p>
          </div>
        </div>
        <div className="card bg-purple-50 border-purple-200">
          <div className="text-center">
            <p className="text-sm font-medium text-purple-700">Total Refunds</p>
            <p className="text-xl font-bold text-purple-900">
              {formatCurrency(data.summary.totalRefundAmount)}
            </p>
          </div>
        </div>
      </div>

      {/* Return Reasons Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Returns by Reason
          </h3>
          <div className="h-64">
            <Doughnut
              data={returnReasonChart}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: "bottom",
                  },
                },
              }}
            />
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Return Reason Details
          </h3>
          <div className="space-y-3">
            {data.byReason.map((reason, index) => (
              <div
                key={index}
                className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <span className="font-medium text-gray-900">
                    {reason._id}
                  </span>
                  <div className="text-sm text-gray-600">
                    {reason.count} returns • Avg:{" "}
                    {formatCurrency(reason.averageRefund)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-red-600">
                    {formatCurrency(reason.totalRefund)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Most Returned Products */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Most Returned Products
        </h3>
        <div className="table-container">
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="table-header-cell">Product</th>
                <th className="table-header-cell">SKU</th>
                <th className="table-header-cell">Return Count</th>
                <th className="table-header-cell">Total Returned</th>
                <th className="table-header-cell">Refund Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.byProduct.map((product, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="table-cell">
                    <span className="font-medium text-gray-900">
                      {product.productName}
                    </span>
                  </td>
                  <td className="table-cell">
                    <span className="font-mono text-sm">{product.sku}</span>
                  </td>
                  <td className="table-cell">
                    <span className="font-semibold">{product.returnCount}</span>
                  </td>
                  <td className="table-cell">
                    <span className="font-semibold text-red-600">
                      {product.totalReturned}
                    </span>
                  </td>
                  <td className="table-cell">
                    <span className="font-semibold text-red-600">
                      {formatCurrency(product.totalRefund)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Cash Flow Tab Component
const CashFlowTab = ({ data, formatCurrency }) => {
  const dailyCashFlowChart = {
    labels: data.dailyCashFlow.map((day) =>
      new Date(day.date).toLocaleDateString(),
    ),
    datasets: [
      {
        label: "Cash Inflow",
        data: data.dailyCashFlow.map((day) => day.cashIn),
        borderColor: "rgb(34, 197, 94)",
        backgroundColor: "rgba(34, 197, 94, 0.1)",
        fill: true,
      },
    ],
  };

  return (
    <div className="space-y-6">
      {/* Cash Flow Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card bg-green-50 border-green-200">
          <h3 className="text-lg font-semibold text-green-900 mb-4">
            Cash Inflows
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Total Sales:</span>
              <span className="font-bold">
                {formatCurrency(data.inflows.totalSales)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Cash Sales:</span>
              <span>{formatCurrency(data.inflows.cashSales)}</span>
            </div>
            <div className="flex justify-between">
              <span>Bank Sales:</span>
              <span>{formatCurrency(data.inflows.bankSales)}</span>
            </div>
          </div>
        </div>

        <div className="card bg-red-50 border-red-200">
          <h3 className="text-lg font-semibold text-red-900 mb-4">
            Cash Outflows
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Purchases:</span>
              <span className="font-bold">
                {formatCurrency(data.outflows.purchases)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Returns:</span>
              <span>
                {formatCurrency(
                  data.outflows.returns.reduce(
                    (sum, item) => sum + item.totalRefund,
                    0,
                  ),
                )}
              </span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Total Outflows:</span>
              <span>{formatCurrency(data.outflows.totalOutflows)}</span>
            </div>
          </div>
        </div>

        <div className="card bg-blue-50 border-blue-200">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">
            Net Cash Flow
          </h3>
          <div className="text-center">
            <p
              className={`text-3xl font-bold ${
                data.netCashFlow >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {formatCurrency(data.netCashFlow)}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              {data.netCashFlow >= 0 ? "Positive" : "Negative"} Cash Flow
            </p>
          </div>
        </div>
      </div>

      {/* Daily Cash Flow Chart */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Daily Cash Flow Trend
        </h3>
        <div className="h-64">
          <Line
            data={dailyCashFlowChart}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  display: false,
                },
              },
              scales: {
                y: {
                  beginAtZero: true,
                },
              },
            }}
          />
        </div>
      </div>

      {/* Return Refund Methods */}
      {data.outflows.returns.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Return Refund Methods
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.outflows.returns.map((method, index) => (
              <div key={index} className="bg-gray-50 p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-900 capitalize">
                    {method._id.replace("_", " ")}
                  </span>
                  <div className="text-right">
                    <div className="font-semibold text-red-600">
                      {formatCurrency(method.totalRefund)}
                    </div>
                    <div className="text-sm text-gray-600">
                      {method.count} refunds
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialReports;
