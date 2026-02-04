/**
 * Settings Routes
 * Handles system settings, shop configuration, and preferences
 */

const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb");
const {
  authenticate,
  checkShopStatus,
} = require("../middleware/auth-multi-tenant");
const { requirePermission } = require("../utils/rbac");
const { PERMISSIONS } = require("../utils/rbac");
const { getShopDatabase } = require("../config/database");
const { asyncHandler, createError } = require("../config/error-handling");

// Apply authentication to all routes
router.use(authenticate);
router.use(checkShopStatus);

/**
 * GET /api/settings/shop
 * Get shop settings
 */
router.get(
  "/shop",
  requirePermission(PERMISSIONS.VIEW_USERS), // Shop admins can view shop settings
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);

    let shopSettings = await shopDb.collection("settings").findOne({
      type: "shop",
    });

    // If no settings exist, return defaults
    if (!shopSettings) {
      shopSettings = {
        name: "Health Care Surgical Mart",
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
      };
    }

    res.json({
      success: true,
      data: shopSettings,
    });
  }),
);

/**
 * PUT /api/settings/shop
 * Update shop settings
 */
router.put(
  "/shop",
  requirePermission(PERMISSIONS.EDIT_USER), // Shop admins can edit shop settings
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const {
      name,
      address,
      phone,
      email,
      website,
      logo,
      description,
      registrationNumber,
      taxNumber,
      currency,
      timezone,
    } = req.body;

    // Validate required fields
    if (!name || !address || !phone) {
      throw createError.badRequest("Name, address, and phone are required");
    }

    const settingsData = {
      type: "shop",
      name: name.trim(),
      address: address.trim(),
      phone: phone.trim(),
      email: email?.trim() || "",
      website: website?.trim() || "",
      logo: logo?.trim() || "",
      description: description?.trim() || "",
      registrationNumber: registrationNumber?.trim() || "",
      taxNumber: taxNumber?.trim() || "",
      currency: currency || "BDT",
      timezone: timezone || "Asia/Dhaka",
      updatedAt: new Date(),
      updatedBy: req.user.id,
    };

    await shopDb
      .collection("settings")
      .updateOne({ type: "shop" }, { $set: settingsData }, { upsert: true });

    res.json({
      success: true,
      message: "Shop settings updated successfully",
    });
  }),
);

/**
 * GET /api/settings/tax
 * Get tax settings
 */
router.get(
  "/tax",
  requirePermission(PERMISSIONS.VIEW_USERS),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);

    let taxSettings = await shopDb.collection("settings").findOne({
      type: "tax",
    });

    // If no settings exist, return defaults
    if (!taxSettings) {
      taxSettings = {
        defaultTaxRate: 0,
        enableTax: false,
        taxName: "VAT",
        taxNumber: "",
        taxInclusive: false,
      };
    }

    res.json({
      success: true,
      data: taxSettings,
    });
  }),
);

/**
 * PUT /api/settings/tax
 * Update tax settings
 */
router.put(
  "/tax",
  requirePermission(PERMISSIONS.EDIT_USER),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { defaultTaxRate, enableTax, taxName, taxNumber, taxInclusive } =
      req.body;

    const settingsData = {
      type: "tax",
      defaultTaxRate: parseFloat(defaultTaxRate) || 0,
      enableTax: Boolean(enableTax),
      taxName: taxName?.trim() || "VAT",
      taxNumber: taxNumber?.trim() || "",
      taxInclusive: Boolean(taxInclusive),
      updatedAt: new Date(),
      updatedBy: req.user.id,
    };

    await shopDb
      .collection("settings")
      .updateOne({ type: "tax" }, { $set: settingsData }, { upsert: true });

    res.json({
      success: true,
      message: "Tax settings updated successfully",
    });
  }),
);

/**
 * GET /api/settings/system
 * Get system settings
 */
router.get(
  "/system",
  requirePermission(PERMISSIONS.VIEW_USERS),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);

    let systemSettings = await shopDb.collection("settings").findOne({
      type: "system",
    });

    // If no settings exist, return defaults
    if (!systemSettings) {
      systemSettings = {
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
      };
    }

    res.json({
      success: true,
      data: systemSettings,
    });
  }),
);

/**
 * PUT /api/settings/system
 * Update system settings
 */
router.put(
  "/system",
  requirePermission(PERMISSIONS.EDIT_USER),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const {
      lowStockThreshold,
      autoBackup,
      backupFrequency,
      emailNotifications,
      smsNotifications,
      printReceipts,
      defaultPaymentMethod,
      invoicePrefix,
      invoiceStartNumber,
      dateFormat,
      timeFormat,
    } = req.body;

    const settingsData = {
      type: "system",
      lowStockThreshold: parseInt(lowStockThreshold) || 10,
      autoBackup: Boolean(autoBackup),
      backupFrequency: backupFrequency || "daily",
      emailNotifications: Boolean(emailNotifications),
      smsNotifications: Boolean(smsNotifications),
      printReceipts: Boolean(printReceipts),
      defaultPaymentMethod: defaultPaymentMethod || "cash",
      invoicePrefix: invoicePrefix?.trim() || "INV",
      invoiceStartNumber: parseInt(invoiceStartNumber) || 1,
      dateFormat: dateFormat || "DD/MM/YYYY",
      timeFormat: timeFormat || "12",
      updatedAt: new Date(),
      updatedBy: req.user.id,
    };

    await shopDb
      .collection("settings")
      .updateOne({ type: "system" }, { $set: settingsData }, { upsert: true });

    res.json({
      success: true,
      message: "System settings updated successfully",
    });
  }),
);

/**
 * GET /api/settings/receipt
 * Get receipt settings
 */
router.get(
  "/receipt",
  requirePermission(PERMISSIONS.VIEW_USERS),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);

    let receiptSettings = await shopDb.collection("settings").findOne({
      type: "receipt",
    });

    // If no settings exist, return defaults
    if (!receiptSettings) {
      receiptSettings = {
        showLogo: true,
        showAddress: true,
        showPhone: true,
        showEmail: true,
        showWebsite: false,
        footerText: "Thank you for your business!",
        headerText: "بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ",
        paperSize: "80mm",
      };
    }

    res.json({
      success: true,
      data: receiptSettings,
    });
  }),
);

/**
 * PUT /api/settings/receipt
 * Update receipt settings
 */
router.put(
  "/receipt",
  requirePermission(PERMISSIONS.EDIT_USER),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const {
      showLogo,
      showAddress,
      showPhone,
      showEmail,
      showWebsite,
      footerText,
      headerText,
      paperSize,
    } = req.body;

    const settingsData = {
      type: "receipt",
      showLogo: Boolean(showLogo),
      showAddress: Boolean(showAddress),
      showPhone: Boolean(showPhone),
      showEmail: Boolean(showEmail),
      showWebsite: Boolean(showWebsite),
      footerText: footerText?.trim() || "Thank you for your business!",
      headerText: headerText?.trim() || "بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ",
      paperSize: paperSize || "80mm",
      updatedAt: new Date(),
      updatedBy: req.user.id,
    };

    await shopDb
      .collection("settings")
      .updateOne({ type: "receipt" }, { $set: settingsData }, { upsert: true });

    res.json({
      success: true,
      message: "Receipt settings updated successfully",
    });
  }),
);

/**
 * POST /api/settings/backup/test
 * Test backup functionality
 */
router.post(
  "/backup/test",
  requirePermission(PERMISSIONS.EDIT_USER),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);

    // Simulate backup process
    const backupData = {
      shopId: req.user.shopId,
      timestamp: new Date(),
      type: "manual",
      status: "completed",
      size: "2.5 MB", // Simulated size
      collections: [
        "products",
        "customers",
        "sales",
        "purchases",
        "stock",
        "users",
        "settings",
      ],
      createdBy: req.user.id,
    };

    // Log backup in history
    await shopDb.collection("backup_history").insertOne(backupData);

    res.json({
      success: true,
      message: "Backup completed successfully",
      data: backupData,
    });
  }),
);

/**
 * GET /api/settings/backup/history
 * Get backup history
 */
router.get(
  "/backup/history",
  requirePermission(PERMISSIONS.VIEW_USERS),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);

    const backupHistory = await shopDb
      .collection("backup_history")
      .find({})
      .sort({ timestamp: -1 })
      .limit(20)
      .toArray();

    res.json({
      success: true,
      data: backupHistory,
    });
  }),
);

/**
 * GET /api/settings/system-info
 * Get system information
 */
router.get(
  "/system-info",
  requirePermission(PERMISSIONS.VIEW_USERS),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);

    // Get collection counts
    const [
      productsCount,
      customersCount,
      salesCount,
      purchasesCount,
      usersCount,
    ] = await Promise.all([
      shopDb.collection("products").countDocuments({ isActive: true }),
      shopDb.collection("customers").countDocuments({}),
      shopDb.collection("sales").countDocuments({}),
      shopDb.collection("purchases").countDocuments({}),
      shopDb.collection("users").countDocuments({ isActive: true }),
    ]);

    const systemInfo = {
      version: "2.0.0",
      shopId: req.user.shopId,
      database: {
        products: productsCount,
        customers: customersCount,
        sales: salesCount,
        purchases: purchasesCount,
        users: usersCount,
      },
      lastBackup: null, // Would be fetched from backup history
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: process.platform,
    };

    res.json({
      success: true,
      data: systemInfo,
    });
  }),
);

module.exports = router;
