const logger = require('../shared/logger');

class InputValidationMiddleware {
  constructor(options = {}) {
    this.maxBodySize = options.maxBodySize || 10 * 1024 * 1024; // 10MB
    this.maxQueryParams = options.maxQueryParams || 50;
    this.maxHeaderSize = options.maxHeaderSize || 8192; // 8KB
    this.allowedMethods = options.allowedMethods || ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];
    this.sanitizeStrings = options.sanitizeStrings !== false;
  }

  // Sanitize string input to prevent XSS
  sanitizeString(str) {
    if (typeof str !== 'string') return str;
    
    return str
      .replace(/[<>&"']/g, (char) => {
        const entities = {
          '<': '&lt;',
          '>': '&gt;',
          '&': '&amp;',
          '"': '&quot;',
          "'": '&#x27;'
        };
        return entities[char];
      })
      .replace(/javascript:/gi, 'javascript_blocked:')
      .replace(/data:/gi, 'data_blocked:')
      .replace(/vbscript:/gi, 'vbscript_blocked:');
  }

  // Recursively sanitize object properties
  sanitizeObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }
    
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = this.sanitizeString(key);
      
      if (typeof value === 'string') {
        sanitized[sanitizedKey] = this.sanitizeString(value);
      } else if (typeof value === 'object') {
        sanitized[sanitizedKey] = this.sanitizeObject(value);
      } else {
        sanitized[sanitizedKey] = value;
      }
    }
    
    return sanitized;
  }

  // Validate request method
  validateMethod(method) {
    return this.allowedMethods.includes(method.toUpperCase());
  }

  // Validate request size
  validateRequestSize(req) {
    const contentLength = parseInt(req.headers['content-length'] || '0');
    return contentLength <= this.maxBodySize;
  }

  // Validate query parameters
  validateQueryParams(query) {
    const paramCount = Object.keys(query).length;
    return paramCount <= this.maxQueryParams;
  }

  // Validate headers
  validateHeaders(headers) {
    const headerString = JSON.stringify(headers);
    return headerString.length <= this.maxHeaderSize;
  }

  // Check for common attack patterns
  detectAttackPatterns(str) {
    if (typeof str !== 'string') return null;
    
    const patterns = [
      { name: 'SQL Injection', regex: /(\'|\\\'|;|\\;|--|union\s+|select\s+|insert\s+|update\s+|delete\s+|drop\s+|create\s+|alter\s+|exec\s+|execute\s+)/gi },
      { name: 'XSS', regex: /(<script[^>]*>.*?<\/script>)|(<iframe[^>]*>.*?<\/iframe>)|(<object[^>]*>.*?<\/object>)/gi },
      { name: 'Path Traversal', regex: /(\.\.\/|\.\.\\|\/\.\.\/|\\\.\.\\)/g },
      { name: 'Command Injection', regex: /(\||;|&|`|\$\(|\$\{)/g },
      { name: 'LDAP Injection', regex: /(\*|\(|\)|\\|\||&)/g }
    ];

    for (const pattern of patterns) {
      if (pattern.regex.test(str)) {
        return pattern.name;
      }
    }
    
    return null;
  }

  // Validate and sanitize request
  validateRequest(req, res, next) {
    const startTime = Date.now();
    
    try {
      // Validate HTTP method
      if (!this.validateMethod(req.method)) {
        logger.warn('Invalid HTTP method', { method: req.method, ip: req.ip });
        return res.status(405).json({
          success: false,
          error: 'Method not allowed',
          timestamp: new Date().toISOString()
        });
      }

      // Validate request size
      if (!this.validateRequestSize(req)) {
        logger.warn('Request size exceeded', { 
          contentLength: req.headers['content-length'], 
          maxSize: this.maxBodySize,
          ip: req.ip 
        });
        return res.status(413).json({
          success: false,
          error: 'Request entity too large',
          maxSize: this.maxBodySize,
          timestamp: new Date().toISOString()
        });
      }

      // Validate query parameters
      if (!this.validateQueryParams(req.query)) {
        logger.warn('Too many query parameters', { 
          paramCount: Object.keys(req.query).length,
          maxParams: this.maxQueryParams,
          ip: req.ip 
        });
        return res.status(400).json({
          success: false,
          error: 'Too many query parameters',
          maxParams: this.maxQueryParams,
          timestamp: new Date().toISOString()
        });
      }

      // Validate headers
      if (!this.validateHeaders(req.headers)) {
        logger.warn('Headers too large', { 
          headerSize: JSON.stringify(req.headers).length,
          maxSize: this.maxHeaderSize,
          ip: req.ip 
        });
        return res.status(400).json({
          success: false,
          error: 'Request headers too large',
          timestamp: new Date().toISOString()
        });
      }

      // Check for attack patterns in query parameters
      for (const [key, value] of Object.entries(req.query)) {
        const keyAttack = this.detectAttackPatterns(key);
        const valueAttack = this.detectAttackPatterns(value);
        
        if (keyAttack || valueAttack) {
          logger.warn('Attack pattern detected in query', { 
            key, value, keyAttack, valueAttack, ip: req.ip, path: req.path 
          });
          return res.status(400).json({
            success: false,
            error: 'Invalid request parameters',
            timestamp: new Date().toISOString()
          });
        }
      }

      // Sanitize request body if present
      if (req.body && this.sanitizeStrings) {
        req.body = this.sanitizeObject(req.body);
      }

      // Sanitize query parameters
      if (this.sanitizeStrings) {
        req.query = this.sanitizeObject(req.query);
      }

      // Add validation metadata to request
      req.validation = {
        validated: true,
        processingTime: Date.now() - startTime,
        sanitized: this.sanitizeStrings
      };

      next();
      
    } catch (error) {
      logger.error('Input validation error', { error: error.message, ip: req.ip });
      return res.status(500).json({
        success: false,
        error: 'Request validation failed',
        timestamp: new Date().toISOString()
      });
    }
  }

  // Middleware function
  middleware() {
    return (req, res, next) => {
      this.validateRequest(req, res, next);
    };
  }

  // Get validation statistics
  getStats() {
    return {
      maxBodySize: this.maxBodySize,
      maxQueryParams: this.maxQueryParams,
      maxHeaderSize: this.maxHeaderSize,
      allowedMethods: this.allowedMethods,
      sanitizeStrings: this.sanitizeStrings
    };
  }
}

module.exports = InputValidationMiddleware;