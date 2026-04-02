import React, { useState } from "react";
import SMSSettings from "../components/settings/SMSSettings";
import EmailSettings from "../components/settings/EmailSettings";

const TABS = [
  { id: "sms", label: "SMS Settings", icon: "fas fa-sms" },
  { id: "email", label: "Email Settings", icon: "fas fa-envelope" },
  { id: "optout", label: "Opt-in / Opt-out", icon: "fas fa-user-slash" },
];

const OptOutInfo = () => (
  <div className="space-y-5">
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">Customer Opt-in / Opt-out</h3>
      <p className="text-sm text-gray-500">
        How customers can manage their communication preferences.
      </p>
    </div>

    <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <i className="fas fa-sms text-blue-600"></i>
        </div>
        <div>
          <h4 className="font-semibold text-blue-900 mb-1">SMS Opt-out</h4>
          <p className="text-sm text-blue-800">
            Customers can reply <strong>STOP</strong> to any SMS to unsubscribe from promotional
            messages. Transactional messages (order confirmations, OTPs) are still delivered.
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <i className="fas fa-envelope text-blue-600"></i>
        </div>
        <div>
          <h4 className="font-semibold text-blue-900 mb-1">Email Opt-out</h4>
          <p className="text-sm text-blue-800">
            Every marketing email includes an <strong>Unsubscribe</strong> link in the footer.
            Clicking it removes the customer from all future marketing campaigns while keeping
            transactional emails active.
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <i className="fas fa-user-check text-blue-600"></i>
        </div>
        <div>
          <h4 className="font-semibold text-blue-900 mb-1">Re-subscribing</h4>
          <p className="text-sm text-blue-800">
            Customers can opt back in by replying <strong>START</strong> to an SMS or by clicking
            the subscribe link in any email. Their preferences are updated immediately.
          </p>
        </div>
      </div>
    </div>

    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
      <i className="fas fa-exclamation-triangle text-yellow-600 mt-0.5"></i>
      <p className="text-sm text-yellow-800">
        Always honour opt-out requests promptly. Sending messages to opted-out customers may
        violate regulations such as GDPR, TCPA, and TRAI DLT guidelines.
      </p>
    </div>
  </div>
);

const NotificationSettings = () => {
  const [activeTab, setActiveTab] = useState("sms");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Notification Settings</h1>
        <p className="text-gray-600 mt-1">
          Configure SMS and email provider credentials and manage customer preferences.
        </p>
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-6">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <i className={tab.icon}></i>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === "sms" && <SMSSettings />}
          {activeTab === "email" && <EmailSettings />}
          {activeTab === "optout" && <OptOutInfo />}
        </div>
      </div>
    </div>
  );
};

export default NotificationSettings;
