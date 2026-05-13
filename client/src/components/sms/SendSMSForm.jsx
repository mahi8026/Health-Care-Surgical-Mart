import React, { useState, useEffect } from "react";
import api from "../../config/api";
import Button from "../ui/Button";

const SendSMSForm = () => {
  const [templates, setTemplates] = useState([]);
  const [form, setForm] = useState({ to: "", templateName: "", variables: {} });
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    api
      .get("/sms/templates")
      .then((res) => setTemplates(res.data || []))
      .catch(() => setTemplates([]));
  }, []);

  const handleTemplateChange = (e) => {
    const name = e.target.value;
    const tmpl = templates.find((t) => t.name === name) || null;
    setSelectedTemplate(tmpl);
    const vars = {};
    (tmpl?.variables || []).forEach((v) => (vars[v] = ""));
    setForm((f) => ({ ...f, templateName: name, variables: vars }));
  };

  const handleVarChange = (key, value) => {
    setForm((f) => ({ ...f, variables: { ...f.variables, [key]: value } }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);
    try {
      await api.post("/sms/send", form);
      setFeedback({ type: "success", message: "SMS sent successfully!" });
      setForm({ to: "", templateName: "", variables: {} });
      setSelectedTemplate(null);
    } catch (err) {
      setFeedback({ type: "error", message: err.message || "Failed to send SMS" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card max-w-lg">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Send SMS</h2>

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
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone Number
          </label>
          <input
            type="tel"
            required
            placeholder="+8801646886795"
            value={form.to}
            onChange={(e) => setForm((f) => ({ ...f, to: e.target.value.trim() }))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Format: +[country code][number] (e.g., +8801646886795 for Bangladesh)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Template
          </label>
          <select
            required
            value={form.templateName}
            onChange={handleTemplateChange}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a template</option>
            {templates.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name} ({t.category})
              </option>
            ))}
          </select>
        </div>

        {selectedTemplate && (
          <div className="bg-gray-50 rounded-md p-3 text-sm text-gray-600">
            <p className="font-medium text-gray-700 mb-1">Preview:</p>
            <p>{selectedTemplate.content}</p>
          </div>
        )}

        {selectedTemplate?.variables?.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700">Variables</p>
            {selectedTemplate.variables.map((v) => (
              <div key={v}>
                <label className="block text-xs text-gray-600 mb-1 capitalize">
                  {v}
                </label>
                <input
                  type="text"
                  required
                  placeholder={v}
                  value={form.variables[v] || ""}
                  onChange={(e) => handleVarChange(v, e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
          </div>
        )}

        <Button type="submit" loading={loading} className="w-full">
          Send SMS
        </Button>
      </form>
    </div>
  );
};

export default SendSMSForm;
