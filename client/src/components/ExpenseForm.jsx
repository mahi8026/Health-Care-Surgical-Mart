import React, { useState, useEffect } from "react";
import { apiService } from "../services/api";
import CategorySelector from "./CategorySelector";
import LoadingSpinner from "./LoadingSpinner";

const ExpenseForm = ({
  expense = null,
  onSubmit,
  onCancel,
  loading = false,
  className = "",
}) => {
  const [formData, setFormData] = useState({
    categoryId: "",
    amount: "",
    description: "",
    expenseDate: new Date().toISOString().split("T")[0],
    paymentMethod: "cash",
    vendor: {
      name: "",
      phone: "",
      email: "",
    },
    notes: "",
    tags: [],
    isRecurring: false,
    recurringConfig: {
      frequency: "monthly",
      interval: 1,
      startDate: new Date().toISOString().split("T")[0],
      endDate: "",
    },
    ...(expense && {
      ...expense,
      expenseDate: expense.expenseDate
        ? new Date(expense.expenseDate).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      recurringConfig: expense.recurringConfig
        ? {
            ...expense.recurringConfig,
            startDate: expense.recurringConfig.startDate
              ? new Date(expense.recurringConfig.startDate)
                  .toISOString()
                  .split("T")[0]
              : new Date().toISOString().split("T")[0],
            endDate: expense.recurringConfig.endDate
              ? new Date(expense.recurringConfig.endDate)
                  .toISOString()
                  .split("T")[0]
              : "",
          }
        : {
            frequency: "monthly",
            interval: 1,
            startDate: new Date().toISOString().split("T")[0],
            endDate: "",
          },
      tags: expense.tags || [],
    }),
  });

  const [errors, setErrors] = useState({});
  const [tagInput, setTagInput] = useState("");

  // Payment method options
  const paymentMethods = [
    { value: "cash", label: "Cash" },
    { value: "bank", label: "Bank Transfer" },
    { value: "card", label: "Card Payment" },
  ];

  // Recurring frequency options
  const frequencyOptions = [
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "yearly", label: "Yearly" },
  ];

  // Validation
  const validateForm = () => {
    const newErrors = {};

    if (!formData.categoryId) {
      newErrors.categoryId = "Category is required";
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = "Amount must be greater than 0";
    }

    if (!formData.description.trim()) {
      newErrors.description = "Description is required";
    }

    if (!formData.expenseDate) {
      newErrors.expenseDate = "Expense date is required";
    }

    // Validate recurring configuration if recurring is enabled
    if (formData.isRecurring) {
      if (!formData.recurringConfig.startDate) {
        newErrors.recurringStartDate =
          "Start date is required for recurring expenses";
      }

      if (
        formData.recurringConfig.endDate &&
        formData.recurringConfig.startDate &&
        new Date(formData.recurringConfig.endDate) <=
          new Date(formData.recurringConfig.startDate)
      ) {
        newErrors.recurringEndDate = "End date must be after start date";
      }

      if (formData.recurringConfig.interval < 1) {
        newErrors.recurringInterval = "Interval must be at least 1";
      }
    }

    // Validate vendor email if provided
    if (
      formData.vendor.email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.vendor.email)
    ) {
      newErrors.vendorEmail = "Please enter a valid email address";
    }

    // Validate vendor phone if provided
    if (
      formData.vendor.phone &&
      !/^[\d\s\-\+\(\)]+$/.test(formData.vendor.phone)
    ) {
      newErrors.vendorPhone = "Please enter a valid phone number";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Clean up form data
    const submitData = {
      ...formData,
      amount: parseFloat(formData.amount),
      tags: formData.tags.filter((tag) => tag.trim()),
      vendor: {
        name: formData.vendor.name.trim(),
        phone: formData.vendor.phone.trim(),
        email: formData.vendor.email.trim(),
      },
    };

    // Remove empty vendor fields
    if (
      !submitData.vendor.name &&
      !submitData.vendor.phone &&
      !submitData.vendor.email
    ) {
      delete submitData.vendor;
    }

    // Clean up recurring config if not recurring
    if (!submitData.isRecurring) {
      delete submitData.recurringConfig;
    }

    onSubmit(submitData);
  };

  // Handle input changes
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name.startsWith("vendor.")) {
      const vendorField = name.split(".")[1];
      setFormData((prev) => ({
        ...prev,
        vendor: {
          ...prev.vendor,
          [vendorField]: value,
        },
      }));
    } else if (name.startsWith("recurringConfig.")) {
      const configField = name.split(".")[1];
      setFormData((prev) => ({
        ...prev,
        recurringConfig: {
          ...prev.recurringConfig,
          [configField]: type === "number" ? parseInt(value) || 1 : value,
        },
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      }));
    }

    // Clear related errors
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  // Handle tag management
  const handleAddTag = (e) => {
    e.preventDefault();
    const tag = tagInput.trim();
    if (tag && !formData.tags.includes(tag)) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, tag],
      }));
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove),
    }));
  };

  // Handle category selection
  const handleCategoryChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      categoryId: e.target.value,
    }));

    if (errors.categoryId) {
      setErrors((prev) => ({ ...prev, categoryId: undefined }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`space-y-6 ${className}`}>
      {/* Basic Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Basic Information</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category *
            </label>
            <CategorySelector
              value={formData.categoryId}
              onChange={handleCategoryChange}
              name="categoryId"
              required
              placeholder="Select expense category"
              className={errors.categoryId ? "border-red-300" : ""}
            />
            {errors.categoryId && (
              <p className="mt-1 text-sm text-red-600">{errors.categoryId}</p>
            )}
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                ৳
              </span>
              <input
                type="number"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                required
                min="0.01"
                step="0.01"
                className={`input-field pl-8 ${errors.amount ? "border-red-300" : ""}`}
                placeholder="0.00"
              />
            </div>
            {errors.amount && (
              <p className="mt-1 text-sm text-red-600">{errors.amount}</p>
            )}
          </div>

          {/* Expense Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Expense Date *
            </label>
            <input
              type="date"
              name="expenseDate"
              value={formData.expenseDate}
              onChange={handleChange}
              required
              max={new Date().toISOString().split("T")[0]}
              className={`input-field ${errors.expenseDate ? "border-red-300" : ""}`}
            />
            {errors.expenseDate && (
              <p className="mt-1 text-sm text-red-600">{errors.expenseDate}</p>
            )}
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Method *
            </label>
            <select
              name="paymentMethod"
              value={formData.paymentMethod}
              onChange={handleChange}
              required
              className="input-field"
            >
              {paymentMethods.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description *
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            required
            rows="3"
            className={`input-field ${errors.description ? "border-red-300" : ""}`}
            placeholder="Enter expense description..."
          />
          {errors.description && (
            <p className="mt-1 text-sm text-red-600">{errors.description}</p>
          )}
        </div>
      </div>

      {/* Vendor Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">
          Vendor Information
        </h3>
        <p className="text-sm text-gray-600">
          Optional vendor details for this expense
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vendor Name
            </label>
            <input
              type="text"
              name="vendor.name"
              value={formData.vendor.name}
              onChange={handleChange}
              className="input-field"
              placeholder="Enter vendor name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              name="vendor.phone"
              value={formData.vendor.phone}
              onChange={handleChange}
              className={`input-field ${errors.vendorPhone ? "border-red-300" : ""}`}
              placeholder="Enter phone number"
            />
            {errors.vendorPhone && (
              <p className="mt-1 text-sm text-red-600">{errors.vendorPhone}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              name="vendor.email"
              value={formData.vendor.email}
              onChange={handleChange}
              className={`input-field ${errors.vendorEmail ? "border-red-300" : ""}`}
              placeholder="Enter email address"
            />
            {errors.vendorEmail && (
              <p className="mt-1 text-sm text-red-600">{errors.vendorEmail}</p>
            )}
          </div>
        </div>
      </div>

      {/* Tags */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Tags</h3>
        <p className="text-sm text-gray-600">
          Add tags to categorize and organize your expenses
        </p>

        <div className="flex flex-wrap gap-2 mb-3">
          {formData.tags.map((tag, index) => (
            <span
              key={index}
              className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
            >
              {tag}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                className="ml-2 text-blue-600 hover:text-blue-800"
              >
                <i className="fas fa-times text-xs"></i>
              </button>
            </span>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleAddTag(e)}
            className="input-field flex-1"
            placeholder="Enter a tag and press Enter"
          />
          <button
            type="button"
            onClick={handleAddTag}
            className="btn-secondary"
            disabled={!tagInput.trim()}
          >
            <i className="fas fa-plus mr-1"></i>
            Add
          </button>
        </div>
      </div>

      {/* Recurring Configuration */}
      <div className="space-y-4">
        <div className="flex items-center">
          <input
            type="checkbox"
            name="isRecurring"
            checked={formData.isRecurring}
            onChange={handleChange}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label className="ml-2 text-lg font-medium text-gray-900">
            Recurring Expense
          </label>
        </div>

        {formData.isRecurring && (
          <div className="bg-blue-50 p-4 rounded-lg space-y-4">
            <p className="text-sm text-blue-700">
              Configure how often this expense should repeat automatically
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Frequency *
                </label>
                <select
                  name="recurringConfig.frequency"
                  value={formData.recurringConfig.frequency}
                  onChange={handleChange}
                  className="input-field"
                >
                  {frequencyOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Every (Interval) *
                </label>
                <input
                  type="number"
                  name="recurringConfig.interval"
                  value={formData.recurringConfig.interval}
                  onChange={handleChange}
                  min="1"
                  className={`input-field ${errors.recurringInterval ? "border-red-300" : ""}`}
                  placeholder="1"
                />
                {errors.recurringInterval && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.recurringInterval}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date *
                </label>
                <input
                  type="date"
                  name="recurringConfig.startDate"
                  value={formData.recurringConfig.startDate}
                  onChange={handleChange}
                  className={`input-field ${errors.recurringStartDate ? "border-red-300" : ""}`}
                />
                {errors.recurringStartDate && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.recurringStartDate}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date (Optional)
                </label>
                <input
                  type="date"
                  name="recurringConfig.endDate"
                  value={formData.recurringConfig.endDate}
                  onChange={handleChange}
                  min={formData.recurringConfig.startDate}
                  className={`input-field ${errors.recurringEndDate ? "border-red-300" : ""}`}
                />
                {errors.recurringEndDate && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.recurringEndDate}
                  </p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Leave empty for indefinite recurring
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Additional Notes
        </label>
        <textarea
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          rows="3"
          className="input-field"
          placeholder="Any additional notes or comments..."
        />
      </div>

      {/* Form Actions */}
      <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary"
          disabled={loading}
        >
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? (
            <>
              <LoadingSpinner size="sm" className="mr-2" />
              {expense ? "Updating..." : "Creating..."}
            </>
          ) : (
            <>
              <i className={`fas ${expense ? "fa-save" : "fa-plus"} mr-2`}></i>
              {expense ? "Update Expense" : "Create Expense"}
            </>
          )}
        </button>
      </div>
    </form>
  );
};

export default ExpenseForm;
