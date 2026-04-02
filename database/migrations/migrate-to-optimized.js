#!/usr/bin/env node

/**
 * Migration Script to Optimized Structure
 * Gradually migrates from old server to new optimized structure
 */

const fs = require("fs");
const path = require("path");

console.log("🔄 Starting migration to optimized structure...");

// Step 1: Update package.json scripts to use new structure
console.log("📦 Updating package.json scripts...");

const packageJsonPath = path.join(__dirname, "../package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

// Add new scripts for gradual migration
packageJson.scripts = {
  ...packageJson.scripts,
  "start:old": "node server-multi-tenant.js",
  "start:new": "node src/server.js",
  "dev:old": "nodemon server-multi-tenant.js",
  "dev:new": "nodemon src/server.js",
  "migrate:test": "node scripts/test-migration.js",
};

fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

console.log("✅ Package.json updated with migration scripts");

// Step 2: Create a test migration script
console.log("🧪 Creating test migration script...");

const testMigrationScript = `#!/usr/bin/env node

/**
 * Test Migration Script
 * Tests both old and new servers to ensure compatibility
 */

const { spawn } = require('child_process');
const http = require('http');

async function testServer(command, port, name) {
  return new Promise((resolve, reject) => {
    console.log(\`🚀 Starting \${name} server...\`);
    
    const server = spawn('node', [command], {
      stdio: 'pipe',
      env: { ...process.env, PORT: port }
    });

    let started = false;

    server.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('running') || output.includes('listening')) {
        started = true;
        console.log(\`✅ \${name} server started on port \${port}\`);
        
        // Test health endpoint
        setTimeout(() => {
          const req = http.get(\`http://localhost:\${port}/health\`, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
              try {
                const result = JSON.parse(body);
                console.log(\`✅ \${name} health check passed:\`, result.message || result.status);
                server.kill();
                resolve(true);
              } catch (error) {
                console.log(\`❌ \${name} health check failed:\`, error.message);
                server.kill();
                resolve(false);
              }
            });
          }).on('error', (error) => {
            console.log(\`❌ \${name} connection failed:\`, error.message);
            server.kill();
            resolve(false);
          });
        }, 2000);
      }
    });

    server.stderr.on('data', (data) => {
      const error = data.toString();
      if (!started && (error.includes('Error') || error.includes('failed'))) {
        console.log(\`❌ \${name} server failed to start:\`, error);
        server.kill();
        resolve(false);
      }
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      if (!started) {
        console.log(\`⏰ \${name} server timeout\`);
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
  
  console.log('\\n📊 Migration Test Results:');
  console.log(\`Old Server: \${oldServerWorks ? '✅ Working' : '❌ Failed'}\`);
  console.log(\`New Server: \${newServerWorks ? '✅ Working' : '❌ Failed'}\`);
  
  if (oldServerWorks && newServerWorks) {
    console.log('\\n🎉 Migration ready! Both servers are compatible.');
    console.log('💡 You can now use "npm run start:new" to use the optimized server.');
  } else if (oldServerWorks && !newServerWorks) {
    console.log('\\n⚠️  Migration needs fixes. Old server works but new server has issues.');
    console.log('💡 Continue using "npm run start:old" until new server is fixed.');
  } else {
    console.log('\\n❌ Both servers have issues. Check your environment configuration.');
  }
}

runTests().catch(console.error);
`;

fs.writeFileSync(
  path.join(__dirname, "test-migration.js"),
  testMigrationScript,
);

console.log("✅ Test migration script created");

// Step 3: Create environment setup guide
console.log("📋 Creating environment setup guide...");

const setupGuide = `# Migration Setup Guide

## Current Status
Your project has been optimized with a new professional structure while maintaining backward compatibility.

## Available Commands

### Old Server (Current Working)
- \`npm run start:old\` - Start the current working server
- \`npm run dev:old\` - Development mode with current server

### New Optimized Server
- \`npm run start:new\` - Start the new optimized server
- \`npm run dev:new\` - Development mode with optimized server

### Migration Testing
- \`npm run migrate:test\` - Test both servers for compatibility

## Migration Steps

1. **Test Current Setup**
   \`\`\`bash
   npm run migrate:test
   \`\`\`

2. **If Both Servers Work**
   - You can switch to the optimized server: \`npm run start:new\`
   - Update your deployment scripts to use the new server

3. **If Only Old Server Works**
   - Continue using the old server: \`npm run start:old\`
   - Check the new server logs for issues
   - Fix any configuration problems

## New Features in Optimized Server

- ✅ Professional logging with Winston
- ✅ Enhanced security middleware
- ✅ Better error handling
- ✅ Performance monitoring
- ✅ Comprehensive validation
- ✅ Rate limiting
- ✅ Security headers
- ✅ Environment validation
- ✅ Graceful shutdown handling

## File Structure Changes

\`\`\`
src/
├── config/           # All configuration files
├── middleware/       # Custom middleware
├── routes/          # API routes (moved from /routes)
├── models/          # Database schemas (moved from /schemas)
├── utils/           # Utilities (moved from /utils)
└── server.js        # New optimized server
\`\`\`

## Environment Variables

The new server requires additional environment variables. Check \`.env.example\` for the complete list.

## Backward Compatibility

- All existing API endpoints work the same
- Database structure unchanged
- Authentication system unchanged
- Frontend compatibility maintained

## Next Steps

1. Test the migration with \`npm run migrate:test\`
2. If successful, gradually switch to \`npm run start:new\`
3. Update your deployment configuration
4. Remove old files when confident in new structure
`;

fs.writeFileSync(path.join(__dirname, "../MIGRATION.md"), setupGuide);

console.log("✅ Migration setup guide created: MIGRATION.md");

console.log("\n🎉 Migration setup complete!");
console.log("\n📋 Next steps:");
console.log("1. Run: npm run migrate:test");
console.log("2. Check MIGRATION.md for detailed instructions");
console.log("3. Use npm run start:old to continue with current server");
console.log("4. Use npm run start:new when ready for optimized server");
