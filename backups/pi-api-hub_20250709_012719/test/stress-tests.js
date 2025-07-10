const http = require('http');
const https = require('https');
const { performance } = require('perf_hooks');
const logger = require('../shared/logger');

class StressTestRunner {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:3000';
    this.maxConcurrency = options.maxConcurrency || 50;
    this.testDuration = options.testDuration || 60000; // 1 minute
    this.rampUpTime = options.rampUpTime || 10000; // 10 seconds
    this.endpoints = options.endpoints || [
      '/health',
      '/api/hubspot/contacts?limit=10',
      '/monitoring/dashboard',
      '/monitoring/metrics'
    ];
    this.results = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      maxResponseTime: 0,
      minResponseTime: Infinity,
      requestsPerSecond: 0,
      memoryUsage: [],
      errors: [],
      responseTimes: []
    };
  }

  // Run comprehensive stress test
  async runStressTest() {
    logger.info('🍌 Starting comprehensive stress test', {
      baseUrl: this.baseUrl,
      maxConcurrency: this.maxConcurrency,
      testDuration: this.testDuration,
      endpoints: this.endpoints
    });

    const startTime = performance.now();
    const endTime = startTime + this.testDuration;
    const activeRequests = new Set();
    let currentConcurrency = 0;

    // Memory monitoring
    const memoryMonitor = this.startMemoryMonitoring();

    // Gradually ramp up concurrency
    const rampUpInterval = setInterval(() => {
      if (currentConcurrency < this.maxConcurrency && performance.now() < endTime) {
        currentConcurrency++;
        this.makeRequest(activeRequests, endTime);
      } else {
        clearInterval(rampUpInterval);
      }
    }, this.rampUpTime / this.maxConcurrency);

    // Wait for test duration
    await new Promise(resolve => setTimeout(resolve, this.testDuration));

    // Wait for all active requests to complete
    await Promise.all(Array.from(activeRequests));

    // Stop memory monitoring
    clearInterval(memoryMonitor);

    // Calculate final statistics
    this.calculateFinalStats(startTime);

    logger.info('🍌 Stress test completed', this.results);
    return this.results;
  }

  // Make individual HTTP request
  async makeRequest(activeRequests, endTime) {
    if (performance.now() > endTime) {
      return;
    }

    const endpoint = this.endpoints[Math.floor(Math.random() * this.endpoints.length)];
    const url = `${this.baseUrl}${endpoint}`;
    const startTime = performance.now();

    const requestPromise = new Promise((resolve) => {
      const request = this.createRequest(url, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => {
          const responseTime = performance.now() - startTime;
          this.recordResponse(response.statusCode, responseTime, endpoint);
          resolve();
        });
      });

      request.on('error', (error) => {
        const responseTime = performance.now() - startTime;
        this.recordError(error, endpoint, responseTime);
        resolve();
      });

      request.setTimeout(10000, () => {
        request.destroy();
        this.recordError(new Error('Request timeout'), endpoint, 10000);
        resolve();
      });

      request.end();
    });

    activeRequests.add(requestPromise);
    
    // Keep making requests while test is running
    requestPromise.then(() => {
      activeRequests.delete(requestPromise);
      if (performance.now() < endTime) {
        this.makeRequest(activeRequests, endTime);
      }
    });
  }

  // Create HTTP/HTTPS request
  createRequest(url, callback) {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'StressTest/1.0',
        'Accept': 'application/json'
      }
    };

    return parsedUrl.protocol === 'https:' 
      ? https.request(options, callback)
      : http.request(options, callback);
  }

  // Record successful response
  recordResponse(statusCode, responseTime, endpoint) {
    this.results.totalRequests++;
    this.results.responseTimes.push(responseTime);

    if (statusCode >= 200 && statusCode < 300) {
      this.results.successfulRequests++;
    } else {
      this.results.failedRequests++;
      this.results.errors.push({
        type: 'http_error',
        statusCode,
        endpoint,
        responseTime,
        timestamp: new Date().toISOString()
      });
    }

    // Update response time stats
    this.results.maxResponseTime = Math.max(this.results.maxResponseTime, responseTime);
    this.results.minResponseTime = Math.min(this.results.minResponseTime, responseTime);
  }

  // Record error
  recordError(error, endpoint, responseTime) {
    this.results.totalRequests++;
    this.results.failedRequests++;
    this.results.errors.push({
      type: 'network_error',
      message: error.message,
      endpoint,
      responseTime,
      timestamp: new Date().toISOString()
    });
  }

  // Start memory monitoring
  startMemoryMonitoring() {
    return setInterval(() => {
      const memory = process.memoryUsage();
      this.results.memoryUsage.push({
        timestamp: Date.now(),
        rss: memory.rss,
        heapUsed: memory.heapUsed,
        heapTotal: memory.heapTotal,
        external: memory.external
      });
    }, 1000); // Every second
  }

  // Calculate final statistics
  calculateFinalStats(startTime) {
    const totalTime = (performance.now() - startTime) / 1000; // Convert to seconds
    
    if (this.results.responseTimes.length > 0) {
      this.results.averageResponseTime = this.results.responseTimes.reduce((a, b) => a + b, 0) / this.results.responseTimes.length;
    }
    
    this.results.requestsPerSecond = this.results.totalRequests / totalTime;
    
    // Calculate percentiles
    const sortedTimes = this.results.responseTimes.sort((a, b) => a - b);
    this.results.percentiles = {
      p50: this.getPercentile(sortedTimes, 0.5),
      p90: this.getPercentile(sortedTimes, 0.9),
      p95: this.getPercentile(sortedTimes, 0.95),
      p99: this.getPercentile(sortedTimes, 0.99)
    };

    // Memory statistics
    if (this.results.memoryUsage.length > 0) {
      const maxMemory = Math.max(...this.results.memoryUsage.map(m => m.heapUsed));
      const avgMemory = this.results.memoryUsage.reduce((sum, m) => sum + m.heapUsed, 0) / this.results.memoryUsage.length;
      
      this.results.memoryStats = {
        maxHeapUsed: maxMemory,
        avgHeapUsed: avgMemory,
        maxHeapUsedMB: (maxMemory / 1024 / 1024).toFixed(2),
        avgHeapUsedMB: (avgMemory / 1024 / 1024).toFixed(2)
      };
    }

    // Success rate
    this.results.successRate = (this.results.successfulRequests / this.results.totalRequests * 100).toFixed(2);
  }

  // Get percentile value
  getPercentile(sortedArray, percentile) {
    const index = Math.ceil(sortedArray.length * percentile) - 1;
    return sortedArray[index] || 0;
  }

  // Test specific endpoint with high concurrency
  async testEndpointConcurrency(endpoint, concurrency = 100, duration = 30000) {
    logger.info('🍌 Testing endpoint concurrency', {
      endpoint,
      concurrency,
      duration
    });

    const results = {
      endpoint,
      concurrency,
      duration,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      maxResponseTime: 0,
      responseTimes: [],
      errors: []
    };

    const startTime = performance.now();
    const endTime = startTime + duration;
    const activeRequests = new Set();

    // Start concurrent requests
    for (let i = 0; i < concurrency; i++) {
      this.makeEndpointRequest(endpoint, activeRequests, endTime, results);
    }

    // Wait for test duration
    await new Promise(resolve => setTimeout(resolve, duration));

    // Wait for active requests to complete
    await Promise.all(Array.from(activeRequests));

    // Calculate stats
    if (results.responseTimes.length > 0) {
      results.averageResponseTime = results.responseTimes.reduce((a, b) => a + b, 0) / results.responseTimes.length;
    }

    logger.info('🍌 Endpoint concurrency test completed', results);
    return results;
  }

  // Make request to specific endpoint
  async makeEndpointRequest(endpoint, activeRequests, endTime, results) {
    if (performance.now() > endTime) {
      return;
    }

    const url = `${this.baseUrl}${endpoint}`;
    const startTime = performance.now();

    const requestPromise = new Promise((resolve) => {
      const request = this.createRequest(url, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => {
          const responseTime = performance.now() - startTime;
          results.totalRequests++;
          results.responseTimes.push(responseTime);
          results.maxResponseTime = Math.max(results.maxResponseTime, responseTime);

          if (response.statusCode >= 200 && response.statusCode < 300) {
            results.successfulRequests++;
          } else {
            results.failedRequests++;
            results.errors.push({
              statusCode: response.statusCode,
              responseTime,
              timestamp: new Date().toISOString()
            });
          }
          resolve();
        });
      });

      request.on('error', (error) => {
        results.totalRequests++;
        results.failedRequests++;
        results.errors.push({
          error: error.message,
          timestamp: new Date().toISOString()
        });
        resolve();
      });

      request.setTimeout(10000, () => {
        request.destroy();
        results.totalRequests++;
        results.failedRequests++;
        results.errors.push({
          error: 'Request timeout',
          timestamp: new Date().toISOString()
        });
        resolve();
      });

      request.end();
    });

    activeRequests.add(requestPromise);
    
    requestPromise.then(() => {
      activeRequests.delete(requestPromise);
      if (performance.now() < endTime) {
        this.makeEndpointRequest(endpoint, activeRequests, endTime, results);
      }
    });
  }

  // Test memory leak detection
  async testMemoryLeaks(iterations = 1000) {
    logger.info('🍌 Testing for memory leaks', { iterations });

    const initialMemory = process.memoryUsage();
    const memorySnapshots = [];

    for (let i = 0; i < iterations; i++) {
      // Make requests to various endpoints
      const endpoint = this.endpoints[i % this.endpoints.length];
      
      try {
        await this.makeSingleRequest(endpoint);
      } catch (error) {
        // Continue testing even if individual requests fail
      }

      // Take memory snapshot every 100 iterations
      if (i % 100 === 0) {
        const memory = process.memoryUsage();
        memorySnapshots.push({
          iteration: i,
          heapUsed: memory.heapUsed,
          heapTotal: memory.heapTotal,
          rss: memory.rss,
          external: memory.external
        });

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }
    }

    const finalMemory = process.memoryUsage();
    const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;

    const leakTest = {
      iterations,
      initialMemory: initialMemory.heapUsed,
      finalMemory: finalMemory.heapUsed,
      memoryGrowth,
      memoryGrowthMB: (memoryGrowth / 1024 / 1024).toFixed(2),
      snapshots: memorySnapshots,
      suspectedLeak: memoryGrowth > 50 * 1024 * 1024 // 50MB threshold
    };

    logger.info('🍌 Memory leak test completed', leakTest);
    return leakTest;
  }

  // Make single request for testing
  makeSingleRequest(endpoint) {
    return new Promise((resolve, reject) => {
      const url = `${this.baseUrl}${endpoint}`;
      const request = this.createRequest(url, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => resolve(data));
      });

      request.on('error', reject);
      request.setTimeout(5000, () => {
        request.destroy();
        reject(new Error('Request timeout'));
      });

      request.end();
    });
  }

  // Generate comprehensive test report
  generateReport() {
    const report = {
      testConfiguration: {
        baseUrl: this.baseUrl,
        maxConcurrency: this.maxConcurrency,
        testDuration: this.testDuration,
        endpoints: this.endpoints
      },
      results: this.results,
      timestamp: new Date().toISOString(),
      recommendations: this.generateRecommendations()
    };

    return report;
  }

  // Generate performance recommendations
  generateRecommendations() {
    const recommendations = [];

    if (this.results.averageResponseTime > 1000) {
      recommendations.push('Average response time is high (>1s). Consider optimizing database queries or adding caching.');
    }

    if (this.results.successRate < 95) {
      recommendations.push('Success rate is below 95%. Investigate error patterns and improve error handling.');
    }

    if (this.results.memoryStats && this.results.memoryStats.maxHeapUsedMB > 1000) {
      recommendations.push('High memory usage detected. Consider memory optimization and garbage collection tuning.');
    }

    if (this.results.percentiles && this.results.percentiles.p95 > 5000) {
      recommendations.push('95th percentile response time is high. Some requests are taking too long.');
    }

    return recommendations;
  }
}

// Export for use in tests
module.exports = StressTestRunner;

// Run stress test if executed directly
if (require.main === module) {
  const runner = new StressTestRunner();
  
  (async () => {
    try {
      // Run comprehensive stress test
      await runner.runStressTest();
      
      // Test specific endpoint concurrency
      await runner.testEndpointConcurrency('/api/hubspot/contacts', 50, 30000);
      
      // Test for memory leaks
      await runner.testMemoryLeaks(500);
      
      // Generate final report
      const report = runner.generateReport();
      console.log('\n🍌 FINAL STRESS TEST REPORT:');
      console.log(JSON.stringify(report, null, 2));
      
    } catch (error) {
      logger.error('Stress test failed:', error);
      process.exit(1);
    }
  })();
}