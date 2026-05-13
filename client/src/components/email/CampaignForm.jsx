import React, { useState } from "react";
import api from "../../config/api";
import Button from "../ui/Button";

const CampaignForm = () => {
  const [form, setForm] = useState({
    title: "",
    subject: "",
    html: "",
    fromName: "",
    replyTo: "",
    scheduledAt: "",
  });
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);
    try {
      const payload = { ...form };
      if (!payload.scheduledAt) delete payload.scheduledAt;
      await api.post("/email/campaign", payload);
      setFeedback({ type: "success", message: "Campaign created and queued successfully!" });
      setForm({ title: "", subject: "", html: "", fromName: "", replyTo: "", scheduledAt: "" });
    } catch (err) {
      setFeedback({ type: "error", message: err.message || "Failed to create campaign" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card max-w-2xl">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Create Email Campaign</h2>

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Title</label>
            <input
              required
              type="text"
              placeholder="e.g. Summer Sale 2024"
              value={form.title}
              onChange={set("title")}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Subject</label>
            <input
              required
              type="text"
              placeholder="e.g. Don't miss our summer deals!"
              value={form.subject}
              onChange={set("subject")}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Name</label>
            <input
              type="text"
              placeholder="e.g. Acme Store"
              value={form.fromName}
              onChange={set("fromName")}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reply-To Email</label>
            <input
              type="email"
              placeholder="reply@example.com"
              value={form.replyTo}
              onChange={set("replyTo")}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            HTML Content
          </label>
          <textarea
            required
            rows={8}
            placeholder="<h1>Hello {{firstName}}</h1><p>Your campaign content here...</p>"
            value={form.html}
            onChange={set("html")}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Schedule (optional)
          </label>
          <input
            type="datetime-local"
            value={form.scheduledAt}
            onChange={set("scheduledAt")}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">Leave empty to send immediately.</p>
        </div>

        <Button type="submit" loading={loading} className="w-full">
          Create Campaign
        </Button>
      </form>
    </div>
  );
};

export default CampaignForm;
