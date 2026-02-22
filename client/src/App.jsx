import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useFirebaseAuth as useAuth } from "./contexts/FirebaseAuthContext";
import { PERMISSIONS } from "./utils/permissions";

// Pages
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Sales from "./pages/Sales";
import Products from "./pages/Products";
import Purchases from "./pages/Purchases";
import Customers from "./pages/Customers";
import Returns from "./pages/Returns";
import FinancialReports from "./pages/FinancialReports";
import Settings from "./pages/Settings";
import StockReport from "./pages/StockReport";
import ExpenseCategories from "./pages/ExpenseCategories";
import ExpensesPage from "./pages/ExpensesPage";
import AddExpensePage from "./pages/AddExpensePage";
import FirebaseAuthTest from "./pages/FirebaseAuthTest";

// Components
import { Layout, LoadingSpinner, ProtectedRoute } from "./components";

/**
 * Main Application Component
 * Handles routing and role-based access control
 */
function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="App">
      <Routes>
        {/* Public Routes */}
        <Route
          path="/login"
          element={!user ? <Login /> : <Navigate to="/dashboard" replace />}
        />

        {/* Firebase Authentication Test Page - Public for testing */}
        <Route path="/firebase-test" element={<FirebaseAuthTest />} />

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

          {/* Dashboard - Available to all authenticated users */}
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
        </Route>

        {/* Catch all route - Redirect to dashboard */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </div>
  );
}

export default App;
