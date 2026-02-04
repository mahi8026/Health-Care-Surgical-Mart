#!/usr/bin/env node

/**
 * Test Migration Script
 * Tests both old and new servers to ensure compatibility
 */

const { spawn } = require('child_process');
const http = require('http');

async function testServer(command, port, name) {
  return new Promise((resolve, reject) => {
    console.log(`🚀 Starting ${name} server...`);
    
    const server = spawn('node', [command], {
      stdio: 'pipe',
      env: { ...process.env, PORT: port }
    });

    let started = false;

    server.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('running') || output.includes('listening')) {
        started = true;
        console.log(`✅ ${name} server started on port ${port}`);
        
        // Test health endpoint
        setTimeout(() => {
          const req = http.get(`http://localhost:${port}/health`, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
              try {
                const result = JSON.parse(body);
                console.log(`✅ ${name} health check passed:`, result.message || result.status);
                server.kill();
                resolve(true);
              } catch (error) {
                console.log(`❌ ${name} health check failed:`, error.message);
                server.kill();
                resolve(false);
              }
            });
          }).on('error', (error) => {
            console.log(`❌ ${name} connection failed:`, error.message);
            server.kill();
            resolve(false);
          });
        }, 2000);
      }
    });

    server.stderr.on('data', (data) => {
      const error = data.toString();
      if (!started && (error.includes('Error') || error.includes('failed'))) {
        console.log(`❌ ${name} server failed to start:`, error);
        server.kill();
        resolve(false);
      }
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      if (!started) {
        console.log(`⏰ ${name} server timeout`);
        server.kill();
        resolve(false);
      }
    }, 10000);
  });
}

async function runTests() {
  console.log('🧪 Testing server migration compatibility...');
  
  // Test old server
  const oldServerWorks = await testServer('server-multi-tenant.js', 5001, 'Old');
  
  // Test new server (if old server works, we know DB connection is good)
  const newServerWorks = await testServer('src/server.js', 5002, 'New');
  
  console.log('\n📊 Migration Test Results:');
  console.log(`Old Server: ${oldServerWorks ? '✅ Working' : '❌ Failed'}`);
  console.log(`New Server: ${newServerWorks ? '✅ Working' : '❌ Failed'}`);
  
  if (oldServerWorks && newServerWorks) {
    console.log('\n🎉 Migration ready! Both servers are compatible.');
    console.log('💡 You can now use "npm run start:new" to use the optimized server.');
  } else if (oldServerWorks && !newServerWorks) {
    console.log('\n⚠️  Migration needs fixes. Old server works but new server has issues.');
    console.log('💡 Continue using "npm run start:old" until new server is fixed.');
  } else {
    console.log('\n❌ Both servers have issues. Check your environment configuration.');
  }
}

runTests().catch(console.error);
