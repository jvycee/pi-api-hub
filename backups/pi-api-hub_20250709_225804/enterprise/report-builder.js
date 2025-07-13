const logger = require('../shared/logger');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs').promises;

/**
 * 📊 ENTERPRISE REPORT BUILDER 📊
 * Custom reporting with drag-and-drop interface and multiple export formats
 */
class ReportBuilder {
  constructor(options = {}) {
    this.reportsPath = options.reportsPath || path.join(__dirname, '../data/reports');
    this.templatesPath = options.templatesPath || path.join(__dirname, '../data/report-templates');
    this.maxReportSize = options.maxReportSize || 10000; // Max 10k records
    this.enableScheduling = options.enableScheduling || true;
    
    // In-memory stores (would use database in production)
    this.reports = new Map();
    this.templates = new Map();
    this.scheduledReports = new Map();
    
    this.initializeReportBuilder();
    
    logger.info('📊 Enterprise Report Builder initialized');
  }

  /**
   * Initialize report builder
   */
  async initializeReportBuilder() {
    try {
      // Ensure directories exist
      await fs.mkdir(this.reportsPath, { recursive: true });
      await fs.mkdir(this.templatesPath, { recursive: true });
      
      // Load default templates
      this.createDefaultTemplates();
      
      // Start scheduled report processor
      if (this.enableScheduling) {
        this.startScheduledReportProcessor();
      }
      
      logger.info('📊 Report Builder initialization complete');
    } catch (error) {
      logger.error('Failed to initialize report builder:', error);
      throw error;
    }
  }

  /**
   * Create default report templates
   */
  createDefaultTemplates() {
    const defaultTemplates = [
      {
        id: 'api_usage_summary',
        name: 'API Usage Summary',
        description: 'Overview of API usage across all endpoints',
        category: 'analytics',
        fields: [
          { name: 'endpoint', type: 'string', label: 'Endpoint' },
          { name: 'requestCount', type: 'number', label: 'Request Count' },
          { name: 'avgResponseTime', type: 'number', label: 'Avg Response Time (ms)' },
          { name: 'errorRate', type: 'number', label: 'Error Rate (%)' },
          { name: 'lastUsed', type: 'datetime', label: 'Last Used' }
        ],
        filters: [
          { name: 'dateRange', type: 'daterange', label: 'Date Range' },
          { name: 'endpoint', type: 'select', label: 'Endpoint', options: [] }
        ],
        sorting: [
          { field: 'requestCount', direction: 'desc' }
        ],
        grouping: ['endpoint'],
        aggregations: [
          { field: 'requestCount', function: 'sum' },
          { field: 'avgResponseTime', function: 'avg' },
          { field: 'errorRate', function: 'avg' }
        ]
      },
      {
        id: 'user_activity_report',
        name: 'User Activity Report',
        description: 'Detailed user activity and behavior analysis',
        category: 'users',
        fields: [
          { name: 'userId', type: 'string', label: 'User ID' },
          { name: 'email', type: 'string', label: 'Email' },
          { name: 'lastLogin', type: 'datetime', label: 'Last Login' },
          { name: 'totalRequests', type: 'number', label: 'Total Requests' },
          { name: 'avgSessionDuration', type: 'number', label: 'Avg Session Duration (min)' }
        ],
        filters: [
          { name: 'dateRange', type: 'daterange', label: 'Date Range' },
          { name: 'userRole', type: 'select', label: 'User Role', options: ['admin', 'user', 'viewer'] }
        ],
        sorting: [
          { field: 'lastLogin', direction: 'desc' }
        ],
        grouping: ['userRole'],
        aggregations: [
          { field: 'totalRequests', function: 'sum' },
          { field: 'avgSessionDuration', function: 'avg' }
        ]
      },
      {
        id: 'performance_metrics',
        name: 'Performance Metrics',
        description: 'System performance and health metrics',
        category: 'system',
        fields: [
          { name: 'timestamp', type: 'datetime', label: 'Timestamp' },
          { name: 'cpuUsage', type: 'number', label: 'CPU Usage (%)' },
          { name: 'memoryUsage', type: 'number', label: 'Memory Usage (%)' },
          { name: 'responseTime', type: 'number', label: 'Response Time (ms)' },
          { name: 'throughput', type: 'number', label: 'Throughput (req/s)' }
        ],
        filters: [
          { name: 'dateRange', type: 'daterange', label: 'Date Range' },
          { name: 'metric', type: 'select', label: 'Metric Type', options: ['cpu', 'memory', 'response_time', 'throughput'] }
        ],
        sorting: [
          { field: 'timestamp', direction: 'desc' }
        ],
        grouping: ['hour'],
        aggregations: [
          { field: 'cpuUsage', function: 'avg' },
          { field: 'memoryUsage', function: 'avg' },
          { field: 'responseTime', function: 'avg' },
          { field: 'throughput', function: 'avg' }
        ]
      },
      {
        id: 'error_analysis',
        name: 'Error Analysis',
        description: 'Detailed error tracking and analysis',
        category: 'errors',
        fields: [
          { name: 'timestamp', type: 'datetime', label: 'Timestamp' },
          { name: 'errorType', type: 'string', label: 'Error Type' },
          { name: 'endpoint', type: 'string', label: 'Endpoint' },
          { name: 'statusCode', type: 'number', label: 'Status Code' },
          { name: 'userAgent', type: 'string', label: 'User Agent' },
          { name: 'ipAddress', type: 'string', label: 'IP Address' }
        ],
        filters: [
          { name: 'dateRange', type: 'daterange', label: 'Date Range' },
          { name: 'errorType', type: 'select', label: 'Error Type', options: [] },
          { name: 'statusCode', type: 'select', label: 'Status Code', options: ['400', '401', '403', '404', '500'] }
        ],
        sorting: [
          { field: 'timestamp', direction: 'desc' }
        ],
        grouping: ['errorType', 'statusCode'],
        aggregations: [
          { field: 'errorType', function: 'count' }
        ]
      }
    ];
    
    defaultTemplates.forEach(template => {
      this.templates.set(template.id, template);
    });
  }

  /**
   * Create a new report
   */
  async createReport(reportData, userId, tenantId) {
    try {
      const reportId = this.generateReportId();
      const timestamp = Date.now();
      
      const report = {
        id: reportId,
        name: reportData.name,
        description: reportData.description,
        templateId: reportData.templateId,
        userId,
        tenantId,
        parameters: reportData.parameters || {},
        filters: reportData.filters || [],
        sorting: reportData.sorting || [],
        grouping: reportData.grouping || [],
        format: reportData.format || 'json',
        status: 'pending',
        createdAt: timestamp,
        updatedAt: timestamp,
        completedAt: null,
        data: null,
        filePath: null,
        size: 0,
        recordCount: 0
      };
      
      this.reports.set(reportId, report);
      
      // Generate report asynchronously
      this.generateReportData(reportId);
      
      logger.info('📊 Report creation started', {
        reportId,
        templateId: reportData.templateId,
        userId,
        tenantId
      });
      
      return report;
    } catch (error) {
      logger.error('Failed to create report:', error);
      throw error;
    }
  }

  /**
   * Generate report data
   */
  async generateReportData(reportId) {
    try {
      const report = this.reports.get(reportId);
      if (!report) {
        throw new Error(`Report ${reportId} not found`);
      }
      
      const template = this.templates.get(report.templateId);
      if (!template) {
        throw new Error(`Template ${report.templateId} not found`);
      }
      
      report.status = 'processing';
      report.updatedAt = Date.now();
      
      // Fetch data based on template and filters
      const data = await this.fetchReportData(template, report.filters, report.tenantId);
      
      // Apply sorting
      const sortedData = this.applySorting(data, report.sorting || template.sorting);
      
      // Apply grouping and aggregations
      const processedData = this.applyGroupingAndAggregations(
        sortedData,
        report.grouping || template.grouping,
        template.aggregations
      );
      
      // Limit data size
      const finalData = processedData.slice(0, this.maxReportSize);
      
      report.data = finalData;
      report.recordCount = finalData.length;
      report.size = JSON.stringify(finalData).length;
      report.status = 'completed';
      report.completedAt = Date.now();
      report.updatedAt = Date.now();
      
      // Export to file if requested
      if (report.format !== 'json') {
        await this.exportReportToFile(report, template);
      }
      
      this.reports.set(reportId, report);
      
      logger.info('📊 Report generation completed', {
        reportId,
        recordCount: report.recordCount,
        size: report.size,
        format: report.format
      });
    } catch (error) {
      logger.error('Report generation failed:', error);
      
      const report = this.reports.get(reportId);
      if (report) {
        report.status = 'failed';
        report.error = error.message;
        report.updatedAt = Date.now();
        this.reports.set(reportId, report);
      }
    }
  }

  /**
   * Fetch report data based on template
   */
  async fetchReportData(template, filters, tenantId) {
    // This would integrate with your actual data sources
    // For now, returning mock data based on template category
    
    const mockData = this.generateMockData(template, filters);
    return mockData;
  }

  /**
   * Generate mock data for testing
   */
  generateMockData(template, filters) {
    const recordCount = Math.floor(Math.random() * 1000) + 100;
    const data = [];
    
    for (let i = 0; i < recordCount; i++) {
      const record = {};
      
      template.fields.forEach(field => {
        switch (field.type) {
          case 'string':
            record[field.name] = `${field.name}_${i}`;
            break;
          case 'number':
            record[field.name] = Math.floor(Math.random() * 1000);
            break;
          case 'datetime':
            record[field.name] = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);
            break;
          default:
            record[field.name] = `value_${i}`;
        }
      });
      
      data.push(record);
    }
    
    return data;
  }

  /**
   * Apply sorting to data
   */
  applySorting(data, sorting) {
    if (!sorting || sorting.length === 0) {
      return data;
    }
    
    return data.sort((a, b) => {
      for (const sort of sorting) {
        const aVal = a[sort.field];
        const bVal = b[sort.field];
        
        let comparison = 0;
        if (aVal < bVal) comparison = -1;
        else if (aVal > bVal) comparison = 1;
        
        if (comparison !== 0) {
          return sort.direction === 'desc' ? -comparison : comparison;
        }
      }
      return 0;
    });
  }

  /**
   * Apply grouping and aggregations
   */
  applyGroupingAndAggregations(data, grouping, aggregations) {
    if (!grouping || grouping.length === 0) {
      return data;
    }
    
    const groups = {};
    
    // Group data
    data.forEach(record => {
      const groupKey = grouping.map(field => record[field]).join('|');
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(record);
    });
    
    // Apply aggregations
    const result = [];
    Object.entries(groups).forEach(([groupKey, records]) => {
      const aggregatedRecord = {};
      
      // Add grouping fields
      grouping.forEach((field, index) => {
        aggregatedRecord[field] = groupKey.split('|')[index];
      });
      
      // Apply aggregations
      if (aggregations) {
        aggregations.forEach(agg => {
          const values = records.map(r => r[agg.field]).filter(v => v !== null && v !== undefined);
          
          switch (agg.function) {
            case 'sum':
              aggregatedRecord[agg.field] = values.reduce((sum, val) => sum + val, 0);
              break;
            case 'avg':
              aggregatedRecord[agg.field] = values.reduce((sum, val) => sum + val, 0) / values.length;
              break;
            case 'count':
              aggregatedRecord[agg.field] = values.length;
              break;
            case 'min':
              aggregatedRecord[agg.field] = Math.min(...values);
              break;
            case 'max':
              aggregatedRecord[agg.field] = Math.max(...values);
              break;
          }
        });
      }
      
      result.push(aggregatedRecord);
    });
    
    return result;
  }

  /**
   * Export report to file
   */
  async exportReportToFile(report, template) {
    const fileName = `${report.name.replace(/[^a-zA-Z0-9]/g, '_')}_${report.id}`;
    
    switch (report.format) {
      case 'excel':
        await this.exportToExcel(report, template, fileName);
        break;
      case 'pdf':
        await this.exportToPDF(report, template, fileName);
        break;
      case 'csv':
        await this.exportToCSV(report, template, fileName);
        break;
      default:
        throw new Error(`Unsupported format: ${report.format}`);
    }
  }

  /**
   * Export to Excel
   */
  async exportToExcel(report, template, fileName) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(report.name);
    
    // Add headers
    const headers = template.fields.map(field => field.label || field.name);
    worksheet.addRow(headers);
    
    // Add data
    report.data.forEach(record => {
      const row = template.fields.map(field => record[field.name]);
      worksheet.addRow(row);
    });
    
    // Style headers
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    
    // Auto-fit columns
    worksheet.columns.forEach(column => {
      column.width = 15;
    });
    
    const filePath = path.join(this.reportsPath, `${fileName}.xlsx`);
    await workbook.xlsx.writeFile(filePath);
    
    report.filePath = filePath;
  }

  /**
   * Export to PDF
   */
  async exportToPDF(report, template, fileName) {
    const doc = new PDFDocument();
    const filePath = path.join(this.reportsPath, `${fileName}.pdf`);
    
    doc.pipe(require('fs').createWriteStream(filePath));
    
    // Add title
    doc.fontSize(20).text(report.name, { align: 'center' });
    doc.moveDown();
    
    // Add metadata
    doc.fontSize(12).text(`Generated: ${new Date().toISOString()}`);
    doc.text(`Records: ${report.recordCount}`);
    doc.moveDown();
    
    // Add table headers
    const headers = template.fields.map(field => field.label || field.name);
    doc.fontSize(10).text(headers.join(' | '));
    doc.moveDown();
    
    // Add data (first 50 records to avoid PDF size issues)
    const limitedData = report.data.slice(0, 50);
    limitedData.forEach(record => {
      const row = template.fields.map(field => String(record[field.name] || ''));
      doc.text(row.join(' | '));
    });
    
    doc.end();
    report.filePath = filePath;
  }

  /**
   * Export to CSV
   */
  async exportToCSV(report, template, fileName) {
    const headers = template.fields.map(field => field.label || field.name);
    const csvRows = [headers.join(',')];
    
    report.data.forEach(record => {
      const row = template.fields.map(field => {
        const value = record[field.name] || '';
        return `"${String(value).replace(/"/g, '""')}"`;
      });
      csvRows.push(row.join(','));
    });
    
    const csvContent = csvRows.join('\n');
    const filePath = path.join(this.reportsPath, `${fileName}.csv`);
    
    await fs.writeFile(filePath, csvContent);
    report.filePath = filePath;
  }

  /**
   * Get report by ID
   */
  getReport(reportId) {
    return this.reports.get(reportId);
  }

  /**
   * List reports for user/tenant
   */
  listReports(userId, tenantId, options = {}) {
    const { status, templateId, limit = 50, offset = 0 } = options;
    
    let reports = Array.from(this.reports.values()).filter(report => 
      report.userId === userId && report.tenantId === tenantId
    );
    
    if (status) {
      reports = reports.filter(report => report.status === status);
    }
    
    if (templateId) {
      reports = reports.filter(report => report.templateId === templateId);
    }
    
    // Sort by creation date (newest first)
    reports.sort((a, b) => b.createdAt - a.createdAt);
    
    const total = reports.length;
    reports = reports.slice(offset, offset + limit);
    
    return {
      reports,
      total,
      limit,
      offset
    };
  }

  /**
   * Schedule a report
   */
  scheduleReport(reportData, schedule, userId, tenantId) {
    const scheduleId = this.generateScheduleId();
    
    const scheduledReport = {
      id: scheduleId,
      reportData,
      schedule, // { frequency: 'daily', time: '09:00', timezone: 'UTC' }
      userId,
      tenantId,
      enabled: true,
      lastRun: null,
      nextRun: this.calculateNextRun(schedule),
      createdAt: Date.now()
    };
    
    this.scheduledReports.set(scheduleId, scheduledReport);
    
    logger.info('📅 Report scheduled', {
      scheduleId,
      frequency: schedule.frequency,
      nextRun: scheduledReport.nextRun
    });
    
    return scheduledReport;
  }

  /**
   * Start scheduled report processor
   */
  startScheduledReportProcessor() {
    setInterval(() => {
      this.processScheduledReports();
    }, 60000); // Check every minute
    
    logger.info('📅 Scheduled report processor started');
  }

  /**
   * Process scheduled reports
   */
  async processScheduledReports() {
    const now = Date.now();
    
    for (const [scheduleId, scheduledReport] of this.scheduledReports) {
      if (scheduledReport.enabled && scheduledReport.nextRun <= now) {
        try {
          await this.runScheduledReport(scheduledReport);
        } catch (error) {
          logger.error('Scheduled report failed:', error);
        }
      }
    }
  }

  /**
   * Run a scheduled report
   */
  async runScheduledReport(scheduledReport) {
    const report = await this.createReport(
      scheduledReport.reportData,
      scheduledReport.userId,
      scheduledReport.tenantId
    );
    
    scheduledReport.lastRun = Date.now();
    scheduledReport.nextRun = this.calculateNextRun(scheduledReport.schedule);
    
    this.scheduledReports.set(scheduledReport.id, scheduledReport);
    
    logger.info('📅 Scheduled report executed', {
      scheduleId: scheduledReport.id,
      reportId: report.id,
      nextRun: scheduledReport.nextRun
    });
  }

  /**
   * Calculate next run time
   */
  calculateNextRun(schedule) {
    const now = new Date();
    const nextRun = new Date(now);
    
    switch (schedule.frequency) {
      case 'daily':
        nextRun.setDate(nextRun.getDate() + 1);
        break;
      case 'weekly':
        nextRun.setDate(nextRun.getDate() + 7);
        break;
      case 'monthly':
        nextRun.setMonth(nextRun.getMonth() + 1);
        break;
      default:
        nextRun.setHours(nextRun.getHours() + 1);
    }
    
    return nextRun.getTime();
  }

  /**
   * Generate report ID
   */
  generateReportId() {
    return `rpt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate schedule ID
   */
  generateScheduleId() {
    return `sch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get report builder statistics
   */
  getReportStats() {
    const stats = {
      totalReports: this.reports.size,
      completedReports: Array.from(this.reports.values()).filter(r => r.status === 'completed').length,
      failedReports: Array.from(this.reports.values()).filter(r => r.status === 'failed').length,
      totalTemplates: this.templates.size,
      scheduledReports: this.scheduledReports.size,
      activeSchedules: Array.from(this.scheduledReports.values()).filter(s => s.enabled).length
    };
    
    return stats;
  }
}

module.exports = ReportBuilder;