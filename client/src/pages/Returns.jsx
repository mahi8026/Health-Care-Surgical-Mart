import React, { useState, useEffect } from "react";
import { apiService } from "../services/api";
import LoadingSpinner from "../components/LoadingSpinner";

const Returns = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState("list");

  // Data states
  const [returns, setReturns] = useState([]);
  const [returnStats, setReturnStats] = useState({});
  const [selectedReturn, setSelectedReturn] = useState(null);

  // Filter states
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    page: 1,
  });

  // Pagination
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 1,
  });

  // Fetch returns
  const fetchReturns = async () => {
    try {
      setLoading(true);
      // Use real authenticated endpoint
      const response = await apiService.get("/returns");

      if (response.success) {
        let filteredReturns = response.data || [];

        // Apply filters on frontend
        if (filters.search) {
          filteredReturns = filteredReturns.filter(
            (r) =>
              r.returnNo.toLowerCase().includes(filters.search.toLowerCase()) ||
              r.saleInvoiceNo
                .toLowerCase()
                .includes(filters.search.toLowerCase()) ||
              r.customerName
                .toLowerCase()
                .includes(filters.search.toLowerCase()),
          );
        }

        if (filters.status) {
          filteredReturns = filteredReturns.filter(
            (r) => r.status === filters.status,
          );
        }

        setReturns(filteredReturns);
        setPagination({ page: 1, pages: 1, total: filteredReturns.length });
      } else {
        setError("Failed to fetch returns");
      }
    } catch (error) {
      console.error("Returns fetch error:", error);
      if (error.message?.includes("401")) {
        window.location.href = "/login";
      }
      setError("Failed to fetch returns");
    } finally {
      setLoading(false);
    }
  };

  // Fetch return statistics
  const fetchReturnStats = async () => {
    try {
      // Use real authenticated endpoint
      const response = await apiService.get("/returns/stats/summary");

      if (response.success) {
        setReturnStats(response.data || {});
      }
    } catch (error) {
      console.error("Return stats error:", error);
      if (error.message?.includes("401")) {
        window.location.href = "/login";
      }
    }
  };

  // Initial data load
  useEffect(() => {
    fetchReturns();
    fetchReturnStats();
  }, []);

  // Refetch when filters change
  useEffect(() => {
    const delayedFetch = setTimeout(() => {
      fetchReturns();
    }, 500);

    return () => clearTimeout(delayedFetch);
  }, [filters.search, filters.status, filters.page]);

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
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Get status badge
  const getStatusBadge = (status) => {
    const badges = {
      pending: "bg-yellow-100 text-yellow-800",
      completed: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
    };
    return badges[status] || "bg-gray-100 text-gray-800";
  };

  // Handle filter changes
  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  // View return details
  const viewReturnDetails = (returnRecord) => {
    setSelectedReturn(returnRecord);
    setActiveTab("details");
  };

  if (loading && returns.length === 0) {
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
            Returns Management
          </h1>
          <p className="text-gray-600 mt-1">
            Manage sale returns, refunds, and stock restoration
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setActiveTab("create")}
            className="btn-primary flex items-center gap-2"
          >
            <i className="fas fa-plus"></i>
            Process Return
          </button>
        </div>
      </div>

      {/* Messages */}
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

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          <div className="flex items-center">
            <i className="fas fa-check-circle mr-2"></i>
            <span>{success}</span>
          </div>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          {
            title: "Today's Returns",
            value: returnStats.today?.returns || 0,
            amount: formatCurrency(returnStats.today?.amount || 0),
            icon: "fas fa-undo",
            color: "text-blue-600",
            bg: "bg-blue-100",
          },
          {
            title: "Monthly Returns",
            value: returnStats.monthly?.returns || 0,
            amount: formatCurrency(returnStats.monthly?.amount || 0),
            icon: "fas fa-calendar-alt",
            color: "text-green-600",
            bg: "bg-green-100",
          },
          {
            title: "Total Returns",
            value: returnStats.total || 0,
            amount: "",
            icon: "fas fa-chart-line",
            color: "text-purple-600",
            bg: "bg-purple-100",
          },
          {
            title: "Top Return Reason",
            value: returnStats.byReason?.[0]?.count || 0,
            amount: returnStats.byReason?.[0]?._id || "N/A",
            icon: "fas fa-exclamation-triangle",
            color: "text-orange-600",
            bg: "bg-orange-100",
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
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                {stat.amount && (
                  <p className="text-sm text-gray-500">{stat.amount}</p>
                )}
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
              { id: "list", name: "Returns List", icon: "fas fa-list" },
              { id: "create", name: "Process Return", icon: "fas fa-plus" },
              {
                id: "details",
                name: "Return Details",
                icon: "fas fa-eye",
                hidden: !selectedReturn,
              },
            ]
              .filter((tab) => !tab.hidden)
              .map((tab) => (
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
          {activeTab === "list" && (
            <ReturnsListTab
              returns={returns}
              filters={filters}
              pagination={pagination}
              onFilterChange={handleFilterChange}
              onViewDetails={viewReturnDetails}
              getStatusBadge={getStatusBadge}
              formatCurrency={formatCurrency}
              formatDate={formatDate}
              loading={loading}
            />
          )}

          {activeTab === "create" && (
            <ProcessReturnTab
              onSuccess={(message) => {
                setSuccess(message);
                setActiveTab("list");
                fetchReturns();
                fetchReturnStats();
                setTimeout(() => setSuccess(""), 3000);
              }}
              onError={setError}
              formatCurrency={formatCurrency}
            />
          )}

          {activeTab === "details" && selectedReturn && (
            <ReturnDetailsTab
              returnRecord={selectedReturn}
              onBack={() => {
                setActiveTab("list");
                setSelectedReturn(null);
              }}
              formatCurrency={formatCurrency}
              formatDate={formatDate}
              getStatusBadge={getStatusBadge}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// Returns List Tab Component
const ReturnsListTab = ({
  returns,
  filters,
  pagination,
  onFilterChange,
  onViewDetails,
  getStatusBadge,
  formatCurrency,
  formatDate,
  loading,
}) => {
  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Search Returns
          </label>
          <div className="relative">
            <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => onFilterChange("search", e.target.value)}
              placeholder="Search by return number, invoice, or customer..."
              className="input-field pl-10"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            value={filters.status}
            onChange={(e) => onFilterChange("status", e.target.value)}
            className="input-field"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Returns Table */}
      <div className="table-container">
        <table className="table">
          <thead className="table-header">
            <tr>
              <th className="table-header-cell">Return #</th>
              <th className="table-header-cell">Original Invoice</th>
              <th className="table-header-cell">Customer</th>
              <th className="table-header-cell">Items</th>
              <th className="table-header-cell">Refund Amount</th>
              <th className="table-header-cell">Reason</th>
              <th className="table-header-cell">Status</th>
              <th className="table-header-cell">Date</th>
              <th className="table-header-cell">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan="9" className="table-cell text-center py-8">
                  <LoadingSpinner size="sm" />
                  <p className="text-gray-500 mt-2">Loading returns...</p>
                </td>
              </tr>
            ) : returns.length === 0 ? (
              <tr>
                <td colSpan="9" className="table-cell text-center py-8">
                  <i className="fas fa-undo text-gray-400 text-4xl mb-4"></i>
                  <p className="text-gray-500">No returns found</p>
                </td>
              </tr>
            ) : (
              returns.map((returnRecord) => (
                <tr key={returnRecord._id} className="hover:bg-gray-50">
                  <td className="table-cell">
                    <span className="font-mono text-sm font-medium">
                      {returnRecord.returnNumber}
                    </span>
                  </td>
                  <td className="table-cell">
                    <span className="font-mono text-sm">
                      {returnRecord.originalInvoiceNumber}
                    </span>
                  </td>
                  <td className="table-cell">
                    <div>
                      <div className="font-medium text-gray-900">
                        {returnRecord.customer?.name || "Cash Customer"}
                      </div>
                      {returnRecord.customer?.phone && (
                        <div className="text-sm text-gray-500">
                          {returnRecord.customer.phone}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="table-cell">
                    <span className="text-sm">
                      {returnRecord.items?.length || 0} item(s)
                    </span>
                  </td>
                  <td className="table-cell">
                    <span className="font-semibold text-green-600">
                      {formatCurrency(returnRecord.totalRefund)}
                    </span>
                  </td>
                  <td className="table-cell">
                    <span className="text-sm text-gray-600">
                      {returnRecord.returnReason}
                    </span>
                  </td>
                  <td className="table-cell">
                    <span
                      className={`badge ${getStatusBadge(returnRecord.status)}`}
                    >
                      {returnRecord.status}
                    </span>
                  </td>
                  <td className="table-cell">
                    <span className="text-sm text-gray-600">
                      {formatDate(returnRecord.returnDate)}
                    </span>
                  </td>
                  <td className="table-cell">
                    <button
                      onClick={() => onViewDetails(returnRecord)}
                      className="text-blue-600 hover:text-blue-900"
                      title="View Details"
                    >
                      <i className="fas fa-eye"></i>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
            {pagination.total} results
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onFilterChange("page", pagination.page - 1)}
              disabled={pagination.page === 1}
              className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-700">
              Page {pagination.page} of {pagination.pages}
            </span>
            <button
              onClick={() => onFilterChange("page", pagination.page + 1)}
              disabled={pagination.page === pagination.pages}
              className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Process Return Tab Component
const ProcessReturnTab = ({ onSuccess, onError, formatCurrency }) => {
  const [step, setStep] = useState(1); // 1: Find Sale, 2: Select Items, 3: Confirm Return
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [originalSale, setOriginalSale] = useState(null);
  const [returnItems, setReturnItems] = useState([]);
  const [returnData, setReturnData] = useState({
    returnReason: "",
    returnType: "partial",
    refundMethod: "cash",
    notes: "",
  });

  // Search for original sale
  const searchSale = async () => {
    if (!searchTerm.trim()) {
      onError("Please enter an invoice number to search");
      return;
    }

    try {
      setLoading(true);
      // First try to find the sale by invoice number
      const salesResponse = await apiService.get(
        `/sales?search=${searchTerm}&limit=1`,
      );

      if (salesResponse.success && salesResponse.data.length > 0) {
        const sale = salesResponse.data[0];
        // Get detailed sale info for returns
        const returnResponse = await apiService.get(
          `/returns/sale/${sale._id}`,
        );

        if (returnResponse.success) {
          setOriginalSale(returnResponse.data);
          setStep(2);
          // Initialize return items
          const items = returnResponse.data.items.map((item) => ({
            ...item,
            returnQuantity: 0,
            returnReason: "",
            selected: false,
          }));
          setReturnItems(items);
        }
      } else {
        onError("Sale not found. Please check the invoice number.");
      }
    } catch (error) {
      console.error("Sale search error:", error);
      onError("Failed to search for sale");
    } finally {
      setLoading(false);
    }
  };

  // Handle item selection
  const handleItemSelection = (index, field, value) => {
    setReturnItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };

      // If selecting/deselecting item, reset quantity
      if (field === "selected" && !value) {
        updated[index].returnQuantity = 0;
      }

      return updated;
    });
  };

  // Process the return
  const processReturn = async () => {
    const selectedItems = returnItems.filter(
      (item) => item.selected && item.returnQuantity > 0,
    );

    if (selectedItems.length === 0) {
      onError("Please select at least one item to return");
      return;
    }

    if (!returnData.returnReason) {
      onError("Please select a return reason");
      return;
    }

    try {
      setLoading(true);

      const returnPayload = {
        originalSaleId: originalSale._id,
        originalInvoiceNumber: originalSale.invoiceNumber,
        customer: originalSale.customer,
        items: selectedItems.map((item) => ({
          productId: item.productId,
          returnQuantity: parseInt(item.returnQuantity),
          returnReason: item.returnReason || returnData.returnReason,
        })),
        returnReason: returnData.returnReason,
        returnType: returnData.returnType,
        refundMethod: returnData.refundMethod,
        notes: returnData.notes,
      };

      const response = await apiService.post("/returns", returnPayload);

      if (response.success) {
        onSuccess("Return processed successfully!");
        // Reset form
        setStep(1);
        setSearchTerm("");
        setOriginalSale(null);
        setReturnItems([]);
        setReturnData({
          returnReason: "",
          returnType: "partial",
          refundMethod: "cash",
          notes: "",
        });
      } else {
        onError(response.message || "Failed to process return");
      }
    } catch (error) {
      console.error("Return processing error:", error);
      onError("Failed to process return");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="flex items-center justify-center space-x-4 mb-8">
        {[
          { step: 1, title: "Find Sale", icon: "fas fa-search" },
          { step: 2, title: "Select Items", icon: "fas fa-list" },
          { step: 3, title: "Confirm Return", icon: "fas fa-check" },
        ].map((stepInfo) => (
          <div key={stepInfo.step} className="flex items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                step >= stepInfo.step
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-600"
              }`}
            >
              <i className={stepInfo.icon}></i>
            </div>
            <span
              className={`ml-2 text-sm font-medium ${
                step >= stepInfo.step ? "text-blue-600" : "text-gray-500"
              }`}
            >
              {stepInfo.title}
            </span>
            {stepInfo.step < 3 && (
              <div className="w-8 h-0.5 bg-gray-300 mx-4"></div>
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Find Sale */}
      {step === 1 && (
        <div className="max-w-md mx-auto">
          <div className="text-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900">
              Find Original Sale
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Enter the invoice number to find the original sale
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Invoice Number
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field"
                placeholder="Enter invoice number (e.g., INV-001)"
                onKeyPress={(e) => e.key === "Enter" && searchSale()}
              />
            </div>

            <button
              onClick={searchSale}
              disabled={loading || !searchTerm.trim()}
              className="btn-primary w-full"
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Searching...
                </>
              ) : (
                <>
                  <i className="fas fa-search mr-2"></i>
                  Find Sale
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Select Items */}
      {step === 2 && originalSale && (
        <div className="space-y-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              Original Sale Details
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Invoice:</span>{" "}
                {originalSale.invoiceNumber}
              </div>
              <div>
                <span className="font-medium">Date:</span>{" "}
                {new Date(originalSale.saleDate).toLocaleDateString()}
              </div>
              <div>
                <span className="font-medium">Customer:</span>{" "}
                {originalSale.customer?.name || "Cash Customer"}
              </div>
              <div>
                <span className="font-medium">Total:</span>{" "}
                {formatCurrency(originalSale.grandTotal)}
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-md font-semibold text-gray-900 mb-4">
              Select Items to Return
            </h4>
            <div className="space-y-3">
              {returnItems.map((item, index) => (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex items-start space-x-4">
                    <input
                      type="checkbox"
                      checked={item.selected}
                      onChange={(e) =>
                        handleItemSelection(index, "selected", e.target.checked)
                      }
                      disabled={item.returnableQuantity === 0}
                      className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />

                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <h5 className="font-medium text-gray-900">
                            {item.name}
                          </h5>
                          <p className="text-sm text-gray-600">
                            SKU: {item.sku}
                          </p>
                          <p className="text-sm text-gray-600">
                            Original Qty: {item.qty} | Returned:{" "}
                            {item.returnedQuantity} | Available:{" "}
                            {item.returnableQuantity}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">
                            {formatCurrency(item.price)}
                          </p>
                          <p className="text-sm text-gray-600">per unit</p>
                        </div>
                      </div>

                      {item.selected && (
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Return Quantity
                            </label>
                            <input
                              type="number"
                              min="1"
                              max={item.returnableQuantity}
                              value={item.returnQuantity}
                              onChange={(e) =>
                                handleItemSelection(
                                  index,
                                  "returnQuantity",
                                  parseInt(e.target.value) || 0,
                                )
                              }
                              className="input-field"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Item Return Reason
                            </label>
                            <select
                              value={item.returnReason}
                              onChange={(e) =>
                                handleItemSelection(
                                  index,
                                  "returnReason",
                                  e.target.value,
                                )
                              }
                              className="input-field"
                            >
                              <option value="">Use general reason</option>
                              <option value="Expired Product">
                                Expired Product
                              </option>
                              <option value="Damaged Product">
                                Damaged Product
                              </option>
                              <option value="Wrong Product">
                                Wrong Product
                              </option>
                              <option value="Quality Issue">
                                Quality Issue
                              </option>
                            </select>
                          </div>
                        </div>
                      )}

                      {item.returnableQuantity === 0 && (
                        <p className="text-sm text-red-600 mt-2">
                          This item has already been fully returned
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="btn-secondary">
              <i className="fas fa-arrow-left mr-2"></i>
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={
                !returnItems.some(
                  (item) => item.selected && item.returnQuantity > 0,
                )
              }
              className="btn-primary"
            >
              Continue
              <i className="fas fa-arrow-right ml-2"></i>
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Confirm Return */}
      {step === 3 && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Confirm Return Details
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Return Reason *
                </label>
                <select
                  value={returnData.returnReason}
                  onChange={(e) =>
                    setReturnData((prev) => ({
                      ...prev,
                      returnReason: e.target.value,
                    }))
                  }
                  className="input-field"
                  required
                >
                  <option value="">Select reason</option>
                  <option value="Expired Product">Expired Product</option>
                  <option value="Damaged Product">Damaged Product</option>
                  <option value="Wrong Product">Wrong Product</option>
                  <option value="Customer Changed Mind">
                    Customer Changed Mind
                  </option>
                  <option value="Quality Issue">Quality Issue</option>
                  <option value="Prescription Change">
                    Prescription Change
                  </option>
                  <option value="Duplicate Purchase">Duplicate Purchase</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Refund Method
                </label>
                <select
                  value={returnData.refundMethod}
                  onChange={(e) =>
                    setReturnData((prev) => ({
                      ...prev,
                      refundMethod: e.target.value,
                    }))
                  }
                  className="input-field"
                >
                  <option value="cash">Cash</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="store_credit">Store Credit</option>
                  <option value="original_payment">
                    Original Payment Method
                  </option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={returnData.notes}
                  onChange={(e) =>
                    setReturnData((prev) => ({
                      ...prev,
                      notes: e.target.value,
                    }))
                  }
                  rows="3"
                  className="input-field"
                  placeholder="Additional notes about the return..."
                />
              </div>
            </div>
          </div>

          {/* Return Summary */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-semibold text-gray-900 mb-3">Return Summary</h4>
            <div className="space-y-2">
              {returnItems
                .filter((item) => item.selected && item.returnQuantity > 0)
                .map((item, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span>
                      {item.name} (x{item.returnQuantity})
                    </span>
                    <span>
                      {formatCurrency(item.price * item.returnQuantity)}
                    </span>
                  </div>
                ))}
              <div className="border-t pt-2 mt-2">
                <div className="flex justify-between font-semibold">
                  <span>Total Refund:</span>
                  <span className="text-green-600">
                    {formatCurrency(
                      returnItems
                        .filter(
                          (item) => item.selected && item.returnQuantity > 0,
                        )
                        .reduce(
                          (sum, item) => sum + item.price * item.returnQuantity,
                          0,
                        ),
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(2)} className="btn-secondary">
              <i className="fas fa-arrow-left mr-2"></i>
              Back
            </button>
            <button
              onClick={processReturn}
              disabled={loading || !returnData.returnReason}
              className="btn-primary"
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <i className="fas fa-check mr-2"></i>
                  Process Return
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Return Details Tab Component
const ReturnDetailsTab = ({
  returnRecord,
  onBack,
  formatCurrency,
  formatDate,
  getStatusBadge,
}) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="btn-secondary flex items-center gap-2"
        >
          <i className="fas fa-arrow-left"></i>
          Back to List
        </button>
        <div className="flex items-center space-x-2">
          <span className={`badge ${getStatusBadge(returnRecord.status)}`}>
            {returnRecord.status}
          </span>
        </div>
      </div>

      {/* Return Header */}
      <div className="bg-blue-50 p-6 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              Return Information
            </h3>
            <div className="space-y-1 text-sm">
              <div>
                <span className="font-medium">Return #:</span>{" "}
                {returnRecord.returnNumber}
              </div>
              <div>
                <span className="font-medium">Original Invoice:</span>{" "}
                {returnRecord.originalInvoiceNumber}
              </div>
              <div>
                <span className="font-medium">Return Date:</span>{" "}
                {formatDate(returnRecord.returnDate)}
              </div>
              <div>
                <span className="font-medium">Return Type:</span>{" "}
                {returnRecord.returnType}
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              Customer Information
            </h3>
            <div className="space-y-1 text-sm">
              <div>
                <span className="font-medium">Name:</span>{" "}
                {returnRecord.customer?.name || "Cash Customer"}
              </div>
              {returnRecord.customer?.phone && (
                <div>
                  <span className="font-medium">Phone:</span>{" "}
                  {returnRecord.customer.phone}
                </div>
              )}
              {returnRecord.customer?.type && (
                <div>
                  <span className="font-medium">Type:</span>{" "}
                  {returnRecord.customer.type}
                </div>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              Refund Information
            </h3>
            <div className="space-y-1 text-sm">
              <div>
                <span className="font-medium">Method:</span>{" "}
                {returnRecord.refundMethod}
              </div>
              <div>
                <span className="font-medium">Reason:</span>{" "}
                {returnRecord.returnReason}
              </div>
              <div>
                <span className="font-medium">Total Refund:</span>
                <span className="text-green-600 font-semibold ml-1">
                  {formatCurrency(returnRecord.totalRefund)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Return Items */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Returned Items
        </h3>
        <div className="table-container">
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="table-header-cell">Product</th>
                <th className="table-header-cell">SKU</th>
                <th className="table-header-cell">Original Qty</th>
                <th className="table-header-cell">Return Qty</th>
                <th className="table-header-cell">Unit Price</th>
                <th className="table-header-cell">Total</th>
                <th className="table-header-cell">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {returnRecord.items?.map((item, index) => (
                <tr key={index}>
                  <td className="table-cell">
                    <div className="font-medium text-gray-900">{item.name}</div>
                  </td>
                  <td className="table-cell">
                    <span className="font-mono text-sm">{item.sku}</span>
                  </td>
                  <td className="table-cell">{item.originalQuantity}</td>
                  <td className="table-cell">
                    <span className="font-semibold text-red-600">
                      {item.returnQuantity}
                    </span>
                  </td>
                  <td className="table-cell">{formatCurrency(item.price)}</td>
                  <td className="table-cell">
                    <span className="font-semibold">
                      {formatCurrency(item.total)}
                    </span>
                  </td>
                  <td className="table-cell">
                    <span className="text-sm text-gray-600">
                      {item.returnReason}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Return Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Financial Summary
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>{formatCurrency(returnRecord.subtotal)}</span>
            </div>
            {returnRecord.discount > 0 && (
              <div className="flex justify-between">
                <span>Discount:</span>
                <span className="text-red-600">
                  -{formatCurrency(returnRecord.discount)}
                </span>
              </div>
            )}
            {returnRecord.vatAmount > 0 && (
              <div className="flex justify-between">
                <span>VAT:</span>
                <span>{formatCurrency(returnRecord.vatAmount)}</span>
              </div>
            )}
            <div className="border-t pt-2">
              <div className="flex justify-between font-semibold text-lg">
                <span>Total Refund:</span>
                <span className="text-green-600">
                  {formatCurrency(returnRecord.totalRefund)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {returnRecord.notes && (
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Notes</h3>
            <p className="text-gray-700">{returnRecord.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Returns;
