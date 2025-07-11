const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const logger = require('../shared/logger');

/**
 * 🍌 BANANA-POWERED DEPENDENCY VULNERABILITY SCANNER 🍌
 * 
 * Scans for known vulnerabilities in dependencies
 */
class DependencyScanner {
  constructor(options = {}) {
    this.options = {
      scanInterval: options.scanInterval || 86400000, // 24 hours
      autoScan: options.autoScan !== false,
      alertThreshold: options.alertThreshold || 'moderate',
      ...options
    };
    
    this.vulnerabilities = new Map();
    this.lastScan = null;
    this.scanInProgress = false;
    
    if (this.options.autoScan) {
      // Initial scan after 30 seconds
      setTimeout(() => this.scanDependencies(), 30000);
      
      // Periodic scanning
      setInterval(() => this.scanDependencies(), this.options.scanInterval);
    }
    
    logger.info('🍌 Dependency Scanner initialized');
  }

  async scanDependencies() {
    if (this.scanInProgress) {
      logger.debug('Dependency scan already in progress');
      return;
    }
    
    this.scanInProgress = true;
    logger.info('🍌 Starting dependency vulnerability scan...');
    
    try {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const packageLockPath = path.join(process.cwd(), 'package-lock.json');
      
      if (!fs.existsSync(packageJsonPath)) {
        throw new Error('package.json not found');
      }
      
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const dependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };
      
      // Scan using npm audit
      const auditResults = await this.runNpmAudit();
      
      // Scan using custom vulnerability database
      const customResults = await this.scanCustomVulnerabilities(dependencies);
      
      // Combine results
      const allVulnerabilities = [...auditResults, ...customResults];
      
      // Update vulnerability store
      this.vulnerabilities.clear();
      for (const vuln of allVulnerabilities) {
        this.vulnerabilities.set(vuln.id, vuln);
      }
      
      this.lastScan = new Date();
      
      // Log results
      const criticalCount = allVulnerabilities.filter(v => v.severity === 'critical').length;
      const highCount = allVulnerabilities.filter(v => v.severity === 'high').length;
      const moderateCount = allVulnerabilities.filter(v => v.severity === 'moderate').length;
      const lowCount = allVulnerabilities.filter(v => v.severity === 'low').length;
      
      logger.info('🍌 Dependency scan complete', {
        total: allVulnerabilities.length,
        critical: criticalCount,
        high: highCount,
        moderate: moderateCount,
        low: lowCount
      });
      
      // Alert on high severity vulnerabilities
      if (criticalCount > 0 || highCount > 0) {
        logger.error('🚨 Critical security vulnerabilities detected!', {
          critical: criticalCount,
          high: highCount
        });
        
        // Log details of critical vulnerabilities
        const criticalVulns = allVulnerabilities.filter(v => v.severity === 'critical');
        for (const vuln of criticalVulns) {
          logger.error('🚨 CRITICAL VULNERABILITY:', {
            package: vuln.package,
            version: vuln.version,
            title: vuln.title,
            cve: vuln.cve,
            recommendation: vuln.recommendation
          });
        }
      }
      
      return {
        success: true,
        vulnerabilities: allVulnerabilities,
        summary: { total: allVulnerabilities.length, critical: criticalCount, high: highCount, moderate: moderateCount, low: lowCount },
        lastScan: this.lastScan
      };
      
    } catch (error) {
      logger.error('Dependency scan failed:', error);
      return {
        success: false,
        error: error.message,
        lastScan: this.lastScan
      };
    } finally {
      this.scanInProgress = false;
    }
  }

  async runNpmAudit() {
    try {
      const auditOutput = execSync('npm audit --json', { 
        encoding: 'utf8',
        timeout: 30000,
        stdio: 'pipe'
      });
      
      const auditData = JSON.parse(auditOutput);
      const vulnerabilities = [];
      
      if (auditData.vulnerabilities) {
        for (const [packageName, vuln] of Object.entries(auditData.vulnerabilities)) {
          // Handle npm audit v7+ format
          if (vuln.severity) {
            vulnerabilities.push({
              id: `npm-${packageName}-${vuln.severity}`,
              package: packageName,
              version: vuln.range || 'unknown',
              severity: vuln.severity,
              title: vuln.title || 'Unknown vulnerability',
              cve: vuln.cwe || vuln.cve || 'N/A',
              recommendation: vuln.fixAvailable ? 'Update available' : 'No fix available',
              source: 'npm-audit',
              url: vuln.url || null,
              detectedAt: new Date()
            });
          }
        }
      }
      
      return vulnerabilities;
    } catch (error) {
      // npm audit returns non-zero exit code when vulnerabilities found
      if (error.stdout) {
        try {
          const auditData = JSON.parse(error.stdout);
          const vulnerabilities = [];
          
          if (auditData.vulnerabilities) {
            for (const [packageName, vuln] of Object.entries(auditData.vulnerabilities)) {
              if (vuln.severity) {
                vulnerabilities.push({
                  id: `npm-${packageName}-${vuln.severity}`,
                  package: packageName,
                  version: vuln.range || 'unknown',
                  severity: vuln.severity,
                  title: vuln.title || 'Unknown vulnerability',
                  cve: vuln.cwe || vuln.cve || 'N/A',
                  recommendation: vuln.fixAvailable ? 'Update available' : 'No fix available',
                  source: 'npm-audit',
                  url: vuln.url || null,
                  detectedAt: new Date()
                });
              }
            }
          }
          
          return vulnerabilities;
        } catch (parseError) {
          logger.warn('Could not parse npm audit output:', parseError.message);
          return [];
        }
      }
      
      logger.warn('npm audit failed:', error.message);
      return [];
    }
  }

  async scanCustomVulnerabilities(dependencies) {
    const vulnerabilities = [];
    
    // Custom vulnerability database (in production, this would be a real database)
    const customVulns = [
      {
        package: 'express',
        versions: ['<4.17.1'],
        severity: 'high',
        title: 'Denial of Service vulnerability',
        cve: 'CVE-2019-15605',
        recommendation: 'Update to express@4.17.1 or later'
      },
      {
        package: 'lodash',
        versions: ['<4.17.19'],
        severity: 'high',
        title: 'Prototype Pollution vulnerability',
        cve: 'CVE-2020-8203',
        recommendation: 'Update to lodash@4.17.19 or later'
      },
      {
        package: 'axios',
        versions: ['<0.21.2'],
        severity: 'moderate',
        title: 'Regular Expression Denial of Service',
        cve: 'CVE-2021-3749',
        recommendation: 'Update to axios@0.21.2 or later'
      }
    ];
    
    for (const [packageName, version] of Object.entries(dependencies)) {
      const matchingVulns = customVulns.filter(vuln => vuln.package === packageName);
      
      for (const vuln of matchingVulns) {
        // Simple version check (in production, use semver)
        if (this.isVulnerableVersion(version, vuln.versions)) {
          vulnerabilities.push({
            id: `custom-${packageName}-${vuln.cve}`,
            package: packageName,
            version: version,
            severity: vuln.severity,
            title: vuln.title,
            cve: vuln.cve,
            recommendation: vuln.recommendation,
            source: 'custom-db',
            detectedAt: new Date()
          });
        }
      }
    }
    
    return vulnerabilities;
  }

  isVulnerableVersion(installedVersion, vulnerableVersions) {
    // Simplified version checking (in production, use semver package)
    // This is a basic implementation for demonstration
    for (const vulnRange of vulnerableVersions) {
      if (vulnRange.startsWith('<')) {
        // Example: "<4.17.1" - vulnerable if version is less than 4.17.1
        const compareVersion = vulnRange.substring(1);
        if (this.compareVersions(installedVersion, compareVersion) < 0) {
          return true;
        }
      }
    }
    return false;
  }

  compareVersions(a, b) {
    // Simple version comparison (in production, use semver)
    const aClean = a.replace(/[^0-9.]/g, '');
    const bClean = b.replace(/[^0-9.]/g, '');
    
    const aParts = aClean.split('.').map(Number);
    const bParts = bClean.split('.').map(Number);
    
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aPart = aParts[i] || 0;
      const bPart = bParts[i] || 0;
      
      if (aPart < bPart) return -1;
      if (aPart > bPart) return 1;
    }
    
    return 0;
  }

  getVulnerabilities() {
    return Array.from(this.vulnerabilities.values());
  }

  getVulnerabilityCount() {
    const vulns = this.getVulnerabilities();
    return {
      total: vulns.length,
      critical: vulns.filter(v => v.severity === 'critical').length,
      high: vulns.filter(v => v.severity === 'high').length,
      moderate: vulns.filter(v => v.severity === 'moderate').length,
      low: vulns.filter(v => v.severity === 'low').length
    };
  }

  getStats() {
    return {
      lastScan: this.lastScan,
      scanInProgress: this.scanInProgress,
      vulnerabilityCount: this.getVulnerabilityCount(),
      scanInterval: this.options.scanInterval,
      alertThreshold: this.options.alertThreshold
    };
  }
}

module.exports = DependencyScanner;