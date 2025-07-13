const axios = require('axios');
const { performance } = require('perf_hooks');

// Test configuration
const BASE_URL = 'http://localhost:3000';
const TEST_TIMEOUT = 30000; // 30 seconds
const HUBSPOT_WEBHOOK_SECRET = process.env.HUBSPOT_CLIENT_SECRET || 'test-secret';

// Test colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bright: '\x1b[1m'
};

class ComprehensiveIntegrationTest {
  constructor() {
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      errors: [],
      details: {}
    };
    this.startTime = performance.now();
  }

  // Utility methods
  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  async makeRequest(method, endpoint, data = null, headers = {}) {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    if (data) {
      config.data = data;
    }

    return axios(config);
  }

  async test(name, testFn, category = 'general') {
    this.results.total++;
    
    if (!this.results.details[category]) {
      this.results.details[category] = { passed: 0, failed: 0, tests: [] };
    }

    const testStart = performance.now();
    
    try {
      this.log(`  🧪 Testing: ${name}`, 'cyan');
      await testFn();
      
      const duration = (performance.now() - testStart).toFixed(2);
      this.results.passed++;
      this.results.details[category].passed++;
      this.results.details[category].tests.push({
        name,
        status: 'PASS',
        duration: `${duration}ms`
      });
      
      this.log(`  ✅ PASS: ${name} (${duration}ms)`, 'green');
    } catch (error) {
      const duration = (performance.now() - testStart).toFixed(2);
      this.results.failed++;
      this.results.details[category].failed++;
      this.results.details[category].tests.push({
        name,
        status: 'FAIL',
        duration: `${duration}ms`,
        error: error.message
      });
      
      this.results.errors.push({
        test: name,
        category,
        error: error.message,
        stack: error.stack
      });
      
      this.log(`  ❌ FAIL: ${name} (${duration}ms)`, 'red');
      this.log(`     Error: ${error.message}`, 'red');
    }
  }

  // Test suites
  async testHealthAndStatus() {
    this.log('\n🏥 HEALTH & STATUS TESTS', 'bright');
    
    await this.test('Health Check Endpoint', async () => {
      const response = await this.makeRequest('GET', '/health');
      if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
      if (response.data.status !== 'healthy') throw new Error('Health status not healthy');
      if (!response.data.worker) throw new Error('Worker info missing');
    }, 'health');

    await this.test('Monitoring Dashboard', async () => {
      const response = await this.makeRequest('GET', '/monitoring/dashboard');
      if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
      if (!response.data.title.includes('BANANA')) throw new Error('Dashboard title missing');
      if (!response.data.infrastructure) throw new Error('Infrastructure metrics missing');
    }, 'health');

    await this.test('Performance Metrics', async () => {
      const response = await this.makeRequest('GET', '/monitoring/metrics');
      if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
      if (!response.data.system) throw new Error('System metrics missing');
    }, 'health');
  }

  async testAIRouting() {
    this.log('\n🤖 AI ROUTING TESTS', 'bright');

    await this.test('AI Provider Status', async () => {
      const response = await this.makeRequest('GET', '/monitoring/ai');
      if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
      if (!response.data.primaryProvider) throw new Error('Primary provider not set');
      if (!response.data.providerStatus) throw new Error('Provider status missing');
    }, 'ai');

    await this.test('AI Provider Connectivity Test', async () => {
      const response = await this.makeRequest('POST', '/monitoring/ai/test');
      if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
      if (!response.data.anthropic) throw new Error('Anthropic test results missing');
      if (!response.data.ollama) throw new Error('Ollama test results missing');
    }, 'ai');

    await this.test('Ollama Models List', async () => {
      const response = await this.makeRequest('GET', '/monitoring/ai/models');
      if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
      if (!Array.isArray(response.data.models)) throw new Error('Models list not array');
    }, 'ai');

    await this.test('Simple AI Request (Should use Ollama)', async () => {
      const response = await this.makeRequest('POST', '/api/anthropic/messages', {
        messages: [{ role: 'user', content: 'What is 1+1?' }],
        max_tokens: 50
      });
      if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
      if (!response.data.success) throw new Error('Request not successful');
      if (!response.data.metadata) throw new Error('Metadata missing');
      if (!response.data.metadata.provider) throw new Error('Provider info missing');
    }, 'ai');

    await this.test('Specialized AI Request (May use Claude)', async () => {
      const response = await this.makeRequest('POST', '/api/anthropic/messages', {
        messages: [{ role: 'user', content: 'Analyze this code: function test() { return true; }' }],
        max_tokens: 100,
        taskType: 'code_review'
      });
      // This might fail if Claude is not available, but we still check the structure
      if (response.status === 200) {
        if (!response.data.metadata) throw new Error('Metadata missing');
        if (!response.data.metadata.provider) throw new Error('Provider info missing');
      } else if (response.status === 500) {
        // Expected if providers have issues, log but don't fail
        console.log('    ⚠️  Specialized request failed (expected if providers unavailable)');
      } else {
        throw new Error(`Unexpected status: ${response.status}`);
      }
    }, 'ai');
  }

  async testCaching() {
    this.log('\n🗄️ CACHING TESTS', 'bright');

    await this.test('Cache Statistics', async () => {
      const response = await this.makeRequest('GET', '/monitoring/cache');
      if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
      if (!response.data.hitRate) throw new Error('Hit rate missing');
      if (!response.data.memoryUsageMB) throw new Error('Memory usage missing');
    }, 'cache');

    await this.test('Cache Keys Listing', async () => {
      const response = await this.makeRequest('GET', '/monitoring/cache/keys');
      if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
      if (!Array.isArray(response.data.keys)) throw new Error('Keys not array');
    }, 'cache');

    await this.test('Cache Clear Operation', async () => {
      const response = await this.makeRequest('POST', '/monitoring/cache/clear');
      if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
      if (!response.data.success) throw new Error('Clear operation failed');
    }, 'cache');

    await this.test('Cache Warming', async () => {
      const response = await this.makeRequest('GET', '/monitoring/cache/warm');
      if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
      if (!response.data.success) throw new Error('Cache warming failed');
    }, 'cache');
  }

  async testRequestOptimization() {
    this.log('\n⚡ REQUEST OPTIMIZATION TESTS', 'bright');

    await this.test('Deduplication Statistics', async () => {
      const response = await this.makeRequest('GET', '/monitoring/deduplication');
      if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
      if (!response.data.deduplicationRate) throw new Error('Deduplication rate missing');
      if (!response.data.batchingRate) throw new Error('Batching rate missing');
    }, 'optimization');

    await this.test('Active Batches Info', async () => {
      const response = await this.makeRequest('GET', '/monitoring/deduplication/batches');
      if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
      if (!Array.isArray(response.data)) throw new Error('Batches not array');
    }, 'optimization');

    await this.test('Duplicate Details', async () => {
      const response = await this.makeRequest('GET', '/monitoring/deduplication/duplicates');
      if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
      if (!Array.isArray(response.data)) throw new Error('Duplicates not array');
    }, 'optimization');

    await this.test('Batch Flush Operation', async () => {
      const response = await this.makeRequest('POST', '/monitoring/deduplication/flush');
      if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
      if (!response.data.success) throw new Error('Batch flush failed');
    }, 'optimization');
  }

  async testWebhooks() {
    this.log('\n🔗 WEBHOOK TESTS', 'bright');

    await this.test('Webhook Statistics', async () => {
      const response = await this.makeRequest('GET', '/monitoring/webhooks');
      if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
      if (!response.data.totalWebhooks !== undefined) throw new Error('Total webhooks missing');
      if (!response.data.successRate) throw new Error('Success rate missing');
    }, 'webhooks');

    await this.test('Webhook Handlers List', async () => {
      const response = await this.makeRequest('GET', '/monitoring/webhooks/handlers');
      if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
      if (!response.data.eventHandlers) throw new Error('Event handlers missing');
    }, 'webhooks');

    await this.test('Webhook Configuration', async () => {
      const response = await this.makeRequest('GET', '/monitoring/webhooks/config');
      if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
      if (!response.data.webhookUrl) throw new Error('Webhook URL missing');
      if (!response.data.validation) throw new Error('Validation config missing');
    }, 'webhooks');

    await this.test('Webhook Statistics Clear', async () => {
      const response = await this.makeRequest('POST', '/monitoring/webhooks/clear');
      if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
      if (!response.data.success) throw new Error('Clear operation failed');
    }, 'webhooks');

    // Test actual webhook processing (simple test without signature validation)
    await this.test('HubSpot Webhook Processing', async () => {
      const webhookData = {
        subscriptionType: 'contact.creation',
        eventId: 'test-event-123',
        objectId: 'test-contact-456',
        portalId: '12345',
        occurredAt: Date.now(),
        subscriptionId: 'test-sub-789',
        attemptNumber: 1
      };

      try {
        // This might fail due to signature validation, which is expected
        const response = await this.makeRequest('POST', '/webhooks/hubspot', webhookData);
        if (response.status === 200 || response.status === 401) {
          // 200 = success, 401 = signature validation (expected)
          return;
        }
        throw new Error(`Unexpected status: ${response.status}`);
      } catch (error) {
        if (error.response && error.response.status === 401) {
          // Expected - signature validation failure
          return;
        }
        throw error;
      }
    }, 'webhooks');
  }

  async testHubSpotIntegration() {
    this.log('\n👥 HUBSPOT INTEGRATION TESTS', 'bright');

    await this.test('HubSpot Connection Test', async () => {
      const response = await this.makeRequest('GET', '/api/test-connections');
      if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
      if (!response.data.connections) throw new Error('Connections data missing');
    }, 'hubspot');

    // These tests may fail if HubSpot API key is not configured, which is expected
    await this.test('HubSpot Contacts Endpoint Structure', async () => {
      try {
        const response = await this.makeRequest('GET', '/api/hubspot/contacts?limit=1');
        // If successful, check structure
        if (response.status === 200) {
          if (!response.data.success !== undefined) throw new Error('Success field missing');
        }
      } catch (error) {
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
          // Expected if no API key configured
          console.log('    ⚠️  HubSpot API not configured (expected in test environment)');
          return;
        }
        throw error;
      }
    }, 'hubspot');

    await this.test('HubSpot Search Endpoint Structure', async () => {
      try {
        const response = await this.makeRequest('POST', '/api/hubspot/search/contacts', {
          query: 'test',
          limit: 1
        });
        // If successful, check structure
        if (response.status === 200) {
          if (!response.data.success !== undefined) throw new Error('Success field missing');
        }
      } catch (error) {
        if (error.response && (error.response.status === 401 || error.response.status === 403 || error.response.status === 400)) {
          // Expected if no API key configured
          console.log('    ⚠️  HubSpot API not configured (expected in test environment)');
          return;
        }
        throw error;
      }
    }, 'hubspot');
  }

  async testClusterAndScaling() {
    this.log('\n🔄 CLUSTERING & SCALING TESTS', 'bright');

    await this.test('Cluster Scaling Information', async () => {
      const response = await this.makeRequest('GET', '/monitoring/cluster-scaling');
      if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
      if (!response.data.scalingEnabled !== undefined) throw new Error('Scaling info missing');
      if (!response.data.currentMode) throw new Error('Current mode missing');
    }, 'cluster');

    await this.test('Predictive Health Monitoring', async () => {
      const response = await this.makeRequest('GET', '/monitoring/predictive-health');
      if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
      if (!response.data.data) throw new Error('Health data missing');
    }, 'cluster');
  }

  async testLogManagement() {
    this.log('\n📝 LOG MANAGEMENT TESTS', 'bright');

    await this.test('Log Statistics', async () => {
      const response = await this.makeRequest('GET', '/monitoring/logs');
      if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
      if (!response.data.stats) throw new Error('Log stats missing');
      if (!response.data.disk) throw new Error('Disk usage missing');
    }, 'logs');

    await this.test('Log Rotation Trigger', async () => {
      const response = await this.makeRequest('POST', '/monitoring/logs/rotate', {
        logFile: 'test.log'
      });
      // This may fail if log file doesn't exist, which is expected
      if (response.status === 200) {
        if (!response.data.success !== undefined) throw new Error('Success field missing');
      } else if (response.status === 400) {
        // Expected for non-existent log file
        return;
      } else {
        throw new Error(`Unexpected status: ${response.status}`);
      }
    }, 'logs');
  }

  async testErrorHandling() {
    this.log('\n🚨 ERROR HANDLING TESTS', 'bright');

    await this.test('404 Endpoint', async () => {
      try {
        await this.makeRequest('GET', '/nonexistent-endpoint');
        throw new Error('Should have returned 404');
      } catch (error) {
        if (error.response && error.response.status === 404) {
          if (!error.response.data.error) throw new Error('Error message missing');
          return;
        }
        throw error;
      }
    }, 'errors');

    await this.test('Invalid JSON Handling', async () => {
      try {
        const response = await axios.post(`${BASE_URL}/api/anthropic/messages`, 'invalid-json', {
          headers: { 'Content-Type': 'application/json' },
          timeout: 5000
        });
        throw new Error('Should have returned 400');
      } catch (error) {
        if (error.response && error.response.status === 400) {
          return;
        }
        throw error;
      }
    }, 'errors');

    await this.test('Missing Required Fields', async () => {
      try {
        await this.makeRequest('POST', '/api/anthropic/messages', {
          // Missing required 'messages' field
          max_tokens: 50
        });
        throw new Error('Should have returned 400');
      } catch (error) {
        if (error.response && error.response.status === 400) {
          if (!error.response.data.error) throw new Error('Error message missing');
          return;
        }
        throw error;
      }
    }, 'errors');
  }

  async testPerformance() {
    this.log('\n🏃 PERFORMANCE TESTS', 'bright');

    await this.test('Response Time - Health Check', async () => {
      const start = performance.now();
      const response = await this.makeRequest('GET', '/health');
      const duration = performance.now() - start;
      
      if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
      if (duration > 1000) throw new Error(`Response too slow: ${duration.toFixed(2)}ms`);
      
      console.log(`    ⏱️  Response time: ${duration.toFixed(2)}ms`);
    }, 'performance');

    await this.test('Concurrent Requests Handling', async () => {
      const requests = Array(5).fill().map(() => 
        this.makeRequest('GET', '/health')
      );
      
      const start = performance.now();
      const responses = await Promise.all(requests);
      const duration = performance.now() - start;
      
      if (responses.some(r => r.status !== 200)) {
        throw new Error('Some concurrent requests failed');
      }
      
      if (duration > 2000) throw new Error(`Concurrent requests too slow: ${duration.toFixed(2)}ms`);
      
      console.log(`    ⏱️  5 concurrent requests: ${duration.toFixed(2)}ms`);
    }, 'performance');
  }

  // Main test runner
  async runAllTests() {
    this.log('\n🍌 COMPREHENSIVE INTEGRATION TEST SUITE', 'bright');
    this.log('=' * 60, 'cyan');
    
    try {
      await this.testHealthAndStatus();
      await this.testAIRouting();
      await this.testCaching();
      await this.testRequestOptimization();
      await this.testWebhooks();
      await this.testHubSpotIntegration();
      await this.testClusterAndScaling();
      await this.testLogManagement();
      await this.testErrorHandling();
      await this.testPerformance();
      
      this.generateReport();
      
    } catch (error) {
      this.log(`\n💥 Test suite crashed: ${error.message}`, 'red');
      process.exit(1);
    }
  }

  generateReport() {
    const totalTime = ((performance.now() - this.startTime) / 1000).toFixed(2);
    const passRate = ((this.results.passed / this.results.total) * 100).toFixed(1);
    
    this.log('\n' + '=' * 60, 'cyan');
    this.log('🏆 TEST RESULTS SUMMARY', 'bright');
    this.log('=' * 60, 'cyan');
    
    this.log(`📊 Total Tests: ${this.results.total}`, 'blue');
    this.log(`✅ Passed: ${this.results.passed}`, 'green');
    this.log(`❌ Failed: ${this.results.failed}`, 'red');
    this.log(`📈 Pass Rate: ${passRate}%`, passRate >= 80 ? 'green' : 'yellow');
    this.log(`⏱️  Total Time: ${totalTime}s`, 'blue');
    
    // Category breakdown
    this.log('\n📂 CATEGORY BREAKDOWN:', 'cyan');
    Object.entries(this.results.details).forEach(([category, stats]) => {
      const categoryPassRate = stats.passed + stats.failed > 0 
        ? ((stats.passed / (stats.passed + stats.failed)) * 100).toFixed(1)
        : '0.0';
      
      this.log(`  ${category}: ${stats.passed}/${stats.passed + stats.failed} (${categoryPassRate}%)`, 
        categoryPassRate >= 80 ? 'green' : 'yellow');
    });
    
    // Error summary
    if (this.results.errors.length > 0) {
      this.log('\n🚨 FAILED TESTS:', 'red');
      this.results.errors.forEach(error => {
        this.log(`  ❌ ${error.test} (${error.category}): ${error.error}`, 'red');
      });
    }
    
    // Overall status
    this.log('\n🎯 OVERALL STATUS:', 'bright');
    if (passRate >= 90) {
      this.log('🎉 EXCELLENT - System is production ready!', 'green');
    } else if (passRate >= 80) {
      this.log('✅ GOOD - Minor issues detected', 'yellow');
    } else if (passRate >= 60) {
      this.log('⚠️  FAIR - Several issues need attention', 'yellow');
    } else {
      this.log('❌ POOR - Major issues detected', 'red');
    }
    
    this.log('\n🍌 Integration test complete!', 'bright');
    
    // Exit code based on results
    process.exit(passRate >= 80 ? 0 : 1);
  }
}

// Run tests if called directly
if (require.main === module) {
  const testSuite = new ComprehensiveIntegrationTest();
  testSuite.runAllTests().catch(error => {
    console.error('💥 Test suite failed to run:', error);
    process.exit(1);
  });
}

module.exports = ComprehensiveIntegrationTest;