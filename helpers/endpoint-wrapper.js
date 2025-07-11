const logger = require('../shared/logger');

/**
 * 🍌 BANANA-POWERED ENDPOINT WRAPPER 🍌
 * 
 * Eliminates repetitive error handling and response formatting
 * Provides consistent API response structure
 */
class EndpointWrapper {
  static createHandler(handlerFn, options = {}) {
    const {
      requireAuth = false,
      adminOnly = false,
      successMessage = null,
      errorMessage = 'Operation failed',
      logOperation = true
    } = options;

    return async (req, res, next) => {
      try {
        // Check authorization if required
        if (requireAuth && !req.apiKey) {
          return res.status(401).json({
            success: false,
            error: 'Authentication required',
            timestamp: new Date().toISOString()
          });
        }

        if (adminOnly && req.apiKeyData?.tier !== 'admin') {
          return res.status(403).json({
            success: false,
            error: 'Admin access required',
            timestamp: new Date().toISOString()
          });
        }

        // Execute handler
        const result = await handlerFn(req, res);
        
        // If handler already sent response, don't send again
        if (res.headersSent) return;

        // Send success response
        const response = {
          success: true,
          timestamp: new Date().toISOString()
        };

        if (successMessage) {
          response.message = successMessage;
        }

        if (result !== undefined) {
          response.data = result;
        }

        res.json(response);

        // Log successful operation
        if (logOperation) {
          logger.info('API operation completed', {
            path: req.path,
            method: req.method,
            user: req.apiKeyData?.name || 'anonymous'
          });
        }

      } catch (error) {
        // Log error
        logger.error(errorMessage, {
          error: error.message,
          path: req.path,
          method: req.method,
          user: req.apiKeyData?.name || 'anonymous'
        });

        // Don't send response if already sent
        if (res.headersSent) return next(error);

        // Send error response
        const statusCode = error.statusCode || error.status || 500;
        res.status(statusCode).json({
          success: false,
          error: statusCode === 500 ? errorMessage : error.message,
          timestamp: new Date().toISOString()
        });
      }
    };
  }

  // Specific wrapper for GET endpoints
  static createGetEndpoint(handlerFn, options = {}) {
    return this.createHandler(handlerFn, {
      errorMessage: 'Failed to retrieve data',
      ...options
    });
  }

  // Specific wrapper for POST endpoints
  static createPostEndpoint(handlerFn, options = {}) {
    return this.createHandler(handlerFn, {
      errorMessage: 'Failed to create resource',
      ...options
    });
  }

  // Specific wrapper for admin endpoints
  static createAdminEndpoint(handlerFn, options = {}) {
    return this.createHandler(handlerFn, {
      adminOnly: true,
      errorMessage: 'Admin operation failed',
      ...options
    });
  }

  // Wrapper for operations that don't return data
  static createActionEndpoint(handlerFn, options = {}) {
    return this.createHandler(async (req, res) => {
      await handlerFn(req, res);
      return undefined; // No data to return
    }, {
      successMessage: 'Operation completed successfully',
      ...options
    });
  }
}

module.exports = EndpointWrapper;