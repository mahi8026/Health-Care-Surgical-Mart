/**
 * Multi-Tenant Authentication Routes
 * Login for all user types
 */

const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const { getShopDatabase, getSystemDatabase } = require("../config/database");
const { generateToken } = require("../middleware/auth-multi-tenant");

/**
 * POST /api/auth/login
 * Login for all user types
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password, shopId } = req.body;

    console.log("Login attempt:", { email, hasPassword: !!password, shopId });

    if (!email || !password) {
      console.log("Missing email or password");
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    let user;
    let userDb;

    // Check if super admin login
    const systemDb = getSystemDatabase();
    const superAdmin = await systemDb
      .collection("system_users")
      .findOne({ email });

    if (superAdmin && superAdmin.role === "SUPER_ADMIN") {
      user = superAdmin;
      userDb = "system";
    } else {
      // Shop user login - try to find shopId automatically
      let targetShopId = shopId;

      if (!targetShopId) {
        // Auto-detect shopId by searching all shops for this email
        console.log(`Auto-detecting shopId for email: ${email}`);
        const shops = await systemDb
          .collection("shops")
          .find({ status: "Active" })
          .toArray();

        console.log(
          `Found ${shops.length} active shops:`,
          shops.map((s) => ({ shopId: s.shopId, ownerEmail: s.ownerEmail })),
        );

        // First check if email matches shop owner email
        for (const shop of shops) {
          console.log(
            `Checking shop ${shop.shopId}: ${shop.ownerEmail} === ${email}?`,
            shop.ownerEmail === email,
          );
          if (shop.ownerEmail === email) {
            targetShopId = shop.shopId;
            console.log(
              `Found shopId: ${targetShopId} for owner email: ${email}`,
            );
            break;
          }
        }

        // If not found as owner, search in each shop's users collection
        if (!targetShopId) {
          for (const shop of shops) {
            try {
              const shopDb = getShopDatabase(shop.shopId);
              const shopUser = await shopDb
                .collection("users")
                .findOne({ email });
              if (shopUser) {
                targetShopId = shop.shopId;
                console.log(
                  `Found shopId: ${targetShopId} for user email: ${email}`,
                );
                break;
              }
            } catch (error) {
              console.log(`Error checking shop ${shop.shopId}:`, error.message);
            }
          }
        }

        if (!targetShopId) {
          return res.status(400).json({
            success: false,
            message: "Shop not found for this email. Please contact support.",
          });
        }
      }

      // Verify shop exists
      const shop = await systemDb
        .collection("shops")
        .findOne({ shopId: targetShopId });
      if (!shop) {
        return res.status(404).json({
          success: false,
          message: "Shop not found",
        });
      }

      if (shop.status !== "Active") {
        return res.status(403).json({
          success: false,
          message: `Shop is ${shop.status.toLowerCase()}. Please contact support.`,
        });
      }

      // Get user from shop database
      const shopDb = getShopDatabase(targetShopId);
      console.log("Getting user from shop database:", targetShopId);
      user = await shopDb.collection("users").findOne({ email });
      console.log("User found in shop DB:", !!user);
      if (user) {
        console.log("User details:", {
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
        });
      }
      userDb = targetShopId;
    }

    console.log("Final user check - user exists:", !!user);
    if (!user) {
      console.log("Returning 401 - user not found");
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Verify password
    console.log("Verifying password for user:", email);
    console.log("User has passwordHash:", !!user.passwordHash);
    console.log("Password hash length:", user.passwordHash?.length);
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    console.log("Password valid:", isPasswordValid);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: "User account is inactive",
      });
    }

    // Update last login
    if (userDb === "system") {
      await systemDb
        .collection("system_users")
        .updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });
    } else {
      const shopDb = getShopDatabase(userDb);
      await shopDb
        .collection("users")
        .updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });
    }

    // Generate token
    const token = generateToken(user);

    res.json({
      success: true,
      message: "Login successful",
      data: {
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          shopId: user.shopId || null,
        },
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Login failed",
    });
  }
});

/**
 * POST /api/auth/change-password
 * Change user password
 */
router.post("/change-password", async (req, res) => {
  try {
    const { email, oldPassword, newPassword, shopId } = req.body;

    if (!email || !oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters",
      });
    }

    let user;
    let collection;

    // Determine if super admin or shop user
    const systemDb = getSystemDatabase();
    const superAdmin = await systemDb
      .collection("system_users")
      .findOne({ email });

    if (superAdmin && superAdmin.role === "SUPER_ADMIN") {
      user = superAdmin;
      collection = systemDb.collection("system_users");
    } else {
      if (!shopId) {
        return res.status(400).json({
          success: false,
          message: "Shop ID is required",
        });
      }

      const shopDb = getShopDatabase(shopId);
      user = await shopDb.collection("users").findOne({ email });
      collection = shopDb.collection("users");
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Verify old password
    const isOldPasswordValid = await bcrypt.compare(
      oldPassword,
      user.passwordHash,
    );
    if (!isOldPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Old password is incorrect",
      });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await collection.updateOne(
      { _id: user._id },
      {
        $set: {
          passwordHash: newPasswordHash,
          updatedAt: new Date(),
        },
      },
    );

    res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to change password",
    });
  }
});

/**
 * POST /api/auth/firebase-login
 * Login with Firebase token
 */
router.post("/firebase-login", async (req, res) => {
  try {
    const { email, shopId } = req.body;

    console.log("Firebase login attempt:", { email, shopId });

    if (!email) {
      console.log("Missing email");
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    // Note: In production, you should verify the Firebase token here
    // For now, we trust that the frontend has already authenticated with Firebase

    let user;
    let userDb;

    // Check if super admin login
    const systemDb = getSystemDatabase();
    const superAdmin = await systemDb
      .collection("system_users")
      .findOne({ email });

    if (superAdmin && superAdmin.role === "SUPER_ADMIN") {
      user = superAdmin;
      userDb = "system";
    } else {
      // Shop user login - try to find shopId automatically
      let targetShopId = shopId;

      if (!targetShopId) {
        // Auto-detect shopId by searching all shops for this email
        console.log(`Auto-detecting shopId for email: ${email}`);
        const shops = await systemDb
          .collection("shops")
          .find({ status: "Active" })
          .toArray();

        // First check if email matches shop owner email
        for (const shop of shops) {
          if (shop.ownerEmail === email) {
            targetShopId = shop.shopId;
            console.log(
              `Found shopId: ${targetShopId} for owner email: ${email}`,
            );
            break;
          }
        }

        // If not found as owner, search in each shop's users collection
        if (!targetShopId) {
          for (const shop of shops) {
            try {
              const shopDb = getShopDatabase(shop.shopId);
              const shopUser = await shopDb
                .collection("users")
                .findOne({ email });
              if (shopUser) {
                targetShopId = shop.shopId;
                console.log(
                  `Found shopId: ${targetShopId} for user email: ${email}`,
                );
                break;
              }
            } catch (error) {
              console.log(`Error checking shop ${shop.shopId}:`, error.message);
            }
          }
        }

        if (!targetShopId) {
          return res.status(400).json({
            success: false,
            message:
              "User not found in system. Please contact administrator to add your account.",
          });
        }
      }

      // Verify shop exists
      const shop = await systemDb
        .collection("shops")
        .findOne({ shopId: targetShopId });
      if (!shop) {
        return res.status(404).json({
          success: false,
          message: "Shop not found",
        });
      }

      if (shop.status !== "Active") {
        return res.status(403).json({
          success: false,
          message: `Shop is ${shop.status.toLowerCase()}. Please contact support.`,
        });
      }

      // Get user from shop database
      const shopDb = getShopDatabase(targetShopId);
      console.log("Getting user from shop database:", targetShopId);
      user = await shopDb.collection("users").findOne({ email });
      console.log("User found in shop DB:", !!user);
      userDb = targetShopId;
    }

    console.log("Final user check - user exists:", !!user);
    if (!user) {
      console.log("Returning 401 - user not found");
      return res.status(401).json({
        success: false,
        message: "User not found in system. Please contact administrator.",
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: "User account is inactive",
      });
    }

    // Update last login
    if (userDb === "system") {
      await systemDb
        .collection("system_users")
        .updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });
    } else {
      const shopDb = getShopDatabase(userDb);
      await shopDb
        .collection("users")
        .updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });
    }

    // Generate token
    const token = generateToken(user);

    res.json({
      success: true,
      message: "Login successful",
      data: {
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          shopId: user.shopId || null,
        },
      },
    });
  } catch (error) {
    console.error("Firebase login error:", error);
    res.status(500).json({
      success: false,
      message: "Login failed",
    });
  }
});

module.exports = router;
