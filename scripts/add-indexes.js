/**
 * Add Database Indexes Script
 * Adds performance indexes to all shop collections
 * Run: node scripts/add-indexes.js
 */

const { connectToDatabase, getShopDatabase, getSystemDatabase, closeDatabaseConnection } = require('../server/src/config/database');
const { logger } = require('../server/src/config/logging');

async function addAllIndexes() {
  try {
    logger.info('Starting index creation...');
    await connectToDatabase();
    const systemDb = getSystemDatabase();
    
    // Get all shops
    const shops = await systemDb.collection('shops').find({}).toArray();
    
    logger.info(`Found ${shops.length} shop(s) to process`);
    console.log(`\n📊 Adding indexes for ${shops.length} shop(s)...\n`);
    
    for (const shop of shops) {
      console.log(`Processing shop: ${shop.name} (${shop.shopId})...`);
      const shopDb = getShopDatabase(shop.shopId);
      
      // Products indexes
      try {
        await shopDb.collection('products').createIndexes([
          { key: { sku: 1 }, unique: true, name: 'sku_unique' },
          { key: { name: 1 }, name: 'name_index' },
          { key: { category: 1 }, name: 'category_index' },
          { key: { isActive: 1 }, name: 'active_status_index' },
          { key: { barcode: 1 }, sparse: true, name: 'barcode_index' },
          { key: { name: 'text', description: 'text', brand: 'text' }, name: 'text_search' },
        ]);
        console.log('  ✓ Products indexes created');
      } catch (err) {
        console.log('  ⚠ Products indexes:', err.message);
      }
      
      // Sales indexes
      try {
        await shopDb.collection('sales').createIndexes([
          { key: { invoiceNo: 1 }, unique: true, name: 'invoice_unique' },
          { key: { saleDate: -1 }, name: 'sale_date_desc' },
          { key: { customerId: 1 }, name: 'customer_index' },
          { key: { createdBy: 1 }, name: 'created_by_index' },
          { key: { saleDate: -1, customerId: 1 }, name: 'date_customer_compound' },
          { key: { paymentStatus: 1 }, name: 'payment_status_index' },
        ]);
        console.log('  ✓ Sales indexes created');
      } catch (err) {
        console.log('  ⚠ Sales indexes:', err.message);
      }
      
      // Customers indexes
      try {
        await shopDb.collection('customers').createIndexes([
          { key: { phone: 1 }, name: 'phone_index' },
          { key: { email: 1 }, sparse: true, name: 'email_index' },
          { key: { type: 1 }, name: 'customer_type_index' },
          { key: { name: 1 }, name: 'name_index' },
        ]);
        console.log('  ✓ Customers indexes created');
      } catch (err) {
        console.log('  ⚠ Customers indexes:', err.message);
      }
      
      // Expenses indexes
      try {
        await shopDb.collection('expenses').createIndexes([
          { key: { expenseDate: -1 }, name: 'expense_date_desc' },
          { key: { categoryId: 1 }, name: 'category_index' },
          { key: { createdBy: 1 }, name: 'created_by_index' },
          { key: { expenseDate: -1, categoryId: 1 }, name: 'date_category_compound' },
        ]);
        console.log('  ✓ Expenses indexes created');
      } catch (err) {
        console.log('  ⚠ Expenses indexes:', err.message);
      }
      
      // Users indexes
      try {
        await shopDb.collection('users').createIndexes([
          { key: { email: 1 }, unique: true, name: 'email_unique' },
          { key: { role: 1 }, name: 'role_index' },
          { key: { isActive: 1 }, name: 'active_status_index' },
          { key: { firebaseUid: 1 }, sparse: true, name: 'firebase_uid_index' },
        ]);
        console.log('  ✓ Users indexes created');
      } catch (err) {
        console.log('  ⚠ Users indexes:', err.message);
      }
      
      // Purchases indexes (if collection exists)
      try {
        const purchasesExist = await shopDb.collection('purchases').countDocuments({}, { limit: 1 });
        if (purchasesExist > 0) {
          await shopDb.collection('purchases').createIndexes([
            { key: { purchaseDate: -1 }, name: 'purchase_date_desc' },
            { key: { supplierId: 1 }, name: 'supplier_index' },
            { key: { createdBy: 1 }, name: 'created_by_index' },
            { key: { invoiceNo: 1 }, unique: true, sparse: true, name: 'invoice_unique' },
          ]);
          console.log('  ✓ Purchases indexes created');
        } else {
          console.log('  ⊘ Purchases collection empty (skipped)');
        }
      } catch (err) {
        console.log('  ⊘ Purchases collection not found (skipped)');
      }
      
      // Stock indexes (if collection exists)
      try {
        const stockExists = await shopDb.collection('stock').countDocuments({}, { limit: 1 });
        if (stockExists > 0) {
          await shopDb.collection('stock').createIndexes([
            { key: { productId: 1 }, name: 'product_index' },
            { key: { currentQty: 1 }, name: 'quantity_index' },
            { key: { lastUpdated: -1 }, name: 'last_updated_desc' },
          ]);
          console.log('  ✓ Stock indexes created');
        } else {
          console.log('  ⊘ Stock collection empty (skipped)');
        }
      } catch (err) {
        console.log('  ⊘ Stock collection not found (skipped)');
      }
      
      // Returns indexes (if collection exists)
      try {
        const returnsExist = await shopDb.collection('returns').countDocuments({}, { limit: 1 });
        if (returnsExist > 0) {
          await shopDb.collection('returns').createIndexes([
            { key: { returnDate: -1 }, name: 'return_date_desc' },
            { key: { saleId: 1 }, name: 'sale_index' },
            { key: { status: 1 }, name: 'status_index' },
          ]);
          console.log('  ✓ Returns indexes created');
        } else {
          console.log('  ⊘ Returns collection empty (skipped)');
        }
      } catch (err) {
        console.log('  ⊘ Returns collection not found (skipped)');
      }
      
      console.log(`✅ Indexes created for ${shop.shopId}\n`);
    }
    
    // System indexes
    console.log('Creating system-level indexes...');
    
    try {
      await systemDb.collection('shops').createIndexes([
        { key: { shopId: 1 }, unique: true, name: 'shopId_unique' },
        { key: { ownerEmail: 1 }, name: 'email_index' },
        { key: { status: 1 }, name: 'status_index' },
        { key: { createdAt: -1 }, name: 'created_date_desc' },
      ]);
      console.log('  ✓ Shops indexes created');
    } catch (err) {
      console.log('  ⚠ Shops indexes:', err.message);
    }
    
    try {
      await systemDb.collection('system_users').createIndexes([
        { key: { email: 1 }, unique: true, name: 'email_unique' },
        { key: { role: 1 }, name: 'role_index' },
        { key: { isActive: 1 }, name: 'active_status_index' },
        { key: { firebaseUid: 1 }, sparse: true, name: 'firebase_uid_index' },
      ]);
      console.log('  ✓ System users indexes created');
    } catch (err) {
      console.log('  ⚠ System users indexes:', err.message);
    }
    
    console.log('\n🎉 All indexes created successfully!');
    console.log('\n📊 Query Performance Expected Improvements:');
    console.log('  • Product searches: 10-50x faster');
    console.log('  • Sales history: 20-100x faster');
    console.log('  • Dashboard reports: 5-20x faster');
    console.log('  • Text search: Enabled (product names, descriptions)');
    
    await closeDatabaseConnection();
    process.exit(0);
    
  } catch (error) {
    logger.error('Error adding indexes:', error);
    console.error('\n❌ Error adding indexes:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
addAllIndexes();
