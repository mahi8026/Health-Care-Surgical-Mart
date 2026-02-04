import React, { useState, useEffect } from "react";
import { apiService } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import LoadingSpinner from "../components/LoadingSpinner";
import UserManagement from "../components/UserManagement";

const Settings = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState("shop");

  // Settings data
  const [shopSettings, setShopSettings] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    website: "",
    logo: "",
    description: "",
    registrationNumber: "",
    taxNumber: "",
    currency: "BDT",
    timezone: "Asia/Dhaka",
  });

  const [taxSettings, setTaxSettings] = useState({
    defaultTaxRate: 0,
    enableTax: false,
    taxName: "VAT",
    taxNumber: "",
    taxInclusive: false,
  });

  const [systemSettings, setSystemSettings] = useState({
    lowStockThreshold: 10,
    autoBackup: false,
    backupFrequency: "daily",
    emailNotifications: true,
    smsNotifications: false,
    printReceipts: true,
    defaultPaymentMethod: "cash",
    invoicePrefix: "INV",
    invoiceStartNumber: 1,
    dateFormat: "DD/MM/YYYY",
    timeFormat: "12",
  });

  const [receiptSettings, setReceiptSettings] = useState({
    showLogo: true,
    showAddress: true,
    showPhone: true,
    showEmail: true,
    showWebsite: false,
    footerText: "Thank you for your business!",
    headerText: "بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ",
    paperSize: "80mm",
  });

  // Fetch settings
  const fetchSettings = async () => {
    try {
      setLoading(true);

      const [shopResponse, taxResponse, systemResponse, receiptResponse] =
        await Promise.all([
          apiService.get("/settings/shop"),
          apiService.get("/settings/tax"),
          apiService.get("/settings/system"),
          apiService.get("/settings/receipt"),
        ]);

      if (shopResponse.success) {
        setShopSettings({ ...shopSettings, ...shopResponse.data });
      }
      if (taxResponse.success) {
        setTaxSettings({ ...taxSettings, ...taxResponse.data });
      }
      if (systemResponse.success) {
        setSystemSettings({ ...systemSettings, ...systemResponse.data });
      }
      if (receiptResponse.success) {
        setReceiptSettings({ ...receiptSettings, ...receiptResponse.data });
      }
    } catch (error) {
      console.error("Settings fetch error:", error);
      setError("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  // Save settings
  const saveSettings = async (settingsType, data) => {
    try {
      setSaving(true);
      setError("");

      const response = await apiService.put(`/settings/${settingsType}`, data);

      if (response.success) {
        setSuccess("Settings saved successfully!");
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(response.message || "Failed to save settings");
      }
    } catch (error) {
      console.error("Settings save error:", error);
      setError("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchSettings();
  }, []);

  // Handle input changes
  const handleShopChange = (e) => {
    const { name, value } = e.target;
    setShopSettings((prev) => ({ ...prev, [name]: value }));
  };

  const handleTaxChange = (e) => {
    const { name, value, type, checked } = e.target;
    setTaxSettings((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSystemChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSystemSettings((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleReceiptChange = (e) => {
    const { name, value, type, checked } = e.target;
    setReceiptSettings((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // Test backup
  const testBackup = async () => {
    try {
      setSaving(true);
      const response = await apiService.post("/settings/backup/test");
      if (response.success) {
        setSuccess("Backup test completed successfully!");
        setTimeout(() => setSuccess(""), 3000);
      }
    } catch (error) {
      setError("Backup test failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
          <p className="text-gray-600 mt-1">
            Configure your shop settings, preferences, and system options
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">
            Last updated: {new Date().toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <div className="flex items-center">
            <i className="fas fa-exclamation-circle mr-2"></i>
            <span>{error}</span>
            <button
              onClick={() => setError("")}
              className="ml-auto text-red-500 hover:text-red-700"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          <div className="flex items-center">
            <i className="fas fa-check-circle mr-2"></i>
            <span>{success}</span>
          </div>
        </div>
      )}

      {/* Settings Tabs */}
      <div className="card">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: "shop", name: "Shop Profile", icon: "fas fa-store" },
              { id: "tax", name: "Tax Settings", icon: "fas fa-percentage" },
              { id: "system", name: "System Preferences", icon: "fas fa-cogs" },
              {
                id: "receipt",
                name: "Receipt Settings",
                icon: "fas fa-receipt",
              },
              {
                id: "users",
                name: "User Management",
                icon: "fas fa-users",
              },
              {
                id: "backup",
                name: "Backup & Security",
                icon: "fas fa-shield-alt",
              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  activeTab === tab.id
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <i className={tab.icon}></i>
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === "shop" && (
            <ShopSettingsTab
              settings={shopSettings}
              onChange={handleShopChange}
              onSave={() => saveSettings("shop", shopSettings)}
              saving={saving}
            />
          )}

          {activeTab === "tax" && (
            <TaxSettingsTab
              settings={taxSettings}
              onChange={handleTaxChange}
              onSave={() => saveSettings("tax", taxSettings)}
              saving={saving}
            />
          )}

          {activeTab === "system" && (
            <SystemSettingsTab
              settings={systemSettings}
              onChange={handleSystemChange}
              onSave={() => saveSettings("system", systemSettings)}
              saving={saving}
            />
          )}

          {activeTab === "receipt" && (
            <ReceiptSettingsTab
              settings={receiptSettings}
              onChange={handleReceiptChange}
              onSave={() => saveSettings("receipt", receiptSettings)}
              saving={saving}
            />
          )}

          {activeTab === "users" && <UserManagement />}

          {activeTab === "backup" && (
            <BackupSettingsTab
              onTestBackup={testBackup}
              saving={saving}
              user={user}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// Shop Settings Tab
const ShopSettingsTab = ({ settings, onChange, onSave, saving }) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Shop Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Shop Name *
            </label>
            <input
              type="text"
              name="name"
              value={settings.name}
              onChange={onChange}
              className="input-field"
              placeholder="Health Care Surgical Mart"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number *
            </label>
            <input
              type="tel"
              name="phone"
              value={settings.phone}
              onChange={onChange}
              className="input-field"
              placeholder="+880 1234 567890"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              name="email"
              value={settings.email}
              onChange={onChange}
              className="input-field"
              placeholder="info@healthcaremart.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Website
            </label>
            <input
              type="url"
              name="website"
              value={settings.website}
              onChange={onChange}
              className="input-field"
              placeholder="https://www.healthcaremart.com"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address *
            </label>
            <textarea
              name="address"
              value={settings.address}
              onChange={onChange}
              rows="3"
              className="input-field"
              placeholder="123 Medical Street, Healthcare District, Dhaka, Bangladesh"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Registration Number
            </label>
            <input
              type="text"
              name="registrationNumber"
              value={settings.registrationNumber}
              onChange={onChange}
              className="input-field"
              placeholder="REG-123456789"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tax Number
            </label>
            <input
              type="text"
              name="taxNumber"
              value={settings.taxNumber}
              onChange={onChange}
              className="input-field"
              placeholder="TAX-123456789"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Currency
            </label>
            <select
              name="currency"
              value={settings.currency}
              onChange={onChange}
              className="input-field"
            >
              <option value="BDT">BDT - Bangladeshi Taka</option>
              <option value="USD">USD - US Dollar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - British Pound</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Timezone
            </label>
            <select
              name="timezone"
              value={settings.timezone}
              onChange={onChange}
              className="input-field"
            >
              <option value="Asia/Dhaka">Asia/Dhaka (GMT+6)</option>
              <option value="UTC">UTC (GMT+0)</option>
              <option value="America/New_York">America/New_York (EST)</option>
              <option value="Europe/London">Europe/London (GMT)</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              name="description"
              value={settings.description}
              onChange={onChange}
              rows="3"
              className="input-field"
              placeholder="Brief description of your medical store..."
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={onSave} disabled={saving} className="btn-primary">
          {saving ? (
            <>
              <LoadingSpinner size="sm" className="mr-2" />
              Saving...
            </>
          ) : (
            <>
              <i className="fas fa-save mr-2"></i>
              Save Shop Settings
            </>
          )}
        </button>
      </div>
    </div>
  );
};

// Tax Settings Tab
const TaxSettingsTab = ({ settings, onChange, onSave, saving }) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Tax Configuration
        </h3>

        <div className="space-y-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              name="enableTax"
              checked={settings.enableTax}
              onChange={onChange}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label className="ml-2 text-sm font-medium text-gray-700">
              Enable Tax Calculations
            </label>
          </div>

          {settings.enableTax && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tax Name
                </label>
                <input
                  type="text"
                  name="taxName"
                  value={settings.taxName}
                  onChange={onChange}
                  className="input-field"
                  placeholder="VAT, GST, Sales Tax"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Default Tax Rate (%)
                </label>
                <input
                  type="number"
                  name="defaultTaxRate"
                  value={settings.defaultTaxRate}
                  onChange={onChange}
                  className="input-field"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="15.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tax Registration Number
                </label>
                <input
                  type="text"
                  name="taxNumber"
                  value={settings.taxNumber}
                  onChange={onChange}
                  className="input-field"
                  placeholder="VAT-123456789"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="taxInclusive"
                  checked={settings.taxInclusive}
                  onChange={onChange}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label className="ml-2 text-sm font-medium text-gray-700">
                  Tax Inclusive Pricing
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-blue-50 p-4 rounded-lg">
        <div className="flex items-start">
          <i className="fas fa-info-circle text-blue-500 mt-1 mr-2"></i>
          <div className="text-sm text-blue-700">
            <p className="font-medium mb-1">Tax Configuration Notes:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Tax inclusive pricing includes tax in the displayed price</li>
              <li>Tax exclusive pricing adds tax on top of the base price</li>
              <li>Changes will apply to new transactions only</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={onSave} disabled={saving} className="btn-primary">
          {saving ? (
            <>
              <LoadingSpinner size="sm" className="mr-2" />
              Saving...
            </>
          ) : (
            <>
              <i className="fas fa-save mr-2"></i>
              Save Tax Settings
            </>
          )}
        </button>
      </div>
    </div>
  );
};

// System Settings Tab
const SystemSettingsTab = ({ settings, onChange, onSave, saving }) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          System Preferences
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Low Stock Threshold
            </label>
            <input
              type="number"
              name="lowStockThreshold"
              value={settings.lowStockThreshold}
              onChange={onChange}
              className="input-field"
              min="1"
              placeholder="10"
            />
            <p className="text-xs text-gray-500 mt-1">
              Alert when stock falls below this quantity
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Default Payment Method
            </label>
            <select
              name="defaultPaymentMethod"
              value={settings.defaultPaymentMethod}
              onChange={onChange}
              className="input-field"
            >
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="bank">Bank Transfer</option>
              <option value="mobile">Mobile Banking</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Invoice Prefix
            </label>
            <input
              type="text"
              name="invoicePrefix"
              value={settings.invoicePrefix}
              onChange={onChange}
              className="input-field"
              placeholder="INV"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Invoice Start Number
            </label>
            <input
              type="number"
              name="invoiceStartNumber"
              value={settings.invoiceStartNumber}
              onChange={onChange}
              className="input-field"
              min="1"
              placeholder="1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date Format
            </label>
            <select
              name="dateFormat"
              value={settings.dateFormat}
              onChange={onChange}
              className="input-field"
            >
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Time Format
            </label>
            <select
              name="timeFormat"
              value={settings.timeFormat}
              onChange={onChange}
              className="input-field"
            >
              <option value="12">12 Hour (AM/PM)</option>
              <option value="24">24 Hour</option>
            </select>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <h4 className="text-md font-medium text-gray-900">Notifications</h4>

          <div className="space-y-3">
            <div className="flex items-center">
              <input
                type="checkbox"
                name="emailNotifications"
                checked={settings.emailNotifications}
                onChange={onChange}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label className="ml-2 text-sm font-medium text-gray-700">
                Email Notifications
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                name="smsNotifications"
                checked={settings.smsNotifications}
                onChange={onChange}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label className="ml-2 text-sm font-medium text-gray-700">
                SMS Notifications
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                name="printReceipts"
                checked={settings.printReceipts}
                onChange={onChange}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label className="ml-2 text-sm font-medium text-gray-700">
                Auto Print Receipts
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                name="autoBackup"
                checked={settings.autoBackup}
                onChange={onChange}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label className="ml-2 text-sm font-medium text-gray-700">
                Enable Auto Backup
              </label>
            </div>

            {settings.autoBackup && (
              <div className="ml-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Backup Frequency
                </label>
                <select
                  name="backupFrequency"
                  value={settings.backupFrequency}
                  onChange={onChange}
                  className="input-field w-48"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={onSave} disabled={saving} className="btn-primary">
          {saving ? (
            <>
              <LoadingSpinner size="sm" className="mr-2" />
              Saving...
            </>
          ) : (
            <>
              <i className="fas fa-save mr-2"></i>
              Save System Settings
            </>
          )}
        </button>
      </div>
    </div>
  );
};

// Receipt Settings Tab
const ReceiptSettingsTab = ({ settings, onChange, onSave, saving }) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Receipt Configuration
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Paper Size
            </label>
            <select
              name="paperSize"
              value={settings.paperSize}
              onChange={onChange}
              className="input-field"
            >
              <option value="80mm">80mm (Thermal)</option>
              <option value="58mm">58mm (Thermal)</option>
              <option value="A4">A4 (Standard)</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Header Text (Arabic)
            </label>
            <input
              type="text"
              name="headerText"
              value={settings.headerText}
              onChange={onChange}
              className="input-field"
              placeholder="بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Footer Text
            </label>
            <input
              type="text"
              name="footerText"
              value={settings.footerText}
              onChange={onChange}
              className="input-field"
              placeholder="Thank you for your business!"
            />
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <h4 className="text-md font-medium text-gray-900">Display Options</h4>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                name="showLogo"
                checked={settings.showLogo}
                onChange={onChange}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label className="ml-2 text-sm font-medium text-gray-700">
                Show Logo
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                name="showAddress"
                checked={settings.showAddress}
                onChange={onChange}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label className="ml-2 text-sm font-medium text-gray-700">
                Show Address
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                name="showPhone"
                checked={settings.showPhone}
                onChange={onChange}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label className="ml-2 text-sm font-medium text-gray-700">
                Show Phone
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                name="showEmail"
                checked={settings.showEmail}
                onChange={onChange}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label className="ml-2 text-sm font-medium text-gray-700">
                Show Email
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                name="showWebsite"
                checked={settings.showWebsite}
                onChange={onChange}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label className="ml-2 text-sm font-medium text-gray-700">
                Show Website
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 p-4 rounded-lg">
        <h4 className="text-md font-medium text-gray-900 mb-2">
          Receipt Preview
        </h4>
        <div className="bg-white p-4 border border-gray-200 rounded text-center text-sm">
          {settings.headerText && (
            <div className="text-lg mb-2">{settings.headerText}</div>
          )}
          <div className="font-bold text-lg">Health Care Surgical Mart</div>
          {settings.showAddress && (
            <div className="text-xs text-gray-600 mt-1">
              123 Medical Street, Dhaka
            </div>
          )}
          {settings.showPhone && (
            <div className="text-xs text-gray-600">Phone: +880 1234 567890</div>
          )}
          {settings.showEmail && (
            <div className="text-xs text-gray-600">
              Email: info@healthcaremart.com
            </div>
          )}
          <div className="border-t border-gray-300 my-2"></div>
          <div className="text-xs">Invoice #INV-001</div>
          <div className="text-xs">Date: {new Date().toLocaleDateString()}</div>
          <div className="border-t border-gray-300 my-2"></div>
          <div className="text-xs text-left">
            <div className="flex justify-between">
              <span>Sample Product</span>
              <span>৳100.00</span>
            </div>
          </div>
          <div className="border-t border-gray-300 my-2"></div>
          <div className="flex justify-between font-bold">
            <span>Total:</span>
            <span>৳100.00</span>
          </div>
          {settings.footerText && (
            <div className="text-xs text-gray-600 mt-2">
              {settings.footerText}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={onSave} disabled={saving} className="btn-primary">
          {saving ? (
            <>
              <LoadingSpinner size="sm" className="mr-2" />
              Saving...
            </>
          ) : (
            <>
              <i className="fas fa-save mr-2"></i>
              Save Receipt Settings
            </>
          )}
        </button>
      </div>
    </div>
  );
};

// Backup Settings Tab
const BackupSettingsTab = ({ onTestBackup, saving, user }) => {
  const [backupHistory, setBackupHistory] = useState([]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Backup & Security
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card bg-blue-50 border-blue-200">
            <div className="text-center">
              <i className="fas fa-database text-blue-600 text-3xl mb-2"></i>
              <h4 className="font-semibold text-blue-900">Database Backup</h4>
              <p className="text-sm text-blue-700 mt-1">
                Create a backup of your entire database
              </p>
              <button
                onClick={onTestBackup}
                disabled={saving}
                className="btn-primary mt-3"
              >
                {saving ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <i className="fas fa-download mr-2"></i>
                    Create Backup
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="card bg-green-50 border-green-200">
            <div className="text-center">
              <i className="fas fa-shield-alt text-green-600 text-3xl mb-2"></i>
              <h4 className="font-semibold text-green-900">System Security</h4>
              <p className="text-sm text-green-700 mt-1">
                Your data is encrypted and secure
              </p>
              <div className="mt-3 text-sm text-green-600">
                <div className="flex items-center justify-center">
                  <i className="fas fa-check-circle mr-1"></i>
                  SSL Encrypted
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <h4 className="text-md font-medium text-gray-900 mb-4">
            System Information
          </h4>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">Current User:</span>
                <span className="ml-2 text-gray-600">
                  {user?.name} ({user?.role})
                </span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Shop ID:</span>
                <span className="ml-2 text-gray-600 font-mono">
                  {user?.shopId}
                </span>
              </div>
              <div>
                <span className="font-medium text-gray-700">
                  System Version:
                </span>
                <span className="ml-2 text-gray-600">v2.0.0</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Last Login:</span>
                <span className="ml-2 text-gray-600">
                  {new Date().toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <h4 className="text-md font-medium text-gray-900 mb-4">
            Backup History
          </h4>
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="p-4 text-center text-gray-500">
              <i className="fas fa-history text-gray-400 text-2xl mb-2"></i>
              <p>No backup history available</p>
              <p className="text-sm">
                Create your first backup to see history here
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-yellow-50 p-4 rounded-lg">
        <div className="flex items-start">
          <i className="fas fa-exclamation-triangle text-yellow-500 mt-1 mr-2"></i>
          <div className="text-sm text-yellow-700">
            <p className="font-medium mb-1">Important Backup Notes:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Regular backups are essential for data protection</li>
              <li>Store backups in a secure, separate location</li>
              <li>Test backup restoration periodically</li>
              <li>Contact support for backup restoration assistance</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
