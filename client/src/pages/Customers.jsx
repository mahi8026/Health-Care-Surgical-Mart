import React, { useState, useEffect } from "react";
import { apiService } from "../services/api";
import LoadingSpinner from "../components/LoadingSpinner";

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
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
    type: "Retail",
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
      // Use the working test endpoint temporarily
      const response = await fetch("http://localhost:5000/api/test/customers");
      const data = await response.json();

      if (data.success) {
        let filteredCustomers = data.data;

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
        calculateStats(data.data);
      } else {
        setError("Failed to fetch customers");
      }
    } catch (error) {
      console.error("Fetch customers error:", error);
      setError("Failed to fetch customers");
    }
  };

  // Calculate customer statistics
  const calculateStats = (customerData) => {
    const stats = {
      totalCustomers: customerData.length,
      retailCustomers: customerData.filter((c) => c.type === "Retail").length,
      wholesaleCustomers: customerData.filter((c) => c.type === "Wholesale")
        .length,
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
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-BD", {
      style: "currency",
      currency: "BDT",
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

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
      type: "Retail",
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
      const response = await apiService.post("/customers", formData);
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
      const response = await apiService.put(
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
      const response = await apiService.delete(`/customers/${customerId}`);
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
      Retail: "bg-blue-100 text-blue-800",
      Wholesale: "bg-purple-100 text-purple-800",
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
              <option value="Retail">Retail</option>
              <option value="Wholesale">Wholesale</option>
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
                <th className="table-header-cell">Last Purchase</th>
                <th className="table-header-cell">Joined</th>
                <th className="table-header-cell">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {customers.length === 0 ? (
                <tr>
                  <td colSpan="7" className="table-cell text-center py-8">
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
              <option value="Retail">Retail</option>
              <option value="Wholesale">Wholesale</option>
            </select>
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
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white max-w-2xl w-full max-h-screen overflow-y-auto rounded-lg shadow-2xl">
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
        </div>

        <div className="p-6 space-y-6">
          {/* Customer Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-md font-semibold text-gray-900 mb-4">
                Contact Information
              </h4>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Name
                  </label>
                  <p className="text-gray-900">{customer.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Phone
                  </label>
                  <p className="text-gray-900">{customer.phone}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Email
                  </label>
                  <p className="text-gray-900">
                    {customer.email || "Not provided"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Address
                  </label>
                  <p className="text-gray-900">
                    {customer.address || "Not provided"}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-md font-semibold text-gray-900 mb-4">
                Customer Details
              </h4>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Type
                  </label>
                  <p className="text-gray-900">
                    <span
                      className={`badge ${customer.type === "Retail" ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800"}`}
                    >
                      {customer.type}
                    </span>
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Total Purchases
                  </label>
                  <p className="text-gray-900 font-semibold">
                    {formatCurrency(customer.totalPurchases)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Last Purchase
                  </label>
                  <p className="text-gray-900">
                    {customer.lastPurchaseDate
                      ? formatDate(customer.lastPurchaseDate)
                      : "Never"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Customer Since
                  </label>
                  <p className="text-gray-900">
                    {formatDate(customer.createdAt)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Purchase History Placeholder */}
          <div>
            <h4 className="text-md font-semibold text-gray-900 mb-4">
              Recent Purchase History
            </h4>
            <div className="bg-gray-50 p-4 rounded-lg text-center">
              <i className="fas fa-shopping-cart text-gray-400 text-3xl mb-2"></i>
              <p className="text-gray-500">
                Purchase history will be displayed here
              </p>
              <p className="text-sm text-gray-400">Feature coming soon</p>
            </div>
          </div>
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

export default Customers;
