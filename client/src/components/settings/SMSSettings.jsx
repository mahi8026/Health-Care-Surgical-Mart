import React, { useState, useEffect } from "react";
import LoadingSpinner from "../LoadingSpinner";

const STORAGE_KEY = "sms_provider_settings";

const SMSSettings = () => {
  const [settings, setSettings] = useState({
    provider: "twilio",
    // Twilio fields
    accountSid: "",
    authToken: "",
    phoneNumber: "",
    // MSG91 fields
    apiKey: "",
    senderId: "",
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setSettings((prev) => ({ ...prev, ...JSON.parse(saved) }));
      } catch {
        // ignore parse errors
      }
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage({ type: "", text: "" });
    try {
      // Try POST to /api/settings first, fall back to localStorage
      const res = await fetch("/api/settings/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      }).catch(() => null);

      if (res && res.ok) {
        setMessage({ type: "success", text: "SMS settings saved successfully!" });
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        setMessage({ type: "success", text: "SMS settings saved locally." });
      }
    } catch {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      setMessage({ type: "success", text: "SMS settings saved locally." });
    } finally {
      setSaving(false);
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
      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: testPhone,
          message: "This is a test SMS from your notification system.",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success !== false) {
        setMessage({ type: "success", text: "Test SMS sent successfully!" });
      } else {
        setMessage({ type: "error", text: data.message || "Failed to send test SMS." });
      }
    } catch {
      setMessage({ type: "error", text: "Could not reach SMS API. Check your server." });
    } finally {
      setTesting(false);
    }
  };

  const isTwilio = settings.provider === "twilio";

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">SMS Provider Settings</h3>
        <p className="text-sm text-gray-500">Configure your SMS gateway credentials.</p>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Provider selection */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">SMS Provider</label>
          <select
            name="provider"
            value={settings.provider}
            onChange={handleChange}
            className="input-field"
          >
            <option value="twilio">Twilio</option>
            <option value="msg91">MSG91</option>
          </select>
        </div>

        {isTwilio ? (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Account SID</label>
              <input
                type="text"
                name="accountSid"
                value={settings.accountSid}
                onChange={handleChange}
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Auth Token</label>
              <input
                type="password"
                name="authToken"
                value={settings.authToken}
                onChange={handleChange}
                placeholder="Your Twilio auth token"
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Twilio Phone Number</label>
              <input
                type="text"
                name="phoneNumber"
                value={settings.phoneNumber}
                onChange={handleChange}
                placeholder="+1234567890"
                className="input-field"
              />
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
              <input
                type="password"
                name="apiKey"
                value={settings.apiKey}
                onChange={handleChange}
                placeholder="Your MSG91 API key"
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sender ID</label>
              <input
                type="text"
                name="senderId"
                value={settings.senderId}
                onChange={handleChange}
                placeholder="HLTHCR"
                className="input-field"
              />
            </div>
          </>
        )}
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary flex items-center gap-2"
        >
          {saving ? <LoadingSpinner size="sm" /> : <i className="fas fa-save"></i>}
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>

      {/* Test SMS */}
      <div className="border-t border-gray-200 pt-6">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Send Test SMS</h4>
        <div className="flex gap-3">
          <input
            type="tel"
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
            placeholder="Phone number with country code, e.g. +8801234567890"
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
    </div>
  );
};

export default SMSSettings;
