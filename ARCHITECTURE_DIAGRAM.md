# Multi-Tenant POS Architecture - Role-Based Access

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         HEALTH CARE SURGICAL MART                       │
│                      Multi-Tenant POS Platform                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                        ┌───────────┴───────────┐
                        │                       │
              ┌─────────▼─────────┐   ┌────────▼─────────┐
              │  Firebase Auth    │   │  MongoDB Atlas   │
              │  (Authentication) │   │  (Data Storage)  │
              └─────────┬─────────┘   └────────┬─────────┘
                        │                       │
                        └───────────┬───────────┘
                                    │
                        ┌───────────▼───────────┐
                        │   Express Backend     │
                        │  (JWT + Multi-Tenant) │
                        └───────────┬───────────┘
                                    │
            ┌───────────────────────┼───────────────────────┐
            │                       │                       │
    ┌───────▼────────┐   ┌─────────▼────────┐   ┌────────▼─────────┐
    │  SUPER_ADMIN   │   │   SHOP_ADMIN     │   │     STAFF        │
    │  (Platform)    │   │   (Shop Mgr)     │   │  (Employee)      │
    └────────────────┘   └──────────────────┘   └──────────────────┘
```

---

## Role Hierarchy & Permissions

```
                    ┌──────────────────┐
                    │  SUPER_ADMIN     │
                    │  Platform Owner  │
                    └────────┬─────────┘
                             │
                    ┌────────▼──────────┐
                    │ Permissions:      │
                    │ • Manage shops    │
                    │ • Manage users    │
                    │ • System settings │
                    │ • View all data   │
                    └───────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                                         │
┌───────▼───────┐                       ┌────────▼────────┐
│ SHOP_ADMIN    │                       │ STAFF           │
│ (Shop Manager)│                       │ (Employee)      │
└───────┬───────┘                       └────────┬────────┘
        │                                        │
┌───────▼────────┐                      ┌────────▼────────┐
│ Permissions:   │                      │ Permissions:    │
│ • Sales        │                      │ • Create sale   │
│ • Inventory    │                      │ • View products │
│ • Products     │                      │ • View customers│
│ • Customers    │                      │ (Read-only)     │
│ • Reports      │                      │                 │
│ • Expenses     │                      │                 │
│ • Shop settings│                      │                 │
└────────────────┘                      └─────────────────┘
```

---

## Database Architecture

```
MongoDB Atlas (Single Database)
│
├── system_users                 (SUPER_ADMIN accounts)
│   ├── _id: ObjectId
│   ├── name: "Mahi M Rahman"
│   ├── email: "mahi8026@gmail.com"
│   ├── role: "SUPER_ADMIN"
│   ├── shopId: null
│   └── isActive: true
│
├── shops                        (Shop registry)
│   ├── shopId: "shop1"
│   ├── name: "Main Store"
│   ├── status: "Active"
│   ├── ownerEmail: "owner@shop1.com"
│   └── subscriptionPlan: "professional"
│
├── shop1_users                  (Shop 1 users)
│   ├── _id: ObjectId
│   ├── name: "Shop Admin"
│   ├── email: "admin@shop1.com"
│   ├── role: "SHOP_ADMIN"
│   └── shopId: "shop1"
│
├── shop1_products               (Shop 1 products)
├── shop1_sales                  (Shop 1 sales)
├── shop1_customers              (Shop 1 customers)
├── shop1_expenses               (Shop 1 expenses)
│
├── shop2_users                  (Shop 2 users - isolated)
├── shop2_products               (Shop 2 products - isolated)
├── shop2_sales                  (Shop 2 sales - isolated)
└── ...
```

**Key Principles:**
- ✅ Shop data is isolated using collection prefixes (`shop1_`, `shop2_`)
- ✅ SUPER_ADMIN stored in `system_users` (not shop-specific)
- ✅ Each shop has its own set of collections
- ✅ Multi-tenancy within single database (cost-effective)

---

## Authentication Flow

### 1. Login Process

```
User enters credentials
        │
        ▼
┌───────────────────┐
│  Firebase Auth    │  ← Verify email/password
│  (Sign in)        │
└────────┬──────────┘
         │ Returns Firebase ID Token
         ▼
┌───────────────────┐
│  Backend API      │  ← Verify Firebase token
│  /auth/login      │  ← Check MongoDB user
└────────┬──────────┘
         │ Returns JWT + User data
         ▼
┌───────────────────┐
│  Frontend         │  ← Store JWT in localStorage
│  (AuthContext)    │  ← Store user data
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│  Role-based       │  ← Route to correct dashboard
│  Routing          │
└───────────────────┘
```

### 2. Request Authentication

```
Every API Request
        │
        ▼
┌───────────────────────┐
│  Authorization Header │
│  Bearer <JWT>         │
└────────┬──────────────┘
         │
         ▼
┌────────────────────────┐
│  auth-multi-tenant.js  │  ← Verify JWT
│  (Middleware)          │  ← Extract user + shopId
└────────┬───────────────┘
         │
    ┌────┴────┐
    │ Role?   │
    └────┬────┘
         │
    ┌────┴──────────────────┐
    │                       │
    ▼                       ▼
SUPER_ADMIN          SHOP_ADMIN/STAFF
shopId: null         shopId: "shop1"
    │                       │
    ▼                       ▼
Platform APIs        Shop APIs
(All shops)          (One shop)
```

---

## Dashboard Routing Architecture

### Before Fix (Broken)
```
SUPER_ADMIN Login
        │
        ▼
    Dashboard.jsx
        │
        ├──> /api/reports/dashboard          ❌ 500 (needs shopId)
        ├──> /api/reports/stock-valuation    ❌ 500 (needs shopId)
        ├──> /api/stock/expiring             ❌ 500 (needs shopId)
        └──> /api/expense-analytics          ❌ 500 (needs shopId)

Problem: Wrong dashboard for platform owner
```

### After Fix (Working)
```
            User Login
                │
        ┌───────┴───────┐
        │ Role Check    │
        └───────┬───────┘
                │
    ┌───────────┼───────────┐
    │                       │
SUPER_ADMIN          SHOP_ADMIN/STAFF
    │                       │
    ▼                       ▼
SuperAdminDashboard     Dashboard
(Platform Mgmt)         (Shop Operations)
    │                       │
    ├─> /api/super-admin/   ├─> /api/reports/
    │   dashboard           │   dashboard
    │   ✅ 200 OK           │   ✅ 200 OK
    │                       │
    ├─> /api/super-admin/   ├─> /api/reports/
    │   shops               │   stock-valuation
    │   ✅ 200 OK           │   ✅ 200 OK
    │                       │
    └─> Shows:              └─> Shows:
        • Shops list            • Sales charts
        • Platform stats        • Inventory
        • User mgmt             • POS
        • System health         • Expenses
```

---

## API Endpoint Structure

### SUPER_ADMIN Endpoints (No shopId Required)

```
/api/super-admin/
    ├── GET  /dashboard              → Platform statistics
    ├── GET  /shops                  → List all shops
    ├── POST /shops                  → Create new shop
    ├── GET  /shops/:shopId          → Shop details
    ├── PATCH /shops/:shopId/status  → Update shop status
    ├── DELETE /shops/:shopId        → Delete shop
    ├── GET  /shops/:shopId/stats    → Individual shop stats
    └── GET  /database-list          → All collections

Middleware:
    ✅ authenticate (JWT verification)
    ✅ requireRole(['SUPER_ADMIN'])
    ❌ NO shopId requirement (handles all shops)
```

### Shop Operational Endpoints (Requires shopId)

```
/api/reports/
    ├── GET /dashboard               → Shop dashboard (needs shopId)
    └── GET /stock-valuation         → Stock value (needs shopId)

/api/sales/
    ├── GET  /                       → List sales (needs shopId)
    ├── POST /                       → Create sale (needs shopId)
    └── GET  /:id                    → Sale details (needs shopId)

/api/products/
    ├── GET  /                       → List products (needs shopId)
    ├── POST /                       → Create product (needs shopId)
    └── PUT  /:id                    → Update product (needs shopId)

/api/expense-analytics/
    ├── GET /month-over-month        → Expense trends (needs shopId)
    └── GET /category-distribution   → Categories (needs shopId)

Middleware:
    ✅ authenticate (JWT verification)
    ✅ checkShopStatus (verify shop is active)
    ✅ req.user.shopId must be set
```

---

## Component Structure

```
src/
├── pages/
│   ├── Login.jsx                    → Public (all users)
│   │
│   ├── SuperAdminDashboard.jsx     ← SUPER_ADMIN only
│   │   ├── Platform statistics
│   │   ├── Shops table
│   │   ├── User management links
│   │   └── System health
│   │
│   ├── Dashboard.jsx               ← SHOP_ADMIN/STAFF
│   │   ├── Sales charts
│   │   ├── Inventory widgets
│   │   ├── Expense summary
│   │   └── Quick actions (POS, Products)
│   │
│   ├── Settings.jsx                 → Role-based tabs
│   │   ├── User Management         ← SUPER_ADMIN only
│   │   ├── Shop Settings           ← SHOP_ADMIN
│   │   └── Email/SMS Settings      ← SHOP_ADMIN
│   │
│   ├── Sales.jsx                    → SHOP_ADMIN/STAFF
│   ├── Products.jsx                 → SHOP_ADMIN/STAFF
│   └── Reports.jsx                  → SHOP_ADMIN
│
├── contexts/
│   └── AuthContext.jsx              → Role-based routing logic
│
└── utils/
    └── permissions.js               → RBAC helper functions
```

---

## Security Layers

### Layer 1: Frontend Route Protection
```jsx
// App.jsx
<ProtectedRoute permission={PERMISSIONS.VIEW_SALES}>
  <Sales />
</ProtectedRoute>

// ProtectedRoute.jsx
if (!hasPermission(user, permission)) {
  return <Navigate to="/unauthorized" />;
}
```

### Layer 2: Backend Role Validation
```javascript
// rbac.js
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: "Access denied" 
      });
    }
    next();
  };
};
```

### Layer 3: Shop Context Isolation
```javascript
// auth-multi-tenant.js
if (req.user.role !== "SUPER_ADMIN" && !req.user.shopId) {
  return res.status(401).json({ 
    message: "Invalid token: missing shop context" 
  });
}

// For shop endpoints
if (req.user.role !== "SUPER_ADMIN") {
  // Ensure user can only access their own shop
  if (req.params.shopId !== req.user.shopId) {
    return res.status(403).json({ 
      message: "Access denied" 
    });
  }
}
```

### Layer 4: Database Query Isolation
```javascript
// products.routes.js
const db = getShopDatabase(req.user.shopId);  // ← Shop-specific DB
const products = await db.collection("products").find({}).toArray();
// Can only access products from req.user.shopId collection
```

---

## Data Flow Examples

### Example 1: SUPER_ADMIN Views Platform Dashboard

```
1. User logs in as SUPER_ADMIN
   └─> AuthContext stores: { role: "SUPER_ADMIN", shopId: null }

2. App.jsx routing logic
   └─> if (user.role === "SUPER_ADMIN") → <SuperAdminDashboard />

3. SuperAdminDashboard.jsx fetches data
   └─> GET /api/super-admin/dashboard
   └─> GET /api/super-admin/shops

4. Backend authenticates
   └─> auth-multi-tenant.js: req.user.shopId = null (OK for SUPER_ADMIN)

5. super-admin.routes.js handles request
   └─> Queries system_users collection
   └─> Iterates all shops to count users
   └─> Returns aggregated statistics

6. Frontend displays
   └─> Platform stats cards
   └─> Shops table with all shops
   └─> Quick actions (User Management, Settings)
```

### Example 2: SHOP_ADMIN Views Shop Dashboard

```
1. User logs in as SHOP_ADMIN
   └─> AuthContext stores: { role: "SHOP_ADMIN", shopId: "shop1" }

2. App.jsx routing logic
   └─> if (user.role !== "SUPER_ADMIN") → <Dashboard />

3. Dashboard.jsx fetches data
   └─> GET /api/reports/dashboard
   └─> GET /api/reports/stock-valuation
   └─> GET /api/expense-analytics/month-over-month

4. Backend authenticates
   └─> auth-multi-tenant.js: req.user.shopId = "shop1"

5. reports.routes.js handles request
   └─> const db = getShopDatabase("shop1")
   └─> Queries shop1_sales, shop1_products, shop1_expenses
   └─> Returns shop-specific data

6. Frontend displays
   └─> Sales charts for shop1
   └─> Inventory for shop1
   └─> Expenses for shop1
   └─> Quick actions (New Sale, Add Product)
```

### Example 3: SUPER_ADMIN Creates New Shop

```
1. SUPER_ADMIN clicks "Create Shop" button
   └─> Opens create shop modal/form

2. Fills in shop details
   └─> Shop name: "City Medical Store"
   └─> Owner email: "owner@citymedical.com"
   └─> Admin credentials: name, email, password

3. Frontend sends request
   └─> POST /api/super-admin/shops
   └─> Body: { shopData: {...}, adminData: {...} }

4. Backend (super-admin.routes.js) processes
   └─> Validates data
   └─> Creates shop entry in "shops" collection
   └─> Generates shopId: "shop_citymedical_001"
   └─> Creates shop collections:
       • shop_citymedical_001_users
       • shop_citymedical_001_products
       • shop_citymedical_001_sales
       • shop_citymedical_001_customers
   └─> Creates admin user with SHOP_ADMIN role
   └─> Logs audit entry

5. Frontend updates
   └─> Refreshes shops list
   └─> Shows success message
   └─> New shop appears in table
```

---

## Summary

**Architecture Principles:**
1. ✅ Role-based access control (RBAC)
2. ✅ Multi-tenant data isolation (shop-prefixed collections)
3. ✅ Separate concerns (platform vs shop operations)
4. ✅ Security at every layer (frontend + backend + database)
5. ✅ Token-based authentication (cross-domain compatible)

**Key Takeaway:**
- SUPER_ADMIN = Platform owner (manages system)
- SHOP_ADMIN = Shop manager (runs business)
- STAFF = Shop employee (daily operations)

Each role has a purpose-built interface with appropriate data access.
