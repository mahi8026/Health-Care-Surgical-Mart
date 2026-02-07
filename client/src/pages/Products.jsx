import React, { useState, useEffect } from "react";
import { apiService } from "../services/api";
import LoadingSpinner from "../components/LoadingSpinner";
import BulkProductImport from "../components/BulkProductImport";

const Products = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [stockFilter, setStockFilter] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);

  const categories = ["Medical", "Lab", "Surgical"];
  const units = ["pcs", "box", "pack", "bottle", "strip", "vial"];

  // Fetch products
  const fetchProducts = async () => {
    try {
      setLoading(true);

      // Use the working test endpoint temporarily
      const response = await fetch("http://localhost:5000/api/test/products");
      const data = await response.json();

      if (data.success) {
        let filteredProducts = data.data;

        // Apply search filter on frontend
        if (searchTerm) {
          filteredProducts = filteredProducts.filter(
            (product) =>
              product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
              (product.brand &&
                product.brand.toLowerCase().includes(searchTerm.toLowerCase())),
          );
        }

        // Apply category filter on frontend
        if (selectedCategory) {
          filteredProducts = filteredProducts.filter(
            (product) => product.category === selectedCategory,
          );
        }

        // Apply stock filter on frontend
        if (stockFilter) {
          filteredProducts = filteredProducts.filter((product) => {
            switch (stockFilter) {
              case "in-stock":
                return product.stockQuantity > 0 && !product.isLowStock;
              case "low-stock":
                return product.isLowStock && product.stockQuantity > 0;
              case "out-of-stock":
                return product.stockQuantity === 0;
              default:
                return true;
            }
          });
        }

        setProducts(filteredProducts);
      } else {
        setError(data.message || "Failed to fetch products");
      }
    } catch (error) {
      setError("Failed to fetch products");
      console.error("Fetch products error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [searchTerm, selectedCategory, stockFilter]);

  // Handle bulk selection
  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedProducts(products.map((p) => p._id));
    } else {
      setSelectedProducts([]);
    }
  };

  const handleSelectProduct = (productId, checked) => {
    if (checked) {
      setSelectedProducts([...selectedProducts, productId]);
    } else {
      setSelectedProducts(selectedProducts.filter((id) => id !== productId));
    }
  };

  // Export products to CSV
  const exportProducts = () => {
    const headers = [
      "Name",
      "Category",
      "Brand",
      "SKU",
      "Purchase Price",
      "Selling Price",
      "Unit",
      "Stock Quantity",
      "Min Stock Level",
      "Status",
    ];
    const csvData = products.map((product) => [
      product.name,
      typeof product.category === "object"
        ? product.category.name
        : product.category,
      product.brand || "",
      product.sku,
      product.purchasePrice,
      product.sellingPrice,
      product.unit,
      product.stockQuantity,
      product.minStockLevel,
      product.isActive ? "Active" : "Inactive",
    ]);

    const csvContent = [headers, ...csvData]
      .map((row) => row.map((field) => `"${field}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `products_${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  const handleBulkDelete = async () => {
    try {
      const promises = selectedProducts.map((id) =>
        apiService.delete(`/products/${id}`),
      );

      await Promise.all(promises);
      setProducts(products.filter((p) => !selectedProducts.includes(p._id)));
      setSelectedProducts([]);
      setShowBulkActions(false);
    } catch (error) {
      setError("Failed to delete selected products");
      console.error("Bulk delete error:", error);
    }
  };
  const handleDelete = async (productId) => {
    try {
      const response = await apiService.delete(`/products/${productId}`);
      if (response.success) {
        setProducts(products.filter((p) => p._id !== productId));
        setShowDeleteConfirm(null);
      } else {
        setError(response.message || "Failed to delete product");
      }
    } catch (error) {
      setError("Failed to delete product");
      console.error("Delete product error:", error);
    }
  };

  // Format currency
  const formatCurrency = (amount) => {
    return `৳${amount.toFixed(2)}`;
  };

  // Get stock status
  const getStockStatus = (product) => {
    if (product.stockQuantity === 0) {
      return { text: "Out of Stock", color: "bg-red-100 text-red-800" };
    } else if (product.isLowStock) {
      return { text: "Low Stock", color: "bg-yellow-100 text-yellow-800" };
    } else {
      return { text: "In Stock", color: "bg-green-100 text-green-800" };
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
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          {selectedProducts.length > 0 && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">
                {selectedProducts.length} selected
              </span>
              <button
                onClick={() => setShowBulkActions(true)}
                className="text-red-600 hover:text-red-800 text-sm"
              >
                <i className="fas fa-trash mr-1"></i>
                Delete Selected
              </button>
            </div>
          )}
        </div>
        <div className="flex space-x-2">
          <button onClick={() => exportProducts()} className="btn-secondary">
            <i className="fas fa-download mr-2"></i>
            Export
          </button>
          <button
            onClick={() => setShowBulkImport(true)}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
          >
            <i className="fas fa-file-import"></i>
            Bulk Import
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn-primary">
            <i className="fas fa-plus mr-2"></i>
            Add Product
          </button>
        </div>
      </div>

      {/* Error Message */}
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

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <i className="fas fa-boxes text-blue-600"></i>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">
                Total Products
              </p>
              <p className="text-xl font-bold text-gray-900">
                {products.length}
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
              <p className="text-sm font-medium text-gray-600">In Stock</p>
              <p className="text-xl font-bold text-gray-900">
                {
                  products.filter((p) => p.stockQuantity > 0 && !p.isLowStock)
                    .length
                }
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <i className="fas fa-exclamation-triangle text-yellow-600"></i>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Low Stock</p>
              <p className="text-xl font-bold text-gray-900">
                {
                  products.filter((p) => p.isLowStock && p.stockQuantity > 0)
                    .length
                }
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <i className="fas fa-times-circle text-red-600"></i>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Out of Stock</p>
              <p className="text-xl font-bold text-gray-900">
                {products.filter((p) => p.stockQuantity === 0).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search Products
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, SKU, or brand..."
                className="input-field pl-10"
              />
              <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="input-field"
            >
              <option value="">All Categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Stock Status
            </label>
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
              className="input-field"
            >
              <option value="">All Stock Status</option>
              <option value="in-stock">In Stock</option>
              <option value="low-stock">Low Stock</option>
              <option value="out-of-stock">Out of Stock</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setSearchTerm("");
                setSelectedCategory("");
                setStockFilter("");
              }}
              className="btn-secondary"
            >
              <i className="fas fa-undo mr-2"></i>
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="table-container">
        <table className="table">
          <thead className="table-header">
            <tr>
              <th className="table-header-cell w-12">
                <input
                  type="checkbox"
                  checked={
                    selectedProducts.length === products.length &&
                    products.length > 0
                  }
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th className="table-header-cell">Product</th>
              <th className="table-header-cell">Category</th>
              <th className="table-header-cell">SKU</th>
              <th className="table-header-cell">Stock</th>
              <th className="table-header-cell">Purchase Price</th>
              <th className="table-header-cell">Selling Price</th>
              <th className="table-header-cell">Status</th>
              <th className="table-header-cell">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {products.length === 0 ? (
              <tr>
                <td colSpan="9" className="table-cell text-center py-8">
                  <div className="text-gray-500">
                    <i className="fas fa-box-open text-4xl mb-4"></i>
                    <p className="text-lg">No products found</p>
                    <p className="text-sm">
                      {searchTerm || selectedCategory
                        ? "Try adjusting your filters"
                        : "Add your first product to get started"}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              products.map((product) => {
                const stockStatus = getStockStatus(product);
                return (
                  <tr key={product._id} className="hover:bg-gray-50">
                    <td className="table-cell">
                      <input
                        type="checkbox"
                        checked={selectedProducts.includes(product._id)}
                        onChange={(e) =>
                          handleSelectProduct(product._id, e.target.checked)
                        }
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="table-cell">
                      <div>
                        <div className="font-medium text-gray-900">
                          {product.name}
                        </div>
                        {product.brand && (
                          <div className="text-sm text-gray-500">
                            {product.brand}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className="badge badge-info">
                        {typeof product.category === "object"
                          ? product.category.name
                          : product.category}
                      </span>
                    </td>
                    <td className="table-cell font-mono text-sm">
                      {product.sku}
                    </td>
                    <td className="table-cell">
                      <div>
                        <div className="font-medium">
                          {product.stockQuantity} {product.unit}
                        </div>
                        <span className={`badge ${stockStatus.color}`}>
                          {stockStatus.text}
                        </span>
                      </div>
                    </td>
                    <td className="table-cell">
                      {formatCurrency(product.purchasePrice)}
                    </td>
                    <td className="table-cell">
                      {formatCurrency(product.sellingPrice)}
                    </td>
                    <td className="table-cell">
                      <span
                        className={`badge ${
                          product.isActive ? "badge-success" : "badge-danger"
                        }`}
                      >
                        {product.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="table-cell">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setEditingProduct(product)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Edit Product"
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(product)}
                          className="text-red-600 hover:text-red-800"
                          title="Delete Product"
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Product Modal */}
      {(showAddModal || editingProduct) && (
        <ProductModal
          product={editingProduct}
          categories={categories}
          units={units}
          onClose={() => {
            setShowAddModal(false);
            setEditingProduct(null);
          }}
          onSave={() => {
            fetchProducts();
            setShowAddModal(false);
            setEditingProduct(null);
          }}
          onError={setError}
        />
      )}

      {/* Bulk Actions Confirmation Modal */}
      {showBulkActions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <i className="fas fa-exclamation-triangle text-red-500 text-2xl mr-3"></i>
              <h3 className="text-lg font-semibold text-gray-900">
                Delete Multiple Products
              </h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete {selectedProducts.length} selected
              products? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowBulkActions(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button onClick={handleBulkDelete} className="btn-danger">
                Delete {selectedProducts.length} Products
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <i className="fas fa-exclamation-triangle text-red-500 text-2xl mr-3"></i>
              <h3 className="text-lg font-semibold text-gray-900">
                Delete Product
              </h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete "{showDeleteConfirm.name}"? This
              action cannot be undone.
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

      {/* Bulk Import Modal */}
      {showBulkImport && (
        <BulkProductImport
          onClose={() => setShowBulkImport(false)}
          onSuccess={() => {
            setShowBulkImport(false);
            fetchProducts();
          }}
        />
      )}
    </div>
  );
};

// Product Modal Component
const ProductModal = ({
  product,
  categories,
  units,
  onClose,
  onSave,
  onError,
}) => {
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    brand: "",
    sku: "",
    purchasePrice: "",
    sellingPrice: "",
    unit: "",
    minStockLevel: "",
    description: "",
    batchNo: "",
    expiryDate: "",
    ...(product && {
      ...product,
      category:
        typeof product.category === "object"
          ? product.category.name
          : product.category,
      expiryDate: product.expiryDate
        ? typeof product.expiryDate === "string"
          ? product.expiryDate
          : new Date(product.expiryDate).toISOString()
        : "",
    }),
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const endpoint = product ? `/products/${product._id}` : "/products";
      const method = product ? "put" : "post";

      const response = await apiService[method](endpoint, formData);

      if (response.success) {
        onSave();
      } else {
        onError(response.message || "Failed to save product");
      }
    } catch (error) {
      onError("Failed to save product");
      console.error("Save product error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-screen overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-gray-900">
            {product ? "Edit Product" : "Add New Product"}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Product Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="input-field"
                placeholder="Enter product name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category *
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                required
                className="input-field"
              >
                <option value="">Select Category</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Brand
              </label>
              <input
                type="text"
                name="brand"
                value={formData.brand}
                onChange={handleChange}
                className="input-field"
                placeholder="Enter brand name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                SKU *
              </label>
              <input
                type="text"
                name="sku"
                value={formData.sku}
                onChange={handleChange}
                required
                className="input-field"
                placeholder="Enter SKU"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Purchase Price *
              </label>
              <input
                type="number"
                name="purchasePrice"
                value={formData.purchasePrice}
                onChange={handleChange}
                required
                min="0"
                step="0.01"
                className="input-field"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Selling Price *
              </label>
              <input
                type="number"
                name="sellingPrice"
                value={formData.sellingPrice}
                onChange={handleChange}
                required
                min="0"
                step="0.01"
                className="input-field"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unit *
              </label>
              <select
                name="unit"
                value={formData.unit}
                onChange={handleChange}
                required
                className="input-field"
              >
                <option value="">Select Unit</option>
                {units.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Min Stock Level *
              </label>
              <input
                type="number"
                name="minStockLevel"
                value={formData.minStockLevel}
                onChange={handleChange}
                required
                min="0"
                className="input-field"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Batch Number
              </label>
              <input
                type="text"
                name="batchNo"
                value={formData.batchNo}
                onChange={handleChange}
                className="input-field"
                placeholder="Enter batch number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expiry Date
              </label>
              <input
                type="date"
                name="expiryDate"
                value={
                  formData.expiryDate
                    ? typeof formData.expiryDate === "string"
                      ? formData.expiryDate.split("T")[0]
                      : new Date(formData.expiryDate)
                          .toISOString()
                          .split("T")[0]
                    : ""
                }
                onChange={handleChange}
                className="input-field"
              />
            </div>
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
              placeholder="Enter product description"
            ></textarea>
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
                  {product ? "Update" : "Create"} Product
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Products;
