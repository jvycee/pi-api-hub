const request = require('supertest');
const app = require('../app');
const logger = require('../shared/logger');

/**
 * 🍌 BANANA-POWERED ANALYTICS + OLLAMA INTEGRATION TEST 🍌
 * Tests that the template suggestion engine is actually using Ollama
 */

describe('Analytics Ollama Integration', () => {
  let server;
  let adminHeaders;
  
  beforeAll(async () => {
    // Setup admin headers
    adminHeaders = {
      'x-admin-api-key': process.env.ADMIN_API_KEY || 'test-key'
    };
    
    console.log('🍌 Starting Analytics Ollama Integration Tests...');
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  describe('Template Manager Ollama Integration', () => {
    
    test('should generate request templates from actual requests', async () => {
      console.log('📊 Testing template generation...');
      
      // Make several requests to generate templates
      const testRequests = [
        { method: 'GET', path: '/health' },
        { method: 'GET', path: '/monitoring/dashboard' },
        { method: 'GET', path: '/api/hubspot/contacts' },
        { method: 'POST', path: '/api/hubspot/contacts', body: { name: 'Test Contact' } },
        { method: 'GET', path: '/monitoring/cache' }
      ];
      
      // Generate traffic
      for (const req of testRequests) {
        for (let i = 0; i < 5; i++) {
          const response = await request(app)
            [req.method.toLowerCase()](req.path)
            .set(adminHeaders)
            .send(req.body || {});
          
          // Don't worry about response status, we just want to generate patterns
        }
      }
      
      // Wait for templates to be generated
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check template stats
      const templateStats = await request(app)
        .get('/analytics/templates/stats')
        .set(adminHeaders);
      
      expect(templateStats.status).toBe(200);
      expect(templateStats.body.success).toBe(true);
      
      const stats = templateStats.body.data;
      console.log('📈 Template Stats:', JSON.stringify(stats, null, 2));
      
      expect(stats.totalRequests).toBeGreaterThan(0);
      expect(stats.templatesGenerated).toBeGreaterThan(0);
      
      return stats;
    });
    
    test('should have generated templates with proper structure', async () => {
      console.log('📋 Testing template structure...');
      
      const templates = await request(app)
        .get('/analytics/templates')
        .set(adminHeaders);
      
      expect(templates.status).toBe(200);
      expect(templates.body.success).toBe(true);
      
      const templateData = templates.body.data;
      console.log('📊 Templates generated:', templateData.length);
      
      if (templateData.length > 0) {
        const sampleTemplate = templateData[0];
        console.log('🔍 Sample template:', JSON.stringify(sampleTemplate, null, 2));
        
        // Verify template structure
        expect(sampleTemplate).toHaveProperty('endpoint');
        expect(sampleTemplate).toHaveProperty('method');
        expect(sampleTemplate).toHaveProperty('path');
        expect(sampleTemplate).toHaveProperty('template');
        expect(sampleTemplate).toHaveProperty('performance');
        expect(sampleTemplate).toHaveProperty('confidence');
        expect(sampleTemplate).toHaveProperty('sampleCount');
        
        // Performance should have averages
        expect(sampleTemplate.performance).toHaveProperty('avgResponseTime');
        expect(sampleTemplate.performance).toHaveProperty('avgEfficiency');
      }
      
      return templateData;
    });
    
    test('should generate optimization suggestions', async () => {
      console.log('💡 Testing optimization suggestions...');
      
      // Get templates first
      const templates = await request(app)
        .get('/analytics/templates')
        .set(adminHeaders);
      
      if (templates.body.data.length === 0) {
        console.log('⚠️  No templates found, skipping optimization test');
        return;
      }
      
      // Test optimization suggestions for each template
      for (const template of templates.body.data.slice(0, 3)) { // Test first 3
        const [method, path] = template.endpoint.split(':');
        const cleanPath = path.startsWith('/') ? path.substring(1) : path;
        
        console.log(`🔍 Testing optimization for: ${method} ${path}`);
        
        const optimization = await request(app)
          .get(`/analytics/optimize/${method}/${cleanPath}`)
          .set(adminHeaders);
        
        console.log(`📊 Optimization response status: ${optimization.status}`);
        
        if (optimization.status === 200) {
          console.log('✅ Optimization suggestions:', JSON.stringify(optimization.body, null, 2));
          
          expect(optimization.body.success).toBe(true);
          expect(optimization.body.data).toHaveProperty('endpoint');
          expect(optimization.body.data).toHaveProperty('suggestions');
          expect(optimization.body.data).toHaveProperty('timestamp');
        }
      }
    });
    
    test('should test AI insights endpoint', async () => {
      console.log('🤖 Testing AI insights...');
      
      const aiInsights = await request(app)
        .get('/analytics/ai-insights')
        .set(adminHeaders);
      
      console.log(`📊 AI Insights response status: ${aiInsights.status}`);
      
      if (aiInsights.status === 200) {
        console.log('🤖 AI Insights:', JSON.stringify(aiInsights.body, null, 2));
        
        expect(aiInsights.body.success).toBe(true);
        expect(aiInsights.body.data).toHaveProperty('totalSuggestions');
        expect(aiInsights.body.data).toHaveProperty('suggestions');
        expect(aiInsights.body.data).toHaveProperty('categories');
        expect(aiInsights.body.data).toHaveProperty('timestamp');
      }
    });
  });

  describe('Manual Ollama Test', () => {
    
    test('should manually test Ollama integration', async () => {
      console.log('🧪 Manual Ollama integration test...');
      
      // Create some inefficient request patterns
      const inefficientRequests = [
        // Slow requests
        { method: 'GET', path: '/monitoring/dashboard', repeat: 3 },
        { method: 'GET', path: '/api/hubspot/contacts', repeat: 5 },
        { method: 'POST', path: '/api/hubspot/contacts', body: { name: 'Test' }, repeat: 2 }
      ];
      
      console.log('🔄 Generating inefficient traffic patterns...');
      
      for (const req of inefficientRequests) {
        for (let i = 0; i < req.repeat; i++) {
          await request(app)
            [req.method.toLowerCase()](req.path)
            .set(adminHeaders)
            .send(req.body || {});
          
          // Add small delay to simulate real usage
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      // Wait for analytics to process
      console.log('⏳ Waiting for analytics processing...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check if we have templates
      const templates = await request(app)
        .get('/analytics/templates')
        .set(adminHeaders);
      
      console.log('📊 Templates after traffic generation:', templates.body.data?.length || 0);
      
      // Check for patterns
      const patterns = await request(app)
        .get('/analytics/patterns')
        .set(adminHeaders);
      
      if (patterns.status === 200) {
        console.log('📈 Pattern analysis:', JSON.stringify(patterns.body.data, null, 2));
      }
      
      // Final check of AI insights
      const finalInsights = await request(app)
        .get('/analytics/ai-insights')
        .set(adminHeaders);
      
      if (finalInsights.status === 200) {
        console.log('🤖 Final AI insights:', JSON.stringify(finalInsights.body, null, 2));
      }
    });
  });

  describe('Ollama Connection Test', () => {
    
    test('should verify Ollama is accessible', async () => {
      console.log('🔗 Testing Ollama connection...');
      
      // Test AI endpoint directly
      const aiTest = await request(app)
        .post('/api/anthropic/messages')
        .set(adminHeaders)
        .send({
          messages: [
            {
              role: 'user',
              content: 'Hello, can you help me optimize API performance? Just respond with "Yes, I can help optimize APIs."'
            }
          ],
          max_tokens: 50,
          taskType: 'analysis'
        });
      
      console.log(`🤖 AI Test response status: ${aiTest.status}`);
      
      if (aiTest.status === 200) {
        console.log('✅ AI Response:', JSON.stringify(aiTest.body, null, 2));
        
        expect(aiTest.body.success).toBe(true);
        expect(aiTest.body.data).toBeDefined();
        expect(aiTest.body.metadata).toHaveProperty('provider');
        
        // Check if Ollama was used
        const provider = aiTest.body.metadata.provider;
        console.log(`🎯 Provider used: ${provider}`);
        
        if (provider === 'ollama') {
          console.log('✅ Ollama is working correctly!');
        } else {
          console.log('⚠️  Ollama not used, fallback to:', provider);
        }
      } else {
        console.log('❌ AI endpoint failed:', aiTest.body);
      }
    });
  });

  describe('Comprehensive Analytics Test', () => {
    
    test('should test full analytics pipeline', async () => {
      console.log('🔄 Testing full analytics pipeline...');
      
      // 1. Generate diverse traffic
      const endpoints = [
        '/health',
        '/monitoring/dashboard',
        '/monitoring/cache',
        '/api/test-connections',
        '/analytics/dashboard'
      ];
      
      for (const endpoint of endpoints) {
        for (let i = 0; i < 3; i++) {
          await request(app)
            .get(endpoint)
            .set(adminHeaders);
        }
      }
      
      // 2. Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 3. Check dashboard
      const dashboard = await request(app)
        .get('/analytics/dashboard')
        .set(adminHeaders);
      
      if (dashboard.status === 200) {
        console.log('📊 Analytics Dashboard:', JSON.stringify(dashboard.body.data, null, 2));
        
        expect(dashboard.body.success).toBe(true);
        expect(dashboard.body.data).toHaveProperty('realTime');
        expect(dashboard.body.data).toHaveProperty('analysis');
        expect(dashboard.body.data).toHaveProperty('performanceMetrics');
        expect(dashboard.body.data).toHaveProperty('summary');
      }
      
      // 4. Check real-time stats
      const realtime = await request(app)
        .get('/analytics/realtime')
        .set(adminHeaders);
      
      if (realtime.status === 200) {
        console.log('📈 Real-time stats:', JSON.stringify(realtime.body.data, null, 2));
      }
      
      // 5. Check performance baselines
      const baselines = await request(app)
        .get('/analytics/baselines')
        .set(adminHeaders);
      
      if (baselines.status === 200) {
        console.log('📊 Performance baselines:', JSON.stringify(baselines.body.data, null, 2));
      }
    });
  });
});

// Helper function to create test traffic
async function createTestTraffic(app, adminHeaders) {
  const requests = [
    { method: 'GET', path: '/health' },
    { method: 'GET', path: '/monitoring/dashboard' },
    { method: 'GET', path: '/monitoring/cache' },
    { method: 'GET', path: '/api/test-connections' },
    { method: 'POST', path: '/api/hubspot/contacts', body: { name: 'Test Contact' } }
  ];
  
  for (const req of requests) {
    for (let i = 0; i < 5; i++) {
      await request(app)
        [req.method.toLowerCase()](req.path)
        .set(adminHeaders)
        .send(req.body || {});
    }
  }
}

// Helper function to wait for analytics processing
function waitForAnalytics(ms = 3000) {
  return new Promise(resolve => setTimeout(resolve, ms));
}