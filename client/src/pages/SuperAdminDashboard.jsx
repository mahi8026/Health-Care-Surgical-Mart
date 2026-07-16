import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../config/api";
import LoadingSpinner from "../components/LoadingSpinner";

/**
 * Super Admin Dashboard
 * Platform-level management dashboard for SUPER_ADMIN role
 * Shows: shops list, platform stats, user management, system health
 * Does NOT show: shop operational data (sales, inventory, POS)
 */
const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const [shops, setShops] = useState([]);
  const [platformStats, setPlatformStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Fetch platform data
  const fetchPlatformData = async () => {
    try {
      // Fetch all shops
      const shopsResponse = await api.get("/super-admin/shops");
      
      // Fetch platform-level dashboard stats
      const statsResponse = await api.get("/super-admin/dashboard");

      if (shopsResponse.success) {
        setShops(shopsResponse.data || []);
      }

      if (statsResponse.success) {
        setPlatformStats(statsResponse.data);
      }

      setError("");
    } catch (error) {
      console.error("Platform data error:", error);
      if (
        error.message?.includes("401") ||
        error.message?.includes("Authentication")
      ) {
        setError("Session expired. Please login again.");
        setTimeout(() => (window.location.href = "/login"), 2000);
      } else {
        setError("Failed to load platform data");
      }
    }
  };

  // Initial data load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchPlatformData();
      setLoading(false);
    };
    loadData();
  }, []);

  // Refresh data
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchPlatformData();
    setRefreshing(false);
  };

  // Get status badge color
  const getStatusColor = (status) => {
    switch (status) {
      case "Active":
        return "bg-green-100 text-green-800";
      case "Suspended":
        return "bg-red-100 text-red-800";
      case "Inactive":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
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
            Platform Dashboard
          </h1>
          <p className="text-gray-600 mt-1">
            System-wide management and monitoring
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="btn-primary flex items-center gap-2"
        >
          <i
            className={`fas fa-sync-alt ${refreshing ? "animate-spin" : ""}`}
          ></i>
          {refreshing ? "Refreshing..." : "Refresh Data"}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <div className="flex items-center">
            <i className="fas fa-exclamation-circle mr-2"></i>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Platform Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            title: "Total Shops",
            value: platformStats?.totalShops || shops.length || 0,
            subtitle: `${platformStats?.activeShops || 0} active`,
            icon: "fas fa-store",
            bgColor: "bg-blue-100",
            textColor: "text-blue-600",
            trend: `${platformStats?.activeShops || 0} active`,
            trendUp: true,
          },
          {
            title: "Total Users",
            value: platformStats?.totalUsers || 0,
            subtitle: `${platformStats?.activeUsers || 0} active`,
            icon: "fas fa-users",
            bgColor: "bg-green-100",
            textColor: "text-green-600",
            trend: `${platformStats?.activeUsers || 0} active`,
            trendUp: true,
          },
          {
            title: "System Health",
            value: platformStats?.systemHealth || "Good",
            subtitle: "All services running",
            icon: "fas fa-heartbeat",
            bgColor: "bg-purple-100",
            textColor: "text-purple-600",
            trend: "Healthy",
            trendUp: true,
          },
          {
            title: "Database Status",
            value: platformStats?.databaseStatus || "Connected",
            subtitle: `${platformStats?.totalCollections || 0} collections`,
            icon: "fas fa-database",
            bgColor: "bg-indigo-100",
            textColor: "text-indigo-600",
            trend: "Online",
            trendUp: true,
          },
        ].map((stat, index) => (
          <div key={index} className="card hover:shadow-lg transition-shadow">
            <div className="flex flex-col">
              {/* Icon and Title */}
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2.5 rounded-lg ${stat.bgColor}`}>
                  <i className={`${stat.icon} ${stat.textColor} text-lg`}></i>
                </div>
                <span
                  className={`text-xs font-medium ${
                    stat.trendUp ? "text-green-600" : "text-gray-600"
                  }`}
                >
                  {stat.trend}
                </span>
              </div>

              {/* Content */}
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-600 mb-1 truncate">
                  {stat.title}
                </p>
                <p
                  className="text-xl font-bold text-gray-900 mb-1 truncate"
                  title={stat.value}
                >
                  {stat.value}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {stat.subtitle}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Shops List */}
      <div className="card">
        <div className="card-header">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                All Shops
                <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {shops.length}
                </span>
              </h3>
              <p className="text-sm text-gray-600">Manage all registered shops</p>
            </div>
            <button
              onClick={() => {
                // TODO: Implement create shop modal/page
                alert("Create shop functionality coming soon");
              }}
              className="btn-primary"
            >
              <i className="fas fa-plus mr-2"></i>
              Create Shop
            </button>
          </div>
        </div>

        {shops.length === 0 ? (
          <div className="text-center py-12">
            <i className="fas fa-store text-gray-400 text-5xl mb-4"></i>
            <p className="text-gray-500 text-lg mb-2">No shops registered</p>
            <p className="text-gray-400 text-sm mb-4">
              Create your first shop to get started
            </p>
            <button
              onClick={() => alert("Create shop functionality coming soon")}
              className="btn-primary"
            >
              <i className="fas fa-plus mr-2"></i>
              Create First Shop
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Shop
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Owner
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Plan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {shops.map((shop) => (
                  <tr key={shop.shopId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <i className="fas fa-store text-blue-600"></i>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {shop.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {shop.shopId}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {shop.ownerEmail}
                      </div>
                      {shop.phone && (
                        <div className="text-sm text-gray-500">{shop.phone}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                          shop.status
                        )}`}
                      >
                        {shop.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {shop.subscriptionPlan || "basic"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {shop.createdAt
                        ? new Date(shop.createdAt).toLocaleDateString()
                        : "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => {
                          // TODO: Implement view shop details
                          alert(`View details for ${shop.name}`);
                        }}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        <i className="fas fa-eye"></i>
                      </button>
                      <button
                        onClick={() => {
                          // TODO: Implement edit shop
                          alert(`Edit ${shop.name}`);
                        }}
                        className="text-indigo-600 hover:text-indigo-900 mr-3"
                      >
                        <i className="fas fa-edit"></i>
                      </button>
                      <button
                        onClick={() => {
                          // TODO: Implement toggle shop status
                          if (
                            confirm(
                              `Are you sure you want to ${
                                shop.status === "Active" ? "suspend" : "activate"
                              } ${shop.name}?`
                            )
                          ) {
                            alert("Status toggle functionality coming soon");
                          }
                        }}
                        className={`${
                          shop.status === "Active"
                            ? "text-red-600 hover:text-red-900"
                            : "text-green-600 hover:text-green-900"
                        }`}
                      >
                        <i
                          className={`fas fa-${
                            shop.status === "Active" ? "ban" : "check-circle"
                          }`}
                        ></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
          <p className="text-sm text-gray-600">Platform management shortcuts</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              title: "User Management",
              icon: "fas fa-users-cog",
              color: "bg-blue-500 hover:bg-blue-600",
              onClick: () => navigate("/settings"),
            },
            {
              title: "System Settings",
              icon: "fas fa-cog",
              color: "bg-purple-500 hover:bg-purple-600",
              onClick: () => navigate("/settings"),
            },
            {
              title: "Database List",
              icon: "fas fa-database",
              color: "bg-green-500 hover:bg-green-600",
              onClick: () => alert("Database list functionality coming soon"),
            },
            {
              title: "Audit Logs",
              icon: "fas fa-clipboard-list",
              color: "bg-orange-500 hover:bg-orange-600",
              onClick: () => alert("Audit logs functionality coming soon"),
            },
          ].map((action, index) => (
            <button
              key={index}
              onClick={action.onClick}
              className={`${action.color} text-white p-4 rounded-lg text-center transition-colors`}
            >
              <i className={`${action.icon} text-2xl mb-2`}></i>
              <p className="text-sm font-medium">{action.title}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
