import React, { useState, useEffect } from "react";
import { apiService } from "../services/api";
import LoadingSpinner from "../components/LoadingSpinner";

const StockReport = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  // Data states
  const [stockData, setStockData] = useState([]);
  const [stockValuation, setStockValuation] = useState(null);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [stockSummary, setStockSummary] = useState({});

  // Filter states
  const [filters, setFilters] = useState({
    category: "",
    lowStock: false,
    search: "",
    sortBy: "name",
    sortOrder: "asc",
  });

  // Categories for filtering
  const [categories, setCategories] = useState([]);

  // Fetch all stock data
  const fetchStockData = async () => {
    try {
      setLoading(true);

      // Use the working test endpoints temporarily
      const [stockResponse, valuationResponse, dashboardResponse] =
        await Promise.all([
          fetch("http://localhost:5000/api/test/reports/stock"),
          fetch("http://localhost:5000/api/test/reports/stock-valuation"),
          fetch("http://localhost:5000/api/test/reports/dashboard"),
        ]);

      const stockData = await stockResponse.json();
      const valuationData = await valuationResponse.json();
      const dashboardData = await dashboardResponse.json();

      if (stockData.success) {
        let stockItems = stockData.data || [];

        // Apply filters on frontend
        if (filters.category) {
          stockItems = stockItems.filter(
            (item) => item.category === filters.category,
          );
        }

        if (filters.lowStock) {
          stockItems = stockItems.filter((item) => item.isLowStock);
        }

        // Apply search filter
        if (filters.search) {
          stockItems = stockItems.filter(
            (item) =>
              item.name.toLowerCase().includes(filters.search.toLowerCase()) ||
              item.sku.toLowerCase().includes(filters.search.toLowerCase()),
          );
        }

        // Apply sorting
        stockItems.sort((a, b) => {
          let aValue = a[filters.sortBy];
          let bValue = b[filters.sortBy];

          if (typeof aValue === "string") {
            aValue = aValue.toLowerCase();
            bValue = bValue.toLowerCase();
          }

          if (filters.sortOrder === "asc") {
            return aValue > bValue ? 1 : -1;
          } else {
            return aValue < bValue ? 1 : -1;
          }
        });

        setStockData(stockItems);

        // Extract unique categories
        const uniqueCategories = [
          ...new Set(stockItems.map((item) => item.category)),
        ];
        setCategories(uniqueCategories);

        // Calculate summary
        const summary = {
          totalProducts: stockItems.length,
          lowStockCount: stockItems.filter((item) => item.isLowStock).length,
          outOfStockCount: stockItems.filter((item) => item.currentQty === 0)
            .length,
          totalStockValue: stockItems.reduce(
            (sum, item) => sum + item.currentQty * (item.sellingPrice || 0),
            0,
          ),
        };
        setStockSummary(summary);
      }

      if (valuationData.success) {
        setStockValuation(valuationData.data);
      }

      if (dashboardData.success) {
        setLowStockItems(dashboardData.data.lowStockProducts || []);
      }
    } catch (error) {
      console.error("Stock data fetch error:", error);
      setError("Failed to fetch stock data");
    } finally {
      setLoading(false);
    }
  };

  // Initial data load
  useEffect(() => {
    fetchStockData();
  }, []);

  // Refetch when filters change
  useEffect(() => {
    const delayedFetch = setTimeout(() => {
      fetchStockData();
    }, 300);

    return () => clearTimeout(delayedFetch);
  }, [filters.category, filters.lowStock]);

  // Handle search with debounce
  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      fetchStockData();
    }, 500);

    return () => clearTimeout(delayedSearch);
  }, [filters.search, filters.sortBy, filters.sortOrder]);

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-BD", {
      style: "currency",
      currency: "BDT",
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  // Format date
  const formatDate = (date) => {
    if (!date) return "Never";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  };

  // Get stock status
  const getStockStatus = (item) => {
    if (item.currentQty === 0) {
      return {
        status: "Out of Stock",
        color: "text-red-600",
        bg: "bg-red-100",
      };
    } else if (item.isLowStock) {
      return {
        status: "Low Stock",
        color: "text-orange-600",
        bg: "bg-orange-100",
      };
    } else {
      return {
        status: "In Stock",
        color: "text-green-600",
        bg: "bg-green-100",
      };
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = [
      "Product Name",
      "SKU",
      "Category",
      "Current Qty",
      "Min Level",
      "Status",
      "Last Updated",
    ];
    const csvData = stockData.map((item) => [
      item.productName,
      item.sku,
      item.category,
      item.currentQty,
      item.minStockLevel,
      getStockStatus(item).status,
      formatDate(item.lastUpdated),
    ]);

    const csvContent = [headers, ...csvData]
      .map((row) => row.map((field) => `"${field}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stock-report-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Print report
  const printReport = () => {
    window.print();
  };

  if (loading && stockData.length === 0) {
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
          <h1 className="text-3xl font-bold text-gray-900">Stock Report</h1>
          <p className="text-gray-600 mt-1">
            Comprehensive inventory management and stock analysis
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={exportToCSV}
            className="btn-secondary flex items-center gap-2"
          >
            <i className="fas fa-download"></i>
            Export CSV
          </button>
          <button
            onClick={printReport}
            className="btn-primary flex items-center gap-2"
          >
            <i className="fas fa-print"></i>
            Print Report
          </button>
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          {
            title: "Total Products",
            value: stockSummary.totalProducts || 0,
            icon: "fas fa-boxes",
            color: "text-blue-600",
            bg: "bg-blue-100",
          },
          {
            title: "Low Stock Items",
            value: stockSummary.lowStockCount || 0,
            icon: "fas fa-exclamation-triangle",
            color: "text-orange-600",
            bg: "bg-orange-100",
          },
          {
            title: "Out of Stock",
            value: stockSummary.outOfStockCount || 0,
            icon: "fas fa-times-circle",
            color: "text-red-600",
            bg: "bg-red-100",
          },
          {
            title: "Stock Value",
            value: formatCurrency(
              stockValuation?.summary?.totalSellingValue || 0,
            ),
            icon: "fas fa-dollar-sign",
            color: "text-green-600",
            bg: "bg-green-100",
            isValue: true,
          },
        ].map((stat, index) => (
          <div key={index} className="card">
            <div className="flex items-center">
              <div className={`p-3 rounded-lg ${stat.bg}`}>
                <i className={`${stat.icon} ${stat.color} text-xl`}></i>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  {stat.title}
                </p>
                <p
                  className={`text-2xl font-bold text-gray-900 ${stat.isValue ? "text-lg" : ""}`}
                >
                  {stat.value}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              {
                id: "overview",
                name: "Stock Overview",
                icon: "fas fa-chart-bar",
              },
              { id: "alerts", name: "Stock Alerts", icon: "fas fa-bell" },
              {
                id: "valuation",
                name: "Stock Valuation",
                icon: "fas fa-calculator",
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
          {activeTab === "overview" && (
            <StockOverviewTab
              stockData={stockData}
              filters={filters}
              setFilters={setFilters}
              categories={categories}
              getStockStatus={getStockStatus}
              formatDate={formatDate}
              loading={loading}
            />
          )}

          {activeTab === "alerts" && (
            <StockAlertsTab
              lowStockItems={lowStockItems}
              stockData={stockData}
              getStockStatus={getStockStatus}
              formatDate={formatDate}
            />
          )}

          {activeTab === "valuation" && (
            <StockValuationTab
              stockValuation={stockValuation}
              formatCurrency={formatCurrency}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// Stock Overview Tab Component
const StockOverviewTab = ({
  stockData,
  filters,
  setFilters,
  categories,
  getStockStatus,
  formatDate,
  loading,
}) => {
  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Search Products
          </label>
          <div className="relative">
            <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
            <input
              type="text"
              value={filters.search}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, search: e.target.value }))
              }
              placeholder="Search by name or SKU..."
              className="input-field pl-10"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Category
          </label>
          <select
            value={filters.category}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, category: e.target.value }))
            }
            className="input-field"
          >
            <option value="">All Categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Sort By
          </label>
          <select
            value={filters.sortBy}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, sortBy: e.target.value }))
            }
            className="input-field"
          >
            <option value="productName">Product Name</option>
            <option value="currentQty">Current Quantity</option>
            <option value="category">Category</option>
            <option value="lastUpdated">Last Updated</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Order
          </label>
          <select
            value={filters.sortOrder}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, sortOrder: e.target.value }))
            }
            className="input-field"
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>
      </div>

      {/* Filter Options */}
      <div className="flex items-center space-x-4">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={filters.lowStock}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, lowStock: e.target.checked }))
            }
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="ml-2 text-sm text-gray-700">
            Show only low stock items
          </span>
        </label>
      </div>

      {/* Stock Table */}
      <div className="table-container">
        <table className="table">
          <thead className="table-header">
            <tr>
              <th className="table-header-cell">Product</th>
              <th className="table-header-cell">SKU</th>
              <th className="table-header-cell">Category</th>
              <th className="table-header-cell">Current Qty</th>
              <th className="table-header-cell">Min Level</th>
              <th className="table-header-cell">Status</th>
              <th className="table-header-cell">Last Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan="7" className="table-cell text-center py-8">
                  <LoadingSpinner size="sm" />
                  <p className="text-gray-500 mt-2">Loading stock data...</p>
                </td>
              </tr>
            ) : stockData.length === 0 ? (
              <tr>
                <td colSpan="7" className="table-cell text-center py-8">
                  <i className="fas fa-boxes text-gray-400 text-4xl mb-4"></i>
                  <p className="text-gray-500">No stock data found</p>
                </td>
              </tr>
            ) : (
              stockData.map((item) => {
                const status = getStockStatus(item);
                return (
                  <tr key={item._id} className="hover:bg-gray-50">
                    <td className="table-cell">
                      <div className="font-medium text-gray-900">
                        {item.productName}
                      </div>
                      {item.brand && (
                        <div className="text-sm text-gray-500">
                          {item.brand}
                        </div>
                      )}
                    </td>
                    <td className="table-cell">
                      <span className="font-mono text-sm">{item.sku}</span>
                    </td>
                    <td className="table-cell">
                      <span className="badge bg-gray-100 text-gray-800">
                        {item.category}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className="font-semibold">
                        {item.currentQty} {item.unit}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className="text-gray-600">
                        {item.minStockLevel || 0}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${status.bg} ${status.color}`}>
                        {status.status}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className="text-sm text-gray-600">
                        {formatDate(item.lastUpdated)}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Stock Alerts Tab Component
const StockAlertsTab = ({
  lowStockItems,
  stockData,
  getStockStatus,
  formatDate,
}) => {
  const outOfStockItems = stockData.filter((item) => item.currentQty === 0);
  const criticalStockItems = stockData.filter(
    (item) =>
      item.isLowStock &&
      item.currentQty > 0 &&
      item.currentQty <= item.minStockLevel * 0.5,
  );

  return (
    <div className="space-y-6">
      {/* Alert Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card bg-red-50 border-red-200">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-red-100">
              <i className="fas fa-times-circle text-red-600 text-xl"></i>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-red-700">Out of Stock</p>
              <p className="text-2xl font-bold text-red-900">
                {outOfStockItems.length}
              </p>
            </div>
          </div>
        </div>

        <div className="card bg-orange-50 border-orange-200">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-orange-100">
              <i className="fas fa-exclamation-triangle text-orange-600 text-xl"></i>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-orange-700">
                Critical Stock
              </p>
              <p className="text-2xl font-bold text-orange-900">
                {criticalStockItems.length}
              </p>
            </div>
          </div>
        </div>

        <div className="card bg-yellow-50 border-yellow-200">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-yellow-100">
              <i className="fas fa-bell text-yellow-600 text-xl"></i>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-yellow-700">Low Stock</p>
              <p className="text-2xl font-bold text-yellow-900">
                {lowStockItems.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Out of Stock Items */}
      {outOfStockItems.length > 0 && (
        <div className="card">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-red-900 flex items-center">
              <i className="fas fa-times-circle mr-2"></i>
              Out of Stock Items ({outOfStockItems.length})
            </h3>
          </div>
          <div className="table-container">
            <table className="table">
              <thead className="table-header">
                <tr>
                  <th className="table-header-cell">Product</th>
                  <th className="table-header-cell">SKU</th>
                  <th className="table-header-cell">Category</th>
                  <th className="table-header-cell">Last Sale</th>
                  <th className="table-header-cell">Action Needed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {outOfStockItems.map((item) => (
                  <tr key={item._id} className="hover:bg-red-50">
                    <td className="table-cell">
                      <div className="font-medium text-gray-900">
                        {item.productName}
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className="font-mono text-sm">{item.sku}</span>
                    </td>
                    <td className="table-cell">
                      <span className="badge bg-gray-100 text-gray-800">
                        {item.category}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className="text-sm text-gray-600">
                        {formatDate(item.lastSaleDate)}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className="badge bg-red-100 text-red-800">
                        Restock Immediately
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Critical Stock Items */}
      {criticalStockItems.length > 0 && (
        <div className="card">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-orange-900 flex items-center">
              <i className="fas fa-exclamation-triangle mr-2"></i>
              Critical Stock Items ({criticalStockItems.length})
            </h3>
          </div>
          <div className="table-container">
            <table className="table">
              <thead className="table-header">
                <tr>
                  <th className="table-header-cell">Product</th>
                  <th className="table-header-cell">Current Qty</th>
                  <th className="table-header-cell">Min Level</th>
                  <th className="table-header-cell">Days Left</th>
                  <th className="table-header-cell">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {criticalStockItems.map((item) => (
                  <tr key={item._id} className="hover:bg-orange-50">
                    <td className="table-cell">
                      <div className="font-medium text-gray-900">
                        {item.productName}
                      </div>
                      <div className="text-sm text-gray-500">{item.sku}</div>
                    </td>
                    <td className="table-cell">
                      <span className="font-semibold text-orange-600">
                        {item.currentQty} {item.unit}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className="text-gray-600">
                        {item.minStockLevel}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className="text-sm text-gray-600">
                        Est. 2-3 days
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className="badge bg-orange-100 text-orange-800">
                        High Priority
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Low Stock Items */}
      {lowStockItems.length > 0 && (
        <div className="card">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-yellow-900 flex items-center">
              <i className="fas fa-bell mr-2"></i>
              Low Stock Items ({lowStockItems.length})
            </h3>
          </div>
          <div className="table-container">
            <table className="table">
              <thead className="table-header">
                <tr>
                  <th className="table-header-cell">Product</th>
                  <th className="table-header-cell">Current Qty</th>
                  <th className="table-header-cell">Min Level</th>
                  <th className="table-header-cell">Recommended Order</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {lowStockItems.map((item) => (
                  <tr key={item._id} className="hover:bg-yellow-50">
                    <td className="table-cell">
                      <div className="font-medium text-gray-900">
                        {item.productName}
                      </div>
                      <div className="text-sm text-gray-500">
                        {item.product?.sku}
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className="font-semibold text-yellow-600">
                        {item.currentQty}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className="text-gray-600">
                        {item.minStockLevel}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className="font-semibold text-blue-600">
                        {Math.max(
                          item.minStockLevel * 2 - item.currentQty,
                          item.minStockLevel,
                        )}{" "}
                        units
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* No Alerts */}
      {outOfStockItems.length === 0 &&
        criticalStockItems.length === 0 &&
        lowStockItems.length === 0 && (
          <div className="card text-center py-12">
            <i className="fas fa-check-circle text-green-500 text-6xl mb-4"></i>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              All Stock Levels Good!
            </h3>
            <p className="text-gray-600">
              No immediate stock alerts or actions required.
            </p>
          </div>
        )}
    </div>
  );
};

// Stock Valuation Tab Component
const StockValuationTab = ({ stockValuation, formatCurrency }) => {
  if (!stockValuation) {
    return (
      <div className="text-center py-8">
        <LoadingSpinner size="sm" />
        <p className="text-gray-500 mt-2">Loading stock valuation...</p>
      </div>
    );
  }

  const { items, summary } = stockValuation;

  return (
    <div className="space-y-6">
      {/* Valuation Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card bg-blue-50 border-blue-200">
          <div className="text-center">
            <p className="text-sm font-medium text-blue-700">Total Products</p>
            <p className="text-2xl font-bold text-blue-900">
              {summary.totalProducts}
            </p>
          </div>
        </div>

        <div className="card bg-green-50 border-green-200">
          <div className="text-center">
            <p className="text-sm font-medium text-green-700">Purchase Value</p>
            <p className="text-xl font-bold text-green-900">
              {formatCurrency(summary.totalPurchaseValue)}
            </p>
          </div>
        </div>

        <div className="card bg-purple-50 border-purple-200">
          <div className="text-center">
            <p className="text-sm font-medium text-purple-700">Selling Value</p>
            <p className="text-xl font-bold text-purple-900">
              {formatCurrency(summary.totalSellingValue)}
            </p>
          </div>
        </div>

        <div className="card bg-yellow-50 border-yellow-200">
          <div className="text-center">
            <p className="text-sm font-medium text-yellow-700">
              Potential Profit
            </p>
            <p className="text-xl font-bold text-yellow-900">
              {formatCurrency(summary.potentialProfit)}
            </p>
          </div>
        </div>
      </div>

      {/* Valuation Table */}
      <div className="card">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Stock Valuation Details
          </h3>
        </div>
        <div className="table-container">
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="table-header-cell">Product</th>
                <th className="table-header-cell">SKU</th>
                <th className="table-header-cell">Qty</th>
                <th className="table-header-cell">Purchase Price</th>
                <th className="table-header-cell">Selling Price</th>
                <th className="table-header-cell">Purchase Value</th>
                <th className="table-header-cell">Selling Value</th>
                <th className="table-header-cell">Profit Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((item) => {
                const profitMargin = (
                  ((item.sellingPrice - item.purchasePrice) /
                    item.purchasePrice) *
                  100
                ).toFixed(1);
                return (
                  <tr key={item._id} className="hover:bg-gray-50">
                    <td className="table-cell">
                      <div className="font-medium text-gray-900">
                        {item.productName}
                      </div>
                      <div className="text-sm text-gray-500">
                        {item.category}
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className="font-mono text-sm">{item.sku}</span>
                    </td>
                    <td className="table-cell">
                      <span className="font-semibold">{item.currentQty}</span>
                    </td>
                    <td className="table-cell">
                      <span className="text-sm">
                        {formatCurrency(item.purchasePrice)}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className="text-sm">
                        {formatCurrency(item.sellingPrice)}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className="font-semibold text-green-600">
                        {formatCurrency(item.purchaseValue)}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className="font-semibold text-blue-600">
                        {formatCurrency(item.sellingValue)}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span
                        className={`badge ${
                          profitMargin > 20
                            ? "bg-green-100 text-green-800"
                            : profitMargin > 10
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                        }`}
                      >
                        {profitMargin}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StockReport;
