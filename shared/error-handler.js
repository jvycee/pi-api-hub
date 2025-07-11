const logger = require('./logger');

/**
 * 🍌 BANANA-POWERED CENTRALIZED ERROR HANDLER 🍌
 * 
 * Standardized error handling with consistent response patterns,
 * error classification, and automatic recovery strategies
 */

// Error classifications
const ErrorTypes = {
    VALIDATION: 'validation',
    AUTHENTICATION: 'authentication',
    AUTHORIZATION: 'authorization',
    NOT_FOUND: 'not_found',
    RATE_LIMIT: 'rate_limit',
    API_ERROR: 'api_error',
    NETWORK: 'network',
    TIMEOUT: 'timeout',
    INTERNAL: 'internal',
    EXTERNAL_SERVICE: 'external_service',
    CONFIGURATION: 'configuration',
    SECURITY: 'security'
};

// HTTP status code mappings
const StatusCodes = {
    [ErrorTypes.VALIDATION]: 400,
    [ErrorTypes.AUTHENTICATION]: 401,
    [ErrorTypes.AUTHORIZATION]: 403,
    [ErrorTypes.NOT_FOUND]: 404,
    [ErrorTypes.RATE_LIMIT]: 429,
    [ErrorTypes.API_ERROR]: 400,
    [ErrorTypes.NETWORK]: 503,
    [ErrorTypes.TIMEOUT]: 504,
    [ErrorTypes.INTERNAL]: 500,
    [ErrorTypes.EXTERNAL_SERVICE]: 502,
    [ErrorTypes.CONFIGURATION]: 500,
    [ErrorTypes.SECURITY]: 403
};

// Retryable error types
const RetryableErrors = new Set([
    ErrorTypes.NETWORK,
    ErrorTypes.TIMEOUT,
    ErrorTypes.RATE_LIMIT,
    ErrorTypes.EXTERNAL_SERVICE
]);

class BananaError extends Error {
    constructor({
        type = ErrorTypes.INTERNAL,
        message,
        code,
        statusCode,
        details = {},
        cause,
        retryable = false,
        context = {}
    }) {
        super(message);
        this.name = 'BananaError';
        this.type = type;
        this.code = code;
        this.statusCode = statusCode || StatusCodes[type] || 500;
        this.details = details;
        this.cause = cause;
        this.retryable = retryable || RetryableErrors.has(type);
        this.context = context;
        this.timestamp = new Date().toISOString();
        this.errorId = this.generateErrorId();
        
        // Preserve stack trace
        Error.captureStackTrace(this, BananaError);
    }
    
    generateErrorId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return `ERR_${timestamp}_${random}`.toUpperCase();
    }
    
    toJSON() {
        return {
            name: this.name,
            type: this.type,
            code: this.code,
            message: this.message,
            statusCode: this.statusCode,
            details: this.details,
            retryable: this.retryable,
            context: this.context,
            timestamp: this.timestamp,
            errorId: this.errorId,
            stack: this.stack
        };
    }
    
    toClientJSON() {
        // Safe version for client responses (no stack trace)
        return {
            success: false,
            error: {
                type: this.type,
                code: this.code,
                message: this.message,
                details: this.details,
                retryable: this.retryable,
                errorId: this.errorId,
                timestamp: this.timestamp
            }
        };
    }
}

class ErrorHandler {
    constructor() {
        this.errorStats = {
            total: 0,
            byType: {},
            byCode: {},
            retryableCount: 0,
            lastError: null
        };
        
        this.retryStrategies = new Map();
        this.setupDefaultRetryStrategies();
    }
    
    setupDefaultRetryStrategies() {
        // Rate limit retry strategy
        this.retryStrategies.set(ErrorTypes.RATE_LIMIT, {
            maxAttempts: 3,
            baseDelay: 1000,
            backoffMultiplier: 2,
            jitter: true
        });
        
        // Network error retry strategy
        this.retryStrategies.set(ErrorTypes.NETWORK, {
            maxAttempts: 5,
            baseDelay: 500,
            backoffMultiplier: 1.5,
            jitter: true
        });
        
        // Timeout retry strategy
        this.retryStrategies.set(ErrorTypes.TIMEOUT, {
            maxAttempts: 3,
            baseDelay: 2000,
            backoffMultiplier: 2,
            jitter: false
        });
        
        // External service retry strategy
        this.retryStrategies.set(ErrorTypes.EXTERNAL_SERVICE, {
            maxAttempts: 4,
            baseDelay: 1000,
            backoffMultiplier: 2,
            jitter: true
        });
    }
    
    /**
     * Create a standardized error
     */
    createError({
        type = ErrorTypes.INTERNAL,
        message = 'An error occurred',
        code,
        statusCode,
        details = {},
        cause,
        context = {}
    }) {
        const error = new BananaError({
            type,
            message,
            code,
            statusCode,
            details,
            cause,
            context
        });
        
        this.recordError(error);
        return error;
    }
    
    /**
     * Classify and wrap existing errors
     */
    wrapError(originalError, context = {}) {
        // If already a BananaError, just add context
        if (originalError instanceof BananaError) {
            originalError.context = { ...originalError.context, ...context };
            return originalError;
        }
        
        // Classify the error
        const classification = this.classifyError(originalError);
        
        const error = new BananaError({
            type: classification.type,
            message: classification.message || originalError.message,
            code: classification.code,
            statusCode: classification.statusCode,
            details: classification.details,
            cause: originalError,
            context
        });
        
        this.recordError(error);
        return error;
    }
    
    /**
     * Classify unknown errors into our error types
     */
    classifyError(error) {
        const message = error.message?.toLowerCase() || '';
        const code = error.code || error.status;
        
        // Network errors
        if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || 
            error.code === 'ECONNREFUSED' || message.includes('network')) {
            return {
                type: ErrorTypes.NETWORK,
                code: 'NETWORK_ERROR',
                message: 'Network connection failed'
            };
        }
        
        // Timeout errors
        if (error.code === 'ETIMEDOUT' || message.includes('timeout') || 
            message.includes('timed out')) {
            return {
                type: ErrorTypes.TIMEOUT,
                code: 'TIMEOUT_ERROR',
                message: 'Request timed out'
            };
        }
        
        // Rate limit errors
        if (code === 429 || message.includes('rate limit') || 
            message.includes('too many requests')) {
            return {
                type: ErrorTypes.RATE_LIMIT,
                code: 'RATE_LIMIT_EXCEEDED',
                statusCode: 429,
                message: 'Rate limit exceeded'
            };
        }
        
        // Authentication errors
        if (code === 401 || message.includes('unauthorized') || 
            message.includes('authentication') || message.includes('invalid token')) {
            return {
                type: ErrorTypes.AUTHENTICATION,
                code: 'AUTH_ERROR',
                statusCode: 401,
                message: 'Authentication failed'
            };
        }
        
        // Authorization errors
        if (code === 403 || message.includes('forbidden') || 
            message.includes('permission') || message.includes('access denied')) {
            return {
                type: ErrorTypes.AUTHORIZATION,
                code: 'AUTHORIZATION_ERROR',
                statusCode: 403,
                message: 'Access denied'
            };
        }
        
        // Not found errors
        if (code === 404 || message.includes('not found')) {
            return {
                type: ErrorTypes.NOT_FOUND,
                code: 'NOT_FOUND',
                statusCode: 404,
                message: 'Resource not found'
            };
        }
        
        // Validation errors
        if (code === 400 || message.includes('validation') || 
            message.includes('invalid') || message.includes('bad request')) {
            return {
                type: ErrorTypes.VALIDATION,
                code: 'VALIDATION_ERROR',
                statusCode: 400,
                message: 'Invalid input data'
            };
        }
        
        // External service errors (5xx from external APIs)
        if (code >= 500 && code < 600) {
            return {
                type: ErrorTypes.EXTERNAL_SERVICE,
                code: 'EXTERNAL_SERVICE_ERROR',
                statusCode: 502,
                message: 'External service unavailable'
            };
        }
        
        // Default to internal error
        return {
            type: ErrorTypes.INTERNAL,
            code: 'INTERNAL_ERROR',
            statusCode: 500,
            message: error.message || 'Internal server error'
        };
    }
    
    /**
     * Record error statistics
     */
    recordError(error) {
        this.errorStats.total++;
        this.errorStats.byType[error.type] = (this.errorStats.byType[error.type] || 0) + 1;
        this.errorStats.byCode[error.code] = (this.errorStats.byCode[error.code] || 0) + 1;
        
        if (error.retryable) {
            this.errorStats.retryableCount++;
        }
        
        this.errorStats.lastError = {
            type: error.type,
            code: error.code,
            message: error.message,
            timestamp: error.timestamp
        };
        
        // Log the error
        this.logError(error);
    }
    
    /**
     * Log error with appropriate level
     */
    logError(error) {
        const logData = {
            errorId: error.errorId,
            type: error.type,
            code: error.code,
            message: error.message,
            statusCode: error.statusCode,
            retryable: error.retryable,
            context: error.context
        };
        
        // Log level based on error type
        switch (error.type) {
            case ErrorTypes.VALIDATION:
            case ErrorTypes.NOT_FOUND:
                logger.warn('Validation/NotFound error:', logData);
                break;
                
            case ErrorTypes.AUTHENTICATION:
            case ErrorTypes.AUTHORIZATION:
            case ErrorTypes.SECURITY:
                logger.warn('Security error:', logData);
                break;
                
            case ErrorTypes.RATE_LIMIT:
            case ErrorTypes.NETWORK:
            case ErrorTypes.TIMEOUT:
                logger.info('Recoverable error:', logData);
                break;
                
            case ErrorTypes.EXTERNAL_SERVICE:
                logger.warn('External service error:', logData);
                break;
                
            case ErrorTypes.INTERNAL:
            case ErrorTypes.CONFIGURATION:
            default:
                logger.error('Internal error:', logData, error.stack);
                break;
        }
    }
    
    /**
     * Express middleware for handling errors
     */
    middleware() {
        return (error, req, res, next) => {
            const wrappedError = this.wrapError(error, {
                method: req.method,
                path: req.path,
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });
            
            // Send client-safe response
            res.status(wrappedError.statusCode).json(wrappedError.toClientJSON());
        };
    }
    
    /**
     * Async wrapper for route handlers
     */
    asyncWrapper(fn) {
        return async (req, res, next) => {
            try {
                await fn(req, res, next);
            } catch (error) {
                next(error);
            }
        };
    }
    
    /**
     * Get retry strategy for error type
     */
    getRetryStrategy(errorType) {
        return this.retryStrategies.get(errorType) || {
            maxAttempts: 1,
            baseDelay: 1000,
            backoffMultiplier: 1,
            jitter: false
        };
    }
    
    /**
     * Calculate retry delay
     */
    calculateRetryDelay(attempt, strategy) {
        const { baseDelay, backoffMultiplier, jitter } = strategy;
        let delay = baseDelay * Math.pow(backoffMultiplier, attempt - 1);
        
        if (jitter) {
            // Add ±25% jitter
            const jitterAmount = delay * 0.25;
            delay += (Math.random() - 0.5) * 2 * jitterAmount;
        }
        
        return Math.max(100, Math.floor(delay)); // Minimum 100ms
    }
    
    /**
     * Execute function with retry logic
     */
    async withRetry(fn, context = {}) {
        let lastError;
        
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                return await fn();
            } catch (error) {
                const wrappedError = this.wrapError(error, context);
                lastError = wrappedError;
                
                if (!wrappedError.retryable || attempt === 3) {
                    throw wrappedError;
                }
                
                const strategy = this.getRetryStrategy(wrappedError.type);
                if (attempt >= strategy.maxAttempts) {
                    throw wrappedError;
                }
                
                const delay = this.calculateRetryDelay(attempt, strategy);
                logger.info(`Retrying after ${delay}ms (attempt ${attempt}/${strategy.maxAttempts})`, {
                    errorType: wrappedError.type,
                    errorId: wrappedError.errorId
                });
                
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        throw lastError;
    }
    
    /**
     * Get error statistics
     */
    getStats() {
        return {
            ...this.errorStats,
            errorRate: this.errorStats.total > 0 ? 
                (this.errorStats.total / (this.errorStats.total + 1000)) * 100 : 0,
            retryableRate: this.errorStats.total > 0 ? 
                (this.errorStats.retryableCount / this.errorStats.total) * 100 : 0
        };
    }
    
    /**
     * Reset error statistics
     */
    resetStats() {
        this.errorStats = {
            total: 0,
            byType: {},
            byCode: {},
            retryableCount: 0,
            lastError: null
        };
    }
    
    /**
     * Health check
     */
    healthCheck() {
        const stats = this.getStats();
        const recentErrors = stats.total;
        
        return {
            status: recentErrors < 100 ? 'healthy' : recentErrors < 500 ? 'degraded' : 'unhealthy',
            totalErrors: stats.total,
            errorRate: `${stats.errorRate.toFixed(2)}%`,
            retryableRate: `${stats.retryableRate.toFixed(2)}%`,
            lastError: stats.lastError,
            topErrorTypes: Object.entries(stats.byType)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5)
                .map(([type, count]) => ({ type, count }))
        };
    }
}

// Singleton instance
let errorHandlerInstance = null;

function getErrorHandler() {
    if (!errorHandlerInstance) {
        errorHandlerInstance = new ErrorHandler();
    }
    return errorHandlerInstance;
}

// Convenience functions
function createError(config) {
    return getErrorHandler().createError(config);
}

function wrapError(error, context) {
    return getErrorHandler().wrapError(error, context);
}

function withRetry(fn, context) {
    return getErrorHandler().withRetry(fn, context);
}

module.exports = {
    ErrorHandler,
    BananaError,
    ErrorTypes,
    StatusCodes,
    getErrorHandler,
    createError,
    wrapError,
    withRetry
};
