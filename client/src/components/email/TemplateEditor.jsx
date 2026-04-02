import React, { useState, useEffect } from "react";
import { apiService } from "../../services/api";
import Button from "../ui/Button";
import Modal from "../ui/Modal";

const TemplateEditor = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewName, setPreviewName] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [form, setForm] = useState({ name: "", subject: "", html: "", category: "transactional" });
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await apiService.get("/email/templates");
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

  const openPreview = async (name) => {
    setPreviewName(name);
    setPreviewHtml("");
    setPreviewOpen(true);
    setPreviewLoading(true);
    try {
      const res = await apiService.get(`/email/templates/${name}/preview`);
      setPreviewHtml(res.data?.html || res.data || "");
    } catch (err) {
      setPreviewHtml(`<p style="color:red">Failed to load preview: ${err.message}</p>`);
    } finally {
      setPreviewLoading(false);
    }
  };

  const openCreate = () => {
    setForm({ name: "", subject: "", html: "", category: "transactional" });
    setFeedback(null);
    setCreateOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      await apiService.post("/email/templates", form);
      setCreateOpen(false);
      fetchTemplates();
    } catch (err) {
      setFeedback(err.message || "Failed to create template");
    } finally {
      setSaving(false);
    }
  };

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">{templates.length} template(s)</p>
        <Button onClick={openCreate} size="sm">
          + New Template
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["Name", "Subject", "Category", "Actions"].map((h) => (
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
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : templates.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  No templates found.
                </td>
              </tr>
            ) : (
              templates.map((t, i) => (
                <tr key={t.name || i} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{t.name}</td>
                  <td className="px-4 py-3 text-gray-700 max-w-xs truncate">{t.subject || "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        t.category === "marketing"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {t.category || "transactional"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openPreview(t.name)}
                    >
                      Preview
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Preview Modal */}
      <Modal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={`Preview: ${previewName}`}
      >
        <div className="w-full" style={{ minHeight: "400px" }}>
          {previewLoading ? (
            <p className="text-gray-500 text-sm text-center py-8">Loading preview...</p>
          ) : (
            <iframe
              srcDoc={previewHtml}
              title="Email Preview"
              className="w-full border border-gray-200 rounded"
              style={{ height: "500px" }}
              sandbox="allow-same-origin"
            />
          )}
        </div>
      </Modal>

      {/* Create Template Modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="New Email Template">
        <form onSubmit={handleSave} className="space-y-4">
          {feedback && (
            <div className="px-4 py-3 rounded-lg text-sm bg-red-50 border border-red-200 text-red-700">
              {feedback}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
            <input
              required
              type="text"
              placeholder="e.g. welcome_email"
              value={form.name}
              onChange={set("name")}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <input
              required
              type="text"
              placeholder="e.g. Welcome to our store!"
              value={form.subject}
              onChange={set("subject")}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={form.category}
              onChange={set("category")}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="transactional">Transactional</option>
              <option value="marketing">Marketing</option>
              <option value="notification">Notification</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              HTML Content{" "}
              <span className="text-gray-400 font-normal">(use {"{{varName}}"} for variables)</span>
            </label>
            <textarea
              required
              rows={6}
              placeholder="<h1>Hello {{firstName}}</h1>"
              value={form.html}
              onChange={set("html")}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => setCreateOpen(false)}>
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

export default TemplateEditor;
