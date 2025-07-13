const logger = require('./logger');

class ResponseHelper {
  /**
   * Send successful response with consistent formatting
   * @param {Object} res - Express response object
   * @param {*} data - Response data
   * @param {Object} metadata - Additional metadata (optional)
   * @param {number} statusCode - HTTP status code (default: 200)
   */
  static success(res, data, metadata = {}, statusCode = 200) {
    const response = {
      success: true,
      data,
      ...metadata,
      timestamp: new Date().toISOString()
    };

    return res.status(statusCode).json(response);
  }

  /**
   * Send error response with consistent formatting
   * @param {Object} res - Express response object
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code (default: 500)
   * @param {Object} details - Additional error details (optional)
   */
  static error(res, message, statusCode = 500, details = {}) {
    const response = {
      success: false,
      error: message,
      ...details,
      timestamp: new Date().toISOString()
    };

    // Log error for monitoring
    if (statusCode >= 500) {
      logger.error('Server error response', { message, statusCode, details });
    } else {
      logger.warn('Client error response', { message, statusCode, details });
    }

    return res.status(statusCode).json(response);
  }

  /**
   * Send validation error response
   * @param {Object} res - Express response object
   * @param {string} message - Validation error message
   * @param {Object} validationErrors - Specific validation errors
   */
  static validationError(res, message, validationErrors = {}) {
    return this.error(res, message, 400, { validationErrors });
  }

  /**
   * Send unauthorized error response
   * @param {Object} res - Express response object
   * @param {string} message - Unauthorized message
   */
  static unauthorized(res, message = 'Unauthorized access') {
    return this.error(res, message, 401);
  }

  /**
   * Send forbidden error response
   * @param {Object} res - Express response object
   * @param {string} message - Forbidden message
   */
  static forbidden(res, message = 'Access forbidden') {
    return this.error(res, message, 403);
  }

  /**
   * Send not found error response
   * @param {Object} res - Express response object
   * @param {string} message - Not found message
   * @param {string} path - Requested path (optional)
   */
  static notFound(res, message = 'Resource not found', path = null) {
    const details = path ? { path } : {};
    return this.error(res, message, 404, details);
  }

  /**
   * Send rate limit error response
   * @param {Object} res - Express response object
   * @param {string} message - Rate limit message
   * @param {Object} rateLimitInfo - Rate limit details
   */
  static rateLimited(res, message = 'Rate limit exceeded', rateLimitInfo = {}) {
    return this.error(res, message, 429, rateLimitInfo);
  }

  /**
   * Handle async route with automatic error catching
   * @param {Function} asyncFn - Async route handler function
   * @returns {Function} Express middleware function
   */
  static asyncHandler(asyncFn) {
    return (req, res, next) => {
      Promise.resolve(asyncFn(req, res, next)).catch((error) => {
        logger.error('Async handler error', { 
          error: error.message, 
          stack: error.stack,
          path: req.path,
          method: req.method
        });
        
        // Send appropriate error response based on error type
        if (error.name === 'ValidationError') {
          this.validationError(res, error.message, error.details);
        } else if (error.status) {
          this.error(res, error.message, error.status);
        } else {
          this.error(res, 'Internal server error');
        }
      });
    };
  }

  /**
   * Create paginated response
   * @param {Object} res - Express response object
   * @param {Array} items - Array of items
   * @param {Object} pagination - Pagination metadata
   */
  static paginated(res, items, pagination = {}) {
    const metadata = {
      pagination: {
        total: pagination.total || items.length,
        page: pagination.page || 1,
        limit: pagination.limit || items.length,
        hasMore: pagination.hasMore || false,
        ...pagination
      }
    };

    return this.success(res, items, metadata);
  }

  /**
   * Create streaming response helper
   * @param {Object} res - Express response object
   * @param {Object} streamInfo - Stream metadata
   */
  static streaming(res, streamInfo = {}) {
    const metadata = {
      streaming: true,
      ...streamInfo
    };

    return this.success(res, null, metadata);
  }
}

module.exports = ResponseHelper;