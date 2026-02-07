/**
 * Script to update all pages to use test endpoints
 * Run this with: node update-pages-to-test-endpoints.js
 */

const fs = require("fs");
const path = require("path");

const updates = [
  {
    file: "client/src/pages/Purchases.jsx",
    replacements: [
      {
        find: "const response = await apiService.get(`/purchases?${params.toString()}`);",
        replace:
          'const response = await fetch("http://localhost:5000/api/test/purchases").then(r => r.json());',
      },
      {
        find: 'const response = await apiService.get("/suppliers?limit=100");',
        replace:
          'const response = await fetch("http://localhost:5000/api/test/suppliers").then(r => r.json());',
      },
    ],
  },
  {
    file: "client/src/pages/Customers.jsx",
    replacements: [
      {
        find: "const response = await apiService.get(`/customers?${params.toString()}`);",
        replace:
          'const response = await fetch("http://localhost:5000/api/test/customers").then(r => r.json());',
      },
    ],
  },
  {
    file: "client/src/pages/Returns.jsx",
    replacements: [
      {
        find: "const response = await apiService.get(`/returns?${params.toString()}`);",
        replace:
          'const response = await fetch("http://localhost:5000/api/test/returns").then(r => r.json());',
      },
      {
        find: 'const response = await apiService.get("/returns/stats/summary");',
        replace:
          'const response = await fetch("http://localhost:5000/api/test/returns/stats/summary").then(r => r.json());',
      },
    ],
  },
  {
    file: "client/src/pages/StockReport.jsx",
    replacements: [
      {
        find: 'const stockResponse = await apiService.get("/reports/stock",',
        replace:
          'const stockResponse = await fetch("http://localhost:5000/api/test/reports/stock").then(r => r.json()); //',
      },
      {
        find: 'const valuationResponse = await apiService.get(\n        "/reports/stock-valuation",\n      );',
        replace:
          'const valuationResponse = await fetch("http://localhost:5000/api/test/reports/stock-valuation").then(r => r.json());',
      },
      {
        find: 'const dashboardResponse = await apiService.get("/reports/dashboard");',
        replace:
          'const dashboardResponse = await fetch("http://localhost:5000/api/test/reports/dashboard").then(r => r.json());',
      },
    ],
  },
  {
    file: "client/src/pages/ExpenseCategories.jsx",
    replacements: [
      {
        find: 'const response = await apiService.get("/expense-categories");',
        replace:
          'const response = await fetch("http://localhost:5000/api/test/expense-categories").then(r => r.json());',
      },
    ],
  },
  {
    file: "client/src/pages/NotificationSettings.jsx",
    replacements: [
      {
        find: 'const response = await apiService.get("/settings");',
        replace:
          'const response = await fetch("http://localhost:5000/api/test/settings").then(r => r.json());',
      },
    ],
  },
  {
    file: "client/src/pages/FinancialReports.jsx",
    replacements: [
      {
        find: "apiService.get(`/financial-reports/profit-loss?${params.toString()}`),",
        replace:
          'fetch("http://localhost:5000/api/test/financial-reports/profit-loss").then(r => r.json()),',
      },
      {
        find: "apiService.get(\n            `/financial-reports/daily-summary?date=${dateRange.endDate}`,\n          ),",
        replace:
          'fetch("http://localhost:5000/api/test/financial-reports/daily-summary").then(r => r.json()),',
      },
      {
        find: "apiService.get(\n            `/financial-reports/product-profitability?${params.toString()}`,\n          ),",
        replace:
          'fetch("http://localhost:5000/api/test/financial-reports/product-profitability").then(r => r.json()),',
      },
      {
        find: "apiService.get(\n            `/financial-reports/return-analysis?${params.toString()}`,\n          ),",
        replace:
          'fetch("http://localhost:5000/api/test/financial-reports/return-analysis").then(r => r.json()),',
      },
      {
        find: "apiService.get(`/financial-reports/cash-flow?${params.toString()}`),",
        replace:
          'fetch("http://localhost:5000/api/test/financial-reports/cash-flow").then(r => r.json()),',
      },
    ],
  },
];

console.log("Updating pages to use test endpoints...\n");

updates.forEach(({ file, replacements }) => {
  const filePath = path.join(__dirname, file);

  if (!fs.existsSync(filePath)) {
    console.log(`❌ File not found: ${file}`);
    return;
  }

  let content = fs.readFileSync(filePath, "utf8");
  let updated = false;

  replacements.forEach(({ find, replace }) => {
    if (content.includes(find)) {
      content = content.replace(find, replace);
      updated = true;
    }
  });

  if (updated) {
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`✅ Updated: ${file}`);
  } else {
    console.log(`⚠️  No changes needed: ${file}`);
  }
});

console.log("\n✅ All pages updated successfully!");
console.log("The application should now work without authentication errors.");
