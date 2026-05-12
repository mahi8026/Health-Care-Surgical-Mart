import { useState, useEffect } from "react";
import LoadingSpinner from "../LoadingSpinner";
import { apiService } from "../../services/api";

const SMSSettings = () => {
  const [configStatus, setConfigStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    checkConfiguration();
  }, []);

  const checkConfiguration = async () => {
    setLoading(true);
    try {
      const response = await apiService.get("/sms/config-status");
      setConfigStatus(response.data);
    } catch (error) {
      setMessage({ type: "error", text: "Failed to check SMS configuration status" });
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    if (!testPhone.trim()) {
      setMessage({ type: "error", text: "Please enter a phone number to test." });
      return;
    }
    setTesting(true);
    setMessage({ type: "", text: "" });
    try {
      await apiService.post("/sms/send", {
        to: testPhone,
        templateName: "test_sms",
        variables: {},
      });
      setMessage({ type: "success", text: "Test SMS sent successfully!" });
      setTestPhone("");
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Failed to send test SMS." });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  const isConfigured = configStatus?.configured;
  const provider = configStatus?.provider || "Not set";

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">SMS Provider Configuration</h3>
        <p className="text-sm text-gray-500">SMS credentials must be configured on the server.</p>
      </div>

      {message.text && (
        <div
          className={`px-4 py-3 rounded-lg flex items-center gap-2 text-sm ${
            message.type === "success"
              ? "bg-green-50 border border-green-200 text-green-700"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}
        >
          <i className={`fas ${message.type === "success" ? "fa-check-circle" : "fa-exclamation-circle"}`}></i>
          {message.text}
        </div>
      )}

      {/* Configuration Status */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-gray-900">Configuration Status</h4>
          <button
            onClick={checkConfiguration}
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <i className="fas fa-sync-alt"></i>
            Refresh
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Status:</span>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                isConfigured
                  ? "bg-green-100 text-green-700"
                  : "bg-yellow-100 text-yellow-700"
              }`}
            >
              <i className={`fas ${isConfigured ? "fa-check-circle" : "fa-exclamation-triangle"}`}></i>
              {isConfigured ? "Configured" : "Not Configured"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Provider:</span>
            <span className="text-sm font-medium text-gray-900 capitalize">{provider}</span>
          </div>
          {configStatus?.providers && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Available Providers:</span>
              <span className="text-sm text-gray-900">
                {Object.entries(configStatus.providers)
                  .filter(([_, status]) => status)
                  .map(([name]) => name)
                  .join(", ") || "None"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Configuration Instructions */}
      {!isConfigured && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex gap-3">
            <i className="fas fa-info-circle text-blue-600 mt-0.5"></i>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-blue-900 mb-2">How to Configure SMS</h4>
              <p className="text-sm text-blue-800 mb-3">
                SMS providers must be configured in the server environment variables. Follow these steps:
              </p>
              <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
                <li>Choose a provider (Twilio or MSG91) and sign up for an account</li>
                <li>Get your API credentials from the provider dashboard</li>
                <li>
                  Add credentials to <code className="bg-blue-100 px-1.5 py-0.5 rounded">server/.env</code> file:
                  <div className="mt-2 bg-blue-100 rounded p-3 font-mono text-xs">
                    <div>TWILIO_ACCOUNT_SID=your_account_sid</div>
                    <div>TWILIO_AUTH_TOKEN=your_auth_token</div>
                    <div>TWILIO_PHONE_NUMBER=+1234567890</div>
                    <div>SMS_DEFAULT_PROVIDER=twilio</div>
                  </div>
                </li>
                <li>Restart the server to apply changes</li>
                <li>Refresh this page to verify configuration</li>
              </ol>
              <p className="text-sm text-blue-800 mt-3">
                For detailed instructions, see the{" "}
                <a
                  href="https://github.com/your-repo/docs/SMS_CONFIGURATION.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium"
                >
                  SMS Configuration Guide
                </a>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Test SMS - Only show if configured */}
      {isConfigured && (
        <div className="border-t border-gray-200 pt-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Send Test SMS</h4>
          <p className="text-sm text-gray-500 mb-3">
            Send a test message to verify your SMS configuration is working correctly.
          </p>
          <div className="flex gap-3">
            <input
              type="tel"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="Phone number with country code, e.g. +919876543210"
              className="input-field flex-1"
            />
            <button
              onClick={handleTest}
              disabled={testing}
              className="btn-secondary flex items-center gap-2 whitespace-nowrap"
            >
              {testing ? <LoadingSpinner size="sm" /> : <i className="fas fa-paper-plane"></i>}
              {testing ? "Sending..." : "Send Test"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SMSSettings;
