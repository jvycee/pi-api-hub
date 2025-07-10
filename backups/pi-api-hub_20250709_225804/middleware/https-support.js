const fs = require('fs');
const https = require('https');
const path = require('path');
const logger = require('../shared/logger');

class HttpsSupport {
  constructor() {
    this.httpsOptions = null;
    this.httpsServer = null;
    this.setupHttpsOptions();
  }

  setupHttpsOptions() {
    // Check for SSL certificates
    const certPath = process.env.SSL_CERT_PATH || path.join(__dirname, '../certs/server.crt');
    const keyPath = process.env.SSL_KEY_PATH || path.join(__dirname, '../certs/server.key');
    
    try {
      // Check if certificate files exist
      if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
        this.httpsOptions = {
          key: fs.readFileSync(keyPath),
          cert: fs.readFileSync(certPath),
          // Security improvements
          secureProtocol: 'TLSv1_2_method',
          ciphers: [
            'ECDHE-RSA-AES128-GCM-SHA256',
            'ECDHE-RSA-AES256-GCM-SHA384',
            'ECDHE-RSA-AES128-SHA256',
            'ECDHE-RSA-AES256-SHA384'
          ].join(':'),
          honorCipherOrder: true,
          requestCert: false,
          rejectUnauthorized: false
        };
        
        logger.info('HTTPS certificates loaded successfully');
      } else {
        logger.info('HTTPS certificates not found, using HTTP only');
        logger.info('To enable HTTPS, place certificates at:');
        logger.info(`  Certificate: ${certPath}`);
        logger.info(`  Private Key: ${keyPath}`);
      }
    } catch (error) {
      logger.error('Error loading HTTPS certificates:', error);
      this.httpsOptions = null;
    }
  }

  // Create HTTPS server
  createHttpsServer(app) {
    if (!this.httpsOptions) {
      logger.warn('HTTPS not available - certificates not found');
      return null;
    }

    try {
      this.httpsServer = https.createServer(this.httpsOptions, app);
      logger.info('HTTPS server created successfully');
      return this.httpsServer;
    } catch (error) {
      logger.error('Error creating HTTPS server:', error);
      return null;
    }
  }

  // Start HTTPS server
  startHttpsServer(app, port = 443) {
    if (!this.httpsOptions) {
      logger.warn('Cannot start HTTPS server - certificates not available');
      return null;
    }

    const server = this.createHttpsServer(app);
    if (!server) {
      return null;
    }

    return new Promise((resolve, reject) => {
      server.listen(port, (error) => {
        if (error) {
          logger.error('Error starting HTTPS server:', error);
          reject(error);
        } else {
          logger.info(`🔒 HTTPS server running on port ${port}`);
          resolve(server);
        }
      });
    });
  }

  // Middleware to redirect HTTP to HTTPS
  redirectToHttps(httpsPort = 443) {
    return (req, res, next) => {
      // Skip redirect if already HTTPS
      if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
        return next();
      }

      // Skip redirect if HTTPS is not available
      if (!this.httpsOptions) {
        return next();
      }

      // Skip redirect for local development
      if (process.env.NODE_ENV === 'development') {
        return next();
      }

      // Redirect to HTTPS
      const host = req.headers.host?.replace(/:\d+$/, '');
      const httpsUrl = `https://${host}${httpsPort !== 443 ? `:${httpsPort}` : ''}${req.url}`;
      
      logger.info(`Redirecting HTTP to HTTPS: ${req.url} -> ${httpsUrl}`);
      res.redirect(301, httpsUrl);
    };
  }

  // Security headers for HTTPS
  securityHeaders() {
    return (req, res, next) => {
      // Only add HSTS if connection is secure
      if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
      }
      
      // Add other security headers
      res.setHeader('X-HTTPS-Enabled', req.secure ? 'true' : 'false');
      
      next();
    };
  }

  // Check if HTTPS is available
  isHttpsAvailable() {
    return this.httpsOptions !== null;
  }

  // Get HTTPS configuration status
  getHttpsStatus() {
    return {
      available: this.isHttpsAvailable(),
      certPath: process.env.SSL_CERT_PATH || path.join(__dirname, '../certs/server.crt'),
      keyPath: process.env.SSL_KEY_PATH || path.join(__dirname, '../certs/server.key'),
      secureProtocol: this.httpsOptions?.secureProtocol || 'Not configured',
      ciphers: this.httpsOptions?.ciphers || 'Not configured'
    };
  }

  // Generate self-signed certificate for development
  generateSelfSignedCert() {
    const script = `
#!/bin/bash
mkdir -p certs
openssl req -x509 -newkey rsa:4096 -keyout certs/server.key -out certs/server.crt -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
chmod 600 certs/server.key
chmod 644 certs/server.crt
echo "Self-signed certificate generated successfully!"
echo "Certificate: certs/server.crt"
echo "Private Key: certs/server.key"
`;

    const scriptPath = path.join(__dirname, '../generate-cert.sh');
    
    try {
      fs.writeFileSync(scriptPath, script);
      fs.chmodSync(scriptPath, '755');
      
      logger.info('Self-signed certificate generation script created');
      logger.info('Run the following command to generate certificates:');
      logger.info(`  ./generate-cert.sh`);
      
      return scriptPath;
    } catch (error) {
      logger.error('Error creating certificate generation script:', error);
      return null;
    }
  }
}

module.exports = HttpsSupport;