# Health Care Surgical Mart — Full Project Audit Report

**Date:** May 15, 2026
**Version Audited:** 2.0.0
**Auditor:** Kiro AI
**Scope:** Full-stack codebase — architecture, security, code quality, features, CI/CD, database, and recommendations

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Project Overview](#2-project-overview)
3. [Tech Stack](#3-tech-stack)
4. [Architecture Review](#4-architecture-review)
5. [Feature Inventory](#5-feature-inventory)
6. [Security Audit](#6-security-audit)
7. [Code Quality](#7-code-quality)
8. [Database Design](#8-database-design)
9. [API Design](#9-api-design)
10. [Frontend Review](#10-frontend-review)
11. [CI/CD Pipeline](#11-cicd-pipeline)
12. [Testing Coverage](#12-testing-coverage)
13. [Performance](#13-performance)
14. [Issues & Findings](#14-issues--findings)
15. [Recommendations](#15-recommendations)
16. [Summary Scorecard](#16-summary-scorecard)

---

## 1. Executive Summary

Health Care Surgical Mart is a production-deployed, multi-tenant Point of Sale (POS) system for medical stores and pharmacies. The system is well-structured, actively maintained, and demonstrates solid engineering practices including dual-layer authentication, RBAC, audit logging, CI/CD automation, and error tracking via Sentry.

**Overall Assessment: GOOD — Production-ready with specific security items to address.**

Key strengths:
- Clean multi-tenant architecture with shop-prefixed MongoDB collections
- Dual-layer auth (Firebase + JWT) with proper token verification
- Comprehensive RBAC with 3 roles and 50+ granular permissions
- Full audit trail with GDPR-compliant 2-year TTL
- 51 backend tests passing (100%), including property-based tests
- Automated CI/CD to Render (backend) and Firebase Hosting (frontend)
- Swagger API documentation at `/api/docs`
- Sentry error tracking on both frontend and backend

Key risks requiring attention:
- Sensitive credentials may be committed in `.env` files (HIGH)
- JWT stored in `localStorage` (XSS-accessible) instead of HttpOnly cookies (MEDIUM)
- SQL injection regex middleware causes false positives on legitimate medical product names (MEDIUM)
- `mongoose` listed as a dependency but the app uses the native MongoDB driver — dead dependency (LOW)
- Two conflicting `.env` files with different DB names and URIs (LOW)

---

## 2. Project Overview

| Property | Value |
|---|---|
| Application | Medical Store POS System |
| Version | 2.0.0 |
| Architecture | Multi-tenant SaaS (single DB, shop-prefixed collections) |
| Frontend URL | https://health-care-60ee6.web.app |
| Backend URL | https://health-care-surgical-mart.onrender.com |
| Firebase Project | health-care-60ee6 |
| Node.js Requirement | >=18.0.0 |
| Repository | github.com/mahi8026/Health-Care-Surgical-Mart |

### Deployment Topology

```
Browser
  └── Firebase Hosting (CDN) → React SPA (client/dist)
        └── API calls → Render.com (Express server, free tier, Oregon)
                          └── MongoDB Atlas (single DB: Health_Care_Shop_DB)
                          └── Firebase Admin SDK (token verification)
                          └── SendGrid (email)
                          └── Twilio / MSG91 (SMS)
                          └── Google Cloud Storage (PDF/file storage)
                          └── Redis / Bull (optional queues)
```

---

## 3. Tech Stack

### Frontend

| Concern | Library | Version |
|---|---|---|
| Framework | React | 18.2.0 |
| Build Tool | Vite | 7.3.1 |
| Styling | Tailwind CSS | 3.4.19 |
| Routing | React Router | 6.20.1 |
| Server State | React Query | 3.39.3 |
| HTTP Client | Axios | 1.13.4 |
| Authentication | Firebase | 12.9.0 |
| Forms | React Hook Form | 7.71.1 |
| Charts | Chart.js + react-chartjs-2 | 4.5.1 / 5.3.1 |
| Notifications | react-hot-toast | 2.6.0 |
| Error Tracking | @sentry/react | 8.47.0 |
| Icons | lucide-react | 0.294.0 |
| Testing | Vitest + @testing-library/react + Playwright | 4.0.18 / 16.3.2 / 1.60.0 |

### Backend

| Concern | Library | Version |
|---|---|---|
| Framework | Express | 4.18.2 |
| Database Driver | mongodb (native) | 6.21.0 |
| Auth — Firebase | firebase-admin | 13.7.0 |
| Auth — JWT | jsonwebtoken | 9.0.3 |
| Password Hashing | bcryptjs | 2.4.3 |
| Security | helmet | 7.1.0 |
| Rate Limiting | express-rate-limit | 7.1.5 |
| Validation | express-validator | 7.0.1 |
| Logging | winston + winston-daily-rotate-file | 3.11.0 / 4.7.1 |
| HTTP Logging | morgan | 1.10.0 |
| Queues | bull (Redis-backed) | 4.16.5 |
| Email | @sendgrid/mail + @mailchimp/mailchimp_marketing | 8.1.4 / 3.0.80 |
| SMS | twilio | 5.12.0 |
| PDF Generation | pdfkit | 0.18.0 |
| File Storage | @google-cloud/storage | 7.14.0 |
| Caching | ioredis | 5.6.1 |
| Scheduling | node-cron | 3.0.3 |
| API Docs | swagger-jsdoc + swagger-ui-express | 6.2.8 / 5.0.1 |
| Error Tracking | @sentry/node + @sentry/profiling-node | 8.47.0 |
| Testing | Jest + supertest + fast-check | 29.7.0 / 6.3.3 / 4.6.0 |
| Process Manager | PM2 (ecosystem.config.js) | — |

**Dead dependency:** `mongoose` (^8.0.3) is listed in `server/package.json` but the application exclusively uses the native `mongodb` driver. This adds ~2MB to the install and should be removed.

---

## 4. Architecture Review

### 4.1 Multi-Tenant Design

The system uses a **single MongoDB database with shop-prefixed collections** pattern:

- System collections (no prefix): `shops`, `system_users`, `audit_logs`
- Shop collections: `{shopId}_products`, `{shopId}_sales`, `{shopId}_stock`, `{shopId}_customers`, `{shopId}_users`, `{shopId}_purchases`, `{shopId}_returns`, `{shopId}_expenses`, `{shopId}_expense_categories`, `{shopId}_settings`, etc.

`getShopDatabase(shopId)` returns a transparent wrapper that prefixes all `collection()` calls. This is a pragmatic approach for a small-to-medium SaaS. It avoids the complexity of separate databases per tenant while maintaining logical isolation.

**Trade-off to be aware of:** As the number of shops grows, the number of collections in a single database grows linearly (N shops × ~12 collections = 12N collections). MongoDB Atlas handles this well up to thousands of collections, but monitoring collection count is advisable.

### 4.2 Server Architecture

The Express server is well-organized with clear separation of concerns:

```
server/src/
├── config/         — database, logging, security, middleware, routes, swagger, sentry
├── controllers/    — business logic (SalesController, etc.)
├── middleware/     — auth-multi-tenant.js (JWT verify + shop context)
├── models/         — MongoDB JSON Schema validators (no Mongoose)
├── routes/         — one file per resource
├── services/       — email, SMS, PDF, cache, audit-log, recurring-expense-scheduler
├── utils/          — rbac.js, seed scripts, environment validators
└── server.js       — entry point
```

The server starts HTTP first, then connects to the database — a good pattern that allows health checks to respond even during DB reconnection.

### 4.3 Frontend Architecture

```
client/src/
├── components/     — reusable UI (Layout, ProtectedRoute, ui/, expense/, email/, sms/)
├── config/         — api.js (Axios instance), firebase.js, navigation.js, sentry.js
├── contexts/       — AuthContext (Firebase + MongoDB dual state)
├── hooks/          — useApi, useFirebaseAuth, useHeldSales, usePagination, usePermissions, usePOSKeyboard
├── pages/          — 18 page components (lazy-loaded except Login + Dashboard)
├── services/       — firebaseAuthService.js
├── styles/         — index.css (Tailwind)
└── utils/          — permissions.js (RBAC helpers)
```

Lazy loading is correctly applied to all non-critical pages. `React.StrictMode` is enabled. `ErrorBoundary` wraps the entire app. `QueryClient` is configured with sensible defaults (5-min stale time, 2 retries).

### 4.4 Authentication Flow

```
1. User enters email + password
2. Firebase Auth signs in → returns Firebase ID token
3. Frontend sends { firebaseToken, email } to POST /api/auth/firebase-login
4. Backend verifies Firebase ID token via Firebase Admin SDK
5. Backend looks up user in MongoDB (system_users or {shopId}_users)
6. Backend issues a 24h JWT containing { userId, email, role, shopId }
7. JWT stored in localStorage + React state
8. All subsequent API calls include JWT as Bearer token
9. authenticate() middleware verifies JWT + fetches fresh user from DB on every request
```

This is a solid dual-layer approach. The one concern is that fetching the user from DB on every request adds a DB round-trip per API call. Consider caching the user object in Redis with a short TTL (e.g., 5 minutes) for high-traffic scenarios.

---

## 5. Feature Inventory

| # | Feature | Status | Notes |
|---|---|---|---|
| 1 | Point of Sale (POS) | ✅ Complete | Cash + bank split, credit sales, custom items, expired item blocking |
| 2 | Sales History | ✅ Complete | Filterable, paginated, view/print/download PDF |
| 3 | Invoice Generation (PDF) | ✅ Complete | Server-side PDFKit, GCS upload with local fallback |
| 4 | Invoice Email to Customer | ✅ Complete | SendGrid, async queue |
| 5 | Product Management | ✅ Complete | Medical/Lab/Surgical categories, SKU, expiry, batch/lot tracking |
| 6 | Bulk Product Import | ✅ Complete | CSV upload via `BulkProductImport.jsx` |
| 7 | Stock Management | ✅ Complete | Real-time deduction on sale, low-stock alerts, reorder points |
| 8 | Purchase Orders | ✅ Complete | Supplier POs, payment tracking |
| 9 | Customer Management | ✅ Complete | 4 customer types, credit limits, due tracking, purchase history |
| 10 | Returns & Refunds | ✅ Complete | Full/partial, 8 return reasons, approval workflow, stock restoration |
| 11 | Expense Tracking | ✅ Complete | Categories, recurring expenses (cron), receipt attachments, vendor info |
| 12 | Financial Reports | ✅ Complete | P&L, cash flow, daily summary, analytics |
| 13 | Stock Report | ✅ Complete | Stock levels, low-stock view |
| 14 | Email Campaigns | ✅ Complete | SendGrid + Mailchimp, template editor, campaign analytics |
| 15 | SMS Notifications | ✅ Complete | Twilio + MSG91, templates, logs |
| 16 | Notification Settings | ✅ Complete | Provider config UI |
| 17 | User Management | ✅ Complete | RBAC, custom per-user permission overrides |
| 18 | Settings | ✅ Complete | Shop info, tax config, invoice prefix, receipt layout |
| 19 | Audit Logs | ✅ Complete | All CRUD actions, 2-year TTL, GDPR/HIPAA compliant |
| 20 | Multi-Tenancy | ✅ Complete | Shop-prefixed collections, subscription plans |
| 21 | Super Admin Panel | ✅ Complete | Cross-shop access, shop management, usage stats |
| 22 | Swagger API Docs | ✅ Complete | Available at `/api/docs` |
| 23 | Sentry Error Tracking | ✅ Complete | Frontend + backend, user context, profiling |
| 24 | Held Sales (POS) | ✅ Complete | `useHeldSales` hook — park and resume transactions |
| 25 | POS Keyboard Shortcuts | ✅ Complete | `usePOSKeyboard` hook |
| 26 | Supplier Management | ✅ Complete | Separate suppliers collection |
| 27 | Category Management | ✅ Complete | Product categories |
| 28 | Recurring Expenses | ✅ Complete | node-cron scheduler, daily/weekly/monthly/yearly |
| 29 | Expense Analytics | ✅ Complete | Dedicated analytics route |
| 30 | File Upload (Receipts) | ✅ Complete | Multer + GCS/local |

**18 frontend pages:** Login, Dashboard, Sales (POS), SalesHistory, Products, Purchases, Customers, Returns, StockReport, ExpenseCategories, ExpensesPage, AddExpensePage, FinancialReports, Settings, SMSDashboard, EmailDashboard, NotificationSettings, BulkProductImport.

---

## 6. Security Audit

### 6.1 Authentication & Authorization

| Check | Status | Detail |
|---|---|---|
| Firebase token verified server-side | ✅ Pass | `admin.auth().verifyIdToken()` called before any DB lookup |
| JWT secret minimum length enforced | ✅ Pass | `getJWTSecret()` throws if `JWT_SECRET` < 32 chars |
| JWT expiry set | ✅ Pass | 24h expiry |
| Inactive user blocked | ✅ Pass | `isActive` checked in `authenticate()` middleware |
| Shop status checked | ✅ Pass | `checkShopStatus()` middleware verifies Active + subscription not expired |
| Cross-shop data isolation | ✅ Pass | `verifyShopAccess()` enforces shopId match; SUPER_ADMIN exempt |
| RBAC enforced on all routes | ✅ Pass | `requirePermission()` / `requireRole()` applied per route |
| Password hashed with bcrypt | ✅ Pass | bcrypt cost factor 12 (seed) / 10 (change-password) — minor inconsistency |
| Dev Firebase bypass documented | ⚠️ Warn | If Firebase Admin not configured, token verification is skipped. Acceptable for dev, but must never reach production |

### 6.2 Transport & Headers

| Check | Status | Detail |
|---|---|---|
| HTTPS enforced | ✅ Pass | Firebase Hosting + Render both serve HTTPS |
| Helmet security headers | ✅ Pass | CSP, X-Frame-Options DENY, X-Content-Type-Options, X-XSS-Protection |
| CORS whitelist | ✅ Pass | `ALLOWED_ORIGINS` env var; all localhost allowed in dev only |
| `X-Powered-By` removed | ✅ Pass | `res.removeHeader('X-Powered-By')` in security middleware |
| Referrer-Policy set | ✅ Pass | `strict-origin-when-cross-origin` |
| Permissions-Policy set | ✅ Pass | geolocation, microphone, camera all denied |
| Firebase Hosting headers | ✅ Pass | nosniff, DENY, XSS-Protection in firebase.json |
| Static asset cache headers | ✅ Pass | 1-year immutable for hashed assets |

### 6.3 Rate Limiting

| Limiter | Limit | Status |
|---|---|---|
| General API | 1000 req / 15 min | ✅ Active in production |
| Auth endpoints | 5 attempts / 15 min | ✅ Active in production (skipped in dev) |
| Password reset | 3 attempts / 1 hour | ✅ Active in production |
| Dev bypass | All limiters skipped | ✅ Intentional, dev only |

### 6.4 Input Validation

| Check | Status | Detail |
|---|---|---|
| express-validator on auth routes | ✅ Pass | Email, password, shopId validated |
| express-validator on product routes | ✅ Pass | Name, SKU, prices, category, unit validated |
| MongoDB schema validation | ✅ Pass | `$jsonSchema` validators on all collections |
| XSS sanitization | ✅ Pass | Strips `<script>`, `<iframe>`, `javascript:`, `on*=` from body/query |
| SQL injection detection | ⚠️ Issue | Regex-based; pattern `/(--|;|'|")/ ` will false-positive on apostrophes in product names like "Doctor's Gloves". MongoDB has no SQL injection risk — this middleware is unnecessary and harmful |
| ObjectId validation | ✅ Pass | `new ObjectId(id)` will throw on invalid IDs, caught by error handlers |

### 6.5 Secrets & Credentials

| Check | Status | Detail |
|---|---|---|
| `.env` in `.gitignore` | ✅ Pass | Both root and client `.gitignore` list `.env` |
| Secrets in CI via GitHub Secrets | ✅ Pass | `VITE_FIREBASE_API_KEY`, `JWT_SECRET`, `RENDER_DEPLOY_HOOK` etc. all use `${{ secrets.* }}` |
| Demo passwords blocked in production | ✅ Pass | `seed-demo-users.js` exits if `NODE_ENV=production` |
| Demo passwords printed to console | ⚠️ Issue | Seed script prints plaintext passwords to stdout. Acceptable for dev, but logs should be scrubbed before sharing |
| `.env` files potentially committed | 🔴 HIGH | Root `.env` and `server/.env` exist in the working tree with real credentials. Run `git log --all -- .env` to verify they were never committed. If they were, rotate all secrets immediately |
| Firebase service account in env | ⚠️ Warn | `FIREBASE_SERVICE_ACCOUNT_BASE64` stores the full service account JSON base64-encoded. Ensure this is only in GitHub Secrets and never in committed files |
| `tlsAllowInvalidCertificates: true` | ⚠️ Warn | Set in MongoDB connection config. Acceptable for Atlas but disables certificate chain validation |

### 6.6 Token Storage

| Check | Status | Detail |
|---|---|---|
| JWT in localStorage | ⚠️ Issue | `localStorage` is accessible to any JavaScript on the page. An XSS vulnerability would expose the token. HttpOnly cookies are the recommended alternative |
| User object in localStorage | ⚠️ Issue | `localStorage.setItem('user', JSON.stringify(...))` stores role and permissions client-side. These are re-fetched from the server on auth state change, so this is low risk but unnecessary |

---

## 7. Code Quality

### 7.1 General

| Metric | Assessment |
|---|---|
| Code organization | Excellent — clear separation of config, controllers, routes, services, utils |
| Naming conventions | Consistent — camelCase JS, kebab-case filenames |
| Comments & JSDoc | Good — most functions have JSDoc headers |
| Error handling | Good — try/catch on all async routes, graceful shutdown handler |
| Logging | Excellent — Winston with daily rotation, separate error/audit/combined logs, Sentry integration |
| Dead code | Minor — `mongoose` dependency unused; some empty catch blocks in auth routes |
| Console.log in production | Minor — a few `console.log` calls remain in auth routes (should use `logger`) |

### 7.2 Linting & Formatting

- ESLint: `eslint:recommended` + `plugin:react/recommended` + prettier
- Prettier: semi, 80-char line width, double quotes, trailing commas, LF line endings
- Both client and server have `lint` and `format` scripts
- `--max-warnings 0` enforced on client lint (zero-tolerance)

### 7.3 Notable Code Patterns

**Good patterns observed:**
- `SalesController` is a class with private helper methods (`_enrichSaleItems`, `_buildSaleRecord`, `_updateStockForSale`) — clean and testable
- Audit logging is fire-and-forget (wrapped in `try/catch`, never blocks the response)
- Cache invalidation on sale creation (`cacheService.invalidateShopCache`)
- `setImmediate()` used for non-blocking post-sale notifications
- `gracefulShutdown()` handles SIGTERM, SIGINT, uncaughtException, unhandledRejection
- Environment validation at startup (`validateEnvironment`, `validateProductionEnvironment`)

**Patterns to improve:**
- Empty catch blocks in auth routes: `catch (error) { }` — should at minimum log the error
- `bypassDocumentValidation: true` on sale insert — bypasses MongoDB schema validation, which defeats the purpose of having schema validators
- Stock undersell is allowed (warning only, not blocked) — this is a business decision but should be clearly documented
- `discountPercent` is always set to `0` in `_buildSaleRecord` even when a discount is applied — the percent is never calculated from the amount

---

## 8. Database Design

### 8.1 Schema Quality

All collections use MongoDB `$jsonSchema` validators — a good practice without Mongoose. Schemas are defined in `server/src/models/` and applied at collection creation.

| Collection | Required Fields | Indexes | Notes |
|---|---|---|---|
| products | name, category, sku, purchasePrice, sellingPrice, unit, minStockLevel | 9 indexes incl. text search | Well-designed; compound indexes for common queries |
| sales | invoiceNo, items, grandTotal, saleDate, createdBy | 10 indexes | Good coverage; `invoiceNo` unique |
| customers | name, phone, type | 9 indexes incl. text search | `phone` unique; `outstandingBalance` is legacy field (use `currentDue`) |
| users | name, email, passwordHash, role | 4 indexes | `email` unique |
| expenses | expenseNumber, categoryId, amount, expenseDate, createdBy | 9 indexes | Recurring config well-modeled |
| shops | shopId, shopName, ownerEmail, status | 4 indexes | `shopId` and `ownerEmail` unique |
| audit_logs | — | 6 indexes + TTL | TTL set to 2 years (63,072,000 seconds) — GDPR compliant |

### 8.2 Issues Found

| Issue | Severity | Detail |
|---|---|---|
| `outstandingBalance` legacy field in customer schema | Low | Documented as "legacy — use currentDue" but still in schema. Should be removed in a migration |
| `discountPercent` never populated | Low | `_buildSaleRecord` always sets `discountPercent: 0` even when discount is applied |
| Stock can go negative | Medium | If stock record doesn't exist, a new one is created with negative quantity. This is logged as a warning but not blocked |
| No transaction (session) on sale creation | Medium | Sale insert + stock update + customer update are three separate operations. A MongoDB multi-document transaction would ensure atomicity |
| Two different DB names in `.env` files | Low | Root `.env` uses `Health_Care_DB`; `server/.env` uses `Health_Care_Shop_DB`. The server uses `server/.env`, so root is unused — but this is confusing |

### 8.3 Index Coverage

Index coverage is thorough. Compound indexes are defined for the most common query patterns (date ranges, customer lookups, payment status filters). The text search index on products (`name` + `brand`) supports the searchable product select component.

---

## 9. API Design

### 9.1 REST Conventions

| Check | Status |
|---|---|
| Consistent response envelope `{ success, data, message }` | ✅ |
| Correct HTTP status codes (201 for create, 404 for not found, 403 for forbidden) | ✅ |
| Pagination metadata returned | ✅ |
| Bearer token authentication | ✅ |
| Swagger/OpenAPI documentation | ✅ |
| Health check endpoint `/health` | ✅ |
| API versioning | ❌ No versioning — all routes are `/api/*` with no version prefix |

### 9.2 Route Inventory (35 route groups)

```
/api/auth                   — login, firebase-login, change-password
/api/products               — CRUD + bulk
/api/categories             — CRUD
/api/sales                  — CRUD + download-invoice + send-invoice
/api/customers              — CRUD
/api/suppliers              — CRUD
/api/stock                  — read + adjust
/api/purchases              — CRUD
/api/returns                — CRUD + approve/reject
/api/users                  — CRUD
/api/settings               — read + update
/api/reports                — various report endpoints
/api/financial-reports      — P&L, cash flow, daily summary
/api/expenses               — CRUD
/api/expense-categories     — CRUD
/api/expense-analytics      — analytics queries
/api/recurring-expenses     — CRUD + trigger
/api/bulk-products          — CSV import
/api/notifications          — CRUD + send
/api/sms                    — send + templates + logs
/api/email                  — campaigns + templates + analytics
/api/files                  — serve local files
/api/queues                 — queue health (no auth)
/api/webhooks/sendgrid      — SendGrid event webhook
/api/webhooks/twilio        — Twilio status webhook
/api/audit-logs             — read (SUPER_ADMIN + SHOP_ADMIN)
/api/super-admin            — shop management, user management
/api/docs                   — Swagger UI
/health                     — health check
/api/test                   — basic connectivity test
```

### 9.3 Observations

- The `/api/queues` health endpoint has no authentication — intentional for monitoring tools, but should be noted
- Webhook routes correctly skip JWT auth (validated by provider signatures instead)
- The `send-invoice` route has inline business logic that belongs in a service or controller
- `GET /api/sales` does not implement pagination (only a `limit` param, no `page` or cursor) — the `SalesHistory` page may load all records for large datasets

---

## 10. Frontend Review

### 10.1 Routing & Navigation

- 18 routes, all protected except `/login`
- `ProtectedRoute` component handles both authentication and permission checks
- Navigation config in `navigation.js` is role-filtered at render time
- Catch-all `*` route redirects to `/dashboard` — prevents 404 on direct URL access
- React Router v7 future flags enabled (`v7_startTransition`, `v7_relativeSplatPath`)

### 10.2 State Management

- **Auth state:** `AuthContext` — Firebase user + MongoDB user + JWT token
- **Server state:** React Query — handles caching, background refetch, loading/error states
- **Local state:** `useState` per component
- **Persistent state:** `useLocalStorage` hook for held sales and preferences
- No global client state library (Redux/Zustand) — appropriate for this app's complexity

### 10.3 Performance

| Check | Status |
|---|---|
| Code splitting (lazy loading) | ✅ All pages except Login + Dashboard |
| React Query caching (5-min stale) | ✅ |
| `refetchOnWindowFocus: false` | ✅ Prevents unnecessary refetches |
| Image optimization | N/A — no user images in the app |
| Bundle analysis | Not configured — `vite-bundle-visualizer` would help |
| `React.StrictMode` | ✅ Enabled |

### 10.4 Accessibility

| Check | Status |
|---|---|
| Semantic HTML | Partial — some components use `div` where `button`/`nav` would be appropriate |
| ARIA labels | Not audited — manual review with screen reader recommended |
| Keyboard navigation | `usePOSKeyboard` hook exists for POS shortcuts |
| Color contrast | Not audited — Tailwind defaults generally meet WCAG AA |
| Focus management | Not audited |

> Full WCAG compliance requires manual testing with assistive technologies.

### 10.5 Error Handling

- `ErrorBoundary` wraps the entire app — catches render errors
- React Query provides loading/error states per query
- `react-hot-toast` for user-facing notifications
- Sentry captures frontend errors with user context

---

## 11. CI/CD Pipeline

### 11.1 Workflows

**`ci.yml` — Main CI/CD (push + PR to `main`)**

```
push/PR to main
  └── Job 1: test (always)
        └── npm ci (server)
        └── npm test (Jest, 51 tests)
        └── Upload coverage artifact
  └── Job 2: deploy-backend (push to main only, needs: test)
        └── Trigger Render deploy hook
        └── Poll /health for up to 3 minutes
  └── Job 3: deploy-frontend (push to main only, needs: test)
        └── npm ci (client)
        └── npm run build (with production env vars from secrets)
        └── Firebase Hosting deploy (live channel)
```

**`pr-preview.yml` — PR Preview**

```
PR to main
  └── Job 1: test (same as ci.yml)
  └── Job 2: deploy-preview (needs: test)
        └── Build client
        └── Firebase Hosting deploy (preview channel: pr-{number}, expires 7d)
        └── Auto-posts preview URL as PR comment
```

### 11.2 Assessment

| Check | Status |
|---|---|
| Tests gate deployment | ✅ Deploy only runs if tests pass |
| Concurrency control (cancel stale runs) | ✅ |
| Secrets managed via GitHub Secrets | ✅ |
| Backend health check after deploy | ✅ Polls for 3 minutes |
| PR preview environments | ✅ 7-day expiry |
| Frontend-only tests in CI | ❌ No Vitest/Playwright runs in CI — only backend Jest |
| Dependency caching | ✅ `cache: 'npm'` on setup-node |
| Coverage upload | ✅ Artifact uploaded on every test run |
| Node version pinned | ✅ Node 20 |

**Gap:** The CI pipeline only runs backend tests. Frontend unit tests (Vitest) and E2E tests (Playwright) are not executed in CI. Adding them would catch regressions in the React components.

---

## 12. Testing Coverage

### 12.1 Backend Tests

- **Framework:** Jest + supertest + fast-check (property-based testing)
- **Test count:** 51 tests, 100% passing
- **Coverage:** Uploaded as artifact on every CI run
- **Property tests:** Authentication, email validation, PDF generation, SMS validation, API communication, database operations — 16/16 preservation tests passing after 7 bug fixes

### 12.2 Frontend Tests

- **Framework:** Vitest + @testing-library/react + Playwright (installed but not in CI)
- **Test count:** Unknown — no frontend test files found in the audited structure
- **Gap:** Frontend components have no unit tests. The `client/src/` directory has no `__tests__` or `*.test.jsx` files visible

### 12.3 Test Quality

The property-based tests using `fast-check` are a strong signal of engineering maturity. They test invariants across random inputs rather than just specific cases, catching edge cases that example-based tests miss.

---

## 13. Performance

### 13.1 Backend

| Area | Assessment |
|---|---|
| DB connection pooling | ✅ Pool size 5–50, configurable via env |
| Response compression | ✅ `compression` middleware, level 6, threshold 1KB |
| Rate limiting | ✅ Prevents abuse |
| Cache service | ✅ Redis-backed cache with shop-scoped invalidation |
| Async notifications | ✅ `setImmediate()` for post-sale email — non-blocking |
| Bull queues for email/SMS | ✅ Decouples sending from request cycle |
| DB round-trip per request | ⚠️ `authenticate()` fetches user from DB on every API call — consider Redis user cache |
| No pagination on GET /api/sales | ⚠️ Only `limit` param, no `page` — large datasets will be slow |

### 13.2 Frontend

| Area | Assessment |
|---|---|
| Code splitting | ✅ Lazy loading on 16 of 18 pages |
| React Query caching | ✅ 5-min stale time |
| Vite build optimization | ✅ Vite 7 with tree-shaking |
| CDN delivery | ✅ Firebase Hosting CDN |
| Static asset caching | ✅ 1-year immutable headers |

### 13.3 Infrastructure

- **Render free tier** — The backend runs on Render's free tier, which spins down after 15 minutes of inactivity. Cold starts can take 30–60 seconds. For a production medical store, upgrading to a paid Render plan (or using a keep-alive ping) is strongly recommended.

---

## 14. Issues & Findings

### Critical / High

| ID | Severity | Area | Issue | Recommendation |
|---|---|---|---|---|
| SEC-01 | 🔴 HIGH | Security | `.env` files with real credentials exist in the working tree and may have been committed to git history | Run `git log --all -- .env server/.env` to check. If committed, rotate all secrets (MongoDB URI, JWT secret, Firebase service account, SendGrid key, Twilio credentials) immediately. Add a pre-commit hook to block `.env` commits |

### Medium

| ID | Severity | Area | Issue | Recommendation |
|---|---|---|---|---|
| SEC-02 | 🟡 MEDIUM | Security | JWT stored in `localStorage` — accessible to XSS | Migrate to HttpOnly, Secure, SameSite=Strict cookies. Requires backend `/api/auth/refresh` endpoint |
| SEC-03 | 🟡 MEDIUM | Security | SQL injection regex middleware causes false positives on apostrophes in product names (e.g., "Doctor's Gloves") | Remove `sqlInjectionProtection` middleware entirely — MongoDB is not vulnerable to SQL injection. The regex also blocks legitimate single quotes |
| DB-01 | 🟡 MEDIUM | Database | No MongoDB transactions on sale creation — sale insert, stock update, and customer update are three separate operations | Wrap in a MongoDB client session with `session.withTransaction()` to ensure atomicity |
| DB-02 | 🟡 MEDIUM | Database | Stock can go negative — insufficient stock logs a warning but does not block the sale | Add a configurable `BLOCK_OVERSELL` flag. Default to blocking in production |
| API-01 | 🟡 MEDIUM | API | `GET /api/sales` has no cursor/page pagination — only a `limit` param | Add `page` + `limit` pagination (or cursor-based) consistent with other list endpoints |

### Low / Informational

| ID | Severity | Area | Issue | Recommendation |
|---|---|---|---|---|
| DEP-01 | 🔵 LOW | Dependencies | `mongoose` listed in `server/package.json` but never used | Run `npm uninstall mongoose` in `server/` |
| CODE-01 | 🔵 LOW | Code Quality | `bypassDocumentValidation: true` on sale insert bypasses MongoDB schema validation | Remove the flag — fix any schema mismatches instead |
| CODE-02 | 🔵 LOW | Code Quality | `discountPercent` always set to `0` in `_buildSaleRecord` even when a discount amount is applied | Calculate: `discountPercent = (discountAmount / subtotal) * 100` |
| CODE-03 | 🔵 LOW | Code Quality | Empty `catch` blocks in auth routes (`catch (error) { }`) | Add `logger.warn(...)` at minimum |
| CODE-04 | 🔵 LOW | Code Quality | bcrypt cost factor inconsistency — seed uses 12, `change-password` uses 10 | Standardize to 12 (or use a `BCRYPT_ROUNDS` env var) |
| DB-03 | 🔵 LOW | Database | `outstandingBalance` legacy field still in customer schema | Remove in a migration; `currentDue` is the canonical field |
| ENV-01 | 🔵 LOW | Config | Two conflicting `.env` files — root uses `Health_Care_DB`, server uses `Health_Care_Shop_DB` | Delete or clearly mark the root `.env` as unused; document that `server/.env` is the authoritative config |
| CI-01 | 🔵 LOW | CI/CD | Frontend tests (Vitest, Playwright) not run in CI | Add a `test-frontend` job to `ci.yml` |
| PERF-01 | 🔵 LOW | Performance | `authenticate()` middleware fetches user from DB on every request | Cache user object in Redis with 5-min TTL |
| INFRA-01 | 🔵 LOW | Infrastructure | Render free tier spins down after inactivity — cold starts affect real users | Upgrade to Render Starter ($7/mo) or add a keep-alive cron ping |
| API-02 | 🔵 LOW | API | No API versioning (`/api/v1/`) | Add version prefix before any breaking changes |
| SEC-04 | 🔵 LOW | Security | `send-invoice` route has inline business logic | Extract to `InvoiceController` or `SalesController.sendInvoice()` |

---

## 15. Recommendations

### Immediate (before next production release)

1. **Audit git history for committed secrets** (SEC-01). Run:
   ```bash
   git log --all --full-history -- .env server/.env server/src/config/firebase-admin.js
   ```
   If any `.env` was committed, rotate every credential in it.

2. **Remove the SQL injection middleware** (SEC-03). It provides zero protection against MongoDB and actively breaks legitimate product names with apostrophes. Delete `sqlInjectionProtection` from `server/src/config/security.js` and remove its usage.

3. **Remove `bypassDocumentValidation: true`** (CODE-01) from the sale insert. Identify and fix the schema mismatch that required it.

4. **Uninstall `mongoose`** (DEP-01):
   ```bash
   cd server && npm uninstall mongoose
   ```

### Short-term (next sprint)

5. **Add MongoDB transactions to sale creation** (DB-01). Wrap the sale insert + stock update + customer update in a single session transaction.

6. **Add cursor/page pagination to `GET /api/sales`** (API-01). The SalesHistory page already has pagination UI — the backend needs to support it properly.

7. **Standardize bcrypt rounds** (CODE-04). Use `const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 12` everywhere.

8. **Fix `discountPercent` calculation** (CODE-02) in `_buildSaleRecord`.

9. **Add frontend tests to CI** (CI-01). Even a basic Vitest run on the utility functions and hooks would catch regressions.

### Medium-term

10. **Migrate JWT to HttpOnly cookies** (SEC-02). This is the most impactful security improvement. It requires:
    - Backend: set `Set-Cookie` header with `HttpOnly; Secure; SameSite=Strict`
    - Frontend: remove `localStorage` token storage, rely on cookie
    - Backend: add `/api/auth/refresh` endpoint

11. **Add Redis user caching in `authenticate()`** (PERF-01). Cache `{ _id, name, email, role, shopId, permissions }` with a 5-minute TTL keyed by `userId`.

12. **Upgrade Render plan** (INFRA-01). The free tier is not suitable for a production medical store. At minimum, use the Starter plan to eliminate cold starts.

13. **Add API versioning** (API-02). Prefix all routes with `/api/v1/` before making any breaking changes.

14. **Remove `outstandingBalance` from customer schema** (DB-03) with a migration script.

---

## 16. Summary Scorecard

| Category | Score | Notes |
|---|---|---|
| Architecture | 9/10 | Clean multi-tenant design, good separation of concerns |
| Security | 6/10 | Strong auth/RBAC, but localStorage JWT and potential committed secrets are significant risks |
| Code Quality | 8/10 | Well-organized, good patterns, minor issues (empty catches, bypass flag) |
| Database Design | 7/10 | Good schemas and indexes; missing transactions on critical operations |
| API Design | 7/10 | Consistent conventions, good docs; missing versioning and full pagination |
| Frontend | 8/10 | Clean React architecture, lazy loading, good error handling |
| CI/CD | 8/10 | Solid pipeline; gap is missing frontend tests |
| Testing | 7/10 | Strong backend tests with property-based testing; no frontend tests |
| Performance | 7/10 | Good caching and async patterns; Render free tier is a bottleneck |
| Documentation | 9/10 | README, Swagger, feature docs, JSDoc — well documented |
| **Overall** | **7.6/10** | **Good — production-ready with specific items to address** |

---

*Report generated by Kiro AI on May 15, 2026. This audit is based on static code analysis of the repository. Dynamic testing, penetration testing, and manual accessibility review are recommended for a complete security assessment.*
