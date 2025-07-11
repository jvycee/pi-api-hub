# 🍌 Banana MCP Tool SDK

**The ultimate framework for building custom MCP tools with banana-powered optimizations**

Transform your MCP development experience with our comprehensive SDK that provides standardized interfaces, intelligent caching, performance monitoring, and enterprise-grade features out of the box.

## ✨ Features

### 🚀 **Core Framework**
- **Standardized Base Class**: Common interface for all MCP tools
- **Input/Output Validation**: Joi-based schema validation
- **Error Handling**: Intelligent retry logic with exponential backoff
- **Performance Monitoring**: Built-in metrics collection and analysis

### 🍌 **Banana-Powered Optimizations**
- **Intelligent Caching**: Configurable TTL-based caching system
- **Rate Limiting**: Per-tool rate limiting with token bucket algorithm
- **Circuit Breaker**: Automatic failover protection
- **Timeout Management**: Configurable execution timeouts

### 📊 **Advanced Analytics**
- **Execution Metrics**: Response time, success rate, error tracking
- **Performance Insights**: Automated performance analysis
- **Usage Analytics**: Tool usage patterns and trends
- **Health Monitoring**: Real-time health status tracking

### 🔧 **Developer Experience**
- **Type Safety**: Full TypeScript support (coming soon)
- **Hot Reloading**: Dynamic tool registration and updates
- **Debug Mode**: Comprehensive logging and debugging tools
- **Testing Utilities**: Built-in testing framework

## 🏗️ **Architecture**

```
┌─────────────────────────────────────────────────┐
│                MCP Client                       │
│           (Claude, Cursor, VS Code)             │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────┴───────────────────────────────┐
│            Banana Tool Registry                 │
│     ┌─────────────────────────────────────┐     │
│     │        Tool Discovery &             │     │
│     │        Lifecycle Management         │     │
│     └─────────────────────────────────────┘     │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────┴───────────────────────────────┐
│          BananaMCPTool (Base Class)             │
│  ┌─────────────────────────────────────────┐    │
│  │ • Input/Output Validation              │    │
│  │ • Caching & Rate Limiting              │    │
│  │ • Error Handling & Retries             │    │
│  │ • Performance Monitoring               │    │
│  │ • Lifecycle Management                 │    │
│  └─────────────────────────────────────────┘    │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────┴───────────────────────────────┐
│            Custom Tool Implementation           │
│     ┌─────────────────┬─────────────────┐       │
│     │  HubSpot Tools  │ Analytics Tools │  ...  │
│     │  • Contacts     │ • Performance   │       │
│     │  • Companies    │ • Usage         │       │
│     │  • Deals        │ • Insights      │       │
│     └─────────────────┴─────────────────┘       │
└─────────────────────────────────────────────────┘
```

## 🚀 **Quick Start**

### 1. Installation

```bash
# Install the SDK (when published)
npm install @banana-labs/mcp-tool-sdk

# Or use directly from the project
const { BananaMCPTool, BananaToolRegistry } = require('./sdk/mcp-tool-sdk');
```

### 2. Create Your First Tool

```javascript
const { BananaMCPTool } = require('./sdk/mcp-tool-sdk');
const Joi = require('joi');

class MyCustomTool extends BananaMCPTool {
    constructor() {
        super({
            name: 'my-custom-tool',
            description: 'My awesome banana-powered tool',
            version: '1.0.0',
            category: 'custom'
        });
    }

    defineInputSchema() {
        return Joi.object({
            action: Joi.string().required(),
            data: Joi.any()
        });
    }

    defineOutputSchema() {
        return Joi.object({
            success: Joi.boolean().required(),
            result: Joi.any(),
            metadata: Joi.object().required()
        });
    }

    async execute(input, context) {
        // Your tool logic here
        return {
            success: true,
            result: `Processed: ${input.action}`,
        };
    }
}
```

### 3. Register and Use

```javascript
const { BananaToolRegistry } = require('./sdk/mcp-tool-sdk');

// Create registry
const registry = new BananaToolRegistry();

// Register your tool
const myTool = new MyCustomTool();
registry.register(myTool);

// Execute tool
const result = await registry.execute('my-custom-tool', {
    action: 'test',
    data: { example: 'value' }
});

console.log(result);
```

## 📚 **Core Concepts**

### BananaMCPTool Base Class

All tools extend from `BananaMCPTool` which provides:

```javascript
class BananaMCPTool extends EventEmitter {
    constructor(config) {
        // Tool configuration
        this.config = {
            name: 'tool-name',
            description: 'Tool description',
            version: '1.0.0',
            category: 'category',
            cacheEnabled: true,
            cacheTTL: 300000,
            rateLimitEnabled: true,
            rateLimit: 100,
            retryEnabled: true,
            maxRetries: 3,
            timeout: 30000
        };
    }
    
    // Abstract methods to implement
    defineInputSchema() { /* Return Joi schema */ }
    defineOutputSchema() { /* Return Joi schema */ }
    async execute(input, context) { /* Tool logic */ }
}
```

### Tool Registry

The `BananaToolRegistry` manages tool lifecycle:

```javascript
const registry = new BananaToolRegistry();

// Tool management
registry.register(tool);
registry.unregister('tool-name');
registry.get('tool-name');
registry.list();
registry.listByCategory('category');

// Execution
await registry.execute('tool-name', input, context);

// Monitoring
registry.getMetrics();
registry.getAllStatus();
```

### Configuration Options

```javascript
const tool = new MyTool({
    // Basic info
    name: 'my-tool',
    description: 'Tool description',
    version: '1.0.0',
    category: 'custom',
    
    // Performance options
    cacheEnabled: true,
    cacheTTL: 300000,      // 5 minutes
    timeout: 30000,        // 30 seconds
    
    // Reliability options
    retryEnabled: true,
    maxRetries: 3,
    
    // Rate limiting
    rateLimitEnabled: true,
    rateLimit: 100         // calls per minute
});
```

## 🛠️ **Tool Examples**

### HubSpot Contact Tool

Complete HubSpot contact management with banana optimizations:

```javascript
const result = await registry.execute('hubspot-banana-contact', {
    action: 'list',
    limit: 50,
    requestedProperties: ['firstname', 'lastname', 'email'],
    enableOptimizations: true
});
```

**Features:**
- ✅ Full CRUD operations (create, read, update, delete)
- ✅ Advanced search with filters
- ✅ Batch operations support
- ✅ Intelligent caching
- ✅ Data compression and optimization
- ✅ Simulation mode for testing

### Analytics Tool

Advanced analytics and insights:

```javascript
const analytics = await registry.execute('banana-analytics', {
    action: 'performance',
    timeRange: '24h',
    metrics: ['response_time', 'error_rate', 'throughput'],
    includeBreakdown: true,
    enableMLInsights: true
});
```

**Features:**
- ✅ Performance analysis
- ✅ Usage pattern detection
- ✅ Trend analysis and forecasting
- ✅ Anomaly detection
- ✅ Health monitoring
- ✅ ML-powered insights

## 🎯 **Advanced Features**

### Intelligent Caching

```javascript
class MyTool extends BananaMCPTool {
    // Override cache key generation
    generateCacheKey(input, context) {
        return `${this.config.name}:${input.id}:${input.version}`;
    }
    
    // Cache management
    enableCache() { /* Enable caching */ }
    disableCache() { /* Disable and clear cache */ }
    clearCache() { /* Clear cache manually */ }
}
```

### Error Handling & Retries

```javascript
class MyTool extends BananaMCPTool {
    // Override retry logic
    isRetryableError(error) {
        return error.code === 'ECONNRESET' || 
               error.code === 'ETIMEDOUT' ||
               error.message.includes('rate limit');
    }
    
    // Custom retry delay
    calculateRetryDelay(attempt) {
        return Math.min(1000 * Math.pow(2, attempt - 1), 10000);
    }
}
```

### Event Monitoring

```javascript
const tool = new MyTool();

// Listen to tool events
tool.on('executionStart', (data) => {
    console.log('Tool execution started:', data);
});

tool.on('executionComplete', (data) => {
    console.log('Tool execution completed:', data);
});

tool.on('executionError', (data) => {
    console.error('Tool execution failed:', data);
});

tool.on('cacheHit', (data) => {
    console.log('Cache hit:', data);
});
```

### Performance Monitoring

```javascript
// Get tool metrics
const metrics = tool.getMetrics();
console.log({
    executionCount: metrics.executionCount,
    averageExecutionTime: metrics.averageExecutionTime,
    successRate: metrics.successRate,
    cacheSize: metrics.cacheSize
});

// Get tool status
const status = tool.getStatus();
console.log({
    name: status.name,
    healthy: status.healthy,
    lastExecuted: status.lastExecuted
});
```

## 🧪 **Testing Your Tools**

### Unit Testing

```javascript
const { BananaMCPTool } = require('./sdk/mcp-tool-sdk');
const MyTool = require('./my-tool');

describe('MyTool', () => {
    let tool;
    
    beforeEach(() => {
        tool = new MyTool();
    });
    
    test('should execute successfully', async () => {
        const result = await tool.run({
            action: 'test',
            data: 'example'
        });
        
        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.metadata).toBeDefined();
    });
    
    test('should validate input', async () => {
        const result = await tool.run({
            // Missing required fields
        });
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid input');
    });
    
    test('should cache results', async () => {
        const input = { action: 'test', data: 'cache-test' };
        
        // First call
        const result1 = await tool.run(input);
        expect(result1.metadata.cached).toBe(false);
        
        // Second call should be cached
        const result2 = await tool.run(input);
        expect(result2.metadata.cached).toBe(true);
    });
});
```

### Integration Testing

```javascript
const { BananaToolRegistry } = require('./sdk/mcp-tool-sdk');

describe('Tool Registry Integration', () => {
    let registry;
    
    beforeEach(() => {
        registry = new BananaToolRegistry();
        registry.register(new MyTool());
    });
    
    test('should execute tool via registry', async () => {
        const result = await registry.execute('my-tool', {
            action: 'test'
        });
        
        expect(result.success).toBe(true);
    });
    
    test('should handle tool not found', async () => {
        await expect(
            registry.execute('nonexistent-tool', {})
        ).rejects.toThrow('Tool \'nonexistent-tool\' not found');
    });
});
```

## 📊 **Performance Guidelines**

### Optimization Best Practices

1. **Enable Caching**: Use caching for expensive operations
2. **Validate Early**: Validate inputs before heavy processing
3. **Batch Operations**: Group multiple operations when possible
4. **Stream Large Data**: Use streaming for large datasets
5. **Monitor Performance**: Track metrics and optimize bottlenecks

### Performance Targets

| Metric | Target | Excellent |
|--------|--------|-----------|
| Response Time | < 500ms | < 200ms |
| Cache Hit Rate | > 70% | > 90% |
| Success Rate | > 95% | > 99% |
| Error Rate | < 5% | < 1% |

### Memory Management

```javascript
class MyTool extends BananaMCPTool {
    constructor() {
        super({
            // Limit cache size to prevent memory issues
            maxCacheSize: 1000,
            
            // Shorter TTL for memory-intensive operations
            cacheTTL: 60000 // 1 minute
        });
    }
    
    // Clean up resources
    cleanup() {
        this.clearCache();
        this.removeAllListeners();
    }
}
```

## 🔒 **Security Guidelines**

### Input Validation

```javascript
defineInputSchema() {
    return Joi.object({
        // Always validate and sanitize inputs
        userId: Joi.string().alphanum().max(50).required(),
        email: Joi.string().email().required(),
        
        // Prevent injection attacks
        query: Joi.string().max(1000).pattern(/^[a-zA-Z0-9\s\-_@.]+$/),
        
        // Limit array sizes
        ids: Joi.array().items(Joi.string()).max(100)
    });
}
```

### API Key Security

```javascript
class SecureHubSpotTool extends BananaMCPTool {
    constructor() {
        super(config);
        
        // Never log API keys
        this.apiKey = process.env.HUBSPOT_API_KEY;
        
        if (!this.apiKey) {
            throw new Error('HUBSPOT_API_KEY environment variable required');
        }
    }
    
    // Sanitize logs
    logSafeData(data) {
        const safe = { ...data };
        delete safe.apiKey;
        delete safe.token;
        delete safe.password;
        return safe;
    }
}
```

### Rate Limiting

```javascript
// Configure rate limits based on API provider limits
const tool = new HubSpotTool({
    rateLimitEnabled: true,
    rateLimit: 100,  // HubSpot allows 100 calls/10 seconds
    
    // Handle rate limit errors
    retryEnabled: true,
    maxRetries: 3
});
```

## 🚀 **Deployment**

### Production Configuration

```javascript
const production = {
    // Longer cache for production
    cacheTTL: 900000, // 15 minutes
    
    // Conservative rate limiting
    rateLimit: 50,
    
    // Shorter timeouts
    timeout: 15000,
    
    // More retries
    maxRetries: 5,
    
    // Enable monitoring
    enableMetrics: true,
    enableHealthChecks: true
};
```

### Environment Variables

```bash
# Required
HUBSPOT_PRIVATE_APP_TOKEN=your_token_here
BANANA_ADMIN_KEY=your_admin_key_here

# Optional performance tuning
TOOL_CACHE_TTL=300000
TOOL_RATE_LIMIT=100
TOOL_TIMEOUT=30000
TOOL_MAX_RETRIES=3

# Debug mode
DEBUG_TOOLS=true
TOOL_LOG_LEVEL=debug
```

### Health Monitoring

```javascript
// Monitor tool health
setInterval(() => {
    const metrics = registry.getMetrics();
    
    if (metrics.averageSuccessRate < 95) {
        console.warn('Tool success rate below threshold:', metrics);
    }
    
    if (metrics.totalExecutions === 0) {
        console.warn('No tool executions detected');
    }
}, 60000); // Check every minute
```

## 🤝 **Contributing**

### Development Setup

```bash
git clone https://github.com/your-org/pi-api-hub.git
cd pi-api-hub/sdk
npm install
```

### Creating New Tools

1. **Extend BananaMCPTool**: Start with the base class
2. **Define Schemas**: Input and output validation
3. **Implement Logic**: Core tool functionality
4. **Add Tests**: Unit and integration tests
5. **Document**: README and code comments
6. **Register**: Add to tool registry

### Code Style

```javascript
// Use descriptive names
class HubSpotContactManagementTool extends BananaMCPTool {
    // Document public methods
    /**
     * Creates a new HubSpot contact
     * @param {Object} contactData - Contact properties
     * @param {Object} context - Execution context
     * @returns {Promise<Object>} Created contact data
     */
    async createContact(contactData, context) {
        // Implementation
    }
}
```

## 📖 **API Reference**

### BananaMCPTool

#### Constructor Options
- `name`: Tool identifier
- `description`: Tool description
- `version`: Semantic version
- `category`: Tool category
- `cacheEnabled`: Enable caching
- `cacheTTL`: Cache time-to-live
- `rateLimitEnabled`: Enable rate limiting
- `rateLimit`: Calls per minute
- `retryEnabled`: Enable retries
- `maxRetries`: Maximum retry attempts
- `timeout`: Execution timeout

#### Methods
- `run(input, context)`: Execute tool with full features
- `execute(input, context)`: Core execution logic (override)
- `defineInputSchema()`: Define input validation (override)
- `defineOutputSchema()`: Define output validation (override)
- `getMetrics()`: Get performance metrics
- `getStatus()`: Get tool status
- `updateConfig(config)`: Update configuration
- `clearCache()`: Clear tool cache
- `resetMetrics()`: Reset performance metrics

#### Events
- `executionStart`: Tool execution started
- `executionComplete`: Tool execution completed
- `executionError`: Tool execution failed
- `cacheHit`: Cache hit occurred
- `configUpdated`: Configuration changed

### BananaToolRegistry

#### Methods
- `register(tool)`: Register new tool
- `unregister(name)`: Unregister tool
- `get(name)`: Get tool by name
- `has(name)`: Check if tool exists
- `list()`: List all tool names
- `listByCategory(category)`: List tools by category
- `getCategories()`: Get all categories
- `execute(name, input, context)`: Execute tool
- `getToolStatus(name)`: Get tool status
- `getAllStatus()`: Get all tool statuses
- `getMetrics()`: Get registry metrics

#### Events
- `toolRegistered`: Tool registered
- `toolUnregistered`: Tool unregistered
- `toolExecutionStart`: Tool execution started
- `toolExecutionComplete`: Tool execution completed
- `toolExecutionError`: Tool execution failed
- `toolCacheHit`: Tool cache hit

## 🔗 **Related Documentation**

- [MCP Integration Guide](../docs/MCP_INTEGRATION_GUIDE.md)
- [MCP Setup Guide](../docs/MCP_SETUP_GUIDE.md)
- [VS Code Extension](../vscode-extension/README.md)
- [Streaming System](../streaming/README.md)

## 📄 **License**

This SDK is part of the Pi API Hub project and is licensed under the MIT License.

---

**🍌 Build amazing MCP tools with banana-powered performance and enterprise-grade reliability! 🍌**

*Made with 🍌 by the Banana Labs team*