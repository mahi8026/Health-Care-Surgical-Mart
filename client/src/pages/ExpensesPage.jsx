import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import api from "../config/api";
import LoadingSpinner from "../components/LoadingSpinner";
import Pagination from "../components/ui/Pagination";

const ExpensesPage = () => {
  const navigate = useNavigate();
  
  // State management
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [pagination, setPagination] = useState(null);
  
  const [filters, setFilters] = useState({
    search: "",
    categoryId: "",
    paymentMethod: "",
    startDate: "",
    endDate: "",
    sortBy: "expenseDate",
    sortOrder: "desc",
  });

  // Fetch expenses
  const fetchExpenses = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get("/expenses", {
        params: {
          ...filters,
          page,
          limit,
        },
      });
      
      if (response.success) {
        setExpenses(response.data || []);
        setPagination(response.pagination);
      } else {
        setError(response.message || "Failed to fetch expenses");
      }
    } catch (err) {
      console.error("Failed to fetch expenses:", err);
      setError(err.response?.data?.message || err.message || "Failed to fetch expenses");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await api.get("/expense-categories");
        if (!cancelled && response.success) {
          setCategories(response.data || []);
        }
      } catch (err) {
        if (!cancelled) console.error("Failed to fetch categories:", err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get("/expenses", {
          params: { ...filters, page, limit },
        });
        if (!cancelled) {
          if (response.success) {
            setExpenses(response.data || []);
            setPagination(response.pagination);
          } else {
            setError(response.message || "Failed to fetch expenses");
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to fetch expenses:", err);
          setError(err.response?.data?.message || err.message || "Failed to fetch expenses");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [page, limit, filters]);

  // Handle delete
  const handleDelete = async (expense) => {
    if (!window.confirm(`Are you sure you want to delete expense "${expense.expenseNumber}"?`)) {
      return;
    }
    
    try {
      const response = await api.delete(`/expenses/${expense._id}`);
      if (response.success) {
        toast.success("Expense deleted successfully");
        fetchExpenses();
      } else {
        toast.error(response.message || "Failed to delete expense");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete expense");
    }
  };

  // Calculate summary
  const summary = {
    totalExpenses: expenses.length,
    totalAmount: expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0),
  };

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
    if (!date) return "-";
    return new Date(date).toLocaleDateString("en-GB");
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Error Loading Expenses
          </h3>
          <p className="text-gray-500 mb-4">{error}</p>
          <button
            onClick={fetchExpenses}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
                <i className="fas fa-receipt"></i>
              </div>
              Expense Management
            </h1>
            <p className="text-indigo-100 mt-2 text-sm">
              Track and manage your business expenses
            </p>
          </div>
          <button
            onClick={() => navigate("/expenses/add")}
            className="px-6 py-3 bg-white hover:bg-gray-50 text-indigo-700 rounded-lg font-semibold shadow-md transition-all flex items-center gap-2"
          >
            <i className="fas fa-plus"></i> Add Expense
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-600 mb-1">Total Expenses</p>
              <p className="text-3xl font-bold text-gray-900">{summary.totalExpenses}</p>
            </div>
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-4 rounded-xl shadow-md">
              <i className="fas fa-file-invoice text-white text-2xl"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-600 mb-1">Total Amount</p>
              <p className="text-3xl font-bold text-green-600">{formatCurrency(summary.totalAmount)}</p>
            </div>
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-4 rounded-xl shadow-md">
              <i className="fas fa-dollar-sign text-white text-2xl"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-600 mb-1">Current Page</p>
              <p className="text-3xl font-bold text-purple-600">{page} of {pagination?.pages || 1}</p>
            </div>
            <div className="bg-gradient-to-br from-purple-500 to-pink-600 p-4 rounded-xl shadow-md">
              <i className="fas fa-chart-bar text-white text-2xl"></i>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Search expenses..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
            <select
              value={filters.categoryId}
              onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat._id} value={cat._id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <button
            onClick={() => setFilters({
              search: "",
              categoryId: "",
              paymentMethod: "",
              startDate: "",
              endDate: "",
              sortBy: "expenseDate",
              sortOrder: "desc",
            })}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors"
          >
            <i className="fas fa-redo mr-2"></i>Reset Filters
          </button>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : expenses.length === 0 ? (
          <div className="text-center py-12">
            <i className="fas fa-inbox text-gray-300 text-5xl mb-4"></i>
            <p className="text-gray-500 text-lg">No expenses found</p>
            <button
              onClick={() => navigate("/expenses/add")}
              className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Add Your First Expense
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-indigo-600 to-purple-600">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                      Expense #
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-white uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-white uppercase tracking-wider">
                      Payment
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-white uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {expenses.map((expense) => (
                    <tr key={expense._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {expense.expenseNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatDate(expense.expenseDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-indigo-100 text-indigo-800">
                          {expense.category?.name || expense.categoryName || "-"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                        {expense.description || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-right text-green-600">
                        {formatCurrency(expense.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          expense.paymentMethod === "cash" ? "bg-green-100 text-green-800" :
                          expense.paymentMethod === "bank" ? "bg-blue-100 text-blue-800" :
                          "bg-purple-100 text-purple-800"
                        }`}>
                          {expense.paymentMethod || "cash"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        <button
                          onClick={() => navigate(`/expenses/edit/${expense._id}`)}
                          className="text-indigo-600 hover:text-indigo-900 mr-3"
                          title="Edit"
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                        <button
                          onClick={() => handleDelete(expense)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete"
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
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
    </div>
  );
};

export default ExpensesPage;
