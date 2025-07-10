const os = require('os');
const cluster = require('cluster');
const axios = require('axios');

describe('🍌 Pi 5 Performance Benchmarks - Maximum Banana Load Tests', () => {
  const baseURL = 'http://localhost:3000';
  let server;
  
  beforeAll(async () => {
    if (!process.env.BENCHMARK_MODE) {
      console.log('⚠️  Skipping benchmarks. Set BENCHMARK_MODE=true to run performance tests');
      return;
    }
    
    console.log('🍌 Starting Pi 5 Maximum Banana Performance Benchmarks...');
    console.log(`📊 System Info:`);
    console.log(`   CPU: ${os.cpus().length} cores - ${os.cpus()[0].model}`);
    console.log(`   Memory: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`);
    console.log(`   Platform: ${os.platform()} ${os.arch()}`);
    console.log(`   Node.js: ${process.version}`);
  });

  afterAll(() => {
    if (server) {
      server.close();
    }
  });

  const runBenchmark = async (name, testFunction, iterations = 100) => {
    if (!process.env.BENCHMARK_MODE) return;

    console.log(`\n🚀 Running ${name}...`);
    const startTime = Date.now();
    const startMemory = process.memoryUsage();
    
    const results = [];
    
    for (let i = 0; i < iterations; i++) {
      const iterationStart = Date.now();
      try {
        await testFunction();
        results.push(Date.now() - iterationStart);
      } catch (error) {
        console.error(`❌ Iteration ${i + 1} failed:`, error.message);
      }
    }
    
    const endTime = Date.now();
    const endMemory = process.memoryUsage();
    const totalTime = endTime - startTime;
    
    const avgTime = results.reduce((sum, time) => sum + time, 0) / results.length;
    const minTime = Math.min(...results);
    const maxTime = Math.max(...results);
    const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;
    
    console.log(`📊 ${name} Results:`);
    console.log(`   🔄 Iterations: ${iterations}`);
    console.log(`   ⏱️  Total Time: ${totalTime}ms`);
    console.log(`   📈 Average: ${avgTime.toFixed(2)}ms`);
    console.log(`   🏃 Fastest: ${minTime}ms`);
    console.log(`   🐌 Slowest: ${maxTime}ms`);
    console.log(`   🎯 Success Rate: ${(results.length / iterations * 100).toFixed(1)}%`);
    console.log(`   🧠 Memory Delta: ${(memoryDelta / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   🍌 Bananas/sec: ${(iterations / (totalTime / 1000)).toFixed(2)}`);
    
    // Assert performance thresholds for Pi 5
    expect(avgTime).toBeLessThan(1000); // Average response under 1s
    expect(results.length / iterations).toBeGreaterThan(0.95); // 95% success rate
    expect(memoryDelta).toBeLessThan(100 * 1024 * 1024); // Less than 100MB memory growth
  };

  describe('🚀 Endpoint Performance Benchmarks', () => {
    test('Health endpoint performance', async () => {
      await runBenchmark('Health Endpoint', async () => {
        const response = await axios.get(`${baseURL}/health`, { timeout: 5000 });
        expect(response.status).toBe(200);
      }, 200);
    });

    test('🍌 Maximum Banana Dashboard performance', async () => {
      await runBenchmark('Banana Dashboard', async () => {
        const response = await axios.get(`${baseURL}/monitoring/dashboard`, { timeout: 10000 });
        expect(response.status).toBe(200);
        expect(response.data.status).toBe('BANANA POWERED');
      }, 50);
    });

    test('Metrics endpoint performance', async () => {
      await runBenchmark('Metrics Endpoint', async () => {
        const response = await axios.get(`${baseURL}/monitoring/metrics`, { timeout: 5000 });
        expect(response.status).toBe(200);
      }, 100);
    });
  });

  describe('🔥 Stress Testing - Maximum Banana Load', () => {
    test('Concurrent request handling', async () => {
      if (!process.env.BENCHMARK_MODE) return;

      console.log('\n🔥 Concurrent Load Test - 50 simultaneous requests...');
      const concurrentRequests = 50;
      const startTime = Date.now();
      
      const requests = Array(concurrentRequests).fill().map(async (_, index) => {
        try {
          const response = await axios.get(`${baseURL}/health`, { 
            timeout: 10000,
            headers: { 'X-Test-Index': index }
          });
          return { success: true, status: response.status };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });

      const results = await Promise.all(requests);
      const endTime = Date.now();
      const successCount = results.filter(r => r.success).length;
      
      console.log(`📊 Concurrent Load Results:`);
      console.log(`   🔄 Total Requests: ${concurrentRequests}`);
      console.log(`   ✅ Successful: ${successCount}`);
      console.log(`   ❌ Failed: ${concurrentRequests - successCount}`);
      console.log(`   ⏱️  Total Time: ${endTime - startTime}ms`);
      console.log(`   🎯 Success Rate: ${(successCount / concurrentRequests * 100).toFixed(1)}%`);
      console.log(`   🍌 Req/sec: ${(concurrentRequests / ((endTime - startTime) / 1000)).toFixed(2)}`);
      
      expect(successCount / concurrentRequests).toBeGreaterThan(0.9); // 90% success rate under load
    });

    test('Memory stress test - Banana overload', async () => {
      if (!process.env.BENCHMARK_MODE) return;

      console.log('\n🧠 Memory Stress Test - Creating banana memory pressure...');
      const initialMemory = process.memoryUsage();
      
      // Create memory pressure by making many dashboard requests
      await runBenchmark('Memory Stress Dashboard', async () => {
        const response = await axios.get(`${baseURL}/monitoring/dashboard`, { timeout: 15000 });
        expect(response.status).toBe(200);
        
        // Create some temporary objects to stress memory
        const bananaData = Array(1000).fill().map((_, i) => ({
          id: i,
          banana: '🍌'.repeat(100),
          timestamp: Date.now()
        }));
        
        // Let them be garbage collected
        return bananaData.length;
      }, 30);
      
      const finalMemory = process.memoryUsage();
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      
      console.log(`🧠 Memory Stress Results:`);
      console.log(`   📊 Initial Memory: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   📊 Final Memory: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   📈 Growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)} MB`);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        const afterGC = process.memoryUsage();
        console.log(`   🗑️  After GC: ${(afterGC.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      }
      
      // Should not grow more than 500MB during stress test
      expect(memoryGrowth).toBeLessThan(500 * 1024 * 1024);
    });

    test('🍌 Ultimate Banana Endurance Test', async () => {
      if (!process.env.BENCHMARK_MODE) return;

      console.log('\n🏃‍♀️ Ultimate Banana Endurance Test - 5 minutes of continuous load...');
      const testDuration = 5 * 60 * 1000; // 5 minutes
      const requestInterval = 100; // Request every 100ms
      const startTime = Date.now();
      
      let requestCount = 0;
      let successCount = 0;
      let errorCount = 0;
      const errors = [];
      
      const enduranceTest = setInterval(async () => {
        try {
          requestCount++;
          const response = await axios.get(`${baseURL}/health`, { timeout: 5000 });
          if (response.status === 200) {
            successCount++;
          }
        } catch (error) {
          errorCount++;
          if (errors.length < 10) { // Keep only first 10 errors
            errors.push(error.message);
          }
        }
        
        // Log progress every 100 requests
        if (requestCount % 100 === 0) {
          const elapsed = Date.now() - startTime;
          const successRate = (successCount / requestCount * 100).toFixed(1);
          console.log(`   🏃‍♀️ Progress: ${requestCount} requests, ${successRate}% success, ${elapsed}ms elapsed`);
        }
      }, requestInterval);
      
      // Wait for test duration
      await new Promise(resolve => setTimeout(resolve, testDuration));
      clearInterval(enduranceTest);
      
      const totalTime = Date.now() - startTime;
      const successRate = (successCount / requestCount * 100).toFixed(1);
      const avgRequestsPerSecond = (requestCount / (totalTime / 1000)).toFixed(2);
      
      console.log(`🏆 Endurance Test Results:`);
      console.log(`   ⏱️  Duration: ${(totalTime / 1000 / 60).toFixed(1)} minutes`);
      console.log(`   🔄 Total Requests: ${requestCount}`);
      console.log(`   ✅ Successful: ${successCount}`);
      console.log(`   ❌ Errors: ${errorCount}`);
      console.log(`   🎯 Success Rate: ${successRate}%`);
      console.log(`   🍌 Avg Req/sec: ${avgRequestsPerSecond}`);
      
      if (errors.length > 0) {
        console.log(`   🐛 Sample Errors:`, errors.slice(0, 3));
      }
      
      // Pi 5 should maintain >95% success rate during endurance test
      expect(parseFloat(successRate)).toBeGreaterThan(95);
      expect(parseFloat(avgRequestsPerSecond)).toBeGreaterThan(5); // At least 5 req/sec
    });
  });

  describe('🔧 System Resource Monitoring', () => {
    test('CPU usage during load', async () => {
      if (!process.env.BENCHMARK_MODE) return;

      console.log('\n🔧 Monitoring CPU usage during load...');
      const cpuCount = os.cpus().length;
      
      // Monitor CPU for 30 seconds during load
      const monitoringDuration = 30000;
      const samples = [];
      
      const monitor = setInterval(() => {
        const loadAvg = os.loadavg();
        samples.push({
          timestamp: Date.now(),
          loadAvg1m: loadAvg[0],
          loadAvg5m: loadAvg[1],
          loadAvg15m: loadAvg[2],
          cpuCount
        });
      }, 1000);
      
      // Generate load while monitoring
      const loadPromise = runBenchmark('CPU Load Test', async () => {
        await axios.get(`${baseURL}/monitoring/dashboard`);
      }, 50);
      
      setTimeout(() => clearInterval(monitor), monitoringDuration);
      await loadPromise;
      
      const avgLoad1m = samples.reduce((sum, s) => sum + s.loadAvg1m, 0) / samples.length;
      const maxLoad1m = Math.max(...samples.map(s => s.loadAvg1m));
      
      console.log(`🔧 CPU Monitoring Results:`);
      console.log(`   🏭 CPU Cores: ${cpuCount}`);
      console.log(`   📊 Avg 1m Load: ${avgLoad1m.toFixed(2)}`);
      console.log(`   📈 Max 1m Load: ${maxLoad1m.toFixed(2)}`);
      console.log(`   🎯 Load per Core: ${(avgLoad1m / cpuCount).toFixed(2)}`);
      
      // Load should be reasonable for Pi 5
      expect(avgLoad1m).toBeLessThan(cpuCount * 2); // Load shouldn't exceed 2x core count
    });
  });

  describe('🍌 Banana Power Efficiency Tests', () => {
    test('Requests per banana efficiency', async () => {
      if (!process.env.BENCHMARK_MODE) return;

      console.log('\n🍌 Calculating maximum banana efficiency...');
      
      const bananaTestDuration = 10000; // 10 seconds
      const startTime = Date.now();
      const startMemory = process.memoryUsage();
      
      let bananaRequests = 0;
      
      while (Date.now() - startTime < bananaTestDuration) {
        try {
          await axios.get(`${baseURL}/health`, { timeout: 2000 });
          bananaRequests++;
        } catch (error) {
          // Count errors as banana inefficiency
        }
      }
      
      const endTime = Date.now();
      const endMemory = process.memoryUsage();
      const duration = (endTime - startTime) / 1000;
      const memoryUsed = (endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024;
      
      const bananasPerSecond = bananaRequests / duration;
      const memoryPerBanana = memoryUsed / bananaRequests;
      const bananaEfficiency = bananasPerSecond / (memoryUsed + 1); // +1 to avoid division by zero
      
      console.log(`🍌 Banana Efficiency Metrics:`);
      console.log(`   🍌 Total Bananas: ${bananaRequests}`);
      console.log(`   ⚡ Bananas/second: ${bananasPerSecond.toFixed(2)}`);
      console.log(`   🧠 Memory/banana: ${memoryPerBanana.toFixed(4)} MB`);
      console.log(`   🏆 Banana Efficiency: ${bananaEfficiency.toFixed(2)}`);
      console.log(`   🎖️  Monkey Rating: ${bananaEfficiency > 10 ? '👑 BANANA KING' : bananaEfficiency > 5 ? '🥇 BANANA MASTER' : '🍌 BANANA APPRENTICE'}`);
      
      expect(bananasPerSecond).toBeGreaterThan(10); // At least 10 bananas/sec
      expect(memoryPerBanana).toBeLessThan(1); // Less than 1MB per banana
    });
  });
});