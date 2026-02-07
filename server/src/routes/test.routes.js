/**
 * Test Routes - Simple endpoints without authentication for testing
 */

const express = require("express");
const router = express.Router();

/**
 * GET /api/test/dashboard
 * Simple dashboard data without authentication
 */
router.get("/dashboard", async (req, res) => {
  try {
    // Return mock dashboard data
    const dashboardData = {
      todaySales: {
        totalSales: 225,
        totalOrders: 3,
        avgOrderValue: 75,
      },
      weeklySales: {
        totalSales: 1250,
        totalOrders: 15,
      },
      monthlySales: {
        totalSales: 4500,
        totalOrders: 45,
      },
      lowStockProducts: [
        { name: "Paracetamol 500mg", currentQty: 10, minStockLevel: 20 },
        { name: "Surgical Mask", currentQty: 5, minStockLevel: 50 },
      ],
      recentSales: [
        {
          invoiceNo: "INV-001",
          customerName: "John Doe",
          grandTotal: 150,
          saleDate: new Date(),
        },
        {
          invoiceNo: "INV-002",
          customerName: "Jane Smith",
          grandTotal: 75,
          saleDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      ],
      topProducts: [
        { name: "Paracetamol 500mg", totalSold: 100, revenue: 500 },
        { name: "Digital Thermometer", totalSold: 25, revenue: 625 },
      ],
    };

    res.json({
      success: true,
      data: dashboardData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/test/stock-valuation
 * Simple stock valuation data
 */
router.get("/stock-valuation", async (req, res) => {
  try {
    const stockData = {
      totalValue: 15000,
      totalProducts: 150,
      lowStockCount: 5,
      outOfStockCount: 2,
      summary: {
        totalPurchaseValue: 12000,
        totalSellingValue: 18000,
        totalProfit: 6000,
        profitMargin: 33.33,
      },
      categories: [
        { name: "Medicine", value: 8000, percentage: 53.3 },
        { name: "Equipment", value: 4000, percentage: 26.7 },
        { name: "PPE", value: 2000, percentage: 13.3 },
        { name: "Supplies", value: 1000, percentage: 6.7 },
      ],
    };

    res.json({
      success: true,
      data: stockData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/test/expense-analytics
 * Simple expense analytics data
 */
router.get("/expense-analytics", async (req, res) => {
  try {
    const expenseData = {
      comparison: [
        {
          month: "January",
          totalAmount: 2000,
          expenseCount: 15,
          changes: { amount: 10 },
        },
        {
          month: "February",
          totalAmount: 2200,
          expenseCount: 18,
          changes: { amount: 10 },
        },
      ],
      distribution: [
        { categoryName: "Office Supplies", totalAmount: 800, percentage: 36.4 },
        { categoryName: "Utilities", totalAmount: 600, percentage: 27.3 },
        { categoryName: "Marketing", totalAmount: 400, percentage: 18.2 },
        { categoryName: "Maintenance", totalAmount: 300, percentage: 13.6 },
        { categoryName: "Other", totalAmount: 100, percentage: 4.5 },
      ],
      summary: {
        totalAmount: 2200,
        expenseCount: 18,
      },
    };

    res.json({
      success: true,
      data: expenseData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/test/products
 * Simple products data without authentication
 */
router.get("/products", async (req, res) => {
  try {
    // Return mock products data
    const products = [
      {
        _id: "product1",
        name: "Paracetamol 500mg",
        sku: "PAR500",
        category: "Medicine",
        brand: "Square Pharmaceuticals",
        purchasePrice: 2.5,
        sellingPrice: 5.0,
        unit: "strip",
        minStockLevel: 20,
        stockQuantity: 100,
        isLowStock: false,
        isActive: true,
        description: "Pain relief medication",
        batchNo: "BATCH001",
        expiryDate: "2025-12-31",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        _id: "product2",
        name: "Surgical Mask",
        sku: "MASK001",
        category: "PPE",
        brand: "MedSafe",
        purchasePrice: 1.0,
        sellingPrice: 2.5,
        unit: "pcs",
        minStockLevel: 50,
        stockQuantity: 5,
        isLowStock: true,
        isActive: true,
        description: "Disposable surgical mask",
        batchNo: "BATCH002",
        expiryDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        _id: "product3",
        name: "Digital Thermometer",
        sku: "THERM001",
        category: "Equipment",
        brand: "HealthTech",
        purchasePrice: 15.0,
        sellingPrice: 25.0,
        unit: "pcs",
        minStockLevel: 10,
        stockQuantity: 25,
        isLowStock: false,
        isActive: true,
        description: "Digital body thermometer",
        batchNo: "BATCH003",
        expiryDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        _id: "product4",
        name: "Insulin Syringe",
        sku: "SYR001",
        category: "Medical",
        brand: "BD",
        purchasePrice: 0.5,
        sellingPrice: 1.2,
        unit: "pcs",
        minStockLevel: 100,
        stockQuantity: 0,
        isLowStock: true,
        isActive: true,
        description: "Disposable insulin syringe",
        batchNo: "BATCH004",
        expiryDate: "2026-06-30",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        _id: "product5",
        name: "Blood Pressure Monitor",
        sku: "BPM001",
        category: "Equipment",
        brand: "Omron",
        purchasePrice: 45.0,
        sellingPrice: 75.0,
        unit: "pcs",
        minStockLevel: 5,
        stockQuantity: 8,
        isLowStock: false,
        isActive: true,
        description: "Digital blood pressure monitor",
        batchNo: "BATCH005",
        expiryDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    res.json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/test/customers
 * Simple customers data without authentication
 */
router.get("/customers", async (req, res) => {
  try {
    // Return mock customers data
    const customers = [
      {
        _id: "customer1",
        name: "John Doe",
        phone: "+8801712345678",
        email: "john.doe@email.com",
        address: "123 Main Street, Dhaka",
        type: "Regular",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        _id: "customer2",
        name: "Jane Smith",
        phone: "+8801798765432",
        email: "jane.smith@email.com",
        address: "456 Park Avenue, Chittagong",
        type: "VIP",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        _id: "customer3",
        name: "Ahmed Rahman",
        phone: "+8801555123456",
        email: "ahmed.rahman@email.com",
        address: "789 Hospital Road, Sylhet",
        type: "Regular",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        _id: "customer4",
        name: "Fatima Khan",
        phone: "+8801666789012",
        email: "fatima.khan@email.com",
        address: "321 Medical Center, Rajshahi",
        type: "Wholesale",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    res.json({
      success: true,
      count: customers.length,
      data: customers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/test/sales
 * Simple sales processing without authentication
 */
router.post("/sales", async (req, res) => {
  try {
    const {
      invoiceNumber,
      customer,
      items,
      subtotal,
      discount,
      vatAmount,
      grandTotal,
      cashPaid,
      bankPaid,
      vatPercent,
      notes,
    } = req.body;

    console.log("Test sale request:", {
      invoiceNumber,
      itemsCount: items?.length,
      grandTotal,
      customer: customer?.name,
    });

    // Basic validation
    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Sale must have at least one item",
      });
    }

    if (!grandTotal || grandTotal <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid sale amount",
      });
    }

    // Generate invoice number if not provided
    const invoiceNo = invoiceNumber || `INV-${Date.now()}`;

    // Create mock sale record
    const sale = {
      _id: `sale_${Date.now()}`,
      invoiceNo,
      customerId: customer?.id || null,
      customerName: customer?.name || "Cash Customer",
      items: items.map((item) => ({
        productId: item.productId,
        name: item.name || "Product",
        rate: parseFloat(item.sellingPrice || 0),
        qty: parseFloat(item.quantity || 0),
        total:
          parseFloat(item.sellingPrice || 0) * parseFloat(item.quantity || 0),
      })),
      subtotal: parseFloat(subtotal) || 0,
      discountAmount: parseFloat(discount) || 0,
      vatAmount: parseFloat(vatAmount) || 0,
      vatPercent: parseFloat(vatPercent) || 0,
      grandTotal: parseFloat(grandTotal),
      cashPaid: parseFloat(cashPaid) || 0,
      bankPaid: parseFloat(bankPaid) || 0,
      returnAmount: Math.max(
        0,
        (parseFloat(cashPaid) || 0) +
          (parseFloat(bankPaid) || 0) -
          parseFloat(grandTotal),
      ),
      paymentStatus: "Paid",
      saleDate: new Date(),
      notes: notes || "",
      createdAt: new Date(),
    };

    console.log("Mock sale created:", {
      invoiceNo: sale.invoiceNo,
      grandTotal: sale.grandTotal,
      itemsCount: sale.items.length,
    });

    // Simulate successful sale creation
    res.status(201).json({
      success: true,
      message: "Sale created successfully",
      data: {
        _id: sale._id,
        invoiceNo: sale.invoiceNo,
        grandTotal: sale.grandTotal,
        saleDate: sale.saleDate,
        items: sale.items,
        customer: {
          name: sale.customerName,
        },
        subtotal: sale.subtotal,
        discountAmount: sale.discountAmount,
        vatAmount: sale.vatAmount,
        cashPaid: sale.cashPaid,
        bankPaid: sale.bankPaid,
        returnAmount: sale.returnAmount,
      },
    });
  } catch (error) {
    console.error("Test sale error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create sale",
      error: error.message,
    });
  }
});

/**
 * POST /api/test/customers
 * Simple customer creation without authentication
 */
router.post("/customers", async (req, res) => {
  try {
    const { name, phone, email, address, type } = req.body;

    // Basic validation
    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        message: "Name and phone are required",
      });
    }

    // Create mock customer
    const customer = {
      _id: `customer_${Date.now()}`,
      name: name.trim(),
      phone: phone.trim(),
      email: email?.trim() || "",
      address: address?.trim() || "",
      type: type || "Regular",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    console.log("Mock customer created:", {
      name: customer.name,
      phone: customer.phone,
      type: customer.type,
    });

    res.status(201).json({
      success: true,
      message: "Customer created successfully",
      data: customer,
    });
  } catch (error) {
    console.error("Test customer creation error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create customer",
      error: error.message,
    });
  }
});

module.exports = router;

/**
 * GET /api/test/purchases
 * Simple purchases data without authentication
 */
router.get("/purchases", async (req, res) => {
  try {
    const purchases = [
      {
        _id: "purchase1",
        purchaseNo: "PO-001",
        supplier: { name: "Medical Supplies Co" },
        purchaseDate: new Date(),
        totalAmount: 5000,
        paidAmount: 5000,
        dueAmount: 0,
        status: "Completed",
        items: [
          {
            productName: "Paracetamol 500mg",
            quantity: 100,
            rate: 2.5,
            total: 250,
          },
        ],
        createdAt: new Date(),
      },
      {
        _id: "purchase2",
        purchaseNo: "PO-002",
        supplier: { name: "Pharma Distributors" },
        purchaseDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        totalAmount: 3000,
        paidAmount: 2000,
        dueAmount: 1000,
        status: "Partial",
        items: [
          {
            productName: "Surgical Mask",
            quantity: 200,
            rate: 1.0,
            total: 200,
          },
        ],
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
    ];

    res.json({
      success: true,
      count: purchases.length,
      data: purchases,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/test/suppliers
 * Simple suppliers data without authentication
 */
router.get("/suppliers", async (req, res) => {
  try {
    const suppliers = [
      {
        _id: "supplier1",
        name: "Medical Supplies Co",
        company: "Medical Supplies Company Ltd",
        phone: "+880123456789",
        email: "contact@medicalsupplies.com",
        address: "123 Medical Street, Dhaka",
        isActive: true,
      },
      {
        _id: "supplier2",
        name: "Pharma Distributors",
        company: "Pharma Distributors Ltd",
        phone: "+880987654321",
        email: "info@pharmadist.com",
        address: "456 Pharma Avenue, Chittagong",
        isActive: true,
      },
      {
        _id: "supplier3",
        name: "Healthcare Equipment Ltd",
        company: "Healthcare Equipment Limited",
        phone: "+880555123456",
        email: "sales@healthequip.com",
        address: "789 Equipment Road, Sylhet",
        isActive: true,
      },
    ];

    res.json({
      success: true,
      count: suppliers.length,
      data: suppliers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/test/returns
 * Simple returns data without authentication
 */
router.get("/returns", async (req, res) => {
  try {
    const returns = [
      {
        _id: "return1",
        returnNo: "RET-001",
        saleInvoiceNo: "INV-001",
        customerName: "John Doe",
        returnDate: new Date(),
        totalAmount: 50,
        refundAmount: 50,
        status: "Completed",
        items: [
          {
            productName: "Paracetamol 500mg",
            quantity: 10,
            rate: 5.0,
            total: 50,
          },
        ],
        createdAt: new Date(),
      },
    ];

    res.json({
      success: true,
      count: returns.length,
      data: returns,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/test/returns/stats/summary
 * Simple return stats without authentication
 */
router.get("/returns/stats/summary", async (req, res) => {
  try {
    const stats = {
      totalReturns: 1,
      totalRefundAmount: 50,
      pendingReturns: 0,
      completedReturns: 1,
    };

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/test/stock
 * Simple stock data without authentication
 */
router.get("/stock", async (req, res) => {
  try {
    const stock = [
      {
        _id: "stock1",
        productId: "product1",
        productName: "Paracetamol 500mg",
        currentQty: 100,
        availableQty: 95,
        reservedQty: 5,
        minStockLevel: 20,
        isLowStock: false,
        lastUpdated: new Date(),
      },
      {
        _id: "stock2",
        productId: "product2",
        productName: "Surgical Mask",
        currentQty: 5,
        availableQty: 5,
        reservedQty: 0,
        minStockLevel: 50,
        isLowStock: true,
        lastUpdated: new Date(),
      },
    ];

    res.json({
      success: true,
      count: stock.length,
      data: stock,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/test/reports/stock
 * Simple stock report without authentication
 */
router.get("/reports/stock", async (req, res) => {
  try {
    const stockReport = [
      {
        _id: "product1",
        name: "Paracetamol 500mg",
        category: "Medicine",
        sku: "PAR500",
        currentQty: 100,
        minStockLevel: 20,
        purchasePrice: 2.5,
        sellingPrice: 5.0,
        stockValue: 250,
        isLowStock: false,
      },
      {
        _id: "product2",
        name: "Surgical Mask",
        category: "PPE",
        sku: "MASK001",
        currentQty: 5,
        minStockLevel: 50,
        purchasePrice: 1.0,
        sellingPrice: 2.5,
        stockValue: 5,
        isLowStock: true,
      },
    ];

    res.json({
      success: true,
      count: stockReport.length,
      data: stockReport,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/test/reports/stock-valuation
 * Simple stock valuation without authentication
 */
router.get("/reports/stock-valuation", async (req, res) => {
  try {
    const valuation = {
      totalPurchaseValue: 12000,
      totalSellingValue: 18000,
      totalProfit: 6000,
      profitMargin: 33.33,
      totalProducts: 150,
      totalItems: 5000,
    };

    res.json({
      success: true,
      data: valuation,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/test/reports/dashboard
 * Simple dashboard report without authentication
 */
router.get("/reports/dashboard", async (req, res) => {
  try {
    const dashboard = {
      todaySales: { totalSales: 225, totalOrders: 3 },
      monthlySales: { totalSales: 4500, totalOrders: 45 },
      lowStockProducts: [
        { name: "Surgical Mask", currentQty: 5, minStockLevel: 50 },
      ],
      totalProducts: 150,
    };

    res.json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/test/financial-reports/profit-loss
 * Simple profit-loss report without authentication
 */
router.get("/financial-reports/profit-loss", async (req, res) => {
  try {
    const profitLoss = {
      revenue: {
        sales: 45000,
        otherIncome: 1000,
        total: 46000,
      },
      expenses: {
        purchases: 30000,
        operatingExpenses: 5000,
        otherExpenses: 1000,
        total: 36000,
      },
      netProfit: 10000,
      profitMargin: 21.74,
    };

    res.json({
      success: true,
      data: profitLoss,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/test/financial-reports/daily-summary
 * Simple daily summary without authentication
 */
router.get("/financial-reports/daily-summary", async (req, res) => {
  try {
    const summary = {
      date: new Date(),
      sales: 225,
      purchases: 0,
      expenses: 50,
      profit: 175,
      transactions: 3,
    };

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/test/financial-reports/product-profitability
 * Simple product profitability without authentication
 */
router.get("/financial-reports/product-profitability", async (req, res) => {
  try {
    const profitability = [
      {
        productName: "Paracetamol 500mg",
        totalSold: 100,
        revenue: 500,
        cost: 250,
        profit: 250,
        profitMargin: 50,
      },
      {
        productName: "Digital Thermometer",
        totalSold: 25,
        revenue: 625,
        cost: 375,
        profit: 250,
        profitMargin: 40,
      },
    ];

    res.json({
      success: true,
      data: profitability,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/test/financial-reports/return-analysis
 * Simple return analysis without authentication
 */
router.get("/financial-reports/return-analysis", async (req, res) => {
  try {
    const analysis = {
      totalReturns: 1,
      totalRefundAmount: 50,
      returnRate: 2.22,
      topReturnedProducts: [
        { productName: "Paracetamol 500mg", returnCount: 1, refundAmount: 50 },
      ],
    };

    res.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/test/financial-reports/cash-flow
 * Simple cash flow without authentication
 */
router.get("/financial-reports/cash-flow", async (req, res) => {
  try {
    const cashFlow = {
      inflow: {
        sales: 45000,
        otherIncome: 1000,
        total: 46000,
      },
      outflow: {
        purchases: 30000,
        expenses: 6000,
        total: 36000,
      },
      netCashFlow: 10000,
    };

    res.json({
      success: true,
      data: cashFlow,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/test/expense-categories
 * Simple expense categories without authentication
 */
router.get("/expense-categories", async (req, res) => {
  try {
    const categories = [
      {
        _id: "cat1",
        name: "Office Supplies",
        description: "Office and stationery supplies",
        isActive: true,
        createdAt: new Date(),
      },
      {
        _id: "cat2",
        name: "Utilities",
        description: "Electricity, water, internet",
        isActive: true,
        createdAt: new Date(),
      },
      {
        _id: "cat3",
        name: "Marketing",
        description: "Advertising and marketing expenses",
        isActive: true,
        createdAt: new Date(),
      },
    ];

    res.json({
      success: true,
      count: categories.length,
      data: categories,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/test/settings
 * Simple settings without authentication
 */
router.get("/settings", async (req, res) => {
  try {
    const settings = {
      shop: {
        name: "Health Care Surgical Mart",
        address: "123 Medical Street, Dhaka",
        phone: "+880123456789",
        email: "info@healthcaremart.com",
      },
      notifications: {
        email: {
          enabled: false,
          host: "",
          port: 587,
          user: "",
        },
        sms: {
          enabled: false,
          provider: "",
          apiKey: "",
        },
      },
    };

    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});
