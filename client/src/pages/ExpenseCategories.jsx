import React, { useState, useEffect } from "react";
import { apiService } from "../services/api";
import LoadingSpinner from "../components/LoadingSpinner";

const ExpenseCategories = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

  // Fetch categories
  const fetchCategories = async () => {
    try {
      setLoading(true);
      // Use the working test endpoint temporarily
      const response = await fetch(
        "http://localhost:5000/api/test/expense-categories",
      );
      const data = await response.json();

      if (data.success) {
        setCategories(data.data);
      } else {
        setError(data.message || "Failed to fetch expense categories");
      }
    } catch (error) {
      setError("Failed to fetch expense categories");
      console.error("Fetch categories error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  // Handle delete category
  const handleDelete = async (categoryId) => {
    try {
      const response = await apiService.delete(
        `/expense-categories/${categoryId}`,
      );
      if (response.success) {
        setCategories(categories.filter((c) => c._id !== categoryId));
        setShowDeleteConfirm(null);
        setSuccess("Category deleted successfully");
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(response.message || "Failed to delete category");
      }
    } catch (error) {
      setError("Failed to delete category");
      console.error("Delete category error:", error);
    }
  };

  // Filter categories based on search term
  const filteredCategories = categories.filter(
    (category) =>
      category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (category.description &&
        category.description
          .toLowerCase()
          .includes(searchTerm.toLowerCase())) ||
      category.type.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Get category type badge color
  const getTypeColor = (type) => {
    switch (type) {
      case "Fixed":
        return "badge-info";
      case "Variable":
        return "badge-warning";
      case "One-time":
        return "badge-success";
      default:
        return "badge-info";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Expense Categories
          </h1>
          <p className="text-gray-600 mt-1">
            Manage expense categories to organize your business expenses
          </p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary">
          <i className="fas fa-plus mr-2"></i>
          Add Category
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <div className="flex items-center">
            <i className="fas fa-exclamation-circle mr-2"></i>
            <span>{error}</span>
            <button
              onClick={() => setError("")}
              className="ml-auto text-red-500 hover:text-red-700"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          <div className="flex items-center">
            <i className="fas fa-check-circle mr-2"></i>
            <span>{success}</span>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <i className="fas fa-tags text-blue-600"></i>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">
                Total Categories
              </p>
              <p className="text-xl font-bold text-gray-900">
                {categories.length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <i className="fas fa-check-circle text-green-600"></i>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Active</p>
              <p className="text-xl font-bold text-gray-900">
                {categories.filter((c) => c.isActive).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <i className="fas fa-star text-yellow-600"></i>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Default</p>
              <p className="text-xl font-bold text-gray-900">
                {categories.filter((c) => c.isDefault).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <i className="fas fa-chart-pie text-purple-600"></i>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">
                Fixed Expenses
              </p>
              <p className="text-xl font-bold text-gray-900">
                {categories.filter((c) => c.type === "Fixed").length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search categories by name, description, or type..."
            className="input-field pl-10"
          />
          <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
        </div>
      </div>

      {/* Categories Table */}
      <div className="table-container">
        <table className="table">
          <thead className="table-header">
            <tr>
              <th className="table-header-cell">Category</th>
              <th className="table-header-cell">Type</th>
              <th className="table-header-cell">Description</th>
              <th className="table-header-cell">Status</th>
              <th className="table-header-cell">Created</th>
              <th className="table-header-cell">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredCategories.length === 0 ? (
              <tr>
                <td colSpan="6" className="table-cell text-center py-8">
                  <div className="text-gray-500">
                    <i className="fas fa-tags text-4xl mb-4"></i>
                    <p className="text-lg">No categories found</p>
                    <p className="text-sm">
                      {searchTerm
                        ? "Try adjusting your search terms"
                        : "Add your first expense category to get started"}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredCategories.map((category) => (
                <tr key={category._id} className="hover:bg-gray-50">
                  <td className="table-cell">
                    <div className="flex items-center">
                      <div>
                        <div className="font-medium text-gray-900 flex items-center">
                          {category.name}
                          {category.isDefault && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                              <i className="fas fa-star mr-1"></i>
                              Default
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="table-cell">
                    <span className={`badge ${getTypeColor(category.type)}`}>
                      {category.type}
                    </span>
                  </td>
                  <td className="table-cell">
                    <div className="max-w-xs truncate text-gray-600">
                      {category.description || "No description"}
                    </div>
                  </td>
                  <td className="table-cell">
                    <span
                      className={`badge ${
                        category.isActive ? "badge-success" : "badge-danger"
                      }`}
                    >
                      {category.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="table-cell text-gray-500">
                    {new Date(category.createdAt).toLocaleDateString()}
                  </td>
                  <td className="table-cell">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setEditingCategory(category)}
                        className="text-blue-600 hover:text-blue-800"
                        title="Edit Category"
                      >
                        <i className="fas fa-edit"></i>
                      </button>
                      {!category.isDefault && (
                        <button
                          onClick={() => setShowDeleteConfirm(category)}
                          className="text-red-600 hover:text-red-800"
                          title="Delete Category"
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Category Modal */}
      {(showAddModal || editingCategory) && (
        <CategoryModal
          category={editingCategory}
          onClose={() => {
            setShowAddModal(false);
            setEditingCategory(null);
          }}
          onSave={() => {
            fetchCategories();
            setShowAddModal(false);
            setEditingCategory(null);
            setSuccess(
              editingCategory
                ? "Category updated successfully"
                : "Category created successfully",
            );
            setTimeout(() => setSuccess(""), 3000);
          }}
          onError={setError}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <i className="fas fa-exclamation-triangle text-red-500 text-2xl mr-3"></i>
              <h3 className="text-lg font-semibold text-gray-900">
                Delete Category
              </h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete "{showDeleteConfirm.name}"? This
              action cannot be undone and may affect existing expenses.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm._id)}
                className="btn-danger"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Category Modal Component
const CategoryModal = ({ category, onClose, onSave, onError }) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "Variable",
    isActive: true,
    ...(category && {
      ...category,
    }),
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const endpoint = category
        ? `/expense-categories/${category._id}`
        : "/expense-categories";
      const method = category ? "put" : "post";

      const response = await apiService[method](endpoint, formData);

      if (response.success) {
        onSave();
      } else {
        onError(response.message || "Failed to save category");
      }
    } catch (error) {
      onError("Failed to save category");
      console.error("Save category error:", error);
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
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4 max-h-screen overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-gray-900">
            {category ? "Edit Category" : "Add New Category"}
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
              rows="3"
              className="input-field"
              placeholder="Enter category description (optional)"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              name="isActive"
              checked={formData.isActive}
              onChange={handleChange}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label className="ml-2 text-sm font-medium text-gray-700">
              Active Category
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
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
                  Saving...
                </>
              ) : (
                <>
                  <i className="fas fa-save mr-2"></i>
                  {category ? "Update" : "Create"} Category
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ExpenseCategories;
