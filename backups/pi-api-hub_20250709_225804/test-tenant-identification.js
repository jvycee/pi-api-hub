const SimpleTenantManager = require('./middleware/simple-tenant');

/**
 * 🍌 TENANT IDENTIFICATION TESTER 🍌
 * Quick test to verify our tenant identification works
 */

async function testTenantIdentification() {
  console.log('🍌 Testing Tenant Identification...\n');
  
  const tenantManager = new SimpleTenantManager();
  
  // Wait for initialization
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Test cases
  const testCases = [
    {
      name: 'Header-based identification',
      req: {
        get: (header) => header === 'x-tenant-id' ? 'demo' : null,
        path: '/api/test',
        query: {}
      },
      expected: 'demo'
    },
    {
      name: 'Subdomain-based identification',
      req: {
        get: (header) => {
          if (header === 'x-tenant-id') return null;
          if (header === 'host') return 'test.api.local';
          return null;
        },
        path: '/api/test',
        query: {}
      },
      expected: 'test'
    },
    {
      name: 'Path-based identification',
      req: {
        get: () => null,
        path: '/tenant/demo/api/test',
        query: {}
      },
      expected: 'demo'
    },
    {
      name: 'Query parameter identification',
      req: {
        get: () => null,
        path: '/api/test',
        query: { tenant: 'test' }
      },
      expected: 'test'
    },
    {
      name: 'Default tenant fallback',
      req: {
        get: () => null,
        path: '/api/test',
        query: {}
      },
      expected: 'default'
    },
    {
      name: 'Priority test (header wins over subdomain)',
      req: {
        get: (header) => {
          if (header === 'x-tenant-id') return 'demo';
          if (header === 'host') return 'test.api.local';
          return null;
        },
        path: '/api/test',
        query: {}
      },
      expected: 'demo'
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const testCase of testCases) {
    try {
      const result = tenantManager.extractTenantId(testCase.req);
      
      if (result === testCase.expected) {
        console.log(`✅ ${testCase.name}: ${result}`);
        passed++;
      } else {
        console.log(`❌ ${testCase.name}: Expected '${testCase.expected}', got '${result}'`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ${testCase.name}: Error - ${error.message}`);
      failed++;
    }
  }
  
  console.log(`\n🍌 Test Results: ${passed} passed, ${failed} failed\n`);
  
  // Test tenant config loading
  console.log('🍌 Testing Tenant Configuration Loading...\n');
  
  const configTests = [
    { tenantId: 'default', shouldExist: true },
    { tenantId: 'demo', shouldExist: true },
    { tenantId: 'test', shouldExist: true },
    { tenantId: 'nonexistent', shouldExist: false }
  ];
  
  for (const configTest of configTests) {
    try {
      const config = await tenantManager.getTenantConfig(configTest.tenantId);
      
      if (configTest.shouldExist && config) {
        console.log(`✅ ${configTest.tenantId}: ${config.name} (${config.status})`);
        console.log(`   Features: ${Object.keys(config.features).filter(f => config.features[f]).join(', ')}`);
      } else if (!configTest.shouldExist && (!config || config === tenantManager.getTenantConfig('default'))) {
        console.log(`✅ ${configTest.tenantId}: Correctly fell back to default`);
      } else {
        console.log(`❌ ${configTest.tenantId}: Unexpected result`);
      }
    } catch (error) {
      console.log(`❌ ${configTest.tenantId}: Error - ${error.message}`);
    }
  }
  
  // Show tenant stats
  console.log('\n🍌 Tenant Manager Stats:');
  const stats = tenantManager.getStats();
  console.log(`  Total Tenants: ${stats.totalTenants}`);
  console.log(`  Active Tenants: ${stats.activeTenants}`);
  console.log(`  Default Tenant: ${stats.defaultTenant}`);
  console.log(`  Cache Age: ${Math.round(stats.cacheAge / 1000)}s`);
  
  // List all tenants
  console.log('\n🍌 Available Tenants:');
  const tenants = tenantManager.listTenants();
  Object.entries(tenants).forEach(([id, config]) => {
    console.log(`  ${id}: ${config.name} (${config.status})`);
  });
  
  console.log('\n🍌 Tenant identification test complete! 🍌');
}

// Run the test
if (require.main === module) {
  testTenantIdentification().catch(console.error);
}

module.exports = testTenantIdentification;