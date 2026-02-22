import React, { useState } from "react";
import { useFirebaseAuth } from "../hooks/useFirebaseAuth";

/**
 * Firebase Authentication Test Page
 * Test all Firebase auth features
 */
const FirebaseAuthTest = () => {
  const {
    user,
    loading,
    error,
    signUp,
    signIn,
    signOut,
    forgotPassword,
    verifyEmail,
    isAuthenticated,
    isEmailVerified,
  } = useFirebaseAuth();

  const [testEmail, setTestEmail] = useState("test@example.com");
  const [testPassword, setTestPassword] = useState("Test@123");
  const [testName, setTestName] = useState("Test User");
  const [resetEmail, setResetEmail] = useState("");
  const [message, setMessage] = useState({ type: "", text: "" });

  const handleSignUp = async () => {
    setMessage({ type: "info", text: "Creating account..." });
    const result = await signUp(testEmail, testPassword, testName);
    setMessage({
      type: result.success ? "success" : "error",
      text: result.message,
    });
  };

  const handleSignIn = async () => {
    setMessage({ type: "info", text: "Signing in..." });
    const result = await signIn(testEmail, testPassword);
    setMessage({
      type: result.success ? "success" : "error",
      text: result.message,
    });
  };

  const handleSignOut = async () => {
    setMessage({ type: "info", text: "Signing out..." });
    const result = await signOut();
    setMessage({
      type: result.success ? "success" : "error",
      text: result.message,
    });
  };

  const handleForgotPassword = async () => {
    if (!resetEmail) {
      setMessage({ type: "error", text: "Please enter an email address" });
      return;
    }
    setMessage({ type: "info", text: "Sending reset email..." });
    const result = await forgotPassword(resetEmail);
    setMessage({
      type: result.success ? "success" : "error",
      text: result.message,
    });
  };

  const handleVerifyEmail = async () => {
    setMessage({ type: "info", text: "Sending verification email..." });
    const result = await verifyEmail();
    setMessage({
      type: result.success ? "success" : "error",
      text: result.message,
    });
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🔥 Firebase Authentication Test
          </h1>
          <p className="text-gray-600">
            Test all Firebase authentication features
          </p>
        </div>

        {/* Status Card */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Authentication Status
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Status</div>
              <div className="flex items-center">
                <div
                  className={`w-3 h-3 rounded-full mr-2 ${
                    isAuthenticated ? "bg-green-500" : "bg-red-500"
                  }`}
                ></div>
                <span className="font-bold">
                  {isAuthenticated ? "Authenticated" : "Not Authenticated"}
                </span>
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Email</div>
              <div className="font-bold truncate">
                {user?.email || "Not signed in"}
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Email Verified</div>
              <div className="flex items-center">
                <i
                  className={`fas ${
                    isEmailVerified
                      ? "fa-check-circle text-green-500"
                      : "fa-times-circle text-red-500"
                  } mr-2`}
                ></i>
                <span className="font-bold">
                  {isEmailVerified ? "Yes" : "No"}
                </span>
              </div>
            </div>
          </div>

          {user && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <div className="text-sm font-bold text-blue-900 mb-2">
                User Details:
              </div>
              <pre className="text-xs text-blue-800 overflow-x-auto">
                {JSON.stringify(
                  {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    emailVerified: user.emailVerified,
                    createdAt: user.metadata.creationTime,
                    lastSignIn: user.metadata.lastSignInTime,
                  },
                  null,
                  2,
                )}
              </pre>
            </div>
          )}
        </div>

        {/* Message Display */}
        {message.text && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              message.type === "success"
                ? "bg-green-50 text-green-800 border border-green-200"
                : message.type === "error"
                  ? "bg-red-50 text-red-800 border border-red-200"
                  : "bg-blue-50 text-blue-800 border border-blue-200"
            }`}
          >
            <div className="flex items-center">
              <i
                className={`fas ${
                  message.type === "success"
                    ? "fa-check-circle"
                    : message.type === "error"
                      ? "fa-exclamation-circle"
                      : "fa-info-circle"
                } mr-2`}
              ></i>
              <span>{message.text}</span>
            </div>
          </div>
        )}

        {/* Test Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Sign Up / Sign In */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Sign Up / Sign In
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Test User"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="test@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={testPassword}
                  onChange={(e) => setTestPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Test@123"
                />
                <p className="text-xs text-gray-500 mt-1">Min 6 characters</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSignUp}
                  disabled={loading || isAuthenticated}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <i className="fas fa-user-plus mr-2"></i>
                  Sign Up
                </button>
                <button
                  onClick={handleSignIn}
                  disabled={loading || isAuthenticated}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <i className="fas fa-sign-in-alt mr-2"></i>
                  Sign In
                </button>
              </div>
            </div>
          </div>

          {/* Other Actions */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Other Actions
            </h2>
            <div className="space-y-4">
              {/* Sign Out */}
              <div>
                <button
                  onClick={handleSignOut}
                  disabled={loading || !isAuthenticated}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <i className="fas fa-sign-out-alt mr-2"></i>
                  Sign Out
                </button>
              </div>

              {/* Email Verification */}
              <div>
                <button
                  onClick={handleVerifyEmail}
                  disabled={loading || !isAuthenticated || isEmailVerified}
                  className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <i className="fas fa-envelope-circle-check mr-2"></i>
                  Send Verification Email
                </button>
              </div>

              {/* Password Reset */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reset Password Email
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="email@example.com"
                  />
                  <button
                    onClick={handleForgotPassword}
                    disabled={loading}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <i className="fas fa-key"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            📋 Test Instructions
          </h2>
          <div className="space-y-3 text-sm text-gray-700">
            <div className="flex items-start">
              <span className="font-bold text-green-600 mr-2">1.</span>
              <span>
                <strong>Enable Email/Password in Firebase Console:</strong>
                <br />
                Go to{" "}
                <a
                  href="https://console.firebase.google.com/project/health-care-60ee6/authentication/providers"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Firebase Console
                </a>{" "}
                → Authentication → Sign-in method → Enable Email/Password
              </span>
            </div>
            <div className="flex items-start">
              <span className="font-bold text-green-600 mr-2">2.</span>
              <span>
                <strong>Test Sign Up:</strong> Enter email, password, and name,
                then click "Sign Up"
              </span>
            </div>
            <div className="flex items-start">
              <span className="font-bold text-green-600 mr-2">3.</span>
              <span>
                <strong>Check Email:</strong> You'll receive a verification
                email (check spam folder)
              </span>
            </div>
            <div className="flex items-start">
              <span className="font-bold text-green-600 mr-2">4.</span>
              <span>
                <strong>Test Sign In:</strong> Use the same credentials to sign
                in
              </span>
            </div>
            <div className="flex items-start">
              <span className="font-bold text-green-600 mr-2">5.</span>
              <span>
                <strong>Test Password Reset:</strong> Enter an email and click
                the key icon
              </span>
            </div>
          </div>
        </div>

        {/* Loading Indicator */}
        {loading && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 flex items-center">
              <i className="fas fa-spinner fa-spin text-green-600 text-2xl mr-3"></i>
              <span className="text-lg font-medium">Processing...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FirebaseAuthTest;
