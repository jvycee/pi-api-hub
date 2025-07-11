/**
 * 🍌 BANANA MCP TOOL SDK 🍌
 * 
 * Framework for developing custom MCP tools with banana-powered optimizations
 * Provides standardized interfaces, validation, caching, and monitoring
 */

const EventEmitter = require('events');
const Joi = require('joi');
const logger = require('../shared/logger');

/**
 * Base class for all MCP tools
 */
class BananaMCPTool extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            name: config.name || 'unnamed-tool',
            description: config.description || 'A custom MCP tool',
            version: config.version || '1.0.0',
            category: config.category || 'custom',
            cacheEnabled: config.cacheEnabled !== false,
            cacheTTL: config.cacheTTL || 300000, // 5 minutes
            rateLimitEnabled: config.rateLimitEnabled !== false,
            rateLimit: config.rateLimit || 100, // calls per minute
            retryEnabled: config.retryEnabled !== false,
            maxRetries: config.maxRetries || 3,
            timeout: config.timeout || 30000,
            ...config
        };

        // Input/output schemas
        this.inputSchema = this.defineInputSchema();
        this.outputSchema = this.defineOutputSchema();
        
        // Tool metadata
        this.metadata = {
            id: this.generateToolId(),
            createdAt: Date.now(),
            executionCount: 0,
            lastExecuted: null,
            averageExecutionTime: 0,
            successRate: 0,
            errorCount: 0
        };

        // Internal state
        this.cache = new Map();
        this.rateLimitTokens = this.config.rateLimit;
        this.lastRateLimitReset = Date.now();
        
        logger.info('🍌 MCP Tool initialized', {
            name: this.config.name,
            version: this.config.version,
            category: this.config.category
        });
    }

    /**
     * Define the input schema for this tool
     * Override in subclasses
     */
    defineInputSchema() {
        return Joi.object({
            // Base schema - override in subclasses
        });
    }

    /**
     * Define the output schema for this tool
     * Override in subclasses
     */
    defineOutputSchema() {
        return Joi.object({
            success: Joi.boolean().required(),
            data: Joi.any(),
            error: Joi.string(),
            metadata: Joi.object({
                executionTime: Joi.number(),
                cached: Joi.boolean(),
                timestamp: Joi.number()
            })
        });
    }

    /**
     * Main execution method - override in subclasses
     */
    async execute(input, context = {}) {
        throw new Error('execute() method must be implemented by subclass');
    }

    /**
     * Execute the tool with full banana-powered features
     */
    async run(input, context = {}) {
        const startTime = Date.now();
        const operationId = context.operationId || this.generateOperationId();
        
        try {
            // Rate limiting check
            if (!this.checkRateLimit()) {
                throw new Error('Rate limit exceeded');
            }

            // Input validation
            const validatedInput = await this.validateInput(input);
            
            // Check cache first
            let result;
            const cacheKey = this.generateCacheKey(validatedInput, context);
            
            if (this.config.cacheEnabled && this.cache.has(cacheKey)) {
                const cachedEntry = this.cache.get(cacheKey);
                if (Date.now() - cachedEntry.timestamp < this.config.cacheTTL) {
                    result = {
                        ...cachedEntry.result,
                        metadata: {
                            ...cachedEntry.result.metadata,
                            cached: true,
                            executionTime: Date.now() - startTime
                        }
                    };
                    
                    this.emit('cacheHit', { tool: this.config.name, cacheKey, operationId });
                    return result;
                }
            }

            // Execute the tool
            this.emit('executionStart', { tool: this.config.name, input: validatedInput, operationId });
            
            result = await this.executeWithRetry(validatedInput, context);
            
            // Add execution metadata
            const executionTime = Date.now() - startTime;
            result.metadata = {
                executionTime,
                cached: false,
                timestamp: Date.now(),
                operationId,
                toolVersion: this.config.version
            };

            // Cache the result
            if (this.config.cacheEnabled && result.success) {
                this.cache.set(cacheKey, {
                    result: { ...result },
                    timestamp: Date.now()
                });
                
                // Clean old cache entries
                this.cleanupCache();
            }

            // Update metrics
            this.updateMetrics(executionTime, result.success);
            
            // Validate output
            await this.validateOutput(result);
            
            this.emit('executionComplete', { 
                tool: this.config.name, 
                result, 
                executionTime, 
                operationId 
            });
            
            return result;
            
        } catch (error) {
            const executionTime = Date.now() - startTime;
            this.metadata.errorCount++;
            
            const errorResult = {
                success: false,
                error: error.message,
                metadata: {
                    executionTime,
                    cached: false,
                    timestamp: Date.now(),
                    operationId,
                    toolVersion: this.config.version
                }
            };

            this.emit('executionError', { 
                tool: this.config.name, 
                error, 
                executionTime, 
                operationId 
            });
            
            logger.error('🍌 Tool execution failed', {
                tool: this.config.name,
                error: error.message,
                operationId,
                executionTime
            });
            
            return errorResult;
        }
    }

    async executeWithRetry(input, context) {
        let lastError;
        let attempt = 0;

        while (attempt <= this.config.maxRetries) {
            try {
                return await Promise.race([
                    this.execute(input, context),
                    this.createTimeoutPromise()
                ]);
            } catch (error) {
                lastError = error;
                attempt++;
                
                if (attempt <= this.config.maxRetries && this.isRetryableError(error)) {
                    const delay = this.calculateRetryDelay(attempt);
                    logger.warn('🍌 Tool execution failed, retrying', {
                        tool: this.config.name,
                        attempt,
                        delay,
                        error: error.message
                    });
                    await this.delay(delay);
                } else {
                    throw error;
                }
            }
        }

        throw lastError;
    }

    createTimeoutPromise() {
        return new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Tool execution timeout after ${this.config.timeout}ms`));
            }, this.config.timeout);
        });
    }

    isRetryableError(error) {
        // Network errors, timeouts, and temporary failures are retryable
        return error.code === 'ECONNRESET' ||
               error.code === 'ETIMEDOUT' ||
               error.code === 'ENOTFOUND' ||
               error.message.includes('timeout') ||
               error.message.includes('rate limit');
    }

    calculateRetryDelay(attempt) {
        // Exponential backoff with jitter
        const baseDelay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        const jitter = Math.random() * 0.1 * baseDelay;
        return baseDelay + jitter;
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async validateInput(input) {
        try {
            const result = await this.inputSchema.validateAsync(input, {
                abortEarly: false,
                stripUnknown: true
            });
            return result;
        } catch (error) {
            throw new Error(`Invalid input: ${error.message}`);
        }
    }

    async validateOutput(output) {
        try {
            await this.outputSchema.validateAsync(output, {
                abortEarly: false
            });
        } catch (error) {
            logger.error('🍌 Tool output validation failed', {
                tool: this.config.name,
                error: error.message,
                output: JSON.stringify(output).substring(0, 500)
            });
            throw new Error(`Invalid output: ${error.message}`);
        }
    }

    checkRateLimit() {
        if (!this.config.rateLimitEnabled) {
            return true;
        }

        const now = Date.now();
        const timeSinceReset = now - this.lastRateLimitReset;

        // Reset tokens every minute
        if (timeSinceReset >= 60000) {
            this.rateLimitTokens = this.config.rateLimit;
            this.lastRateLimitReset = now;
        }

        if (this.rateLimitTokens > 0) {
            this.rateLimitTokens--;
            return true;
        }

        return false;
    }

    generateCacheKey(input, context) {
        const keyData = {
            tool: this.config.name,
            version: this.config.version,
            input: input,
            context: context
        };
        
        // Simple hash function for cache key
        return Buffer.from(JSON.stringify(keyData)).toString('base64');
    }

    cleanupCache() {
        const now = Date.now();
        for (const [key, entry] of this.cache) {
            if (now - entry.timestamp > this.config.cacheTTL) {
                this.cache.delete(key);
            }
        }
    }

    updateMetrics(executionTime, success) {
        this.metadata.executionCount++;
        this.metadata.lastExecuted = Date.now();
        
        // Update average execution time
        const totalTime = this.metadata.averageExecutionTime * (this.metadata.executionCount - 1) + executionTime;
        this.metadata.averageExecutionTime = totalTime / this.metadata.executionCount;
        
        // Update success rate
        if (success) {
            const successCount = Math.floor(this.metadata.successRate * (this.metadata.executionCount - 1) / 100) + 1;
            this.metadata.successRate = (successCount / this.metadata.executionCount) * 100;
        } else {
            const successCount = Math.floor(this.metadata.successRate * (this.metadata.executionCount - 1) / 100);
            this.metadata.successRate = (successCount / this.metadata.executionCount) * 100;
        }
    }

    generateToolId() {
        return `${this.config.name}_${this.config.version}_${Date.now()}`;
    }

    generateOperationId() {
        return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Public API methods
    getName() {
        return this.config.name;
    }

    getDescription() {
        return this.config.description;
    }

    getVersion() {
        return this.config.version;
    }

    getCategory() {
        return this.config.category;
    }

    getSchema() {
        return {
            input: this.inputSchema.describe(),
            output: this.outputSchema.describe()
        };
    }

    getMetrics() {
        return {
            ...this.metadata,
            cacheSize: this.cache.size,
            rateLimitTokens: this.rateLimitTokens
        };
    }

    getStatus() {
        return {
            name: this.config.name,
            version: this.config.version,
            category: this.config.category,
            enabled: true,
            healthy: this.metadata.successRate > 50, // Arbitrary threshold
            lastExecuted: this.metadata.lastExecuted,
            metrics: this.getMetrics()
        };
    }

    // Configuration methods
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.emit('configUpdated', { tool: this.config.name, config: this.config });
    }

    enableCache() {
        this.config.cacheEnabled = true;
    }

    disableCache() {
        this.config.cacheEnabled = false;
        this.cache.clear();
    }

    clearCache() {
        this.cache.clear();
        this.emit('cacheCleared', { tool: this.config.name });
    }

    resetMetrics() {
        this.metadata = {
            ...this.metadata,
            executionCount: 0,
            lastExecuted: null,
            averageExecutionTime: 0,
            successRate: 0,
            errorCount: 0
        };
    }
}

/**
 * Tool Registry for managing multiple tools
 */
class BananaToolRegistry extends EventEmitter {
    constructor() {
        super();
        this.tools = new Map();
        this.categories = new Map();
        
        logger.info('🍌 Banana Tool Registry initialized');
    }

    register(tool) {
        if (!(tool instanceof BananaMCPTool)) {
            throw new Error('Tool must be an instance of BananaMCPTool');
        }

        const name = tool.getName();
        if (this.tools.has(name)) {
            throw new Error(`Tool '${name}' is already registered`);
        }

        this.tools.set(name, tool);
        
        // Add to category
        const category = tool.getCategory();
        if (!this.categories.has(category)) {
            this.categories.set(category, new Set());
        }
        this.categories.get(category).add(name);

        // Setup tool event forwarding
        tool.on('executionStart', (data) => this.emit('toolExecutionStart', data));
        tool.on('executionComplete', (data) => this.emit('toolExecutionComplete', data));
        tool.on('executionError', (data) => this.emit('toolExecutionError', data));
        tool.on('cacheHit', (data) => this.emit('toolCacheHit', data));

        logger.info('🍌 Tool registered', {
            name: tool.getName(),
            version: tool.getVersion(),
            category: tool.getCategory()
        });

        this.emit('toolRegistered', { name, tool });
    }

    unregister(name) {
        const tool = this.tools.get(name);
        if (!tool) {
            throw new Error(`Tool '${name}' not found`);
        }

        this.tools.delete(name);
        
        // Remove from category
        const category = tool.getCategory();
        if (this.categories.has(category)) {
            this.categories.get(category).delete(name);
            if (this.categories.get(category).size === 0) {
                this.categories.delete(category);
            }
        }

        // Remove all listeners
        tool.removeAllListeners();

        logger.info('🍌 Tool unregistered', { name });
        this.emit('toolUnregistered', { name, tool });
    }

    get(name) {
        return this.tools.get(name);
    }

    has(name) {
        return this.tools.has(name);
    }

    list() {
        return Array.from(this.tools.keys());
    }

    listByCategory(category) {
        return Array.from(this.categories.get(category) || []);
    }

    getCategories() {
        return Array.from(this.categories.keys());
    }

    async execute(toolName, input, context = {}) {
        const tool = this.tools.get(toolName);
        if (!tool) {
            throw new Error(`Tool '${toolName}' not found`);
        }

        return await tool.run(input, context);
    }

    getToolStatus(name) {
        const tool = this.tools.get(name);
        if (!tool) {
            return null;
        }
        return tool.getStatus();
    }

    getAllStatus() {
        const status = {};
        for (const [name, tool] of this.tools) {
            status[name] = tool.getStatus();
        }
        return status;
    }

    getMetrics() {
        const metrics = {
            totalTools: this.tools.size,
            categories: this.categories.size,
            toolsByCategory: {},
            totalExecutions: 0,
            averageSuccessRate: 0
        };

        for (const [category, toolNames] of this.categories) {
            metrics.toolsByCategory[category] = toolNames.size;
        }

        let totalSuccessRate = 0;
        for (const [_, tool] of this.tools) {
            const toolMetrics = tool.getMetrics();
            metrics.totalExecutions += toolMetrics.executionCount;
            totalSuccessRate += toolMetrics.successRate;
        }

        if (this.tools.size > 0) {
            metrics.averageSuccessRate = totalSuccessRate / this.tools.size;
        }

        return metrics;
    }
}

/**
 * Example tool implementation
 */
class ExampleBananaTool extends BananaMCPTool {
    constructor() {
        super({
            name: 'example-banana-tool',
            description: 'An example banana-powered tool',
            version: '1.0.0',
            category: 'example'
        });
    }

    defineInputSchema() {
        return Joi.object({
            message: Joi.string().required(),
            options: Joi.object({
                uppercase: Joi.boolean().default(false),
                reverse: Joi.boolean().default(false)
            }).default({})
        });
    }

    defineOutputSchema() {
        return Joi.object({
            success: Joi.boolean().required(),
            data: Joi.object({
                processed_message: Joi.string().required(),
                original_message: Joi.string().required(),
                transformations: Joi.array().items(Joi.string())
            }),
            error: Joi.string(),
            metadata: Joi.object().required()
        });
    }

    async execute(input, context) {
        const { message, options } = input;
        const transformations = [];
        let processedMessage = message;

        // Apply transformations
        if (options.uppercase) {
            processedMessage = processedMessage.toUpperCase();
            transformations.push('uppercase');
        }

        if (options.reverse) {
            processedMessage = processedMessage.split('').reverse().join('');
            transformations.push('reverse');
        }

        // Simulate some processing time
        await this.delay(100);

        return {
            success: true,
            data: {
                processed_message: processedMessage,
                original_message: message,
                transformations: transformations
            }
        };
    }
}

module.exports = {
    BananaMCPTool,
    BananaToolRegistry,
    ExampleBananaTool
};