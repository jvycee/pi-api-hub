const axios = require('axios');

/**
 * 🔐 SMART BANANA AUTHENTICATION TEST SCRIPT 🔐
 * Test script to verify JWT authentication functionality on Pi
 */

console.log('🔐 Testing Smart Banana Authentication System...');
console.log('================================================');

// Configuration
const API_URL = 'http://localhost:3000';
const ADMIN_KEY = 'f00d268863ad4f08992aa8583d2b6ea96c65e649f206a9828334bbb3bbd8f7e7';

// Store tokens for testing
let authTokens = {};

async function testAuthSystem() {
  console.log('\\n🔐 Starting Authentication System Tests...\\n');
  
  let testsPassed = 0;
  let testsFailed = 0;
  
  // Test 1: Login with default admin
  console.log('Test 1: Admin Login');
  try {
    const response = await axios.post(`${API_URL}/auth/login`, {
      identifier: 'admin',
      password: 'admin123',
      tenantId: 'default'
    });
    
    if (response.data.success && response.data.data.accessToken) {
      console.log('✅ Admin login: SUCCESS');
      authTokens.admin = response.data.data.accessToken;
      authTokens.adminRefresh = response.data.data.refreshToken;
      testsPassed++;
    } else {
      console.log('❌ Admin login: FAILED');
      testsFailed++;
    }
  } catch (error) {
    console.log(`❌ Admin login: FAILED - ${error.response?.data?.message || error.message}`);
    testsFailed++;
  }
  
  // Test 2: Get user info with JWT
  console.log('\\nTest 2: Get Current User Info');
  try {
    const response = await axios.get(`${API_URL}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${authTokens.admin}`
      }
    });
    
    if (response.data.success && response.data.data.user) {
      console.log('✅ Get user info: SUCCESS');
      console.log(`   User: ${response.data.data.user.username} (${response.data.data.user.role})`);
      console.log(`   Tenant: ${response.data.data.user.tenantId}`);
      testsPassed++;
    } else {
      console.log('❌ Get user info: FAILED');
      testsFailed++;
    }
  } catch (error) {
    console.log(`❌ Get user info: FAILED - ${error.response?.data?.message || error.message}`);
    testsFailed++;
  }
  
  // Test 3: Create new user (admin permission required)
  console.log('\\nTest 3: Create New User (Admin Permission)');
  try {
    const response = await axios.post(`${API_URL}/admin/users`, {
      username: 'testuser',
      email: 'test@pi-api-hub.local',
      password: 'test123',
      role: 'user',
      tenantId: 'default'
    }, {
      headers: {
        'x-admin-api-key': ADMIN_KEY,
        'Authorization': `Bearer ${authTokens.admin}`
      }
    });
    
    if (response.data.success) {
      console.log('✅ Create user: SUCCESS');
      console.log(`   Created user: ${response.data.data.user.username}`);
      testsPassed++;
    } else {
      console.log('❌ Create user: FAILED');
      testsFailed++;
    }
  } catch (error) {
    console.log(`❌ Create user: FAILED - ${error.response?.data?.message || error.message}`);
    testsFailed++;
  }
  
  // Test 4: Login with new user
  console.log('\\nTest 4: Login with New User');
  try {
    const response = await axios.post(`${API_URL}/auth/login`, {
      identifier: 'testuser',
      password: 'test123',
      tenantId: 'default'
    });
    
    if (response.data.success && response.data.data.accessToken) {
      console.log('✅ New user login: SUCCESS');
      authTokens.testuser = response.data.data.accessToken;
      testsPassed++;
    } else {
      console.log('❌ New user login: FAILED');
      testsFailed++;
    }
  } catch (error) {
    console.log(`❌ New user login: FAILED - ${error.response?.data?.message || error.message}`);
    testsFailed++;
  }
  
  // Test 5: Generate API key
  console.log('\\nTest 5: Generate API Key');
  try {
    // First get user ID by listing users
    const usersResponse = await axios.get(`${API_URL}/admin/users`, {
      headers: {
        'x-admin-api-key': ADMIN_KEY,
        'Authorization': `Bearer ${authTokens.admin}`
      }
    });
    
    const testUser = usersResponse.data.data.users.find(u => u.username === 'testuser');
    
    if (testUser) {
      const response = await axios.post(`${API_URL}/admin/users/${testUser.id}/api-keys`, {
        name: 'Test API Key'
      }, {
        headers: {
          'x-admin-api-key': ADMIN_KEY,
          'Authorization': `Bearer ${authTokens.admin}`
        }
      });
      
      if (response.data.success && response.data.data.apiKey) {
        console.log('✅ Generate API key: SUCCESS');
        console.log(`   API Key: ${response.data.data.apiKey.key.substring(0, 20)}...`);
        authTokens.apiKey = response.data.data.apiKey.key;
        testsPassed++;
      } else {
        console.log('❌ Generate API key: FAILED');
        testsFailed++;
      }
    } else {
      console.log('❌ Generate API key: User not found');
      testsFailed++;
    }
  } catch (error) {
    console.log(`❌ Generate API key: FAILED - ${error.response?.data?.message || error.message}`);
    testsFailed++;
  }
  
  // Test 6: Use API key for authentication
  console.log('\\nTest 6: API Key Authentication');
  try {
    const response = await axios.get(`${API_URL}/auth/me`, {
      headers: {
        'x-api-key': authTokens.apiKey
      }
    });
    
    if (response.data.success && response.data.data.user) {
      console.log('✅ API key auth: SUCCESS');
      console.log(`   Auth method: ${response.data.data.authMethod}`);
      testsPassed++;
    } else {
      console.log('❌ API key auth: FAILED');
      testsFailed++;
    }
  } catch (error) {
    console.log(`❌ API key auth: FAILED - ${error.response?.data?.message || error.message}`);
    testsFailed++;
  }
  
  // Test 7: Token refresh
  console.log('\\nTest 7: Token Refresh');
  try {
    const response = await axios.post(`${API_URL}/auth/refresh`, {
      refreshToken: authTokens.adminRefresh
    });
    
    if (response.data.success && response.data.data.accessToken) {
      console.log('✅ Token refresh: SUCCESS');
      testsPassed++;
    } else {
      console.log('❌ Token refresh: FAILED');
      testsFailed++;
    }
  } catch (error) {
    console.log(`❌ Token refresh: FAILED - ${error.response?.data?.message || error.message}`);
    testsFailed++;
  }
  
  // Test 8: Permission-based access (try to access admin endpoint with user token)
  console.log('\\nTest 8: Permission-Based Access Control');
  try {
    const response = await axios.get(`${API_URL}/admin/users`, {
      headers: {
        'Authorization': `Bearer ${authTokens.testuser}`
      }
    });
    
    // This should fail because testuser doesn't have admin permissions
    console.log('❌ Permission control: FAILED (user accessed admin endpoint)');
    testsFailed++;
  } catch (error) {
    if (error.response?.status === 403) {
      console.log('✅ Permission control: SUCCESS (access properly denied)');
      testsPassed++;
    } else {
      console.log(`❌ Permission control: FAILED - ${error.response?.data?.message || error.message}`);
      testsFailed++;
    }
  }
  
  // Test 9: Logout
  console.log('\\nTest 9: User Logout');
  try {
    const response = await axios.post(`${API_URL}/auth/logout`, {
      refreshToken: authTokens.adminRefresh
    });
    
    if (response.data.success) {
      console.log('✅ User logout: SUCCESS');
      testsPassed++;
    } else {
      console.log('❌ User logout: FAILED');
      testsFailed++;
    }
  } catch (error) {
    console.log(`❌ User logout: FAILED - ${error.response?.data?.message || error.message}`);
    testsFailed++;
  }
  
  // Test 10: Invalid credentials
  console.log('\\nTest 10: Invalid Credentials Handling');
  try {
    const response = await axios.post(`${API_URL}/auth/login`, {
      identifier: 'admin',
      password: 'wrongpassword',
      tenantId: 'default'
    });
    
    // This should fail
    console.log('❌ Invalid credentials: FAILED (login succeeded with wrong password)');
    testsFailed++;
  } catch (error) {
    if (error.response?.status === 500 && error.response?.data?.message === 'Invalid credentials') {
      console.log('✅ Invalid credentials: SUCCESS (login properly denied)');
      testsPassed++;
    } else {
      console.log(`❌ Invalid credentials: FAILED - ${error.response?.data?.message || error.message}`);
      testsFailed++;
    }
  }
  
  // Summary
  console.log('\\n🔐 SMART BANANA AUTHENTICATION SYSTEM TEST COMPLETE! 🔐');
  console.log(`Tests Passed: ${testsPassed}`);
  console.log(`Tests Failed: ${testsFailed}`);
  console.log(`Total Tests: ${testsPassed + testsFailed}`);
  
  if (testsFailed === 0) {
    console.log('\\n🍌 ALL TESTS PASSED! Authentication system is working perfectly! 🍌');
    console.log('Ready to move to Feature 3: Simple Backup System! 🍌');
  } else {
    console.log('\\n⚠️  Some tests failed. Check the errors above.');
  }
  
  console.log('\\nAuthentication Features Available:');
  console.log('  🔑 JWT token authentication');
  console.log('  🔄 Token refresh mechanism');
  console.log('  🔐 API key authentication');
  console.log('  👥 Role-based access control (admin/user/viewer)');
  console.log('  🏢 Multi-tenant user management');
  console.log('  📊 User management endpoints');
}

// Run the test
if (require.main === module) {
  testAuthSystem().catch(console.error);
}

module.exports = testAuthSystem;