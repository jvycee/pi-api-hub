const axios = require('axios');

/**
 * 🍌 SMART BANANA INTEGRATION TEST SCRIPT 🍌
 * Complete integration test for all 3 enterprise features on Pi
 */

console.log('🍌 Testing Smart Banana Enterprise Features Integration...');
console.log('=====================================================');

// Configuration
const API_URL = 'http://localhost:3000';
const ADMIN_KEY = 'f00d268863ad4f08992aa8583d2b6ea96c65e649f206a9828334bbb3bbd8f7e7';

// Global test state
let authToken = null;
let createdUserId = null;
let testTenantId = 'integration-test';

async function testIntegration() {
  console.log('\\n🍌 Starting Full Integration Test...\\n');
  
  let testsPassed = 0;
  let testsFailed = 0;
  
  // Phase 1: Multi-Tenant System
  console.log('=== PHASE 1: MULTI-TENANT SYSTEM ===');
  
  // Test 1: Create integration test tenant
  console.log('\\nTest 1: Create Integration Test Tenant');
  try {
    const response = await axios.post(`${API_URL}/admin/tenants`, {
      tenantId: testTenantId,
      name: 'Integration Test Tenant',
      description: 'Tenant for integration testing',
      features: ['basic', 'analytics'],
      limits: { maxUsers: 10, maxRequests: 1000 }
    }, {
      headers: {
        'x-admin-api-key': ADMIN_KEY
      }
    });
    
    if (response.data.success) {
      console.log('✅ Create tenant: SUCCESS');
      console.log(`   Tenant ID: ${response.data.data.tenant.id}`);
      testsPassed++;
    } else {
      console.log('❌ Create tenant: FAILED');
      testsFailed++;
    }
  } catch (error) {
    console.log(`❌ Create tenant: FAILED - ${error.response?.data?.message || error.message}`);
    testsFailed++;
  }
  
  // Test 2: Verify tenant creation
  console.log('\\nTest 2: Verify Tenant Creation');
  try {
    const response = await axios.get(`${API_URL}/admin/tenants/${testTenantId}`, {
      headers: {
        'x-admin-api-key': ADMIN_KEY
      }
    });
    
    if (response.data.success && response.data.data.tenant) {
      console.log('✅ Verify tenant: SUCCESS');
      console.log(`   Tenant Name: ${response.data.data.tenant.name}`);
      testsPassed++;
    } else {
      console.log('❌ Verify tenant: FAILED');
      testsFailed++;
    }
  } catch (error) {
    console.log(`❌ Verify tenant: FAILED - ${error.response?.data?.message || error.message}`);
    testsFailed++;
  }
  
  // Phase 2: Authentication System
  console.log('\\n=== PHASE 2: AUTHENTICATION SYSTEM ===');
  
  // Test 3: Admin login
  console.log('\\nTest 3: Admin Login');
  try {
    const response = await axios.post(`${API_URL}/auth/login`, {
      identifier: 'admin',
      password: 'admin123',
      tenantId: 'default'
    });
    
    if (response.data.success && response.data.data.accessToken) {
      console.log('✅ Admin login: SUCCESS');
      authToken = response.data.data.accessToken;
      console.log(`   Token received: ${authToken.substring(0, 20)}...`);
      testsPassed++;
    } else {
      console.log('❌ Admin login: FAILED');
      testsFailed++;
    }
  } catch (error) {
    console.log(`❌ Admin login: FAILED - ${error.response?.data?.message || error.message}`);
    testsFailed++;
  }
  
  // Test 4: Create user in integration test tenant
  console.log('\\nTest 4: Create User in Integration Test Tenant');
  try {
    const response = await axios.post(`${API_URL}/admin/users`, {
      username: 'integrationuser',
      email: 'integration@pi-api-hub.local',
      password: 'integration123',
      role: 'user',
      tenantId: testTenantId
    }, {
      headers: {
        'x-admin-api-key': ADMIN_KEY,
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    if (response.data.success) {
      console.log('✅ Create user: SUCCESS');
      createdUserId = response.data.data.user.id;
      console.log(`   User ID: ${createdUserId}`);
      console.log(`   User Tenant: ${response.data.data.user.tenantId}`);
      testsPassed++;
    } else {
      console.log('❌ Create user: FAILED');
      testsFailed++;
    }
  } catch (error) {
    console.log(`❌ Create user: FAILED - ${error.response?.data?.message || error.message}`);
    testsFailed++;
  }
  
  // Test 5: Login with new user
  console.log('\\nTest 5: Login with New User');
  try {
    const response = await axios.post(`${API_URL}/auth/login`, {
      identifier: 'integrationuser',
      password: 'integration123',
      tenantId: testTenantId
    });
    
    if (response.data.success && response.data.data.accessToken) {
      console.log('✅ New user login: SUCCESS');
      console.log(`   User role: ${response.data.data.user.role}`);
      console.log(`   User tenant: ${response.data.data.user.tenantId}`);
      testsPassed++;
    } else {
      console.log('❌ New user login: FAILED');
      testsFailed++;
    }
  } catch (error) {
    console.log(`❌ New user login: FAILED - ${error.response?.data?.message || error.message}`);
    testsFailed++;
  }
  
  // Test 6: Generate API key for user
  console.log('\\nTest 6: Generate API Key for User');
  try {
    const response = await axios.post(`${API_URL}/admin/users/${createdUserId}/api-keys`, {
      name: 'Integration Test API Key'
    }, {
      headers: {
        'x-admin-api-key': ADMIN_KEY,
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    if (response.data.success && response.data.data.apiKey) {
      console.log('✅ Generate API key: SUCCESS');
      console.log(`   API Key: ${response.data.data.apiKey.key.substring(0, 20)}...`);
      testsPassed++;
    } else {
      console.log('❌ Generate API key: FAILED');
      testsFailed++;
    }
  } catch (error) {
    console.log(`❌ Generate API key: FAILED - ${error.response?.data?.message || error.message}`);
    testsFailed++;
  }
  
  // Phase 3: Backup System
  console.log('\\n=== PHASE 3: BACKUP SYSTEM ===');
  
  // Test 7: Get backup statistics
  console.log('\\nTest 7: Get Backup Statistics');
  try {
    const response = await axios.get(`${API_URL}/admin/backups/stats`, {
      headers: {
        'x-admin-api-key': ADMIN_KEY
      }
    });
    
    if (response.data.success && response.data.data.stats) {
      console.log('✅ Get backup stats: SUCCESS');
      const stats = response.data.data.stats;
      console.log(`   Total Backups: ${stats.totalBackups}`);
      console.log(`   Scheduler Status: ${stats.isRunning ? 'Running' : 'Stopped'}`);
      testsPassed++;
    } else {
      console.log('❌ Get backup stats: FAILED');
      testsFailed++;
    }
  } catch (error) {
    console.log(`❌ Get backup stats: FAILED - ${error.response?.data?.message || error.message}`);
    testsFailed++;
  }
  
  // Test 8: Create backup with new tenant data
  console.log('\\nTest 8: Create Backup (Including New Tenant Data)');
  try {
    console.log('   Creating backup (this may take a moment)...');
    const response = await axios.post(`${API_URL}/admin/backups`, {}, {
      headers: {
        'x-admin-api-key': ADMIN_KEY
      },
      timeout: 30000
    });
    
    if (response.data.success && response.data.data.backup) {
      console.log('✅ Create backup: SUCCESS');
      const backup = response.data.data.backup;
      console.log(`   Backup ID: ${backup.backupId}`);
      console.log(`   Backup Size: ${backup.backupSize ? (backup.backupSize / 1024 / 1024).toFixed(2) + ' MB' : 'Unknown'}`);
      testsPassed++;
    } else {
      console.log('❌ Create backup: FAILED');
      testsFailed++;
    }
  } catch (error) {
    console.log(`❌ Create backup: FAILED - ${error.response?.data?.message || error.message}`);
    testsFailed++;
  }
  
  // Phase 4: Cross-System Integration
  console.log('\\n=== PHASE 4: CROSS-SYSTEM INTEGRATION ===');
  
  // Test 9: Test tenant-specific authentication
  console.log('\\nTest 9: Test Tenant-Specific Authentication');
  try {
    const response = await axios.get(`${API_URL}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'x-tenant-id': testTenantId
      }
    });
    
    if (response.data.success && response.data.data.user) {
      console.log('✅ Tenant-specific auth: SUCCESS');
      console.log(`   User: ${response.data.data.user.username}`);
      console.log(`   Auth Method: ${response.data.data.authMethod}`);
      testsPassed++;
    } else {
      console.log('❌ Tenant-specific auth: FAILED');
      testsFailed++;
    }
  } catch (error) {
    console.log(`❌ Tenant-specific auth: FAILED - ${error.response?.data?.message || error.message}`);
    testsFailed++;
  }
  
  // Test 10: Verify all systems are working together
  console.log('\\nTest 10: Verify All Systems Working Together');
  try {
    // Get tenant stats, auth stats, and backup stats in parallel
    const [tenantResponse, authResponse, backupResponse] = await Promise.all([
      axios.get(`${API_URL}/admin/tenants`, {
        headers: { 'x-admin-api-key': ADMIN_KEY }
      }),
      axios.get(`${API_URL}/admin/users`, {
        headers: { 
          'x-admin-api-key': ADMIN_KEY,
          'Authorization': `Bearer ${authToken}`
        }
      }),
      axios.get(`${API_URL}/admin/backups`, {
        headers: { 'x-admin-api-key': ADMIN_KEY }
      })
    ]);
    
    if (tenantResponse.data.success && authResponse.data.success && backupResponse.data.success) {
      console.log('✅ All systems integration: SUCCESS');
      console.log(`   Tenants: ${tenantResponse.data.data.tenants.length}`);
      console.log(`   Users: ${authResponse.data.data.users.length}`);
      console.log(`   Backups: ${backupResponse.data.data.backups.length}`);
      testsPassed++;
    } else {
      console.log('❌ All systems integration: FAILED');
      testsFailed++;
    }
  } catch (error) {
    console.log(`❌ All systems integration: FAILED - ${error.response?.data?.message || error.message}`);
    testsFailed++;
  }
  
  // Cleanup Phase
  console.log('\\n=== CLEANUP PHASE ===');
  
  // Cleanup: Delete test user
  console.log('\\nCleanup: Delete Test User');
  try {
    const response = await axios.delete(`${API_URL}/admin/users/${createdUserId}`, {
      headers: {
        'x-admin-api-key': ADMIN_KEY,
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    if (response.data.success) {
      console.log('✅ Delete test user: SUCCESS');
    } else {
      console.log('⚠️  Delete test user: FAILED (non-critical)');
    }
  } catch (error) {
    console.log(`⚠️  Delete test user: FAILED (non-critical) - ${error.response?.data?.message || error.message}`);
  }
  
  // Summary
  console.log('\\n🍌 SMART BANANA ENTERPRISE INTEGRATION TEST COMPLETE! 🍌');
  console.log(`Tests Passed: ${testsPassed}`);
  console.log(`Tests Failed: ${testsFailed}`);
  console.log(`Total Tests: ${testsPassed + testsFailed}`);
  
  if (testsFailed === 0) {
    console.log('\\n🎉 ALL INTEGRATION TESTS PASSED! 🎉');
    console.log('\\n🍌 SMART BANANA ENTERPRISE FEATURES FULLY OPERATIONAL! 🍌');
    console.log('\\nSuccessfully implemented:');
    console.log('  🏢 Multi-Tenant Support with isolation');
    console.log('  🔐 JWT Authentication with RBAC');
    console.log('  📦 Automated Backup System');
    console.log('  🔗 Full cross-system integration');
    console.log('\\nThe Pi API Hub is now enterprise-ready! 🚀');
  } else {
    console.log('\\n⚠️  Some integration tests failed. System needs attention.');
  }
}

// Run the integration test
if (require.main === module) {
  testIntegration().catch(console.error);
}

module.exports = testIntegration;