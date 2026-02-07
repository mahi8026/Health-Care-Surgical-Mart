import React, { useState, useEffect } from "react";
import { apiService } from "../services/api";
import LoadingSpinner from "../components/LoadingSpinner";
import SearchableProductSelect from "../components/SearchableProductSelect";

const Purchases = () => {
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalPurchases, setTotalPurchases] = useState(0);

  // Create Purchase Form State
  const [createForm, setCreateForm] = useState({
    supplierId: "",
    invoiceNo: "",
    purchaseDate: new Date().toISOString().split("T")[0],
    notes: "",
    items: [],
  });

  // Current item being added
  const [currentItem, setCurrentItem] = useState({
    productId: "",
    qty: "",
    unitCost: "",
  });

  // Fetch purchases
  const fetchPurchases = async (page = 1) => {
    try {
      // Use the working test endpoint temporarily
      const response = await fetch("http://localhost:5000/api/test/purchases");
      const data = await response.json();

      if (data.success) {
        // Apply filters on frontend
        let filteredPurchases = data.data;

        if (searchTerm) {
          filteredPurchases = filteredPurchases.filter(
            (p) =>
              p.purchaseNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
              p.supplier?.name.toLowerCase().includes(searchTerm.toLowerCase())
          );
        }

        if (statusFilter !== "all") {
          filteredPurchases = filteredPurchases.filter(
            (p) => p.status === statusFilter
          );
        }

        setPurchases(filteredPurchases);
        setCurrentPage(1);
        setTotalPages(1);
        setTotalPurchases(filteredPurchases.length);
      } else {
        setError("Failed to fetch purchases");
      }
    } catch (error) {
      console.error("Fetch purchases error:", error);
      setError("Failed to fetch purchases");
    }
  };

  // Fetch suppliers
  const fetchSuppliers = async () => {
    try {
      // Use the working test endpoint temporarily
      const response = await fetch("http://localhost:5000/api/test/suppliers");
      const data = await response.json();

      if (data.success) {
        setSuppliers(data.data);
      }
    } catch (error) {
      console.error("Fetch suppliers error:", error);
    }
  };

  // Fetch products
  const fetchProducts = async () => {
    try {
      // Use the working test endpoint temporarily
      const response = await fetch("http://localhost:5000/api/test/products");
      const data = await response.json();

      if (data.success) {
        setProducts(data.data.filter((p) => p.isActive));
      }
    } catch (error) {
      console.error("Fetch products error:", error);
    }
  };

  // Initial data load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchPurchases(), fetchSuppliers(), fetchProducts()]);
      setLoading(false);
    };
    loadData();
  }, []);

  // Search and filter effect
  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      fetchPurchases(1);
    }, 500);

    return () => clearTimeout(delayedSearch);
  }, [searchTerm, statusFilter]);

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-BD", {
      style: "currency",
      currency: "BDT",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Format date
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  };

  // Add item to purchase
  const addItemToPurchase = () => {
    if (!currentItem.productId || !currentItem.qty || !currentItem.unitCost) {
      setError("Please fill all item fields");
      setTimeout(() => setError(""), 3000);
      return;
    }

    const product = products.find((p) => p._id === currentItem.productId);
    if (!product) {
      setError("Product not found");
      return;
    }

    const qty = parseFloat(currentItem.qty);
    const unitCost = parseFloat(currentItem.unitCost);
    const totalCost = qty * unitCost;

    const newItem = {
      productId: product._id,
      productName: product.name,
      qty,
      unitCost,
      totalCost,
    };

    setCreateForm((prev) => ({
      ...prev,
      items: [...prev.items, newItem],
    }));

    setCurrentItem({
      productId: "",
      qty: "",
      unitCost: "",
    });
  };

  // Remove item from purchase
  const removeItemFromPurchase = (index) => {
    setCreateForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  // Calculate total
  const calculateTotal = () => {
    return createForm.items.reduce((sum, item) => sum + item.totalCost, 0);
  };

  // Create purchase order
  const createPurchaseOrder = async () => {
    if (!createForm.supplierId || createForm.items.length === 0) {
      setError("Please select supplier and add at least one item");
      return;
    }

    // Check if user is logged in
    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user") || "{}");

    if (!token) {
      setError("You are not logged in. Please log in first.");
      return;
    }

    console.log("Current user:", user);
    console.log("User role:", user.role);
    console.log("User permissions:", user.permissions);

    try {
      setLoading(true);
      console.log("Creating purchase order with data:", {
        ...createForm,
        itemsDetails: createForm.items.map((item) => ({
          productId: item.productId,
          qty: item.qty,
          unitCost: item.unitCost,
          totalCost: item.totalCost,
        })),
      });
      console.log("Using token:", token ? "Token exists" : "No token");

      const response = await apiService.post("/purchases", createForm);
      console.log("Create purchase response:", response);

      if (response.success) {
        setShowCreateModal(false);
        setCreateForm({
          supplierId: "",
          invoiceNo: "",
          purchaseDate: new Date().toISOString().split("T")[0],
          notes: "",
          items: [],
        });
        fetchPurchases();
        setError("");
        alert("Purchase order created successfully!");
      } else {
        setError(response.message || "Failed to create purchase order");
      }
    } catch (error) {
      console.error("Create purchase error:", error);

      // Check if it's an authentication error
      if (
        error.message.includes("Authentication") ||
        error.message.includes("401")
      ) {
        setError("Your session has expired. Please log in again.");
        // Don't redirect automatically, let user decide
      } else if (
        error.message.includes("permission") ||
        error.message.includes("403")
      ) {
        setError(
          "You don't have permission to create purchase orders. Please contact your administrator.",
        );
      } else {
        setError(error.message || "Failed to create purchase order");
      }
    } finally {
      setLoading(false);
    }
  };

  // Receive purchase order
  const receivePurchaseOrder = async (purchaseId, receivedItems = null) => {
    try {
      setLoading(true);
      const response = await apiService.put(
        `/purchases/${purchaseId}/receive`,
        {
          receivedItems,
          notes: "Items received and stock updated",
        },
      );
      if (response.success) {
        setShowReceiveModal(false);
        setSelectedPurchase(null);
        fetchPurchases();
        setError("");
      } else {
        setError(response.message || "Failed to receive purchase order");
      }
    } catch (error) {
      setError("Failed to receive purchase order");
      console.error("Receive purchase error:", error);
    } finally {
      setLoading(false);
    }
  };

  // Cancel purchase order
  const cancelPurchaseOrder = async (purchaseId, reason) => {
    try {
      setLoading(true);
      const response = await apiService.put(`/purchases/${purchaseId}/cancel`, {
        reason,
      });
      if (response.success) {
        fetchPurchases();
        setError("");
      } else {
        setError(response.message || "Failed to cancel purchase order");
      }
    } catch (error) {
      setError("Failed to cancel purchase order");
      console.error("Cancel purchase error:", error);
    } finally {
      setLoading(false);
    }
  };

  // Get status badge
  const getStatusBadge = (status) => {
    const badges = {
      pending: "bg-yellow-100 text-yellow-800",
      received: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
    };
    return badges[status] || "bg-gray-100 text-gray-800";
  };

  if (loading && purchases.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Purchase Management
          </h1>
          <p className="text-gray-600 mt-1">
            Manage purchase orders, suppliers, and inventory receiving
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <i className="fas fa-plus"></i>
          New Purchase Order
        </button>
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

      {/* Filters and Search */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by invoice number or supplier..."
                className="input-field pl-10"
              />
            </div>
          </div>
          <div className="w-full md:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-field"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="received">Received</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          {
            title: "Total Orders",
            value: totalPurchases,
            icon: "fas fa-shopping-cart",
            color: "text-blue-600",
            bg: "bg-blue-100",
          },
          {
            title: "Pending Orders",
            value: purchases.filter((p) => p.status === "pending").length,
            icon: "fas fa-clock",
            color: "text-yellow-600",
            bg: "bg-yellow-100",
          },
          {
            title: "Received Orders",
            value: purchases.filter((p) => p.status === "received").length,
            icon: "fas fa-check-circle",
            color: "text-green-600",
            bg: "bg-green-100",
          },
          {
            title: "Total Value",
            value: formatCurrency(
              purchases.reduce((sum, p) => sum + (p.grandTotal || 0), 0),
            ),
            icon: "fas fa-dollar-sign",
            color: "text-purple-600",
            bg: "bg-purple-100",
          },
        ].map((stat, index) => (
          <div key={index} className="card">
            <div className="flex items-center">
              <div className={`p-3 rounded-lg ${stat.bg}`}>
                <i className={`${stat.icon} ${stat.color} text-xl`}></i>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  {stat.title}
                </p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Purchases Table */}
      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="table-header-cell">Invoice No</th>
                <th className="table-header-cell">Supplier</th>
                <th className="table-header-cell">Date</th>
                <th className="table-header-cell">Items</th>
                <th className="table-header-cell">Total Amount</th>
                <th className="table-header-cell">Status</th>
                <th className="table-header-cell">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {purchases.length === 0 ? (
                <tr>
                  <td colSpan="7" className="table-cell text-center py-8">
                    <i className="fas fa-shopping-cart text-gray-400 text-4xl mb-4"></i>
                    <p className="text-gray-500">No purchase orders found</p>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="btn-primary mt-4"
                    >
                      Create First Purchase Order
                    </button>
                  </td>
                </tr>
              ) : (
                purchases.map((purchase) => (
                  <tr key={purchase._id} className="hover:bg-gray-50">
                    <td className="table-cell">
                      <div className="font-medium text-gray-900">
                        {purchase.invoiceNo}
                      </div>
                    </td>
                    <td className="table-cell">
                      <div className="font-medium text-gray-900">
                        {purchase.supplier?.name || "Unknown Supplier"}
                      </div>
                      <div className="text-sm text-gray-500">
                        {purchase.supplier?.company}
                      </div>
                    </td>
                    <td className="table-cell">
                      {formatDate(purchase.purchaseDate)}
                    </td>
                    <td className="table-cell">
                      <span className="text-sm text-gray-600">
                        {purchase.items?.length || 0} items
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className="font-medium text-gray-900">
                        {formatCurrency(purchase.grandTotal)}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span
                        className={`badge ${getStatusBadge(purchase.status)}`}
                      >
                        {purchase.status}
                      </span>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center space-x-2">
                        {purchase.status === "pending" && (
                          <>
                            <button
                              onClick={() => {
                                setSelectedPurchase(purchase);
                                setShowReceiveModal(true);
                              }}
                              className="text-green-600 hover:text-green-900"
                              title="Receive Order"
                            >
                              <i className="fas fa-check"></i>
                            </button>
                            <button
                              onClick={() => {
                                if (
                                  confirm(
                                    "Are you sure you want to cancel this purchase order?",
                                  )
                                ) {
                                  cancelPurchaseOrder(
                                    purchase._id,
                                    "Cancelled by user",
                                  );
                                }
                              }}
                              className="text-red-600 hover:text-red-900"
                              title="Cancel Order"
                            >
                              <i className="fas fa-times"></i>
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => {
                            // View purchase details
                            console.log("View purchase:", purchase);
                          }}
                          className="text-blue-600 hover:text-blue-900"
                          title="View Details"
                        >
                          <i className="fas fa-eye"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200">
            <div className="text-sm text-gray-700">
              Showing {(currentPage - 1) * 20 + 1} to{" "}
              {Math.min(currentPage * 20, totalPurchases)} of {totalPurchases}{" "}
              results
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => fetchPurchases(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => fetchPurchases(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Purchase Modal */}
      {showCreateModal && (
        <CreatePurchaseModal
          suppliers={suppliers}
          products={products}
          createForm={createForm}
          setCreateForm={setCreateForm}
          currentItem={currentItem}
          setCurrentItem={setCurrentItem}
          addItemToPurchase={addItemToPurchase}
          removeItemFromPurchase={removeItemFromPurchase}
          calculateTotal={calculateTotal}
          createPurchaseOrder={createPurchaseOrder}
          onClose={() => setShowCreateModal(false)}
          loading={loading}
          formatCurrency={formatCurrency}
        />
      )}

      {/* Receive Purchase Modal */}
      {showReceiveModal && selectedPurchase && (
        <ReceivePurchaseModal
          purchase={selectedPurchase}
          onReceive={(receivedItems) =>
            receivePurchaseOrder(selectedPurchase._id, receivedItems)
          }
          onClose={() => {
            setShowReceiveModal(false);
            setSelectedPurchase(null);
          }}
          loading={loading}
          formatCurrency={formatCurrency}
        />
      )}
    </div>
  );
};

// Create Purchase Modal Component
const CreatePurchaseModal = ({
  suppliers,
  products,
  createForm,
  setCreateForm,
  currentItem,
  setCurrentItem,
  addItemToPurchase,
  removeItemFromPurchase,
  calculateTotal,
  createPurchaseOrder,
  onClose,
  loading,
  formatCurrency,
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white max-w-4xl w-full max-h-screen overflow-y-auto rounded-lg shadow-2xl">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">
              Create Purchase Order
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <i className="fas fa-times text-xl"></i>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Purchase Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Supplier *
              </label>
              {suppliers.length === 0 ? (
                <div className="space-y-2">
                  <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                    No suppliers found. You need to create suppliers first.
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const name = prompt("Enter supplier name:");
                      const company = prompt("Enter company name:");
                      const phone = prompt("Enter phone number:");
                      const email = prompt("Enter email (optional):");

                      if (name && company && phone) {
                        // Create supplier via API
                        fetch("/api/suppliers", {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${localStorage.getItem("token")}`,
                          },
                          body: JSON.stringify({
                            name: name.trim(),
                            company: company.trim(),
                            phone: phone.trim(),
                            email: email?.trim() || "",
                            address: "",
                          }),
                        })
                          .then((res) => res.json())
                          .then((data) => {
                            if (data.success) {
                              // Refresh suppliers list
                              window.location.reload();
                            } else {
                              alert(
                                "Failed to create supplier: " + data.message,
                              );
                            }
                          })
                          .catch((err) => {
                            alert("Error creating supplier: " + err.message);
                          });
                      }
                    }}
                    className="btn-secondary text-sm"
                  >
                    <i className="fas fa-plus mr-1"></i>
                    Quick Add Supplier
                  </button>
                </div>
              ) : (
                <select
                  value={createForm.supplierId}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      supplierId: e.target.value,
                    }))
                  }
                  className="input-field"
                  required
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier._id} value={supplier._id}>
                      {supplier.name} - {supplier.company}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Invoice Number
              </label>
              <input
                type="text"
                value={createForm.invoiceNo}
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    invoiceNo: e.target.value,
                  }))
                }
                className="input-field"
                placeholder="Auto-generated if empty"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Purchase Date *
              </label>
              <input
                type="date"
                value={createForm.purchaseDate}
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    purchaseDate: e.target.value,
                  }))
                }
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <input
                type="text"
                value={createForm.notes}
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    notes: e.target.value,
                  }))
                }
                className="input-field"
                placeholder="Optional notes"
              />
            </div>
          </div>

          {/* Add Items Section */}
          <div className="border-t border-gray-200 pt-6">
            <h4 className="text-lg font-medium text-gray-900 mb-4">
              Add Items
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product *
                </label>
                <SearchableProductSelect
                  products={products}
                  value={currentItem.productId}
                  onChange={(productId) =>
                    setCurrentItem((prev) => ({
                      ...prev,
                      productId: productId,
                    }))
                  }
                  placeholder="Search and select product..."
                  showStock={true}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity *
                </label>
                <input
                  type="number"
                  value={currentItem.qty}
                  onChange={(e) =>
                    setCurrentItem((prev) => ({
                      ...prev,
                      qty: e.target.value,
                    }))
                  }
                  className="input-field"
                  placeholder="0"
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unit Cost *
                </label>
                <input
                  type="number"
                  value={currentItem.unitCost}
                  onChange={(e) =>
                    setCurrentItem((prev) => ({
                      ...prev,
                      unitCost: e.target.value,
                    }))
                  }
                  className="input-field"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={addItemToPurchase}
                  className="btn-primary w-full"
                >
                  <i className="fas fa-plus mr-2"></i>
                  Add Item
                </button>
              </div>
            </div>
          </div>

          {/* Items List */}
          {createForm.items.length > 0 && (
            <div className="border-t border-gray-200 pt-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">
                Purchase Items
              </h4>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Product
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Qty
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Unit Cost
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Total
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {createForm.items.map((item, index) => (
                      <tr key={index}>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {item.productName}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right">
                          {item.qty}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right">
                          {formatCurrency(item.unitCost)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                          {formatCurrency(item.totalCost)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => removeItemFromPurchase(index)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td
                        colSpan="3"
                        className="px-4 py-3 text-sm font-medium text-gray-900 text-right"
                      >
                        Grand Total:
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                        {formatCurrency(calculateTotal())}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={createPurchaseOrder}
            disabled={
              loading || !createForm.supplierId || createForm.items.length === 0
            }
            className="btn-primary"
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Creating...
              </>
            ) : (
              "Create Purchase Order"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Receive Purchase Modal Component
const ReceivePurchaseModal = ({
  purchase,
  onReceive,
  onClose,
  loading,
  formatCurrency,
}) => {
  const [receivedItems, setReceivedItems] = useState(
    purchase.items?.map((item) => ({
      ...item,
      receivedQty: item.qty,
    })) || [],
  );

  const updateReceivedQty = (index, qty) => {
    setReceivedItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, receivedQty: qty } : item,
      ),
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white max-w-3xl w-full max-h-screen overflow-y-auto rounded-lg shadow-2xl">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">
              Receive Purchase Order - {purchase.invoiceNo}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <i className="fas fa-times text-xl"></i>
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <h4 className="text-md font-medium text-gray-900 mb-4">
              Adjust received quantities if needed:
            </h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Product
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Ordered
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Received
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Unit Cost
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {receivedItems.map((item, index) => (
                    <tr key={index}>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {item.productName || `Product ${item.productId}`}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">
                        {item.qty}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          value={item.receivedQty}
                          onChange={(e) =>
                            updateReceivedQty(
                              index,
                              parseInt(e.target.value) || 0,
                            )
                          }
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-right"
                          min="0"
                          max={item.qty}
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">
                        {formatCurrency(item.unitCost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={() => onReceive(receivedItems)}
            disabled={loading}
            className="btn-primary"
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Receiving...
              </>
            ) : (
              "Receive Items & Update Stock"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Purchases;
