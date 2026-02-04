import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "react-query";
import { toast } from "react-hot-toast";
import {
  ExpenseFilters,
  ExpenseList,
  ExpenseExport,
  ExpenseForm,
} from "../components/expense";
import { LoadingSpinner, Modal, Button } from "../components";
import { expenseService, expenseCategoryService } from "../services";
import { usePagination, useApi } from "../hooks";
import { formatCurrency } from "../utils";
import { Plus, TrendingUp, Calendar, Repeat } from "lucide-react";

const ExpensesPage = () => {
  const navigate = useNavigate();
  const { execute, loading: actionLoading } = useApi();
  const { pagination, goToPage, changePageSize } = usePagination(20);

  // State management
  const [filters, setFilters] = useState({
    search: "",
    categoryId: [],
    paymentMethod: [],
    startDate: "",
    endDate: "",
    minAmount: "",
    maxAmount: "",
    vendor: "",
    tags: [],
    isRecurring: "",
    sortBy: "expenseDate",
    sortOrder: "desc",
  });

  const [selectedExpenses, setSelectedExpenses] = useState([]);
  const [viewMode, setViewMode] = useState("table");
  const [editingExpense, setEditingExpense] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);

  // Fetch expenses with filters and pagination
  const {
    data: expenseData,
    isLoading,
    error,
    refetch,
  } = useQuery(
    ["expenses", filters, pagination],
    () =>
      expenseService.getExpenses({
        ...filters,
        page: pagination.page,
        limit: pagination.limit,
      }),
    {
      keepPreviousData: true,
      staleTime: 30000, // 30 seconds
    },
  );

  // Fetch categories for filtering
  const { data: categories = [] } = useQuery(
    "expense-categories",
    () => expenseCategoryService.getActiveCategories(),
    {
      staleTime: 300000, // 5 minutes
    },
  );

  // Fetch filter options
  const { data: filterOptions = {} } = useQuery(
    "expense-filter-options",
    () => expenseService.getFilterOptions?.() || Promise.resolve({}),
    {
      staleTime: 300000, // 5 minutes
    },
  );

  const expenses = expenseData?.data || [];
  const paginationInfo = expenseData?.pagination || {};

  // Handle filter changes
  const handleFiltersChange = (newFilters) => {
    setFilters(newFilters);
    goToPage(1); // Reset to first page when filters change
  };

  // Handle sorting
  const handleSort = (column, direction) => {
    setFilters((prev) => ({
      ...prev,
      sortBy: column,
      sortOrder: direction,
    }));
  };

  // Handle expense operations
  const handleEdit = (expense) => {
    setEditingExpense(expense);
  };

  const handleDelete = async (expense) => {
    if (
      window.confirm(
        `Are you sure you want to delete expense "${expense.expenseNumber}"?`,
      )
    ) {
      await execute(() => expenseService.delete(expense._id), {
        showSuccessToast: true,
        successMessage: "Expense deleted successfully",
      });
      refetch();
      setSelectedExpenses((prev) => prev.filter((id) => id !== expense._id));
    }
  };

  const handleBulkDelete = async (expenseIds) => {
    await execute(() => expenseService.bulkDelete(expenseIds), {
      showSuccessToast: true,
      successMessage: `${expenseIds.length} expense(s) deleted successfully`,
    });
    refetch();
    setSelectedExpenses([]);
  };

  const handleUpdateExpense = async (expenseData) => {
    await execute(
      () => expenseService.update(editingExpense._id, expenseData),
      {
        showSuccessToast: true,
        successMessage: "Expense updated successfully",
      },
    );
    setEditingExpense(null);
    refetch();
  };

  // Handle export
  const handleExport = (exportData) => {
    toast.success(
      `Exported ${exportData.count} expenses to ${exportData.filename}`,
    );
  };

  // Calculate summary statistics
  const summaryStats = React.useMemo(() => {
    const totalAmount = expenses.reduce(
      (sum, expense) => sum + expense.amount,
      0,
    );
    const thisMonth = expenses.filter((expense) => {
      const expenseDate = new Date(expense.expenseDate);
      const now = new Date();
      return (
        expenseDate.getMonth() === now.getMonth() &&
        expenseDate.getFullYear() === now.getFullYear()
      );
    });
    const recurringCount = expenses.filter(
      (expense) => expense.isRecurring,
    ).length;

    return {
      totalExpenses: expenses.length,
      totalAmount,
      thisMonthAmount: thisMonth.reduce(
        (sum, expense) => sum + expense.amount,
        0,
      ),
      recurringCount,
    };
  }, [expenses]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-2">⚠️</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Error loading expenses
          </h3>
          <p className="text-gray-500 mb-4">{error.message}</p>
          <Button onClick={() => refetch()}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
          <p className="text-gray-600 mt-1">
            Manage and track your business expenses
          </p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" onClick={() => setShowExportModal(true)}>
            Export
          </Button>
          <Button onClick={() => navigate("/expenses/add")}>
            <Plus className="h-4 w-4 mr-2" />
            Add Expense
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">
                Total Expenses
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {summaryStats.totalExpenses}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <span className="text-green-600 font-bold text-lg">₹</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Amount</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(summaryStats.totalAmount)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Calendar className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">This Month</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(summaryStats.thisMonthAmount)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-3 bg-orange-100 rounded-lg">
              <Repeat className="h-6 w-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Recurring</p>
              <p className="text-2xl font-bold text-gray-900">
                {summaryStats.recurringCount}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <ExpenseFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        categories={categories}
        filterOptions={filterOptions}
        onExport={() => setShowExportModal(true)}
      />

      {/* Expense List */}
      <ExpenseList
        expenses={expenses}
        loading={isLoading || actionLoading}
        pagination={paginationInfo}
        onPageChange={goToPage}
        onSort={handleSort}
        sortColumn={filters.sortBy}
        sortDirection={filters.sortOrder}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onBulkDelete={handleBulkDelete}
        onExport={() => setShowExportModal(true)}
        selectedExpenses={selectedExpenses}
        onSelectionChange={setSelectedExpenses}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* Edit Expense Modal */}
      <Modal
        isOpen={!!editingExpense}
        onClose={() => setEditingExpense(null)}
        title={`Edit Expense - ${editingExpense?.expenseNumber}`}
        size="xl"
      >
        {editingExpense && (
          <ExpenseForm
            expense={editingExpense}
            onSubmit={handleUpdateExpense}
            onCancel={() => setEditingExpense(null)}
          />
        )}
      </Modal>

      {/* Export Modal */}
      <ExpenseExport
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        expenses={expenses}
        filters={filters}
        onExport={handleExport}
      />
    </div>
  );
};

export default ExpensesPage;
