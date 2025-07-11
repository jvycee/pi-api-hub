const logger = require('../shared/logger');
const { McpError, ErrorCode } = require('@modelcontextprotocol/sdk/types.js');

/**
 * 🍌 BANANA-POWERED MCP ERROR HANDLER & RETRY LOGIC 🍌
 * 
 * Intelligent error handling and retry mechanisms for MCP operations
 */
class MCPErrorHandler {
  constructor(options = {}) {
    this.options = {
      maxRetries: options.maxRetries || 3,
      baseDelay: options.baseDelay || 1000,
      maxDelay: options.maxDelay || 10000,
      exponentialBackoff: options.exponentialBackoff !== false,
      circuitBreakerThreshold: options.circuitBreakerThreshold || 5,
      circuitBreakerTimeout: options.circuitBreakerTimeout || 60000,
      ...options
    };

    this.circuitBreakers = new Map();
    this.retryStats = new Map();
    this.errorPatterns = new Map();
    this.healthChecks = new Map();
    
    logger.info('🍌 MCP Error Handler initialized', {
      maxRetries: this.options.maxRetries,
      baseDelay: this.options.baseDelay,
      exponentialBackoff: this.options.exponentialBackoff
    });
  }

  /**
   * Execute operation with retry logic
   */
  async executeWithRetry(operation, context = {}) {
    const operationId = context.operationId || this.generateOperationId();
    const startTime = Date.now();
    
    let lastError;
    let attempt = 0;

    while (attempt <= this.options.maxRetries) {
      try {
        // Check circuit breaker
        if (this.isCircuitBreakerOpen(context.service)) {
          throw new McpError(
            ErrorCode.InternalError,
            `Circuit breaker is open for service: ${context.service}`
          );
        }

        // Execute operation
        const result = await operation();
        
        // Record success
        this.recordSuccess(context, attempt, Date.now() - startTime);
        
        return result;
        
      } catch (error) {
        lastError = error;
        attempt++;
        
        // Record failure
        this.recordFailure(context, error, attempt);
        
        // Check if error is retryable
        if (!this.isRetryableError(error) || attempt > this.options.maxRetries) {
          break;
        }
        
        // Calculate delay
        const delay = this.calculateDelay(attempt, context);
        
        logger.warn(`🍌 MCP operation failed, retrying in ${delay}ms`, {
          operationId,
          attempt,
          error: error.message,
          service: context.service,
          tool: context.tool
        });
        
        // Wait before retry
        await this.delay(delay);
      }
    }

    // All retries exhausted
    this.recordExhaustedRetries(context, lastError);
    
    throw new McpError(
      ErrorCode.InternalError,
      `Operation failed after ${this.options.maxRetries} retries: ${lastError.message}`,
      lastError
    );
  }

  /**
   * Check if error is retryable
   */
  isRetryableError(error) {
    // Network errors are retryable
    if (error.code === 'ECONNRESET' || 
        error.code === 'ECONNREFUSED' || 
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND') {
      return true;
    }

    // HTTP status codes that are retryable
    if (error.response?.status) {
      const status = error.response.status;
      return status >= 500 || status === 429 || status === 408;
    }

    // MCP specific errors
    if (error instanceof McpError) {
      return error.code === ErrorCode.InternalError;
    }

    // Rate limiting errors
    if (error.message?.includes('rate limit') || 
        error.message?.includes('too many requests')) {
      return true;
    }

    // Timeout errors
    if (error.message?.includes('timeout')) {
      return true;
    }

    return false;
  }

  /**
   * Calculate retry delay
   */
  calculateDelay(attempt, context) {
    let delay = this.options.baseDelay;

    if (this.options.exponentialBackoff) {
      delay = Math.min(
        this.options.baseDelay * Math.pow(2, attempt - 1),
        this.options.maxDelay
      );
    }

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay;
    delay += jitter;

    // Special handling for rate limit errors
    if (context.rateLimitReset) {
      const resetTime = new Date(context.rateLimitReset).getTime();
      const now = Date.now();
      if (resetTime > now) {
        delay = Math.max(delay, resetTime - now);
      }
    }

    return Math.floor(delay);
  }

  /**
   * Circuit breaker implementation
   */
  isCircuitBreakerOpen(service) {
    if (!service) return false;

    const breaker = this.circuitBreakers.get(service);
    if (!breaker) return false;

    const now = Date.now();

    // Check if circuit breaker should be reset
    if (breaker.state === 'open' && 
        now - breaker.lastFailureTime > this.options.circuitBreakerTimeout) {
      breaker.state = 'half-open';
      breaker.consecutiveFailures = 0;
      logger.info(`🍌 Circuit breaker half-open for service: ${service}`);
    }

    return breaker.state === 'open';
  }

  /**
   * Record operation success
   */
  recordSuccess(context, attempt, executionTime) {
    const { service, tool } = context;
    
    // Update circuit breaker
    if (service) {
      const breaker = this.circuitBreakers.get(service);
      if (breaker) {
        breaker.consecutiveFailures = 0;
        if (breaker.state === 'half-open') {
          breaker.state = 'closed';
          logger.info(`🍌 Circuit breaker closed for service: ${service}`);
        }
      }
    }

    // Update retry stats
    const statsKey = `${service}:${tool}`;
    if (!this.retryStats.has(statsKey)) {
      this.retryStats.set(statsKey, {
        totalAttempts: 0,
        successfulAttempts: 0,
        failedAttempts: 0,
        averageRetries: 0,
        averageExecutionTime: 0
      });
    }

    const stats = this.retryStats.get(statsKey);
    stats.totalAttempts++;
    stats.successfulAttempts++;
    stats.averageRetries = ((stats.averageRetries * (stats.totalAttempts - 1)) + attempt) / stats.totalAttempts;
    stats.averageExecutionTime = ((stats.averageExecutionTime * (stats.totalAttempts - 1)) + executionTime) / stats.totalAttempts;

    // Log success if retries were needed
    if (attempt > 1) {
      logger.info(`🍌 MCP operation succeeded after ${attempt} attempts`, {
        service,
        tool,
        executionTime,
        attempt
      });
    }
  }

  /**
   * Record operation failure
   */
  recordFailure(context, error, attempt) {
    const { service, tool } = context;
    
    // Update circuit breaker
    if (service) {
      if (!this.circuitBreakers.has(service)) {
        this.circuitBreakers.set(service, {
          state: 'closed',
          consecutiveFailures: 0,
          lastFailureTime: Date.now()
        });
      }

      const breaker = this.circuitBreakers.get(service);
      breaker.consecutiveFailures++;
      breaker.lastFailureTime = Date.now();

      // Open circuit breaker if threshold reached
      if (breaker.consecutiveFailures >= this.options.circuitBreakerThreshold) {
        breaker.state = 'open';
        logger.error(`🍌 Circuit breaker opened for service: ${service}`, {
          consecutiveFailures: breaker.consecutiveFailures,
          threshold: this.options.circuitBreakerThreshold
        });
      }
    }

    // Track error patterns
    const errorKey = `${error.name}:${error.message}`;
    if (!this.errorPatterns.has(errorKey)) {
      this.errorPatterns.set(errorKey, {
        count: 0,
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        services: new Set(),
        tools: new Set()
      });
    }

    const pattern = this.errorPatterns.get(errorKey);
    pattern.count++;
    pattern.lastSeen = Date.now();
    pattern.services.add(service);
    pattern.tools.add(tool);

    // Log error with context
    logger.error(`🍌 MCP operation failed (attempt ${attempt})`, {
      service,
      tool,
      error: error.message,
      errorCode: error.code,
      retryable: this.isRetryableError(error)
    });
  }

  /**
   * Record exhausted retries
   */
  recordExhaustedRetries(context, error) {
    const { service, tool } = context;
    const statsKey = `${service}:${tool}`;
    
    if (!this.retryStats.has(statsKey)) {
      this.retryStats.set(statsKey, {
        totalAttempts: 0,
        successfulAttempts: 0,
        failedAttempts: 0,
        averageRetries: 0,
        averageExecutionTime: 0
      });
    }

    const stats = this.retryStats.get(statsKey);
    stats.totalAttempts++;
    stats.failedAttempts++;

    logger.error(`🍌 MCP operation failed after all retries exhausted`, {
      service,
      tool,
      maxRetries: this.options.maxRetries,
      error: error.message
    });
  }

  /**
   * Health check with retry
   */
  async healthCheck(service, healthCheckFn) {
    const context = {
      service,
      tool: 'health-check',
      operationId: `health-${service}-${Date.now()}`
    };

    try {
      const result = await this.executeWithRetry(healthCheckFn, context);
      
      this.healthChecks.set(service, {
        status: 'healthy',
        lastCheck: Date.now(),
        consecutiveFailures: 0
      });

      return result;
    } catch (error) {
      if (!this.healthChecks.has(service)) {
        this.healthChecks.set(service, {
          status: 'unhealthy',
          lastCheck: Date.now(),
          consecutiveFailures: 0
        });
      }

      const healthCheck = this.healthChecks.get(service);
      healthCheck.status = 'unhealthy';
      healthCheck.lastCheck = Date.now();
      healthCheck.consecutiveFailures++;

      throw error;
    }
  }

  /**
   * Graceful degradation
   */
  async executeWithFallback(primaryOperation, fallbackOperation, context = {}) {
    try {
      return await this.executeWithRetry(primaryOperation, {
        ...context,
        service: context.primaryService
      });
    } catch (primaryError) {
      logger.warn(`🍌 Primary operation failed, attempting fallback`, {
        primaryService: context.primaryService,
        fallbackService: context.fallbackService,
        error: primaryError.message
      });

      try {
        return await this.executeWithRetry(fallbackOperation, {
          ...context,
          service: context.fallbackService
        });
      } catch (fallbackError) {
        logger.error(`🍌 Both primary and fallback operations failed`, {
          primaryError: primaryError.message,
          fallbackError: fallbackError.message
        });

        throw new McpError(
          ErrorCode.InternalError,
          `Both primary and fallback operations failed: ${primaryError.message}, ${fallbackError.message}`
        );
      }
    }
  }

  /**
   * Bulkhead pattern for resource isolation
   */
  async executeWithBulkhead(operation, context = {}) {
    const bulkheadKey = context.bulkhead || 'default';
    
    // Simple bulkhead implementation - limit concurrent operations
    if (!this.bulkheads) {
      this.bulkheads = new Map();
    }

    if (!this.bulkheads.has(bulkheadKey)) {
      this.bulkheads.set(bulkheadKey, {
        currentExecutions: 0,
        maxExecutions: context.maxConcurrent || 10,
        queue: []
      });
    }

    const bulkhead = this.bulkheads.get(bulkheadKey);

    if (bulkhead.currentExecutions >= bulkhead.maxExecutions) {
      throw new McpError(
        ErrorCode.InternalError,
        `Bulkhead limit exceeded for ${bulkheadKey}`
      );
    }

    bulkhead.currentExecutions++;
    
    try {
      return await this.executeWithRetry(operation, context);
    } finally {
      bulkhead.currentExecutions--;
    }
  }

  /**
   * Timeout wrapper
   */
  async executeWithTimeout(operation, timeout, context = {}) {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new McpError(
          ErrorCode.InternalError,
          `Operation timed out after ${timeout}ms`
        ));
      }, timeout);
    });

    try {
      return await Promise.race([
        this.executeWithRetry(operation, context),
        timeoutPromise
      ]);
    } catch (error) {
      if (error.message.includes('timed out')) {
        this.recordFailure(context, error, 1);
      }
      throw error;
    }
  }

  /**
   * Generate operation ID
   */
  generateOperationId() {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get error handling statistics
   */
  getStats() {
    const stats = {
      retryStats: {},
      circuitBreakers: {},
      errorPatterns: {},
      healthChecks: {}
    };

    // Convert retry stats
    for (const [key, stat] of this.retryStats) {
      stats.retryStats[key] = {
        ...stat,
        successRate: stat.totalAttempts > 0 ? (stat.successfulAttempts / stat.totalAttempts) * 100 : 0
      };
    }

    // Convert circuit breaker stats
    for (const [service, breaker] of this.circuitBreakers) {
      stats.circuitBreakers[service] = {
        ...breaker,
        timeSinceLastFailure: Date.now() - breaker.lastFailureTime
      };
    }

    // Convert error patterns
    for (const [errorKey, pattern] of this.errorPatterns) {
      stats.errorPatterns[errorKey] = {
        ...pattern,
        services: Array.from(pattern.services),
        tools: Array.from(pattern.tools),
        frequency: pattern.count / ((Date.now() - pattern.firstSeen) / 3600000) // per hour
      };
    }

    // Convert health checks
    for (const [service, health] of this.healthChecks) {
      stats.healthChecks[service] = {
        ...health,
        timeSinceLastCheck: Date.now() - health.lastCheck
      };
    }

    return stats;
  }

  /**
   * Get health status
   */
  getHealthStatus() {
    const status = {
      overall: 'healthy',
      services: {},
      issues: []
    };

    // Check circuit breakers
    for (const [service, breaker] of this.circuitBreakers) {
      if (breaker.state === 'open') {
        status.overall = 'degraded';
        status.issues.push(`Circuit breaker open for ${service}`);
      }
      
      status.services[service] = {
        circuitBreakerState: breaker.state,
        consecutiveFailures: breaker.consecutiveFailures
      };
    }

    // Check health checks
    for (const [service, health] of this.healthChecks) {
      if (health.status === 'unhealthy') {
        status.overall = 'unhealthy';
        status.issues.push(`Service ${service} is unhealthy`);
      }
      
      if (!status.services[service]) {
        status.services[service] = {};
      }
      status.services[service].healthStatus = health.status;
    }

    return status;
  }

  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker(service) {
    if (this.circuitBreakers.has(service)) {
      this.circuitBreakers.get(service).state = 'closed';
      this.circuitBreakers.get(service).consecutiveFailures = 0;
      logger.info(`🍌 Circuit breaker manually reset for service: ${service}`);
    }
  }

  /**
   * Clear error patterns
   */
  clearErrorPatterns() {
    this.errorPatterns.clear();
    logger.info('🍌 Error patterns cleared');
  }
}

module.exports = MCPErrorHandler;