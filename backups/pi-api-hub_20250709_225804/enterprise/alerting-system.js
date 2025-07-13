const logger = require('../shared/logger');
const nodemailer = require('nodemailer');
const { WebClient } = require('@slack/web-api');

/**
 * 📧 ENTERPRISE ALERTING SYSTEM 📧
 * Multi-channel notification delivery with escalation and acknowledgment
 */
class AlertingSystem {
  constructor(options = {}) {
    this.enableEmail = options.enableEmail || true;
    this.enableSMS = options.enableSMS || false;
    this.enableSlack = options.enableSlack || true;
    this.enableWebhooks = options.enableWebhooks || true;
    
    // Configuration
    this.emailConfig = options.emailConfig || {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      }
    };
    
    this.slackConfig = options.slackConfig || {
      token: process.env.SLACK_BOT_TOKEN,
      channel: process.env.SLACK_CHANNEL || '#alerts'
    };
    
    // Alert rules and channels
    this.alertRules = new Map();
    this.alertChannels = new Map();
    this.alertHistory = new Map();
    this.acknowledgments = new Map();
    
    // Initialize clients
    this.emailClient = null;
    this.slackClient = null;
    
    this.initializeAlertingSystem();
    
    logger.info('📧 Enterprise Alerting System initialized');
  }

  /**
   * Initialize alerting system
   */
  async initializeAlertingSystem() {
    try {
      // Initialize email client
      if (this.enableEmail && this.emailConfig.host) {
        this.emailClient = nodemailer.createTransporter(this.emailConfig);
      }
      
      // Initialize Slack client
      if (this.enableSlack && this.slackConfig.token) {
        this.slackClient = new WebClient(this.slackConfig.token);
      }
      
      // Create default alert rules
      this.createDefaultAlertRules();
      
      // Create default alert channels
      this.createDefaultAlertChannels();
      
      logger.info('📧 Alerting System initialization complete');
    } catch (error) {
      logger.error('Failed to initialize alerting system:', error);
      throw error;
    }
  }

  /**
   * Create default alert rules
   */
  createDefaultAlertRules() {
    const defaultRules = [
      {
        id: 'high_response_time',
        name: 'High Response Time',
        condition: {
          metric: 'response_time',
          operator: 'greater_than',
          threshold: 5000,
          duration: 300000 // 5 minutes
        },
        severity: 'warning',
        channels: ['email', 'slack'],
        escalation: {
          enabled: true,
          levels: [
            { delay: 900000, channels: ['email', 'slack'], severity: 'critical' }, // 15 minutes
            { delay: 1800000, channels: ['email', 'slack', 'webhook'], severity: 'critical' } // 30 minutes
          ]
        }
      },
      {
        id: 'high_error_rate',
        name: 'High Error Rate',
        condition: {
          metric: 'error_rate',
          operator: 'greater_than',
          threshold: 0.1,
          duration: 300000 // 5 minutes
        },
        severity: 'critical',
        channels: ['email', 'slack'],
        escalation: {
          enabled: true,
          levels: [
            { delay: 300000, channels: ['email', 'slack', 'webhook'], severity: 'critical' } // 5 minutes
          ]
        }
      },
      {
        id: 'system_down',
        name: 'System Down',
        condition: {
          metric: 'health_check',
          operator: 'equals',
          threshold: 'unhealthy',
          duration: 60000 // 1 minute
        },
        severity: 'critical',
        channels: ['email', 'slack', 'webhook'],
        escalation: {
          enabled: true,
          levels: [
            { delay: 180000, channels: ['email', 'slack', 'webhook'], severity: 'critical' } // 3 minutes
          ]
        }
      }
    ];
    
    defaultRules.forEach(rule => {
      this.alertRules.set(rule.id, rule);
    });
  }

  /**
   * Create default alert channels
   */
  createDefaultAlertChannels() {
    const defaultChannels = [
      {
        id: 'email',
        type: 'email',
        name: 'Email Notifications',
        enabled: this.enableEmail,
        config: {
          from: process.env.ALERT_FROM_EMAIL || 'alerts@pi-api-hub.com',
          recipients: [
            { email: 'admin@pi-api-hub.com', severity: ['warning', 'critical'] },
            { email: 'ops@pi-api-hub.com', severity: ['critical'] }
          ]
        }
      },
      {
        id: 'slack',
        type: 'slack',
        name: 'Slack Notifications',
        enabled: this.enableSlack,
        config: {
          channel: this.slackConfig.channel,
          username: 'Pi API Hub Alerts',
          icon_emoji: ':warning:'
        }
      },
      {
        id: 'webhook',
        type: 'webhook',
        name: 'Webhook Notifications',
        enabled: this.enableWebhooks,
        config: {
          url: process.env.ALERT_WEBHOOK_URL,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.ALERT_WEBHOOK_TOKEN}`
          }
        }
      }
    ];
    
    defaultChannels.forEach(channel => {
      this.alertChannels.set(channel.id, channel);
    });
  }

  /**
   * Trigger an alert
   */
  async triggerAlert(alertData) {
    try {
      const alertId = this.generateAlertId();
      const timestamp = Date.now();
      
      const alert = {
        id: alertId,
        ruleId: alertData.ruleId,
        title: alertData.title,
        message: alertData.message,
        severity: alertData.severity || 'warning',
        source: alertData.source || 'system',
        data: alertData.data || {},
        timestamp,
        status: 'active',
        acknowledged: false,
        acknowledgedBy: null,
        acknowledgedAt: null,
        resolved: false,
        resolvedAt: null,
        escalationLevel: 0,
        nextEscalation: null
      };
      
      // Find matching rule
      const rule = this.alertRules.get(alertData.ruleId);
      if (rule) {
        alert.channels = rule.channels;
        alert.escalation = rule.escalation;
        
        // Set next escalation time
        if (rule.escalation?.enabled && rule.escalation.levels.length > 0) {
          alert.nextEscalation = timestamp + rule.escalation.levels[0].delay;
        }
      }
      
      // Store alert
      this.alertHistory.set(alertId, alert);
      
      // Send notifications
      await this.sendNotifications(alert);
      
      logger.info('📧 Alert triggered', {
        alertId,
        ruleId: alertData.ruleId,
        severity: alert.severity,
        channels: alert.channels
      });
      
      return alert;
    } catch (error) {
      logger.error('Failed to trigger alert:', error);
      throw error;
    }
  }

  /**
   * Send notifications through configured channels
   */
  async sendNotifications(alert) {
    if (!alert.channels || alert.channels.length === 0) {
      return;
    }
    
    for (const channelId of alert.channels) {
      try {
        const channel = this.alertChannels.get(channelId);
        if (!channel || !channel.enabled) {
          continue;
        }
        
        switch (channel.type) {
          case 'email':
            await this.sendEmailNotification(alert, channel);
            break;
          case 'slack':
            await this.sendSlackNotification(alert, channel);
            break;
          case 'webhook':
            await this.sendWebhookNotification(alert, channel);
            break;
        }
        
        logger.info(`📧 Notification sent via ${channelId}`, { alertId: alert.id });
      } catch (error) {
        logger.error(`Failed to send notification via ${channelId}:`, error);
      }
    }
  }

  /**
   * Send email notification
   */
  async sendEmailNotification(alert, channel) {
    if (!this.emailClient) {
      throw new Error('Email client not configured');
    }
    
    const recipients = channel.config.recipients.filter(recipient => 
      recipient.severity.includes(alert.severity)
    );
    
    if (recipients.length === 0) {
      return;
    }
    
    const subject = `[${alert.severity.toUpperCase()}] ${alert.title}`;
    const html = this.generateEmailHTML(alert);
    
    for (const recipient of recipients) {
      await this.emailClient.sendMail({
        from: channel.config.from,
        to: recipient.email,
        subject,
        html
      });
    }
  }

  /**
   * Send Slack notification
   */
  async sendSlackNotification(alert, channel) {
    if (!this.slackClient) {
      throw new Error('Slack client not configured');
    }
    
    const color = this.getSeverityColor(alert.severity);
    const blocks = this.generateSlackBlocks(alert);
    
    await this.slackClient.chat.postMessage({
      channel: channel.config.channel,
      username: channel.config.username,
      icon_emoji: channel.config.icon_emoji,
      attachments: [
        {
          color,
          blocks
        }
      ]
    });
  }

  /**
   * Send webhook notification
   */
  async sendWebhookNotification(alert, channel) {
    const payload = {
      alertId: alert.id,
      title: alert.title,
      message: alert.message,
      severity: alert.severity,
      timestamp: alert.timestamp,
      source: alert.source,
      data: alert.data
    };
    
    const response = await fetch(channel.config.url, {
      method: channel.config.method,
      headers: channel.config.headers,
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`Webhook request failed: ${response.status}`);
    }
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId, userId) {
    const alert = this.alertHistory.get(alertId);
    if (!alert) {
      throw new Error(`Alert ${alertId} not found`);
    }
    
    if (alert.acknowledged) {
      return alert;
    }
    
    alert.acknowledged = true;
    alert.acknowledgedBy = userId;
    alert.acknowledgedAt = Date.now();
    alert.status = 'acknowledged';
    
    // Cancel escalation
    alert.nextEscalation = null;
    
    this.alertHistory.set(alertId, alert);
    
    // Send acknowledgment notifications
    await this.sendAcknowledgmentNotifications(alert);
    
    logger.info('📧 Alert acknowledged', {
      alertId,
      acknowledgedBy: userId
    });
    
    return alert;
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId, userId) {
    const alert = this.alertHistory.get(alertId);
    if (!alert) {
      throw new Error(`Alert ${alertId} not found`);
    }
    
    if (alert.resolved) {
      return alert;
    }
    
    alert.resolved = true;
    alert.resolvedAt = Date.now();
    alert.status = 'resolved';
    
    // Cancel escalation
    alert.nextEscalation = null;
    
    this.alertHistory.set(alertId, alert);
    
    // Send resolution notifications
    await this.sendResolutionNotifications(alert);
    
    logger.info('📧 Alert resolved', {
      alertId,
      resolvedBy: userId
    });
    
    return alert;
  }

  /**
   * Process alert escalations
   */
  async processEscalations() {
    const now = Date.now();
    
    for (const [alertId, alert] of this.alertHistory) {
      if (!alert.nextEscalation || alert.nextEscalation > now) {
        continue;
      }
      
      if (alert.acknowledged || alert.resolved) {
        continue;
      }
      
      const rule = this.alertRules.get(alert.ruleId);
      if (!rule?.escalation?.enabled) {
        continue;
      }
      
      const escalationLevels = rule.escalation.levels;
      if (alert.escalationLevel >= escalationLevels.length) {
        continue;
      }
      
      const escalationLevel = escalationLevels[alert.escalationLevel];
      
      // Update alert with escalation
      alert.severity = escalationLevel.severity;
      alert.channels = escalationLevel.channels;
      alert.escalationLevel++;
      
      // Set next escalation time
      if (alert.escalationLevel < escalationLevels.length) {
        alert.nextEscalation = now + escalationLevels[alert.escalationLevel].delay;
      } else {
        alert.nextEscalation = null;
      }
      
      this.alertHistory.set(alertId, alert);
      
      // Send escalated notifications
      await this.sendNotifications(alert);
      
      logger.info('📧 Alert escalated', {
        alertId,
        escalationLevel: alert.escalationLevel,
        severity: alert.severity
      });
    }
  }

  /**
   * Start escalation processor
   */
  startEscalationProcessor() {
    setInterval(() => {
      this.processEscalations();
    }, 60000); // Check every minute
    
    logger.info('📧 Escalation processor started');
  }

  /**
   * Generate email HTML
   */
  generateEmailHTML(alert) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: ${this.getSeverityColor(alert.severity)}; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">${alert.severity.toUpperCase()} ALERT</h1>
        </div>
        
        <div style="padding: 20px; background: #f5f5f5;">
          <h2 style="color: #333; margin-top: 0;">${alert.title}</h2>
          <p style="color: #666; font-size: 16px; line-height: 1.6;">${alert.message}</p>
          
          <div style="background: white; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <h3 style="color: #333; margin-top: 0;">Alert Details</h3>
            <p><strong>Alert ID:</strong> ${alert.id}</p>
            <p><strong>Severity:</strong> ${alert.severity}</p>
            <p><strong>Source:</strong> ${alert.source}</p>
            <p><strong>Time:</strong> ${new Date(alert.timestamp).toISOString()}</p>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="#" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Acknowledge Alert
            </a>
          </div>
        </div>
        
        <div style="background: #333; color: white; padding: 10px; text-align: center; font-size: 12px;">
          Generated by Pi API Hub Monitoring System
        </div>
      </div>
    `;
  }

  /**
   * Generate Slack blocks
   */
  generateSlackBlocks(alert) {
    return [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${alert.severity.toUpperCase()} ALERT`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${alert.title}*\n${alert.message}`
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Alert ID:*\n${alert.id}`
          },
          {
            type: 'mrkdwn',
            text: `*Severity:*\n${alert.severity}`
          },
          {
            type: 'mrkdwn',
            text: `*Source:*\n${alert.source}`
          },
          {
            type: 'mrkdwn',
            text: `*Time:*\n${new Date(alert.timestamp).toISOString()}`
          }
        ]
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Acknowledge'
            },
            style: 'primary',
            action_id: `acknowledge_${alert.id}`
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Resolve'
            },
            style: 'danger',
            action_id: `resolve_${alert.id}`
          }
        ]
      }
    ];
  }

  /**
   * Get severity color
   */
  getSeverityColor(severity) {
    switch (severity) {
      case 'critical': return '#dc3545';
      case 'warning': return '#ffc107';
      case 'info': return '#17a2b8';
      default: return '#6c757d';
    }
  }

  /**
   * Generate alert ID
   */
  generateAlertId() {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Send acknowledgment notifications
   */
  async sendAcknowledgmentNotifications(alert) {
    // Implementation for acknowledgment notifications
  }

  /**
   * Send resolution notifications
   */
  async sendResolutionNotifications(alert) {
    // Implementation for resolution notifications
  }

  /**
   * Get alerting statistics
   */
  getAlertingStats() {
    const stats = {
      totalAlerts: this.alertHistory.size,
      activeAlerts: Array.from(this.alertHistory.values()).filter(a => a.status === 'active').length,
      acknowledgedAlerts: Array.from(this.alertHistory.values()).filter(a => a.acknowledged).length,
      resolvedAlerts: Array.from(this.alertHistory.values()).filter(a => a.resolved).length,
      totalRules: this.alertRules.size,
      totalChannels: this.alertChannels.size,
      enabledChannels: Array.from(this.alertChannels.values()).filter(c => c.enabled).length
    };
    
    return stats;
  }
}

module.exports = AlertingSystem;