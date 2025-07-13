// 🍌 Jest Test Setup - Maximum Banana Testing Power! 🍌

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Suppress logs during testing

// Mock external dependencies for unit tests
jest.mock('../shared/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

// Global test utilities
global.testUtils = {
  // Helper to wait for async operations
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Mock memory usage for testing
  mockMemoryUsage: (options = {}) => {
    const originalMemoryUsage = process.memoryUsage;
    process.memoryUsage = jest.fn(() => ({
      rss: options.rss || 100 * 1024 * 1024, // 100MB
      heapTotal: options.heapTotal || 80 * 1024 * 1024, // 80MB
      heapUsed: options.heapUsed || 60 * 1024 * 1024, // 60MB
      external: options.external || 10 * 1024 * 1024, // 10MB
      arrayBuffers: options.arrayBuffers || 5 * 1024 * 1024 // 5MB
    }));
    
    return () => {
      process.memoryUsage = originalMemoryUsage;
    };
  },
  
  // Generate test data
  generateBananaData: (count = 10) => {
    return Array(count).fill().map((_, i) => ({
      id: `banana_${i}`,
      name: `Banana ${i}`,
      ripeness: Math.random() * 100,
      emoji: '🍌',
      timestamp: new Date().toISOString()
    }));
  }
};

// Increase test timeout for integration tests
jest.setTimeout(30000);

// Console override for cleaner test output
const originalConsole = console;
global.console = {
  ...originalConsole,
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: originalConsole.error // Keep errors for debugging
};

// Cleanup function
afterEach(() => {
  jest.clearAllMocks();
});

console.info('🍌 Jest setup complete - Ready for maximum banana testing! 🍌');