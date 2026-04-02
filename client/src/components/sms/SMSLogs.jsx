import React, { useState, useEffect, useCallback } from "react";
import { apiService } from "../../services/api";
import Pagination from "../ui/Pagination";

const STATUS_COLORS = {
  delivered: "bg-green-100 text-green-700",
  sent: "bg-blue-100 text-blue-700",
  failed: "bg-red-100 text-red-700",
  pending: "bg-yellow-100 text-yellow-700",
  queued: "bg-gray-100 text-gray-700",
};

const PAGE_SIZE = 20;

const SMSLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ type: "", status: "" });
  const [page, setPage] = useState(1);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.type) params.set("type", filters.type);
      if (filters.status) params.set("status", filters.status);
      const res = await apiService.get(`/sms/logs?${params.toString()}`);
      setLogs(res.data || []);
      setPage(1);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.max(1, Math.ceil(logs.length / PAGE_SIZE));
  const paginated = logs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const formatDate = (d) =>
    d ? new Date(d).toLocaleString() : "—";

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filters.type}
          onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Types</option>
          <option value="transactional">Transactional</option>
          <option value="promotional">Promotional</option>
          <option value="otp">OTP</option>
        </select>

        <select
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          <option value="sent">Sent</option>
          <option value="delivered">Delivered</option>
          <option value="failed">Failed</option>
          <option value="pending">Pending</option>
          <option value="queued">Queued</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["Recipient", "Message", "Type", "Status", "Provider", "Cost", "Date"].map(
                (h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  No SMS logs found.
                </td>
              </tr>
            ) : (
              paginated.map((log, i) => (
                <tr key={log._id || i} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{log.to || log.recipient || "—"}</td>
                  <td className="px-4 py-3 max-w-xs truncate text-gray-700">
                    {log.message ? log.message.slice(0, 60) + (log.message.length > 60 ? "…" : "") : "—"}
                  </td>
                  <td className="px-4 py-3 capitalize text-gray-600">{log.type || "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        STATUS_COLORS[log.status] || "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {log.status || "unknown"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{log.provider || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {log.cost != null ? `$${Number(log.cost).toFixed(4)}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {formatDate(log.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </div>
  );
};

export default SMSLogs;
