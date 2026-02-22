import React, { useState, useEffect } from "react";
import { apiService } from "../services/api";
import { useFirebaseAuth as useAuth } from "../contexts/FirebaseAuthContext";
import LoadingSpinner from "./LoadingSpinner";

const UserManagement = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [users, setUsers] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "STAFF",
    isActive: true,
  });

  // Fetch users
  const fetchUsers = async () => {
    try {
      setLoading(true);
      // Use test endpoint temporarily
      const response = await fetch("/api/test/users").then((r) => r.json());
      if (response.success) {
        setUsers(response.data || []);
      }
    } catch (error) {
      console.error("Users fetch error:", error);
      setError("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchUsers();
  }, []);

  // Handle form changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      password: "",
      role: "STAFF",
      isActive: true,
    });
  };

  // Create user
  const createUser = async () => {
    if (
      !formData.name.trim() ||
      !formData.email.trim() ||
      !formData.password.trim()
    ) {
      setError("Name, email, and password are required");
      return;
    }

    try {
      setSaving(true);
      // Use test endpoint temporarily
      const response = await fetch("/api/test/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      }).then((r) => r.json());

      if (response.success) {
        setShowCreateModal(false);
        resetForm();
        fetchUsers();
        setSuccess("User created successfully!");
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(response.message || "Failed to create user");
      }
    } catch (error) {
      setError("Failed to create user");
    } finally {
      setSaving(false);
    }
  };

  // Update user
  const updateUser = async () => {
    if (!formData.name.trim() || !formData.email.trim()) {
      setError("Name and email are required");
      return;
    }

    try {
      setSaving(true);
      const updateData = { ...formData };
      if (!updateData.password) {
        delete updateData.password; // Don't update password if empty
      }

      // Use test endpoint temporarily
      const response = await fetch(`/api/test/users/${selectedUser._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      }).then((r) => r.json());

      if (response.success) {
        setShowEditModal(false);
        setSelectedUser(null);
        resetForm();
        fetchUsers();
        setSuccess("User updated successfully!");
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(response.message || "Failed to update user");
      }
    } catch (error) {
      setError("Failed to update user");
    } finally {
      setSaving(false);
    }
  };

  // Delete user
  const deleteUser = async (userId) => {
    if (!confirm("Are you sure you want to delete this user?")) {
      return;
    }

    try {
      setSaving(true);
      // Use test endpoint temporarily
      const response = await fetch(`/api/test/users/${userId}`, {
        method: "DELETE",
      }).then((r) => r.json());

      if (response.success) {
        fetchUsers();
        setSuccess("User deleted successfully!");
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(response.message || "Failed to delete user");
      }
    } catch (error) {
      setError("Failed to delete user");
    } finally {
      setSaving(false);
    }
  };

  // Toggle user status
  const toggleUserStatus = async (userId, currentStatus) => {
    try {
      setSaving(true);
      // Use test endpoint temporarily
      const response = await fetch(`/api/test/users/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isActive: !currentStatus }),
      }).then((r) => r.json());

      if (response.success) {
        fetchUsers();
        setSuccess(
          `User ${!currentStatus ? "activated" : "deactivated"} successfully!`,
        );
        setTimeout(() => setSuccess(""), 3000);
      }
    } catch (error) {
      setError("Failed to update user status");
    } finally {
      setSaving(false);
    }
  };

  // Open edit modal
  const openEditModal = (userToEdit) => {
    setSelectedUser(userToEdit);
    setFormData({
      name: userToEdit.name,
      email: userToEdit.email,
      password: "", // Don't pre-fill password
      role: userToEdit.role,
      isActive: userToEdit.isActive,
    });
    setShowEditModal(true);
  };

  // Get role badge
  const getRoleBadge = (role) => {
    const badges = {
      SUPER_ADMIN: "bg-purple-100 text-purple-800",
      SHOP_ADMIN: "bg-blue-100 text-blue-800",
      STAFF: "bg-green-100 text-green-800",
    };
    return badges[role] || "bg-gray-100 text-gray-800";
  };

  // Format date
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            User Management
          </h3>
          <p className="text-sm text-gray-600">
            Manage staff accounts and permissions
          </p>
        </div>
        {user?.role === "SHOP_ADMIN" && (
          <button
            onClick={() => {
              resetForm();
              setShowCreateModal(true);
            }}
            className="btn-primary flex items-center gap-2"
          >
            <i className="fas fa-plus"></i>
            Add User
          </button>
        )}
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

      {/* Users Table */}
      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="table-header-cell">User</th>
                <th className="table-header-cell">Email</th>
                <th className="table-header-cell">Role</th>
                <th className="table-header-cell">Status</th>
                <th className="table-header-cell">Created</th>
                <th className="table-header-cell">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.length === 0 ? (
                <tr>
                  <td colSpan="6" className="table-cell text-center py-8">
                    <i className="fas fa-users text-gray-400 text-4xl mb-4"></i>
                    <p className="text-gray-500">No users found</p>
                  </td>
                </tr>
              ) : (
                users.map((userItem) => (
                  <tr key={userItem._id} className="hover:bg-gray-50">
                    <td className="table-cell">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <i className="fas fa-user text-blue-600"></i>
                        </div>
                        <div className="ml-3">
                          <div className="font-medium text-gray-900">
                            {userItem.name}
                          </div>
                          {userItem._id === user?.id && (
                            <div className="text-xs text-blue-600">(You)</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className="text-sm text-gray-900">
                        {userItem.email}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${getRoleBadge(userItem.role)}`}>
                        {userItem.role.replace("_", " ")}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span
                        className={`badge ${
                          userItem.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {userItem.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className="text-sm text-gray-600">
                        {formatDate(userItem.createdAt)}
                      </span>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center space-x-2">
                        {user?.role === "SHOP_ADMIN" &&
                          userItem._id !== user?.id && (
                            <>
                              <button
                                onClick={() => openEditModal(userItem)}
                                className="text-blue-600 hover:text-blue-900"
                                title="Edit User"
                              >
                                <i className="fas fa-edit"></i>
                              </button>
                              <button
                                onClick={() =>
                                  toggleUserStatus(
                                    userItem._id,
                                    userItem.isActive,
                                  )
                                }
                                className={`${
                                  userItem.isActive
                                    ? "text-orange-600 hover:text-orange-900"
                                    : "text-green-600 hover:text-green-900"
                                }`}
                                title={
                                  userItem.isActive ? "Deactivate" : "Activate"
                                }
                              >
                                <i
                                  className={`fas ${userItem.isActive ? "fa-pause" : "fa-play"}`}
                                ></i>
                              </button>
                              <button
                                onClick={() => deleteUser(userItem._id)}
                                className="text-red-600 hover:text-red-900"
                                title="Delete User"
                              >
                                <i className="fas fa-trash"></i>
                              </button>
                            </>
                          )}
                        {user?.role !== "SHOP_ADMIN" && (
                          <span className="text-gray-400 text-sm">
                            No actions
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <UserFormModal
          title="Add New User"
          formData={formData}
          onInputChange={handleInputChange}
          onSubmit={createUser}
          onClose={() => {
            setShowCreateModal(false);
            resetForm();
          }}
          saving={saving}
          isEdit={false}
        />
      )}

      {/* Edit User Modal */}
      {showEditModal && (
        <UserFormModal
          title="Edit User"
          formData={formData}
          onInputChange={handleInputChange}
          onSubmit={updateUser}
          onClose={() => {
            setShowEditModal(false);
            setSelectedUser(null);
            resetForm();
          }}
          saving={saving}
          isEdit={true}
        />
      )}
    </div>
  );
};

// User Form Modal Component
const UserFormModal = ({
  title,
  formData,
  onInputChange,
  onSubmit,
  onClose,
  saving,
  isEdit,
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
              Full Name *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={onInputChange}
              className="input-field"
              placeholder="Enter full name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address *
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={onInputChange}
              className="input-field"
              placeholder="Enter email address"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password {isEdit ? "(leave blank to keep current)" : "*"}
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={onInputChange}
              className="input-field"
              placeholder={isEdit ? "Enter new password" : "Enter password"}
              required={!isEdit}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role *
            </label>
            <select
              name="role"
              value={formData.role}
              onChange={onInputChange}
              className="input-field"
              required
            >
              <option value="STAFF">Staff</option>
              <option value="SHOP_ADMIN">Shop Admin</option>
            </select>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              name="isActive"
              checked={formData.isActive}
              onChange={onInputChange}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label className="ml-2 text-sm font-medium text-gray-700">
              Active User
            </label>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={saving || !formData.name.trim() || !formData.email.trim()}
            className="btn-primary"
          >
            {saving ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                {isEdit ? "Updating..." : "Creating..."}
              </>
            ) : (
              <>
                <i className={`fas ${isEdit ? "fa-save" : "fa-plus"} mr-2`}></i>
                {isEdit ? "Update User" : "Create User"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
