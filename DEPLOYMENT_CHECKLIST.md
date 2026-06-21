# DEPLOYMENT CHECKLIST - Healthcare POS System
## Pre-Production Launch Verification

**Date:** ____________  
**Completed By:** ____________  
**System:** Health Care Surgical Mart POS  

---

## ✅ PHASE 0: PRE-DEPLOYMENT PREPARATION

### Documentation Review
- [ ] Read `AUDIT_SUMMARY_EXECUTIVE.md` (10 min)
- [ ] Review `PRODUCTION_READY_REPORT.md` sections 1-5 (30 min)
- [ ] Read `QUICK_START_FIXES.md` (5 min)
- [ ] Bookmark `COMMANDS_REFERENCE.md` for quick access

### Environment Verification
- [ ] Backend `.env` file has all required variables
- [ ] Frontend `.env` file configured correctly
- [ ] MongoDB Atlas connection string is correct
- [ ] Firebase credentials are valid
- [ ] JWT_SECRET is at least 32 characters
- [ ] ALLOWED_ORIGINS includes production domain

**Commands to verify:**
```bash
# Backend health
curl https://health-care-surgical-mart.onrender.com/api/health

# Auth health
curl https://health-care-surgical-mart.onrender.com/api/auth/health
```

**Expected Results:**
```json
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

## ✅ PHASE 1: CRITICAL FIXES VERIFICATION (30 minutes)

### 1.1 Product Deletion Protection
**Test:** Try to delete a product with stock

```bash
# Find a product with stock
curl -X GET "https://health-care-surgical-mart.onrender.com/api/products" \
  -H "Authorization: Bearer <token>" | jq '.data[] | select(.stockQuantity > 0) | {_id, name, stockQuantity}'

# Try to delete it (should fail with 409)
curl -X DELETE "https://health-care-surgical-mart.onrender.com/api/products/<product-id>" \
  -H "Authorization: Bearer <token>"
```

**Expected Response:**
```json
{
  "success": false,
  "message": "Cannot delete product. It has X units in stock.",
  "statusCode": 409
}
```

- [ ] ✅ Returns 409 error
- [ ] ✅ Shows clear error message with quantity
- [ ] ✅ Product NOT deleted from database

### 1.2 Auth Permissions Field
**Test:** Check all auth endpoints return permissions

```bash
# Test login
curl -X POST "https://health-care-surgical-mart.onrender.com/api/auth/firebase-login" \
  -H "Content-Type: application/json" \
  -d '{"email":"<test-email>","idToken":"<firebase-token>"}' | jq '.data.user.permissions'

# Test /me endpoint
curl -X GET "https://health-care-surgical-mart.onrender.com/api/auth/me" \
  -H "Authorization: Bearer <token>" | jq '.data.user.permissions'
```

**Expected Response:**
```json
{
  "data": {
    "user": {
      "_id": "...",
      "name": "...",
      "email": "...",
      "role": "SHOP_ADMIN",
      "shopId": "...",
      "permissions": ["VIEW_PRODUCTS", "CREATE_SALE", "..."]
    }
  }
}
```

- [ ] ✅ POST `/api/auth/login` returns permissions array
- [ ] ✅ POST `/api/auth/firebase-login` returns permissions array
- [ ] ✅ GET `/api/auth/me` returns permissions array
- [ ] ✅ Permissions array is not empty for valid users

### 1.3 Stock Integrity Check
**Test:** Run the integrity verification script

```bash
# From project root
node run-integrity-check.js
```

**Review Output:**
- [ ] ✅ Script completes without errors
- [ ] ✅ Products Checked > 0
- [ ] ✅ Missing Snapshots = 0 (or auto-created)
- [ ] ✅ Ledger Discrepancies = 0 (or auto-fixed)
- [ ] ✅ Batch Discrepancies = 0 (or auto-fixed)
- [ ] ✅ Negative Quantities = 0 (or auto-fixed)
- [ ] ✅ JSON results file generated

**If any issues found:**
- [ ] Review the discrepancies in detail
- [ ] Verify auto-fixes are correct
- [ ] Run script again to confirm fixes

---

## ✅ PHASE 2: DATABASE INTEGRITY (20 minutes)

### 2.1 Add Invoice Number Uniqueness
```javascript
// Connect to MongoDB Atlas
use Health_Care_Shop_DB

// Add unique index
db.sales.createIndex(
  { invoiceNo: 1 },
  { unique: true, background: true }
)

// Verify index
db.sales.getIndexes()
```

- [ ] ✅ Index created successfully
- [ ] ✅ Index appears in getIndexes() output
- [ ] ✅ No duplicate invoices exist (check first)

### 2.2 Check for Data Anomalies
```javascript
// Check for duplicate invoices
db.sales.aggregate([
  { $group: { _id: "$invoiceNo", count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } }
])
// Expected: []

// Check for negative stock
db.stock_snapshots.find({ onHandQty: { $lt: 0 } }).count()
// Expected: 0

// Check for orphaned snapshots
db.stock_snapshots.aggregate([
  {
    $lookup: {
      from: "products",
      localField: "productId",
      foreignField: "_id",
      as: "product"
    }
  },
  { $match: { product: { $size: 0 } } }
])
// Expected: []
```

- [ ] ✅ No duplicate invoice numbers
- [ ] ✅ No negative stock quantities
- [ ] ✅ No orphaned stock snapshots
- [ ] ✅ All products have corresponding snapshots

### 2.3 Performance Indexes (Optional but Recommended)
```javascript
// Add performance indexes
db.products.createIndex({ sku: 1 }, { background: true })
db.products.createIndex({ name: "text" }, { background: true })
db.sales.createIndex({ saleDate: -1 }, { background: true })
db.sales.createIndex({ customerId: 1, saleDate: -1 }, { background: true })
db.stock_ledger.createIndex({ productId: 1, timestamp: -1 }, { background: true })
```

- [ ] ✅ All indexes created
- [ ] ✅ No errors during creation
- [ ] ✅ Indexes verified with getIndexes()

---

## ✅ PHASE 3: FUNCTIONAL TESTING (45 minutes)

### 3.1 Authentication Flow
**Test as Shop Admin:**
- [ ] ✅ Can login with Firebase
- [ ] ✅ Can login with password
- [ ] ✅ Receives valid JWT token
- [ ] ✅ Token includes permissions
- [ ] ✅ Can access /me endpoint
- [ ] ✅ Can logout successfully
- [ ] ✅ Cannot access with expired token (401)

**Test as Staff:**
- [ ] ✅ Can login
- [ ] ✅ Has limited permissions
- [ ] ✅ Cannot access admin-only features

### 3.2 Product Management
- [ ] ✅ Can view product list
- [ ] ✅ Can search products by name/SKU
- [ ] ✅ Can filter by category
- [ ] ✅ Can add new product
- [ ] ✅ Product appears in list immediately
- [ ] ✅ Can edit product details
- [ ] ✅ Can deactivate product (soft delete)
- [ ] ✅ **CANNOT** delete product with stock (409 error)
- [ ] ✅ **CAN** delete product with 0 stock

### 3.3 Point of Sale (POS)
**Create a Test Sale:**
- [ ] ✅ Can search for products
- [ ] ✅ Can add items to cart
- [ ] ✅ Quantity validation works (cannot exceed stock)
- [ ] ✅ Can apply discount
- [ ] ✅ Can select customer (optional)
- [ ] ✅ Can choose payment method
- [ ] ✅ **Cannot sell expired items** (error shown)
- [ ] ✅ Sale generates invoice number (format: SHOP1-SALE-00001)
- [ ] ✅ Invoice number is sequential
- [ ] ✅ Stock decreases immediately
- [ ] ✅ Can view/print receipt

**Verify After Sale:**
```bash
# Check stock decreased
curl -X GET "https://health-care-surgical-mart.onrender.com/api/stock/snapshots" \
  -H "Authorization: Bearer <token>" | jq '.data[] | select(.productId == "<product-id>")'

# Check sale recorded
curl -X GET "https://health-care-surgical-mart.onrender.com/api/sales?limit=1" \
  -H "Authorization: Bearer <token>" | jq '.data.sales[0]'
```

- [ ] ✅ Stock quantity reduced by sale quantity
- [ ] ✅ Sale appears in sales history
- [ ] ✅ Invoice number is correct
- [ ] ✅ Customer info recorded (if provided)

### 3.4 Stock Management
- [ ] ✅ Can view stock report
- [ ] ✅ Stock quantities match database
- [ ] ✅ Low stock alerts showing correctly
- [ ] ✅ Can filter by category/status
- [ ] ✅ Can view movement history for product
- [ ] ✅ Can perform stock adjustment
- [ ] ✅ Adjustment requires reason
- [ ] ✅ Adjustment creates ledger entry

### 3.5 Purchases
**Create a Purchase:**
- [ ] ✅ Can create purchase order
- [ ] ✅ Can add items with batch info
- [ ] ✅ Can mark purchase as received
- [ ] ✅ Stock increases after receiving
- [ ] ✅ Batches created correctly
- [ ] ✅ FEFO allocation works (oldest expiry first)

### 3.6 Returns
**Process a Return:**
- [ ] ✅ Can select original sale
- [ ] ✅ Can choose items to return
- [ ] ✅ Cannot return more than purchased
- [ ] ✅ Stock increases after return
- [ ] ✅ Refund amount calculated correctly
- [ ] ✅ Return appears in returns list

### 3.7 Customers
- [ ] ✅ Can add new customer
- [ ] ✅ Can view customer list
- [ ] ✅ Can edit customer details
- [ ] ✅ Can view purchase history
- [ ] ✅ Outstanding balance shows correctly
- [ ] ✅ Credit limit enforcement works

### 3.8 Dashboard
- [ ] ✅ Today's sales shows correct amount
- [ ] ✅ Weekly/monthly totals accurate
- [ ] ✅ Low stock alerts clickable
- [ ] ✅ Expiring items alerts working
- [ ] ✅ Charts render without errors
- [ ] ✅ Recent sales list showing

### 3.9 Reports
- [ ] ✅ Sales report generates correctly
- [ ] ✅ Date range filtering works
- [ ] ✅ Stock valuation accurate
- [ ] ✅ Profit/Loss report shows data
- [ ] ✅ Can export to CSV/PDF

---

## ✅ PHASE 4: BUSINESS LOGIC VALIDATION (30 minutes)

### 4.1 Stock Integrity Rules
**Test Scenarios:**
- [ ] ✅ Cannot sell more than available stock
- [ ] ✅ Cannot sell expired items
- [ ] ✅ FEFO allocation works (oldest batch first)
- [ ] ✅ Returns add stock back correctly
- [ ] ✅ Adjustments create audit trail
- [ ] ✅ Concurrent sales don't oversell

### 4.2 Financial Accuracy
**Verify Calculations:**
- [ ] ✅ Subtotal = Sum of (quantity × price)
- [ ] ✅ Discount applied correctly (% or fixed)
- [ ] ✅ Tax calculated properly (if applicable)
- [ ] ✅ Grand Total = Subtotal - Discount + Tax
- [ ] ✅ Change calculated correctly
- [ ] ✅ Profit = Revenue - COGS

### 4.3 Permission Enforcement
**Test Access Control:**
- [ ] ✅ STAFF cannot delete products
- [ ] ✅ STAFF cannot view financial reports
- [ ] ✅ STAFF cannot manage users
- [ ] ✅ SHOP_ADMIN has full access
- [ ] ✅ Permissions respected on backend

---

## ✅ PHASE 5: ERROR HANDLING (20 minutes)

### 5.1 API Error Responses
**Test Error Cases:**
- [ ] ✅ Invalid product ID → 404
- [ ] ✅ Missing required fields → 400
- [ ] ✅ Expired JWT → 401
- [ ] ✅ Insufficient permissions → 403
- [ ] ✅ Duplicate SKU → 409
- [ ] ✅ Validation errors → 422
- [ ] ✅ Server errors → 500 (with generic message, no stack trace)

### 5.2 Frontend Error Display
- [ ] ✅ Network errors shown to user
- [ ] ✅ Validation errors highlighted on form
- [ ] ✅ Session expired redirects to login
- [ ] ✅ No blank/white screens on errors

---

## ✅ PHASE 6: PERFORMANCE & SCALABILITY (Optional)

### 6.1 Load Testing
**Test with Realistic Data:**
- [ ] 1,000+ products loaded
- [ ] 10,000+ sales records
- [ ] 100+ concurrent users (simulate)
- [ ] Response time < 2 seconds for most queries

### 6.2 Optimization
- [ ] Database indexes in place
- [ ] API pagination working
- [ ] Large lists load incrementally
- [ ] Images/assets optimized

---

## ✅ PHASE 7: BACKUP & RECOVERY (15 minutes)

### 7.1 Backup Configuration
- [ ] ✅ MongoDB Atlas automated backups enabled
- [ ] ✅ Retention policy set (minimum 7 days)
- [ ] ✅ Point-in-time recovery available
- [ ] ✅ Backup schedule documented

### 7.2 Test Restore Process
- [ ] ✅ Can manually trigger backup
- [ ] ✅ Can restore from backup
- [ ] ✅ Recovery time < 1 hour
- [ ] ✅ Procedure documented

---

## ✅ PHASE 8: MONITORING & ALERTING (20 minutes)

### 8.1 Logging Setup
- [ ] ✅ Error logs accessible (Render dashboard)
- [ ] ✅ Auth failures logged
- [ ] ✅ Stock movements logged
- [ ] ✅ Audit trail complete

### 8.2 Health Checks
```bash
# Set up automated checks
# Add to monitoring tool or cron job:

# Every 5 minutes
curl https://health-care-surgical-mart.onrender.com/api/health

# Every hour
curl https://health-care-surgical-mart.onrender.com/api/auth/health
```

- [ ] ✅ Health endpoint monitored
- [ ] ✅ Alert if endpoint fails
- [ ] ✅ Response time tracked

---

## ✅ PHASE 9: DOCUMENTATION & TRAINING (30 minutes)

### 9.1 User Documentation
- [ ] ✅ Staff trained on POS operations
- [ ] ✅ Admin trained on product management
- [ ] ✅ Admin trained on reports
- [ ] ✅ Quick reference guide created

### 9.2 Technical Documentation
- [ ] ✅ API endpoints documented
- [ ] ✅ Database schema documented
- [ ] ✅ Deployment procedure documented
- [ ] ✅ Emergency procedures documented

---

## ✅ PHASE 10: GO/NO-GO DECISION

### Critical Go Criteria (Must Pass All)
- [ ] ✅ Stock integrity check passes
- [ ] ✅ Product deletion protection working
- [ ] ✅ Auth permissions included in responses
- [ ] ✅ Invoice number uniqueness enforced
- [ ] ✅ No duplicate invoices exist
- [ ] ✅ No negative stock quantities
- [ ] ✅ Can complete end-to-end sale
- [ ] ✅ Stock decreases correctly after sale
- [ ] ✅ Backups configured and tested
- [ ] ✅ Staff trained on basic operations

### Important (Should Pass Most)
- [ ] ✅ Returns workflow tested
- [ ] ✅ Reports generate accurately
- [ ] ✅ Performance acceptable
- [ ] ✅ Error handling comprehensive
- [ ] ✅ Permission enforcement working

### Decision Matrix

**If ALL Critical criteria pass:**  
✅ **APPROVED FOR PRODUCTION LAUNCH**

**If 1-2 Critical criteria fail:**  
⚠️ **CONDITIONAL APPROVAL** - Fix issues within 24 hours

**If 3+ Critical criteria fail:**  
🔴 **HOLD LAUNCH** - Address issues before reconsidering

---

## 📝 SIGN-OFF

### Technical Lead
**Name:** ____________________  
**Date:** ____________________  
**Signature:** ____________________

### Shop Owner/Manager
**Name:** ____________________  
**Date:** ____________________  
**Signature:** ____________________

### Notes/Comments:
```
_____________________________________________________________

_____________________________________________________________

_____________________________________________________________
```

---

## 🚀 POST-LAUNCH MONITORING (First 7 Days)

### Daily Checks
- [ ] Day 1: Run integrity check, review logs
- [ ] Day 2: Review audit logs, check for errors
- [ ] Day 3: Verify report accuracy
- [ ] Day 4: Check stock levels vs physical count
- [ ] Day 5: Review user feedback
- [ ] Day 6: Performance check
- [ ] Day 7: Full system review, document issues

### Week 1 Summary
**Issues Found:** ____________________  
**Hotfixes Applied:** ____________________  
**User Satisfaction:** ____________________  
**System Stability:** ____________________

---

**Checklist Version:** 1.0  
**Last Updated:** June 21, 2026  
**Next Review:** 7 days post-launch
