import React, { useState, useEffect } from "react";
import api from "../config/api";
import LoadingSpinner from "../components/LoadingSpinner";

// ── helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) =>
  new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT", minimumFractionDigits: 0 }).format(n || 0);

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" }) : "Never";

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [customerTypeFilter, setCustomerTypeFilter] = useState("all");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCustomers, setTotalCustomers] = useState(0);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    type: "Walk-in",
    creditEnabled: false,
    creditLimit: 0,
  });

  // Customer statistics
  const [customerStats, setCustomerStats] = useState({
    totalCustomers: 0,
    retailCustomers: 0,
    wholesaleCustomers: 0,
    recentCustomers: 0,
  });

  // Fetch customers
  const fetchCustomers = async (page = 1) => {
    try {
      // Use real authenticated endpoint
      const response = await api.get("/customers");

      if (response.success) {
        let filteredCustomers = response.data;

        // Apply search filter on frontend
        if (searchTerm) {
          filteredCustomers = filteredCustomers.filter(
            (customer) =>
              customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              customer.phone.includes(searchTerm) ||
              (customer.email &&
                customer.email
                  .toLowerCase()
                  .includes(searchTerm.toLowerCase())),
          );
        }

        // Apply client-side filtering for customer type
        if (customerTypeFilter !== "all") {
          filteredCustomers = filteredCustomers.filter(
            (customer) => customer.type === customerTypeFilter,
          );
        }

        setCustomers(filteredCustomers);
        setCurrentPage(1);
        setTotalPages(1);
        setTotalCustomers(filteredCustomers.length);

        // Calculate statistics
        calculateStats(response.data);
      } else {
        setError("Failed to fetch customers");
      }
    } catch (error) {
      console.error("Fetch customers error:", error);
      if (error.message?.includes("401")) {
        window.location.href = "/login";
      }
      setError("Failed to fetch customers");
    }
  };

  // Calculate customer statistics
  const calculateStats = (customerData) => {
    const stats = {
      totalCustomers: customerData.length,
      retailCustomers: customerData.filter((c) => c.type === "Walk-in" || c.type === "Hospital/Clinic" || c.type === "Diagnostic").length,
      wholesaleCustomers: customerData.filter((c) => c.type === "Wholesaler").length,
      recentCustomers: customerData.filter((c) => {
        const createdDate = new Date(c.createdAt);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return createdDate >= thirtyDaysAgo;
      }).length,
    };
    setCustomerStats(stats);
  };

  // Initial data load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchCustomers();
      setLoading(false);
    };
    loadData();
  }, []);

  // Search and filter effect
  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      fetchCustomers(1);
    }, 500);

    return () => clearTimeout(delayedSearch);
  }, [searchTerm, customerTypeFilter]);

  // Format date
  const formatDate = (date) => fmtDate(date);

  // Format currency
  const formatCurrency = (amount) => fmt(amount);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: "",
      phone: "",
      email: "",
      address: "",
      type: "Walk-in",
      creditEnabled: false,
      creditLimit: 0,
    });
  };

  // Create customer
  const createCustomer = async () => {
    if (!formData.name.trim() || !formData.phone.trim()) {
      setError("Name and phone are required");
      return;
    }

    try {
      setLoading(true);
      const response = await api.post("/customers", formData);
      if (response.success) {
        setShowCreateModal(false);
        resetForm();
        fetchCustomers();
        setError("");
      } else {
        setError(response.message || "Failed to create customer");
      }
    } catch (error) {
      setError("Failed to create customer");
      console.error("Create customer error:", error);
    } finally {
      setLoading(false);
    }
  };

  // Update customer
  const updateCustomer = async () => {
    if (!formData.name.trim() || !formData.phone.trim()) {
      setError("Name and phone are required");
      return;
    }

    try {
      setLoading(true);
      const response = await api.put(
        `/customers/${selectedCustomer._id}`,
        formData,
      );
      if (response.success) {
        setShowEditModal(false);
        setSelectedCustomer(null);
        resetForm();
        fetchCustomers();
        setError("");
      } else {
        setError(response.message || "Failed to update customer");
      }
    } catch (error) {
      setError("Failed to update customer");
      console.error("Update customer error:", error);
    } finally {
      setLoading(false);
    }
  };

  // Delete customer
  const deleteCustomer = async (customerId) => {
    if (!confirm("Are you sure you want to delete this customer?")) {
      return;
    }

    try {
      setLoading(true);
      const response = await api.delete(`/customers/${customerId}`);
      if (response.success) {
        fetchCustomers();
        setError("");
      } else {
        setError(response.message || "Failed to delete customer");
      }
    } catch (error) {
      setError("Failed to delete customer");
      console.error("Delete customer error:", error);
    } finally {
      setLoading(false);
    }
  };

  // Open edit modal
  const openEditModal = (customer) => {
    setSelectedCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone,
      email: customer.email || "",
      address: customer.address || "",
      type: customer.type,
      creditEnabled: customer.creditEnabled || false,
      creditLimit: customer.creditLimit || 0,
    });
    setShowEditModal(true);
  };

  // Open details modal
  const openDetailsModal = (customer) => {
    setSelectedCustomer(customer);
    setShowDetailsModal(true);
  };

  // Get customer type badge
  const getCustomerTypeBadge = (type) => {
    const badges = {
      "Walk-in": "bg-blue-100 text-blue-800",
      "Hospital/Clinic": "bg-green-100 text-green-800",
      "Diagnostic": "bg-purple-100 text-purple-800",
      "Wholesaler": "bg-orange-100 text-orange-800",
    };
    return badges[type] || "bg-gray-100 text-gray-800";
  };

  if (loading && customers.length === 0) {
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
            Customer Management
          </h1>
          <p className="text-gray-600 mt-1">
            Manage customer profiles, purchase history, and relationships
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowCreateModal(true);
          }}
          className="btn-primary flex items-center gap-2"
        >
          <i className="fas fa-plus"></i>
          Add New Customer
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

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          {
            title: "Total Customers",
            value: customerStats.totalCustomers,
            icon: "fas fa-users",
            color: "text-blue-600",
            bg: "bg-blue-100",
          },
          {
            title: "Retail Customers",
            value: customerStats.retailCustomers,
            icon: "fas fa-user",
            color: "text-green-600",
            bg: "bg-green-100",
          },
          {
            title: "Wholesale Customers",
            value: customerStats.wholesaleCustomers,
            icon: "fas fa-building",
            color: "text-purple-600",
            bg: "bg-purple-100",
          },
          {
            title: "New This Month",
            value: customerStats.recentCustomers,
            icon: "fas fa-user-plus",
            color: "text-orange-600",
            bg: "bg-orange-100",
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
                placeholder="Search by name, phone, or email..."
                className="input-field pl-10"
              />
            </div>
          </div>
          <div className="w-full md:w-48">
            <select
              value={customerTypeFilter}
              onChange={(e) => setCustomerTypeFilter(e.target.value)}
              className="input-field"
            >
              <option value="all">All Types</option>
              <option value="Walk-in">Walk-in</option>
              <option value="Hospital/Clinic">Hospital/Clinic</option>
              <option value="Diagnostic">Diagnostic</option>
              <option value="Wholesaler">Wholesaler</option>
            </select>
          </div>
        </div>
      </div>

      {/* Customers Table */}
      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="table-header-cell">Customer</th>
                <th className="table-header-cell">Contact</th>
                <th className="table-header-cell">Type</th>
                <th className="table-header-cell">Total Purchases</th>
                <th className="table-header-cell">Due Balance</th>
                <th className="table-header-cell">Last Purchase</th>
                <th className="table-header-cell">Joined</th>
                <th className="table-header-cell">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {customers.length === 0 ? (
                <tr>
                  <td colSpan="8" className="table-cell text-center py-8">
                    <i className="fas fa-users text-gray-400 text-4xl mb-4"></i>
                    <p className="text-gray-500">No customers found</p>
                    <button
                      onClick={() => {
                        resetForm();
                        setShowCreateModal(true);
                      }}
                      className="btn-primary mt-4"
                    >
                      Add First Customer
                    </button>
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer._id} className="hover:bg-gray-50">
                    <td className="table-cell">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <i className="fas fa-user text-blue-600"></i>
                        </div>
                        <div className="ml-3">
                          <div className="font-medium text-gray-900">
                            {customer.name}
                          </div>
                          {customer.address && (
                            <div className="text-sm text-gray-500">
                              {customer.address}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="table-cell">
                      <div className="text-sm text-gray-900">
                        {customer.phone}
                      </div>
                      {customer.email && (
                        <div className="text-sm text-gray-500">
                          {customer.email}
                        </div>
                      )}
                    </td>
                    <td className="table-cell">
                      <span
                        className={`badge ${getCustomerTypeBadge(customer.type)}`}
                      >
                        {customer.type}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className="font-medium text-gray-900">
                        {formatCurrency(customer.totalPurchases)}
                      </span>
                    </td>
                    <td className="table-cell">
                      {(customer.currentDue || 0) > 0 ? (
                        <div>
                          <span className="font-bold text-red-600">
                            {formatCurrency(customer.currentDue)}
                          </span>
                          {customer.creditEnabled && (
                            <div className="text-xs text-gray-500">
                              Limit: {formatCurrency(customer.creditLimit)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-green-600 text-sm font-medium">No due</span>
                      )}
                    </td>
                    <td className="table-cell">
                      {customer.lastPurchaseDate
                        ? formatDate(customer.lastPurchaseDate)
                        : "Never"}
                    </td>
                    <td className="table-cell">
                      {formatDate(customer.createdAt)}
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => openDetailsModal(customer)}
                          className="text-blue-600 hover:text-blue-900"
                          title="View Details"
                        >
                          <i className="fas fa-eye"></i>
                        </button>
                        <button
                          onClick={() => openEditModal(customer)}
                          className="text-green-600 hover:text-green-900"
                          title="Edit Customer"
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                        {(customer.currentDue || 0) > 0 && (
                          <button
                            onClick={() => { setSelectedCustomer(customer); setShowPaymentModal(true); }}
                            className="text-orange-600 hover:text-orange-900"
                            title="Record Payment"
                          >
                            <i className="fas fa-money-bill-wave"></i>
                          </button>
                        )}
                        <button
                          onClick={() => deleteCustomer(customer._id)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete Customer"
                        >
                          <i className="fas fa-trash"></i>
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
              {Math.min(currentPage * 20, totalCustomers)} of {totalCustomers}{" "}
              results
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => fetchCustomers(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => fetchCustomers(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Customer Modal */}
      {showCreateModal && (
        <CustomerFormModal
          title="Add New Customer"
          formData={formData}
          onInputChange={handleInputChange}
          onSubmit={createCustomer}
          onClose={() => {
            setShowCreateModal(false);
            resetForm();
          }}
          loading={loading}
        />
      )}

      {/* Edit Customer Modal */}
      {showEditModal && (
        <CustomerFormModal
          title="Edit Customer"
          formData={formData}
          onInputChange={handleInputChange}
          onSubmit={updateCustomer}
          onClose={() => {
            setShowEditModal(false);
            setSelectedCustomer(null);
            resetForm();
          }}
          loading={loading}
        />
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedCustomer && (
        <RecordPaymentModal
          customer={selectedCustomer}
          onClose={() => { setShowPaymentModal(false); setSelectedCustomer(null); }}
          onSuccess={(updatedCustomer) => {
            setCustomers((prev) =>
              prev.map((c) => c._id === updatedCustomer._id ? { ...c, ...updatedCustomer } : c)
            );
            setShowPaymentModal(false);
            setSelectedCustomer(null);
          }}
          formatCurrency={formatCurrency}
        />
      )}

      {/* Customer Details Modal */}
      {showDetailsModal && selectedCustomer && (
        <CustomerDetailsModal
          customer={selectedCustomer}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedCustomer(null);
          }}
          formatCurrency={formatCurrency}
          formatDate={formatDate}
        />
      )}
    </div>
  );
};

// Customer Form Modal Component
const CustomerFormModal = ({
  title,
  formData,
  onInputChange,
  onSubmit,
  onClose,
  loading,
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white max-w-md w-full rounded-lg shadow-2xl">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <i className="fas fa-times text-xl"></i>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Customer Name *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={onInputChange}
              className="input-field"
              placeholder="Enter customer name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number *
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={onInputChange}
              className="input-field"
              placeholder="Enter phone number"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={onInputChange}
              className="input-field"
              placeholder="Enter email address"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address
            </label>
            <textarea
              name="address"
              value={formData.address}
              onChange={onInputChange}
              rows="3"
              className="input-field"
              placeholder="Enter address"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Customer Type
            </label>
            <select
              name="type"
              value={formData.type}
              onChange={onInputChange}
              className="input-field"
            >
              <option value="Walk-in">Walk-in</option>
              <option value="Hospital/Clinic">Hospital/Clinic</option>
              <option value="Diagnostic">Diagnostic</option>
              <option value="Wholesaler">Wholesaler</option>
            </select>
          </div>

          {/* Credit Section */}
          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
              <i className="fas fa-credit-card mr-2 text-blue-500"></i>
              Credit Settings
            </h4>
            <div className="flex items-center mb-3">
              <input
                type="checkbox"
                id="creditEnabled"
                name="creditEnabled"
                checked={formData.creditEnabled || false}
                onChange={(e) => onInputChange({ target: { name: "creditEnabled", value: e.target.checked } })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="creditEnabled" className="ml-2 text-sm text-gray-700">
                Enable credit sales for this customer
              </label>
            </div>
            {formData.creditEnabled && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Credit Limit (৳)
                  <span className="ml-1 text-xs text-gray-400">0 = no credit allowed</span>
                </label>
                <input
                  type="number"
                  name="creditLimit"
                  value={formData.creditLimit || 0}
                  onChange={onInputChange}
                  min="0"
                  step="100"
                  className="input-field"
                  placeholder="e.g. 50000"
                />
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={
              loading || !formData.name.trim() || !formData.phone.trim()
            }
            className="btn-primary"
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Saving...
              </>
            ) : (
              "Save Customer"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Customer Details Modal Component
const CustomerDetailsModal = ({
  customer,
  onClose,
  formatCurrency,
  formatDate,
}) => {
  const [activeTab, setActiveTab] = useState("info");

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-lg shadow-2xl">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">
              Customer Details
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <i className="fas fa-times text-xl"></i>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4 border-b border-gray-200">
            {[
              { key: "info", label: "Info", icon: "fas fa-user" },
              { key: "history", label: "Purchase History", icon: "fas fa-shopping-cart" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <i className={tab.icon}></i>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {activeTab === "info" ? (
            <CustomerInfoTab
              customer={customer}
              formatCurrency={formatCurrency}
              formatDate={formatDate}
            />
          ) : (
            <PurchaseHistoryTab
              customer={customer}
              formatCurrency={formatCurrency}
              formatDate={formatDate}
            />
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button onClick={onClose} className="btn-primary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// Customer Info Tab
const CustomerInfoTab = ({ customer, formatCurrency, formatDate }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    <div>
      <h4 className="text-md font-semibold text-gray-900 mb-4">Contact Information</h4>
      <div className="space-y-3">
        <div><label className="text-sm font-medium text-gray-500">Name</label><p className="text-gray-900">{customer.name}</p></div>
        <div><label className="text-sm font-medium text-gray-500">Phone</label><p className="text-gray-900">{customer.phone}</p></div>
        <div><label className="text-sm font-medium text-gray-500">Email</label><p className="text-gray-900">{customer.email || "Not provided"}</p></div>
        <div><label className="text-sm font-medium text-gray-500">Address</label><p className="text-gray-900">{customer.address || "Not provided"}</p></div>
      </div>
    </div>

    <div>
      <h4 className="text-md font-semibold text-gray-900 mb-4">Customer Details</h4>
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium text-gray-500">Type</label>
          <p className="text-gray-900">
            <span className={`badge ${getCustomerTypeBadge(customer.type)}`}>
              {customer.type}
            </span>
          </p>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-500">Total Purchases</label>
          <p className="text-gray-900 font-semibold">{formatCurrency(customer.totalPurchases)}</p>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-500">Last Purchase</label>
          <p className="text-gray-900">{customer.lastPurchaseDate ? formatDate(customer.lastPurchaseDate) : "Never"}</p>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-500">Customer Since</label>
          <p className="text-gray-900">{formatDate(customer.createdAt)}</p>
        </div>
      </div>

      {/* Credit section */}
      <div className="mt-4 p-3 rounded-lg border border-gray-200 bg-gray-50">
        <h5 className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
          <i className="fas fa-credit-card mr-2 text-blue-500"></i>
          Credit Account
        </h5>
        {customer.creditEnabled ? (
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Credit Limit</span>
              <span className="font-medium">{formatCurrency(customer.creditLimit)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Outstanding Due</span>
              <span className={`font-bold ${(customer.currentDue || 0) > 0 ? "text-red-600" : "text-green-600"}`}>
                {formatCurrency(customer.currentDue)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Available Credit</span>
              <span className="font-medium text-green-600">
                {formatCurrency(Math.max(0, (customer.creditLimit || 0) - (customer.currentDue || 0)))}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Credit not enabled for this customer.</p>
        )}
      </div>
    </div>
  </div>
);

// Purchase History Tab — lazy-loads on first render
const PurchaseHistoryTab = ({ customer, formatCurrency, formatDate }) => {
  const defaultStart = new Date();
  defaultStart.setDate(defaultStart.getDate() - 30);

  const [purchases, setPurchases] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [startDate, setStartDate] = useState(
    defaultStart.toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const fetchHistory = async (p = 1, start = startDate, end = endDate) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: p,
        limit: 10,
        startDate: start,
        endDate: end,
      });
      const response = await api.get(
        `/customers/${customer._id}/purchase-history?${params}`
      );
      if (response.success) {
        setPurchases(response.purchases);
        setSummary(response.customer);
        setPagination(response.pagination);
        setPage(p);
      } else {
        setError(response.message || "Failed to load purchase history");
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error("Purchase history error:", err);
      }
      setError("Failed to load purchase history");
    } finally {
      setLoading(false);
    }
  };

  // Lazy load on first render of this tab
  useEffect(() => {
    fetchHistory(1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFilter = () => fetchHistory(1, startDate, endDate);

  return (
    <div className="space-y-4">
      {/* Summary row */}
      {summary && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-xs text-blue-600 font-medium">Total Spent (All Time)</p>
            <p className="text-lg font-bold text-blue-800">
              {formatCurrency(summary.totalSpent)}
            </p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <p className="text-xs text-green-600 font-medium">Total Orders (All Time)</p>
            <p className="text-lg font-bold text-green-800">{summary.totalOrders}</p>
          </div>
        </div>
      )}

      {/* Date range filter */}
      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="input-field text-sm py-1.5"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="input-field text-sm py-1.5"
          />
        </div>
        <button
          onClick={handleFilter}
          disabled={loading}
          className="btn-primary text-sm py-1.5 px-3"
        >
          <i className="fas fa-filter mr-1"></i>
          Apply
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
          <i className="fas fa-exclamation-circle mr-1"></i>{error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner size="md" />
        </div>
      ) : purchases.length === 0 ? (
        /* Empty state */
        <div className="text-center py-10 bg-gray-50 rounded-lg">
          <i className="fas fa-shopping-cart text-gray-300 text-4xl mb-3"></i>
          <p className="text-gray-500 font-medium">No purchases found</p>
          <p className="text-sm text-gray-400 mt-1">
            Try adjusting the date range filter
          </p>
        </div>
      ) : (
        /* Purchases table */
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-3 py-2 font-medium text-gray-600">Date</th>
                <th className="px-3 py-2 font-medium text-gray-600">Invoice</th>
                <th className="px-3 py-2 font-medium text-gray-600">Items</th>
                <th className="px-3 py-2 font-medium text-gray-600 text-right">Total</th>
                <th className="px-3 py-2 font-medium text-gray-600">Payment</th>
                <th className="px-3 py-2 font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {purchases.map((purchase) => (
                <tr key={purchase.saleId} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                    {formatDate(purchase.date)}
                  </td>
                  <td className="px-3 py-2 text-blue-600 font-mono text-xs">
                    {purchase.invoiceNo}
                  </td>
                  <td className="px-3 py-2 text-gray-600 max-w-[180px]">
                    <div className="truncate" title={
                      purchase.items.map((i) => `${i.productName} ×${i.qty}`).join(", ")
                    }>
                      {purchase.items.length === 0
                        ? "—"
                        : purchase.items.length === 1
                          ? `${purchase.items[0].productName} ×${purchase.items[0].qty}`
                          : `${purchase.items[0].productName} ×${purchase.items[0].qty} +${purchase.items.length - 1} more`
                      }
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-gray-900 whitespace-nowrap">
                    {formatCurrency(purchase.total)}
                  </td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                    {purchase.paymentMethod}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      purchase.status === "Paid"
                        ? "bg-green-100 text-green-800"
                        : purchase.status === "Pending"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-gray-100 text-gray-700"
                    }`}>
                      {purchase.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!loading && pagination.pages > 1 && (
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            {pagination.total} purchase{pagination.total !== 1 ? "s" : ""} found
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchHistory(page - 1, startDate, endDate)}
              disabled={page === 1 || loading}
              className="px-2 py-1 text-xs border border-gray-300 rounded disabled:opacity-40 hover:bg-gray-50"
            >
              ‹ Prev
            </button>
            <span className="text-xs text-gray-600">
              {page} / {pagination.pages}
            </span>
            <button
              onClick={() => fetchHistory(page + 1, startDate, endDate)}
              disabled={page === pagination.pages || loading}
              className="px-2 py-1 text-xs border border-gray-300 rounded disabled:opacity-40 hover:bg-gray-50"
            >
              Next ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;

// ── Record Payment Modal ──────────────────────────────────────────────────────
const RecordPaymentModal = ({ customer, onClose, onSuccess, formatCurrency }) => {
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const currentDue = customer.currentDue || 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const pay = parseFloat(amount);
    if (!pay || pay <= 0) { setError("Enter a valid amount"); return; }
    if (pay > currentDue) { setError(`Amount cannot exceed outstanding due of ${formatCurrency(currentDue)}`); return; }

    setLoading(true);
    setError("");
    try {
      const response = await api.post(`/customers/${customer._id}/payment`, {
        amount: pay,
        paymentMethod,
        note,
      });
      if (response.success) {
        onSuccess(response.data.customer);
      } else {
        setError(response.message || "Failed to record payment");
      }
    } catch (err) {
      setError(err.message || "Failed to record payment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white max-w-md w-full rounded-lg shadow-2xl">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <i className="fas fa-money-bill-wave mr-2 text-green-600"></i>
            Record Payment
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Customer due summary */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-orange-800">{customer.name}</p>
                <p className="text-xs text-orange-600">Outstanding due</p>
              </div>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(currentDue)}</p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Amount (৳) *
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="0.01"
                max={currentDue}
                step="0.01"
                className="input-field"
                placeholder={`Max: ${formatCurrency(currentDue)}`}
                required
                autoFocus
              />
              <button
                type="button"
                onClick={() => setAmount(currentDue.toString())}
                className="mt-1 text-xs text-blue-600 hover:underline"
              >
                Pay full amount ({formatCurrency(currentDue)})
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Method *
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="input-field"
              >
                <option value="cash">Cash</option>
                <option value="bank">Bank Transfer</option>
                <option value="card">Card</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Note (optional)
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="input-field"
                placeholder="e.g. Payment for invoice INV-001"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button type="button" onClick={onClose} className="btn-secondary" disabled={loading}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={loading || !amount}>
                {loading ? (
                  <><LoadingSpinner size="sm" className="mr-2" />Recording...</>
                ) : (
                  <><i className="fas fa-check mr-2"></i>Record Payment</>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
