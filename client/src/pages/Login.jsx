import React, { useState } from "react";
import { useFirebaseAuth as useAuth } from "../contexts/FirebaseAuthContext";
import LoadingSpinner from "../components/LoadingSpinner";

const Login = () => {
  const [email, setEmail] = useState("john@healthcareplus.com");
  const [password, setPassword] = useState("Admin@123");
  const [shopId, setShopId] = useState("");
  const [userType, setUserType] = useState("shop_admin");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await login(
        email,
        password,
        userType !== "super_admin" && shopId.trim() ? shopId : null,
      );

      if (!result.success) {
        setError(result.message || "Login failed");
      }
    } catch (error) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleUserTypeChange = (type) => {
    setUserType(type);
    setError("");

    // Set default credentials based on user type
    if (type === "super_admin") {
      setEmail("superadmin@medicalpos.com");
      setPassword("SuperAdmin@123");
      setShopId("");
    } else if (type === "shop_admin") {
      setEmail("john@healthcareplus.com");
      setPassword("Admin@123");
      setShopId("");
    } else if (type === "staff") {
      setEmail("staff@shop.com");
      setPassword("Staff@123");
      setShopId("");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-heartbeat text-white text-2xl"></i>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Health Care Surgical Mart
          </h1>
          <p className="text-gray-600">Management System</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            <div className="flex items-center">
              <i className="fas fa-exclamation-circle mr-2"></i>
              <span>{error}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* User Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Login As
            </label>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                { key: "super_admin", label: "Super Admin", color: "blue" },
                { key: "shop_admin", label: "Shop Admin", color: "green" },
                { key: "staff", label: "Staff", color: "purple" },
              ].map(({ key, label, color }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleUserTypeChange(key)}
                  className={`py-2 px-3 text-xs font-medium rounded-md transition-colors ${
                    userType === key
                      ? `bg-blue-600 text-white`
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Shop ID Field (only for non-super admin) */}
          {userType !== "super_admin" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Shop ID <span className="text-gray-400">(Optional)</span>
              </label>
              <input
                type="text"
                value={shopId}
                onChange={(e) => setShopId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Leave empty for auto-detection"
              />
              <p className="mt-1 text-xs text-gray-500">
                Leave empty to auto-detect from your email address
              </p>
            </div>
          )}

          {/* Email Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="Enter your email"
            />
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="Enter your password"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center justify-center"
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Signing in...
              </>
            ) : (
              <>
                <i className="fas fa-sign-in-alt mr-2"></i>
                Sign In
              </>
            )}
          </button>
        </form>

        {/* Demo Credentials */}
        <div className="mt-6 text-center text-sm text-gray-600">
          <p className="font-semibold mb-2">Demo Credentials:</p>
          <div className="space-y-1 text-xs bg-gray-50 p-3 rounded-lg">
            <p>
              <strong>Super Admin:</strong> superadmin@medicalpos.com /
              SuperAdmin@123
            </p>
            <p>
              <strong>Shop Admin:</strong> john@healthcareplus.com / Admin@123
            </p>
            <p>
              <strong>Staff:</strong> staff@shop.com / Staff@123
            </p>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            (Shop ID auto-detected from email)
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
