import React, { useState, useEffect } from "react";
import api from "../../config/api";
import Button from "../ui/Button";
import Modal from "../ui/Modal";

const SMSTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: "", content: "", category: "transactional", dltId: "" });
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await api.get("/sms/templates");
      setTemplates(res.data || []);
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const openModal = () => {
    setForm({ name: "", content: "", category: "transactional", dltId: "" });
    setFeedback(null);
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      // Extract variables from {{varName}} placeholders
      const variables = [...form.content.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
      await api.post("/sms/templates", { ...form, variables });
      setModalOpen(false);
      fetchTemplates();
    } catch (err) {
      setFeedback(err.message || "Failed to create template");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">{templates.length} template(s)</p>
        <Button onClick={openModal} size="sm">
          + New Template
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["Name", "Category", "Variables", "Content Preview", "DLT ID"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : templates.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No templates found.
                </td>
              </tr>
            ) : (
              templates.map((t, i) => (
                <tr key={t.name || i} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{t.name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        t.category === "promotional"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {t.category || "transactional"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {(t.variables || []).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3 max-w-sm text-gray-700 truncate">
                    {t.content}
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                    {t.dltId || "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="New SMS Template">
        <form onSubmit={handleSave} className="space-y-4">
          {feedback && (
            <div className="px-4 py-3 rounded-lg text-sm bg-red-50 border border-red-200 text-red-700">
              {feedback}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              required
              type="text"
              placeholder="e.g. order_shipped"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="transactional">Transactional</option>
              <option value="promotional">Promotional</option>
              <option value="otp">OTP</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Content{" "}
              <span className="text-gray-400 font-normal">(use {"{{varName}}"} for variables)</span>
            </label>
            <textarea
              required
              rows={4}
              placeholder="Hi {{customerName}}, your order is ready!"
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">DLT ID (optional)</label>
            <input
              type="text"
              placeholder="DLT template ID"
              value={form.dltId}
              onChange={(e) => setForm((f) => ({ ...f, dltId: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Create Template
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default SMSTemplates;
