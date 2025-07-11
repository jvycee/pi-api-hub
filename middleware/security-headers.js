const logger = require('../shared/logger');

class SecurityHeadersMiddleware {
  constructor(options = {}) {
    this.options = {
      contentSecurityPolicy: options.contentSecurityPolicy !== false,
      xssProtection: options.xssProtection !== false,
      noSniff: options.noSniff !== false,
      frameOptions: options.frameOptions !== false,
      hsts: options.hsts !== false,
      referrerPolicy: options.referrerPolicy !== false,
      permissionsPolicy: options.permissionsPolicy !== false,
      ...options
    };
  }

  // Apply security headers
  applyHeaders(req, res, next) {
    // Content Security Policy - Enhanced
    if (this.options.contentSecurityPolicy) {
      res.setHeader('Content-Security-Policy', [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Needed for monitoring dashboard
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "connect-src 'self' localhost:* 127.0.0.1:*",
        "font-src 'self' data:",
        "object-src 'none'",
        "media-src 'self'",
        "frame-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "upgrade-insecure-requests"
      ].join('; '));
    }

    // XSS Protection
    if (this.options.xssProtection) {
      res.setHeader('X-XSS-Protection', '1; mode=block');
    }

    // Prevent MIME type sniffing
    if (this.options.noSniff) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }

    // Frame Options (prevent clickjacking)
    if (this.options.frameOptions) {
      res.setHeader('X-Frame-Options', 'DENY');
    }

    // HTTP Strict Transport Security
    if (this.options.hsts) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    // Referrer Policy
    if (this.options.referrerPolicy) {
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    }

    // Permissions Policy (Feature Policy)
    if (this.options.permissionsPolicy) {
      res.setHeader('Permissions-Policy', [
        'geolocation=()',
        'camera=()',
        'microphone=()',
        'payment=()',
        'usb=()',
        'magnetometer=()',
        'gyroscope=()',
        'speaker=()'
      ].join(', '));
    }

    // Remove server identification
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');

    // Custom security headers for API
    res.setHeader('X-API-Version', '2.0.0');
    res.setHeader('X-Security-Level', 'HIGH');
    
    // Additional security headers
    res.setHeader('X-Download-Options', 'noopen');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Security timing headers
    res.setHeader('X-Response-Time-Start', Date.now());
    
    next();
  }

  // Middleware function
  middleware() {
    return (req, res, next) => {
      this.applyHeaders(req, res, next);
    };
  }

  // Log security header application
  logSecurityHeaders(req, res, next) {
    const originalSend = res.send;
    res.send = function(data) {
      logger.debug('Security headers applied', {
        path: req.path,
        method: req.method,
        headers: {
          csp: res.getHeader('Content-Security-Policy') ? 'applied' : 'skipped',
          xss: res.getHeader('X-XSS-Protection') ? 'applied' : 'skipped',
          nosniff: res.getHeader('X-Content-Type-Options') ? 'applied' : 'skipped',
          frameOptions: res.getHeader('X-Frame-Options') ? 'applied' : 'skipped'
        }
      });
      originalSend.call(this, data);
    };
    next();
  }
}

module.exports = SecurityHeadersMiddleware;