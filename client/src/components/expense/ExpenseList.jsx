/**
 * Enhanced Expense List Component
 * Advanced list view with sorting, selection, and bulk operations
 */

import React, { useState } from "react";
import { Table, Pagination, Button, Modal } from "../ui";
import { ExpenseCard } from "./";
import { formatCurrency, formatDate, capitalize } from "../../utils";
import {
  Grid,
  List,
  Download,
  Trash2,
  Edit,
  Eye,
  MoreHorizontal,
  CheckSquare,
  Square,
  ArrowUpDown,
  Filter,
} from "lucide-react";

const ExpenseList = ({
  expenses = [],
  loading = false,
  pagination = {},
  onPageChange,
  onSort,
  sortColumn,
  sortDirection,
  onEdit,
  onDelete,
  onView,
  onBulkDelete,
  onExport,
  selectedExpenses = [],
  onSelectionChange,
  viewMode = "table", // "table" or "cards"
  onViewModeChange,
  className = "",
}) => {
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  const handleSelectAll = () => {
    if (selectedExpenses.length === expenses.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(expenses.map((expense) => expense._id));
    }
  };

  const handleSelectExpense = (expenseId) => {
    const newSelection = selectedExpenses.includes(expenseId)
      ? selectedExpenses.filter((id) => id !== expenseId)
      : [...selectedExpenses, expenseId];
    onSelectionChange(newSelection);
  };

  const handleBulkDelete = () => {
    if (selectedExpenses.length > 0) {
      onBulkDelete(selectedExpenses);
      setShowBulkDeleteModal(false);
      onSelectionChange([]);
    }
  };

  const columns = [
    {
      key: "select",
      title: (
        <button onClick={handleSelectAll} className="flex items-center">
          {selectedExpenses.length === expenses.length &&
          expenses.length > 0 ? (
            <CheckSquare className="h-4 w-4" />
          ) : (
            <Square className="h-4 w-4" />
          )}
        </button>
      ),
      render: (_, expense) => (
        <button
          onClick={() => handleSelectExpense(expense._id)}
          className="flex items-center"
        >
          {selectedExpenses.includes(expense._id) ? (
            <CheckSquare className="h-4 w-4 text-blue-600" />
          ) : (
            <Square className="h-4 w-4" />
          )}
        </button>
      ),
      className: "w-12",
    },
    {
      key: "expenseNumber",
      title: "Expense #",
      sortable: true,
      render: (value, expense) => (
        <div>
          <div className="font-medium text-gray-900">{value}</div>
          {expense.isRecurring && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mt-1">
              Recurring
            </span>
          )}
        </div>
      ),
    },
    {
      key: "expenseDate",
      title: "Date",
      sortable: true,
      render: (value) => (
        <div className="text-sm text-gray-900">{formatDate(value)}</div>
      ),
    },
    {
      key: "description",
      title: "Description",
      render: (value, expense) => (
        <div>
          <div className="font-medium text-gray-900 truncate max-w-xs">
            {value || "No description"}
          </div>
          {expense.vendor?.name && (
            <div className="text-sm text-gray-500">
              Vendor: {expense.vendor.name}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "categoryName",
      title: "Category",
      sortable: true,
      render: (value, expense) => (
        <div>
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {value}
          </span>
          {expense.category?.type && (
            <div className="text-xs text-gray-500 mt-1">
              {expense.category.type}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "amount",
      title: "Amount",
      sortable: true,
      render: (value) => (
        <div className="font-semibold text-gray-900">
          {formatCurrency(value)}
        </div>
      ),
      className: "text-right",
    },
    {
      key: "paymentMethod",
      title: "Payment",
      sortable: true,
      render: (value) => (
        <span
          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
            value === "cash"
              ? "bg-green-100 text-green-800"
              : value === "bank"
                ? "bg-blue-100 text-blue-800"
                : "bg-purple-100 text-purple-800"
          }`}
        >
          {capitalize(value)}
        </span>
      ),
    },
    {
      key: "attachments",
      title: "Attachments",
      render: (value) => (
        <div className="text-sm text-gray-500">
          {value && value.length > 0 ? (
            <span className="flex items-center">📎 {value.length}</span>
          ) : (
            "-"
          )}
        </div>
      ),
    },
    {
      key: "actions",
      title: "Actions",
      render: (_, expense) => (
        <div className="flex items-center space-x-2">
          {onView && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onView(expense)}
              className="p-1"
            >
              <Eye className="h-4 w-4" />
            </Button>
          )}
          {onEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(expense)}
              className="p-1"
            >
              <Edit className="h-4 w-4" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(expense)}
              className="p-1 text-red-600 hover:text-red-800"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
      className: "w-32",
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <>
      <div
        className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <h3 className="text-lg font-medium text-gray-900">
              Expenses ({pagination.total || 0})
            </h3>
            {selectedExpenses.length > 0 && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">
                  {selectedExpenses.length} selected
                </span>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setShowBulkDeleteModal(true)}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete Selected
                </Button>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {onExport && (
              <Button variant="outline" size="sm" onClick={onExport}>
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
            )}

            {onViewModeChange && (
              <div className="flex items-center border border-gray-200 rounded-md">
                <button
                  onClick={() => onViewModeChange("table")}
                  className={`p-2 ${viewMode === "table" ? "bg-blue-100 text-blue-600" : "text-gray-600"}`}
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onViewModeChange("cards")}
                  className={`p-2 ${viewMode === "cards" ? "bg-blue-100 text-blue-600" : "text-gray-600"}`}
                >
                  <Grid className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        {expenses.length === 0 ? (
          <div className="text-center py-12">
            <Filter className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No expenses found
            </h3>
            <p className="text-gray-500">
              Try adjusting your filters or create a new expense.
            </p>
          </div>
        ) : viewMode === "table" ? (
          <Table
            columns={columns}
            data={expenses}
            sortable={true}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={onSort}
          />
        ) : (
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {expenses.map((expense) => (
                <div key={expense._id} className="relative">
                  <button
                    onClick={() => handleSelectExpense(expense._id)}
                    className="absolute top-2 left-2 z-10"
                  >
                    {selectedExpenses.includes(expense._id) ? (
                      <CheckSquare className="h-4 w-4 text-blue-600" />
                    ) : (
                      <Square className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                  <ExpenseCard
                    expense={expense}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onView={onView}
                    className="pt-8"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="border-t border-gray-200 p-4">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.pages}
              onPageChange={onPageChange}
            />
          </div>
        )}
      </div>

      {/* Bulk Delete Confirmation Modal */}
      <Modal
        isOpen={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        title="Delete Selected Expenses"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to delete {selectedExpenses.length} selected
            expense(s)? This action cannot be undone.
          </p>
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => setShowBulkDeleteModal(false)}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={handleBulkDelete}>
              Delete {selectedExpenses.length} Expense(s)
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default ExpenseList;
