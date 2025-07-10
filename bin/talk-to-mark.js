#!/usr/bin/env node

const readline = require('readline');
const axios = require('axios');
const chalk = require('chalk');

class MarkChat {
  constructor() {
    this.piApiUrl = process.env.PI_API_URL || 'http://localhost:3000';
    this.ollamaUrl = process.env.OLLAMA_URL || 'http://10.0.0.120:11434'; // Your Mac's IP
    this.conversationHistory = [];
    this.markPersonality = {
      name: "Mark",
      role: "Pi API Hub Assistant & Testing Expert",
      personality: "Helpful, technical, and loves APIs, webhooks, and testing. Expert at generating test payloads, troubleshooting issues, and explaining complex API concepts. Always enthusiastic about helping with the Pi API Hub infrastructure.",
      specialties: [
        "API testing and payload generation",
        "Webhook troubleshooting", 
        "HubSpot API expertise",
        "MCP (Model Context Protocol) testing",
        "Security testing and vulnerability assessment",
        "Performance optimization",
        "Banana-powered infrastructure analysis 🍌"
      ]
    };
    
    console.log(chalk.yellow('🐐 Initializing connection to Mark on your Pi...'));
    this.runDiagnostics();
  }

  async runDiagnostics() {
    console.log(chalk.yellow('🐐 Running diagnostics...'));
    
    const diagnostics = {
      piApiHub: false,
      aiConnectivity: false,
      commands: {
        status: false,
        test: false,
        webhook: false,
        security: false
      }
    };

    // Test Pi API Hub health
    try {
      const healthResponse = await axios.get(`${this.piApiUrl}/health`, { timeout: 5000 });
      if (healthResponse.data.status === 'healthy') {
        diagnostics.piApiHub = true;
        console.log(chalk.green('✅ Pi API Hub: Healthy'));
      } else {
        console.log(chalk.red('❌ Pi API Hub: Unhealthy'));
      }
    } catch (error) {
      console.log(chalk.red('❌ Pi API Hub: Connection failed'));
    }

    // Test AI connectivity with simple message
    try {
      const testResponse = await axios.post(`${this.ollamaUrl}/api/generate`, {
        model: 'llama3.2:latest',
        prompt: 'Hello',
        stream: false
      }, { timeout: 10000 });
      
      if (testResponse.data && testResponse.data.response) {
        diagnostics.aiConnectivity = true;
        console.log(chalk.green('✅ AI Connectivity: Working'));
      } else {
        console.log(chalk.red('❌ AI Connectivity: Invalid response'));
      }
    } catch (error) {
      console.log(chalk.red('❌ AI Connectivity: Failed'));
    }

    // Test specific commands
    diagnostics.commands.status = diagnostics.piApiHub; // Status command depends on health endpoint
    diagnostics.commands.test = diagnostics.aiConnectivity; // Test commands depend on AI
    diagnostics.commands.webhook = diagnostics.aiConnectivity;
    diagnostics.commands.security = diagnostics.aiConnectivity;

    // Summary
    const allGood = diagnostics.piApiHub && diagnostics.aiConnectivity;
    if (allGood) {
      console.log(chalk.green('🎉 All diagnostics passed! Mark is ready to help!'));
    } else {
      console.log(chalk.yellow('⚠️  Some diagnostics failed. Mark may have limited functionality.'));
    }
    
    console.log('');
    this.initializeInterface();
  }

  initializeInterface() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.cyan('🐐 You: ')
    });

    this.displayWelcome();
    this.setupEventHandlers();
    this.startConversation();
  }

  displayWelcome() {
    console.log(chalk.green.bold('\n🐐 ═══════════════════════════════════════════════════════════════'));
    console.log(chalk.green.bold('🐐   WELCOME TO MARK - YOUR PI API ASSISTANT!'));
    console.log(chalk.green.bold('🐐 ═══════════════════════════════════════════════════════════════'));
    console.log(chalk.white(`
🐐 Mark is your AI assistant running on your Pi at: ${chalk.cyan(this.piApiUrl)}
🐐 Mark specializes in:
   • 🧪 API testing and payload generation
   • 🔗 Webhook troubleshooting and testing
   • 🏢 HubSpot API expertise and integration
   • 🔧 MCP (Model Context Protocol) testing
   • 🛡️ Security testing and vulnerability assessment
   • ⚡ Performance optimization and monitoring
   • 🍌 Banana-powered infrastructure analysis

🐐 Commands:
   • Type your questions naturally
   • /test - Ask Mark to help generate test payloads
   • /webhook - Get webhook testing assistance
   • /security - Security analysis and testing help
   • /payload <type> - Generate specific payload types
   • /status - Check Pi API Hub status
   • /help - Show detailed help
   • /exit - End conversation with Mark

🐐 Mark is ready to help you leverage your Pi API Hub infrastructure!
`));
    console.log(chalk.green.bold('🐐 ═══════════════════════════════════════════════════════════════\n'));
  }

  setupEventHandlers() {
    this.rl.on('line', async (input) => {
      const trimmedInput = input.trim();
      
      if (trimmedInput === '/exit') {
        this.exitChat();
        return;
      }

      if (trimmedInput === '/help') {
        this.showHelp();
        this.rl.prompt();
        return;
      }

      if (trimmedInput === '/status') {
        await this.checkPiStatus();
        this.rl.prompt();
        return;
      }

      if (trimmedInput.startsWith('/test')) {
        await this.handleTestCommand(trimmedInput);
        this.rl.prompt();
        return;
      }

      if (trimmedInput.startsWith('/webhook')) {
        await this.handleWebhookCommand(trimmedInput);
        this.rl.prompt();
        return;
      }

      if (trimmedInput.startsWith('/security')) {
        await this.handleSecurityCommand(trimmedInput);
        this.rl.prompt();
        return;
      }

      if (trimmedInput.startsWith('/payload')) {
        await this.handlePayloadCommand(trimmedInput);
        this.rl.prompt();
        return;
      }

      if (trimmedInput) {
        await this.sendToMark(trimmedInput);
      }
      
      this.rl.prompt();
    });

    this.rl.on('close', () => {
      this.exitChat();
    });

    process.on('SIGINT', () => {
      this.exitChat();
    });
  }

  async sendToMark(userMessage) {
    console.log(chalk.gray('🐐 Mark is thinking...'));
    
    try {
      // Build context-aware message for Mark
      const contextualPrompt = this.buildContextualPrompt(userMessage);
      
      const systemPrompt = `You are Mark, an expert AI assistant specializing in API testing, webhooks, and the Pi API Hub infrastructure. 

Your personality: ${this.markPersonality.personality}

Your specialties: ${this.markPersonality.specialties.join(', ')}

Pi API Hub Context:
- You're running on a Raspberry Pi 5 with 8GB RAM
- The Pi has a comprehensive API hub with HubSpot integration, Anthropic AI routing, MCP server, webhook handling, and security features
- Recent Phase 2 security implementation includes threat detection, MFA, zero-trust architecture, vulnerability scanning, audit logging, request signing, and honeypots
- The infrastructure has clustering, intelligent caching, real-time analytics, and performance monitoring
- Available endpoints include /api/hubspot/*, /api/anthropic/messages, /webhooks/hubspot, /monitoring/*, /security/*, /analytics/*

Instructions:
- Always be helpful and enthusiastic about API testing and Pi infrastructure
- When asked about testing, provide specific examples with actual API calls
- For payload generation, provide realistic, well-formatted JSON examples
- Include relevant curl commands or code snippets when helpful
- Reference the Pi API Hub's actual capabilities and endpoints
- Use emojis sparingly but appropriately (🐐 for yourself, 🍌 for Pi infrastructure)
- Be concise but thorough in explanations

Current conversation context: ${this.conversationHistory.slice(-3).map(h => `${h.role}: ${h.content}`).join('\n')}

User: ${contextualPrompt}
Mark:`;

      const response = await axios.post(`${this.ollamaUrl}/api/generate`, {
        model: 'llama3.2:latest',
        prompt: systemPrompt,
        stream: false,
        options: {
          temperature: 0.7,
          max_tokens: 2000
        }
      }, {
        timeout: 60000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const markResponse = response.data.response;
      const provider = 'ollama';
      
      // Add to conversation history
      this.conversationHistory.push(
        { role: 'user', content: userMessage },
        { role: 'assistant', content: markResponse }
      );

      // Keep only last 10 exchanges
      if (this.conversationHistory.length > 20) {
        this.conversationHistory = this.conversationHistory.slice(-20);
      }

      console.log(chalk.green(`🐐 Mark (via ${provider}):`), chalk.white(markResponse));
      console.log('');

    } catch (error) {
      console.log(chalk.red('🐐 Mark encountered an issue:'));
      if (error.response) {
        console.log(chalk.red(`   API Error: ${error.response.status} - ${error.response.data?.error || 'Unknown error'}`));
      } else if (error.code === 'ECONNREFUSED') {
        console.log(chalk.red(`   Connection refused. Is your Pi API Hub running at ${this.piApiUrl}?`));
        console.log(chalk.yellow('   Try: NODE_ENV=production node cluster.js'));
      } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        console.log(chalk.red(`   Request timeout. The AI service is taking longer than expected.`));
        console.log(chalk.yellow('   Try asking a simpler question or check if Ollama is responding slowly.'));
      } else {
        console.log(chalk.red(`   Error: ${error.message}`));
      }
      console.log('');
    }
  }

  buildContextualPrompt(userMessage) {
    // Add context based on message content
    let contextualPrompt = userMessage;
    
    if (userMessage.toLowerCase().includes('test') || userMessage.toLowerCase().includes('payload')) {
      contextualPrompt += `\n\nContext: User is asking about testing. Please provide specific, actionable testing examples using the Pi API Hub endpoints.`;
    }
    
    if (userMessage.toLowerCase().includes('webhook')) {
      contextualPrompt += `\n\nContext: User needs webhook help. Reference the Pi's webhook endpoint at ${this.piApiUrl}/webhooks/hubspot and provide HubSpot webhook examples.`;
    }
    
    if (userMessage.toLowerCase().includes('security')) {
      contextualPrompt += `\n\nContext: User is asking about security. Reference the new Phase 2 security features like /security/threat-detection, /security/honeypots, MFA, zero-trust, etc.`;
    }

    return contextualPrompt;
  }

  async checkPiStatus() {
    console.log(chalk.yellow('🐐 Checking Pi API Hub status...'));
    
    try {
      const healthResponse = await axios.get(`${this.piApiUrl}/health`, { timeout: 10000 });
      const health = healthResponse.data;
      
      console.log(chalk.green('🐐 Pi API Hub Status:'));
      console.log(chalk.white(`   Status: ${chalk.green(health.status)}`));
      console.log(chalk.white(`   Uptime: ${chalk.cyan((health.uptime / 3600).toFixed(2))} hours`));
      console.log(chalk.white(`   Environment: ${chalk.yellow(health.environment)}`));
      console.log(chalk.white(`   Mode: ${chalk.magenta(health.worker?.clustered ? 'Clustered' : 'Single Process')}`));
      
      // Try to get monitoring dashboard
      try {
        const monitoringResponse = await axios.get(`${this.piApiUrl}/monitoring/dashboard`, { timeout: 5000 });
        const dashboard = monitoringResponse.data;
        
        // Debug: Log memory structure if values are undefined
        if (!dashboard.system?.memory?.usedMB) {
          console.log(chalk.yellow('Debug - Memory structure:'), JSON.stringify(dashboard.system?.memory, null, 2));
        }
        
        console.log(chalk.green('🐐 Performance Metrics:'));
        const memoryUsed = dashboard.system?.memory?.usedMB || 'N/A';
        const memoryTotal = dashboard.system?.memory?.totalMB || 'N/A';
        console.log(chalk.white(`   Memory Usage: ${chalk.cyan(memoryUsed)}MB / ${memoryTotal}MB`));
        console.log(chalk.white(`   CPU Load: ${chalk.cyan(dashboard.system?.cpu?.usage || 'N/A')}%`));
        console.log(chalk.white(`   Active APIs: ${chalk.cyan(Object.keys(dashboard.apis || {}).length)}`));
        console.log(chalk.white(`   🍌 Banana Status: ${chalk.yellow(dashboard.status || 'BANANA POWERED')}`));
      } catch (monitoringError) {
        console.log(chalk.yellow('   (Detailed monitoring unavailable)'));
      }
      
    } catch (error) {
      console.log(chalk.red('🐐 Unable to connect to Pi API Hub'));
      console.log(chalk.red(`   ${error.message}`));
      console.log(chalk.yellow(`   Make sure the Pi is running at: ${this.piApiUrl}`));
    }
    console.log('');
  }

  async handleTestCommand(command) {
    const testType = command.split(' ')[1] || 'general';
    const prompt = `I need help with ${testType} testing. Can you provide specific test examples and payloads for the Pi API Hub? Include actual API calls I can use.`;
    await this.sendToMark(prompt);
  }

  async handleWebhookCommand(command) {
    const webhookType = command.split(' ')[1] || 'hubspot';
    const prompt = `I need help testing ${webhookType} webhooks. Can you provide webhook payload examples and testing strategies for the Pi API Hub webhook endpoint?`;
    await this.sendToMark(prompt);
  }

  async handleSecurityCommand(command) {
    const securityType = command.split(' ')[1] || 'general';
    const prompt = `I need help with ${securityType} security testing. Can you help me test the Pi API Hub's Phase 2 security features including threat detection, honeypots, MFA, and zero-trust architecture?`;
    await this.sendToMark(prompt);
  }

  async handlePayloadCommand(command) {
    const payloadType = command.split(' ')[1] || 'json';
    const prompt = `Generate a ${payloadType} payload example for testing APIs. Make it realistic and ready to use with curl or similar tools.`;
    await this.sendToMark(prompt);
  }

  showHelp() {
    console.log(chalk.cyan(`
🐐 Mark's Detailed Help:

🧪 Testing Commands:
   /test api          - Get API testing examples
   /test hubspot      - HubSpot-specific testing help
   /test performance  - Performance testing guidance
   /test mcp          - MCP protocol testing

🔗 Webhook Commands:
   /webhook hubspot   - HubSpot webhook testing
   /webhook test      - General webhook testing strategies
   /webhook debug     - Webhook debugging help

🛡️ Security Commands:
   /security scan     - Security testing guidance
   /security mfa      - Multi-factor auth testing
   /security honeypot - Honeypot testing
   /security threats  - Threat detection testing

📋 Payload Generation:
   /payload contact   - HubSpot contact payload
   /payload deal      - HubSpot deal payload
   /payload webhook   - Webhook payload example
   /payload auth      - Authentication payload

🔧 System Commands:
   /status           - Check Pi API Hub health
   /help             - Show this help
   /exit             - End conversation

💡 Natural Language:
   Just type your questions naturally! Mark understands:
   - "How do I test the HubSpot contact API?"
   - "Generate a webhook payload for testing"
   - "Help me troubleshoot security issues"
   - "What's the best way to test MFA?"
   - "Create a curl command for the analytics endpoint"

🐐 Mark is here to help you leverage your Pi's full potential!
`));
  }

  startConversation() {
    console.log(chalk.cyan('🐐 Start chatting with Mark! (Type /help for commands, /exit to quit)\n'));
    this.rl.prompt();
  }

  exitChat() {
    console.log(chalk.green('\n🐐 Mark says: "Great working with you! Keep building awesome stuff with your Pi! 🍌"'));
    console.log(chalk.yellow('🐐 Connection to Mark closed. Happy testing! 🐐\n'));
    this.rl.close();
    process.exit(0);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
🐐 Talk to Mark - Your Pi API Assistant

Usage: talk-to-mark [options]

Options:
  --pi-url <url>    Pi API Hub URL (default: http://10.0.0.218:3000)
  --help, -h        Show this help

Environment Variables:
  PI_API_URL        Pi API Hub URL

Examples:
  talk-to-mark
  talk-to-mark --pi-url http://192.168.1.100:3000
  PI_API_URL=http://10.0.0.218:3000 talk-to-mark

🐐 Mark is ready to help with API testing, webhooks, security, and more!
`);
  process.exit(0);
}

// Handle custom Pi URL
const piUrlIndex = args.indexOf('--pi-url');
if (piUrlIndex !== -1 && args[piUrlIndex + 1]) {
  process.env.PI_API_URL = args[piUrlIndex + 1];
}

// Start the chat
new MarkChat();