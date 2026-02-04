import React, { useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  hasPermission as checkPermission,
  isAdmin,
} from "../utils/permissions";
import { getNavigationBySections } from "../config/navigation";

const Layout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Get navigation organized by sections
  const navigationSections = getNavigationBySections(user, checkPermission);

  const isActive = (path) => location.pathname === path;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // Role badge color
  const getRoleBadgeColor = (role) => {
    switch (role) {
      case "SUPER_ADMIN":
        return "bg-purple-100 text-purple-800";
      case "SHOP_ADMIN":
        return "bg-blue-100 text-blue-800";
      case "STAFF":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Format role name for display
  const formatRoleName = (role) => {
    return role
      .split("_")
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(" ");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo and Title */}
            <div className="flex items-center">
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="mr-4 text-gray-500 hover:text-gray-700 lg:hidden"
                aria-label="Toggle sidebar"
              >
                <i className="fas fa-bars text-xl"></i>
              </button>
              <i className="fas fa-heartbeat text-2xl text-blue-600 mr-3"></i>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  Health Care Surgical Mart
                </h1>
                <p className="text-xs text-gray-500 hidden sm:block">
                  Point of Sale System
                </p>
              </div>
            </div>

            {/* User Info and Actions */}
            <div className="flex items-center space-x-4">
              {/* User Info */}
              <div className="hidden md:flex items-center space-x-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {user?.name}
                  </p>
                  <p className="text-xs text-gray-500">{user?.email}</p>
                </div>
                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-medium ${getRoleBadgeColor(
                    user?.role,
                  )}`}
                >
                  {formatRoleName(user?.role)}
                </span>
              </div>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-3 py-2 text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Logout"
              >
                <i className="fas fa-sign-out-alt"></i>
                <span className="hidden sm:inline text-sm">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`${
            sidebarCollapsed ? "w-20" : "w-64"
          } bg-white shadow-sm min-h-screen transition-all duration-300 hidden lg:block`}
        >
          <nav className="p-4">
            {/* Collapse Toggle */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-full mb-4 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-sm"
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <i
                className={`fas fa-${sidebarCollapsed ? "angle-right" : "angle-left"}`}
              ></i>
              {!sidebarCollapsed && <span className="ml-2">Collapse Menu</span>}
            </button>

            {/* Navigation Sections */}
            <div className="space-y-6">
              {Object.entries(navigationSections).map(([key, section]) => (
                <div key={key}>
                  {/* Section Title */}
                  {!sidebarCollapsed && (
                    <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      {section.title}
                    </h3>
                  )}

                  {/* Section Items */}
                  <ul className="space-y-1">
                    {section.items.map((item) => (
                      <li key={item.id}>
                        <Link
                          to={item.path}
                          className={`flex items-center px-3 py-2.5 rounded-lg transition-all ${
                            isActive(item.path)
                              ? "bg-blue-50 text-blue-700 font-medium shadow-sm"
                              : "text-gray-700 hover:bg-gray-50"
                          }`}
                          title={
                            sidebarCollapsed ? item.name : item.description
                          }
                        >
                          <i
                            className={`${item.icon} ${sidebarCollapsed ? "text-lg" : "mr-3"}`}
                          ></i>
                          {!sidebarCollapsed && (
                            <span className="flex-1">{item.name}</span>
                          )}
                          {!sidebarCollapsed && item.badge && (
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full bg-${item.badge.color}-100 text-${item.badge.color}-700`}
                            >
                              {item.badge.text}
                            </span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>

                  {/* Divider */}
                  {section.items.some((item) => item.divider) && (
                    <div className="my-4 border-t border-gray-200"></div>
                  )}
                </div>
              ))}
            </div>

            {/* User Role Info (Collapsed View) */}
            {sidebarCollapsed && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex justify-center">
                  <span
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ${getRoleBadgeColor(
                      user?.role,
                    )}`}
                    title={formatRoleName(user?.role)}
                  >
                    {user?.role?.charAt(0)}
                  </span>
                </div>
              </div>
            )}
          </nav>
        </aside>

        {/* Mobile Sidebar Overlay */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          >
            <aside className="w-64 bg-white h-full shadow-lg">
              <nav className="p-4">
                {/* Mobile Menu Header */}
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-semibold text-gray-900">Menu</h2>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>

                {/* Navigation Sections */}
                <div className="space-y-6">
                  {Object.entries(navigationSections).map(([key, section]) => (
                    <div key={key}>
                      <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        {section.title}
                      </h3>
                      <ul className="space-y-1">
                        {section.items.map((item) => (
                          <li key={item.id}>
                            <Link
                              to={item.path}
                              onClick={() => setMobileMenuOpen(false)}
                              className={`flex items-center px-3 py-2.5 rounded-lg transition-all ${
                                isActive(item.path)
                                  ? "bg-blue-50 text-blue-700 font-medium"
                                  : "text-gray-700 hover:bg-gray-50"
                              }`}
                            >
                              <i className={`${item.icon} mr-3`}></i>
                              <span>{item.name}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </nav>
            </aside>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-x-hidden">
          <div className="p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
