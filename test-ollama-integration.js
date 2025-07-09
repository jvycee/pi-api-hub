#!/usr/bin/env node

/**
 * 🍌 BANANA-POWERED OLLAMA INTEGRATION TEST 🍌
 * Manual test script to verify template suggestion engine uses Ollama
 */

const axios = require('axios');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'your-admin-key';

const headers = {
  'x-admin-api-key': ADMIN_API_KEY,
  'Content-Type': 'application/json'
};

// Colors for output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function testOllamaConnection() {
  log('blue', '\n🔗 Testing Ollama Connection...');
  
  try {
    const response = await axios.post(`${BASE_URL}/api/anthropic/messages`, {
      messages: [
        {
          role: 'user',
          content: 'Hello! Can you help me optimize API performance? Please respond with exactly: "Yes, I can help optimize APIs using Ollama."'
        }
      ],
      max_tokens: 50,
      taskType: 'analysis'
    }, { headers });
    
    if (response.data.success) {
      log('green', '✅ AI endpoint responded successfully');
      log('cyan', `🎯 Provider used: ${response.data.metadata.provider}`);
      log('cyan', `📊 Response: ${JSON.stringify(response.data.data, null, 2)}`);
      
      if (response.data.metadata.provider === 'ollama') {
        log('green', '🎉 OLLAMA IS WORKING!');
        return true;
      } else {
        log('yellow', '⚠️  Using fallback provider, not Ollama');
        return false;
      }
    } else {
      log('red', '❌ AI endpoint failed');
      return false;
    }
  } catch (error) {
    log('red', `❌ Connection failed: ${error.message}`);
    return false;
  }
}

async function generateTrafficForTemplates() {
  log('blue', '\n🔄 Generating traffic to create templates...');
  
  const endpoints = [
    { method: 'GET', path: '/health' },
    { method: 'GET', path: '/monitoring/dashboard' },
    { method: 'GET', path: '/monitoring/cache' },
    { method: 'GET', path: '/api/test-connections' },
    { method: 'POST', path: '/api/hubspot/contacts', data: { name: 'Test Contact', email: 'test@example.com' } }
  ];
  
  let totalRequests = 0;
  
  for (const endpoint of endpoints) {
    log('cyan', `📊 Testing ${endpoint.method} ${endpoint.path}...`);
    
    for (let i = 0; i < 8; i++) { // Generate enough samples
      try {
        const config = {
          method: endpoint.method.toLowerCase(),
          url: `${BASE_URL}${endpoint.path}`,
          headers,
          ...(endpoint.data && { data: endpoint.data })
        };
        
        await axios(config);
        totalRequests++;
        
        // Small delay to simulate real usage
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        // Ignore errors, we just want to generate patterns
      }
    }
  }
  
  log('green', `✅ Generated ${totalRequests} requests across ${endpoints.length} endpoints`);
  
  // Wait for analytics to process
  log('yellow', '⏳ Waiting for analytics processing...');
  await new Promise(resolve => setTimeout(resolve, 3000));
}

async function checkTemplateStats() {
  log('blue', '\n📊 Checking template statistics...');
  
  try {
    const response = await axios.get(`${BASE_URL}/analytics/templates/stats`, { headers });
    
    if (response.data.success) {
      const stats = response.data.data;
      log('green', '✅ Template stats retrieved');
      log('cyan', `📈 Total Requests: ${stats.totalRequests}`);
      log('cyan', `📋 Templates Generated: ${stats.templatesGenerated}`);
      log('cyan', `📊 Endpoint Patterns: ${stats.endpointPatterns}`);
      log('cyan', `💡 Optimization Suggestions: ${stats.optimizationSuggestions}`);
      log('cyan', `⚡ Average Efficiency: ${stats.efficiency.avgEfficiency.toFixed(2)}%`);
      log('cyan', `🚀 Average Response Time: ${stats.performance.avgResponseTime.toFixed(2)}ms`);
      
      return stats;
    } else {
      log('red', '❌ Failed to get template stats');
      return null;
    }
  } catch (error) {
    log('red', `❌ Error getting template stats: ${error.message}`);
    return null;
  }
}

async function checkAIInsights() {
  log('blue', '\n🤖 Checking AI-powered insights...');
  
  try {
    const response = await axios.get(`${BASE_URL}/analytics/ai-insights`, { headers });
    
    if (response.data.success) {
      const insights = response.data.data;
      log('green', '✅ AI insights retrieved');
      log('cyan', `💡 Total Suggestions: ${insights.totalSuggestions}`);
      
      if (insights.suggestions && insights.suggestions.length > 0) {
        log('green', '🎉 OLLAMA GENERATED SUGGESTIONS FOUND!');
        
        insights.suggestions.forEach((suggestion, index) => {
          log('magenta', `\n📋 Suggestion ${index + 1}:`);
          log('cyan', `   🎯 Endpoint: ${suggestion.endpoint}`);
          log('cyan', `   📊 Priority: ${suggestion.priority}`);
          log('cyan', `   🏷️  Category: ${suggestion.category}`);
          log('cyan', `   💡 Recommendation: ${suggestion.recommendation}`);
          log('cyan', `   📈 Expected Improvement: ${suggestion.expectedImprovement}`);
          log('cyan', `   🔧 Implementation: ${suggestion.implementation}`);
          log('cyan', `   🤖 Source: ${suggestion.source}`);
        });
        
        return insights;
      } else {
        log('yellow', '⚠️  No AI suggestions found yet');
        return null;
      }
    } else {
      log('red', '❌ Failed to get AI insights');
      return null;
    }
  } catch (error) {
    log('red', `❌ Error getting AI insights: ${error.message}`);
    return null;
  }
}

async function testOptimizationSuggestions() {
  log('blue', '\n💡 Testing optimization suggestions...');
  
  try {
    // Get all templates first
    const templatesResponse = await axios.get(`${BASE_URL}/analytics/templates`, { headers });
    
    if (templatesResponse.data.success && templatesResponse.data.data.length > 0) {
      const templates = templatesResponse.data.data;
      log('green', `✅ Found ${templates.length} templates`);
      
      // Test optimization for first few templates
      for (const template of templates.slice(0, 3)) {
        const [method, path] = template.endpoint.split(':');
        const cleanPath = path.startsWith('/') ? path.substring(1) : path;
        
        log('cyan', `🔍 Testing optimization for: ${method} ${path}`);
        
        try {
          const optimizationResponse = await axios.get(
            `${BASE_URL}/analytics/optimize/${method}/${cleanPath}`,
            { headers }
          );
          
          if (optimizationResponse.data.success) {
            const suggestions = optimizationResponse.data.data.suggestions;
            log('green', `✅ Got ${suggestions.length} suggestions for ${template.endpoint}`);
            
            suggestions.forEach((suggestion, index) => {
              log('magenta', `   💡 Suggestion ${index + 1}: ${suggestion.recommendation}`);
              log('cyan', `      🎯 Priority: ${suggestion.priority}`);
              log('cyan', `      🤖 Source: ${suggestion.source}`);
            });
          }
        } catch (error) {
          log('yellow', `⚠️  No optimization suggestions for ${template.endpoint}`);
        }
      }
    } else {
      log('yellow', '⚠️  No templates found');
    }
  } catch (error) {
    log('red', `❌ Error testing optimization suggestions: ${error.message}`);
  }
}

async function monitorOllamaUsage() {
  log('blue', '\n👀 Monitoring Ollama usage...');
  
  try {
    const response = await axios.get(`${BASE_URL}/monitoring/ai`, { headers });
    
    if (response.data.success) {
      const aiStats = response.data.data;
      log('green', '✅ AI routing stats retrieved');
      log('cyan', `🎯 Primary Provider: ${aiStats.primaryProvider}`);
      log('cyan', `📊 Total Requests: ${aiStats.totalRequests}`);
      log('cyan', `🤖 Anthropic Usage: ${aiStats.anthropicUsagePercent}%`);
      log('cyan', `🦙 Ollama Usage: ${aiStats.ollamaUsagePercent}%`);
      log('cyan', `💰 Cost Savings: ${aiStats.costSavings.estimatedClaudeCostSaved}`);
      
      if (aiStats.ollamaUsagePercent > 0) {
        log('green', '🎉 OLLAMA IS BEING USED!');
      } else {
        log('yellow', '⚠️  Ollama not being used');
      }
      
      return aiStats;
    }
  } catch (error) {
    log('red', `❌ Error monitoring Ollama usage: ${error.message}`);
  }
}

async function runFullTest() {
  log('magenta', '🍌 BANANA-POWERED OLLAMA INTEGRATION TEST 🍌');
  log('magenta', '='.repeat(50));
  
  // Step 1: Test Ollama connection
  const ollamaWorking = await testOllamaConnection();
  
  if (!ollamaWorking) {
    log('red', '\n❌ OLLAMA CONNECTION FAILED - Cannot proceed with template tests');
    log('yellow', 'Please check:');
    log('yellow', '1. Ollama is running on the Pi');
    log('yellow', '2. OLLAMA_BASE_URL is correct');
    log('yellow', '3. The model is downloaded (llama3.1:8b)');
    return;
  }
  
  // Step 2: Generate traffic for templates
  await generateTrafficForTemplates();
  
  // Step 3: Check template stats
  const templateStats = await checkTemplateStats();
  
  if (!templateStats || templateStats.templatesGenerated === 0) {
    log('yellow', '\n⚠️  No templates generated yet - this is normal for new deployments');
    log('yellow', 'Templates are generated over time as the system learns from requests');
  }
  
  // Step 4: Check AI insights
  const aiInsights = await checkAIInsights();
  
  // Step 5: Test optimization suggestions
  await testOptimizationSuggestions();
  
  // Step 6: Monitor Ollama usage
  await monitorOllamaUsage();
  
  // Final summary
  log('magenta', '\n🎯 TEST SUMMARY:');
  log('magenta', '='.repeat(30));
  
  if (ollamaWorking) {
    log('green', '✅ Ollama Connection: WORKING');
  } else {
    log('red', '❌ Ollama Connection: FAILED');
  }
  
  if (templateStats && templateStats.templatesGenerated > 0) {
    log('green', `✅ Templates Generated: ${templateStats.templatesGenerated}`);
  } else {
    log('yellow', '⚠️  Templates Generated: 0 (normal for new deployments)');
  }
  
  if (aiInsights && aiInsights.totalSuggestions > 0) {
    log('green', `✅ AI Suggestions: ${aiInsights.totalSuggestions} found`);
  } else {
    log('yellow', '⚠️  AI Suggestions: None yet (will generate over time)');
  }
  
  log('blue', '\n📋 To verify Ollama integration is working:');
  log('cyan', '1. Check the logs for "Ollama analysis completed" messages');
  log('cyan', '2. Visit /analytics/ai-insights to see Ollama suggestions');
  log('cyan', '3. Visit /monitoring/ai to check Ollama usage stats');
  log('cyan', '4. Generate more traffic and wait 5-10 minutes for analysis');
}

async function interactiveTest() {
  while (true) {
    log('blue', '\n🍌 OLLAMA INTEGRATION TEST MENU 🍌');
    log('cyan', '1. Test Ollama Connection');
    log('cyan', '2. Generate Traffic for Templates');
    log('cyan', '3. Check Template Stats');
    log('cyan', '4. Check AI Insights');
    log('cyan', '5. Test Optimization Suggestions');
    log('cyan', '6. Monitor Ollama Usage');
    log('cyan', '7. Run Full Test');
    log('cyan', '8. Exit');
    
    const choice = await question('\nEnter your choice (1-8): ');
    
    switch (choice) {
      case '1':
        await testOllamaConnection();
        break;
      case '2':
        await generateTrafficForTemplates();
        break;
      case '3':
        await checkTemplateStats();
        break;
      case '4':
        await checkAIInsights();
        break;
      case '5':
        await testOptimizationSuggestions();
        break;
      case '6':
        await monitorOllamaUsage();
        break;
      case '7':
        await runFullTest();
        break;
      case '8':
        log('green', '👋 Goodbye!');
        process.exit(0);
        break;
      default:
        log('red', '❌ Invalid choice');
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--auto') || args.includes('-a')) {
    await runFullTest();
    process.exit(0);
  } else {
    await interactiveTest();
  }
}

// Handle cleanup
process.on('SIGINT', () => {
  log('yellow', '\n👋 Test interrupted');
  rl.close();
  process.exit(0);
});

if (require.main === module) {
  main().catch(error => {
    log('red', `❌ Test failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  testOllamaConnection,
  generateTrafficForTemplates,
  checkTemplateStats,
  checkAIInsights,
  testOptimizationSuggestions,
  monitorOllamaUsage
};