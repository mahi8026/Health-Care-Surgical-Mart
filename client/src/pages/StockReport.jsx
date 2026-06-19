import React, { useState, useEffect, useCallback, useRef } from "react";
import api from "../config/api";
import LoadingSpinner from "../components/LoadingSpinner";
import Modal from "../components/ui/Modal";
import Pagination from "../components/ui/Pagination";
import { useStock } from "../contexts/StockContext";

// ── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n) => new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT", minimumFractionDigits: 0 }).format(n || 0);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" }) : "—";
const fmtDateTime = (d) => d ? new Date(d).toLocaleString("en-BD", { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

const todayMidnight = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
const daysUntilExpiry = (expiryDate) => { if (!expiryDate) return null; return Math.ceil((new Date(expiryDate) - todayMidnight()) / (1000*60*60*24)); };
const expiryStyle = (expiryDate) => {
  const days = daysUntilExpiry(expiryDate);
  if (days === null) return { row: "", cell: "text-gray-400", badge: "bg-gray-100 text-gray-500", label: "—" };
  if (days < 0)   return { row: "bg-red-100",    cell: "text-red-700 font-semibold",    badge: "bg-red-600 text-white",    label: `Expired ${Math.abs(days)}d ago` };
  if (days <= 30) return { row: "bg-orange-50", cell: "text-orange-700 font-semibold", badge: "bg-orange-100 text-orange-700", label: `${days}d left` };
  if (days <= 60) return { row: "bg-yellow-50", cell: "text-yellow-700",               badge: "bg-yellow-100 text-yellow-700", label: `${days}d left` };
  return { row: "", cell: "text-green-700", badge: "bg-green-100 text-green-700", label: `${days}d left` };
};

// ── Export to Excel (CSV) ─────────────────────────────────────────────────────
const exportToExcel = (stockData) => {
  const headers = [
    "Product", "SKU", "Batch No", "Lot No", "Current Qty", "Unit",
    "Cost Price", "Selling Price", "Stock Value", "Reorder Point",
    "Expiry Date", "Status", "Category", "Supplier",
  ];
  const rows = stockData.map((item) => {
    const qty = item.currentQty ?? item.quantity ?? 0;
    const cost = item.product?.purchasePrice ?? item.purchasePrice ?? 0;
    const reorder = item.reorderPoint ?? item.product?.reorderPoint ?? item.minStockLevel ?? 0;
    const status = qty === 0 ? "Out of Stock" : qty <= reorder ? "Low Stock" : "In Stock";
    return [
      item.productName ?? item.product?.name ?? "",
      item.sku ?? item.product?.sku ?? "",
      item.batchNo ?? "",
      item.lotNo ?? "",
      qty,
      item.unit ?? item.product?.unit ?? "",
      cost,
      item.product?.sellingPrice ?? item.sellingPrice ?? 0,
      (qty * cost).toFixed(2),
      reorder,
      item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : "",
      status,
      item.category ?? item.product?.category ?? "",
      item.supplier ?? item.product?.supplier ?? "",
    ];
  });
  const csv = [headers, ...rows].map((r) => r.map((f) => `"${f}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `stock-report-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

// ── Stock Progress Bar ────────────────────────────────────────────────────────
const StockBar = ({ qty, maxStock, reorderPoint }) => {
  if (!maxStock || maxStock <= 0) return null;
  const pct = Math.min(100, Math.round((qty / maxStock) * 100));
  const color = pct < 10 || qty <= reorderPoint ? "bg-red-500" : pct < 50 ? "bg-orange-400" : "bg-green-500";
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
      <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
};

// ── Stock Movement History Modal ──────────────────────────────────────────────
const StockMovementModal = ({ isOpen, onClose, product }) => {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  useEffect(() => {
    if (isOpen && product) {
      fetchMovements();
    }
  }, [isOpen, product, dateRange, page]);

  const fetchMovements = async () => {
    if (!product?._id && !product?.productId) return;
    setLoading(true);
    try {
      const productId = product._id || product.productId;
      // Updated to use new event-sourced ledger endpoint
      let url = `/stock/${productId}/ledger?page=${page}&limit=50`;
      if (dateRange.start) url += `&startDate=${dateRange.start}`;
      if (dateRange.end) url += `&endDate=${dateRange.end}`;
      
      const response = await api.get(url);
      if (response.success) {
        setMovements(response.data || []);
        setPagination(response.pagination);
      }
    } catch (error) {
      console.error("Failed to fetch movement history:", error);
    } finally {
      setLoading(false);
    }
  };

  const resetDateRange = () => {
    setDateRange({ start: "", end: "" });
    setPage(1);
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Stock Movement History - ${product?.productName || product?.product?.name || "Product"}`} size="xl">
      <div className="space-y-4">
        {/* Date Range Filter */}
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">From Date</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="input-field"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">To Date</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="input-field"
            />
          </div>
          <button onClick={resetDateRange} className="btn-secondary mt-6">
            <i className="fas fa-redo mr-2"></i>Reset
          </button>
        </div>

        {/* Movement Table */}
        {loading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : movements.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <i className="fas fa-inbox text-4xl mb-2"></i>
            <p>No movement history found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty Change</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Note</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {movements.map((mov, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{fmtDateTime(mov.date)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          mov.type === "Sale" ? "bg-red-100 text-red-700" :
                          mov.type === "Purchase" ? "bg-green-100 text-green-700" :
                          mov.type === "Return" ? "bg-blue-100 text-blue-700" :
                          "bg-purple-100 text-purple-700"
                        }`}>
                          {mov.type}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-sm text-right font-semibold ${mov.qtyChange >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {mov.qtyChange >= 0 ? "+" : ""}{mov.qtyChange}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">{mov.runningBalance}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{mov.reference || "—"}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{mov.user || "—"}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{mov.note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
              <div className="flex justify-center mt-4">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.pages}
                  onPageChange={setPage}
                />
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};

// ── Stock Adjustment Modal ────────────────────────────────────────────────────
const StockAdjustmentModal = ({ isOpen, onClose, product, onSuccess }) => {
  const [formData, setFormData] = useState({
    adjustmentType: "add",
    quantity: "",
    reason: "Count Correction",
    batchNo: "",
    expiryDate: "",
    note: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen && product) {
      setFormData({
        adjustmentType: "add",
        quantity: "",
        reason: "Count Correction",
        batchNo: product.batchNo || "",
        expiryDate: product.expiryDate ? new Date(product.expiryDate).toISOString().split("T")[0] : "",
        note: "",
      });
      setError("");
    }
  }, [isOpen, product]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.quantity || parseFloat(formData.quantity) <= 0) {
      if (formData.adjustmentType !== 'set_exact') {
        setError("Please enter a valid quantity");
        return;
      }
    }

    if (formData.reason === "Other" && !formData.note.trim()) {
      setError("Note is required when reason is Other");
      return;
    }

    setLoading(true);
    try {
      const productId = product._id || product.productId;
      
      // Map adjustment type to backend format (ADD, SUBTRACT, SET)
      const adjustmentTypeMap = {
        'add': 'ADD',
        'subtract': 'SUBTRACT',
        'set_exact': 'SET'
      };
      
      const payload = {
        productId: productId,
        adjustmentType: adjustmentTypeMap[formData.adjustmentType] || 'ADD',
        quantity: parseFloat(formData.quantity),
        reason: formData.reason,
        notes: formData.note,
      };

      // Use new Phase 5A endpoint
      const response = await api.post(`/stock/adjust`, payload);
      if (response.success) {
        onSuccess?.();
        onClose();
      } else {
        setError(response.message || "Failed to adjust stock");
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to adjust stock");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Adjust Stock - ${product?.productName || product?.product?.name || "Product"}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Current Stock Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">Current Stock:</span>
            <span className="text-lg font-bold text-blue-600">{product?.currentQty ?? product?.quantity ?? 0}</span>
          </div>
        </div>

        {/* Adjustment Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Adjustment Type</label>
          <div className="grid grid-cols-3 gap-2">
            {["add", "subtract", "set_exact"].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setFormData({ ...formData, adjustmentType: type })}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  formData.adjustmentType === type
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {type === "add" ? "Add Stock" : type === "subtract" ? "Remove Stock" : "Set Exact"}
              </button>
            ))}
          </div>
        </div>

        {/* Quantity */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Quantity {formData.adjustmentType === "set_exact" ? "(New Total)" : ""}
          </label>
          <input
            type="number"
            min="0"
            step="1"
            value={formData.quantity}
            onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
            className="input-field"
            required
          />
        </div>

        {/* Reason */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
          <select
            value={formData.reason}
            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
            className="input-field"
            required
          >
            <option value="Count Correction">Count Correction</option>
            <option value="Damage">Damage</option>
            <option value="Expiry Write-off">Expiry Write-off</option>
            <option value="Theft">Theft</option>
            <option value="Supplier Return">Supplier Return</option>
            <option value="Opening Stock">Opening Stock</option>
            <option value="Other">Other</option>
          </select>
        </div>

        {/* Batch No */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Batch No (Optional)</label>
          <input
            type="text"
            value={formData.batchNo}
            onChange={(e) => setFormData({ ...formData, batchNo: e.target.value })}
            className="input-field"
          />
        </div>

        {/* Expiry Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">New Expiry Date (Optional)</label>
          <input
            type="date"
            value={formData.expiryDate}
            onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
            className="input-field"
          />
        </div>

        {/* Note */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Note {formData.reason === "Other" && <span className="text-red-500">*</span>}
          </label>
          <textarea
            value={formData.note}
            onChange={(e) => setFormData({ ...formData, note: e.target.value })}
            className="input-field"
            rows="3"
            required={formData.reason === "Other"}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button type="button" onClick={onClose} className="btn-secondary" disabled={loading}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Adjusting..." : "Confirm Adjustment"}
          </button>
        </div>
      </form>
    </Modal>
  );
};


// ── Main Stock Report Component ───────────────────────────────────────────────
const StockReport = () => {
  const [stockData, setStockData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Get real-time connection status from StockContext
  const { realtimeConnected, fetchSnapshots: contextFetchSnapshots } = useStock();
  
  // Summary stats
  const [summary, setSummary] = useState({
    totalSKUs: 0,
    totalStockValue: 0,
    lowStockCount: 0,
    expiringSoonCount: 0,
  });

  // Filters
  const [filters, setFilters] = useState({
    search: "",
    category: "",
    status: "all",
    supplier: "",
    expiryFrom: "",
    expiryTo: "",
  });

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const maxLimit = 100; // Hard limit
  const [pagination, setPagination] = useState(null);

  // Dropdowns data
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  // Bulk selection
  const [selectedItems, setSelectedItems] = useState([]);

  // Modals
  const [movementModal, setMovementModal] = useState({ isOpen: false, product: null });
  const [adjustmentModal, setAdjustmentModal] = useState({ isOpen: false, product: null });

  // Fetch categories and suppliers with delay to avoid rate limiting
  useEffect(() => {
    const fetchDropdowns = async () => {
      try {
        // Fetch categories first
        const catRes = await api.get("/categories");
        if (catRes.success) setCategories(catRes.data || []);
        
        // Wait 500ms before fetching suppliers to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const supRes = await api.get("/suppliers");
        if (supRes.success) setSuppliers(supRes.data || []);
      } catch (err) {
        console.error("Failed to fetch dropdowns:", err);
      }
    };
    fetchDropdowns();
  }, []);

  // Fetch stock data
  const fetchStockDataRef = useRef(false); // Prevent duplicate requests with ref
  
  const fetchStockData = useCallback(async () => {
    // Prevent duplicate requests using ref
    if (fetchStockDataRef.current) {
      console.log('Already loading, skipping duplicate request');
      return;
    }
    
    fetchStockDataRef.current = true;
    setLoading(true);
    setError("");
    
    try {
      // Enforce max limit to prevent excessive data queries
      const effectiveLimit = Math.min(limit, maxLimit);
      
      // Build query params for new snapshots endpoint
      const params = {
        page,
        limit: effectiveLimit,
        search: filters.search || undefined,
        category: filters.category || undefined,
        status: filters.status !== "all" ? filters.status : undefined,
        supplier: filters.supplier || undefined,
        expiryFrom: filters.expiryFrom || undefined,
        expiryTo: filters.expiryTo || undefined,
        sortBy: 'productName',
        sortOrder: 'asc',
      };

      // Use new event-sourced snapshots endpoint
      const response = await api.get('/stock/snapshots', { params });
      
      if (response.success) {
        setStockData(response.data || []);
        setPagination(response.pagination);
        
        // Calculate summary
        const totalSKUs = response.pagination?.total || 0;
        const totalValue = (response.data || []).reduce((sum, item) => {
          const qty = item.onHandQty ?? item.availableQty ?? 0;
          const cost = item.avgCostPrice ?? 0;
          return sum + (qty * cost);
        }, 0);
        
        // Fetch counts for summary cards from new endpoints (with error handling)
        try {
          const [lowStockRes, expiringRes] = await Promise.all([
            api.get("/stock/reorder-alerts").catch(() => ({ success: false, meta: { count: 0 } })),
            api.get("/stock/expiry-alerts?days=30").catch(() => ({ success: false, meta: { count: 0 } })),
          ]);
          
          setSummary({
            totalSKUs,
            totalStockValue: totalValue,
            lowStockCount: lowStockRes.success ? lowStockRes.meta?.count || 0 : 0,
            expiringSoonCount: expiringRes.success ? expiringRes.meta?.count || 0 : 0,
          });
        } catch (alertErr) {
          // If alerts fail, still show main data
          console.warn('Failed to fetch alert counts:', alertErr);
          setSummary({
            totalSKUs,
            totalStockValue: totalValue,
            lowStockCount: 0,
            expiringSoonCount: 0,
          });
        }
      } else {
        setError(response.message || "Failed to fetch stock data");
      }
    } catch (err) {
      // Handle specific error codes
      if (err.response?.status === 429) {
        setError("Too many requests. The server is rate limiting. Please wait 1-2 minutes and refresh.");
      } else if (err.response?.status === 503) {
        setError("Server is starting up. Please wait 30-60 seconds and try again.");
      } else {
        setError(err.response?.data?.message || err.message || "Failed to fetch stock data");
      }
    } finally {
      setLoading(false);
      fetchStockDataRef.current = false; // Reset the ref
    }
  }, [page, limit, filters]);

  useEffect(() => {
    // Delay initial fetch to avoid rate limiting on page load
    const timeoutId = setTimeout(() => {
      fetchStockData();
    }, 1000); // Wait 1 second after component mounts
    
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit]); // Only refetch when page or limit changes, not on every filter change

  // Handle filter changes (don't auto-fetch)
  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value });
    // Don't automatically fetch - user must click Apply or press Enter
  };

  // Apply filters manually
  const applyFilters = () => {
    setPage(1); // Reset to first page
    fetchStockData();
  };

  // Handle summary card click
  const handleCardClick = (filterType) => {
    if (filterType === "low_stock") {
      setFilters({ ...filters, status: "low_stock" });
    } else if (filterType === "expiring_soon") {
      setFilters({ ...filters, status: "expiring_30d" });
    }
    setPage(1);
  };

  // Handle bulk selection
  const toggleSelectAll = () => {
    if (selectedItems.length === stockData.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(stockData.map((item) => item._id || item.productId));
    }
  };

  const toggleSelectItem = (id) => {
    if (selectedItems.includes(id)) {
      setSelectedItems(selectedItems.filter((i) => i !== id));
    } else {
      setSelectedItems([...selectedItems, id]);
    }
  };

  // Export filtered data
  const handleExport = () => {
    const dataToExport = selectedItems.length > 0
      ? stockData.filter((item) => selectedItems.includes(item._id || item.productId))
      : stockData;
    exportToExcel(dataToExport);
  };

  // Reset filters
  const resetFilters = () => {
    setFilters({
      search: "",
      category: "",
      status: "all",
      supplier: "",
      expiryFrom: "",
      expiryTo: "",
    });
    setPage(1);
  };

  return (
    <div className="space-y-6 max-w-[1600px]">
      {/* Enhanced Header with Gradient Background */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
                <i className="fas fa-boxes"></i>
              </div>
              Stock Management
            </h1>
            <p className="text-teal-100 mt-2 text-sm">Complete inventory overview and real-time operations</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Real-time connection indicator */}
            <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold shadow-md ${
              realtimeConnected 
                ? 'bg-white text-emerald-600' 
                : 'bg-white/20 text-white border-2 border-white/30'
            }`}>
              <span className={`w-2.5 h-2.5 rounded-full ${
                realtimeConnected ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'
              }`}></span>
              <span>{realtimeConnected ? 'Live' : 'Offline'}</span>
            </div>
            <button 
              onClick={fetchStockData} 
              className="px-4 py-2.5 bg-white hover:bg-gray-50 text-teal-700 rounded-lg font-semibold shadow-md transition-all flex items-center gap-2"
            >
              <i className="fas fa-sync-alt"></i> Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <i className="fas fa-exclamation-circle mr-2"></i>
          {error}
        </div>
      )}

      {/* Enhanced Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-5 hover:shadow-lg transition-shadow cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-600 mb-1">Total SKUs</p>
              <p className="text-3xl font-bold text-gray-900">{summary.totalSKUs}</p>
              <p className="text-xs text-gray-500 mt-2">Unique products</p>
            </div>
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-4 rounded-xl shadow-md">
              <i className="fas fa-boxes text-white text-2xl"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-5 hover:shadow-lg transition-shadow cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-600 mb-1">Total Stock Value</p>
              <p className="text-3xl font-bold text-emerald-600">{fmt(summary.totalStockValue)}</p>
              <p className="text-xs text-gray-500 mt-2">Cost price basis</p>
            </div>
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-4 rounded-xl shadow-md">
              <i className="fas fa-dollar-sign text-white text-2xl"></i>
            </div>
          </div>
        </div>

        <div
          className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl shadow-md border-2 border-orange-200 p-5 hover:shadow-lg transition-all cursor-pointer"
          onClick={() => handleCardClick("low_stock")}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-orange-700 mb-1">Low Stock</p>
              <p className="text-3xl font-bold text-orange-600">{summary.lowStockCount}</p>
              <p className="text-xs text-orange-600 mt-2 flex items-center gap-1">
                <i className="fas fa-mouse-pointer"></i> Click to filter
              </p>
            </div>
            <div className="bg-gradient-to-br from-orange-500 to-red-500 p-4 rounded-xl shadow-md">
              <i className="fas fa-exclamation-triangle text-white text-2xl"></i>
            </div>
          </div>
        </div>

        <div
          className="bg-gradient-to-br from-red-50 to-pink-50 rounded-xl shadow-md border-2 border-red-200 p-5 hover:shadow-lg transition-all cursor-pointer"
          onClick={() => handleCardClick("expiring_soon")}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-red-700 mb-1">Expiring Soon</p>
              <p className="text-3xl font-bold text-red-600">{summary.expiringSoonCount}</p>
              <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                <i className="fas fa-mouse-pointer"></i> ≤30 days • Click
              </p>
            </div>
            <div className="bg-gradient-to-br from-red-500 to-pink-600 p-4 rounded-xl shadow-md">
              <i className="fas fa-calendar-times text-white text-2xl"></i>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Filter Bar */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-teal-500 to-cyan-600 p-2.5 rounded-lg shadow-md">
              <i className="fas fa-filter text-white text-sm"></i>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Filter Stock</h3>
              <p className="text-xs text-gray-500">Refine your inventory search</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* Search */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
              <i className="fas fa-search text-teal-500 text-xs"></i>
              Search
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Product, SKU, or batch..."
                value={filters.search}
                onChange={(e) => handleFilterChange("search", e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
              />
              <i className="fas fa-search absolute left-3 top-3.5 text-gray-400 text-xs"></i>
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
              <i className="fas fa-tags text-blue-500 text-xs"></i>
              Category
            </label>
            <div className="relative">
              <select
                value={filters.category}
                onChange={(e) => handleFilterChange("category", e.target.value)}
                className="w-full px-4 py-2.5 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none bg-white"
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat._id} value={cat.name}>{cat.name}</option>
                ))}
              </select>
              <i className="fas fa-chevron-down absolute right-3 top-3.5 text-gray-400 text-xs pointer-events-none"></i>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
              <i className="fas fa-info-circle text-purple-500 text-xs"></i>
              Status
            </label>
            <div className="relative">
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange("status", e.target.value)}
                className="w-full px-4 py-2.5 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all appearance-none bg-white"
              >
                <option value="all">All</option>
                <option value="in_stock">✓ In Stock</option>
                <option value="low_stock">⚠ Low Stock</option>
                <option value="out_of_stock">✗ Out of Stock</option>
                <option value="expiring_30d">⏰ Expiring 30d</option>
                <option value="expiring_60d">⏳ Expiring 60d</option>
                <option value="expired">❌ Expired</option>
              </select>
              <i className="fas fa-chevron-down absolute right-3 top-3.5 text-gray-400 text-xs pointer-events-none"></i>
            </div>
          </div>

          {/* Supplier */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
              <i className="fas fa-truck text-orange-500 text-xs"></i>
              Supplier
            </label>
            <div className="relative">
              <select
                value={filters.supplier}
                onChange={(e) => handleFilterChange("supplier", e.target.value)}
                className="w-full px-4 py-2.5 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all appearance-none bg-white"
              >
                <option value="">All Suppliers</option>
                {suppliers.map((sup) => (
                  <option key={sup._id} value={sup.name}>{sup.name}</option>
                ))}
              </select>
              <i className="fas fa-chevron-down absolute right-3 top-3.5 text-gray-400 text-xs pointer-events-none"></i>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-end gap-2">
            <button 
              onClick={resetFilters} 
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 text-gray-700 rounded-lg font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2"
            >
              <i className="fas fa-redo-alt"></i> Reset
            </button>
            <button 
              onClick={applyFilters} 
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg font-semibold text-sm transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
            >
              <i className="fas fa-search"></i> Apply
            </button>
            <button 
              onClick={handleExport} 
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white rounded-lg font-semibold text-sm transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
            >
              <i className="fas fa-file-excel"></i> Export
            </button>
          </div>
        </div>

        {/* Expiry Date Range */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5 pt-5 border-t border-gray-200">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
              <i className="fas fa-calendar-alt text-green-500 text-xs"></i>
              Expiry From
            </label>
            <input
              type="date"
              value={filters.expiryFrom}
              onChange={(e) => handleFilterChange("expiryFrom", e.target.value)}
              className="w-full px-4 py-2.5 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
              <i className="fas fa-calendar-check text-blue-500 text-xs"></i>
              Expiry To
            </label>
            <input
              type="date"
              value={filters.expiryTo}
              onChange={(e) => handleFilterChange("expiryTo", e.target.value)}
              className="w-full px-4 py-2.5 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
        </div>

        {/* Helper text */}
        <div className="mt-3 text-xs text-gray-500 flex items-center gap-1.5">
          <i className="fas fa-info-circle text-blue-500"></i>
          Change filters and click <strong>Apply</strong> to update results
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedItems.length > 0 && (
        <div className="card bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              {selectedItems.length} item{selectedItems.length > 1 ? "s" : ""} selected
            </span>
            <div className="flex gap-2">
              <button onClick={handleExport} className="btn-secondary btn-sm">
                <i className="fas fa-file-excel mr-1"></i>Export Selected
              </button>
              <button onClick={() => setSelectedItems([])} className="btn-secondary btn-sm">
                <i className="fas fa-times mr-1"></i>Clear Selection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Section 3: Stock Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : stockData.length === 0 ? (
          <div className="text-center py-12">
            <i className="fas fa-inbox text-gray-400 text-5xl mb-4"></i>
            <p className="text-gray-500 text-lg">No stock items found</p>
            <p className="text-gray-400 text-sm mt-2">Try adjusting your filters</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedItems.length === stockData.length}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch/Lot</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Reorder</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Prices</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Value</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiry</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {stockData.map((item) => {
                    const qty = item.currentQty ?? item.quantity ?? 0;
                    const cost = item.product?.purchasePrice ?? item.purchasePrice ?? 0;
                    const selling = item.product?.sellingPrice ?? item.sellingPrice ?? 0;
                    const reorder = item.reorderPoint ?? item.product?.reorderPoint ?? item.minStockLevel ?? 0;
                    const maxStock = item.maxStock ?? item.product?.maxStock ?? 0;
                    const stockValue = qty * cost;
                    const expiry = expiryStyle(item.expiryDate);
                    const isExpired = expiry.row === "bg-red-100";
                    const isOutOfStock = qty === 0;
                    const isLowStock = qty > 0 && qty <= reorder;
                    
                    const rowClass = isExpired ? "bg-red-100" : isOutOfStock ? "bg-orange-100" : isLowStock ? "bg-yellow-50" : "";
                    const itemId = item._id || item.productId;

                    return (
                      <tr key={itemId} className={`hover:bg-gray-50 ${rowClass}`}>
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedItems.includes(itemId)}
                            onChange={() => toggleSelectItem(itemId)}
                            className="rounded border-gray-300"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900">
                            {item.productName ?? item.product?.name ?? "—"}
                          </div>
                          <div className="text-xs text-gray-500">
                            SKU: {item.sku ?? item.product?.sku ?? "—"}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {item.category ?? item.product?.category ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-900">{item.batchNo || "—"}</div>
                          <div className="text-xs text-gray-500">{item.lotNo || "—"}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-semibold text-gray-900">{qty}</div>
                          <StockBar qty={qty} maxStock={maxStock} reorderPoint={reorder} />
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-600">
                          {reorder || "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="text-sm font-medium text-gray-900">{fmt(cost)}</div>
                          <div className="text-xs text-gray-500">{fmt(selling)}</div>
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                          {fmt(stockValue)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${expiry.badge}`}>
                            {expiry.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {item.supplier ?? item.product?.supplier ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => setMovementModal({ isOpen: true, product: item })}
                              className="btn-sm btn-secondary"
                              title="View History"
                            >
                              <i className="fas fa-history"></i>
                            </button>
                            <button
                              onClick={() => setAdjustmentModal({ isOpen: true, product: item })}
                              className="btn-sm btn-secondary"
                              title="Adjust Stock"
                            >
                              <i className="fas fa-edit"></i>
                            </button>
                            {qty <= reorder && (
                              <button
                                className="btn-sm bg-blue-600 text-white hover:bg-blue-700"
                                title="Create Purchase Order"
                              >
                                <i className="fas fa-shopping-cart"></i>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
              <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-700">Rows per page:</label>
                  <select
                    value={limit}
                    onChange={(e) => {
                      setLimit(parseInt(e.target.value));
                      setPage(1);
                    }}
                    className="input-field py-1"
                  >
                    <option value="25">25</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </select>
                </div>
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.pages}
                  onPageChange={setPage}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      <StockMovementModal
        isOpen={movementModal.isOpen}
        onClose={() => setMovementModal({ isOpen: false, product: null })}
        product={movementModal.product}
      />
      <StockAdjustmentModal
        isOpen={adjustmentModal.isOpen}
        onClose={() => setAdjustmentModal({ isOpen: false, product: null })}
        product={adjustmentModal.product}
        onSuccess={fetchStockData}
      />
    </div>
  );
};

export default StockReport;
