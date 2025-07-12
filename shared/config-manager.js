const Joi = require('joi');
const logger = require('./logger');

/**
 * 🍌 BANANA-POWERED CONFIGURATION MANAGER 🍌
 * 
 * Centralized, type-safe configuration management with validation
 * and environment-specific overrides
 */

class ConfigManager {
    constructor() {
        this.config = {};
        this.schema = this.defineConfigSchema();
        this.requiredEnvVars = [
            'HUBSPOT_PRIVATE_APP_TOKEN',
            'BANANA_ADMIN_KEY'
        ];
        this.isValidated = false;
        
        this.loadConfiguration();
    }

    defineConfigSchema() {
        return Joi.object({
            server: Joi.object({
                port: Joi.number().integer().min(1).max(65535).default(3000),
                host: Joi.string().default('0.0.0.0'),
                env: Joi.string().valid('development', 'staging', 'production').default('development'),
                corsOrigins: Joi.array().items(Joi.string()).default(['http://localhost:3000'])
            }).required(),

            security: Joi.object({
                corsOrigins: Joi.array().items(Joi.string()),
                rateLimiting: Joi.object({
                    windowMs: Joi.number().default(900000), // 15 minutes
                    max: Joi.number().default(100),
                    standardHeaders: Joi.boolean().default(true),
                    legacyHeaders: Joi.boolean().default(false)
                }).default(),
                csrf: Joi.object({
                    enabled: Joi.boolean().default(true),
                    cookieOptions: Joi.object({
                        httpOnly: Joi.boolean().default(true),
                        secure: Joi.boolean().default(false),
                        sameSite: Joi.string().valid('strict', 'lax', 'none').default('lax')
                    }).default()
                }).default(),
                headers: Joi.object({
                    contentSecurityPolicy: Joi.string().default("default-src 'self'"),
                    strictTransportSecurity: Joi.string().default('max-age=31536000; includeSubDomains'),
                    xFrameOptions: Joi.string().default('DENY'),
                    xContentTypeOptions: Joi.string().default('nosniff')
                }).default()
            }).default(),

            hubspot: Joi.object({
                privateAppToken: Joi.string().allow('').default(''),
                baseUrl: Joi.string().default('https://api.hubapi.com'),
                timeout: Joi.number().default(30000),
                retries: Joi.number().default(3),
                rateLimit: Joi.object({
                    daily: Joi.number().default(40000),
                    burst: Joi.number().default(100)
                }).default()
            }).default(),

            anthropic: Joi.object({
                apiKey: Joi.string(),
                baseUrl: Joi.string().default('https://api.anthropic.com'),
                timeout: Joi.number().default(60000),
                maxTokens: Joi.number().default(4096)
            }),

            ollama: Joi.object({
                baseUrl: Joi.string().default('http://localhost:11434'),
                timeout: Joi.number().default(30000),
                models: Joi.object({
                    primary: Joi.string().default('llama3.2:latest'),
                    fallback: Joi.string().default('llama3.2:latest')
                }).default()
            }).default(),

            cache: Joi.object({
                provider: Joi.string().valid('memory', 'redis').default('memory'),
                redis: Joi.object({
                    host: Joi.string().default('localhost'),
                    port: Joi.number().default(6379),
                    password: Joi.string().allow(''),
                    db: Joi.number().default(0),
                    keyPrefix: Joi.string().default('banana:'),
                    ttl: Joi.number().default(300000) // 5 minutes
                }).default(),
                memory: Joi.object({
                    maxSize: Joi.number().default(100), // 100MB
                    ttl: Joi.number().default(300000)
                }).default()
            }).default(),

            monitoring: Joi.object({
                enabled: Joi.boolean().default(true),
                metricsInterval: Joi.number().default(30000),
                healthCheck: Joi.object({
                    enabled: Joi.boolean().default(true),
                    interval: Joi.number().default(30000),
                    timeout: Joi.number().default(5000)
                }).default(),
                logging: Joi.object({
                    level: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
                    maxFiles: Joi.number().default(5),
                    maxSize: Joi.string().default('10m'),
                    format: Joi.string().valid('json', 'simple').default('json')
                }).default()
            }).default(),

            cluster: Joi.object({
                enabled: Joi.boolean().default(true),
                workers: Joi.object({
                    min: Joi.number().default(1),
                    max: Joi.number().default(4),
                    target: Joi.number().optional(),
                    scaling: Joi.object({
                        enabled: Joi.boolean().default(true),
                        scaleUpThreshold: Joi.number().default(0.8),
                        scaleDownThreshold: Joi.number().default(0.3),
                        cooldown: Joi.number().default(30000)
                    }).default()
                }).default()
            }).default(),

            mcp: Joi.object({
                mode: Joi.string().valid('hybrid', 'official', 'banana').default('hybrid'),
                server: Joi.object({
                    name: Joi.string().default('hubspot-banana-hybrid'),
                    version: Joi.string().default('1.0.0'),
                    description: Joi.string().default('Hybrid MCP server with banana optimizations')
                }).default(),
                tools: Joi.object({
                    official: Joi.object({
                        enabled: Joi.boolean().default(true),
                        timeout: Joi.number().default(30000)
                    }).default(),
                    banana: Joi.object({
                        enabled: Joi.boolean().default(true),
                        caching: Joi.boolean().default(true),
                        streaming: Joi.boolean().default(true)
                    }).default()
                }).default()
            }).default(),

            streaming: Joi.object({
                enabled: Joi.boolean().default(true),
                port: Joi.number().default(3001),
                path: Joi.string().default('/stream'),
                maxConnections: Joi.number().default(1000),
                heartbeatInterval: Joi.number().default(30000),
                compression: Joi.boolean().default(true)
            }).default(),

            cluster: Joi.object({
                enabled: Joi.boolean().default(true),
                workers: Joi.object({
                    min: Joi.number().default(1),
                    max: Joi.number().default(6),
                    target: Joi.number(), // Auto-calculated if not provided
                    scaling: Joi.object({
                        enabled: Joi.boolean().default(true),
                        scaleUpThreshold: Joi.number().default(0.75),
                        scaleDownThreshold: Joi.number().default(0.35),
                        cooldown: Joi.number().default(60000)
                    }).default()
                }).default()
            }).default()
        });
    }

    loadConfiguration() {
        try {
            // Load base configuration
            this.config = this.loadBaseConfig();
            
            // Apply environment-specific overrides
            this.applyEnvironmentOverrides();
            
            // Load from environment variables
            this.loadFromEnvironment();
            
            logger.info('🍌 Configuration loaded successfully');
        } catch (error) {
            logger.error('Failed to load configuration:', error);
            throw error;
        }
    }

    loadBaseConfig() {
        const baseConfig = {
            server: {
                port: parseInt(process.env.PORT || process.env.BANANA_SERVER_PORT || '3000'),
                host: process.env.HOST || '0.0.0.0',
                env: process.env.NODE_ENV || 'development'
            },
            hubspot: {
                privateAppToken: process.env.HUBSPOT_PRIVATE_APP_TOKEN || process.env.PRIVATE_APP_ACCESS_TOKEN
            },
            anthropic: {
                apiKey: process.env.ANTHROPIC_API_KEY
            }
        };

        return baseConfig;
    }

    applyEnvironmentOverrides() {
        const env = this.config.server.env;
        
        switch (env) {
            case 'production':
                this.config.security = {
                    ...this.config.security,
                    csrf: { enabled: true },
                    headers: { 
                        strictTransportSecurity: 'max-age=31536000; includeSubDomains; preload' 
                    }
                };
                this.config.monitoring = {
                    ...this.config.monitoring,
                    logging: { level: 'warn' }
                };
                break;
                
            case 'development':
                this.config.security = {
                    ...this.config.security,
                    csrf: { enabled: false }
                };
                this.config.monitoring = {
                    ...this.config.monitoring,
                    logging: { level: 'debug' }
                };
                break;
                
            case 'staging':
                this.config.monitoring = {
                    ...this.config.monitoring,
                    logging: { level: 'info' }
                };
                break;
        }
    }

    loadFromEnvironment() {
        // Cache configuration
        if (process.env.REDIS_URL) {
            const redisUrl = new URL(process.env.REDIS_URL);
            this.config.cache = {
                provider: 'redis',
                redis: {
                    host: redisUrl.hostname,
                    port: parseInt(redisUrl.port) || 6379,
                    password: redisUrl.password || '',
                    db: 0
                }
            };
        }

        // Streaming configuration
        if (process.env.STREAMING_PORT) {
            this.config.streaming = {
                ...this.config.streaming,
                port: parseInt(process.env.STREAMING_PORT)
            };
        }

        // MCP configuration
        if (process.env.MCP_MODE) {
            this.config.mcp = {
                ...this.config.mcp,
                mode: process.env.MCP_MODE
            };
        }

        // Cluster configuration
        if (process.env.CLUSTER_WORKERS) {
            this.config.cluster = {
                ...this.config.cluster,
                workers: {
                    ...this.config.cluster.workers,
                    target: parseInt(process.env.CLUSTER_WORKERS)
                }
            };
        }

        // Security overrides
        if (process.env.CORS_ORIGINS) {
            this.config.security = {
                ...this.config.security,
                corsOrigins: process.env.CORS_ORIGINS.split(',')
            };
        }
    }

    validateConfiguration() {
        try {
            // Validate required environment variables
            this.validateRequiredEnvVars();
            
            // Validate configuration schema
            const { error, value } = this.schema.validate(this.config, {
                abortEarly: false,
                allowUnknown: false,
                stripUnknown: true
            });

            if (error) {
                const errorMessages = error.details.map(detail => detail.message).join(', ');
                throw new Error(`Configuration validation failed: ${errorMessages}`);
            }

            this.config = value;
            this.isValidated = true;
            
            logger.info('🍌 Configuration validation successful', {
                environment: this.config.server.env,
                port: this.config.server.port,
                mcpMode: this.config.mcp.mode,
                cacheProvider: this.config.cache.provider
            });

            return true;
        } catch (error) {
            logger.error('Configuration validation failed:', error);
            throw error;
        }
    }

    validateRequiredEnvVars() {
        const missing = [];
        
        for (const envVar of this.requiredEnvVars) {
            if (!process.env[envVar]) {
                missing.push(envVar);
            }
        }

        if (missing.length > 0) {
            // In production, warn but don't fail if HubSpot integration isn't needed
            if (this.getEnvironment() === 'production') {
                logger.warn(`⚠️  Missing environment variables (HubSpot features will be disabled): ${missing.join(', ')}`);
                logger.warn('💡 To enable HubSpot integration, set: HUBSPOT_PRIVATE_APP_TOKEN and BANANA_ADMIN_KEY');
                return; // Don't throw error in production
            }
            
            throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
        }
    }

    get(path, defaultValue = undefined) {
        if (!this.isValidated) {
            logger.warn('Accessing configuration before validation');
        }

        const keys = path.split('.');
        let current = this.config;

        for (const key of keys) {
            if (current && typeof current === 'object' && key in current) {
                current = current[key];
            } else {
                return defaultValue;
            }
        }

        return current !== undefined ? current : defaultValue;
    }

    set(path, value) {
        const keys = path.split('.');
        let current = this.config;

        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!(key in current) || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }

        current[keys[keys.length - 1]] = value;
        
        // Mark as needing re-validation
        this.isValidated = false;
        
        logger.debug(`Configuration updated: ${path} = ${JSON.stringify(value)}`);
    }

    getAll() {
        return { ...this.config };
    }

    getEnvironment() {
        return this.get('server.env');
    }

    isProduction() {
        return this.getEnvironment() === 'production';
    }

    isDevelopment() {
        return this.getEnvironment() === 'development';
    }

    isStaging() {
        return this.getEnvironment() === 'staging';
    }

    // Specific config getters for common patterns
    getServerConfig() {
        return this.get('server');
    }

    getSecurityConfig() {
        return this.get('security');
    }

    getHubSpotConfig() {
        return this.get('hubspot');
    }

    getMCPConfig() {
        return this.get('mcp');
    }

    getCacheConfig() {
        return this.get('cache');
    }

    getStreamingConfig() {
        return this.get('streaming');
    }

    getClusterConfig() {
        return this.get('cluster');
    }

    getMonitoringConfig() {
        return this.get('monitoring');
    }

    // Configuration for external services
    getHubSpotApiConfig() {
        return {
            token: this.get('hubspot.privateAppToken'),
            baseUrl: this.get('hubspot.baseUrl'),
            timeout: this.get('hubspot.timeout'),
            retries: this.get('hubspot.retries')
        };
    }

    getAnthropicApiConfig() {
        return {
            apiKey: this.get('anthropic.apiKey'),
            baseUrl: this.get('anthropic.baseUrl'),
            timeout: this.get('anthropic.timeout'),
            maxTokens: this.get('anthropic.maxTokens')
        };
    }

    getOllamaConfig() {
        return {
            baseUrl: this.get('ollama.baseUrl'),
            timeout: this.get('ollama.timeout'),
            models: this.get('ollama.models')
        };
    }

    // Health check
    healthCheck() {
        return {
            status: this.isValidated ? 'healthy' : 'unhealthy',
            environment: this.getEnvironment(),
            configLoaded: Object.keys(this.config).length > 0,
            validated: this.isValidated,
            requiredEnvVars: this.requiredEnvVars.map(envVar => ({
                name: envVar,
                present: !!process.env[envVar]
            }))
        };
    }

    // Generate configuration report
    generateReport() {
        const sanitized = JSON.parse(JSON.stringify(this.config));
        
        // Sanitize sensitive information
        if (sanitized.hubspot?.privateAppToken) {
            sanitized.hubspot.privateAppToken = '***REDACTED***';
        }
        if (sanitized.anthropic?.apiKey) {
            sanitized.anthropic.apiKey = '***REDACTED***';
        }
        if (sanitized.cache?.redis?.password) {
            sanitized.cache.redis.password = '***REDACTED***';
        }

        return {
            environment: this.getEnvironment(),
            validated: this.isValidated,
            configuration: sanitized,
            health: this.healthCheck()
        };
    }

    // Reload configuration (useful for hot reloading)
    reload() {
        logger.info('🍌 Reloading configuration...');
        this.config = {};
        this.isValidated = false;
        this.loadConfiguration();
        this.validateConfiguration();
        logger.info('🍌 Configuration reloaded successfully');
    }
}

// Singleton instance
let configManagerInstance = null;

function getConfigManager() {
    if (!configManagerInstance) {
        configManagerInstance = new ConfigManager();
    }
    return configManagerInstance;
}

module.exports = {
    ConfigManager,
    getConfigManager
};