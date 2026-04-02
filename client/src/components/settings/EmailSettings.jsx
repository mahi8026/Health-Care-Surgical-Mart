import React, { useState, useEffect } from "react";
import LoadingSpinner from "../LoadingSpinner";

const STORAGE_KEY = "email_provider_settings";

const EmailSettings = () => {
  const [settings, setSettings] = useState({
    provider: "sendgrid",
    // SendGrid fields
    sendgridApiKey: "",
    fromEmail: "",
    fromName: "",
    // Mailchimp fields
    mailchimpApiKey: "",
    mailchimpServerPrefix: "",
    mailchimpListId: "",
    mailchimpFromEmail: "",
    mailchimpFromName: "",
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState("");
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
      const res = await fetch("/api/settings/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      }).catch(() => null);

      if (res && res.ok) {
        setMessage({ type: "success", text: "Email settings saved successfully!" });
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        setMessage({ type: "success", text: "Email settings saved locally." });
      }
    } catch {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      setMessage({ type: "success", text: "Email settings saved locally." });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testEmail.trim()) {
      setMessage({ type: "error", text: "Please enter an email address to test." });
      return;
    }
    setTesting(true);
    setMessage({ type: "", text: "" });
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: testEmail,
          subject: "Test Email from Notification System",
          html: "<p>This is a test email from your notification system.</p>",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success !== false) {
        setMessage({ type: "success", text: "Test email sent successfully!" });
      } else {
        setMessage({ type: "error", text: data.message || "Failed to send test email." });
      }
    } catch {
      setMessage({ type: "error", text: "Could not reach email API. Check your server." });
    } finally {
      setTesting(false);
    }
  };

  const isSendGrid = settings.provider === "sendgrid";

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Email Provider Settings</h3>
        <p className="text-sm text-gray-500">Configure your email service credentials.</p>
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Email Provider</label>
          <select
            name="provider"
            value={settings.provider}
            onChange={handleChange}
            className="input-field"
          >
            <option value="sendgrid">SendGrid</option>
            <option value="mailchimp">Mailchimp</option>
          </select>
        </div>

        {isSendGrid ? (
          <>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">SendGrid API Key</label>
              <input
                type="password"
                name="sendgridApiKey"
                value={settings.sendgridApiKey}
                onChange={handleChange}
                placeholder="SG.xxxxxxxxxxxxxxxxxxxxxxxx"
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Email</label>
              <input
                type="email"
                name="fromEmail"
                value={settings.fromEmail}
                onChange={handleChange}
                placeholder="noreply@yourshop.com"
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Name</label>
              <input
                type="text"
                name="fromName"
                value={settings.fromName}
                onChange={handleChange}
                placeholder="Your Shop Name"
                className="input-field"
              />
            </div>
          </>
        ) : (
          <>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Mailchimp API Key</label>
              <input
                type="password"
                name="mailchimpApiKey"
                value={settings.mailchimpApiKey}
                onChange={handleChange}
                placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-us1"
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Server Prefix</label>
              <input
                type="text"
                name="mailchimpServerPrefix"
                value={settings.mailchimpServerPrefix}
                onChange={handleChange}
                placeholder="us1"
                className="input-field"
              />
              <p className="text-xs text-gray-500 mt-1">Found at the end of your API key (e.g. us1, us6)</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Audience / List ID</label>
              <input
                type="text"
                name="mailchimpListId"
                value={settings.mailchimpListId}
                onChange={handleChange}
                placeholder="abc123def"
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Email</label>
              <input
                type="email"
                name="mailchimpFromEmail"
                value={settings.mailchimpFromEmail}
                onChange={handleChange}
                placeholder="noreply@yourshop.com"
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Name</label>
              <input
                type="text"
                name="mailchimpFromName"
                value={settings.mailchimpFromName}
                onChange={handleChange}
                placeholder="Your Shop Name"
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

      {/* Test Email */}
      <div className="border-t border-gray-200 pt-6">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Send Test Email</h4>
        <div className="flex gap-3">
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="Enter recipient email address"
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

export default EmailSettings;
