import React, { useState, useEffect } from "react";
import api from "../config/api";
import SendSMSForm from "../components/sms/SendSMSForm";
import SMSLogs from "../components/sms/SMSLogs";
import SMSTemplates from "../components/sms/SMSTemplates";

const TABS = ["Send SMS", "SMS Logs", "Templates", "Queue Stats"];

const StatCard = ({ label, value, color = "text-blue-600" }) => (
  <div className="card text-center">
    <p className={`text-3xl font-bold ${color}`}>{value ?? "â€”"}</p>
    <p className="text-sm text-gray-600 mt-1">{label}</p>
  </div>
);

const QueueStats = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get("/sms/queue/stats")
      .then((res) => setStats(res.data))
      .catch((err) => setError(err.message || "Failed to load queue stats"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-500 text-sm">Loading queue stats...</p>;
  if (error) return <p className="text-red-600 text-sm">{error}</p>;
  if (!stats) return <p className="text-gray-500 text-sm">No stats available.</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Queue Statistics</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Waiting" value={stats.waiting} color="text-yellow-600" />
        <StatCard label="Active" value={stats.active} color="text-blue-600" />
        <StatCard label="Completed" value={stats.completed} color="text-green-600" />
        <StatCard label="Failed" value={stats.failed} color="text-red-600" />
      </div>
      {stats.delayed != null && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Delayed" value={stats.delayed} color="text-purple-600" />
          {stats.paused != null && (
            <StatCard label="Paused" value={stats.paused} color="text-gray-600" />
          )}
        </div>
      )}
    </div>
  );
};

const SMSDashboard = () => {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">SMS Dashboard</h1>
        <p className="text-gray-600 mt-1">Manage SMS messages, templates, and queue.</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-6">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
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
        {activeTab === 0 && <SendSMSForm />}
        {activeTab === 1 && <SMSLogs />}
        {activeTab === 2 && <SMSTemplates />}
        {activeTab === 3 && <QueueStats />}
      </div>
    </div>
  );
};

export default SMSDashboard;
