/**
 * Expense Export Component
 * Handles exporting expense data in various formats
 */

import React, { useState } from "react";
import { Button, Modal, Select } from "../ui";
import { Download, FileText, Table, Calendar } from "lucide-react";
import { formatCurrency, formatDate } from "../../utils";

const ExpenseExport = ({
  isOpen,
  onClose,
  expenses = [],
  filters = {},
  onExport,
}) => {
  const [exportFormat, setExportFormat] = useState("csv");
  const [exportFields, setExportFields] = useState([
    "expenseNumber",
    "expenseDate",
    "description",
    "categoryName",
    "amount",
    "paymentMethod",
    "vendor",
  ]);
  const [dateRange, setDateRange] = useState("filtered"); // "all", "filtered", "custom"
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  const availableFields = [
    { key: "expenseNumber", label: "Expense Number" },
    { key: "expenseDate", label: "Date" },
    { key: "description", label: "Description" },
    { key: "categoryName", label: "Category" },
    { key: "amount", label: "Amount" },
    { key: "paymentMethod", label: "Payment Method" },
    { key: "vendor", label: "Vendor" },
    { key: "tags", label: "Tags" },
    { key: "notes", label: "Notes" },
    { key: "createdAt", label: "Created Date" },
    { key: "isRecurring", label: "Recurring" },
  ];

  const formatOptions = [
    { value: "csv", label: "CSV (Excel Compatible)" },
    { value: "pdf", label: "PDF Report" },
    { value: "json", label: "JSON Data" },
  ];

  const handleFieldToggle = (fieldKey) => {
    setExportFields((prev) =>
      prev.includes(fieldKey)
        ? prev.filter((f) => f !== fieldKey)
        : [...prev, fieldKey],
    );
  };

  const generateCSV = (data) => {
    const headers = exportFields.map(
      (field) => availableFields.find((f) => f.key === field)?.label || field,
    );

    const rows = data.map((expense) =>
      exportFields.map((field) => {
        switch (field) {
          case "expenseDate":
          case "createdAt":
            return formatDate(expense[field]);
          case "amount":
            return expense[field];
          case "vendor":
            return expense.vendor?.name || "";
          case "tags":
            return Array.isArray(expense.tags) ? expense.tags.join(", ") : "";
          case "isRecurring":
            return expense.isRecurring ? "Yes" : "No";
          default:
            return expense[field] || "";
        }
      }),
    );

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    return csvContent;
  };

  const generatePDF = (data) => {
    // This would integrate with a PDF library like jsPDF
    // For now, return a simple text representation
    const content = data.map((expense) => ({
      ...expense,
      formattedDate: formatDate(expense.expenseDate),
      formattedAmount: formatCurrency(expense.amount),
    }));

    return content;
  };

  const handleExport = () => {
    let dataToExport = [...expenses];

    // Apply date range filtering if needed
    if (dateRange === "custom" && customStartDate && customEndDate) {
      const start = new Date(customStartDate);
      const end = new Date(customEndDate);
      dataToExport = dataToExport.filter((expense) => {
        const expenseDate = new Date(expense.expenseDate);
        return expenseDate >= start && expenseDate <= end;
      });
    }

    let exportData;
    let filename;
    let mimeType;

    switch (exportFormat) {
      case "csv":
        exportData = generateCSV(dataToExport);
        filename = `expenses_${new Date().toISOString().split("T")[0]}.csv`;
        mimeType = "text/csv";
        break;
      case "pdf":
        exportData = generatePDF(dataToExport);
        filename = `expenses_${new Date().toISOString().split("T")[0]}.pdf`;
        mimeType = "application/pdf";
        break;
      case "json":
        exportData = JSON.stringify(dataToExport, null, 2);
        filename = `expenses_${new Date().toISOString().split("T")[0]}.json`;
        mimeType = "application/json";
        break;
      default:
        return;
    }

    // Create and download file
    const blob = new Blob([exportData], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    if (onExport) {
      onExport({
        format: exportFormat,
        fields: exportFields,
        count: dataToExport.length,
        filename,
      });
    }

    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Export Expenses" size="lg">
      <div className="space-y-6">
        {/* Export Format */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Export Format
          </label>
          <Select
            options={formatOptions}
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value)}
          />
        </div>

        {/* Date Range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Date Range
          </label>
          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                name="dateRange"
                value="filtered"
                checked={dateRange === "filtered"}
                onChange={(e) => setDateRange(e.target.value)}
                className="text-blue-600"
              />
              <span className="text-sm">Use current filter dates</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                name="dateRange"
                value="all"
                checked={dateRange === "all"}
                onChange={(e) => setDateRange(e.target.value)}
                className="text-blue-600"
              />
              <span className="text-sm">All expenses</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                name="dateRange"
                value="custom"
                checked={dateRange === "custom"}
                onChange={(e) => setDateRange(e.target.value)}
                className="text-blue-600"
              />
              <span className="text-sm">Custom date range</span>
            </label>
          </div>

          {dateRange === "custom" && (
            <div className="grid grid-cols-2 gap-4 mt-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  From Date
                </label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  To Date
                </label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Fields Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Fields to Export
          </label>
          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border border-gray-200 rounded-md p-3">
            {availableFields.map((field) => (
              <label key={field.key} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={exportFields.includes(field.key)}
                  onChange={() => handleFieldToggle(field.key)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{field.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="bg-gray-50 rounded-md p-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">
            Export Summary
          </h4>
          <div className="text-sm text-gray-600 space-y-1">
            <div>
              Format:{" "}
              {formatOptions.find((f) => f.value === exportFormat)?.label}
            </div>
            <div>Records: {expenses.length} expenses</div>
            <div>Fields: {exportFields.length} selected</div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={exportFields.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ExpenseExport;
