# Phase 1: Foundation - READY TO DEPLOY

**Date**: June 19, 2026  
**Status**: ✅ READY FOR EXECUTION  
**Risk**: LOW (No breaking changes)

---

## What We've Built

### ✅ Migration Scripts (Complete)

1. **`01-create-collections.js`**
   - Creates stock_ledger, stock_snapshots, stock_batches
   - Auto-detects all shops
   - Safe to run multiple times (skips existing)

2. **`02-create-indexes.js`**
   - Creates 13 performance indexes per shop
   - Unique constraints for data integrity
   - Optimistic locking support

3. **`03-seed-snapshots.js`**
   - Migrates products.currentQty → snapshots
   - Creates opening stock ledger entries
   - Links snapshots to ledger

4. **`run-phase-1.js`** ⭐
   - Runs all 3 steps in sequence
   - Error handling and progress reporting
   - **This is the main script to run**

5. **`verify-migration.js`**
   - Validates migration completed correctly
   - Checks data integrity
   - Confirms index creation

6. **`rollback-phase-1.js`**
   - Safe rollback if needed
   - Drops stock collections only
   - Preserves products.currentQty

### ✅ Stock Command Service (Complete)

**File**: `server/src/services/stock-command.service.js`

**Features**:
- ✅ Event sourcing pattern implementation
- ✅ Optimistic locking (prevents race conditions)
- ✅ FEFO batch allocation
- ✅ Complete audit trail
- ✅ Movement type validation
- ✅ Insufficient stock prevention
- ✅ Concurrency conflict detection
- ✅ SSE integration ready (Phase 2)

**Methods**:
```javascript
// Record any stock movement
await stockCommand.recordMovement({
  shopId, productId, movementType, quantity, userId
});

// Allocate batches using FEFO
const allocations = await stockCommand.allocateBatchesFEFO(
  productId, qtyNeeded, shopId
);

// Get current snapshot
const snapshot = await stockCommand.getSnapshot(productId, shopId);

// Get movement history
const history = await stockCommand.getMovementHistory(
  productId, shopId, { limit: 50 }
);
```

### ✅ Documentation (Complete)

1. **`STOCK_ARCHITECTURE_MASTER.md`** (15,000+ words)
   - Complete architecture specification
   - All patterns and designs explained
   - Code samples for every component

2. **`STOCK_UPGRADE_ROADMAP.md`** (8,000+ words)
   - 4-week phased implementation plan
   - Step-by-step instructions
   - Testing and rollback strategies

3. **`STOCK_SYSTEM_COMPARISON.md`** (4,000+ words)
   - Before/after comparisons
   - Decision framework
   - FAQs and troubleshooting

4. **`scripts/stock-migration/README.md`**
   - Migration script documentation
   - Prerequisites and verification
   - Troubleshooting guide

---

## How to Run Phase 1

### Prerequisites Checklist

- [ ] MongoDB Atlas M0 (or higher) running
- [ ] `.env` file with MONGO_URI configured
- [ ] Node.js installed (v14+)
- [ ] Packages installed: `npm install`
- [ ] Current system working (no pending issues)
- [ ] Backup taken (recommended but not required)

### Execution Steps

```bash
# 1. Navigate to project root
cd "C:\Projects\Health Care Surgical Mart"

# 2. Run Phase 1 migration (all steps)
node scripts/stock-migration/run-phase-1.js

# 3. Verify migration succeeded
node scripts/stock-migration/verify-migration.js

# 4. Review results
# ✅ All checks passed? Proceed to deployment
# ⚠️  Issues found? Review logs and troubleshoot
```

### Expected Output

```
╔════════════════════════════════════════════════════════╗
║   PHASE 1: Stock Architecture Foundation Migration   ║
╚════════════════════════════════════════════════════════╝

┌─ Step 1/3: Create Collections ──────────────────────┐
│ Creating stock_ledger, stock_snapshots, and stock_batches
└──────────────────────────────────────────────────────┘

✅ Connected to MongoDB
📊 Found 1 shops: shop1

🏪 Processing shop1...
   ✅ Created shop1_stock_ledger
   ✅ Created shop1_stock_snapshots
   ✅ Created shop1_stock_batches

✅ Step 1 completed successfully

┌─ Step 2/3: Create Indexes ──────────────────────────┐
│ Creating performance indexes for stock collections
└──────────────────────────────────────────────────────┘

... (index creation output)

✅ Step 2 completed successfully

┌─ Step 3/3: Seed Snapshots ──────────────────────────┐
│ Migrating current stock from products.currentQty
└──────────────────────────────────────────────────────┘

... (snapshot seeding output)

✅ Step 3 completed successfully

╔════════════════════════════════════════════════════════╗
║              🎉 PHASE 1 COMPLETE! 🎉                  ║
╚════════════════════════════════════════════════════════╝
```

### Estimated Time

- **Small shop** (< 100 products): 30 seconds
- **Medium shop** (100-500 products): 1-2 minutes
- **Large shop** (500+ products): 2-5 minutes

---

## What Changes

### ✅ Added (New Collections)

```
shop1_stock_ledger         (event log)
shop1_stock_snapshots      (materialized view)
shop1_stock_batches        (FEFO tracking)
```

### ✅ Added (New Service)

```
server/src/services/stock-command.service.js
```

### ⚠️ NOT Changed (Existing System)

```
✅ products.currentQty      (unchanged)
✅ Sales routes            (unchanged)
✅ Purchase routes         (unchanged)
✅ POS functionality       (unchanged)
✅ Frontend components     (unchanged)
```

**Result**: Both old and new systems coexist. No user-visible changes yet.

---

## Verification Checklist

After running Phase 1:

- [ ] Run `verify-migration.js` - all checks pass
- [ ] Check MongoDB Atlas - see new collections
- [ ] Verify snapshot count matches product count
- [ ] Check logs for any errors
- [ ] Test existing POS - still works normally
- [ ] Confirm products.currentQty unchanged

---

## Next Steps After Phase 1

### Immediate (Same Day)

1. **Deploy StockCommandService** to production
   ```bash
   git add server/src/services/stock-command.service.js
   git commit -m "feat: add stock command service for event sourcing"
   git push origin main
   ```

2. **Monitor** MongoDB collections
   - Verify collections exist in production
   - Check index creation succeeded
   - Confirm snapshot data looks correct

### Short Term (Next 1-2 Days)

3. **Update Sales Route** to dual-write mode
   - Write to products.currentQty (old system)
   - Write to stock_ledger + snapshot (new system)
   - Both systems stay in sync

4. **Test Dual-Write**
   - Create test sales
   - Verify both systems update
   - Check stock values match

5. **Monitor for 2-3 days**
   - Ensure no errors
   - Confirm accuracy
   - Validate performance

### Medium Term (Week 2)

6. **Proceed to Phase 2**
   - Switch frontend to read from snapshots
   - Deploy SSE real-time sync
   - Update StockReport.jsx

See `STOCK_UPGRADE_ROADMAP.md` for complete Phase 2 plan.

---

## Rollback Plan

If issues arise:

```bash
# Rollback Phase 1 (safe, no data loss)
node scripts/stock-migration/rollback-phase-1.js

# Confirms before dropping collections
# Preserves all products.currentQty
# System returns to pre-Phase-1 state
```

**When to Rollback**:
- Migration verification fails
- Data integrity issues found
- Need to restart migration cleanly
- Testing purposes

**Safe to Rollback Because**:
- No changes to existing data
- Products.currentQty untouched
- Can re-run migration anytime
- Zero downtime

---

## Troubleshooting

### Issue: "MONGO_URI not found"

**Solution**:
```bash
# Check .env file exists
ls .env

# Verify variable name
cat .env | grep MONGO

# Should show:
MONGO_URI=mongodb+srv://...
# OR
MONGODB_URI=mongodb+srv://...
```

### Issue: "Collection already exists"

**Status**: ⚠️ Warning (safe to ignore)

**Explanation**: Script skips existing collections automatically.

**Action**: None required, or run rollback first for clean slate.

### Issue: "Snapshot count doesn't match product count"

**Check**:
1. Do some products have null/undefined currentQty?
2. Were products added during migration?
3. Run verify script to see details

**Solution**:
```bash
# Re-run snapshot seeding only
node scripts/stock-migration/03-seed-snapshots.js
```

### Issue: "Connection timeout"

**Check**:
1. MongoDB Atlas cluster is running
2. IP whitelist includes your IP (or 0.0.0.0/0 for testing)
3. Network connection stable
4. Connection string correct

---

## Success Criteria

Phase 1 is successful when:

- ✅ All 3 migration scripts complete without errors
- ✅ `verify-migration.js` shows "ALL CHECKS PASSED"
- ✅ Snapshot count equals product count
- ✅ All 13 indexes created per shop
- ✅ Existing POS still works normally
- ✅ No user-visible changes (as expected)

---

## Support Resources

### Documentation
- `STOCK_ARCHITECTURE_MASTER.md` - Technical architecture
- `STOCK_UPGRADE_ROADMAP.md` - Implementation guide
- `scripts/stock-migration/README.md` - Migration details

### Code Files
- `scripts/stock-migration/` - All migration scripts
- `server/src/services/stock-command.service.js` - Core service

### MongoDB Resources
- MongoDB Atlas Dashboard for monitoring
- Check Metrics → Charts for performance
- Review Logs → Deployment for errors

---

## Cost Impact

**Phase 1 Cost**: $0.00

- Uses existing MongoDB Atlas M0 (free tier)
- No additional services required
- No infrastructure changes
- Stays within free tier limits

**Performance Impact**: None (collections not yet used)

---

## Timeline

| Task | Duration | When |
|------|----------|------|
| Run migration scripts | 2-5 minutes | Now |
| Verify migration | 1 minute | Immediately after |
| Deploy to production | 5 minutes | Same day |
| Monitor | Ongoing | Next 2-3 days |
| Proceed to Phase 2 | Week 2 | After validation |

---

## Team Communication

### What to Tell Stakeholders

"We're upgrading the stock management system to enterprise-grade event sourcing. Phase 1 is the foundation - we're setting up new data structures alongside the existing system. There's zero downtime and no user-visible changes. This will enable real-time sync, complete audit trails, and batch tracking in future phases."

### What to Tell Developers

"Phase 1 creates the event-sourced stock infrastructure. We're running in parallel with the old system - nothing breaks. New collections are stock_ledger (events), stock_snapshots (current state), and stock_batches (FEFO). StockCommandService handles all writes. Phase 2 switches reads to snapshots."

### What to Tell Users

**Nothing yet.** Phase 1 is invisible to users. No changes to POS, no new features, no disruption.

---

## Final Checklist Before Running

- [ ] Backed up database (optional but recommended)
- [ ] Reviewed this document completely
- [ ] Confirmed MongoDB connection working
- [ ] Tested current system works normally
- [ ] Allocated 10 minutes for migration + verification
- [ ] Ready to run `node scripts/stock-migration/run-phase-1.js`

---

**Ready?** Let's run Phase 1! 🚀

```bash
node scripts/stock-migration/run-phase-1.js
```
