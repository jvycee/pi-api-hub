const logger = require('../shared/logger');
const { performance } = require('perf_hooks');

/**
 * 🍌 BANANA-POWERED REQUEST TEMPLATE MANAGER 🍌
 * Learns from requests and generates optimization suggestions using Ollama
 */
class RequestTemplateManager {
  constructor(aiHandler, options = {}) {
    this.aiHandler = aiHandler;
    this.maxTemplates = options.maxTemplates || 1000;
    this.analysisInterval = options.analysisInterval || 5 * 60 * 1000; // 5 minutes
    this.minSampleSize = options.minSampleSize || 10;
    this.confidenceThreshold = options.confidenceThreshold || 0.7;
    
    // Template storage
    this.requestTemplates = new Map();
    this.endpointPatterns = new Map();
    this.optimizationSuggestions = new Map();
    
    // Learning data
    this.requestSamples = [];
    this.performanceBaselines = new Map();
    
    // Analysis state
    this.lastAnalysis = null;
    this.totalRequests = 0;
    this.templatesGenerated = 0;
    
    this.startAnalysisTimer();
    
    logger.info('🍌 Request Template Manager initialized', {
      maxTemplates: this.maxTemplates,
      analysisInterval: this.analysisInterval,
      minSampleSize: this.minSampleSize
    });
  }

  /**
   * Record a request for template learning
   */
  recordRequest(req, res, responseTime) {
    const template = this.extractRequestTemplate(req, res, responseTime);
    
    // Store sample for analysis
    this.requestSamples.push(template);
    this.totalRequests++;
    
    // Maintain sample size
    if (this.requestSamples.length > this.maxTemplates * 2) {
      this.requestSamples.shift();
    }
    
    // Update endpoint patterns
    this.updateEndpointPattern(template);
    
    // Update performance baseline
    this.updatePerformanceBaseline(template);
    
    // Generate/update template
    this.generateTemplate(template);
  }

  /**
   * Extract request template from request/response
   */
  extractRequestTemplate(req, res, responseTime) {
    const template = {
      // Request metadata
      method: req.method,
      path: this.normalizePath(req.path),
      timestamp: Date.now(),
      
      // Request characteristics
      hasAuth: !!req.headers.authorization,
      hasApiKey: !!req.headers['x-admin-api-key'],
      contentType: req.headers['content-type'] || 'none',
      userAgent: this.categorizeUserAgent(req.headers['user-agent']),
      
      // Request structure
      hasQuery: Object.keys(req.query || {}).length > 0,
      queryParams: this.extractQueryStructure(req.query),
      hasBody: !!req.body,
      bodyStructure: this.extractBodyStructure(req.body),
      
      // Response characteristics
      statusCode: res.statusCode,
      responseTime,
      responseSize: res.get('Content-Length') || 0,
      
      // Performance metrics
      isSlowRequest: responseTime > 1000,
      isErrorResponse: res.statusCode >= 400,
      
      // Context
      hour: new Date().getHours(),
      dayOfWeek: new Date().getDay(),
      
      // Efficiency metrics
      efficiency: this.calculateEfficiency(req, res, responseTime)
    };
    
    return template;
  }

  /**
   * Normalize path for pattern matching
   */
  normalizePath(path) {
    // Replace IDs and dynamic segments with placeholders
    return path
      .replace(/\/\d+/g, '/{id}')
      .replace(/\/[a-f0-9-]{36}/g, '/{uuid}')
      .replace(/\/[a-f0-9]{24}/g, '/{objectId}')
      .replace(/\/[^\/]+@[^\/]+\.[^\/]+/g, '/{email}');
  }

  /**
   * Categorize user agent for pattern detection
   */
  categorizeUserAgent(userAgent) {
    if (!userAgent) return 'unknown';
    
    const ua = userAgent.toLowerCase();
    
    if (ua.includes('bot') || ua.includes('crawler') || ua.includes('spider')) {
      return 'bot';
    }
    if (ua.includes('postman') || ua.includes('insomnia')) {
      return 'api_client';
    }
    if (ua.includes('curl') || ua.includes('wget')) {
      return 'command_line';
    }
    if (ua.includes('python') || ua.includes('java') || ua.includes('node')) {
      return 'sdk';
    }
    if (ua.includes('chrome') || ua.includes('firefox') || ua.includes('safari')) {
      return 'browser';
    }
    
    return 'other';
  }

  /**
   * Extract query parameter structure
   */
  extractQueryStructure(query) {
    if (!query || Object.keys(query).length === 0) return null;
    
    const structure = {};
    for (const [key, value] of Object.entries(query)) {
      structure[key] = {
        type: this.detectValueType(value),
        hasValue: !!value,
        length: String(value).length
      };
    }
    
    return structure;
  }

  /**
   * Extract body structure
   */
  extractBodyStructure(body) {
    if (!body) return null;
    
    if (typeof body === 'object') {
      const structure = {};
      for (const [key, value] of Object.entries(body)) {
        structure[key] = {
          type: this.detectValueType(value),
          hasValue: value !== null && value !== undefined,
          isArray: Array.isArray(value),
          length: Array.isArray(value) ? value.length : String(value).length
        };
      }
      return structure;
    }
    
    return {
      type: typeof body,
      length: String(body).length
    };
  }

  /**
   * Detect value type
   */
  detectValueType(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    if (typeof value === 'string' && /^\d+$/.test(value)) return 'numeric_string';
    if (typeof value === 'string' && /^[\w-]+@[\w-]+\.[\w-]+$/.test(value)) return 'email';
    if (typeof value === 'string' && /^https?:\/\//.test(value)) return 'url';
    
    return typeof value;
  }

  /**
   * Calculate request efficiency
   */
  calculateEfficiency(req, res, responseTime) {
    let score = 100;
    
    // Response time penalty
    if (responseTime > 1000) score -= 30;
    else if (responseTime > 500) score -= 15;
    else if (responseTime > 100) score -= 5;
    
    // Status code penalty
    if (res.statusCode >= 500) score -= 40;
    else if (res.statusCode >= 400) score -= 20;
    
    // Large response penalty
    const responseSize = res.get('Content-Length') || 0;
    if (responseSize > 1000000) score -= 20; // 1MB
    else if (responseSize > 100000) score -= 10; // 100KB
    
    // Method-specific adjustments
    if (req.method === 'GET' && req.body) score -= 10; // GET with body
    if (req.method === 'POST' && !req.body) score -= 15; // POST without body
    
    return Math.max(0, score);
  }

  /**
   * Update endpoint pattern
   */
  updateEndpointPattern(template) {
    const endpointKey = `${template.method}:${template.path}`;
    
    if (!this.endpointPatterns.has(endpointKey)) {
      this.endpointPatterns.set(endpointKey, {
        samples: [],
        avgResponseTime: 0,
        avgEfficiency: 0,
        commonPatterns: {},
        lastUpdated: Date.now()
      });
    }
    
    const pattern = this.endpointPatterns.get(endpointKey);
    pattern.samples.push(template);
    
    // Keep only recent samples
    if (pattern.samples.length > 100) {
      pattern.samples.shift();
    }
    
    // Update averages
    pattern.avgResponseTime = pattern.samples.reduce((sum, s) => sum + s.responseTime, 0) / pattern.samples.length;
    pattern.avgEfficiency = pattern.samples.reduce((sum, s) => sum + s.efficiency, 0) / pattern.samples.length;
    
    // Update common patterns
    this.updateCommonPatterns(pattern, template);
    
    pattern.lastUpdated = Date.now();
  }

  /**
   * Update common patterns for endpoint
   */
  updateCommonPatterns(pattern, template) {
    // Query parameter patterns
    if (template.queryParams) {
      const queryKey = 'queryParams';
      if (!pattern.commonPatterns[queryKey]) {
        pattern.commonPatterns[queryKey] = new Map();
      }
      
      const querySignature = JSON.stringify(Object.keys(template.queryParams).sort());
      const count = pattern.commonPatterns[queryKey].get(querySignature) || 0;
      pattern.commonPatterns[queryKey].set(querySignature, count + 1);
    }
    
    // Body structure patterns
    if (template.bodyStructure) {
      const bodyKey = 'bodyStructure';
      if (!pattern.commonPatterns[bodyKey]) {
        pattern.commonPatterns[bodyKey] = new Map();
      }
      
      const bodySignature = JSON.stringify(Object.keys(template.bodyStructure).sort());
      const count = pattern.commonPatterns[bodyKey].get(bodySignature) || 0;
      pattern.commonPatterns[bodyKey].set(bodySignature, count + 1);
    }
    
    // User agent patterns
    const uaKey = 'userAgent';
    if (!pattern.commonPatterns[uaKey]) {
      pattern.commonPatterns[uaKey] = new Map();
    }
    
    const count = pattern.commonPatterns[uaKey].get(template.userAgent) || 0;
    pattern.commonPatterns[uaKey].set(template.userAgent, count + 1);
  }

  /**
   * Generate template from patterns
   */
  generateTemplate(template) {
    const endpointKey = `${template.method}:${template.path}`;
    
    if (!this.requestTemplates.has(endpointKey)) {
      this.requestTemplates.set(endpointKey, {
        endpoint: endpointKey,
        method: template.method,
        path: template.path,
        template: {
          expectedQuery: null,
          expectedBody: null,
          expectedHeaders: null,
          expectedResponse: null
        },
        performance: {
          avgResponseTime: 0,
          avgEfficiency: 0,
          recommendations: []
        },
        confidence: 0,
        sampleCount: 0,
        lastGenerated: Date.now()
      });
      
      this.templatesGenerated++;
    }
    
    const requestTemplate = this.requestTemplates.get(endpointKey);
    requestTemplate.sampleCount++;
    
    // Update template based on patterns
    this.updateRequestTemplate(requestTemplate, template);
  }

  /**
   * Update request template based on new sample
   */
  updateRequestTemplate(requestTemplate, sample) {
    const weight = Math.min(requestTemplate.sampleCount, 50); // Max weight of 50
    
    // Update performance metrics
    requestTemplate.performance.avgResponseTime = 
      (requestTemplate.performance.avgResponseTime * (weight - 1) + sample.responseTime) / weight;
    
    requestTemplate.performance.avgEfficiency = 
      (requestTemplate.performance.avgEfficiency * (weight - 1) + sample.efficiency) / weight;
    
    // Update expected structures
    if (sample.queryParams) {
      requestTemplate.template.expectedQuery = sample.queryParams;
    }
    
    if (sample.bodyStructure) {
      requestTemplate.template.expectedBody = sample.bodyStructure;
    }
    
    // Update confidence
    requestTemplate.confidence = Math.min(requestTemplate.sampleCount / this.minSampleSize, 1.0);
    
    requestTemplate.lastGenerated = Date.now();
  }

  /**
   * Analyze patterns and generate Ollama suggestions
   */
  async analyzeWithOllama() {
    try {
      const inefficientEndpoints = this.findInefficientEndpoints();
      const commonPatterns = this.findCommonPatterns();
      
      if (inefficientEndpoints.length === 0) {
        logger.info('🍌 No inefficient endpoints detected');
        return;
      }
      
      // Prepare analysis data for Ollama
      const analysisData = {
        inefficientEndpoints: inefficientEndpoints.slice(0, 5), // Top 5
        commonPatterns,
        totalRequests: this.totalRequests,
        templatesGenerated: this.templatesGenerated
      };
      
      // Generate Ollama prompt
      const prompt = this.generateOllamaPrompt(analysisData);
      
      // Get suggestions from Ollama
      const ollamaResponse = await this.aiHandler.processAIRequest([{
        role: 'user',
        content: prompt
      }], {
        taskType: 'analysis',
        model: 'llama3.2:latest'
      });
      
      // Parse and store suggestions
      const suggestions = this.parseOllamaSuggestions(ollamaResponse.response);
      
      // Store suggestions
      for (const suggestion of suggestions) {
        this.optimizationSuggestions.set(suggestion.endpoint, suggestion);
      }
      
      logger.info('🤖 Ollama analysis completed', {
        inefficientEndpoints: inefficientEndpoints.length,
        suggestionsGenerated: suggestions.length
      });
      
      return suggestions;
      
    } catch (error) {
      logger.error('Ollama analysis failed:', error);
      return [];
    }
  }

  /**
   * Find inefficient endpoints
   */
  findInefficientEndpoints() {
    const inefficient = [];
    
    for (const [endpoint, template] of this.requestTemplates) {
      if (template.confidence < this.confidenceThreshold) continue;
      
      // Check for inefficiency indicators
      const issues = [];
      
      if (template.performance.avgResponseTime > 1000) {
        issues.push('slow_response');
      }
      
      if (template.performance.avgEfficiency < 70) {
        issues.push('low_efficiency');
      }
      
      const pattern = this.endpointPatterns.get(endpoint);
      if (pattern) {
        const errorRate = pattern.samples.filter(s => s.isErrorResponse).length / pattern.samples.length;
        if (errorRate > 0.1) {
          issues.push('high_error_rate');
        }
      }
      
      if (issues.length > 0) {
        inefficient.push({
          endpoint,
          issues,
          avgResponseTime: template.performance.avgResponseTime,
          avgEfficiency: template.performance.avgEfficiency,
          sampleCount: template.sampleCount,
          template: template.template
        });
      }
    }
    
    return inefficient.sort((a, b) => b.avgResponseTime - a.avgResponseTime);
  }

  /**
   * Find common patterns across all endpoints
   */
  findCommonPatterns() {
    const patterns = {
      slowEndpoints: [],
      commonQueryParams: new Map(),
      commonBodyStructures: new Map(),
      userAgentDistribution: new Map()
    };
    
    for (const [endpoint, pattern] of this.endpointPatterns) {
      if (pattern.avgResponseTime > 500) {
        patterns.slowEndpoints.push({
          endpoint,
          avgResponseTime: pattern.avgResponseTime,
          avgEfficiency: pattern.avgEfficiency
        });
      }
      
      // Aggregate common patterns
      if (pattern.commonPatterns.queryParams) {
        for (const [query, count] of pattern.commonPatterns.queryParams) {
          patterns.commonQueryParams.set(query, (patterns.commonQueryParams.get(query) || 0) + count);
        }
      }
      
      if (pattern.commonPatterns.userAgent) {
        for (const [ua, count] of pattern.commonPatterns.userAgent) {
          patterns.userAgentDistribution.set(ua, (patterns.userAgentDistribution.get(ua) || 0) + count);
        }
      }
    }
    
    return patterns;
  }

  /**
   * Generate Ollama prompt for analysis
   */
  generateOllamaPrompt(analysisData) {
    return `You are a performance optimization expert analyzing API request patterns. 

ANALYSIS DATA:
- Total requests analyzed: ${analysisData.totalRequests}
- Templates generated: ${analysisData.templatesGenerated}
- Inefficient endpoints found: ${analysisData.inefficientEndpoints.length}

INEFFICIENT ENDPOINTS:
${analysisData.inefficientEndpoints.map(e => `
- ${e.endpoint}
  - Average response time: ${e.avgResponseTime.toFixed(2)}ms
  - Efficiency score: ${e.avgEfficiency.toFixed(2)}%
  - Issues: ${e.issues.join(', ')}
  - Sample count: ${e.sampleCount}
`).join('')}

COMMON PATTERNS:
- Slow endpoints: ${analysisData.commonPatterns.slowEndpoints.length}
- Common query patterns: ${analysisData.commonPatterns.commonQueryParams.size}
- User agent types: ${analysisData.commonPatterns.userAgentDistribution.size}

Please provide specific, actionable optimization recommendations for each inefficient endpoint. Format your response as JSON with this structure:

{
  "suggestions": [
    {
      "endpoint": "endpoint_name",
      "priority": "high|medium|low",
      "category": "caching|query_optimization|response_optimization|request_structure",
      "recommendation": "specific action to take",
      "expectedImprovement": "percentage improvement expected",
      "implementation": "how to implement this change"
    }
  ]
}

Focus on:
1. Response time improvements
2. Caching opportunities
3. Query/body structure optimizations
4. Request pattern standardization
5. Error reduction strategies

Be specific and actionable. Consider that this is a Raspberry Pi 5 system with 8GB RAM and 4 CPU cores.`;
  }

  /**
   * Parse Ollama suggestions
   */
  parseOllamaSuggestions(ollamaResponse) {
    try {
      // Extract JSON from response
      const jsonMatch = ollamaResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.warn('No JSON found in Ollama response');
        return [];
      }
      
      const { safeParse } = require('../shared/safe-json');
      const parsed = safeParse(jsonMatch[0]);
      
      if (!parsed.suggestions || !Array.isArray(parsed.suggestions)) {
        logger.warn('Invalid suggestions format from Ollama');
        return [];
      }
      
      return parsed.suggestions.map(suggestion => ({
        ...suggestion,
        timestamp: Date.now(),
        source: 'ollama'
      }));
      
    } catch (error) {
      logger.error('Failed to parse Ollama suggestions:', error);
      return [];
    }
  }

  /**
   * Get optimization suggestions for endpoint
   */
  getOptimizationSuggestions(endpoint) {
    const suggestions = [];
    
    // Get stored Ollama suggestions
    const ollamaSuggestion = this.optimizationSuggestions.get(endpoint);
    if (ollamaSuggestion) {
      suggestions.push(ollamaSuggestion);
    }
    
    // Get template-based suggestions
    const template = this.requestTemplates.get(endpoint);
    if (template) {
      const templateSuggestions = this.generateTemplateSuggestions(template);
      suggestions.push(...templateSuggestions);
    }
    
    return suggestions;
  }

  /**
   * Generate template-based suggestions
   */
  generateTemplateSuggestions(template) {
    const suggestions = [];
    
    if (template.performance.avgResponseTime > 1000) {
      suggestions.push({
        endpoint: template.endpoint,
        priority: 'high',
        category: 'performance',
        recommendation: 'Response time exceeds 1 second - consider caching or query optimization',
        expectedImprovement: '50-80%',
        implementation: 'Add caching layer or optimize database queries',
        source: 'template'
      });
    }
    
    if (template.performance.avgEfficiency < 70) {
      suggestions.push({
        endpoint: template.endpoint,
        priority: 'medium',
        category: 'efficiency',
        recommendation: 'Low efficiency score - review request/response structure',
        expectedImprovement: '20-40%',
        implementation: 'Optimize request validation and response formatting',
        source: 'template'
      });
    }
    
    return suggestions;
  }

  /**
   * Get template statistics
   */
  getTemplateStats() {
    const stats = {
      totalRequests: this.totalRequests,
      templatesGenerated: this.templatesGenerated,
      endpointPatterns: this.endpointPatterns.size,
      optimizationSuggestions: this.optimizationSuggestions.size,
      
      efficiency: {
        avgEfficiency: 0,
        highEfficiencyEndpoints: 0,
        lowEfficiencyEndpoints: 0
      },
      
      performance: {
        avgResponseTime: 0,
        fastEndpoints: 0,
        slowEndpoints: 0
      },
      
      topTemplates: []
    };
    
    if (this.requestTemplates.size > 0) {
      let totalEfficiency = 0;
      let totalResponseTime = 0;
      
      for (const template of this.requestTemplates.values()) {
        totalEfficiency += template.performance.avgEfficiency;
        totalResponseTime += template.performance.avgResponseTime;
        
        if (template.performance.avgEfficiency > 80) {
          stats.efficiency.highEfficiencyEndpoints++;
        } else if (template.performance.avgEfficiency < 60) {
          stats.efficiency.lowEfficiencyEndpoints++;
        }
        
        if (template.performance.avgResponseTime < 100) {
          stats.performance.fastEndpoints++;
        } else if (template.performance.avgResponseTime > 1000) {
          stats.performance.slowEndpoints++;
        }
      }
      
      stats.efficiency.avgEfficiency = totalEfficiency / this.requestTemplates.size;
      stats.performance.avgResponseTime = totalResponseTime / this.requestTemplates.size;
      
      // Get top templates by sample count
      stats.topTemplates = Array.from(this.requestTemplates.values())
        .sort((a, b) => b.sampleCount - a.sampleCount)
        .slice(0, 10)
        .map(t => ({
          endpoint: t.endpoint,
          sampleCount: t.sampleCount,
          avgResponseTime: t.performance.avgResponseTime,
          avgEfficiency: t.performance.avgEfficiency,
          confidence: t.confidence
        }));
    }
    
    return stats;
  }

  /**
   * Get template for specific endpoint
   */
  getEndpointTemplate(endpoint) {
    return this.requestTemplates.get(endpoint);
  }

  /**
   * Get all templates
   */
  getAllTemplates() {
    return Array.from(this.requestTemplates.values());
  }

  /**
   * Start periodic analysis
   */
  startAnalysisTimer() {
    setInterval(async () => {
      if (this.requestTemplates.size >= this.minSampleSize) {
        await this.analyzeWithOllama();
      }
    }, this.analysisInterval);
  }

  /**
   * Update performance baseline
   */
  updatePerformanceBaseline(template) {
    const key = `${template.method}:${template.path}`;
    
    if (!this.performanceBaselines.has(key)) {
      this.performanceBaselines.set(key, {
        bestResponseTime: template.responseTime,
        avgResponseTime: template.responseTime,
        worstResponseTime: template.responseTime,
        sampleCount: 1
      });
    } else {
      const baseline = this.performanceBaselines.get(key);
      baseline.bestResponseTime = Math.min(baseline.bestResponseTime, template.responseTime);
      baseline.worstResponseTime = Math.max(baseline.worstResponseTime, template.responseTime);
      baseline.avgResponseTime = (baseline.avgResponseTime * baseline.sampleCount + template.responseTime) / (baseline.sampleCount + 1);
      baseline.sampleCount++;
    }
  }

  /**
   * Get performance baselines
   */
  getPerformanceBaselines() {
    return Array.from(this.performanceBaselines.entries()).map(([endpoint, baseline]) => ({
      endpoint,
      ...baseline
    }));
  }
}

module.exports = RequestTemplateManager;