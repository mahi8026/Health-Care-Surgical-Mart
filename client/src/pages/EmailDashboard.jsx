import React, { useState } from "react";
import { apiService } from "../services/api";
import Button from "../components/ui/Button";
import CampaignForm from "../components/email/CampaignForm";
import TemplateEditor from "../components/email/TemplateEditor";
import CampaignAnalytics from "../components/email/CampaignAnalytics";

const TABS = ["Send Email", "Campaigns", "Templates", "Email Logs", "Sync Customers"];

const SendEmailForm = () => {
  const [form, setForm] = useState({ to: "", templateName: "", variables: "{}" });
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);
    try {
      let variables = {};
      try {
        variables = JSON.parse(form.variables);
      } catch {
        throw new Error("Variables must be valid JSON (e.g. {\"name\": \"John\"})");
      }
      await apiService.post("/email/send", {
        to: form.to,
        templateName: form.templateName,
        variables,
      });
      setFeedback({ type: "success", message: "Email sent successfully!" });
      setForm({ to: "", templateName: "", variables: "{}" });
    } catch (err) {
      setFeedback({ type: "error", message: err.message || "Failed to send email" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card max-w-lg">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Send Transactional Email</h2>

      {feedback && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg text-sm ${
            feedback.type === "success"
              ? "bg-green-50 border border-green-200 text-green-700"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}
        >
          {feedback.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Email</label>
          <input
            required
            type="email"
            placeholder="customer@example.com"
            value={form.to}
            onChange={set("to")}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
          <input
            required
            type="text"
            placeholder="e.g. welcome_email"
            value={form.templateName}
            onChange={set("templateName")}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Variables{" "}
            <span className="text-gray-400 font-normal">(JSON)</span>
          </label>
          <textarea
            rows={3}
            placeholder='{"firstName": "John", "orderId": "12345"}'
            value={form.variables}
            onChange={set("variables")}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <Button type="submit" loading={loading} className="w-full">
          Send Email
        </Button>
      </form>
    </div>
  );
};

const SyncCustomers = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleSync = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await apiService.post("/email/sync-customers");
      setResult({ type: "success", message: res.data?.message || "Customers synced successfully!" });
    } catch (err) {
      setResult({ type: "error", message: err.message || "Failed to sync customers" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card max-w-lg">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">Sync Customers to Mailchimp</h2>
      <p className="text-sm text-gray-600 mb-4">
        Push all customers from your database to your Mailchimp audience list.
      </p>

      {result && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg text-sm ${
            result.type === "success"
              ? "bg-green-50 border border-green-200 text-green-700"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}
        >
          {result.message}
        </div>
      )}

      <Button onClick={handleSync} loading={loading}>
        Sync Customers
      </Button>
    </div>
  );
};

const EmailDashboard = () => {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Email Dashboard</h1>
        <p className="text-gray-600 mt-1">Manage email campaigns, templates, and logs.</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-6 overflow-x-auto">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === i
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 0 && <SendEmailForm />}
        {activeTab === 1 && <CampaignForm />}
        {activeTab === 2 && <TemplateEditor />}
        {activeTab === 3 && <CampaignAnalytics />}
        {activeTab === 4 && <SyncCustomers />}
      </div>
    </div>
  );
};

export default EmailDashboard;
