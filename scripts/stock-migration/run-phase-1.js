/**
 * Run All Phase 1 Migration Steps
 * 
 * Executes all Phase 1 steps in sequence:
 * 1. Create collections
 * 2. Create indexes
 * 3. Seed snapshots
 * 
 * Run: node scripts/stock-migration/run-phase-1.js
 */

const { exec } = require('child_process');
const path = require('path');
const util = require('util');

const execPromise = util.promisify(exec);

const STEPS = [
  {
    name: 'Create Collections',
    script: '01-create-collections.js',
    description: 'Creating stock_ledger, stock_snapshots, and stock_batches collections'
  },
  {
    name: 'Create Indexes',
    script: '02-create-indexes.js',
    description: 'Creating performance indexes for stock collections'
  },
  {
    name: 'Seed Snapshots',
    script: '03-seed-snapshots.js',
    description: 'Migrating current stock from products.currentQty to snapshots'
  }
];

async function runPhase1() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║   PHASE 1: Stock Architecture Foundation Migration   ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  const startTime = Date.now();
  
  for (let i = 0; i < STEPS.length; i++) {
    const step = STEPS[i];
    const stepNum = i + 1;
    
    console.log(`\n┌─ Step ${stepNum}/${STEPS.length}: ${step.name} ${'─'.repeat(40 - step.name.length)}┐`);
    console.log(`│ ${step.description}`);
    console.log(`└${'─'.repeat(55)}┘\n`);
    
    const scriptPath = path.join(__dirname, step.script);
    
    try {
      const { stdout, stderr } = await execPromise(`node "${scriptPath}"`);
      
      if (stdout) {
        console.log(stdout);
      }
      
      if (stderr && !stderr.includes('DeprecationWarning')) {
        console.warn('⚠️  Warnings:', stderr);
      }
      
      console.log(`✅ Step ${stepNum} completed successfully\n`);
      
    } catch (error) {
      console.error(`\n❌ Step ${stepNum} failed: ${step.name}`);
      console.error(`Error: ${error.message}`);
      
      if (error.stdout) {
        console.error('Output:', error.stdout);
      }
      
      if (error.stderr) {
        console.error('Error details:', error.stderr);
      }
      
      console.log('\n💡 Troubleshooting tips:');
      console.log('   1. Check your MongoDB connection string in .env');
      console.log('   2. Ensure MongoDB Atlas M0 (or higher) is running');
      console.log('   3. Verify you have network access to MongoDB');
      console.log('   4. Check scripts/stock-migration/README.md for details');
      
      process.exit(1);
    }
  }
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║              🎉 PHASE 1 COMPLETE! 🎉                  ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  console.log(`⏱️  Total time: ${duration} seconds\n`);
  
  console.log('✅ What was created:');
  console.log('   • Stock ledger collections (event log)');
  console.log('   • Stock snapshot collections (materialized view)');
  console.log('   • Stock batch collections (FEFO tracking)');
  console.log('   • Performance indexes (17 per shop)');
  console.log('   • Initial snapshots from products.currentQty\n');
  
  console.log('📋 Next steps:');
  console.log('   1. Review the migration results above');
  console.log('   2. Verify snapshots match product count');
  console.log('   3. Deploy StockCommandService to backend');
  console.log('   4. Update sales routes to dual-write mode');
  console.log('   5. Monitor for 2-3 days before Phase 2\n');
  
  console.log('📖 Documentation:');
  console.log('   • scripts/stock-migration/README.md');
  console.log('   • STOCK_UPGRADE_ROADMAP.md');
  console.log('   • STOCK_ARCHITECTURE_MASTER.md\n');
  
  console.log('🔄 Rollback (if needed):');
  console.log('   node scripts/stock-migration/rollback-phase-1.js\n');
}

// Run Phase 1
runPhase1()
  .then(() => {
    console.log('✅ Phase 1 migration completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Phase 1 migration failed:', error.message);
    process.exit(1);
  });
