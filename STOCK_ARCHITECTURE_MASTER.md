# World-Class Stock Management Architecture
## Health Care Surgical Mart — Multi-Tenant SaaS POS

**Prepared by**: Senior Software Architect  
**Review Date**: June 19, 2026  
**Stack**: MERN + Firebase + Render  
**Scope**: Stock subsystem redesign for scale, real-time sync, and audit compliance

---

## The Core Problem with Your Current Design

Your existing system stores stock as a **mutable field** on the product document (`currentQty`). This is the **single biggest architectural risk** in any inventory system. Here's why it fails at scale:

| Scenario | What Breaks |
|----------|-------------|
| Two staff ring up the same item simultaneously | Race condition → negative stock, no audit trail |
| You need to know stock at 3pm last Tuesday | Impossible — you only have "now" |
| Dispute over a missing unit | No movement log → unresolvable |
| Batch expiry recall | No way to trace which batches went to which sales |
| Multi-device POS sync | Each device reads stale data → overselling |

**The fix is a fundamental pattern shift**: **stop mutating stock, start recording events.**

---

## Architecture Philosophy

### Event Sourcing for Inventory

**Stock level is never stored directly.** Instead, every change is an immutable event appended to a ledger. Current stock is always **derived** by replaying (or projecting) those events.

```
Current Stock = Σ(all IN events) - Σ(all OUT events)
```

This gives you, **for free**:
- ✅ Complete audit trail (who changed what, when, why)
- ✅ Point-in-time stock queries ("what was stock on date X?")
- ✅ Replay and recompute after corrections
- ✅ Race condition prevention via optimistic locking

### CQRS (Command Query Responsibility Segregation)

Split your stock API into two distinct paths:

- **Write path (Commands)**: Validate → record event → update snapshot
- **Read path (Queries)**: Read from pre-computed snapshot, never recalculate

This means your dashboard reads from an **index**, not an aggregation pipeline running on every request.

---

## Three-Layer Data Model

### Layer 1: Stock Ledger (Append-Only Event Store)

```javascript
// Collection: shop{X}_stock_ledger
{
  _id: ObjectId,
  productId: ObjectId,          // ref to shop{X}_products
  movementType: String,         // ENUM below
  direction: "IN" | "OUT",
  quantity: Number,             // always positive
  runningBalance: Number,       // balance AFTER this event
  version: Number,              // monotonically increasing per product
  
  // Reference to source document
  referenceType: "SALE" | "PURCHASE" | "RETURN" | "ADJUSTMENT" | "OPENING" | "TRANSFER" | "EXPIRY_WRITEOFF",
  referenceId: ObjectId,        // saleId, purchaseId, adjustmentId, etc.
  
  // Batch tracking
  batchNo: String,
  lotNo: String,
  expiryDate: Date,
  costPrice: Number,            // price at time of movement (for COGS)
  
  // Audit
  userId: ObjectId,
  shopId: String,
  timestamp: Date,              // server-side, never client
  note: String,
  metadata: Object              // extensible for future fields
}
```

**Movement Types**:
```
SALE              → customer purchase (OUT)
PURCHASE          → stock received from supplier (IN)
RETURN_IN         → customer returns item (IN)
RETURN_OUT        → return to supplier (OUT)
ADJUSTMENT_ADD    → manual correction: add
ADJUSTMENT_SUB    → manual correction: subtract
ADJUSTMENT_SET    → manual correction: set exact (creates synthetic event)
OPENING_STOCK     → initial stock entry (IN)
EXPIRY_WRITEOFF   → expired product removed (OUT)
DAMAGE_WRITEOFF   → damaged product removed (OUT)
TRANSFER_OUT      → inter-shop transfer (OUT, future)
TRANSFER_IN       → inter-shop transfer (IN, future)
```

**Critical indexes**:
```javascript
// Most queries filter by shopId + productId
db.shop1_stock_ledger.createIndex({ shopId: 1, productId: 1, timestamp: -1 })
db.shop1_stock_ledger.createIndex({ shopId: 1, referenceId: 1, referenceType: 1 })
db.shop1_stock_ledger.createIndex({ shopId: 1, batchNo: 1, expiryDate: 1 })
db.shop1_stock_ledger.createIndex({ shopId: 1, movementType: 1, timestamp: -1 })

// For point-in-time queries
db.shop1_stock_ledger.createIndex({ shopId: 1, productId: 1, version: 1 }, { unique: true })
```

---

### Layer 2: Stock Snapshot (Materialized View)

The snapshot is the **current state** — pre-computed from the ledger so reads are O(1).

```javascript
// Collection: shop{X}_stock_snapshots
{
  _id: ObjectId,
  productId: ObjectId,          // unique per product
  shopId: String,
  
  // Quantities
  onHandQty: Number,            // physical stock in warehouse
  reservedQty: Number,          // committed to pending orders
  availableQty: Number,         // onHandQty - reservedQty (virtual field)
  
  // Ledger linkage
  lastLedgerEntryId: ObjectId,  // pointer to latest ledger event
  lastLedgerVersion: Number,    // for optimistic lock validation
  
  // Denormalized for fast read (avoids joins)
  productName: String,
  sku: String,
  category: String,
  unit: String,
  reorderPoint: Number,
  maxStockLevel: Number,
  
  // Timestamps
  lastMovementAt: Date,
  lastMovementType: String,
  updatedAt: Date
}
```

**The optimistic locking contract**:

```javascript
// Before writing a stock movement:
async function deductStock(productId, qty, shopId) {
  const snapshot = await StockSnapshot.findOne({ productId, shopId });
  
  if (snapshot.availableQty < qty) {
    throw new InsufficientStockError(snapshot.availableQty, qty);
  }
  
  // Atomic update — only succeeds if version hasn't changed
  const result = await StockSnapshot.findOneAndUpdate(
    { 
      productId, 
      shopId,
      lastLedgerVersion: snapshot.lastLedgerVersion  // ← the lock
    },
    { 
      $inc: { onHandQty: -qty, reservedQty: 0 },
      $set: { updatedAt: new Date() }
    },
    { new: true }
  );
  
  if (!result) {
    // Another process modified this snapshot concurrently — retry
    throw new ConcurrencyConflictError('Stock snapshot modified by concurrent transaction');
  }
  
  return result;
}
```

---

### Layer 3: Stock Batches (FEFO Compliance)

For healthcare/surgical items, you need **First Expiry First Out** tracking.

```javascript
// Collection: shop{X}_stock_batches
{
  _id: ObjectId,
  productId: ObjectId,
  shopId: String,
  
  batchNo: String,
  lotNo: String,
  quantity: Number,             // remaining in this batch
  originalQuantity: Number,     // received quantity (never changes)
  
  expiryDate: Date,
  manufactureDate: Date,
  receivedDate: Date,
  
  supplierId: ObjectId,
  purchaseId: ObjectId,
  costPrice: Number,            // unit cost for this batch (FIFO costing)
  
  status: "ACTIVE" | "EXHAUSTED" | "EXPIRED" | "RECALLED",
  
  // Traceability
  sourceDocument: String,       // e.g. "PO-2026-001"
  notes: String,
  updatedAt: Date
}
```

**FEFO auto-selection for POS**:

When creating a sale, the system automatically picks batches by **earliest expiry first**:

```javascript
async function allocateBatchesFEFO(productId, qtyNeeded, shopId) {
  const batches = await StockBatch.find({
    productId, shopId, status: 'ACTIVE', quantity: { $gt: 0 }
  }).sort({ expiryDate: 1 }); // ← earliest expiry first
  
  const allocations = [];
  let remaining = qtyNeeded;
  
  for (const batch of batches) {
    if (remaining <= 0) break;
    const take = Math.min(batch.quantity, remaining);
    allocations.push({ 
      batchId: batch._id, 
      batchNo: batch.batchNo, 
      expiryDate: batch.expiryDate, 
      quantity: take 
    });
    remaining -= take;
  }
  
  if (remaining > 0) throw new InsufficientStockError();
  return allocations;
}
```

---

## Stock Command Service (Write Path)

All stock mutations go through a **single, transactional service**. Never write directly to the ledger from routes.

```javascript
// server/src/services/stock-command.service.js

class StockCommandService {
  
  async recordMovement({ shopId, productId, movementType, quantity, userId, ...meta }) {
    // MongoDB transactions require a replica set — 
    // MongoDB Atlas M0 supports this.
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // 1. Get current snapshot with optimistic lock
      const snapshot = await StockSnapshot.findOne({ productId, shopId }).session(session);
      
      const direction = MOVEMENT_DIRECTIONS[movementType]; // 'IN' or 'OUT'
      const newBalance = direction === 'IN' 
        ? snapshot.onHandQty + quantity 
        : snapshot.onHandQty - quantity;
      
      if (newBalance < 0) {
        throw new InsufficientStockError(
          `Cannot reduce below zero. Current: ${snapshot.onHandQty}, Requested: ${quantity}`
        );
      }
      
      // 2. Append to ledger (immutable)
      const ledgerEntry = await StockLedger.create([{
        shopId, productId, movementType, direction, quantity,
        runningBalance: newBalance,
        version: snapshot.lastLedgerVersion + 1,
        userId, timestamp: new Date(),
        ...meta
      }], { session });
      
      // 3. Update snapshot atomically (optimistic lock check)
      const updated = await StockSnapshot.findOneAndUpdate(
        { productId, shopId, lastLedgerVersion: snapshot.lastLedgerVersion },
        {
          $set: {
            onHandQty: newBalance,
            availableQty: newBalance - snapshot.reservedQty,
            lastLedgerEntryId: ledgerEntry[0]._id,
            lastLedgerVersion: snapshot.lastLedgerVersion + 1,
            lastMovementAt: new Date(),
            lastMovementType: movementType,
            updatedAt: new Date()
          }
        },
        { new: true, session }
      );
      
      if (!updated) {
        throw new ConcurrencyConflictError('Concurrent stock modification detected');
      }
      
      // 4. Update batch quantities (if FEFO batch allocation provided)
      if (meta.batchAllocations?.length) {
        for (const alloc of meta.batchAllocations) {
          await StockBatch.findByIdAndUpdate(
            alloc.batchId,
            { $inc: { quantity: direction === 'IN' ? alloc.quantity : -alloc.quantity } },
            { session }
          );
        }
      }
      
      await session.commitTransaction();
      
      // 5. Emit real-time event (outside transaction — fire-and-forget)
      this.emitStockUpdate(shopId, productId, updated);
      
      return { ledgerEntry: ledgerEntry[0], snapshot: updated };
      
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  emitStockUpdate(shopId, productId, snapshot) {
    // SSE broadcast — see Real-time section below
    sseManager.broadcast(shopId, {
      type: 'STOCK_UPDATE',
      productId: productId.toString(),
      onHandQty: snapshot.onHandQty,
      availableQty: snapshot.availableQty,
      updatedAt: snapshot.updatedAt
    });
  }
}
```

---

## Real-Time Synchronization (Server-Sent Events)

### Why SSE over WebSockets for your stack

✅ Works perfectly across Firebase Hosting ↔ Render (same as REST, just a long-lived GET)  
✅ No library needed on the server side (native Node.js)  
✅ One-directional broadcast is all you need for stock updates  
✅ Survives Render's free tier without sticky session requirements  
✅ No additional cost or infrastructure

### SSE Server Implementation

```javascript
// server/src/services/sse-manager.service.js

class SSEManager {
  constructor() {
    // Map: shopId → Set of response objects
    this.clients = new Map();
  }
  
  addClient(shopId, res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': process.env.CORS_ORIGIN,
      'X-Accel-Buffering': 'no' // important for Nginx/proxies
    });
    
    // Send initial connection confirmation
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', shopId })}\n\n`);
    
    if (!this.clients.has(shopId)) {
      this.clients.set(shopId, new Set());
    }
    this.clients.get(shopId).add(res);
    
    // Heartbeat to prevent connection timeout (every 30s)
    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 30000);
    
    // Cleanup on disconnect
    res.on('close', () => {
      clearInterval(heartbeat);
      this.clients.get(shopId)?.delete(res);
    });
  }
  
  broadcast(shopId, data) {
    const shopClients = this.clients.get(shopId);
    if (!shopClients?.size) return;
    
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    for (const client of shopClients) {
      client.write(payload);
    }
  }
  
  // Route handler
  handleConnection(req, res) {
    const { shopId } = req.user;
    this.addClient(shopId, res);
    // req.on('close') handles cleanup above
  }
}

// Route: GET /api/stock/events
router.get('/events', authenticate, (req, res) => {
  sseManager.handleConnection(req, res);
});
```

### React Client Hook

```javascript
// client/src/hooks/useStockEvents.js

export function useStockEvents(onStockUpdate) {
  useEffect(() => {
    const token = localStorage.getItem('jwt');
    const eventSource = new EventSource(
      `${import.meta.env.VITE_API_URL}/stock/events?token=${token}`
    );
    
    eventSource.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'STOCK_UPDATE') {
        onStockUpdate(data); // update local state
      }
    };
    
    eventSource.onerror = () => {
      // Auto-reconnects after 3s (browser default)
      console.warn('SSE reconnecting...');
    };
    
    return () => eventSource.close();
  }, []);
}

// Usage in StockReport.jsx
useStockEvents((update) => {
  setStockData(prev => prev.map(item => 
    item.productId === update.productId 
      ? { ...item, currentQty: update.onHandQty, availableQty: update.availableQty }
      : item
  ));
});
```

---

## Expiry & Compliance Engine

Critical for healthcare — the system must **proactively** manage expiry.

### Expiry Status Pipeline (MongoDB Aggregation)

```javascript
// Replaces the current simple filter with a computed status field
const expiryPipeline = [
  { $match: { shopId } },
  { $addFields: {
    daysToExpiry: {
      $divide: [
        { $subtract: ['$expiryDate', new Date()] },
        1000 * 60 * 60 * 24
      ]
    }
  }},
  { $addFields: {
    expiryStatus: {
      $switch: {
        branches: [
          { case: { $lt: ['$daysToExpiry', 0] },  then: 'EXPIRED' },
          { case: { $lte: ['$daysToExpiry', 7] },  then: 'CRITICAL' },
          { case: { $lte: ['$daysToExpiry', 30] }, then: 'EXPIRING_SOON' },
          { case: { $lte: ['$daysToExpiry', 90] }, then: 'WARNING' }
        ],
        default: 'OK'
      }
    }
  }}
];
```

### Automated Expiry Alerts (Cron Job)

```javascript
// server/src/jobs/expiry-alert.job.js
// Runs daily via node-cron — no additional infrastructure needed

const cron = require('node-cron');

// Every day at 8am
cron.schedule('0 8 * * *', async () => {
  const shops = await Shop.find({ status: 'Active' });
  
  for (const shop of shops) {
    const batches = await StockBatch.find({
      shopId: shop.shopId,
      status: 'ACTIVE',
      expiryDate: { $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }
    }).populate('productId', 'name sku');
    
    if (batches.length > 0) {
      await emailService.sendExpiryAlert({
        to: shop.ownerEmail,
        shopName: shop.name,
        items: batches.map(b => ({
          product: b.productId.name,
          sku: b.productId.sku,
          batchNo: b.batchNo,
          qty: b.quantity,
          expiryDate: b.expiryDate,
          daysLeft: Math.ceil((b.expiryDate - new Date()) / (1000 * 60 * 60 * 24))
        }))
      });
    }
  }
});
```

---

## API Design — Stock Command Endpoints

New endpoints needed (beyond current CRUD):

```
# Commands (write path — go through StockCommandService)
POST  /api/stock/movements          Create a stock movement (generic)
POST  /api/stock/adjustments        Manual stock adjustment (admin only)
POST  /api/stock/transfers          Inter-location transfer (future)
POST  /api/stock/writeoffs          Expiry/damage writeoff

# Queries (read path — hit snapshots/indexes)
GET   /api/stock/snapshots          All products with current quantities
GET   /api/stock/snapshots/:id      Single product snapshot
GET   /api/stock/:id/ledger         Movement history for a product (paginated)
GET   /api/stock/batches            All batches (filterable by product, expiry)
GET   /api/stock/:id/batches        Batches for a specific product
GET   /api/stock/expiry-alerts      Batches expiring within N days
GET   /api/stock/valuation          Total stock value (cost + retail)
GET   /api/stock/reorder-alerts     Products below reorder point

# Real-time
GET   /api/stock/events             SSE stream for live stock updates
```

**Response envelope standard**:
```javascript
// All stock API responses follow this envelope
{
  "success": true,
  "data": [...],
  "pagination": { "page": 1, "limit": 25, "total": 147, "pages": 6 },
  "meta": {
    "generatedAt": "2026-06-19T08:00:00Z",
    "shopId": "shop1",
    "queryTimeMs": 12
  }
}
```

---

## Frontend Architecture Improvements

### Optimistic UI Updates

```javascript
// Instead of waiting for API response to refresh the table,
// update immediately and roll back on error

const handleStockAdjustment = async (productId, adjustment) => {
  // 1. Optimistically update local state
  const previousData = stockData;
  setStockData(prev => prev.map(item => 
    item.productId === productId 
      ? { ...item, currentQty: item.currentQty + adjustment.delta }
      : item
  ));
  
  try {
    // 2. Send to server
    await api.post('/stock/adjustments', adjustment);
    // Server will confirm via SSE — no manual refresh needed
  } catch (error) {
    // 3. Roll back on failure
    setStockData(previousData);
    showError(error.message);
  }
};
```

### Stock State Manager (React Context)

```javascript
// client/src/contexts/StockContext.jsx
// Centralizes stock state so POS, StockReport, and Dashboard share one source of truth

const StockContext = createContext();

export function StockProvider({ children }) {
  const [snapshots, setSnapshots] = useState(new Map()); // productId → snapshot
  
  // Listen for SSE updates
  useStockEvents((update) => {
    setSnapshots(prev => new Map(prev).set(update.productId, {
      ...prev.get(update.productId),
      ...update
    }));
  });
  
  const getStock = (productId) => snapshots.get(productId);
  const isLowStock = (productId) => {
    const s = snapshots.get(productId);
    return s && s.availableQty <= s.reorderPoint;
  };
  
  return (
    <StockContext.Provider value={{ snapshots, getStock, isLowStock }}>
      {children}
    </StockContext.Provider>
  );
}
```

---

## Performance: Indexes & Query Strategy

Complete index set for stock collections:

```javascript
// Run once during deployment
async function createStockIndexes(shopId) {
  const db = getShopDatabase(shopId);
  
  // Stock Ledger — the most queried collection
  await db.collection('stock_ledger').createIndexes([
    { key: { productId: 1, timestamp: -1 }, name: 'product_timeline' },
    { key: { referenceId: 1, referenceType: 1 }, name: 'reference_lookup' },
    { key: { movementType: 1, timestamp: -1 }, name: 'type_timeline' },
    { key: { batchNo: 1 }, name: 'batch_lookup', sparse: true },
    { key: { expiryDate: 1 }, name: 'expiry_scan', sparse: true },
    { key: { userId: 1, timestamp: -1 }, name: 'user_activity' },
    { key: { productId: 1, version: 1 }, name: 'version_lock', unique: true }
  ]);
  
  // Stock Snapshots — always single-document reads
  await db.collection('stock_snapshots').createIndexes([
    { key: { productId: 1 }, name: 'product_lookup', unique: true },
    { key: { availableQty: 1, reorderPoint: 1 }, name: 'reorder_scan' },
    { key: { lastMovementAt: -1 }, name: 'recent_activity' }
  ]);
  
  // Stock Batches — heavy expiry filtering
  await db.collection('stock_batches').createIndexes([
    { key: { productId: 1, expiryDate: 1, status: 1 }, name: 'fefo_query' },
    { key: { expiryDate: 1, status: 1 }, name: 'expiry_alert' },
    { key: { batchNo: 1, productId: 1 }, name: 'batch_product', unique: true }
  ]);
}
```

---

## Multi-Tenant Isolation for Stock

Your current shop-prefixed collection pattern is sound and scales well. For the stock subsystem, add these guards:

```javascript
// middleware/stock-isolation.middleware.js

// 1. Ensure every stock query is shop-scoped
const enforceShopScope = (req, res, next) => {
  if (!req.user.shopId) {
    return res.status(403).json({ message: 'Shop context required for stock operations' });
  }
  // Inject shopId into all query operations automatically
  req.stockQuery = { shopId: req.user.shopId };
  next();
};

// 2. Prevent cross-shop product references
const validateProductBelongsToShop = async (req, res, next) => {
  const product = await Product.findOne({ 
    _id: req.params.productId, 
    shopId: req.user.shopId  // ← always validate ownership
  });
  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }
  req.product = product;
  next();
};
```

---

## Migration Plan

### Phase 1 — Foundation (Week 1, no breaking changes)
- Create `stock_ledger` and `stock_snapshots` collections alongside existing products
- Write a migration script to seed snapshots from current product `currentQty` values
- Deploy `StockCommandService` — start recording new movements to ledger
- Keep old `currentQty` update as fallback, write to both systems in parallel

### Phase 2 — Switch Reads (Week 2)
- Update `StockReport.jsx` to read from `stock_snapshots` instead of products
- Update the POS to use `availableQty` from snapshots for availability checks
- Switch stock validation in sales route to use optimistic locking
- Deploy SSE endpoint + `useStockEvents` hook

### Phase 3 — Batch Tracking (Week 3)
- Deploy `stock_batches` collection and batch schema
- Update purchase receipt flow to create batch entries
- Integrate FEFO allocation into POS sale creation
- Add expiry alert cron job

### Phase 4 — Retire Legacy Fields (Week 4)
- Verify snapshot accuracy matches old `currentQty` across all products
- Remove `currentQty` direct-mutation code from products routes
- Set `currentQty` on product as a virtual/computed field derived from snapshot
- Full regression test pass

---

## Scalability Projections

| Metric | Current (1 shop) | 10 Shops | 50 Shops | 100 Shops |
|--------|------------------|----------|----------|-----------|
| Ledger entries/month | ~500 | ~5,000 | ~25,000 | ~50,000 |
| Snapshot reads/day | ~200 | ~2,000 | ~10,000 | ~20,000 |
| SSE connections | 1-5 | 10-50 | 50-250 | 100-500 |
| Index size (ledger) | ~2MB | ~20MB | ~100MB | ~200MB |
| Action required | None | None | Redis for SSE broker | Horizontal scale |

MongoDB Atlas M0 (free tier) handles comfortably up to ~50 shops with this architecture. At 100 shops, upgrade to M10 ($57/month) and add Redis for the SSE message broker (Upstash free tier: 10k messages/day, $0).

---

## What Your StockReport.jsx Needs to Change

Your current component (`StockReport.jsx`) is well-structured. Here's what to update:

| Current | Target |
|---------|--------|
| `GET /stock?page=...` (hits products collection) | `GET /stock/snapshots?page=...` (hits pre-computed snapshots) |
| `fetchMovements` calls `/stock/{id}/movement-history` | Same endpoint, now reads from `stock_ledger` |
| `api.put('/stock/{id}/adjust', payload)` | `api.post('/stock/adjustments', payload)` (command pattern) |
| No real-time — manual Refresh button | `useStockEvents` hook — auto-updates table |
| Summary cards make 2 extra API calls on every load | One SSE message keeps summary counters live |

---

## Security Considerations

1. **Ledger is append-only** — no DELETE or UPDATE on `stock_ledger`. Corrections are new events.
2. **Admin-only adjustments** — `ADJUSTMENT_*` movement types require `SHOP_ADMIN` role.
3. **Audit log every adjustment** — write to your existing `audit_log` collection on every manual change.
4. **Negative stock guard** — enforced at service layer, not just UI.
5. **Batch recall capability** — `StockBatch.updateMany({ batchNo }, { $set: { status: 'RECALLED' }})` + auto-writeoff — critical for healthcare regulatory compliance.

---

## Summary

This architecture is a **direct upgrade path** from your current MERN stack with **no changes to your hosting, authentication, or multi-tenant patterns**. Every component builds on what Kiro already delivered.

**Key Benefits**:
- ✅ Zero-cost implementation (MongoDB Atlas M0, Render free tier)
- ✅ Complete audit trail for regulatory compliance
- ✅ Eliminates race conditions via optimistic locking
- ✅ Real-time sync across all POS terminals
- ✅ FEFO batch tracking for healthcare compliance
- ✅ Scalable to 100+ shops without architecture changes
- ✅ Backwards compatible migration strategy

---

**This is your north-star architecture.** Implementation can begin immediately without disrupting current operations.
