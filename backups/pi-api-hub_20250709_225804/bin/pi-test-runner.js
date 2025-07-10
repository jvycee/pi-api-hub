#!/usr/bin/env node

const readline = require('readline');
const axios = require('axios');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

class PiTestRunner {
  constructor() {
    this.piApiUrl = process.env.PI_API_URL || 'http://10.0.0.218:3000';
    this.testHistory = [];
    this.savedPayloads = new Map();
    
    console.log(chalk.yellow('🧪 Initializing Pi Test Runner...'));
    this.loadSavedPayloads();
    this.initializeInterface();
  }

  initializeInterface() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.cyan('🧪 Choice: ')
    });

    this.displayWelcome();
    this.showMainMenu();
  }

  displayWelcome() {
    console.log(chalk.green.bold('\n🧪 ═══════════════════════════════════════════════════════════════'));
    console.log(chalk.green.bold('🧪   PI TEST RUNNER - HUBSPOT API TESTING POWERHOUSE'));
    console.log(chalk.green.bold('🧪 ═══════════════════════════════════════════════════════════════'));
    console.log(chalk.white(`
🧪 Connected to Pi API Hub: ${chalk.cyan(this.piApiUrl)}
🧪 Ready to execute real HubSpot API tests through your Pi!

🎯 Supported Operations:
   • 📋 CRUD Operations - Contacts, Companies, Deals
   • 🔍 Search API - Advanced searches across all objects  
   • 🔗 Associations - Link/unlink objects together
   • 💼 Engagements - Notes, calls, emails, meetings, tasks
   • 📄 Parse & Execute - Mark's curl commands directly
   • 🎨 Real-time Formatting - Beautiful response analysis

🍌 BANANA-POWERED TESTING THROUGH YOUR PI! 🍌
`));
    console.log(chalk.green.bold('🧪 ═══════════════════════════════════════════════════════════════\n'));
  }

  showMainMenu() {
    console.log(chalk.cyan('\n🧪 Pi Test Runner Main Menu:'));
    console.log(chalk.white('  [1] 📋 Object Operations (Create/Read/Update/Delete)'));
    console.log(chalk.white('  [2] 🔍 Search API Testing'));
    console.log(chalk.white('  [3] 🔗 Association Management'));
    console.log(chalk.white('  [4] 💼 Engagement Operations'));
    console.log(chalk.white('  [5] 📄 Parse & Execute Curl Command'));
    console.log(chalk.white('  [6] 📋 Paste JSON Payload'));
    console.log(chalk.white('  [7] 💾 Saved Payloads'));
    console.log(chalk.white('  [8] 📊 Test History'));
    console.log(chalk.white('  [9] 🔧 Pi Status Check'));
    console.log(chalk.white('  [0] 🚪 Exit'));
    
    this.rl.question(chalk.cyan('\n🧪 Select option (1-9, 0 to exit): '), (answer) => {
      this.handleMainMenuChoice(answer.trim());
    });
  }

  handleMainMenuChoice(choice) {
    switch (choice) {
      case '1':
        this.showObjectOperations();
        break;
      case '2':
        this.showSearchOperations();
        break;
      case '3':
        this.showAssociationOperations();
        break;
      case '4':
        this.showEngagementOperations();
        break;
      case '5':
        this.handleCurlParsing();
        break;
      case '6':
        this.handleJsonPayload();
        break;
      case '7':
        this.showSavedPayloads();
        break;
      case '8':
        this.showTestHistory();
        break;
      case '9':
        this.checkPiStatus();
        break;
      case '0':
        this.exitRunner();
        break;
      default:
        console.log(chalk.red('🧪 Invalid choice. Please select 1-9 or 0.'));
        this.showMainMenu();
    }
  }

  showObjectOperations() {
    console.log(chalk.cyan('\n🧪 Object Operations:'));
    console.log(chalk.white('  [1] 📞 Contacts (Create/Read/Update/Delete)'));
    console.log(chalk.white('  [2] 🏢 Companies (Create/Read/Update/Delete)'));
    console.log(chalk.white('  [3] 💰 Deals (Create/Read/Update/Delete)'));
    console.log(chalk.white('  [4] 🎫 Tickets (Create/Read/Update/Delete)'));
    console.log(chalk.white('  [5] 📦 Products (Create/Read/Update/Delete)'));
    console.log(chalk.white('  [0] ⬅️  Back to Main Menu'));
    
    this.rl.question(chalk.cyan('\n🧪 Select object type: '), (answer) => {
      this.handleObjectChoice(answer.trim());
    });
  }

  handleObjectChoice(choice) {
    const objectMap = {
      '1': 'contacts',
      '2': 'companies', 
      '3': 'deals',
      '4': 'tickets',
      '5': 'products'
    };

    if (choice === '0') {
      this.showMainMenu();
      return;
    }

    const objectType = objectMap[choice];
    if (objectType) {
      this.showCrudOperations(objectType);
    } else {
      console.log(chalk.red('🧪 Invalid choice.'));
      this.showObjectOperations();
    }
  }

  showCrudOperations(objectType) {
    const emoji = this.getObjectEmoji(objectType);
    console.log(chalk.cyan(`\n🧪 ${emoji} ${objectType.toUpperCase()} Operations:`));
    console.log(chalk.white('  [1] ➕ Create (POST)'));
    console.log(chalk.white('  [2] 👁️  Read/Get (GET)'));
    console.log(chalk.white('  [3] ✏️  Update (PATCH)'));
    console.log(chalk.white('  [4] 🗑️  Delete (DELETE)'));
    console.log(chalk.white('  [5] 📋 List All (GET with pagination)'));
    console.log(chalk.white('  [0] ⬅️  Back to Object Selection'));
    
    this.rl.question(chalk.cyan('\n🧪 Select operation: '), (answer) => {
      this.handleCrudChoice(answer.trim(), objectType);
    });
  }

  async handleCrudChoice(choice, objectType) {
    if (choice === '0') {
      this.showObjectOperations();
      return;
    }

    const operations = {
      '1': { method: 'POST', action: 'create', needsBody: true },
      '2': { method: 'GET', action: 'read', needsBody: false },
      '3': { method: 'PATCH', action: 'update', needsBody: true },
      '4': { method: 'DELETE', action: 'delete', needsBody: false },
      '5': { method: 'GET', action: 'list', needsBody: false }
    };

    const operation = operations[choice];
    if (!operation) {
      console.log(chalk.red('🧪 Invalid choice.'));
      this.showCrudOperations(objectType);
      return;
    }

    if (operation.action === 'read' || operation.action === 'update' || operation.action === 'delete') {
      this.rl.question(chalk.cyan(`🧪 Enter ${objectType} ID: `), async (objectId) => {
        await this.executeObjectOperation(objectType, operation, objectId);
      });
    } else if (operation.needsBody) {
      await this.getPayloadForOperation(objectType, operation);
    } else {
      await this.executeObjectOperation(objectType, operation);
    }
  }

  async getPayloadForOperation(objectType, operation) {
    console.log(chalk.cyan(`\n🧪 Creating ${objectType} payload:`));
    console.log(chalk.white('  [1] 📝 Use Template'));
    console.log(chalk.white('  [2] 📋 Paste JSON'));
    console.log(chalk.white('  [3] 🏗️  Build Interactively'));
    
    this.rl.question(chalk.cyan('🧪 Choose input method: '), async (choice) => {
      switch (choice.trim()) {
        case '1':
          const template = this.getTemplate(objectType, operation.action);
          console.log(chalk.yellow('\n🧪 Template payload:'));
          console.log(chalk.gray(JSON.stringify(template, null, 2)));
          await this.executeObjectOperation(objectType, operation, null, template);
          break;
        case '2':
          this.getPastedPayload((payload) => {
            this.executeObjectOperation(objectType, operation, null, payload);
          });
          break;
        case '3':
          const builtPayload = await this.buildPayloadInteractively(objectType);
          await this.executeObjectOperation(objectType, operation, null, builtPayload);
          break;
        default:
          console.log(chalk.red('🧪 Invalid choice.'));
          await this.getPayloadForOperation(objectType, operation);
      }
    });
  }

  getTemplate(objectType, action) {
    const templates = {
      contacts: {
        create: {
          properties: {
            firstname: "Test",
            lastname: "Contact",
            email: `test.contact.${Date.now()}@example.com`,
            phone: "+1-555-123-4567",
            company: "Test Company",
            jobtitle: "Software Engineer"
          }
        },
        update: {
          properties: {
            jobtitle: "Senior Software Engineer",
            phone: "+1-555-987-6543"
          }
        }
      },
      companies: {
        create: {
          properties: {
            name: `Test Company ${Date.now()}`,
            domain: "testcompany.com",
            industry: "Technology",
            phone: "+1-555-123-4567",
            city: "San Francisco",
            state: "CA"
          }
        },
        update: {
          properties: {
            phone: "+1-555-987-6543",
            industry: "Software Development"
          }
        }
      },
      deals: {
        create: {
          properties: {
            dealname: `Test Deal ${Date.now()}`,
            amount: "50000",
            dealstage: "qualifiedtobuy",
            pipeline: "default",
            closedate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          }
        },
        update: {
          properties: {
            amount: "75000",
            dealstage: "negotiation"
          }
        }
      },
      tickets: {
        create: {
          properties: {
            subject: `Test Ticket ${Date.now()}`,
            content: "This is a test ticket created via Pi Test Runner",
            hs_pipeline: "0",
            hs_pipeline_stage: "1",
            hs_ticket_priority: "MEDIUM"
          }
        }
      },
      products: {
        create: {
          properties: {
            name: `Test Product ${Date.now()}`,
            price: "99.99",
            description: "A test product created via Pi Test Runner"
          }
        }
      }
    };

    return templates[objectType]?.[action] || { properties: {} };
  }

  async buildPayloadInteractively(objectType) {
    const properties = {};
    const commonFields = this.getCommonFields(objectType);
    
    console.log(chalk.cyan(`\n🧪 Building ${objectType} payload interactively:`));
    
    for (const field of commonFields) {
      await new Promise((resolve) => {
        this.rl.question(chalk.cyan(`  ${field.name} (${field.type}): `), (value) => {
          if (value.trim()) {
            properties[field.key] = value.trim();
          }
          resolve();
        });
      });
    }

    return { properties };
  }

  getCommonFields(objectType) {
    const fields = {
      contacts: [
        { key: 'firstname', name: 'First Name', type: 'string' },
        { key: 'lastname', name: 'Last Name', type: 'string' },
        { key: 'email', name: 'Email', type: 'email' },
        { key: 'phone', name: 'Phone', type: 'string' },
        { key: 'company', name: 'Company', type: 'string' },
        { key: 'jobtitle', name: 'Job Title', type: 'string' }
      ],
      companies: [
        { key: 'name', name: 'Company Name', type: 'string' },
        { key: 'domain', name: 'Domain', type: 'string' },
        { key: 'industry', name: 'Industry', type: 'string' },
        { key: 'phone', name: 'Phone', type: 'string' },
        { key: 'city', name: 'City', type: 'string' },
        { key: 'state', name: 'State', type: 'string' }
      ],
      deals: [
        { key: 'dealname', name: 'Deal Name', type: 'string' },
        { key: 'amount', name: 'Amount', type: 'number' },
        { key: 'dealstage', name: 'Deal Stage', type: 'string' },
        { key: 'closedate', name: 'Close Date (YYYY-MM-DD)', type: 'date' }
      ],
      tickets: [
        { key: 'subject', name: 'Subject', type: 'string' },
        { key: 'content', name: 'Content', type: 'string' },
        { key: 'hs_ticket_priority', name: 'Priority (LOW/MEDIUM/HIGH)', type: 'string' }
      ],
      products: [
        { key: 'name', name: 'Product Name', type: 'string' },
        { key: 'price', name: 'Price', type: 'number' },
        { key: 'description', name: 'Description', type: 'string' }
      ]
    };

    return fields[objectType] || [];
  }

  async executeObjectOperation(objectType, operation, objectId = null, payload = null) {
    console.log(chalk.yellow('\n🧪 Executing operation through Pi...'));
    
    try {
      let endpoint = `/api/hubspot/${objectType}`;
      if (objectId) {
        endpoint += `/${objectId}`;
      }

      const requestConfig = {
        method: operation.method,
        url: `${this.piApiUrl}${endpoint}`,
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      };

      if (payload) {
        requestConfig.data = payload;
      }

      // Add query parameters for list operations
      if (operation.action === 'list') {
        requestConfig.url += '?limit=10';
      }

      const startTime = Date.now();
      const response = await axios(requestConfig);
      const responseTime = Date.now() - startTime;

      this.displayFormattedResponse(response, responseTime, objectType, operation);
      this.saveToHistory(objectType, operation, payload, response, responseTime);

    } catch (error) {
      this.displayError(error, objectType, operation);
    }

    this.returnToMenu();
  }

  displayFormattedResponse(response, responseTime, objectType, operation) {
    const emoji = this.getObjectEmoji(objectType);
    console.log(chalk.green(`\n✅ ${emoji} ${objectType.toUpperCase()} ${operation.action.toUpperCase()} SUCCESS!`));
    console.log(chalk.gray(`⏱️  Response Time: ${responseTime}ms`));
    console.log(chalk.gray(`📊 Status: ${response.status} ${response.statusText}`));
    
    const data = response.data?.data || response.data;
    
    if (data) {
      // Extract key information
      const keyInfo = this.extractKeyInfo(data, objectType);
      if (keyInfo) {
        console.log(chalk.cyan('\n🎯 Key Information:'));
        Object.entries(keyInfo).forEach(([key, value]) => {
          console.log(chalk.white(`  ${key}: ${chalk.yellow(value)}`));
        });
      }

      // Show HubSpot links if we have IDs
      const hubspotLinks = this.generateHubSpotLinks(data, objectType);
      if (hubspotLinks.length > 0) {
        console.log(chalk.cyan('\n🔗 HubSpot Links:'));
        hubspotLinks.forEach(link => {
          console.log(chalk.blue(`  ${link}`));
        });
      }

      // Show formatted JSON (truncated if too long)
      console.log(chalk.cyan('\n📋 Response Data:'));
      const jsonString = JSON.stringify(data, null, 2);
      if (jsonString.length > 2000) {
        console.log(chalk.gray(jsonString.substring(0, 2000) + '\n... (truncated)'));
      } else {
        console.log(chalk.gray(jsonString));
      }
    }
  }

  extractKeyInfo(data, objectType) {
    const info = {};
    
    if (Array.isArray(data.results)) {
      info['Total Results'] = data.results.length;
      if (data.paging?.next) {
        info['Has More Pages'] = 'Yes';
      }
      return info;
    }

    if (data.id) {
      info['HubSpot ID'] = data.id;
    }

    const properties = data.properties || {};
    
    switch (objectType) {
      case 'contacts':
        if (properties.firstname || properties.lastname) {
          info['Name'] = `${properties.firstname || ''} ${properties.lastname || ''}`.trim();
        }
        if (properties.email) info['Email'] = properties.email;
        if (properties.phone) info['Phone'] = properties.phone;
        if (properties.company) info['Company'] = properties.company;
        break;
        
      case 'companies':
        if (properties.name) info['Company Name'] = properties.name;
        if (properties.domain) info['Domain'] = properties.domain;
        if (properties.industry) info['Industry'] = properties.industry;
        break;
        
      case 'deals':
        if (properties.dealname) info['Deal Name'] = properties.dealname;
        if (properties.amount) info['Amount'] = `$${properties.amount}`;
        if (properties.dealstage) info['Stage'] = properties.dealstage;
        if (properties.closedate) info['Close Date'] = properties.closedate;
        break;
        
      case 'tickets':
        if (properties.subject) info['Subject'] = properties.subject;
        if (properties.hs_ticket_priority) info['Priority'] = properties.hs_ticket_priority;
        break;
        
      case 'products':
        if (properties.name) info['Product Name'] = properties.name;
        if (properties.price) info['Price'] = `$${properties.price}`;
        break;
    }

    return Object.keys(info).length > 0 ? info : null;
  }

  generateHubSpotLinks(data, objectType) {
    const links = [];
    const portalId = 'your-portal'; // Could be extracted from config
    
    if (data.id) {
      const baseUrl = 'https://app.hubspot.com';
      switch (objectType) {
        case 'contacts':
          links.push(`${baseUrl}/contacts/${portalId}/contact/${data.id}`);
          break;
        case 'companies':
          links.push(`${baseUrl}/contacts/${portalId}/company/${data.id}`);
          break;
        case 'deals':
          links.push(`${baseUrl}/contacts/${portalId}/deal/${data.id}`);
          break;
        case 'tickets':
          links.push(`${baseUrl}/contacts/${portalId}/ticket/${data.id}`);
          break;
      }
    }

    if (Array.isArray(data.results)) {
      data.results.slice(0, 3).forEach(item => {
        if (item.id) {
          links.push(`${objectType} ID ${item.id}: View in HubSpot`);
        }
      });
    }

    return links;
  }

  displayError(error, objectType, operation) {
    console.log(chalk.red(`\n❌ ${objectType.toUpperCase()} ${operation.action.toUpperCase()} FAILED`));
    
    if (error.response) {
      console.log(chalk.red(`📊 Status: ${error.response.status} ${error.response.statusText}`));
      
      const errorData = error.response.data;
      if (errorData?.message) {
        console.log(chalk.red(`💬 Message: ${errorData.message}`));
      }
      
      if (errorData?.errors) {
        console.log(chalk.red('🚨 Validation Errors:'));
        errorData.errors.forEach(err => {
          console.log(chalk.red(`  • ${err.message || err}`));
        });
      }
      
      if (errorData?.error) {
        console.log(chalk.red(`🔍 Details: ${errorData.error}`));
      }
    } else if (error.code === 'ECONNREFUSED') {
      console.log(chalk.red(`🔌 Connection Error: Cannot reach Pi at ${this.piApiUrl}`));
      console.log(chalk.yellow('   Check if your Pi API Hub is running'));
    } else {
      console.log(chalk.red(`🚨 Error: ${error.message}`));
    }
  }

  showSearchOperations() {
    console.log(chalk.cyan('\n🧪 🔍 Search API Operations:'));
    console.log(chalk.white('  [1] 📞 Search Contacts'));
    console.log(chalk.white('  [2] 🏢 Search Companies'));
    console.log(chalk.white('  [3] 💰 Search Deals'));
    console.log(chalk.white('  [4] 🎫 Search Tickets'));
    console.log(chalk.white('  [5] 🔧 Custom Search (any object)'));
    console.log(chalk.white('  [0] ⬅️  Back to Main Menu'));
    
    this.rl.question(chalk.cyan('\n🧪 Select search type: '), (answer) => {
      this.handleSearchChoice(answer.trim());
    });
  }

  handleSearchChoice(choice) {
    const searchMap = {
      '1': 'contacts',
      '2': 'companies',
      '3': 'deals', 
      '4': 'tickets'
    };

    if (choice === '0') {
      this.showMainMenu();
      return;
    }

    if (choice === '5') {
      this.rl.question(chalk.cyan('🧪 Enter object type: '), (objectType) => {
        this.buildSearchQuery(objectType.trim());
      });
      return;
    }

    const objectType = searchMap[choice];
    if (objectType) {
      this.buildSearchQuery(objectType);
    } else {
      console.log(chalk.red('🧪 Invalid choice.'));
      this.showSearchOperations();
    }
  }

  buildSearchQuery(objectType) {
    console.log(chalk.cyan(`\n🧪 Building search for ${objectType}:`));
    console.log(chalk.white('  [1] 📝 Simple Property Search'));
    console.log(chalk.white('  [2] 🔧 Advanced Filter Builder'));
    console.log(chalk.white('  [3] 📋 Paste Search JSON'));
    
    this.rl.question(chalk.cyan('🧪 Choose search method: '), (choice) => {
      switch (choice.trim()) {
        case '1':
          this.buildSimpleSearch(objectType);
          break;
        case '2':
          this.buildAdvancedSearch(objectType);
          break;
        case '3':
          this.getPastedPayload((payload) => {
            this.executeSearch(objectType, payload);
          });
          break;
        default:
          console.log(chalk.red('🧪 Invalid choice.'));
          this.buildSearchQuery(objectType);
      }
    });
  }

  buildSimpleSearch(objectType) {
    this.rl.question(chalk.cyan('🧪 Property name to search: '), (property) => {
      this.rl.question(chalk.cyan('🧪 Search value: '), (value) => {
        const searchPayload = {
          filterGroups: [{
            filters: [{
              propertyName: property.trim(),
              operator: 'CONTAINS_TOKEN',
              value: value.trim()
            }]
          }],
          properties: this.getDefaultProperties(objectType),
          limit: 10
        };
        
        this.executeSearch(objectType, searchPayload);
      });
    });
  }

  buildAdvancedSearch(objectType) {
    console.log(chalk.cyan('\n🧪 Advanced Search Builder:'));
    console.log(chalk.yellow('  Available operators: EQ, NEQ, CONTAINS_TOKEN, GT, LT, GTE, LTE'));
    
    const filters = [];
    this.addSearchFilter(filters, () => {
      const searchPayload = {
        filterGroups: [{ filters }],
        properties: this.getDefaultProperties(objectType),
        limit: 10,
        sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }]
      };
      
      this.executeSearch(objectType, searchPayload);
    });
  }

  addSearchFilter(filters, callback) {
    this.rl.question(chalk.cyan('🧪 Property name: '), (property) => {
      this.rl.question(chalk.cyan('🧪 Operator (EQ, CONTAINS_TOKEN, etc.): '), (operator) => {
        this.rl.question(chalk.cyan('🧪 Value: '), (value) => {
          filters.push({
            propertyName: property.trim(),
            operator: operator.trim().toUpperCase(),
            value: value.trim()
          });
          
          this.rl.question(chalk.cyan('🧪 Add another filter? (y/N): '), (answer) => {
            if (answer.toLowerCase().startsWith('y')) {
              this.addSearchFilter(filters, callback);
            } else {
              callback();
            }
          });
        });
      });
    });
  }

  async executeSearch(objectType, searchPayload) {
    console.log(chalk.yellow('\n🧪 Executing search through Pi...'));
    
    try {
      const startTime = Date.now();
      const response = await axios.post(`${this.piApiUrl}/api/hubspot/search/${objectType}`, searchPayload, {
        timeout: 30000,
        headers: { 'Content-Type': 'application/json' }
      });
      const responseTime = Date.now() - startTime;

      this.displaySearchResults(response, responseTime, objectType);
      this.saveToHistory(objectType, { action: 'search' }, searchPayload, response, responseTime);

    } catch (error) {
      this.displayError(error, objectType, { action: 'search' });
    }

    this.returnToMenu();
  }

  displaySearchResults(response, responseTime, objectType) {
    const emoji = this.getObjectEmoji(objectType);
    const data = response.data?.data || response.data;
    
    console.log(chalk.green(`\n✅ ${emoji} ${objectType.toUpperCase()} SEARCH SUCCESS!`));
    console.log(chalk.gray(`⏱️  Response Time: ${responseTime}ms`));
    console.log(chalk.gray(`📊 Status: ${response.status} ${response.statusText}`));
    
    if (data?.results) {
      console.log(chalk.cyan(`\n🎯 Found ${data.results.length} results:`));
      
      data.results.forEach((item, index) => {
        console.log(chalk.white(`\n  ${index + 1}. ID: ${chalk.yellow(item.id)}`));
        const keyInfo = this.extractKeyInfo(item, objectType);
        if (keyInfo) {
          Object.entries(keyInfo).forEach(([key, value]) => {
            if (key !== 'HubSpot ID') {
              console.log(chalk.gray(`     ${key}: ${value}`));
            }
          });
        }
      });
      
      if (data.paging?.next) {
        console.log(chalk.cyan('\n📄 More results available (pagination)'));
      }
    } else {
      console.log(chalk.yellow('\n📭 No results found'));
    }
  }

  getDefaultProperties(objectType) {
    const props = {
      contacts: ['firstname', 'lastname', 'email', 'phone', 'company', 'jobtitle', 'createdate'],
      companies: ['name', 'domain', 'industry', 'phone', 'city', 'state', 'createdate'],
      deals: ['dealname', 'amount', 'dealstage', 'pipeline', 'closedate', 'createdate'],
      tickets: ['subject', 'content', 'hs_ticket_priority', 'hs_pipeline_stage', 'createdate'],
      products: ['name', 'price', 'description', 'createdate']
    };
    
    return props[objectType] || ['createdate'];
  }

  showAssociationOperations() {
    console.log(chalk.cyan('\n🧪 🔗 Association Operations:'));
    console.log(chalk.white('  [1] ➕ Create Association'));
    console.log(chalk.white('  [2] 👁️  List Associations'));
    console.log(chalk.white('  [3] 🗑️  Delete Association'));
    console.log(chalk.white('  [4] 📋 Batch Associations'));
    console.log(chalk.white('  [0] ⬅️  Back to Main Menu'));
    
    this.rl.question(chalk.cyan('\n🧪 Select association operation: '), (answer) => {
      this.handleAssociationChoice(answer.trim());
    });
  }

  handleAssociationChoice(choice) {
    if (choice === '0') {
      this.showMainMenu();
      return;
    }

    switch (choice) {
      case '1':
        this.createAssociation();
        break;
      case '2':
        this.listAssociations();
        break;
      case '3':
        this.deleteAssociation();
        break;
      case '4':
        this.batchAssociations();
        break;
      default:
        console.log(chalk.red('🧪 Invalid choice.'));
        this.showAssociationOperations();
    }
  }

  createAssociation() {
    console.log(chalk.cyan('\n🧪 Creating Association:'));
    this.rl.question(chalk.cyan('🧪 From Object Type (contact/company/deal): '), (fromObjectType) => {
      this.rl.question(chalk.cyan('🧪 From Object ID: '), (fromObjectId) => {
        this.rl.question(chalk.cyan('🧪 To Object Type (contact/company/deal): '), (toObjectType) => {
          this.rl.question(chalk.cyan('🧪 To Object ID: '), (toObjectId) => {
            const associationPayload = {
              fromObjectType: fromObjectType.trim(),
              fromObjectId: fromObjectId.trim(),
              toObjectType: toObjectType.trim(),
              toObjectId: toObjectId.trim(),
              associationType: this.getDefaultAssociationType(fromObjectType.trim(), toObjectType.trim())
            };
            
            this.executeAssociation('create', associationPayload);
          });
        });
      });
    });
  }

  listAssociations() {
    this.rl.question(chalk.cyan('🧪 Object Type: '), (objectType) => {
      this.rl.question(chalk.cyan('🧪 Object ID: '), (objectId) => {
        this.rl.question(chalk.cyan('🧪 Associated Object Type: '), (associatedObjectType) => {
          this.executeAssociation('list', {
            objectType: objectType.trim(),
            objectId: objectId.trim(),
            associatedObjectType: associatedObjectType.trim()
          });
        });
      });
    });
  }

  deleteAssociation() {
    console.log(chalk.cyan('\n🧪 Deleting Association:'));
    this.rl.question(chalk.cyan('🧪 From Object Type: '), (fromObjectType) => {
      this.rl.question(chalk.cyan('🧪 From Object ID: '), (fromObjectId) => {
        this.rl.question(chalk.cyan('🧪 To Object Type: '), (toObjectType) => {
          this.rl.question(chalk.cyan('🧪 To Object ID: '), (toObjectId) => {
            const associationPayload = {
              fromObjectType: fromObjectType.trim(),
              fromObjectId: fromObjectId.trim(),
              toObjectType: toObjectType.trim(),
              toObjectId: toObjectId.trim()
            };
            
            this.executeAssociation('delete', associationPayload);
          });
        });
      });
    });
  }

  async executeAssociation(action, payload) {
    console.log(chalk.yellow('\n🧪 Executing association operation through Pi...'));
    
    try {
      let endpoint, method;
      
      switch (action) {
        case 'create':
          endpoint = `/api/hubspot/crm/v3/objects/${payload.fromObjectType}/${payload.fromObjectId}/associations/${payload.toObjectType}/${payload.toObjectId}`;
          method = 'PUT';
          break;
        case 'list':
          endpoint = `/api/hubspot/crm/v3/objects/${payload.objectType}/${payload.objectId}/associations/${payload.associatedObjectType}`;
          method = 'GET';
          break;
        case 'delete':
          endpoint = `/api/hubspot/crm/v3/objects/${payload.fromObjectType}/${payload.fromObjectId}/associations/${payload.toObjectType}/${payload.toObjectId}`;
          method = 'DELETE';
          break;
      }

      const startTime = Date.now();
      const response = await axios({
        method,
        url: `${this.piApiUrl}${endpoint}`,
        timeout: 30000,
        headers: { 'Content-Type': 'application/json' }
      });
      const responseTime = Date.now() - startTime;

      console.log(chalk.green(`\n✅ 🔗 ASSOCIATION ${action.toUpperCase()} SUCCESS!`));
      console.log(chalk.gray(`⏱️  Response Time: ${responseTime}ms`));
      console.log(chalk.gray(`📊 Status: ${response.status} ${response.statusText}`));
      
      const data = response.data?.data || response.data;
      if (data) {
        console.log(chalk.cyan('\n📋 Response Data:'));
        console.log(chalk.gray(JSON.stringify(data, null, 2)));
      }

      this.saveToHistory('associations', { action }, payload, response, responseTime);

    } catch (error) {
      this.displayError(error, 'associations', { action });
    }

    this.returnToMenu();
  }

  getDefaultAssociationType(fromType, toType) {
    // Default association types for common relationships
    const associations = {
      'contact_company': 'contact_to_company',
      'contact_deal': 'contact_to_deal',
      'company_deal': 'company_to_deal'
    };
    
    return associations[`${fromType}_${toType}`] || 'primary';
  }

  showEngagementOperations() {
    console.log(chalk.cyan('\n🧪 💼 Engagement Operations:'));
    console.log(chalk.white('  [1] 📝 Create Note'));
    console.log(chalk.white('  [2] 📞 Create Call'));
    console.log(chalk.white('  [3] 📧 Create Email'));
    console.log(chalk.white('  [4] 📅 Create Meeting'));
    console.log(chalk.white('  [5] ✅ Create Task'));
    console.log(chalk.white('  [6] 👁️  List Engagements'));
    console.log(chalk.white('  [0] ⬅️  Back to Main Menu'));
    
    this.rl.question(chalk.cyan('\n🧪 Select engagement type: '), (answer) => {
      this.handleEngagementChoice(answer.trim());
    });
  }

  handleEngagementChoice(choice) {
    if (choice === '0') {
      this.showMainMenu();
      return;
    }

    const engagementTypes = {
      '1': 'notes',
      '2': 'calls',
      '3': 'emails',
      '4': 'meetings',
      '5': 'tasks'
    };

    if (choice === '6') {
      this.listEngagements();
      return;
    }

    const engagementType = engagementTypes[choice];
    if (engagementType) {
      this.createEngagement(engagementType);
    } else {
      console.log(chalk.red('🧪 Invalid choice.'));
      this.showEngagementOperations();
    }
  }

  createEngagement(engagementType) {
    console.log(chalk.cyan(`\n🧪 Creating ${engagementType.slice(0, -1)}:`));
    
    const template = this.getEngagementTemplate(engagementType);
    console.log(chalk.yellow('\n🧪 Template payload:'));
    console.log(chalk.gray(JSON.stringify(template, null, 2)));
    
    this.rl.question(chalk.cyan('🧪 Use template (y) or paste custom JSON (n)? '), (answer) => {
      if (answer.toLowerCase().startsWith('y')) {
        this.executeEngagement(engagementType, template);
      } else {
        this.getPastedPayload((payload) => {
          this.executeEngagement(engagementType, payload);
        });
      }
    });
  }

  getEngagementTemplate(engagementType) {
    const timestamp = Date.now();
    const templates = {
      notes: {
        engagement: {
          active: true,
          type: 'NOTE',
          timestamp
        },
        metadata: {
          body: `Test note created via Pi Test Runner at ${new Date().toISOString()}`
        },
        associations: {
          contactIds: [],
          companyIds: [],
          dealIds: []
        }
      },
      calls: {
        engagement: {
          active: true,
          type: 'CALL',
          timestamp
        },
        metadata: {
          body: 'Test call logged via Pi Test Runner',
          duration: 1800000, // 30 minutes in milliseconds
          status: 'COMPLETED',
          disposition: 'CONNECTED'
        },
        associations: {
          contactIds: [],
          companyIds: [],
          dealIds: []
        }
      },
      emails: {
        engagement: {
          active: true,
          type: 'EMAIL',
          timestamp
        },
        metadata: {
          subject: 'Test Email via Pi Test Runner',
          body: 'This is a test email engagement created via Pi Test Runner',
          direction: 'EMAIL_SENT'
        },
        associations: {
          contactIds: [],
          companyIds: [],
          dealIds: []
        }
      },
      meetings: {
        engagement: {
          active: true,
          type: 'MEETING',
          timestamp
        },
        metadata: {
          body: 'Test meeting logged via Pi Test Runner',
          startTime: timestamp,
          endTime: timestamp + 3600000, // 1 hour later
          title: 'Test Meeting'
        },
        associations: {
          contactIds: [],
          companyIds: [],
          dealIds: []
        }
      },
      tasks: {
        engagement: {
          active: true,
          type: 'TASK',
          timestamp
        },
        metadata: {
          body: 'Test task created via Pi Test Runner',
          subject: 'Test Task',
          status: 'NOT_STARTED',
          forObjectType: 'CONTACT'
        },
        associations: {
          contactIds: [],
          companyIds: [],
          dealIds: []
        }
      }
    };

    return templates[engagementType];
  }

  async executeEngagement(engagementType, payload) {
    console.log(chalk.yellow('\n🧪 Creating engagement through Pi...'));
    
    try {
      const startTime = Date.now();
      const response = await axios.post(`${this.piApiUrl}/api/hubspot/engagements/v1/engagements`, payload, {
        timeout: 30000,
        headers: { 'Content-Type': 'application/json' }
      });
      const responseTime = Date.now() - startTime;

      console.log(chalk.green(`\n✅ 💼 ${engagementType.toUpperCase()} ENGAGEMENT SUCCESS!`));
      console.log(chalk.gray(`⏱️  Response Time: ${responseTime}ms`));
      console.log(chalk.gray(`📊 Status: ${response.status} ${response.statusText}`));
      
      const data = response.data?.data || response.data;
      if (data?.engagement?.id) {
        console.log(chalk.cyan('\n🎯 Engagement Created:'));
        console.log(chalk.white(`  ID: ${chalk.yellow(data.engagement.id)}`));
        console.log(chalk.white(`  Type: ${chalk.yellow(data.engagement.type)}`));
        console.log(chalk.white(`  Created: ${chalk.yellow(new Date(data.engagement.createdAt).toLocaleString())}`));
      }

      this.saveToHistory('engagements', { action: 'create', type: engagementType }, payload, response, responseTime);

    } catch (error) {
      this.displayError(error, 'engagements', { action: 'create' });
    }

    this.returnToMenu();
  }

  handleCurlParsing() {
    console.log(chalk.cyan('\n🧪 📄 Curl Command Parser:'));
    console.log(chalk.white('Paste your curl command (from Mark or elsewhere):'));
    console.log(chalk.gray('Example: curl -X POST http://... -H "Content-Type: application/json" -d \'{...}\''));
    
    this.rl.question(chalk.cyan('\n🧪 Curl command: '), (curlCommand) => {
      this.parseCurlCommand(curlCommand.trim());
    });
  }

  parseCurlCommand(curlCommand) {
    try {
      console.log(chalk.yellow('\n🧪 Parsing curl command...'));
      
      // Basic curl parsing
      const parsed = this.parseCurl(curlCommand);
      
      if (!parsed) {
        console.log(chalk.red('🧪 Failed to parse curl command. Please check the syntax.'));
        this.returnToMenu();
        return;
      }

      console.log(chalk.cyan('\n🧪 Parsed Request:'));
      console.log(chalk.white(`  Method: ${chalk.yellow(parsed.method)}`));
      console.log(chalk.white(`  URL: ${chalk.yellow(parsed.url)}`));
      if (parsed.headers && Object.keys(parsed.headers).length > 0) {
        console.log(chalk.white('  Headers:'));
        Object.entries(parsed.headers).forEach(([key, value]) => {
          console.log(chalk.gray(`    ${key}: ${value}`));
        });
      }
      if (parsed.data) {
        console.log(chalk.white('  Body:'));
        console.log(chalk.gray(`    ${JSON.stringify(parsed.data, null, 2)}`));
      }

      this.rl.question(chalk.cyan('\n🧪 Execute this request? (Y/n): '), async (answer) => {
        if (!answer || answer.toLowerCase().startsWith('y')) {
          await this.executeParsedRequest(parsed);
        }
        this.returnToMenu();
      });

    } catch (error) {
      console.log(chalk.red(`🧪 Parse error: ${error.message}`));
      this.returnToMenu();
    }
  }

  parseCurl(curlCommand) {
    // Simple curl parser - handles basic cases
    const request = {
      method: 'GET',
      url: '',
      headers: {},
      data: null
    };

    // Extract method
    const methodMatch = curlCommand.match(/-X\s+(\w+)/i);
    if (methodMatch) {
      request.method = methodMatch[1].toUpperCase();
    }

    // Extract URL
    const urlMatch = curlCommand.match(/curl\s+(?:-\w+\s+\S+\s+)*['"]?([^'"\s]+)['"]?/);
    if (urlMatch) {
      request.url = urlMatch[1];
    }

    // Extract headers
    const headerMatches = curlCommand.matchAll(/-H\s+['"]([^'"]+)['"]/g);
    for (const match of headerMatches) {
      const [key, value] = match[1].split(':').map(s => s.trim());
      if (key && value) {
        request.headers[key] = value;
      }
    }

    // Extract data
    const dataMatch = curlCommand.match(/-d\s+['"](.+?)['"]/s);
    if (dataMatch) {
      try {
        request.data = JSON.parse(dataMatch[1]);
      } catch {
        request.data = dataMatch[1];
      }
    }

    return request.url ? request : null;
  }

  async executeParsedRequest(parsed) {
    console.log(chalk.yellow('\n🧪 Executing parsed request through Pi...'));
    
    try {
      const startTime = Date.now();
      
      const response = await axios({
        method: parsed.method,
        url: parsed.url,
        headers: parsed.headers,
        data: parsed.data,
        timeout: 30000
      });
      
      const responseTime = Date.now() - startTime;

      console.log(chalk.green(`\n✅ 📄 CURL EXECUTION SUCCESS!`));
      console.log(chalk.gray(`⏱️  Response Time: ${responseTime}ms`));
      console.log(chalk.gray(`📊 Status: ${response.status} ${response.statusText}`));
      
      // Try to extract object type for better formatting
      const objectType = this.detectObjectType(parsed.url);
      if (objectType) {
        this.displayFormattedResponse(response, responseTime, objectType, { action: 'curl' });
      } else {
        console.log(chalk.cyan('\n📋 Response Data:'));
        const data = response.data?.data || response.data;
        console.log(chalk.gray(JSON.stringify(data, null, 2)));
      }

      this.saveToHistory('curl', { action: 'execute' }, parsed, response, responseTime);

    } catch (error) {
      this.displayError(error, 'curl', { action: 'execute' });
    }
  }

  detectObjectType(url) {
    if (url.includes('/contacts')) return 'contacts';
    if (url.includes('/companies')) return 'companies';
    if (url.includes('/deals')) return 'deals';
    if (url.includes('/tickets')) return 'tickets';
    if (url.includes('/products')) return 'products';
    return null;
  }

  handleJsonPayload() {
    console.log(chalk.cyan('\n🧪 📋 JSON Payload Input:'));
    console.log(chalk.white('Select endpoint for your JSON payload:'));
    console.log(chalk.white('  [1] 📞 POST /api/hubspot/contacts'));
    console.log(chalk.white('  [2] 🏢 POST /api/hubspot/companies'));
    console.log(chalk.white('  [3] 💰 POST /api/hubspot/deals'));
    console.log(chalk.white('  [4] 🔍 POST /api/hubspot/search/contacts'));
    console.log(chalk.white('  [5] 🔗 Custom endpoint'));
    
    this.rl.question(chalk.cyan('\n🧪 Select endpoint: '), (choice) => {
      const endpoints = {
        '1': { url: '/api/hubspot/contacts', method: 'POST', type: 'contacts' },
        '2': { url: '/api/hubspot/companies', method: 'POST', type: 'companies' },
        '3': { url: '/api/hubspot/deals', method: 'POST', type: 'deals' },
        '4': { url: '/api/hubspot/search/contacts', method: 'POST', type: 'search' }
      };

      if (choice === '5') {
        this.rl.question(chalk.cyan('🧪 Enter endpoint path: '), (endpoint) => {
          this.rl.question(chalk.cyan('🧪 Enter method (GET/POST/PUT/DELETE): '), (method) => {
            this.getPastedPayload((payload) => {
              this.executeCustomRequest(endpoint.trim(), method.trim().toUpperCase(), payload);
            });
          });
        });
        return;
      }

      const endpoint = endpoints[choice.trim()];
      if (endpoint) {
        this.getPastedPayload((payload) => {
          this.executeEndpointRequest(endpoint, payload);
        });
      } else {
        console.log(chalk.red('🧪 Invalid choice.'));
        this.handleJsonPayload();
      }
    });
  }

  getPastedPayload(callback) {
    console.log(chalk.cyan('\n🧪 Paste your JSON payload (end with empty line):'));
    let jsonInput = '';
    
    const collectInput = () => {
      this.rl.question('', (line) => {
        if (line.trim() === '') {
          try {
            const payload = JSON.parse(jsonInput);
            callback(payload);
          } catch (error) {
            console.log(chalk.red(`🧪 Invalid JSON: ${error.message}`));
            console.log(chalk.cyan('🧪 Please try again:'));
            jsonInput = '';
            collectInput();
          }
        } else {
          jsonInput += line + '\n';
          collectInput();
        }
      });
    };
    
    collectInput();
  }

  async executeEndpointRequest(endpoint, payload) {
    console.log(chalk.yellow('\n🧪 Executing request through Pi...'));
    
    try {
      const startTime = Date.now();
      const response = await axios({
        method: endpoint.method,
        url: `${this.piApiUrl}${endpoint.url}`,
        data: payload,
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      });
      const responseTime = Date.now() - startTime;

      if (endpoint.type === 'search') {
        this.displaySearchResults(response, responseTime, endpoint.url.split('/').pop());
      } else {
        this.displayFormattedResponse(response, responseTime, endpoint.type, { action: 'json_payload' });
      }

      this.saveToHistory(endpoint.type, { action: 'json_payload' }, payload, response, responseTime);

    } catch (error) {
      this.displayError(error, endpoint.type, { action: 'json_payload' });
    }

    this.returnToMenu();
  }

  async executeCustomRequest(endpoint, method, payload) {
    console.log(chalk.yellow('\n🧪 Executing custom request through Pi...'));
    
    try {
      const startTime = Date.now();
      const config = {
        method,
        url: `${this.piApiUrl}${endpoint}`,
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      };

      if (payload && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        config.data = payload;
      }

      const response = await axios(config);
      const responseTime = Date.now() - startTime;

      console.log(chalk.green(`\n✅ 🔧 CUSTOM REQUEST SUCCESS!`));
      console.log(chalk.gray(`⏱️  Response Time: ${responseTime}ms`));
      console.log(chalk.gray(`📊 Status: ${response.status} ${response.statusText}`));
      
      const data = response.data?.data || response.data;
      console.log(chalk.cyan('\n📋 Response Data:'));
      console.log(chalk.gray(JSON.stringify(data, null, 2)));

      this.saveToHistory('custom', { action: 'custom_request' }, payload, response, responseTime);

    } catch (error) {
      this.displayError(error, 'custom', { action: 'custom_request' });
    }

    this.returnToMenu();
  }

  showSavedPayloads() {
    if (this.savedPayloads.size === 0) {
      console.log(chalk.yellow('\n🧪 No saved payloads found.'));
      this.returnToMenu();
      return;
    }

    console.log(chalk.cyan('\n🧪 💾 Saved Payloads:'));
    let index = 1;
    const payloadList = [];
    
    for (const [name, payload] of this.savedPayloads.entries()) {
      console.log(chalk.white(`  [${index}] ${name}`));
      payloadList.push({ name, payload });
      index++;
    }
    
    console.log(chalk.white(`  [0] ⬅️  Back to Main Menu`));
    
    this.rl.question(chalk.cyan('\n🧪 Select payload to use: '), (choice) => {
      const selectedIndex = parseInt(choice) - 1;
      if (choice === '0') {
        this.showMainMenu();
      } else if (selectedIndex >= 0 && selectedIndex < payloadList.length) {
        const selected = payloadList[selectedIndex];
        console.log(chalk.cyan(`\n🧪 Selected: ${selected.name}`));
        console.log(chalk.gray(JSON.stringify(selected.payload, null, 2)));
        this.returnToMenu();
      } else {
        console.log(chalk.red('🧪 Invalid choice.'));
        this.showSavedPayloads();
      }
    });
  }

  showTestHistory() {
    if (this.testHistory.length === 0) {
      console.log(chalk.yellow('\n🧪 No test history found.'));
      this.returnToMenu();
      return;
    }

    console.log(chalk.cyan('\n🧪 📊 Test History (Last 10):'));
    
    this.testHistory.slice(-10).forEach((test, index) => {
      const status = test.success ? chalk.green('✅') : chalk.red('❌');
      const time = new Date(test.timestamp).toLocaleTimeString();
      console.log(chalk.white(`  ${status} ${time} - ${test.objectType} ${test.operation.action} (${test.responseTime}ms)`));
    });

    this.returnToMenu();
  }

  async checkPiStatus() {
    console.log(chalk.yellow('\n🧪 Checking Pi API Hub status...'));
    
    try {
      const healthResponse = await axios.get(`${this.piApiUrl}/health`, { timeout: 10000 });
      const health = healthResponse.data;
      
      console.log(chalk.green('\n🧪 Pi API Hub Status:'));
      console.log(chalk.white(`   Status: ${chalk.green(health.status)}`));
      console.log(chalk.white(`   Uptime: ${chalk.cyan((health.uptime / 3600).toFixed(2))} hours`));
      console.log(chalk.white(`   Environment: ${chalk.yellow(health.environment)}`));
      console.log(chalk.white(`   Mode: ${chalk.magenta(health.worker?.clustered ? 'Clustered' : 'Single Process')}`));
      
      // Test HubSpot connectivity
      try {
        const connectionResponse = await axios.get(`${this.piApiUrl}/api/test-connections`, { timeout: 5000 });
        const connections = connectionResponse.data.connections;
        
        console.log(chalk.green('\n🧪 API Connections:'));
        if (connections.hubspot?.status === 'success') {
          console.log(chalk.white(`   HubSpot: ${chalk.green('✅ Connected')}`));
        } else {
          console.log(chalk.white(`   HubSpot: ${chalk.red('❌ Failed')}`));
        }
        
        if (connections.anthropic?.status === 'success') {
          console.log(chalk.white(`   Anthropic: ${chalk.green('✅ Connected')}`));
        } else {
          console.log(chalk.white(`   Anthropic: ${chalk.red('❌ Failed')}`));
        }
      } catch (connError) {
        console.log(chalk.yellow('\n🧪 Connection test unavailable'));
      }
      
    } catch (error) {
      console.log(chalk.red('\n🧪 Unable to connect to Pi API Hub'));
      console.log(chalk.red(`   ${error.message}`));
      console.log(chalk.yellow(`   Make sure the Pi is running at: ${this.piApiUrl}`));
    }

    this.returnToMenu();
  }

  saveToHistory(objectType, operation, payload, response, responseTime) {
    this.testHistory.push({
      timestamp: new Date().toISOString(),
      objectType,
      operation,
      payload,
      response: {
        status: response.status,
        data: response.data
      },
      responseTime,
      success: response.status >= 200 && response.status < 300
    });

    // Keep only last 50 tests
    if (this.testHistory.length > 50) {
      this.testHistory = this.testHistory.slice(-50);
    }
  }

  loadSavedPayloads() {
    try {
      const payloadsPath = path.join(process.cwd(), '.pi-test-payloads.json');
      if (fs.existsSync(payloadsPath)) {
        const saved = JSON.parse(fs.readFileSync(payloadsPath, 'utf8'));
        Object.entries(saved).forEach(([name, payload]) => {
          this.savedPayloads.set(name, payload);
        });
      }
    } catch (error) {
      // Ignore load errors
    }
  }

  savePayloads() {
    try {
      const payloadsPath = path.join(process.cwd(), '.pi-test-payloads.json');
      const payloadObj = {};
      this.savedPayloads.forEach((payload, name) => {
        payloadObj[name] = payload;
      });
      fs.writeFileSync(payloadsPath, JSON.stringify(payloadObj, null, 2));
    } catch (error) {
      // Ignore save errors
    }
  }

  getObjectEmoji(objectType) {
    const emojis = {
      contacts: '📞',
      companies: '🏢',
      deals: '💰',
      tickets: '🎫',
      products: '📦',
      engagements: '💼'
    };
    return emojis[objectType] || '🔧';
  }

  returnToMenu() {
    console.log(chalk.cyan('\n🧪 Press Enter to return to main menu...'));
    this.rl.question('', () => {
      this.showMainMenu();
    });
  }

  exitRunner() {
    console.log(chalk.green('\n🧪 Pi Test Runner says: "Great testing session! Your Pi is ready for anything! 🍌"'));
    console.log(chalk.yellow('🧪 Test Runner closed. Happy API testing! 🧪\n'));
    this.savePayloads();
    this.rl.close();
    process.exit(0);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
🧪 Pi Test Runner - HubSpot API Testing Powerhouse

Usage: pi-test-runner [options]

Options:
  --pi-url <url>    Pi API Hub URL (default: http://10.0.0.218:3000)
  --help, -h        Show this help

Environment Variables:
  PI_API_URL        Pi API Hub URL

Examples:
  pi-test-runner
  pi-test-runner --pi-url http://192.168.1.100:3000
  PI_API_URL=http://10.0.0.218:3000 pi-test-runner

🧪 Ready to execute real API tests through your Pi!
`);
  process.exit(0);
}

// Handle custom Pi URL
const piUrlIndex = args.indexOf('--pi-url');
if (piUrlIndex !== -1 && args[piUrlIndex + 1]) {
  process.env.PI_API_URL = args[piUrlIndex + 1];
}

// Start the test runner
new PiTestRunner();