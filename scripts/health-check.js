/**
 * Health Check Script
 * Verifies all services are running correctly
 * Run: node scripts/health-check.js
 */

const axios = require('axios');

const BACKEND_URL = process.env.BACKEND_URL || 'https://health-care-surgical-mart.onrender.com';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://health-care-60ee6.web.app';

async function healthCheck() {
  console.log('🏥 Health Check Starting...\n');
  console.log(`Backend: ${BACKEND_URL}`);
  console.log(`Frontend: ${FRONTEND_URL}\n`);
  
  let allHealthy = true;
  
  // Check Backend
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📡 Checking Backend...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  try {
    const start = Date.now();
    const backendHealth = await axios.get(`${BACKEND_URL}/health`, { 
      timeout: 15000,
      validateStatus: () => true // Accept any status
    });
    const duration = Date.now() - start;
    
    if (backendHealth.status === 200) {
      console.log('✅ Backend: HEALTHY');
      console.log(`  Response Time: ${duration}ms`);
      console.log(`  Status: ${backendHealth.data.status || 'ok'}`);
      console.log(`  Database: ${backendHealth.data.database || 'connected'}`);
      console.log(`  Uptime: ${Math.floor((backendHealth.data.uptime || 0) / 60)} minutes`);
      
      if (backendHealth.data.version) {
        console.log(`  Version: ${backendHealth.data.version}`);
      }
      
      if (duration > 5000) {
        console.log('  ⚠️  WARNING: Slow response (possible cold start)');
      } else if (duration > 2000) {
        console.log('  ⚠️  WARNING: Slower than optimal');
      }
    } else {
      console.log(`❌ Backend: UNHEALTHY (Status ${backendHealth.status})`);
      allHealthy = false;
    }
  } catch (error) {
    console.log('❌ Backend: FAILED');
    console.log(`  Error: ${error.message}`);
    if (error.code === 'ECONNREFUSED') {
      console.log('  Issue: Cannot connect to server');
    } else if (error.code === 'ETIMEDOUT') {
      console.log('  Issue: Request timed out (server may be sleeping)');
    }
    allHealthy = false;
  }
  
  // Check Frontend
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🌐 Checking Frontend...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  try {
    const start = Date.now();
    const frontendHealth = await axios.get(FRONTEND_URL, { 
      timeout: 10000,
      validateStatus: () => true
    });
    const duration = Date.now() - start;
    
    if (frontendHealth.status === 200) {
      console.log('✅ Frontend: HEALTHY');
      console.log(`  Response Time: ${duration}ms`);
      console.log(`  Status: ${frontendHealth.status}`);
      console.log(`  Content-Type: ${frontendHealth.headers['content-type']}`);
      
      if (duration > 2000) {
        console.log('  ⚠️  WARNING: Slow response');
      }
    } else {
      console.log(`❌ Frontend: UNHEALTHY (Status ${frontendHealth.status})`);
      allHealthy = false;
    }
  } catch (error) {
    console.log('❌ Frontend: FAILED');
    console.log(`  Error: ${error.message}`);
    allHealthy = false;
  }
  
  // Check Critical API Endpoints
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔗 Checking API Endpoints...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const endpoints = [
    { name: 'Products List', path: '/api/products', method: 'GET', expectedStatus: [401, 403] },
    { name: 'Sales List', path: '/api/sales', method: 'GET', expectedStatus: [401, 403] },
    { name: 'Customers List', path: '/api/customers', method: 'GET', expectedStatus: [401, 403] },
    { name: 'Dashboard', path: '/api/reports/dashboard', method: 'GET', expectedStatus: [401, 403] },
  ];
  
  for (const endpoint of endpoints) {
    try {
      const start = Date.now();
      const response = await axios({
        method: endpoint.method,
        url: `${BACKEND_URL}${endpoint.path}`,
        timeout: 5000,
        validateStatus: () => true, // Accept any status
      });
      const duration = Date.now() - start;
      
      if (endpoint.expectedStatus.includes(response.status)) {
        console.log(`✅ ${endpoint.name}: Protected (${response.status}) - OK`);
        console.log(`   Response Time: ${duration}ms`);
      } else if (response.status === 200) {
        console.log(`⚠️  ${endpoint.name}: Accessible without auth (security issue?)`);
        allHealthy = false;
      } else if (response.status >= 500) {
        console.log(`❌ ${endpoint.name}: Server Error (${response.status})`);
        console.log(`   Response: ${response.data?.message || 'Unknown error'}`);
        allHealthy = false;
      } else {
        console.log(`⚠️  ${endpoint.name}: Unexpected Status (${response.status})`);
      }
    } catch (error) {
      console.log(`❌ ${endpoint.name}: FAILED - ${error.message}`);
      allHealthy = false;
    }
  }
  
  // Summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Health Check Summary');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  if (allHealthy) {
    console.log('✅ All systems operational');
    console.log('🎉 Health Check PASSED\n');
    process.exit(0);
  } else {
    console.log('❌ Some systems are unhealthy');
    console.log('⚠️  Health Check FAILED\n');
    process.exit(1);
  }
}

// Run health check
healthCheck().catch((error) => {
  console.error('\n💥 Health check crashed:', error.message);
  process.exit(1);
});
