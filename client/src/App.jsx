import React, { lazy, Suspense, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import { PERMISSIONS } from "./utils/permissions";

// Eagerly load critical pages
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";

// Lazy load other pages
const Sales = lazy(() => import("./pages/Sales"));
const SalesHistory = lazy(() => import("./pages/SalesHistory"));
const Products = lazy(() => import("./pages/Products"));
const Purchases = lazy(() => import("./pages/Purchases"));
const Customers = lazy(() => import("./pages/Customers"));
const Returns = lazy(() => import("./pages/Returns"));
const FinancialReports = lazy(() => import("./pages/FinancialReports"));
const Settings = lazy(() => import("./pages/Settings"));
const StockReport = lazy(() => import("./pages/StockReport"));
const ExpenseCategories = lazy(() => import("./pages/ExpenseCategories"));
const ExpensesPage = lazy(() => import("./pages/ExpensesPage"));
const AddExpensePage = lazy(() => import("./pages/AddExpensePage"));
const EditExpensePage = lazy(() => import("./pages/EditExpensePage"));
const SMSDashboard = lazy(() => import("./pages/SMSDashboard"));
const EmailDashboard = lazy(() => import("./pages/EmailDashboard"));
const NotificationSettings = lazy(() => import("./pages/NotificationSettings"));

// Components
import { Layout, LoadingSpinner, ProtectedRoute } from "./components";

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <LoadingSpinner size="lg" />
  </div>
);

/**
 * Main Application Component
 * Handles routing and role-based access control
 * Uses lazy loading for better performance
 */
function App() {
  const { user, loading } = useAuth();

  // Keep Render backend alive — smart ping during business hours only
  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL || '/api';
    const baseUrl = apiUrl.replace(/\/api\/?$/, '');
    
    const ping = async () => {
      // Only ping during business hours (8am-10pm local time) to save resources
      const hour = new Date().getHours();
      if (hour >= 8 && hour <= 22) {
        try {
          await fetch(`${baseUrl}/health`, { method: 'GET' });
          if (import.meta.env.DEV) {
            console.log('[Keep-Alive] Backend pinged at', new Date().toLocaleTimeString());
          }
        } catch (error) {
          console.warn('[Keep-Alive] Ping failed:', error.message);
        }
      }
    };
    
    ping(); // Initial ping on app load
    const interval = setInterval(ping, 10 * 60 * 1000); // Every 10 minutes
    
    // Also ping when tab becomes visible (user returns to app)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        ping();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  if (loading) {
    return <PageLoader />;
  }

  return (
    <div className="App">
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public Routes */}
          <Route
            path="/login"
            element={!user ? <Login /> : <Navigate to="/dashboard" replace />}
          />

          {/* Protected Routes - Require Authentication */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            {/* Redirect root to dashboard */}
            <Route index element={<Navigate to="/dashboard" replace />} />

            {/* Dashboard */}
            <Route path="dashboard" element={<Dashboard />} />

            {/* Sales & POS - Requires CREATE_SALE permission */}
            <Route
              path="sales"
              element={
                <ProtectedRoute permission={PERMISSIONS.CREATE_SALE}>
                  <Sales />
                </ProtectedRoute>
              }
            />

            {/* Sales History - Requires VIEW_SALES permission */}
            <Route
              path="sales-history"
              element={
                <ProtectedRoute permission={PERMISSIONS.VIEW_SALES}>
                  <SalesHistory />
                </ProtectedRoute>
              }
            />

            {/* Products - Requires VIEW_PRODUCTS permission */}
            <Route
              path="products"
              element={
                <ProtectedRoute permission={PERMISSIONS.VIEW_PRODUCTS}>
                  <Products />
                </ProtectedRoute>
              }
            />

            {/* Purchases - Requires VIEW_PURCHASES permission */}
            <Route
              path="purchases"
              element={
                <ProtectedRoute permission={PERMISSIONS.VIEW_PURCHASES}>
                  <Purchases />
                </ProtectedRoute>
              }
            />

            {/* Customers - Requires VIEW_CUSTOMERS permission */}
            <Route
              path="customers"
              element={
                <ProtectedRoute permission={PERMISSIONS.VIEW_CUSTOMERS}>
                  <Customers />
                </ProtectedRoute>
              }
            />

            {/* Returns - Requires VIEW_RETURNS permission */}
            <Route
              path="returns"
              element={
                <ProtectedRoute permission={PERMISSIONS.VIEW_RETURNS}>
                  <Returns />
                </ProtectedRoute>
              }
            />

            {/* Stock Report - Requires VIEW_STOCK permission */}
            <Route
              path="stock-report"
              element={
                <ProtectedRoute permission={PERMISSIONS.VIEW_STOCK}>
                  <StockReport />
                </ProtectedRoute>
              }
            />

            {/* Expense Categories - Requires VIEW_EXPENSE_CATEGORIES permission */}
            <Route
              path="expense-categories"
              element={
                <ProtectedRoute permission={PERMISSIONS.VIEW_EXPENSE_CATEGORIES}>
                  <ExpenseCategories />
                </ProtectedRoute>
              }
            />

            {/* Expenses List - Requires VIEW_EXPENSES permission */}
            <Route
              path="expenses"
              element={
                <ProtectedRoute permission={PERMISSIONS.VIEW_EXPENSES}>
                  <ExpensesPage />
                </ProtectedRoute>
              }
            />

            {/* Add Expense - Requires CREATE_EXPENSE permission */}
            <Route
              path="expenses/add"
              element={
                <ProtectedRoute permission={PERMISSIONS.CREATE_EXPENSE}>
                  <AddExpensePage />
                </ProtectedRoute>
              }
            />

            {/* Edit Expense - Requires EDIT_EXPENSE permission */}
            <Route
              path="expenses/edit/:id"
              element={
                <ProtectedRoute permission={PERMISSIONS.EDIT_EXPENSE}>
                  <EditExpensePage />
                </ProtectedRoute>
              }
            />

            {/* Financial Reports - Requires VIEW_SALES_REPORT or VIEW_PROFIT_REPORT */}
            <Route
              path="financial-reports"
              element={
                <ProtectedRoute
                  permissions={[
                    PERMISSIONS.VIEW_SALES_REPORT,
                    PERMISSIONS.VIEW_PROFIT_REPORT,
                  ]}
                >
                  <FinancialReports />
                </ProtectedRoute>
              }
            />

            {/* Settings - Requires VIEW_SETTINGS permission */}
            <Route
              path="settings"
              element={
                <ProtectedRoute permission={PERMISSIONS.VIEW_SETTINGS}>
                  <Settings />
                </ProtectedRoute>
              }
            />

            {/* SMS Dashboard - Requires VIEW_SETTINGS permission */}
            <Route
              path="sms"
              element={
                <ProtectedRoute permission={PERMISSIONS.VIEW_SETTINGS}>
                  <SMSDashboard />
                </ProtectedRoute>
              }
            />

            {/* Email Dashboard - Requires VIEW_SETTINGS permission */}
            <Route
              path="email"
              element={
                <ProtectedRoute permission={PERMISSIONS.VIEW_SETTINGS}>
                  <EmailDashboard />
                </ProtectedRoute>
              }
            />

            {/* Notification Settings - Requires VIEW_SETTINGS permission */}
            <Route
              path="notification-settings"
              element={
                <ProtectedRoute permission={PERMISSIONS.VIEW_SETTINGS}>
                  <NotificationSettings />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Catch all route - Redirect to dashboard */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </div>
  );
}

export default App;
