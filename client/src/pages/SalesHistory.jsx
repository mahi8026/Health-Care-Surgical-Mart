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
      // Stream PDF directly from server — no storage dependency
      const token = localStorage.getItem("token");
      const apiUrl = import.meta.env.VITE_API_URL || "/api";
      const url = `${apiUrl}/sales/${saleId}/download-invoice`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
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

  const formatCurrency = (amount) => `৳${Number(amount || 0).toFixed(2)}`;

  const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  const statusBadge = (status) => {
    const colors = {
      Paid: "bg-green-100 text-green-800",
      Partial: "bg-yellow-100 text-yellow-800",
      Credit: "bg-orange-100 text-orange-800",
      Pending: "bg-gray-100 text-gray-800",
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || colors.Pending}`}>
        {status}
      </span>
    );
  };

  return (
    <div>
      {/* Page Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <i className="fas fa-history text-blue-600"></i>
          Sales History
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">View and manage all previous sales transactions</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
            <i className="fas fa-filter text-gray-400"></i> Filters
          </span>
          <button onClick={resetFilters} className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
            <i className="fas fa-redo"></i> Reset
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Search Invoice</label>
            <input
              type="text"
              value={filters.searchTerm}
              onChange={(e) => handleFilterChange("searchTerm", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              placeholder="Invoice no, customer..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange("startDate", e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange("endDate", e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Payment Status</label>
            <select
              value={filters.paymentStatus}
              onChange={(e) => handleFilterChange("paymentStatus", e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
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

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-16">
            <LoadingSpinner />
          </div>
        ) : sales.length === 0 ? (
          <div className="text-center py-16">
            <i className="fas fa-receipt text-5xl text-gray-200 mb-3"></i>
            <p className="text-gray-500 font-medium">No sales found</p>
            <p className="text-gray-400 text-sm mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Invoice No</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Items</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Paid</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Due</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sales.map((sale) => (
                    <tr key={sale._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono font-medium text-gray-900 whitespace-nowrap">
                        {sale.invoiceNo}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {formatDate(sale.saleDate)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{sale.customerName || "Cash Customer"}</div>
                        <div className="text-xs text-gray-400">{sale.customerType || "Walk-in"}</div>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">
                        {sale.items?.length || 0}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">
                        {formatCurrency(sale.grandTotal)}
                      </td>
                      <td className="px-4 py-3 text-right text-green-600 whitespace-nowrap">
                        {formatCurrency((sale.cashPaid || 0) + (sale.bankPaid || 0))}
                      </td>
                      <td className="px-4 py-3 text-right text-red-600 font-medium whitespace-nowrap">
                        {formatCurrency(sale.dueAmount || 0)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {statusBadge(sale.paymentStatus)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-3">
                          <button
                            onClick={() => viewInvoice(sale._id)}
                            className="text-blue-500 hover:text-blue-700 transition-colors"
                            title="View Invoice"
                          >
                            <i className="fas fa-eye"></i>
                          </button>
                          <button
                            onClick={() => printInvoice(sale)}
                            className="text-green-500 hover:text-green-700 transition-colors"
                            title="Print Invoice"
                          >
                            <i className="fas fa-print"></i>
                          </button>
                          <button
                            onClick={() => downloadInvoice(sale._id)}
                            disabled={downloadingInvoice === sale._id}
                            className="text-purple-500 hover:text-purple-700 transition-colors disabled:opacity-40"
                            title="Download PDF"
                          >
                            {downloadingInvoice === sale._id
                              ? <i className="fas fa-spinner fa-spin"></i>
                              : <i className="fas fa-download"></i>
                            }
                          </button>
                          <button
                            onClick={() => openEditDue(sale)}
                            className="text-orange-500 hover:text-orange-700 transition-colors"
                            title="Edit Previous Due"
                          >
                            <i className="fas fa-edit"></i>
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
              <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50">
                <span className="text-xs text-gray-500">
                  Page {pagination.page} of {pagination.pages} &nbsp;·&nbsp; {pagination.total} total
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleFilterChange("page", filters.page - 1)}
                    disabled={filters.page === 1}
                    className="px-3 py-1.5 border border-gray-300 rounded text-xs font-medium text-gray-700 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <i className="fas fa-chevron-left mr-1"></i> Prev
                  </button>
                  <button
                    onClick={() => handleFilterChange("page", filters.page + 1)}
                    disabled={filters.page >= pagination.pages}
                    className="px-3 py-1.5 border border-gray-300 rounded text-xs font-medium text-gray-700 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next <i className="fas fa-chevron-right ml-1"></i>
                  </button>
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
                  <p className="text-sm font-bold text-orange-700">৳{Number(editDueSale.previousDue || 0).toFixed(2)}</p>
                </div>
                <div className="bg-red-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-red-500 mb-1">Sale Due</p>
                  <p className="text-sm font-bold text-red-700">৳{Number(editDueSale.dueAmount || 0).toFixed(2)}</p>
                </div>
              </div>

              {/* Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Previous Due Amount (৳)
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
                    ৳{(parseFloat(editDueValue || 0) + (editDueSale.dueAmount || 0)).toFixed(2)}
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
