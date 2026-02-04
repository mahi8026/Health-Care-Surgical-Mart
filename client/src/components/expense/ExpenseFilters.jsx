/**
 * Advanced Expense Filters Component
 * Comprehensive filtering controls for expense lists with enhanced features
 */

import React, { useState, useEffect } from "react";
import { Input, Select, Button, Modal } from "../ui";
import { PAYMENT_METHODS, RECURRING_FREQUENCIES } from "../../config/constants";
import {
  Search,
  Filter,
  X,
  Calendar,
  DollarSign,
  Tag,
  User,
} from "lucide-react";

const ExpenseFilters = ({
  filters,
  onFiltersChange,
  categories = [],
  filterOptions = {},
  onReset,
  onExport,
  className = "",
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [savedFilters, setSavedFilters] = useState([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [filterName, setFilterName] = useState("");

  // Load saved filters from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("expenseFilters");
    if (saved) {
      setSavedFilters(JSON.parse(saved));
    }
  }, []);

  const handleFilterChange = (key, value) => {
    onFiltersChange({
      ...filters,
      [key]: value,
    });
  };

  const handleMultiSelectChange = (key, value, isMultiple = false) => {
    if (isMultiple) {
      const currentValues = filters[key] || [];
      const newValues = currentValues.includes(value)
        ? currentValues.filter((v) => v !== value)
        : [...currentValues, value];
      handleFilterChange(key, newValues);
    } else {
      handleFilterChange(key, value);
    }
  };

  const handleReset = () => {
    const resetFilters = {
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
    };
    onFiltersChange(resetFilters);
    if (onReset) onReset();
  };

  const saveCurrentFilters = () => {
    if (!filterName.trim()) return;

    const newSavedFilter = {
      id: Date.now(),
      name: filterName.trim(),
      filters: { ...filters },
      createdAt: new Date().toISOString(),
    };

    const updated = [...savedFilters, newSavedFilter];
    setSavedFilters(updated);
    localStorage.setItem("expenseFilters", JSON.stringify(updated));
    setFilterName("");
    setShowSaveModal(false);
  };

  const loadSavedFilter = (savedFilter) => {
    onFiltersChange(savedFilter.filters);
  };

  const deleteSavedFilter = (filterId) => {
    const updated = savedFilters.filter((f) => f.id !== filterId);
    setSavedFilters(updated);
    localStorage.setItem("expenseFilters", JSON.stringify(updated));
  };

  const getActiveFilterCount = () => {
    return Object.values(filters).filter((value) => {
      if (Array.isArray(value)) return value.length > 0;
      return value && value !== "";
    }).length;
  };

  const paymentMethodOptions = Object.entries(PAYMENT_METHODS).map(
    ([key, value]) => ({
      value,
      label: key.charAt(0) + key.slice(1).toLowerCase(),
    }),
  );

  const categoryOptions = categories.map((category) => ({
    value: category._id,
    label: category.name,
    type: category.type,
  }));

  const sortOptions = [
    { value: "expenseDate", label: "Date" },
    { value: "amount", label: "Amount" },
    { value: "category", label: "Category" },
    { value: "vendor", label: "Vendor" },
    { value: "paymentMethod", label: "Payment Method" },
    { value: "createdAt", label: "Created Date" },
  ];

  const vendorOptions = (filterOptions.vendors || []).map((vendor) => ({
    value: vendor,
    label: vendor,
  }));

  const tagOptions = (filterOptions.tags || []).map((tag) => ({
    value: tag,
    label: tag,
  }));

  return (
    <>
      <div
        className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <Filter className="h-5 w-5 text-gray-500" />
            <h3 className="text-lg font-medium text-gray-900">Filters</h3>
            {getActiveFilterCount() > 0 && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {getActiveFilterCount()} active
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? "Simple" : "Advanced"}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              Reset
            </Button>
            {onExport && (
              <Button variant="outline" size="sm" onClick={onExport}>
                Export
              </Button>
            )}
          </div>
        </div>

        {/* Basic Filters */}
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search expenses, vendors, descriptions..."
                value={filters.search || ""}
                onChange={(e) => handleFilterChange("search", e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-2">
              <Input
                label="From Date"
                type="date"
                value={filters.startDate || ""}
                onChange={(e) =>
                  handleFilterChange("startDate", e.target.value)
                }
              />
              <Input
                label="To Date"
                type="date"
                value={filters.endDate || ""}
                onChange={(e) => handleFilterChange("endDate", e.target.value)}
              />
            </div>

            {/* Amount Range */}
            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Min Amount"
                type="number"
                placeholder="0"
                value={filters.minAmount || ""}
                onChange={(e) =>
                  handleFilterChange("minAmount", e.target.value)
                }
              />
              <Input
                label="Max Amount"
                type="number"
                placeholder="999999"
                value={filters.maxAmount || ""}
                onChange={(e) =>
                  handleFilterChange("maxAmount", e.target.value)
                }
              />
            </div>
          </div>

          {/* Category and Payment Method */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Categories
              </label>
              <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-200 rounded-md p-2">
                {categoryOptions.map((category) => (
                  <label
                    key={category.value}
                    className="flex items-center space-x-2"
                  >
                    <input
                      type="checkbox"
                      checked={(filters.categoryId || []).includes(
                        category.value,
                      )}
                      onChange={() =>
                        handleMultiSelectChange(
                          "categoryId",
                          category.value,
                          true,
                        )
                      }
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">
                      {category.label}
                    </span>
                    <span className="text-xs text-gray-500">
                      ({category.type})
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Methods
              </label>
              <div className="space-y-2">
                {paymentMethodOptions.map((method) => (
                  <label
                    key={method.value}
                    className="flex items-center space-x-2"
                  >
                    <input
                      type="checkbox"
                      checked={(filters.paymentMethod || []).includes(
                        method.value,
                      )}
                      onChange={() =>
                        handleMultiSelectChange(
                          "paymentMethod",
                          method.value,
                          true,
                        )
                      }
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">
                      {method.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Advanced Filters */}
        {showAdvanced && (
          <div className="border-t border-gray-200 p-4 bg-gray-50 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Vendor Filter */}
              <div>
                <Input
                  label="Vendor"
                  placeholder="Search vendor..."
                  value={filters.vendor || ""}
                  onChange={(e) => handleFilterChange("vendor", e.target.value)}
                />
                {vendorOptions.length > 0 && (
                  <div className="mt-2 max-h-24 overflow-y-auto">
                    {vendorOptions.slice(0, 5).map((vendor) => (
                      <button
                        key={vendor.value}
                        onClick={() =>
                          handleFilterChange("vendor", vendor.value)
                        }
                        className="block w-full text-left px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
                      >
                        {vendor.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Tags Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tags
                </label>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {tagOptions.map((tag) => (
                    <label
                      key={tag.value}
                      className="flex items-center space-x-2"
                    >
                      <input
                        type="checkbox"
                        checked={(filters.tags || []).includes(tag.value)}
                        onChange={() =>
                          handleMultiSelectChange("tags", tag.value, true)
                        }
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{tag.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Recurring Filter */}
              <Select
                label="Recurring"
                placeholder="All expenses"
                options={[
                  { value: "true", label: "Recurring only" },
                  { value: "false", label: "Non-recurring only" },
                ]}
                value={filters.isRecurring || ""}
                onChange={(e) =>
                  handleFilterChange("isRecurring", e.target.value)
                }
              />
            </div>

            {/* Sorting */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Sort By"
                options={sortOptions}
                value={filters.sortBy || "expenseDate"}
                onChange={(e) => handleFilterChange("sortBy", e.target.value)}
              />
              <Select
                label="Sort Order"
                options={[
                  { value: "desc", label: "Descending" },
                  { value: "asc", label: "Ascending" },
                ]}
                value={filters.sortOrder || "desc"}
                onChange={(e) =>
                  handleFilterChange("sortOrder", e.target.value)
                }
              />
            </div>

            {/* Saved Filters */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Saved Filters
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSaveModal(true)}
                >
                  Save Current
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {savedFilters.map((savedFilter) => (
                  <div
                    key={savedFilter.id}
                    className="flex items-center space-x-1 bg-white border border-gray-200 rounded-md px-2 py-1"
                  >
                    <button
                      onClick={() => loadSavedFilter(savedFilter)}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      {savedFilter.name}
                    </button>
                    <button
                      onClick={() => deleteSavedFilter(savedFilter.id)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Save Filter Modal */}
      <Modal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        title="Save Filter"
        size="sm"
      >
        <div className="space-y-4">
          <Input
            label="Filter Name"
            placeholder="Enter filter name..."
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
          />
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setShowSaveModal(false)}>
              Cancel
            </Button>
            <Button onClick={saveCurrentFilters} disabled={!filterName.trim()}>
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default ExpenseFilters;
