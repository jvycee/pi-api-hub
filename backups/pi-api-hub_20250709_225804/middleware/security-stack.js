const AdminAuthMiddleware = require('./admin-auth');
const SecurityHeadersMiddleware = require('./security-headers');
const InputValidationMiddleware = require('./input-validation');
const RateLimitingMiddleware = require('./rate-limiting');
const ThreatDetection = require('./threat-detection');
const SecurityCommandCenter = require('./security-command-center');
const BananaMFA = require('./banana-mfa');
const BananaZeroTrust = require('./banana-zero-trust');
const BananaVulnerabilityScanner = require('./banana-vulnerability-scanner');
const BananaAuditLogger = require('./banana-audit-logger');
const BananaRequestSigning = require('./banana-request-signing');
const BananaHoneypots = require('./banana-honeypots');

class SecurityStack {
  constructor() {
    this.adminAuth = new AdminAuthMiddleware();
    this.securityHeaders = new SecurityHeadersMiddleware();
    this.inputValidation = new InputValidationMiddleware();
    this.rateLimiting = new RateLimitingMiddleware();
    this.threatDetection = new ThreatDetection();
    this.securityCommandCenter = new SecurityCommandCenter();
    this.bananaMFA = new BananaMFA();
    this.bananaZeroTrust = new BananaZeroTrust();
    this.bananaVulnerabilityScanner = new BananaVulnerabilityScanner();
    this.bananaAuditLogger = new BananaAuditLogger();
    this.bananaRequestSigning = new BananaRequestSigning();
    this.bananaHoneypots = new BananaHoneypots();
  }

  getSecurityMiddleware() {
    return [
      this.securityHeaders.middleware(),
      this.inputValidation.middleware(),
      this.rateLimiting.middleware(),
      this.threatDetection.middleware(),
      this.bananaAuditLogger.middleware(),
      this.bananaZeroTrust.middleware(),
      this.bananaVulnerabilityScanner.middleware(),
      this.bananaHoneypots.middleware()
    ];
  }

  getAdminSecurityMiddleware() {
    return [
      this.adminAuth.middleware(),
      this.bananaMFA.middleware(),
      this.bananaRequestSigning.middleware(),
      this.securityCommandCenter.middleware()
    ];
  }
}

module.exports = SecurityStack;