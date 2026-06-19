import React, { useState, useEffect } from "react";
import api from "../config/api";
import LoadingSpinner from "../components/LoadingSpinner";
import ProfessionalInvoice from "../components/ProfessionalInvoice";

const SalesHistory = () => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedSale, setSelectedSale] = useState(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState(null);

  // Edit Previous Due state
  const [editDueSale, setEditDueSale] = useState(null);
  const [editDueValue, setEditDueValue] = useState("");
  const [editDueLoading, setEditDueLoading] = useState(false);
  const [editDueError, setEditDueError] = useState("");

  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    paymentStatus: "",
    searchTerm: "",
    page: 1,
    limit: 20,
  });

  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    pages: 1,
  });

  const fetchSalesHistory = async (overrideFilters) => {
    setLoading(true);
    setError("");
    try {
      const f = overrideFilters || filters;
      const params = new URLSearchParams();
      if (f.startDate) params.append("startDate", f.startDate);
      if (f.endDate) params.append("endDate", f.endDate);
      if (f.paymentStatus) params.append("paymentStatus", f.paymentStatus);
      if (f.searchTerm) params.append("search", f.searchTerm);
      params.append("page", f.page);
      params.append("limit", f.limit);

      const response = await api.get(`/sales?${params.toString()}`);
      if (response.success) {
        setSales(response.data?.sales || response.data || []);
        if (response.data?.pagination) setPagination(response.data.pagination);
        else if (response.pagination) setPagination(response.pagination);
      } else {
        setError(response.message || "Failed to fetch sales history");
      }
    } catch (err) {
      setError("Failed to fetch sales history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalesHistory();
  }, [filters.page, filters.limit]);

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value, page: 1 }));
  };

  const applyFilters = () => fetchSalesHistory();

  const resetFilters = () => {
    const reset = {
      startDate: "", endDate: "", paymentStatus: "",
      searchTerm: "", page: 1, limit: 20,
    };
    setFilters(reset);
    fetchSalesHistory(reset);
  };

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
    } catch {
      setError("Failed to load invoice");
    } finally {
      setLoading(false);
    }
  };

  const downloadInvoice = async (saleId) => {
    try {
      setDownloadingInvoice(saleId);
      // Stream PDF directly from server — uses httpOnly cookie for auth
      const apiUrl = import.meta.env.VITE_API_URL || "/api";
      const url = `${apiUrl}/sales/${saleId}/download-invoice`;

      const response = await fetch(url, {
        credentials: "include",  // Send httpOnly cookie automatically
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || "Failed to generate invoice");
      }

      // Trigger browser download
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `invoice-${saleId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      console.error("Download invoice error:", err);
      setError(err.message || "Failed to download invoice");
    } finally {
      setDownloadingInvoice(null);
    }
  };

  const printInvoice = (sale) => {
    setSelectedSale(sale);
    setShowInvoiceModal(true);
  };

  const openEditDue = (sale) => {
    setEditDueSale(sale);
    setEditDueValue((sale.previousDue || 0).toString());
    setEditDueError("");
  };

  const closeEditDue = () => {
    setEditDueSale(null);
    setEditDueValue("");
    setEditDueError("");
  };

  const submitEditDue = async () => {
    const val = parseFloat(editDueValue);
    if (isNaN(val) || val < 0) {
      setEditDueError("Please enter a valid non-negative amount");
      return;
    }
    setEditDueLoading(true);
    setEditDueError("");
    try {
      const response = await api.patch(`/sales/${editDueSale._id}/previous-due`, { previousDue: val });
      if (response.success) {
        setSales((prev) =>
          prev.map((s) =>
            s._id === editDueSale._id
              ? { ...s, previousDue: val, totalOutstanding: val + (s.dueAmount || 0) }
              : s
          )
        );
        closeEditDue();
      } else {
        setEditDueError(response.message || "Failed to update");
      }
    } catch (err) {
      setEditDueError(err?.message || "Failed to update previous due");
    } finally {
      setEditDueLoading(false);
    }
  };

  const formatCurrency = (amount) => `Tk ${Number(amount || 0).toFixed(2)}`;

  const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  const statusBadge = (status) => {
    const colors = {
      Paid: "bg-gradient-to-r from-green-500 to-emerald-500 text-white",
      Partial: "bg-gradient-to-r from-yellow-400 to-amber-400 text-white",
      Credit: "bg-gradient-to-r from-orange-500 to-red-500 text-white",
      Pending: "bg-gradient-to-r from-gray-400 to-gray-500 text-white",
    };
    const icons = {
      Paid: "fa-check-circle",
      Partial: "fa-exclamation-circle",
      Credit: "fa-clock",
      Pending: "fa-hourglass-half",
    };
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold shadow-sm ${colors[status] || colors.Pending}`}>
        <i className={`fas ${icons[status] || icons.Pending}`}></i>
        {status}
      </span>
    );
  };

  return (
    <div className="max-w-[1600px]">

      {/* Enhanced Filters Section */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2.5 rounded-lg shadow-md">
              <i className="fas fa-filter text-white text-sm"></i>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Filter Sales</h3>
              <p className="text-xs text-gray-500">Narrow down your search results</p>
            </div>
          </div>
          <button 
            onClick={resetFilters} 
            className="px-4 py-2 bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 text-gray-700 rounded-lg font-medium text-sm transition-all shadow-sm flex items-center gap-2"
          >
            <i className="fas fa-redo-alt"></i> Reset All
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {/* Search Input */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
              <i className="fas fa-search text-indigo-500 text-xs"></i>
              Search Invoice
            </label>
            <div className="relative">
              <input
                type="text"
                value={filters.searchTerm}
                onChange={(e) => handleFilterChange("searchTerm", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyFilters();
                  }
                }}
                placeholder="Invoice no, customer..."
                className="w-full pl-10 pr-10 py-2.5 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
              <i className="fas fa-search absolute left-3 top-3.5 text-gray-400 text-xs"></i>
              {filters.searchTerm && (
                <button
                  onClick={() => {
                    handleFilterChange("searchTerm", "");
                    // Auto-apply when clearing to show all results immediately
                    setTimeout(() => applyFilters(), 0);
                  }}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                  title="Clear search"
                >
                  <i className="fas fa-times text-xs"></i>
                </button>
              )}
            </div>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
              <i className="fas fa-calendar-alt text-green-500 text-xs"></i>
              Start Date
            </label>
            <div className="relative">
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange("startDate", e.target.value)}
                className="w-full px-4 py-2.5 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* End Date */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
              <i className="fas fa-calendar-check text-blue-500 text-xs"></i>
              End Date
            </label>
            <div className="relative">
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange("endDate", e.target.value)}
                className="w-full px-4 py-2.5 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Payment Status */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
              <i className="fas fa-money-check-alt text-purple-500 text-xs"></i>
              Payment Status
            </label>
            <div className="relative">
              <select
                value={filters.paymentStatus}
                onChange={(e) => handleFilterChange("paymentStatus", e.target.value)}
                className="w-full px-4 py-2.5 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all appearance-none bg-white"
              >
                <option value="">All Status</option>
                <option value="Paid">✓ Paid</option>
                <option value="Partial">⚠ Partial</option>
                <option value="Credit">⏱ Credit</option>
                <option value="Pending">⏳ Pending</option>
              </select>
              <i className="fas fa-chevron-down absolute right-3 top-3.5 text-gray-400 text-xs pointer-events-none"></i>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-gray-500 flex items-center gap-1.5">
            <i className="fas fa-info-circle text-blue-500"></i>
            Press <kbd className="px-2 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-mono">Enter</kbd> in search to apply
          </div>
          <button
            onClick={applyFilters}
            className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg font-semibold text-sm transition-all shadow-md hover:shadow-lg flex items-center gap-2"
          >
            <i className="fas fa-search"></i> Apply Filters
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg mb-3 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <i className="fas fa-exclamation-circle"></i>
            <span>{error}</span>
          </div>
          <button onClick={() => setError("")} className="text-red-400 hover:text-red-600">
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}

      {/* Enhanced Table */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex flex-col justify-center items-center py-20">
            <LoadingSpinner />
            <p className="text-gray-500 mt-4 text-sm">Loading sales history...</p>
          </div>
        ) : sales.length === 0 ? (
          <div className="text-center py-20">
            <div className="bg-gray-100 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-receipt text-5xl text-gray-300"></i>
            </div>
            <p className="text-gray-600 font-semibold text-lg">No sales found</p>
            <p className="text-gray-400 text-sm mt-2">Try adjusting your filters or create a new sale</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white">
                    <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <i className="fas fa-hashtag"></i>
                        Invoice No
                      </div>
                    </th>
                    <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <i className="fas fa-calendar"></i>
                        Date
                      </div>
                    </th>
                    <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <i className="fas fa-user"></i>
                        Customer
                      </div>
                    </th>
                    <th className="px-4 py-4 text-center text-xs font-bold uppercase tracking-wider">
                      <div className="flex items-center justify-center gap-2">
                        <i className="fas fa-boxes"></i>
                        Items
                      </div>
                    </th>
                    <th className="px-4 py-4 text-right text-xs font-bold uppercase tracking-wider">
                      <div className="flex items-center justify-end gap-2">
                        <i className="fas fa-money-bill-wave"></i>
                        Total
                      </div>
                    </th>
                    <th className="px-4 py-4 text-right text-xs font-bold uppercase tracking-wider">
                      <div className="flex items-center justify-end gap-2">
                        <i className="fas fa-check-circle"></i>
                        Paid
                      </div>
                    </th>
                    <th className="px-4 py-4 text-right text-xs font-bold uppercase tracking-wider">
                      <div className="flex items-center justify-end gap-2">
                        <i className="fas fa-exclamation-triangle"></i>
                        Due
                      </div>
                    </th>
                    <th className="px-4 py-4 text-center text-xs font-bold uppercase tracking-wider">
                      <div className="flex items-center justify-center gap-2">
                        <i className="fas fa-info-circle"></i>
                        Status
                      </div>
                    </th>
                    <th className="px-4 py-4 text-center text-xs font-bold uppercase tracking-wider">
                      <div className="flex items-center justify-center gap-2">
                        <i className="fas fa-cog"></i>
                        Actions
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {sales.map((sale, index) => (
                    <tr 
                      key={sale._id} 
                      className={`hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 transition-all duration-200 ${
                        index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                      }`}
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shadow-sm">
                            {index + 1}
                          </div>
                          <span className="font-mono font-semibold text-gray-900">
                            {sale.invoiceNo}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-gray-700 font-medium text-xs">
                          {formatDate(sale.saleDate)}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className="bg-gradient-to-br from-purple-500 to-pink-500 text-white w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-sm">
                            {(sale.customerName || "C")[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">{sale.customerName || "Cash Customer"}</div>
                            <div className="text-xs text-gray-500 flex items-center gap-1">
                              <i className="fas fa-tag text-xs"></i>
                              {sale.customerType || "Walk-in"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="inline-flex items-center justify-center bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-700 font-bold px-3 py-1 rounded-full text-xs shadow-sm">
                          {sale.items?.length || 0}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="font-bold text-gray-900 text-base">
                          {formatCurrency(sale.grandTotal)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="font-semibold text-green-600">
                          {formatCurrency((sale.cashPaid || 0) + (sale.bankPaid || 0))}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className={`font-bold ${(sale.dueAmount || 0) > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                          {formatCurrency(sale.dueAmount || 0)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        {statusBadge(sale.paymentStatus)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => viewInvoice(sale._id)}
                            className="bg-blue-500 hover:bg-blue-600 text-white w-8 h-8 rounded-lg transition-all shadow-sm hover:shadow-md flex items-center justify-center"
                            title="View Invoice"
                          >
                            <i className="fas fa-eye text-xs"></i>
                          </button>
                          <button
                            onClick={() => printInvoice(sale)}
                            className="bg-green-500 hover:bg-green-600 text-white w-8 h-8 rounded-lg transition-all shadow-sm hover:shadow-md flex items-center justify-center"
                            title="Print Invoice"
                          >
                            <i className="fas fa-print text-xs"></i>
                          </button>
                          <button
                            onClick={() => downloadInvoice(sale._id)}
                            disabled={downloadingInvoice === sale._id}
                            className="bg-purple-500 hover:bg-purple-600 text-white w-8 h-8 rounded-lg transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                            title="Download PDF"
                          >
                            {downloadingInvoice === sale._id
                              ? <i className="fas fa-spinner fa-spin text-xs"></i>
                              : <i className="fas fa-download text-xs"></i>
                            }
                          </button>
                          <button
                            onClick={() => openEditDue(sale)}
                            className="bg-orange-500 hover:bg-orange-600 text-white w-8 h-8 rounded-lg transition-all shadow-sm hover:shadow-md flex items-center justify-center"
                            title="Edit Previous Due"
                          >
                            <i className="fas fa-edit text-xs"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Enhanced Pagination */}
            {pagination.pages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-700">
                      Page <span className="font-bold text-indigo-600">{pagination.page}</span> of <span className="font-bold">{pagination.pages}</span>
                    </span>
                    <div className="h-4 w-px bg-gray-300"></div>
                    <span className="text-sm text-gray-600 flex items-center gap-1.5">
                      <i className="fas fa-list-ul text-indigo-500"></i>
                      <span className="font-semibold text-indigo-600">{pagination.total}</span> total records
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleFilterChange("page", 1)}
                      disabled={filters.page === 1}
                      className="px-3 py-2 bg-white border-2 border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gradient-to-r hover:from-indigo-500 hover:to-purple-500 hover:text-white hover:border-transparent transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-gray-700"
                      title="First Page"
                    >
                      <i className="fas fa-angle-double-left"></i>
                    </button>
                    <button
                      onClick={() => handleFilterChange("page", filters.page - 1)}
                      disabled={filters.page === 1}
                      className="px-4 py-2 bg-white border-2 border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gradient-to-r hover:from-indigo-500 hover:to-purple-500 hover:text-white hover:border-transparent transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-gray-700 flex items-center gap-2"
                    >
                      <i className="fas fa-chevron-left"></i> Previous
                    </button>
                    <button
                      onClick={() => handleFilterChange("page", filters.page + 1)}
                      disabled={filters.page >= pagination.pages}
                      className="px-4 py-2 bg-white border-2 border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gradient-to-r hover:from-indigo-500 hover:to-purple-500 hover:text-white hover:border-transparent transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-gray-700 flex items-center gap-2"
                    >
                      Next <i className="fas fa-chevron-right"></i>
                    </button>
                    <button
                      onClick={() => handleFilterChange("page", pagination.pages)}
                      disabled={filters.page >= pagination.pages}
                      className="px-3 py-2 bg-white border-2 border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gradient-to-r hover:from-indigo-500 hover:to-purple-500 hover:text-white hover:border-transparent transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-gray-700"
                      title="Last Page"
                    >
                      <i className="fas fa-angle-double-right"></i>
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
          onClose={() => { setShowInvoiceModal(false); setSelectedSale(null); }}
          onDownload={downloadInvoice}
        />
      )}

      {/* Edit Previous Due Modal */}
      {editDueSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-white font-bold text-lg">Edit Previous Due</h3>
                <p className="text-orange-100 text-xs mt-0.5">Invoice: {editDueSale.invoiceNo}</p>
              </div>
              <button
                onClick={closeEditDue}
                className="text-white/80 hover:text-white transition-colors"
              >
                <i className="fas fa-times text-lg"></i>
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {/* Info cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">Customer</p>
                  <p className="text-sm font-semibold text-gray-800 truncate">{editDueSale.customerName || "Cash"}</p>
                </div>
                <div className="bg-orange-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-orange-600 mb-1">Current Previous Due</p>
                  <p className="text-sm font-bold text-orange-700">Tk {Number(editDueSale.previousDue || 0).toFixed(2)}</p>
                </div>
                <div className="bg-red-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-red-500 mb-1">Sale Due</p>
                  <p className="text-sm font-bold text-red-700">Tk {Number(editDueSale.dueAmount || 0).toFixed(2)}</p>
                </div>
              </div>

              {/* Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Previous Due Amount (Tk)
                </label>
                <input
                  id="edit-previous-due-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={editDueValue}
                  onChange={(e) => { setEditDueValue(e.target.value); setEditDueError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && submitEditDue()}
                  className="w-full px-4 py-2.5 border-2 border-orange-200 focus:border-orange-400 rounded-lg focus:outline-none text-lg font-semibold text-gray-800"
                  placeholder="0.00"
                  autoFocus
                />
                {editDueError && (
                  <p className="text-red-600 text-xs mt-1 flex items-center gap-1">
                    <i className="fas fa-exclamation-circle"></i> {editDueError}
                  </p>
                )}
              </div>

              {/* Preview of new outstanding */}
              {editDueValue !== "" && !isNaN(parseFloat(editDueValue)) && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex justify-between items-center">
                  <span className="text-sm text-blue-700">New Total Outstanding</span>
                  <span className="font-bold text-blue-800 text-base">
                    Tk {(parseFloat(editDueValue || 0) + (editDueSale.dueAmount || 0)).toFixed(2)}
                  </span>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={closeEditDue}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                  disabled={editDueLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={submitEditDue}
                  disabled={editDueLoading}
                  className="flex-1 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  {editDueLoading ? (
                    <><i className="fas fa-spinner fa-spin"></i> Saving...</>
                  ) : (
                    <><i className="fas fa-save"></i> Save Changes</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesHistory;
