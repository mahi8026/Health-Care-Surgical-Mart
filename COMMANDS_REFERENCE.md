# COMMAND REFERENCE - Healthcare POS System

Quick reference for common maintenance tasks.

---

## 🔧 DAILY OPERATIONS

### Check System Health
```bash
# Backend health
curl https://health-care-surgical-mart.onrender.com/api/health

# Auth system health
curl https://health-care-surgical-mart.onrender.com/api/auth/health

# Expected: All checks should return "ok"
```

### View Logs (Render)
1. Go to: https://dashboard.render.com
2. Select: health-care-surgical-mart
3. Click: Logs
4. Filter by: ERROR, WARN, or INFO

---

## 📊 STOCK INTEGRITY

### Run Integrity Check
```bash
# From project root
cd server
node src/scripts/verify-stock-integrity.js <shopId>

# Example:
node src/scripts/verify-stock-integrity.js 67669b0a291313bb3ffd7a47
```

### Output Interpretation
```
Products Checked: 150         ← Total products verified
Missing Snapshots: 0          ← Should be 0
Ledger Discrepancies: 2       ← Differences found
Batch Discrepancies: 0        ← Should be 0
Negative Quantities: 0        ← Should be 0
Snapshots Fixed: 2            ← Auto-corrected
```

**If all zeros except "Products Checked"** → ✅ All good  
**If any discrepancies found** → Script auto-fixes them

---

## 🗄️ DATABASE COMMANDS

### Connect to MongoDB
```bash
# Using MongoDB Compass (GUI)
Connection String: <your-atlas-connection-string>

# Using mongo shell
mongo "<your-atlas-connection-string>"
use health_care_pos_system
```

### Useful Queries

#### 1. Find a Shop
```javascript
db.shops.find({ name: "Health Care" })
// Returns: { _id, shopId, name, status, ... }
```

#### 2. Check Invoice Numbers
```javascript
// Last 10 invoices
db.sales.find({})
  .sort({ createdAt: -1 })
  .limit(10)
  .projection({ invoiceNo: 1, grandTotal: 1, saleDate: 1 })

// Check for duplicates
db.sales.aggregate([
  { $group: { _id: "$invoiceNo", count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } }
])
// Should return: []
```

#### 3. Check Stock Levels
```javascript
// Products with stock
db.stock_snapshots.find(
  { onHandQty: { $gt: 0 } },
  { productName: 1, onHandQty: 1, reorderPoint: 1 }
).sort({ onHandQty: 1 })

// Low stock items
db.stock_snapshots.find({
  $expr: { $lte: ["$onHandQty", "$reorderPoint"] }
})

// Negative stock (should be 0)
db.stock_snapshots.find({ onHandQty: { $lt: 0 } }).count()
```

#### 4. Check Recent Sales
```javascript
// Today's sales
const today = new Date();
today.setHours(0, 0, 0, 0);

db.sales.find(
  { saleDate: { $gte: today } },
  { invoiceNo: 1, grandTotal: 1, customerName: 1 }
).sort({ saleDate: -1 })

// Today's total
db.sales.aggregate([
  { $match: { saleDate: { $gte: today }, paymentStatus: "Paid" } },
  { $group: { _id: null, total: { $sum: "$grandTotal" }, count: { $sum: 1 } } }
])
```

#### 5. Check Expiring Items
```javascript
// Next 30 days
const futureDate = new Date();
futureDate.setDate(futureDate.getDate() + 30);

db.stock_batches.find({
  status: "ACTIVE",
  quantity: { $gt: 0 },
  expiryDate: { $lte: futureDate, $gte: new Date() }
}).sort({ expiryDate: 1 })
```

---

## 🔒 DATABASE INDEXES

### Add Invoice Uniqueness (One-time)
```javascript
// Prevent duplicate invoice numbers
db.sales.createIndex(
  { invoiceNo: 1 },
  { unique: true, background: true }
)

// Verify index created
db.sales.getIndexes()
```

### Performance Indexes (Recommended)
```javascript
// Speed up product searches
db.products.createIndex({ sku: 1 }, { background: true })
db.products.createIndex({ name: "text" }, { background: true })

// Speed up sales queries
db.sales.createIndex({ saleDate: -1 }, { background: true })
db.sales.createIndex({ customerId: 1, saleDate: -1 }, { background: true })

// Speed up stock queries
db.stock_snapshots.createIndex({ productId: 1 }, { unique: true, background: true })
db.stock_ledger.createIndex({ productId: 1, timestamp: -1 }, { background: true })
```

---

## 🚨 EMERGENCY FIXES

### Fix Wrong Stock Quantity

**Step 1: Calculate Correct Balance**
```javascript
// Find the product
const productId = ObjectId("...");

// Calculate from ledger
const ledgerBalance = db.stock_ledger.aggregate([
  { $match: { productId: productId } },
  {
    $group: {
      _id: null,
      balance: {
        $sum: {
          $cond: [
            { $eq: ["$direction", "IN"] },
            "$quantity",
            { $cond: [
                { $eq: ["$direction", "OUT"] },
                { $multiply: ["$quantity", -1] },
                0
              ] }
          ]
        }
      }
    }
  }
]).toArray();

print("Correct balance:", ledgerBalance[0].balance);
```

**Step 2: Update Snapshot**
```javascript
db.stock_snapshots.updateOne(
  { productId: productId },
  { 
    $set: { 
      onHandQty: ledgerBalance[0].balance,
      availableQty: ledgerBalance[0].balance,
      updatedAt: new Date()
    } 
  }
)
```

**Step 3: Create Correction Entry**
```javascript
// Get current snapshot version
const snapshot = db.stock_snapshots.findOne({ productId: productId });

db.stock_ledger.insertOne({
  productId: productId,
  movementType: "ADJUSTMENT_CORRECTION",
  direction: "IN", // or "OUT" depending on correction
  quantity: Math.abs(ledgerBalance[0].balance - snapshot.onHandQty),
  runningBalance: ledgerBalance[0].balance,
  version: snapshot.lastLedgerVersion + 1,
  referenceType: "MANUAL_FIX",
  referenceId: null,
  timestamp: new Date(),
  note: "Emergency correction: [describe reason]",
  metadata: { manual: true, fixedBy: "admin", reason: "..." }
})
```

---

### Reset Invoice Counter (DANGEROUS!)
```javascript
// ⚠️ ONLY if invoice numbers are completely broken

// 1. Find the highest invoice number
const lastSale = db.sales.find().sort({ invoiceNo: -1 }).limit(1).toArray()[0];
print("Last invoice:", lastSale.invoiceNo);

// 2. Extract the number (format: SHOP1-SALE-00123)
const lastNum = parseInt(lastSale.invoiceNo.split('-').pop());
print("Last number:", lastNum);

// 3. Reset counter to next number
db.counters.updateOne(
  { _id: "invoiceNumber" },
  { 
    $set: { 
      seq: lastNum + 1,
      updatedAt: new Date()
    } 
  },
  { upsert: true }
)
```

---

### Delete Test Sales (Development Only)
```javascript
// ⚠️ NEVER run in production!

// Delete test sales
db.sales.deleteMany({ 
  customerName: { $regex: /test/i }
})

// Or delete by date range
db.sales.deleteMany({
  saleDate: {
    $gte: new Date("2026-01-01"),
    $lt: new Date("2026-01-02")
  }
})

// ⚠️ Remember to also delete related stock movements!
```

---

## 📁 BACKUP & RESTORE

### Manual Backup (MongoDB Atlas)
1. Go to: MongoDB Atlas Dashboard
2. Cluster → Backup
3. Click: "Take Snapshot Now"
4. Name: `manual_backup_YYYY-MM-DD`

### Automated Backup (Recommended)
```javascript
// Schedule via MongoDB Atlas:
// 1. Cluster → Backup
// 2. Enable: Continuous Backup
// 3. Set retention: 7 days minimum
```

### Export Specific Collection
```bash
# Export sales data
mongoexport \
  --uri="<your-connection-string>" \
  --collection=sales \
  --out=sales_backup_2026-06-21.json

# Export all collections
mongodump \
  --uri="<your-connection-string>" \
  --out=./backup_2026-06-21/
```

### Restore from Backup
```bash
# Restore single collection
mongoimport \
  --uri="<your-connection-string>" \
  --collection=sales \
  --file=sales_backup_2026-06-21.json

# Restore full database
mongorestore \
  --uri="<your-connection-string>" \
  --dir=./backup_2026-06-21/
```

---

## 🔍 DEBUGGING

### Check API Response
```bash
# Test endpoint
curl -X GET "https://health-care-surgical-mart.onrender.com/api/products" \
  -H "Authorization: Bearer <your-jwt-token>" \
  | jq .

# Test with verbose output
curl -v -X POST "https://health-care-surgical-mart.onrender.com/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### Find Slow Queries (MongoDB)
```javascript
// Enable profiling (temporarily)
db.setProfilingLevel(1, { slowms: 100 })

// View slow queries
db.system.profile.find({ millis: { $gt: 100 } }).sort({ ts: -1 }).limit(10)

// Disable profiling
db.setProfilingLevel(0)
```

### Check Render Deployment
```bash
# View deployment status
render login
render services list

# View logs (last 100 lines)
render logs health-care-surgical-mart --tail 100

# Restart service
render services restart health-care-surgical-mart
```

---

## 📊 USEFUL REPORTS

### Sales Summary (Today)
```javascript
const today = new Date();
today.setHours(0, 0, 0, 0);

db.sales.aggregate([
  { $match: { saleDate: { $gte: today }, paymentStatus: "Paid" } },
  {
    $group: {
      _id: null,
      totalSales: { $sum: "$grandTotal" },
      totalOrders: { $sum: 1 },
      cashSales: { $sum: { $cond: [{ $eq: ["$paymentMethod", "cash"] }, "$grandTotal", 0] } },
      cardSales: { $sum: { $cond: [{ $eq: ["$paymentMethod", "card"] }, "$grandTotal", 0] } }
    }
  }
])
```

### Top Selling Products (Last 30 Days)
```javascript
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

db.sales.aggregate([
  { $match: { saleDate: { $gte: thirtyDaysAgo }, paymentStatus: "Paid" } },
  { $unwind: "$items" },
  {
    $group: {
      _id: "$items.name",
      totalQty: { $sum: "$items.qty" },
      totalRevenue: { $sum: "$items.total" }
    }
  },
  { $sort: { totalQty: -1 } },
  { $limit: 10 }
])
```

### Customer Purchase Summary
```javascript
db.sales.aggregate([
  { $match: { customerId: { $exists: true, $ne: null } } },
  {
    $group: {
      _id: "$customerId",
      customerName: { $first: "$customerName" },
      totalPurchases: { $sum: "$grandTotal" },
      orderCount: { $sum: 1 },
      lastPurchase: { $max: "$saleDate" }
    }
  },
  { $sort: { totalPurchases: -1 } },
  { $limit: 20 }
])
```

---

## 🔑 ENVIRONMENT VARIABLES

### Required for Production
```bash
# Backend (.env)
NODE_ENV=production
PORT=10000
MONGODB_URI=<your-atlas-connection-string>
JWT_SECRET=<32-char-minimum-secret>
FIREBASE_PROJECT_ID=<your-project-id>
FIREBASE_PRIVATE_KEY=<your-private-key>
FIREBASE_CLIENT_EMAIL=<your-client-email>
ALLOWED_ORIGINS=https://health-care-60ee6.web.app

# Frontend (.env)
VITE_API_URL=https://health-care-surgical-mart.onrender.com
VITE_FIREBASE_API_KEY=<your-api-key>
VITE_FIREBASE_AUTH_DOMAIN=<your-auth-domain>
VITE_FIREBASE_PROJECT_ID=<your-project-id>
```

### Verify Environment
```bash
# Backend
curl https://health-care-surgical-mart.onrender.com/api/auth/health

# Expected:
{
  "status": "healthy",
  "checks": {
    "firebaseAdmin": "ok",
    "mongodbConnection": "ok",
    "jwtSecret": "set"
  }
}
```

---

## 📞 SUPPORT CONTACTS

### Technical Issues
- **Server errors:** Check Render logs
- **Database issues:** MongoDB Atlas → View Metrics
- **Auth problems:** Check `/api/auth/health`
- **Stock errors:** Run integrity script

### Emergency Contacts
- **System down:** Check Render status page
- **Data corruption:** Restore from backup
- **Security breach:** Revoke all tokens, rotate secrets

---

**Last Updated:** June 21, 2026  
**Maintained by:** Development Team  
**System:** Health Care POS v1.0
