/**
 * Promote Mahi M Rahman to SUPER_ADMIN
 * - Creates entry in system_users collection
 * - Keeps existing SHOP_ADMIN entry (for reference)
 */
const { MongoClient, ObjectId } = require("mongodb");
require("dotenv").config({ path: "./server/.env" });

const TARGET_EMAIL = "mahimrahman07@gmail.com";
const TARGET_NAME = "Mahi M Rahman";

async function promoteToSuperAdmin() {
  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();
    const db = client.db("Health_Care_Shop_DB");

    // Step 1: Find the user in the shop users collection
    const cols = await db.listCollections().toArray();
    const userCols = cols.filter(c => c.name.endsWith("_users") && c.name !== "system_users");

    let existingShopUser = null;
    let foundInCollection = null;

    for (const col of userCols) {
      const user = await db.collection(col.name).findOne({ email: TARGET_EMAIL });
      if (user) {
        existingShopUser = user;
        foundInCollection = col.name;
        break;
      }
    }

    console.log("=".repeat(50));

    if (existingShopUser) {
      console.log(`✅ Found existing user in: ${foundInCollection}`);
      console.log(`   Name : ${existingShopUser.name}`);
      console.log(`   Email: ${existingShopUser.email}`);
      console.log(`   Role : ${existingShopUser.role}`);
    } else {
      console.log(`ℹ️  No existing shop user found for ${TARGET_EMAIL}`);
    }

    // Step 2: Check if already in system_users
    const existingSuper = await db.collection("system_users").findOne({ email: TARGET_EMAIL });

    if (existingSuper) {
      console.log(`\n⚠️  User already exists in system_users!`);
      console.log(`   Role: ${existingSuper.role}`);

      if (existingSuper.role !== "SUPER_ADMIN") {
        // Upgrade to SUPER_ADMIN
        await db.collection("system_users").updateOne(
          { email: TARGET_EMAIL },
          { $set: { role: "SUPER_ADMIN", isActive: true, updatedAt: new Date() } }
        );
        console.log(`✅ Upgraded role to SUPER_ADMIN`);
      } else {
        console.log(`✅ Already SUPER_ADMIN — no changes needed`);
      }
      return;
    }

    // Step 3: Create new SUPER_ADMIN entry in system_users
    const superAdminDoc = {
      _id: new ObjectId(),
      name: existingShopUser?.name || TARGET_NAME,
      email: TARGET_EMAIL,
      role: "SUPER_ADMIN",
      isActive: true,
      // Copy passwordHash if exists (for password login fallback)
      passwordHash: existingShopUser?.passwordHash || null,
      // Firebase UID if available
      firebaseUid: existingShopUser?.firebaseUid || null,
      shopId: null,        // SUPER_ADMIN has no shopId
      permissions: [],     // SUPER_ADMIN has all permissions by role
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLogin: existingShopUser?.lastLogin || null,
    };

    await db.collection("system_users").insertOne(superAdminDoc);

    console.log(`\n✅ Successfully added to SUPER_ADMIN!`);
    console.log(`   Name  : ${superAdminDoc.name}`);
    console.log(`   Email : ${superAdminDoc.email}`);
    console.log(`   Role  : ${superAdminDoc.role}`);
    console.log(`   Active: Yes`);

    // Step 4: Verify
    const verify = await db.collection("system_users").findOne({ email: TARGET_EMAIL });
    console.log(`\n✅ Verification: Found in system_users with role = ${verify.role}`);

    // Step 5: Count all super admins
    const allSuper = await db.collection("system_users").find({ role: "SUPER_ADMIN" }).toArray();
    console.log(`\n📊 Total SUPER_ADMINs now: ${allSuper.length}`);
    allSuper.forEach((u, i) => {
      console.log(`   ${i + 1}. ${u.name} | ${u.email} | ${u.isActive ? "Active" : "Inactive"}`);
    });

    console.log("\n" + "=".repeat(50));
    console.log("🎉 Done! Login with:");
    console.log(`   Email   : ${TARGET_EMAIL}`);
    console.log(`   Password: (your existing password)`);
    console.log(`   Type    : Super Admin`);
    console.log("=".repeat(50));

  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    await client.close();
  }
}

promoteToSuperAdmin();
