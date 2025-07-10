const Joi = require('joi');
const logger = require('../shared/logger');

class InputValidationSchemas {
  constructor() {
    this.schemas = {
      // HubSpot API endpoints
      hubspotContact: Joi.object({
        email: Joi.string().email().required(),
        firstname: Joi.string().max(100).optional(),
        lastname: Joi.string().max(100).optional(),
        company: Joi.string().max(200).optional(),
        phone: Joi.string().max(20).optional(),
        website: Joi.string().uri().optional(),
        properties: Joi.object().optional()
      }),

      hubspotBatch: Joi.object({
        inputs: Joi.array().items(
          Joi.object({
            properties: Joi.object().required(),
            associations: Joi.array().optional()
          })
        ).min(1).max(100).required()
      }),

      hubspotGraphQL: Joi.object({
        query: Joi.string().required(),
        variables: Joi.object().optional(),
        operationName: Joi.string().optional()
      }),

      // Anthropic API endpoints
      anthropicMessage: Joi.object({
        model: Joi.string().valid('claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307').required(),
        max_tokens: Joi.number().integer().min(1).max(4096).required(),
        messages: Joi.array().items(
          Joi.object({
            role: Joi.string().valid('user', 'assistant').required(),
            content: Joi.string().required()
          })
        ).min(1).required(),
        system: Joi.string().optional(),
        temperature: Joi.number().min(0).max(1).optional(),
        stop_sequences: Joi.array().items(Joi.string()).max(4).optional()
      }),

      // Admin endpoints
      adminHealthCheck: Joi.object({
        detailed: Joi.boolean().default(false).optional(),
        components: Joi.array().items(Joi.string()).optional()
      }),

      adminLogRotation: Joi.object({
        force: Joi.boolean().default(false).optional(),
        compress: Joi.boolean().default(true).optional()
      }),

      adminCacheControl: Joi.object({
        action: Joi.string().valid('clear', 'prune', 'stats').required(),
        key: Joi.string().when('action', {
          is: 'clear',
          then: Joi.optional(),
          otherwise: Joi.forbidden()
        })
      }),

      // Monitoring endpoints
      monitoringQuery: Joi.object({
        type: Joi.string().valid('cpu', 'memory', 'network', 'disk', 'api').optional(),
        timeRange: Joi.string().valid('1h', '6h', '24h', '7d', '30d').default('1h').optional(),
        detailed: Joi.boolean().default(false).optional()
      }),

      // Webhook endpoints
      webhookSubscription: Joi.object({
        url: Joi.string().uri().required(),
        events: Joi.array().items(
          Joi.string().valid('contact.created', 'contact.updated', 'contact.deleted', 'deal.created', 'deal.updated')
        ).min(1).required(),
        active: Joi.boolean().default(true).optional(),
        maxConcurrency: Joi.number().integer().min(1).max(10).default(3).optional()
      }),

      // File upload validation
      fileUpload: Joi.object({
        filename: Joi.string().pattern(/^[a-zA-Z0-9._-]+$/).max(255).required(),
        size: Joi.number().integer().min(1).max(10 * 1024 * 1024).required(), // 10MB max
        type: Joi.string().valid('image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain').required()
      }),

      // Security-related schemas
      securityReport: Joi.object({
        type: Joi.string().valid('vulnerability', 'threat', 'audit').required(),
        severity: Joi.string().valid('low', 'medium', 'high', 'critical').required(),
        description: Joi.string().max(1000).required(),
        source: Joi.string().max(100).required(),
        metadata: Joi.object().optional()
      }),

      // Pagination and filtering
      paginationQuery: Joi.object({
        page: Joi.number().integer().min(1).default(1).optional(),
        limit: Joi.number().integer().min(1).max(100).default(20).optional(),
        sortBy: Joi.string().max(50).optional(),
        sortOrder: Joi.string().valid('asc', 'desc').default('asc').optional(),
        filter: Joi.string().max(200).optional()
      }),

      // Generic API response format
      apiResponse: Joi.object({
        success: Joi.boolean().required(),
        data: Joi.any().optional(),
        error: Joi.string().optional(),
        message: Joi.string().optional(),
        timestamp: Joi.date().iso().optional(),
        pagination: Joi.object({
          page: Joi.number().integer().min(1).required(),
          limit: Joi.number().integer().min(1).required(),
          total: Joi.number().integer().min(0).required(),
          totalPages: Joi.number().integer().min(0).required()
        }).optional()
      })
    };
  }

  // Get schema by name
  getSchema(schemaName) {
    return this.schemas[schemaName] || null;
  }

  // Validate data against schema
  validate(data, schemaName, options = {}) {
    const schema = this.getSchema(schemaName);
    if (!schema) {
      throw new Error(`Schema '${schemaName}' not found`);
    }

    const validationOptions = {
      allowUnknown: options.allowUnknown || false,
      stripUnknown: options.stripUnknown || true,
      abortEarly: options.abortEarly || false,
      ...options
    };

    const { error, value } = schema.validate(data, validationOptions);
    
    if (error) {
      const validationError = new Error(`Validation failed: ${error.details.map(d => d.message).join(', ')}`);
      validationError.validationDetails = error.details;
      validationError.isValidationError = true;
      throw validationError;
    }

    return value;
  }

  // Middleware factory for request validation
  validateRequest(schemaName, source = 'body') {
    return (req, res, next) => {
      try {
        const dataToValidate = this.extractDataFromRequest(req, source);
        const validatedData = this.validate(dataToValidate, schemaName);
        
        // Replace the original data with validated/sanitized data
        this.setValidatedDataOnRequest(req, validatedData, source);
        
        logger.debug('Request validation successful', { 
          schemaName, 
          source, 
          endpoint: req.originalUrl 
        });
        
        next();
      } catch (error) {
        logger.warn('Request validation failed', {
          schemaName,
          source,
          endpoint: req.originalUrl,
          error: error.message,
          validationDetails: error.validationDetails
        });

        return res.status(400).json({
          success: false,
          error: 'Invalid request data',
          message: error.message,
          details: error.validationDetails || [],
          timestamp: new Date().toISOString()
        });
      }
    };
  }

  // Extract data from request based on source
  extractDataFromRequest(req, source) {
    switch (source) {
      case 'body':
        return req.body;
      case 'query':
        return req.query;
      case 'params':
        return req.params;
      case 'headers':
        return req.headers;
      default:
        throw new Error(`Invalid validation source: ${source}`);
    }
  }

  // Set validated data back on request
  setValidatedDataOnRequest(req, validatedData, source) {
    switch (source) {
      case 'body':
        req.body = validatedData;
        break;
      case 'query':
        req.query = validatedData;
        break;
      case 'params':
        req.params = validatedData;
        break;
      case 'headers':
        req.headers = validatedData;
        break;
      default:
        throw new Error(`Invalid validation source: ${source}`);
    }
  }

  // Add custom schema
  addSchema(name, schema) {
    if (this.schemas[name]) {
      logger.warn(`Schema '${name}' already exists, overwriting`);
    }
    this.schemas[name] = schema;
  }

  // List all available schemas
  listSchemas() {
    return Object.keys(this.schemas);
  }

  // Validate response data
  validateResponse(data, schemaName = 'apiResponse') {
    try {
      return this.validate(data, schemaName);
    } catch (error) {
      logger.error('Response validation failed', {
        schemaName,
        error: error.message,
        data: JSON.stringify(data, null, 2)
      });
      throw error;
    }
  }

  // Create compound validation middleware for multiple sources
  validateMultiple(validations) {
    return (req, res, next) => {
      try {
        for (const { schemaName, source } of validations) {
          const dataToValidate = this.extractDataFromRequest(req, source);
          const validatedData = this.validate(dataToValidate, schemaName);
          this.setValidatedDataOnRequest(req, validatedData, source);
        }
        next();
      } catch (error) {
        logger.warn('Multiple validation failed', {
          validations,
          endpoint: req.originalUrl,
          error: error.message
        });

        return res.status(400).json({
          success: false,
          error: 'Invalid request data',
          message: error.message,
          details: error.validationDetails || [],
          timestamp: new Date().toISOString()
        });
      }
    };
  }
}

module.exports = InputValidationSchemas;