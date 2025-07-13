/**
 * 🍌 SIMPLE PI 5 TEST - Using Only Real Endpoints!
 */

const axios = require('axios');
const assert = require('assert');

class SimplePi5Test {
  constructor() {
    this.baseUrl = 'http://localhost:3000';
    this.adminApiKey = process.env.ADMIN_API_KEY;
    
    console.log('🍌 Simple Pi 5 Test Starting...');
  }

  async runTest() {
    try {
      console.log('\n🚀 TESTING PI 5 BANANA BOX\n');
      
      // Test 1: Basic health check
      await this.testHealth();
      
      // Test 2: Cache stats (this definitely exists)
      await this.testCache();
      
      // Test 3: Security headers
      await this.testSecurity();
      
      // Test 4: Performance metrics
      await this.testMetrics();
      
      // Test 5: Create Timmy Turner
      await this.createTimmyTurner();
      
      console.log('\n🍌🍌🍌 ALL TESTS PASSED! 🍌🍌🍌\n');
      
    } catch (error) {
      console.error('❌ TEST FAILED:', error.message);
      throw error;
    }
  }

  async testHealth() {
    console.log('🏥 Testing Health...');
    
    const response = await axios.get(`${this.baseUrl}/health`);
    assert(response.status === 200, 'Health check should work');
    assert(response.headers['x-security-level'] === 'HIGH', 'Security should be HIGH');
    
    console.log('✅ Health check passed!');
  }

  async testCache() {
    console.log('💾 Testing Cache...');
    
    const response = await axios.get(`${this.baseUrl}/monitoring/cache`);
    assert(response.status === 200, 'Cache endpoint should work');
    
    const stats = response.data.data;
    console.log(`✅ Cache stats: ${stats.size} entries, ${stats.memoryUsage}MB`);
  }

  async testSecurity() {
    console.log('🔒 Testing Security...');
    
    // Test unauthenticated admin access fails
    try {
      await axios.post(`${this.baseUrl}/monitoring/cache/clear`);
      throw new Error('Should require auth');
    } catch (error) {
      assert(error.response.status === 401, 'Should return 401');
    }
    
    // Test authenticated admin access works
    const response = await axios.post(`${this.baseUrl}/monitoring/cache/clear`, {}, {
      headers: { 'Authorization': `Bearer ${this.adminApiKey}` }
    });
    assert(response.status === 200, 'Admin auth should work');
    
    console.log('✅ Security lockdown working!');
  }

  async testMetrics() {
    console.log('📊 Testing Metrics...');
    
    const response = await axios.get(`${this.baseUrl}/monitoring/metrics`);
    assert(response.status === 200, 'Metrics should work');
    
    const metrics = response.data.data;
    console.log(`✅ Metrics: ${metrics.performance.avgResponseTime}ms avg response`);
  }

  async createTimmyTurner() {
    console.log('👦 Creating Timmy Turner...');
    
    const timmyData = {
      properties: {
        email: `timmy.turner.test.${Date.now()}@fairyodparents.com`,
        firstname: 'Timmy',
        lastname: 'Turner',
        company: 'Fairly OddParents Inc',
        phone: '+1-555-FAIRY-1',
        city: 'Dimmsdale',
        state: 'California'
      }
    };
    
    const response = await axios.post(`${this.baseUrl}/api/hubspot/contacts`, timmyData);
    assert(response.status === 201, 'Contact creation should work');
    assert(response.data.properties.firstname === 'Timmy', 'Should create Timmy');
    
    console.log(`✅ Timmy Turner created! ID: ${response.data.id}`);
    
    // Clean up - delete Timmy
    try {
      await axios.delete(`${this.baseUrl}/api/hubspot/contacts/${response.data.id}`);
      console.log('✅ Timmy Turner deleted (cleanup)');
    } catch (error) {
      console.log('⚠️ Cleanup note: Could not delete Timmy (non-critical)');
    }
  }
}

// Run the test
if (require.main === module) {
  const test = new SimplePi5Test();
  test.runTest()
    .then(() => {
      console.log('🍌 PI 5 BANANA BOX IS WORKING PERFECTLY! 🍌');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ TEST FAILED:', error);
      process.exit(1);
    });
}

module.exports = SimplePi5Test;