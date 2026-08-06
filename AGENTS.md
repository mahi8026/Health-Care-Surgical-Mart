# Health Care Surgical Mart — Agent Guide

## Quick start
```bash
npm run install-all          # install deps in both server/ and client/
# Terminal 1:
cd server && npm run dev     # Express on localhost:5000 (nodemon)
# Terminal 2:
cd client && npm run dev     # Vite on localhost:3000, proxies /api → :5001
```
- Vite proxies `/api` to `localhost:5001` but server defaults to `PORT=5000`. Set `PORT=5001` in `server/.env` or change the proxy target in `client/vite.config.js`.
- For initial DB setup: `cd server && npm run seed`

## Architecture
- **Monorepo** with two independent packages: `client/` (React 18 + Vite + Tailwind) and `server/` (Express + MongoDB + Redis + Firebase Admin).
- **Server**: CommonJS (`require`/`module.exports`). Entry: `src/server.js`.
- **Client**: ESM (`import`/`export`). Entry: `src/main.jsx`. No tsconfig exists — `npm run type-check` fails.
- **Multi-tenant → Single-tenant**: the app now serves ONE shop only. All data lives in a single pinned database — `getShopDatabase()` resolves to `SHOP_DB_NAME` (e.g. `shop_6a020466789ca874348b2557`; production) or to `client.db('shop_<SHOP_ID>')` (tests/dev). JWT still carries `shopId` but it is ignored for DB selection. Super-admin platform ops (monitoring only) still use `system_users` in `Health_Care_Shop_DB` via `/api/super-admin`.
- Server auth routes (`auth-multi-tenant.routes.js`) call `getShopDatabase()` with no args — **`SHOP_DB_NAME` (prod) or `SHOP_ID` (dev/test) selects the database**. If neither is set, `getShopDatabase()` falls back to `DEFAULT_APP_DB_NAME` (`shop_6a020466789ca874348b2557` — the production shop DB) so a host that forgot to set the env still serves the single shop; prefer setting the env explicitly. `tests/setup.js` pins `SHOP_ID`.

## Testing
```bash
cd server && npm test        # Jest + supertest, coverage, --forceExit
npm run test:watch           # watch mode
npm run test:coverage        # coverage only
```
- Tests use `MONGODB_URI` from `server/.env` (Atlas) falling back to `mongodb://localhost:27017/health_care_test`. **Integration tests require a real MongoDB** (mocking is not used for DB in products/sales/customers suites).
- `tests/setup.js` loads `.env` first, seeds test users (`global.testUtils.ADMIN_ID`) and a test shop (`SHOP_ID`) via `beforeAll`, and pins `process.env.SHOP_ID` so single-tenant routes resolve to the seeded DB. All 7 test suites must pass before commit.
- Integration test files use `global.testUtils.generateTestToken()` for JWT creation — never `jwt.sign()` inline.
- Root `jest.config.js` watches `server/src/` and `server/tests/`.

### Known patterns
- Add `ObjectId.isValid(id)` guard before `new ObjectId(id)` in any route handler using `req.params.id`.
- Catch blocks should use `error.statusCode || 500` so validation errors (status 400 from `validateRequired`) propagate correctly.
- `validateRequired` throws with `err.statusCode = 400; err.isValidation = true` — update catch blocks to honor `error.statusCode`.
- Module-scoped `jest.fn()` mocks lose implementations after `jest.clearAllMocks()` — re-apply in `beforeEach`.

## Lint & Format
```bash
# Server (ESLint flat config, ESLint v9)
cd server && npm run lint
npm run lint:fix

# Client (ESLint v9)
cd client && npm run lint
npm run lint:fix

# Format both
npm run format              # uses root .prettierrc
```
- Server ESLint config at `server/eslint.config.js` (flat config).
- Client ESLint config at `.eslintrc.js` (legacy format).

## Deploy
- **Frontend → Firebase Hosting**: `cd client && npm run deploy` (builds then runs `firebase deploy --only hosting`).
- **Backend → Render**: Push `main` → auto-deploys via `render.yaml`; or trigger via webhook. Health check: `GET /health`.
- CI runs backend tests, then deploys both (on `main` push only). PRs deploy a Firebase preview channel.

## Key constraints
- `JWT_SECRET` must be ≥ 32 characters — server exits on startup if not.
- `SHOP_DB_NAME` (production) or `SHOP_ID` (dev/test) selects the single app database. Set `SHOP_DB_NAME` in the Render dashboard (see `render.yaml`) or auth/DB routes fail.
- Server requires `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL` (or base64 service account).
- Redis is optional — falls back to MongoDB for token blacklist.
- Client build output: `client/dist/` (must exist for production mode to serve static files).
- Server sets `app.set('trust proxy', 1)` (required for Render behind reverse proxy).
- Root-level `*.md` files matching many patterns (e.g. `*_FIX*.md`, `*_SUMMARY.md`) are gitignored — don't commit ephemeral docs there.

## Performance notes
- Shop index creation is memoized in `server/src/config/database.js` (`ensureShopIndexes`) — runs once per shop per process (verified once at boot in `server.js`, then lazily via auth middleware). Don't call `createShopIndexes` directly per-request.
- Per-request winston logging is opt-in: set `ENABLE_REQUEST_LOGGING=true` (see `server/src/config/logging.js` & `middleware.js`). Default = no per-request disk I/O; `morgan combined` still logs each request in production.
- Client production builds ship **no sourcemaps** (`sourcemap: false` in `client/vite.config.js`) — don't re-enable for prod deploys (added ~5MB to Firebase hosting + exposed source). Dev server provides its own sourcemaps.

## Notable
- Firebase project: `health-care-60ee6` (from `.firebaserc`).
- CI runs on Node 24 for main, Node 20 for PR previews.
- `npm run migrate` in server runs `database/migrations/migrate.js`.
- Port conflicts are common during local dev — check for free ports if `EADDRINUSE`.
