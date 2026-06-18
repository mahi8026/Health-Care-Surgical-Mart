# Stock Management Upgrade — Implementation Roadmap

**Based on**: STOCK_ARCHITECTURE_MASTER.md  
**Date**: June 19, 2026  
**Current Status**: Legacy mutable stock (currentQty on products)  
**Target**: Event-sourced stock with CQRS + SSE real-time sync

---

## Implementation Strategy

**Philosophy**: Zero-downtime migration. Run old and new systems in parallel, gradually switch reads, then retire legacy.

**Timeline**: 4 weeks (can be accelerated to 2 weeks if needed)  
**Cost**: $0 (stays on free tier throughout)  
**Risk**: LOW (parallel systems, easy rollback)

---

## Phase 1: Foundation (Week 1)

### Goal
Set up event sourcing infrastructure **alongside** existing system. No breaking changes.

### Tasks

#### 1.1 Create New Collections (30 mins)

```javascript
// scripts/stock-migration/01-create-collections.js
const { getShopDatabase } = require('../server/src/config/database');

async function createStockCollections(shopId) {
  const db = getShopDatabase(shopId);
  
  // Create collections
  await db.createCollection('stock_ledger');
  await db.createCollection('stock_snapshots');
  await db.createCollection('stock_batches');
  
  console.log(`✅ Created stock collections for ${shopId}`);
}

// Run for all active shops
const shops = await Shop.find({ status: 'Active' });
for (const shop of shops) {
  await createStockCollections(shop.shopId);
}
```

#### 1.2 Create Indexes (15 mins)

```javascript
// scripts/stock-migration/02-create-indexes.js
// Copy index creation code from STOCK_ARCHITECTURE_MASTER.md
// Run for all shops
```

#### 1.3 Seed Stock Snapshots (1 hour)

```javascript
// scripts/stock-migration/03-seed-snapshots.js
// Migrate current stock from products.currentQty to snapshots

async function seedSnapshots(shopId) {
  const shopDb = getShopDatabase(shopId);
  
  const products = await shopDb.collection('products').find().toArray();
  
  const snapshots = products.map(product => ({
    productId: product._id,
    shopId,
    onHandQty: product.currentQty || 0,
    reservedQty: 0,
    availableQty: product.currentQty || 0,
    lastLedgerEntryId: null,
    lastLedgerVersion: 0,
    productName: product.name,
    sku: product.sku,
    category: product.category?.name || product.category,
    unit: product.unit,
    reorderPoint: product.reorderPoint || 0,
    maxStockLevel: product.maxStockLevel || null,
    lastMovementAt: new Date(),
    lastMovementType: 'OPENING_STOCK',
    updatedAt: new Date()
  }));
  
  if (snapshots.length > 0) {
    await shopDb.collection('stock_snapshots').insertMany(snapshots);
  }
  
  console.log(`✅ Seeded ${snapshots.length} stock snapshots for ${shopId}`);
}
```

#### 1.4 Create Stock Command Service (2 hours)

```javascript
// server/src/services/stock-command.service.js
// Copy implementation from STOCK_ARCHITECTURE_MASTER.md

class StockCommandService {
  async recordMovement({ shopId, productId, movementType, quantity, userId, ...meta }) {
    // Full implementation from master doc
  }
}

module.exports = new StockCommandService();
```

#### 1.5 Dual-Write Mode (2 hours)

Update sales route to write to BOTH old and new systems:

```javascript
// server/src/routes/sales.routes.js
const stockCommand = require('../services/stock-command.service');

router.post('/', async (req, res) => {
  // ... existing sale creation ...
  
  // OLD SYSTEM (keep working)
  for (const item of saleItems) {
    await Product.findByIdAndUpdate(item.productId, {
      $inc: { currentQty: -item.quantity }
    });
  }
  
  // NEW SYSTEM (start recording events in parallel)
  try {
    for (const item of saleItems) {
      await stockCommand.recordMovement({
        shopId: req.user.shopId,
        productId: item.productId,
        movementType: 'SALE',
        quantity: item.quantity,
        userId: req.user._id,
        referenceType: 'SALE',
        referenceId: sale._id,
        costPrice: item.unitCost,
        note: `Sale ${sale.invoiceNo}`
      });
    }
  } catch (error) {
    // Log but don't fail sale if new system has issues
    logger.error('Stock event recording failed (non-critical):', error);
  }
  
  res.json({ success: true, data: sale });
});
```

**Verification**:
- ✅ Old system still works (products.currentQty updates)
- ✅ New system records events (stock_ledger grows)
- ✅ Snapshots stay in sync
- ✅ Zero user-visible changes

---

## Phase 2: Switch Reads (Week 2)

### Goal
Frontend starts reading from snapshots instead of products. Writes still go to both systems.

### Tasks

#### 2.1 New Stock API Endpoints (3 hours)

```javascript
// server/src/routes/stock.routes.js (NEW FILE)
const express = require('express');
const router = express.Router();
const { authenticate, checkShopStatus } = require('../middleware/auth-multi-tenant');
const { requirePermission } = require('../utils/rbac');
const { PERMISSIONS } = require('../utils/rbac');
const { getShopDatabase } = require('../config/database');

// GET /api/stock/snapshots - Read from materialized view
router.get('/snapshots', 
  authenticate, 
  requirePermission(PERMISSIONS.VIEW_STOCK),
  async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { page = 1, limit = 25, search, category, status } = req.query;
    
    const skip = (page - 1) * limit;
    let query = { shopId: req.user.shopId };
    
    if (search) {
      query.$or = [
        { productName: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (category) query.category = category;
    
    if (status === 'low_stock') {
      query.$expr = { $lte: ['$availableQty', '$reorderPoint'] };
    } else if (status === 'out_of_stock') {
      query.availableQty = 0;
    }
    
    const snapshots = await shopDb.collection('stock_snapshots')
      .find(query)
      .sort({ productName: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();
    
    const total = await shopDb.collection('stock_snapshots').countDocuments(query);
    
    res.json({
      success: true,
      data: snapshots,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  }
);

// GET /api/stock/:productId/ledger - Movement history
router.get('/:productId/ledger',
  authenticate,
  requirePermission(PERMISSIONS.VIEW_STOCK),
  async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { page = 1, limit = 50, startDate, endDate } = req.query;
    
    let query = {
      shopId: req.user.shopId,
      productId: new ObjectId(req.params.productId)
    };
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }
    
    const movements = await shopDb.collection('stock_ledger')
      .find(query)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .toArray();
    
    const total = await shopDb.collection('stock_ledger').countDocuments(query);
    
    res.json({
      success: true,
      data: movements,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  }
);

module.exports = router;
```

Add to main routes:
```javascript
// server/src/config/routes.js
app.use('/api/stock', require('../routes/stock.routes'));
```

#### 2.2 SSE Manager Service (2 hours)

```javascript
// server/src/services/sse-manager.service.js
// Copy full implementation from STOCK_ARCHITECTURE_MASTER.md

class SSEManager {
  constructor() {
    this.clients = new Map();
  }
  
  addClient(shopId, res) { /* ... */ }
  broadcast(shopId, data) { /* ... */ }
  handleConnection(req, res) { /* ... */ }
}

module.exports = new SSEManager();
```

Add SSE route:
```javascript
// server/src/routes/stock.routes.js
const sseManager = require('../services/sse-manager.service');

router.get('/events', authenticate, (req, res) => {
  sseManager.handleConnection(req, res);
});
```

#### 2.3 Frontend Hook (30 mins)

```javascript
// client/src/hooks/useStockEvents.js
import { useEffect } from 'react';

export function useStockEvents(onStockUpdate) {
  useEffect(() => {
    const token = localStorage.getItem('jwt');
    const eventSource = new EventSource(
      `${import.meta.env.VITE_API_URL}/stock/events?token=${token}`
    );
    
    eventSource.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'STOCK_UPDATE') {
        onStockUpdate(data);
      }
    };
    
    eventSource.onerror = () => {
      console.warn('SSE reconnecting...');
    };
    
    return () => eventSource.close();
  }, [onStockUpdate]);
}
```

Export in hooks index:
```javascript
// client/src/hooks/index.js
export { useStockEvents } from './useStockEvents';
```

#### 2.4 Update StockReport.jsx (1 hour)

```javascript
// client/src/pages/StockReport.jsx
import { useStockEvents } from '../hooks';

const StockReport = () => {
  const [stockData, setStockData] = useState([]);
  
  // Change API endpoint
  const fetchStockData = async () => {
    const response = await api.get('/stock/snapshots', { params: filters });
    // ... rest of fetch logic
  };
  
  // Add real-time updates
  useStockEvents((update) => {
    setStockData(prev => prev.map(item => 
      item.productId === update.productId
        ? { ...item, onHandQty: update.onHandQty, availableQty: update.availableQty }
        : item
    ));
  });
  
  // ... rest of component
};
```

#### 2.5 Update Movement History Modal (30 mins)

```javascript
// In StockReport.jsx - StockMovementModal
const fetchMovements = async () => {
  const response = await api.get(`/stock/${product._id}/ledger`, {
    params: { page, limit: 50, startDate: dateRange.start, endDate: dateRange.end }
  });
  // ... handle response
};
```

**Verification**:
- ✅ StockReport loads from snapshots
- ✅ Real-time updates work (test with 2 browser windows)
- ✅ Movement history shows ledger events
- ✅ Old routes still work as fallback

---

## Phase 3: Batch Tracking (Week 3)

### Goal
Add FEFO batch tracking for healthcare compliance.

### Tasks

#### 3.1 Batch Schema & Routes (2 hours)

```javascript
// server/src/routes/stock.routes.js

// POST /api/stock/batches - Create batch (called from purchase receipt)
router.post('/batches',
  authenticate,
  requirePermission(PERMISSIONS.MANAGE_STOCK),
  async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { productId, batchNo, quantity, expiryDate, costPrice, purchaseId } = req.body;
    
    const batch = {
      productId: new ObjectId(productId),
      shopId: req.user.shopId,
      batchNo,
      lotNo: req.body.lotNo,
      quantity,
      originalQuantity: quantity,
      expiryDate: new Date(expiryDate),
      manufactureDate: req.body.manufactureDate ? new Date(req.body.manufactureDate) : null,
      receivedDate: new Date(),
      supplierId: req.body.supplierId ? new ObjectId(req.body.supplierId) : null,
      purchaseId: purchaseId ? new ObjectId(purchaseId) : null,
      costPrice,
      status: 'ACTIVE',
      sourceDocument: req.body.sourceDocument,
      notes: req.body.notes,
      updatedAt: new Date()
    };
    
    const result = await shopDb.collection('stock_batches').insertOne(batch);
    
    res.json({ success: true, data: { _id: result.insertedId, ...batch } });
  }
);

// GET /api/stock/:productId/batches - Get batches for product (FEFO sorted)
router.get('/:productId/batches',
  authenticate,
  requirePermission(PERMISSIONS.VIEW_STOCK),
  async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    
    const batches = await shopDb.collection('stock_batches')
      .find({
        productId: new ObjectId(req.params.productId),
        shopId: req.user.shopId,
        status: 'ACTIVE',
        quantity: { $gt: 0 }
      })
      .sort({ expiryDate: 1 }) // FEFO: earliest expiry first
      .toArray();
    
    res.json({ success: true, data: batches });
  }
);

// GET /api/stock/expiry-alerts - Batches expiring soon
router.get('/expiry-alerts',
  authenticate,
  requirePermission(PERMISSIONS.VIEW_STOCK),
  async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const daysThreshold = parseInt(req.query.days) || 30;
    
    const batches = await shopDb.collection('stock_batches')
      .aggregate([
        {
          $match: {
            shopId: req.user.shopId,
            status: 'ACTIVE',
            quantity: { $gt: 0 },
            expiryDate: { $lte: new Date(Date.now() + daysThreshold * 24 * 60 * 60 * 1000) }
          }
        },
        {
          $lookup: {
            from: shopDb.getCollectionName('products'),
            localField: 'productId',
            foreignField: '_id',
            as: 'product'
          }
        },
        { $unwind: '$product' },
        {
          $addFields: {
            daysToExpiry: {
              $divide: [
                { $subtract: ['$expiryDate', new Date()] },
                1000 * 60 * 60 * 24
              ]
            }
          }
        },
        { $sort: { expiryDate: 1 } }
      ])
      .toArray();
    
    res.json({ success: true, data: batches });
  }
);
```

#### 3.2 FEFO Allocation Function (1 hour)

```javascript
// server/src/services/stock-command.service.js

class StockCommandService {
  // ... existing recordMovement method ...
  
  async allocateBatchesFEFO(productId, qtyNeeded, shopId) {
    const shopDb = getShopDatabase(shopId);
    
    const batches = await shopDb.collection('stock_batches')
      .find({
        productId: new ObjectId(productId),
        shopId,
        status: 'ACTIVE',
        quantity: { $gt: 0 }
      })
      .sort({ expiryDate: 1 }) // Earliest expiry first
      .toArray();
    
    const allocations = [];
    let remaining = qtyNeeded;
    
    for (const batch of batches) {
      if (remaining <= 0) break;
      const take = Math.min(batch.quantity, remaining);
      allocations.push({
        batchId: batch._id,
        batchNo: batch.batchNo,
        expiryDate: batch.expiryDate,
        quantity: take,
        costPrice: batch.costPrice
      });
      remaining -= take;
    }
    
    if (remaining > 0) {
      throw new InsufficientStockError(
        `Insufficient stock. Requested: ${qtyNeeded}, Available: ${qtyNeeded - remaining}`
      );
    }
    
    return allocations;
  }
}
```

#### 3.3 Update Sales Route with FEFO (1 hour)

```javascript
// server/src/routes/sales.routes.js

router.post('/', async (req, res) => {
  // ... existing sale creation ...
  
  for (const item of saleItems) {
    // Allocate batches using FEFO
    const batchAllocations = await stockCommand.allocateBatchesFEFO(
      item.productId,
      item.quantity,
      req.user.shopId
    );
    
    // Record movement with batch info
    await stockCommand.recordMovement({
      shopId: req.user.shopId,
      productId: item.productId,
      movementType: 'SALE',
      quantity: item.quantity,
      userId: req.user._id,
      referenceType: 'SALE',
      referenceId: sale._id,
      batchAllocations, // ← FEFO batch allocation
      note: `Sale ${sale.invoiceNo}`
    });
  }
  
  // ... rest of sale creation
});
```

#### 3.4 Expiry Alert Cron Job (1 hour)

```javascript
// server/src/jobs/expiry-alert.job.js
const cron = require('node-cron');
const { Shop } = require('../models');
const { getShopDatabase } = require('../config/database');
const emailService = require('../services/email.service');

// Every day at 8am
cron.schedule('0 8 * * *', async () => {
  console.log('Running expiry alert job...');
  
  const shops = await Shop.find({ status: 'Active' });
  
  for (const shop of shops) {
    const shopDb = getShopDatabase(shop.shopId);
    
    const batches = await shopDb.collection('stock_batches')
      .aggregate([
        {
          $match: {
            shopId: shop.shopId,
            status: 'ACTIVE',
            quantity: { $gt: 0 },
            expiryDate: { $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }
          }
        },
        {
          $lookup: {
            from: shopDb.getCollectionName('products'),
            localField: 'productId',
            foreignField: '_id',
            as: 'product'
          }
        },
        { $unwind: '$product' }
      ])
      .toArray();
    
    if (batches.length > 0) {
      await emailService.sendExpiryAlert({
        to: shop.ownerEmail,
        shopName: shop.name,
        items: batches.map(b => ({
          product: b.product.name,
          sku: b.product.sku,
          batchNo: b.batchNo,
          qty: b.quantity,
          expiryDate: b.expiryDate,
          daysLeft: Math.ceil((b.expiryDate - new Date()) / (1000 * 60 * 60 * 24))
        }))
      });
    }
  }
  
  console.log('Expiry alert job completed');
});
```

Start cron in server:
```javascript
// server/src/server.js
require('./jobs/expiry-alert.job'); // ← Add this line
```

**Verification**:
- ✅ Purchases create batches
- ✅ Sales auto-select FEFO batches
- ✅ Expiry alerts work (test with near-expiry date)
- ✅ Batch tracking visible in movement history

---

## Phase 4: Retire Legacy (Week 4)

### Goal
Remove old `currentQty` mutation code. Make snapshot the single source of truth.

### Tasks

#### 4.1 Verify Accuracy (1 hour)

```javascript
// scripts/stock-migration/04-verify-accuracy.js
// Compare products.currentQty vs snapshots.onHandQty

async function verifyAccuracy(shopId) {
  const shopDb = getShopDatabase(shopId);
  
  const products = await shopDb.collection('products').find().toArray();
  const mismatches = [];
  
  for (const product of products) {
    const snapshot = await shopDb.collection('stock_snapshots')
      .findOne({ productId: product._id });
    
    if (!snapshot) {
      mismatches.push({ productId: product._id, reason: 'No snapshot found' });
      continue;
    }
    
    if (product.currentQty !== snapshot.onHandQty) {
      mismatches.push({
        productId: product._id,
        sku: product.sku,
        name: product.name,
        oldQty: product.currentQty,
        snapshotQty: snapshot.onHandQty,
        diff: snapshot.onHandQty - product.currentQty
      });
    }
  }
  
  if (mismatches.length > 0) {
    console.error(`❌ Found ${mismatches.length} mismatches in ${shopId}`);
    console.table(mismatches);
    return false;
  } else {
    console.log(`✅ All stock quantities match in ${shopId}`);
    return true;
  }
}
```

Run for all shops. If mismatches found, investigate before proceeding.

#### 4.2 Remove currentQty Updates (30 mins)

```javascript
// server/src/routes/sales.routes.js

router.post('/', async (req, res) => {
  // ... existing sale creation ...
  
  // ❌ REMOVE THIS OLD CODE:
  // for (const item of saleItems) {
  //   await Product.findByIdAndUpdate(item.productId, {
  //     $inc: { currentQty: -item.quantity }
  //   });
  // }
  
  // ✅ KEEP ONLY NEW SYSTEM:
  for (const item of saleItems) {
    const batchAllocations = await stockCommand.allocateBatchesFEFO(...);
    await stockCommand.recordMovement({...});
  }
  
  res.json({ success: true, data: sale });
});
```

Do the same for:
- Purchases route
- Returns route
- Stock adjustments

#### 4.3 Make currentQty Virtual Field (30 mins)

```javascript
// server/src/models/Product.js

productSchema.virtual('currentQty').get(async function() {
  const snapshot = await db.collection('stock_snapshots')
    .findOne({ productId: this._id });
  return snapshot?.onHandQty || 0;
});

// Ensure virtuals are included in JSON
productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });
```

**Verification**:
- ✅ All stock operations use snapshots
- ✅ No more direct currentQty updates
- ✅ Legacy products API still returns currentQty (as virtual)
- ✅ Full regression test pass

---

## Testing Strategy

### Unit Tests

```javascript
// server/tests/services/stock-command.test.js
describe('StockCommandService', () => {
  describe('recordMovement', () => {
    it('should append to ledger and update snapshot', async () => {
      // ... test
    });
    
    it('should prevent negative stock', async () => {
      // ... test
    });
    
    it('should handle concurrent modifications with optimistic lock', async () => {
      // ... test
    });
  });
  
  describe('allocateBatchesFEFO', () => {
    it('should allocate batches by earliest expiry first', async () => {
      // ... test
    });
    
    it('should throw error if insufficient stock across batches', async () => {
      // ... test
    });
  });
});
```

### Integration Tests

```javascript
// server/tests/integration/stock-flow.test.js
describe('Stock Flow Integration', () => {
  it('should handle full sale flow with FEFO', async () => {
    // 1. Create product
    // 2. Create batches with different expiry dates
    // 3. Create sale (should auto-select earliest expiry batch)
    // 4. Verify ledger entry created
    // 5. Verify snapshot updated
    // 6. Verify batch quantity reduced
  });
  
  it('should broadcast SSE event on stock change', async () => {
    // 1. Connect to SSE stream
    // 2. Create sale
    // 3. Verify SSE event received
  });
});
```

### Manual Testing Checklist

- [ ] Create sale with 2 browser windows open → both update in real-time
- [ ] Simultaneous sales of same product → no negative stock
- [ ] Batch with expiry tomorrow shows in expiry alerts
- [ ] Movement history shows all ledger events
- [ ] Stock adjustment requires admin permission
- [ ] Point-in-time query shows correct stock for past date

---

## Rollback Plan

If issues arise during any phase:

### Phase 1 Rollback
- Stop writing to new system
- Drop new collections
- Keep using products.currentQty

### Phase 2 Rollback
- Switch frontend back to old `/stock` endpoint
- Keep dual-write mode active

### Phase 3 Rollback
- Disable FEFO allocation
- Continue recording movements without batches

### Phase 4 Rollback
- Re-enable currentQty updates
- Keep snapshot system running in parallel

**Key**: Parallel systems during migration mean zero-downtime rollback.

---

## Cost Analysis

| Phase | Infrastructure Change | Cost |
|-------|----------------------|------|
| Phase 1 | +3 collections per shop | $0 (within M0 limits) |
| Phase 2 | +SSE connections | $0 (native Node.js) |
| Phase 3 | +Cron job | $0 (node-cron) |
| Phase 4 | Remove legacy code | $0 |
| **Total** | | **$0** |

At 50+ shops, MongoDB Atlas M10 ($57/month) recommended for performance, but not required.

---

## Success Metrics

| Metric | Before | After Target |
|--------|--------|--------------|
| Stock accuracy | 95% (manual checks) | 100% (audit trail) |
| Negative stock incidents | 1-2/month | 0 (prevented by lock) |
| Real-time sync delay | N/A (manual refresh) | <1 second |
| Movement history queries | Impossible | Instant |
| Batch recall time | Hours (manual) | Minutes (automated) |
| Compliance audit readiness | Low | High |

---

## Next Steps

1. **Review** this roadmap with your team
2. **Schedule** Phase 1 implementation (1 day)
3. **Test** in development environment first
4. **Deploy** Phase 1 to production (no user impact)
5. **Monitor** for 2-3 days before Phase 2

**Questions or concerns?** This roadmap can be adjusted based on your priorities and timeline constraints.

---

**Status**: READY FOR IMPLEMENTATION  
**Risk Level**: LOW (parallel systems, incremental rollout)  
**Estimated Total Time**: 4 weeks (or 2 weeks accelerated)  
**Cost**: $0
