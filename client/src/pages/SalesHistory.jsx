import React, { useState, useEffect } from "react";
import api from "../config/api";
import LoadingSpinner from "../components/LoadingSpinner";
import ProfessionalInvoice from "../components/ProfessionalInvoice";
import { Button, Input, Select, Pagination } from "../components/ui";

const SalesHistory = () => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedSale, setSelectedSale] = useState(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState(null);

  // Filters
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    customerId: "",
    paymentStatus: "",
    searchTerm: "",
    page: 1,
    limit: 20,
  });

  // Pagination
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    pages: 1,
  });

  // Fetch sales history
  const fetchSalesHistory = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);
      if (filters.customerId) params.append("customerId", filters.customerId);
      if (filters.paymentStatus)
        params.append("paymentStatus", filters.paymentStatus);
      if (filters.searchTerm) params.append("search", filters.searchTerm);
      params.append("page", filters.page);
      params.append("limit", filters.limit);

      const response = await api.get(`/sales?${params.toString()}`);

      if (response.success) {
        setSales(response.data || []);
        if (response.pagination) {
          setPagination(response.pagination);
        }
      } else {
        setError(response.message || "Failed to fetch sales history");
      }
    } catch (err) {
      console.error("Fetch sales error:", err);
      setError("Failed to fetch sales history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalesHistory();
  }, [filters.page, filters.limit]);

  // Handle filter change
  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value, page: 1 }));
  };

  // Apply filters
  const applyFilters = () => {
    fetchSalesHistory();
  };

  // Reset filters
  const resetFilters = () => {
    setFilters({
      startDate: "",
      endDate: "",
      customerId: "",
      paymentStatus: "",
      searchTerm: "",
      page: 1,
      limit: 20,
    });
    setTimeout(() => fetchSalesHistory(), 100);
  };

  // View invoice
  const viewInvoice = async (saleId) => {
    try {
      setLoading(true);
      const response = await api.get(`/sales/${saleId}`);

      if (response.success) {
        setSelectedSale(response.data);
        setShowInvoiceModal(true);
      } else {
        setError("Failed to load invoice");
      }
    } catch (err) {
      console.error("View invoice error:", err);
      setError("Failed to load invoice");
    } finally {
      setLoading(false);
    }
  };

  // Download invoice as PDF
  const downloadInvoice = async (saleId, invoiceNo) => {
    try {
      setDownloadingInvoice(saleId);
      const response = await api.post(`/sales/${saleId}/send-invoice`);

      if (response.success && response.invoiceUrl) {
        // Open the invoice URL in a new tab for download
        window.open(response.invoiceUrl, "_blank");
        
        // Show success message
        alert(
          response.emailSent
            ? `Invoice downloaded and sent to customer email`
            : `Invoice downloaded successfully`
        );
      } else {
        setError("Failed to generate invoice PDF");
      }
    } catch (err) {
      console.error("Download invoice error:", err);
      setError("Failed to download invoice");
    } finally {
      setDownloadingInvoice(null);
    }
  };

  // Print invoice directly
  const printInvoice = (sale) => {
    setSelectedSale(sale);
    setShowInvoiceModal(true);
  };

  // Format currency
  const formatCurrency = (amount) => {
    return `৳${Number(amount || 0).toFixed(2)}`;
  };

  // Format date
  const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Get payment status badge
  const getPaymentStatusBadge = (status) => {
    const statusColors = {
      Paid: "bg-green-100 text-green-800",
      Partial: "bg-yellow-100 text-yellow-800",
      Credit: "bg-orange-100 text-orange-800",
      Pending: "bg-gray-100 text-gray-800",
    };

    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[status] || statusColors.Pending}`}
      >
        {status}
      </span>
    );
  };

  return (
    <div className="bg-gray-50">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          <i className="fas fa-history mr-2 text-blue-600"></i>
          Sales History
        </h1>
        <p className="text-gray-500 text-sm">
          View and manage all previous sales transactions
        </p>
      </div>

      {/* Filters Section */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">
            <i className="fas fa-filter mr-2 text-gray-500"></i>
            Filters
          </h2>
          <button
            onClick={resetFilters}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            <i className="fas fa-redo mr-1"></i>
            Reset
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search Invoice
            </label>
            <input
              type="text"
              value={filters.searchTerm}
              onChange={(e) => handleFilterChange("searchTerm", e.target.value)}
              placeholder="Invoice no, customer..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange("startDate", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange("endDate", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Payment Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Status
            </label>
            <select
              value={filters.paymentStatus}
              onChange={(e) =>
                handleFilterChange("paymentStatus", e.target.value)
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option value="Paid">Paid</option>
              <option value="Partial">Partial</option>
              <option value="Credit">Credit</option>
              <option value="Pending">Pending</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={applyFilters}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <i className="fas fa-search mr-2"></i>
            Apply Filters
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <i className="fas fa-exclamation-circle mr-2"></i>
              <span>{error}</span>
            </div>
            <button
              onClick={() => setError("")}
              className="text-red-500 hover:text-red-700"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>
      )}

      {/* Sales Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner />
          </div>
        ) : sales.length === 0 ? (
          <div className="text-center py-12">
            <i className="fas fa-inbox text-6xl text-gray-300 mb-4"></i>
            <p className="text-gray-500 text-lg">No sales found</p>
            <p className="text-gray-400 text-sm mt-2">
              Try adjusting your filters
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Invoice No
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Items
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Paid
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Due
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sales.map((sale) => (
                    <tr
                      key={sale._id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {sale.invoiceNo}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600">
                          {formatDate(sale.saleDate)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {sale.customerName || "Cash Customer"}
                        </div>
                        <div className="text-xs text-gray-500">
                          {sale.customerType || "Walk-in"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600">
                          {sale.items?.length || 0} items
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm font-semibold text-gray-900">
                          {formatCurrency(sale.grandTotal)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm text-green-600">
                          {formatCurrency(
                            (sale.cashPaid || 0) + (sale.bankPaid || 0)
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm text-red-600 font-medium">
                          {formatCurrency(sale.dueAmount || 0)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {getPaymentStatusBadge(sale.paymentStatus)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          {/* View Invoice */}
                          <button
                            onClick={() => viewInvoice(sale._id)}
                            className="text-blue-600 hover:text-blue-800 transition-colors"
                            title="View Invoice"
                          >
                            <i className="fas fa-eye"></i>
                          </button>

                          {/* Print Invoice */}
                          <button
                            onClick={() => printInvoice(sale)}
                            className="text-green-600 hover:text-green-800 transition-colors"
                            title="Print Invoice"
                          >
                            <i className="fas fa-print"></i>
                          </button>

                          {/* Download PDF */}
                          <button
                            onClick={() =>
                              downloadInvoice(sale._id, sale.invoiceNo)
                            }
                            disabled={downloadingInvoice === sale._id}
                            className="text-purple-600 hover:text-purple-800 transition-colors disabled:opacity-50"
                            title="Download PDF"
                          >
                            {downloadingInvoice === sale._id ? (
                              <i className="fas fa-spinner fa-spin"></i>
                            ) : (
                              <i className="fas fa-download"></i>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Showing page {pagination.page} of {pagination.pages} (
                    {pagination.total} total sales)
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        handleFilterChange("page", filters.page - 1)
                      }
                      disabled={filters.page === 1}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <i className="fas fa-chevron-left mr-2"></i>
                      Previous
                    </button>
                    <button
                      onClick={() =>
                        handleFilterChange("page", filters.page + 1)
                      }
                      disabled={filters.page >= pagination.pages}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                      <i className="fas fa-chevron-right ml-2"></i>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Invoice Modal */}
      {showInvoiceModal && selectedSale && (
        <ProfessionalInvoice
          sale={selectedSale}
          onClose={() => {
            setShowInvoiceModal(false);
            setSelectedSale(null);
          }}
        />
      )}
    </div>
  );
};

export default SalesHistory;
