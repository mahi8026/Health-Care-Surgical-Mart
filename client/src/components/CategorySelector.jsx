import React, { useState, useEffect } from "react";
import { apiService } from "../services/api";
import LoadingSpinner from "./LoadingSpinner";

const CategorySelector = ({
  value,
  onChange,
  name = "categoryId",
  required = false,
  placeholder = "Select a category",
  className = "",
  allowInlineCreate = true,
  onCategoryCreated = null,
}) => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Fetch categories
  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await apiService.get("/expense-categories");
      if (response.success) {
        // Only show active categories
        const activeCategories = response.data.filter((cat) => cat.isActive);
        setCategories(activeCategories);
      } else {
        setError("Failed to load categories");
      }
    } catch (error) {
      setError("Failed to load categories");
      console.error("Fetch categories error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  // Handle category creation
  const handleCategoryCreated = (newCategory) => {
    setCategories((prev) => [...prev, newCategory]);
    onChange({ target: { name, value: newCategory._id } });
    setShowCreateModal(false);
    if (onCategoryCreated) {
      onCategoryCreated(newCategory);
    }
  };

  if (loading) {
    return (
      <div className="relative">
        <select className={`input-field ${className}`} disabled>
          <option>Loading categories...</option>
        </select>
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <LoadingSpinner size="sm" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative">
        <select className={`input-field border-red-300 ${className}`} disabled>
          <option>Error loading categories</option>
        </select>
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <i className="fas fa-exclamation-triangle text-red-500"></i>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="relative">
        <select
          name={name}
          value={value || ""}
          onChange={onChange}
          required={required}
          className={`input-field ${className}`}
        >
          <option value="">{placeholder}</option>
          {categories.map((category) => (
            <option key={category._id} value={category._id}>
              {category.name} ({category.type})
            </option>
          ))}
          {allowInlineCreate && (
            <option
              value="__create_new__"
              className="font-medium text-blue-600"
            >
              + Create New Category
            </option>
          )}
        </select>

        {allowInlineCreate && (
          <div className="absolute right-10 top-1/2 transform -translate-y-1/2">
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="text-blue-600 hover:text-blue-800 text-sm"
              title="Create new category"
            >
              <i className="fas fa-plus"></i>
            </button>
          </div>
        )}
      </div>

      {/* Handle create new selection */}
      {value === "__create_new__" && (
        <>
          {setShowCreateModal(true)}
          {onChange({ target: { name, value: "" } })}
        </>
      )}

      {/* Inline Category Creation Modal */}
      {showCreateModal && (
        <InlineCategoryModal
          onClose={() => setShowCreateModal(false)}
          onSave={handleCategoryCreated}
          onError={(error) => console.error("Category creation error:", error)}
        />
      )}
    </>
  );
};

// Inline Category Creation Modal
const InlineCategoryModal = ({ onClose, onSave, onError }) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "Variable",
    isActive: true,
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await apiService.post("/expense-categories", formData);

      if (response.success) {
        onSave(response.data);
      } else {
        onError(response.message || "Failed to create category");
      }
    } catch (error) {
      onError("Failed to create category");
      console.error("Create category error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Create New Category
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category Name *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="input-field"
              placeholder="Enter category name"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type *
            </label>
            <select
              name="type"
              value={formData.type}
              onChange={handleChange}
              required
              className="input-field"
            >
              <option value="Fixed">Fixed - Regular recurring expenses</option>
              <option value="Variable">Variable - Fluctuating expenses</option>
              <option value="One-time">
                One-time - Single occurrence expenses
              </option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="2"
              className="input-field"
              placeholder="Brief description (optional)"
            />
          </div>

          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="flex items-start">
              <i className="fas fa-info-circle text-blue-500 mt-0.5 mr-2"></i>
              <div className="text-sm text-blue-700">
                <p className="font-medium">Quick Create</p>
                <p>This category will be created and automatically selected.</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <i className="fas fa-plus mr-2"></i>
                  Create & Select
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CategorySelector;
