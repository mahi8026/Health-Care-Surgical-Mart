import React, { useState } from "react";
import { useFirebaseAuth } from "../hooks/useFirebaseAuth";

/**
 * Firebase Login Component
 * Example implementation of Firebase Email/Password authentication
 */
const FirebaseLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const { signIn, signUp, forgotPassword, loading } = useFirebaseAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: "", text: "" });

    if (showForgotPassword) {
      // Handle forgot password
      const result = await forgotPassword(email);
      setMessage({
        type: result.success ? "success" : "error",
        text: result.message,
      });
      if (result.success) {
        setShowForgotPassword(false);
      }
      return;
    }

    if (isSignUp) {
      // Handle sign up
      if (!displayName.trim()) {
        setMessage({ type: "error", text: "Please enter your name" });
        return;
      }
      const result = await signUp(email, password, displayName);
      setMessage({
        type: result.success ? "success" : "error",
        text: result.message,
      });
    } else {
      // Handle sign in
      const result = await signIn(email, password);
      if (result.success) {
        setMessage({ type: "success", text: "Signed in successfully!" });
        // Redirect or update UI as needed
      } else {
        setMessage({ type: "error", text: result.message });
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-lg">
        {/* Header */}
        <div>
          <h2 className="text-center text-3xl font-bold text-gray-900">
            {showForgotPassword
              ? "Reset Password"
              : isSignUp
                ? "Create Account"
                : "Sign In"}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {showForgotPassword
              ? "Enter your email to receive a password reset link"
              : isSignUp
                ? "Sign up with your email and password"
                : "Sign in to your account"}
          </p>
        </div>

        {/* Message */}
        {message.text && (
          <div
            className={`p-4 rounded-lg ${
              message.type === "success"
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            <div className="flex items-center">
              <i
                className={`fas ${
                  message.type === "success"
                    ? "fa-check-circle"
                    : "fa-exclamation-circle"
                } mr-2`}
              ></i>
              <span>{message.text}</span>
            </div>
          </div>
        )}

        {/* Form */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Display Name (Sign Up only) */}
            {isSignUp && !showForgotPassword && (
              <div>
                <label
                  htmlFor="displayName"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Full Name
                </label>
                <input
                  id="displayName"
                  name="displayName"
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="John Doe"
                />
              </div>
            )}

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="you@example.com"
              />
            </div>

            {/* Password */}
            {!showForgotPassword && (
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="••••••••"
                />
                {isSignUp && (
                  <p className="mt-1 text-xs text-gray-500">
                    Must be at least 6 characters
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Forgot Password Link */}
          {!isSignUp && !showForgotPassword && (
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-sm text-green-600 hover:text-green-500"
              >
                Forgot password?
              </button>
            </div>
          )}

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center">
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Processing...
                </span>
              ) : showForgotPassword ? (
                "Send Reset Link"
              ) : isSignUp ? (
                "Create Account"
              ) : (
                "Sign In"
              )}
            </button>
          </div>

          {/* Toggle Sign Up/Sign In */}
          <div className="text-center">
            {showForgotPassword ? (
              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(false);
                  setMessage({ type: "", text: "" });
                }}
                className="text-sm text-green-600 hover:text-green-500"
              >
                Back to Sign In
              </button>
            ) : (
              <p className="text-sm text-gray-600">
                {isSignUp
                  ? "Already have an account? "
                  : "Don't have an account? "}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setMessage({ type: "", text: "" });
                  }}
                  className="font-medium text-green-600 hover:text-green-500"
                >
                  {isSignUp ? "Sign In" : "Sign Up"}
                </button>
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default FirebaseLogin;
