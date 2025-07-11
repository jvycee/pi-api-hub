#!/usr/bin/env node

const readline = require('readline');
const axios = require('axios');
const chalk = require('chalk');

class Mark2Chat {
  constructor() {
    this.apiUrl = process.env.MARK2_API_URL || 'http://localhost:3000';
    this.ollamaUrl = process.env.OLLAMA_URL || 'http://10.0.0.120:11434'; // Fallback to direct Ollama
    this.conversationHistory = [];
    this.currentMode = 'general';
    
    console.log(chalk.cyan('🐘 Initializing connection to Mark2 - Your General Purpose AI Assistant...'));
    this.runDiagnostics();
  }

  async runDiagnostics() {
    console.log(chalk.cyan('🐘 Running Mark2 diagnostics...'));
    
    const diagnostics = {
      mark2Service: false,
      ollamaConnectivity: false,
      chatFunctionality: false
    };

    // Test Mark2 service health
    try {
      const healthResponse = await axios.get(`${this.apiUrl}/api/mark2/health`, { timeout: 5000 });
      if (healthResponse.data.success && healthResponse.data.data.mark2Available) {
        diagnostics.mark2Service = true;
        console.log(chalk.green('✅ Mark2 Service: Available and ready'));
        console.log(chalk.gray('   Ollama Status:'), healthResponse.data.data.ollamaStatus.healthy ? chalk.green('Healthy') : chalk.red('Offline'));
        
        // Test chat functionality
        try {
          const testResponse = await axios.post(`${this.apiUrl}/api/mark2/chat`, {
            message: 'Hello! This is a connection test.'
          }, { timeout: 10000 });
          
          if (testResponse.data.success && testResponse.data.data.response) {
            diagnostics.chatFunctionality = true;
            console.log(chalk.green('✅ Mark2 Chat: Functional'));
          }
        } catch (chatError) {
          console.log(chalk.yellow('⚠️  Mark2 Chat: Limited functionality'));
        }
        
      } else {
        console.log(chalk.red('❌ Mark2 Service: Unavailable'));
        throw new Error('Mark2 service unavailable');
      }
    } catch (error) {
      console.log(chalk.red('❌ Mark2 Service: Connection failed'));
      console.log(chalk.gray('   Make sure the API server is running at:'), chalk.cyan(this.apiUrl));
    }

    // Test direct Ollama connectivity as fallback
    if (!diagnostics.mark2Service) {
      try {
        const testResponse = await axios.post(`${this.ollamaUrl}/api/generate`, {
          model: 'llama3.2:latest',
          prompt: 'Hello',
          stream: false
        }, { timeout: 10000 });
        
        if (testResponse.data && testResponse.data.response) {
          diagnostics.ollamaConnectivity = true;
          console.log(chalk.green('✅ Direct Ollama: Available as fallback'));
        }
      } catch (error) {
        console.log(chalk.red('❌ Direct Ollama: Connection failed'));
        console.log(chalk.gray('   Ollama URL:'), chalk.cyan(this.ollamaUrl));
      }
    }

    console.log(chalk.cyan('\n🐘 Mark2 Diagnostic Summary:'));
    console.log(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    
    if (diagnostics.mark2Service && diagnostics.chatFunctionality) {
      console.log(chalk.green('🟢 Status: Full functionality available'));
      console.log(chalk.green('🟢 Mark2 Service API is working perfectly'));
    } else if (diagnostics.ollamaConnectivity) {
      console.log(chalk.yellow('🟡 Status: Limited functionality (direct Ollama mode)'));
      console.log(chalk.yellow('🟡 Using direct Ollama connection as fallback'));
    } else {
      console.log(chalk.red('🔴 Status: No AI connectivity available'));
      console.log(chalk.red('🔴 Please check your connections and try again'));
      process.exit(1);
    }

    // Get available modes
    try {
      const modesResponse = await axios.get(`${this.apiUrl}/api/mark2/modes`);
      if (modesResponse.data.success) {
        this.availableModes = modesResponse.data.data.availableModes;
        this.currentMode = modesResponse.data.data.currentMode;
        console.log(chalk.gray('🎭 Available modes:'), Object.keys(this.availableModes).join(', '));
        console.log(chalk.gray('🎯 Current mode:'), chalk.cyan(this.currentMode));
      }
    } catch (error) {
      // Set default modes if API unavailable
      this.availableModes = {
        general: "General conversation and assistance",
        coding: "Programming and technical help", 
        creative: "Creative writing and brainstorming",
        learning: "Educational support and explanations",
        research: "Information gathering and analysis"
      };
    }

    console.log(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    
    this.showWelcomeMessage();
    this.startChat();
  }

  showWelcomeMessage() {
    console.log(chalk.cyan('\n🐘 Welcome to Mark2 - Your General Purpose AI Assistant!'));
    console.log(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.white('Mark2 is designed for general conversations, learning, and creative work.'));
    console.log(chalk.white('Unlike Mark (the Pi API Hub assistant), Mark2 focuses on everyday AI assistance.'));
    console.log(chalk.gray('\n📋 Quick Commands:'));
    console.log(chalk.gray('  /mode <name>     - Switch conversation mode'));
    console.log(chalk.gray('  /modes           - List available modes')); 
    console.log(chalk.gray('  /starters        - Get conversation starter ideas'));
    console.log(chalk.gray('  /stats           - Show conversation statistics'));
    console.log(chalk.gray('  /clear           - Clear conversation history'));
    console.log(chalk.gray('  /help            - Show all commands'));
    console.log(chalk.gray('  /exit            - End conversation'));
    console.log(chalk.gray('\n💡 Tips:'));
    console.log(chalk.gray('  - Try different modes: general, coding, creative, learning, research'));
    console.log(chalk.gray('  - Ask for help with programming, writing, learning, or any general topic'));
    console.log(chalk.gray('  - Mark2 adapts its responses based on the current mode'));
    console.log(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.cyan(`🎯 Current mode: ${this.currentMode} - ${this.availableModes[this.currentMode] || 'General assistance'}`));
    console.log(chalk.cyan('💬 Start typing to begin your conversation with Mark2!\n'));
  }

  startChat() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.cyan('You: ')
    });

    rl.prompt();

    rl.on('line', async (input) => {
      const userMessage = input.trim();
      
      if (!userMessage) {
        rl.prompt();
        return;
      }

      // Handle commands
      if (userMessage.startsWith('/')) {
        await this.handleCommand(userMessage, rl);
        return;
      }

      // Send message to Mark2
      try {
        console.log(chalk.gray('🐘 Mark2 is thinking...'));
        const response = await this.sendMessage(userMessage);
        
        console.log(chalk.green(`\n🐘 Mark2 [${this.currentMode}]: ${response}\n`));
        
      } catch (error) {
        console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
      }
      
      rl.prompt();
    });

    rl.on('close', () => {
      console.log(chalk.cyan('\n🐘 Thanks for chatting with Mark2! See you next time! 👋'));
      process.exit(0);
    });
  }

  async sendMessage(userMessage) {
    try {
      // Try Mark2 service first
      const response = await axios.post(`${this.apiUrl}/api/mark2/chat`, {
        message: userMessage,
        context: {
          source: 'cli',
          currentMode: this.currentMode
        }
      }, {
        timeout: 60000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.data.success && response.data.data.response) {
        return response.data.data.response;
      } else {
        throw new Error('Mark2 service returned invalid response');
      }
    } catch (error) {
      console.log(chalk.yellow('⚠️  Mark2 service unavailable, using direct Ollama...'));
      
      // Fallback to direct Ollama
      const systemPrompt = `You are Mark2 🐘, a versatile AI assistant for general-purpose conversations and assistance.

Current mode: ${this.currentMode}
Be helpful, intelligent, and conversational. Adapt your response to the user's needs.

User: ${userMessage}
Mark2:`;

      const ollamaResponse = await axios.post(`${this.ollamaUrl}/api/generate`, {
        model: 'llama3.2:latest',
        prompt: systemPrompt,
        stream: false,
        options: {
          temperature: 0.8,
          max_tokens: 2000
        }
      }, {
        timeout: 60000
      });

      return ollamaResponse.data.response;
    }
  }

  async handleCommand(command, rl) {
    const [cmd, ...args] = command.slice(1).split(' ');
    
    switch (cmd) {
      case 'help':
        this.showHelp();
        break;
        
      case 'exit':
      case 'quit':
        rl.close();
        break;
        
      case 'mode':
        await this.changeMode(args.join(' '));
        break;
        
      case 'modes':
        this.showModes();
        break;
        
      case 'starters':
        await this.showConversationStarters();
        break;
        
      case 'stats':
        await this.showStats();
        break;
        
      case 'clear':
        await this.clearHistory();
        break;
        
      default:
        console.log(chalk.red(`Unknown command: /${cmd}`));
        console.log(chalk.gray('Type /help for available commands'));
    }
    
    rl.prompt();
  }

  showHelp() {
    console.log(chalk.cyan('\n🐘 Mark2 Commands:'));
    console.log(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.white('/mode <name>     - Switch to a different conversation mode'));
    console.log(chalk.white('/modes           - List all available conversation modes'));
    console.log(chalk.white('/starters        - Get conversation starter suggestions'));
    console.log(chalk.white('/stats           - Show conversation statistics'));
    console.log(chalk.white('/clear           - Clear conversation history'));
    console.log(chalk.white('/help            - Show this help message'));
    console.log(chalk.white('/exit or /quit   - End the conversation'));
    console.log(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
  }

  async changeMode(modeName) {
    if (!modeName) {
      console.log(chalk.red('Please specify a mode. Available modes:'));
      this.showModes();
      return;
    }

    try {
      const response = await axios.post(`${this.apiUrl}/api/mark2/mode`, {
        mode: modeName
      });

      if (response.data.success) {
        this.currentMode = modeName;
        console.log(chalk.green(`\n🎯 Mode changed to: ${modeName}`));
        console.log(chalk.gray(`Description: ${response.data.modeDescription}\n`));
      }
    } catch (error) {
      console.log(chalk.red(`\n❌ Failed to change mode: ${error.response?.data?.error || error.message}\n`));
    }
  }

  showModes() {
    console.log(chalk.cyan('\n🎭 Available Conversation Modes:'));
    console.log(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    
    Object.entries(this.availableModes).forEach(([mode, description]) => {
      const indicator = mode === this.currentMode ? chalk.green('→ ') : '  ';
      const modeColor = mode === this.currentMode ? chalk.green : chalk.white;
      console.log(`${indicator}${modeColor(mode.padEnd(12))} - ${description}`);
    });
    
    console.log(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.gray(`Current mode: ${this.currentMode}`));
    console.log(chalk.gray('Use: /mode <name> to switch modes\n'));
  }

  async showConversationStarters() {
    try {
      const response = await axios.get(`${this.apiUrl}/api/mark2/conversation-starters`);
      
      if (response.data.success) {
        const starters = response.data.data.suggestedStarters;
        console.log(chalk.cyan(`\n💡 Conversation Starters for ${this.currentMode} mode:`));
        console.log(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
        
        starters.forEach((starter, index) => {
          console.log(chalk.white(`${index + 1}. ${starter}`));
        });
        
        console.log(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
        console.log(chalk.gray('Just copy and paste any of these to start a conversation!\n'));
      }
    } catch (error) {
      console.log(chalk.red(`\n❌ Failed to get conversation starters: ${error.message}\n`));
    }
  }

  async showStats() {
    try {
      const response = await axios.get(`${this.apiUrl}/api/mark2/stats`);
      
      if (response.data.success) {
        const stats = response.data.data;
        console.log(chalk.cyan('\n📊 Mark2 Conversation Statistics:'));
        console.log(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
        console.log(chalk.white(`Total conversations: ${stats.totalConversations}`));
        console.log(chalk.white(`Current mode: ${stats.currentMode}`));
        console.log(chalk.white(`Average message length: ${stats.averageMessageLength} characters`));
        
        if (stats.modeDistribution) {
          console.log(chalk.white('\nMode usage:'));
          Object.entries(stats.modeDistribution).forEach(([mode, count]) => {
            console.log(chalk.gray(`  ${mode}: ${count} conversations`));
          });
        }
        
        console.log(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
      }
    } catch (error) {
      console.log(chalk.red(`\n❌ Failed to get statistics: ${error.message}\n`));
    }
  }

  async clearHistory() {
    try {
      console.log(chalk.yellow('🗑️  Clearing conversation history...'));
      
      // This would require admin authentication in a real scenario
      // For now, just clear local history
      this.conversationHistory = [];
      
      console.log(chalk.green('✅ Local conversation history cleared!\n'));
    } catch (error) {
      console.log(chalk.red(`\n❌ Failed to clear history: ${error.message}\n`));
    }
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(chalk.cyan('🐘 Mark2 - General Purpose AI Assistant'));
  console.log(chalk.white('\nUsage: node talk-to-mark2.js [options]'));
  console.log(chalk.white('\nOptions:'));
  console.log(chalk.white('  --help, -h     Show this help message'));
  console.log(chalk.white('\nEnvironment Variables:'));
  console.log(chalk.white('  MARK2_API_URL  API server URL (default: http://localhost:3000)'));
  console.log(chalk.white('  OLLAMA_URL     Ollama server URL (default: http://10.0.0.120:11434)'));
  process.exit(0);
}

// Start Mark2 chat
const mark2Chat = new Mark2Chat();