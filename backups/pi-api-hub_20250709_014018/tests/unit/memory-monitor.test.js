const MemoryMonitor = require('../../middleware/memory-monitor');

describe('🍌 MemoryMonitor - Banana Memory Management Tests', () => {
  let memoryMonitor;

  beforeEach(() => {
    memoryMonitor = new MemoryMonitor({
      warningThreshold: 100 * 1024 * 1024, // 100MB for testing
      criticalThreshold: 200 * 1024 * 1024, // 200MB for testing
      logInterval: 1000 // 1 second for testing
    });
  });

  afterEach(() => {
    if (memoryMonitor) {
      // Stop monitoring to prevent interference
      clearInterval(memoryMonitor.monitoringInterval);
    }
  });

  describe('Memory Usage Tracking', () => {
    test('should get current memory usage', () => {
      const usage = memoryMonitor.getMemoryUsage();
      
      expect(usage).toHaveProperty('rss');
      expect(usage).toHaveProperty('heapTotal');
      expect(usage).toHaveProperty('heapUsed');
      expect(usage).toHaveProperty('external');
      expect(usage).toHaveProperty('heapUtilization');
      expect(usage).toHaveProperty('totalMemory');
      
      expect(typeof usage.rss).toBe('number');
      expect(typeof usage.heapUtilization).toBe('number');
      expect(usage.heapUtilization).toBeGreaterThanOrEqual(0);
      expect(usage.heapUtilization).toBeLessThanOrEqual(100);
    });

    test('should format bytes correctly', () => {
      expect(memoryMonitor.formatBytes(1024 * 1024 * 1024)).toBe('1.00 GB');
      expect(memoryMonitor.formatBytes(512 * 1024 * 1024)).toBe('0.50 GB');
      expect(memoryMonitor.formatBytes(2.5 * 1024 * 1024 * 1024)).toBe('2.50 GB');
    });
  });

  describe('Health Checks', () => {
    test('should return healthy status for normal memory usage', () => {
      // Mock low memory usage
      const originalGetMemoryUsage = memoryMonitor.getMemoryUsage;
      memoryMonitor.getMemoryUsage = () => ({
        totalMemory: 50 * 1024 * 1024, // 50MB
        heapUtilization: 30
      });

      const status = memoryMonitor.checkMemoryHealth();
      expect(status).toBe('healthy');

      memoryMonitor.getMemoryUsage = originalGetMemoryUsage;
    });

    test('should return warning status for high memory usage', () => {
      const originalGetMemoryUsage = memoryMonitor.getMemoryUsage;
      memoryMonitor.getMemoryUsage = () => ({
        totalMemory: 150 * 1024 * 1024, // 150MB (above warning threshold)
        heapUtilization: 75
      });

      const status = memoryMonitor.checkMemoryHealth();
      expect(status).toBe('warning');

      memoryMonitor.getMemoryUsage = originalGetMemoryUsage;
    });

    test('should return critical status for very high memory usage', () => {
      const originalGetMemoryUsage = memoryMonitor.getMemoryUsage;
      memoryMonitor.getMemoryUsage = () => ({
        totalMemory: 250 * 1024 * 1024, // 250MB (above critical threshold)
        heapUtilization: 95
      });

      const status = memoryMonitor.checkMemoryHealth();
      expect(status).toBe('critical');

      memoryMonitor.getMemoryUsage = originalGetMemoryUsage;
    });
  });

  describe('Middleware', () => {
    test('should create middleware function', () => {
      const middleware = memoryMonitor.middleware();
      expect(typeof middleware).toBe('function');
      expect(middleware.length).toBe(3); // req, res, next
    });

    test('should add memory headers in development mode', (done) => {
      process.env.NODE_ENV = 'development';
      
      const middleware = memoryMonitor.middleware();
      const req = { path: '/test' };
      const res = {
        setHeader: jest.fn(),
        on: jest.fn((event, callback) => {
          if (event === 'finish') {
            setTimeout(callback, 10);
          }
        })
      };
      const next = jest.fn();

      middleware(req, res, next);

      setTimeout(() => {
        expect(res.setHeader).toHaveBeenCalledWith('X-Memory-Usage', expect.any(String));
        expect(res.setHeader).toHaveBeenCalledWith('X-Heap-Utilization', expect.any(String));
        expect(next).toHaveBeenCalled();
        done();
      }, 20);
    });
  });

  describe('Status Reporting', () => {
    test('should provide comprehensive status', () => {
      const status = memoryMonitor.getStatus();
      
      expect(status).toHaveProperty('status');
      expect(status).toHaveProperty('totalMemory');
      expect(status).toHaveProperty('heapUtilization');
      expect(status).toHaveProperty('rss');
      expect(status).toHaveProperty('heapUsed');
      expect(status).toHaveProperty('thresholds');
      
      expect(status.thresholds).toHaveProperty('warning');
      expect(status.thresholds).toHaveProperty('critical');
      
      expect(['healthy', 'warning', 'critical']).toContain(status.status);
    });
  });

  describe('🍌 Banana Power Tests', () => {
    test('should handle banana-sized memory loads', () => {
      // Test with artificially large memory values
      const originalGetMemoryUsage = memoryMonitor.getMemoryUsage;
      memoryMonitor.getMemoryUsage = () => ({
        totalMemory: 8 * 1024 * 1024 * 1024, // 8GB - Full Pi memory!
        heapUtilization: 99.9,
        rss: 7 * 1024 * 1024 * 1024,
        heapUsed: 6 * 1024 * 1024 * 1024,
        heapTotal: 6.5 * 1024 * 1024 * 1024,
        external: 1 * 1024 * 1024 * 1024
      });

      const status = memoryMonitor.getStatus();
      expect(status.totalMemory).toBe('8.00 GB');
      expect(status.heapUtilization).toBe('99.90%');
      
      memoryMonitor.getMemoryUsage = originalGetMemoryUsage;
    });

    test('should survive maximum banana stress', () => {
      // Stress test the memory monitor
      for (let i = 0; i < 100; i++) {
        const usage = memoryMonitor.getMemoryUsage();
        expect(usage).toBeDefined();
        expect(usage.totalMemory).toBeGreaterThan(0);
      }
    });
  });
});