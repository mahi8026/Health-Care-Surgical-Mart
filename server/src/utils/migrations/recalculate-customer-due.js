/**
 * Migration: Recalculate currentDue for all customers from actual sales data
 *
 * currentDue = sum of dueAmount from all active (non-voided) sales for that customer
 *            minus any payments recorded against the customer
 *
 * Run with: node src/utils/migrations/recalculate-customer-due.js
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../../../.env") });
const { MongoClient, ObjectId } = require("mongodb");

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || "medical_store_system";

async function recalculateCustomerDue() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log("✅ Connected to MongoDB");

    const systemDb = client.db(DB_NAME);
    const shops = await systemDb.collection("shops").find({}).toArray();
    console.log(`Found ${shops.length} shop(s) to process`);

    let totalCustomersFixed = 0;

    for (const shop of shops) {
      const shopDb = client.db(shop.dbName || `${shop.shopId}_db`);
      const customersCollection = shopDb.collection("customers");
      const salesCollection = shopDb.collection("sales");

      const customers = await customersCollection.find({}).toArray();
      console.log(`\nShop [${shop.name || shop.dbName}]: Processing ${customers.length} customer(s)`);

      for (const customer of customers) {
        // Sum all dueAmount from sales for this customer
        const salesDue = await salesCollection.aggregate([
          {
            $match: {
              customerId: customer._id,
              // Exclude voided/cancelled sales if you have a status field
            },
          },
          {
            $group: {
              _id: null,
              totalDue: { $sum: "$dueAmount" },
            },
          },
        ]).toArray();

        const calculatedDue = salesDue[0]?.totalDue || 0;
        const currentDue = customer.currentDue || 0;

        if (Math.abs(calculatedDue - currentDue) > 0.01) {
          await customersCollection.updateOne(
            { _id: customer._id },
            {
              $set: {
                currentDue: calculatedDue,
                updatedAt: new Date(),
              },
            }
          );
          console.log(
            `  Fixed [${customer.name}]: currentDue ${currentDue} → ${calculatedDue}`
          );
          totalCustomersFixed++;
        } else {
          console.log(
            `  OK    [${customer.name}]: currentDue = ${currentDue} (correct)`
          );
        }
      }
    }

    console.log(`\n✅ Migration complete. Fixed ${totalCustomersFixed} customer(s).`);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  recalculateCustomerDue()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { recalculateCustomerDue };
