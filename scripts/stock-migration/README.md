# Stock Migration Scripts - Phase 1

## Overview

These scripts implement **Phase 1: Foundation** of the stock architecture upgrade.

### What Phase 1 Does:
- ✅ Creates new event-sourced stock collections (ledger, snapshots, batches)
- ✅ Creates performance indexes
- ✅ Seeds initial snapshots from existing products.currentQty
- ✅ Sets up StockCommandService for dual-write mode
- ✅ **NO BREAKING CHANGES** - old system continues to work

---

## Prerequisites

1. MongoDB connection string in `.env` file:
   ```
   MONGO_URI=mongodb+srv://...
   ```

2. Node.js installed (v14+ recommended)

3. Required packages (should already be installed):
   ```bash
   npm install mongodb dotenv
   ```

---

## Running the Migration

### Option 1: Run All Steps (Recommended)

```bash
node scripts/stock-migration/run-phase-1.js
```

This runs all 3 steps in sequence with error handling.

### Option 2: Run Steps Individually

```bash
# Step 1: Create collections
node scripts/stock-migration/01-create-collections.js

# Step 2: Create indexes
node scripts/stock-migration/02-create-indexes.js

# Step 3: Seed snapshots from existing products
node scripts/stock-migration/03-seed-snapshots.js
```

---

## What Gets Created

### Collections (per shop)

1. **`shop{X}_stock_ledger`** - Immutable event log
   - Every stock movement as an event
   - Complete audit trail
   - Point-in-time query capability

2. **`shop{X}_stock_snapshots`** - Materialized view
   - Current stock state (pre-computed)
   - Fast O(1) reads
   - Optimistic locking version

3. **`shop{X}_stock_batches`** - FEFO tracking
   - Batch numbers and expiry dates
   - First Expiry First Out allocation
   - Healthcare compliance

### Indexes Created

**Stock Ledger** (7 indexes):
- product_timeline: Query movements by product + date
- reference_lookup: Link to source documents (sales, purchases)
- type_timeline: Filter by movement type
- batch_lookup: Find by batch number
- expiry_scan: Expiry date queries
- user_activity: Audit by user
- version_lock: **Unique** constraint for optimistic locking

**Stock Snapshots** (3 indexes):
- product_lookup: **Unique** product → snapshot mapping
- reorder_scan: Low stock alerts
- recent_activity: Recent stock changes

**Stock Batches** (3 indexes):
- fefo_query: FEFO batch selection
- expiry_alert: Expiring batches
- batch_product: **Unique** batch+product combo

---

## Verification

After running the migration, verify:

```bash
# Check collections were created
mongo <your-connection-string> --eval "db.getCollectionNames().filter(c => c.includes('stock'))"

# Count snapshots (should match product count)
node scripts/stock-migration/verify-migration.js
```

Expected output:
```
✅ shop1_stock_ledger: 150 entries
✅ shop1_stock_snapshots: 150 snapshots
✅ shop1_stock_batches: 0 batches (created for Phase 3)
```

---

## Rollback

If you need to rollback Phase 1:

```bash
node scripts/stock-migration/rollback-phase-1.js
```

This will:
- Drop stock_ledger, stock_snapshots, stock_batches collections
- Keep your existing products.currentQty intact
- No data loss

---

## What Happens to Existing Data?

### ✅ Safe Operations:
- `products.currentQty` is **NOT** modified
- Existing products continue to work
- Current POS operations unaffected
- No downtime required

### ✅ Data Migration:
- Each product's `currentQty` is copied to a snapshot
- Opening stock ledger entry created for each product
- All products maintain their current stock levels

---

## Next Steps After Phase 1

Once Phase 1 is complete and verified:

1. **Deploy StockCommandService** to production
2. **Update sales/purchase routes** to dual-write (old + new systems)
3. **Monitor for 2-3 days** to ensure both systems stay in sync
4. **Proceed to Phase 2** (switch frontend to read from snapshots)

See `STOCK_UPGRADE_ROADMAP.md` for complete implementation plan.

---

## Troubleshooting

### Error: "MONGO_URI not found"
- Ensure `.env` file exists in project root
- Check environment variable name matches your config

### Error: "Collection already exists"
- Safe to ignore - script skips existing collections
- Or run rollback script first to start clean

### Error: "Index creation failed"
- Check MongoDB version (4.0+ required for transactions)
- Verify user has createIndex permission

### Snapshots count doesn't match products
- Check if some products have null/undefined currentQty
- Run verification script to see details

---

## Support

For issues or questions:
1. Check STOCK_ARCHITECTURE_MASTER.md for architecture details
2. Check STOCK_UPGRADE_ROADMAP.md for implementation guide
3. Review error logs in console output
4. MongoDB Atlas logs for connection issues

---

**Phase 1 Status**: READY TO RUN  
**Risk Level**: LOW (no breaking changes)  
**Estimated Time**: 2-5 minutes  
**Rollback**: Easy (drop collections)
