import React, { useState, useEffect } from "react";
import { apiService } from "../services/api";
import LoadingSpinner from "../components/LoadingSpinner";

const NotificationSettings = () => {
  const [settings, setSettings] = useState({
    emailNotifications: false,
    smsNotifications: false,
    whatsappNotifications: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState({});
  const [testResults, setTestResults] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Test form data
  const [testData, setTestData] = useState({
    email: "",
    phone: "",
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await apiService.get("/settings");
      if (response.success && response.data) {
        setSettings({
          emailNotifications: response.data.emailNotifications || false,
          smsNotifications: response.data.smsNotifications || false,
          whatsappNotifications: response.data.whatsappNotifications || false,
        });
      }
    } catch (error) {
      console.error("Fetch settings error:", error);
      setError("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (field) => {
    setSettings((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const response = await apiService.put("/settings", settings);

      if (response.success) {
        setSuccess("Notification settings saved successfully!");
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(response.message || "Failed to save settings");
      }
    } catch (error) {
      console.error("Save settings error:", error);
      setError("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (type) => {
    try {
      setTesting((prev) => ({ ...prev, [type]: true }));
      setTestResults((prev) => ({ ...prev, [type]: null }));
      setError("");

      let response;
      if (type === "email") {
        if (!testData.email) {
          setError("Please enter an email address");
          return;
        }
        response = await apiService.post("/notifications/test-email", {
          email: testData.email,
        });
      } else if (type === "sms") {
        if (!testData.phone) {
          setError("Please enter a phone number");
          return;
        }
        response = await apiService.post("/notifications/test-sms", {
          phone: testData.phone,
        });
      } else if (type === "whatsapp") {
        if (!testData.phone) {
          setError("Please enter a phone number");
          return;
        }
        response = await apiService.post("/notifications/test-whatsapp", {
          phone: testData.phone,
        });
      }

      setTestResults((prev) => ({
        ...prev,
        [type]: response,
      }));
    } catch (error) {
      console.error(`Test ${type} error:`, error);
      setTestResults((prev) => ({
        ...prev,
        [type]: {
          success: false,
          message: error.response?.data?.message || "Test failed",
        },
      }));
    } finally {
      setTesting((prev) => ({ ...prev, [type]: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Notification Settings
        </h1>
        <p className="text-gray-600 mt-1">
          Configure email, SMS, and WhatsApp notifications
        </p>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <div className="flex items-center">
            <i className="fas fa-exclamation-circle mr-2"></i>
            <span>{error}</span>
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

      {/* Notification Toggles */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-xl font-semibold text-gray-900">
            Enable/Disable Notifications
          </h2>
          <p className="text-sm text-gray-600">
            Turn on or off different notification channels
          </p>
        </div>

        <div className="space-y-4">
          {/* Email Notifications */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <i className="fas fa-envelope text-blue-600 text-xl"></i>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">
                  Email Notifications
                </h3>
                <p className="text-sm text-gray-600">
                  Send order confirmations and reports via email
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.emailNotifications}
                onChange={() => handleToggle("emailNotifications")}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* SMS Notifications */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <i className="fas fa-sms text-green-600 text-xl"></i>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">
                  SMS Notifications
                </h3>
                <p className="text-sm text-gray-600">
                  Send order confirmations and alerts via SMS
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.smsNotifications}
                onChange={() => handleToggle("smsNotifications")}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
            </label>
          </div>

          {/* WhatsApp Notifications */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                <i className="fab fa-whatsapp text-emerald-600 text-xl"></i>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">
                  WhatsApp Notifications
                </h3>
                <p className="text-sm text-gray-600">
                  Send order confirmations via WhatsApp
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.whatsappNotifications}
                onChange={() => handleToggle("whatsappNotifications")}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex items-center gap-2"
          >
            {saving ? (
              <>
                <LoadingSpinner size="sm" />
                Saving...
              </>
            ) : (
              <>
                <i className="fas fa-save"></i>
                Save Settings
              </>
            )}
          </button>
        </div>
      </div>

      {/* Test Notifications */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-xl font-semibold text-gray-900">
            Test Notifications
          </h2>
          <p className="text-sm text-gray-600">
            Send test messages to verify your configuration
          </p>
        </div>

        <div className="space-y-6">
          {/* Test Email */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <i className="fas fa-envelope text-blue-600"></i>
              Test Email
            </h3>
            <div className="flex gap-3">
              <input
                type="email"
                placeholder="Enter email address"
                value={testData.email}
                onChange={(e) =>
                  setTestData((prev) => ({ ...prev, email: e.target.value }))
                }
                className="input flex-1"
              />
              <button
                onClick={() => handleTest("email")}
                disabled={testing.email}
                className="btn-secondary flex items-center gap-2"
              >
                {testing.email ? (
                  <>
                    <LoadingSpinner size="sm" />
                    Sending...
                  </>
                ) : (
                  <>
                    <i className="fas fa-paper-plane"></i>
                    Send Test
                  </>
                )}
              </button>
            </div>
            {testResults.email && (
              <div
                className={`mt-3 p-3 rounded-lg ${
                  testResults.email.success
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                <i
                  className={`fas ${testResults.email.success ? "fa-check-circle" : "fa-exclamation-circle"} mr-2`}
                ></i>
                {testResults.email.message}
              </div>
            )}
          </div>

          {/* Test SMS */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <i className="fas fa-sms text-green-600"></i>
              Test SMS
            </h3>
            <div className="flex gap-3">
              <input
                type="tel"
                placeholder="Enter phone number (with country code)"
                value={testData.phone}
                onChange={(e) =>
                  setTestData((prev) => ({ ...prev, phone: e.target.value }))
                }
                className="input flex-1"
              />
              <button
                onClick={() => handleTest("sms")}
                disabled={testing.sms}
                className="btn-secondary flex items-center gap-2"
              >
                {testing.sms ? (
                  <>
                    <LoadingSpinner size="sm" />
                    Sending...
                  </>
                ) : (
                  <>
                    <i className="fas fa-paper-plane"></i>
                    Send Test
                  </>
                )}
              </button>
            </div>
            {testResults.sms && (
              <div
                className={`mt-3 p-3 rounded-lg ${
                  testResults.sms.success
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                <i
                  className={`fas ${testResults.sms.success ? "fa-check-circle" : "fa-exclamation-circle"} mr-2`}
                ></i>
                {testResults.sms.message}
              </div>
            )}
          </div>

          {/* Test WhatsApp */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <i className="fab fa-whatsapp text-emerald-600"></i>
              Test WhatsApp
            </h3>
            <div className="flex gap-3">
              <input
                type="tel"
                placeholder="Enter phone number (with country code)"
                value={testData.phone}
                onChange={(e) =>
                  setTestData((prev) => ({ ...prev, phone: e.target.value }))
                }
                className="input flex-1"
              />
              <button
                onClick={() => handleTest("whatsapp")}
                disabled={testing.whatsapp}
                className="btn-secondary flex items-center gap-2"
              >
                {testing.whatsapp ? (
                  <>
                    <LoadingSpinner size="sm" />
                    Sending...
                  </>
                ) : (
                  <>
                    <i className="fas fa-paper-plane"></i>
                    Send Test
                  </>
                )}
              </button>
            </div>
            {testResults.whatsapp && (
              <div
                className={`mt-3 p-3 rounded-lg ${
                  testResults.whatsapp.success
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                <i
                  className={`fas ${testResults.whatsapp.success ? "fa-check-circle" : "fa-exclamation-circle"} mr-2`}
                ></i>
                {testResults.whatsapp.message}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Configuration Guide */}
      <div className="card bg-blue-50 border-blue-200">
        <div className="card-header">
          <h2 className="text-xl font-semibold text-blue-900 flex items-center gap-2">
            <i className="fas fa-info-circle"></i>
            Configuration Guide
          </h2>
        </div>

        <div className="space-y-4 text-sm text-blue-800">
          <div>
            <h3 className="font-semibold mb-2">📧 Email Configuration</h3>
            <p>
              Configure email settings in your <code>.env</code> file:
            </p>
            <pre className="bg-blue-100 p-3 rounded mt-2 text-xs overflow-x-auto">
              {`EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password
EMAIL_FROM=noreply@healthcaremart.com`}
            </pre>
          </div>

          <div>
            <h3 className="font-semibold mb-2">📱 SMS Configuration</h3>
            <p>
              For SMS, you can use Twilio or a local Bangladesh SMS gateway:
            </p>
            <pre className="bg-blue-100 p-3 rounded mt-2 text-xs overflow-x-auto">
              {`# Twilio
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Or Custom Gateway
SMS_API_KEY=your_api_key
SMS_GATEWAY_URL=https://api.smsgateway.com/send`}
            </pre>
          </div>

          <div>
            <h3 className="font-semibold mb-2">💬 WhatsApp Configuration</h3>
            <p>WhatsApp uses Twilio's WhatsApp API:</p>
            <pre className="bg-blue-100 p-3 rounded mt-2 text-xs overflow-x-auto">
              {`TWILIO_WHATSAPP_NUMBER=+14155238886
ENABLE_WHATSAPP_NOTIFICATIONS=true`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationSettings;
