# 🐐 Mark - Your Pi API Assistant

Meet **Mark**, your AI-powered assistant that runs on your Raspberry Pi and helps you test, troubleshoot, and optimize your API infrastructure!

## 🚀 Quick Start

**From anywhere in the project:**
```bash
# Simple launcher
./mark

# Or via npm
npm run mark
npm run chat

# Or directly
node bin/talk-to-mark.js
```

## 🐐 What Mark Can Do

Mark is your expert assistant for:

### 🧪 **API Testing & Payload Generation**
- Generate realistic test payloads for HubSpot, webhooks, MCP
- Create curl commands and API testing strategies  
- Help troubleshoot API integration issues
- Provide performance testing guidance

### 🔗 **Webhook Expertise**
- Debug webhook delivery issues
- Generate webhook payloads for testing
- Help configure webhook endpoints
- Troubleshoot HubSpot webhook integration

### 🛡️ **Security Testing**
- Test Phase 2 security features (MFA, zero-trust, honeypots)
- Generate security test scenarios
- Help with vulnerability assessment
- Guide through threat detection testing

### 🔧 **Infrastructure Support**
- Monitor Pi API Hub performance
- Troubleshoot clustering and scaling issues
- Analyze logs and metrics
- Optimize banana-powered infrastructure 🍌

### 📋 **Smart Suggestions**
- Best practices for API design
- Performance optimization tips
- Security recommendations
- Testing strategies

## 🎯 Commands & Usage

### **Natural Language**
Just talk to Mark naturally:
```
"How do I test the HubSpot contact API?"
"Generate a webhook payload for deal updates"  
"Help me troubleshoot MFA issues"
"What's the best way to test rate limiting?"
```

### **Quick Commands**
```bash
/test api          # API testing examples
/webhook hubspot   # HubSpot webhook help
/security scan     # Security testing guidance  
/payload contact   # Generate contact payload
/status           # Check Pi status
/help             # Show all commands
/exit             # End conversation
```

## ⚙️ Configuration

**Default Pi URL:** `http://10.0.0.218:3000`

**Custom Pi URL:**
```bash
# Via environment variable
PI_API_URL=http://192.168.1.100:3000 ./mark

# Via command line
./mark --pi-url http://192.168.1.100:3000
```

## 🔧 How It Works

Mark leverages your Pi's infrastructure:

1. **Connects to your Pi API Hub** at the configured URL
2. **Routes through your AI system** (Ollama primary, Claude fallback)
3. **Accesses real Pi capabilities** like monitoring, security, analytics
4. **Provides contextual help** based on your actual infrastructure
5. **Generates actionable examples** using your Pi's endpoints

## 🎨 Features

- **🌈 Colorful terminal interface** with chalk styling
- **💬 Conversation memory** maintains context across the chat
- **🔄 Auto-retry logic** with helpful error messages
- **📊 Real-time Pi status** checking and monitoring
- **🎯 Context-aware responses** based on your question type
- **🐐 Persistent personality** - Mark remembers who he is!

## 🧪 Example Interactions

### API Testing
```
You: How do I test the contact creation API?
Mark: Here's a complete test for creating HubSpot contacts through your Pi:

curl -X POST http://10.0.0.218:3000/api/hubspot/contacts \
  -H "Content-Type: application/json" \
  -d '{
    "firstname": "Test",
    "lastname": "Contact", 
    "email": "test@example.com"
  }'

This will create a contact and return the HubSpot contact ID...
```

### Webhook Testing  
```
You: /webhook test
Mark: Let me help you test webhooks! Here's a sample HubSpot webhook payload
you can send to your Pi's webhook endpoint:

POST http://10.0.0.218:3000/webhooks/hubspot
Content-Type: application/json
X-HubSpot-Signature: sha256=...

{
  "subscriptionType": "contact.creation",
  "eventId": 12345,
  "attemptNumber": 0,
  "objectId": 12345,
  "changeSource": "CRM",
  ...
}
```

### Security Testing
```
You: Test the honeypot system
Mark: Great! Let's test your Phase 2 honeypot system. Try accessing these
honeypot endpoints that should trigger detection:

curl http://10.0.0.218:3000/admin.php
curl http://10.0.0.218:3000/.env  
curl http://10.0.0.218:3000/wp-admin/

Then check the honeypot dashboard:
curl http://10.0.0.218:3000/security/honeypots \
  -H "x-admin-api-key: your-admin-key"
```

## 🛟 Troubleshooting

**Can't connect to Pi?**
- Check if your Pi API Hub is running: `NODE_ENV=production node cluster.js`
- Verify the Pi URL is correct: `./mark --pi-url http://YOUR_PI_IP:3000`
- Test Pi connectivity: `curl http://YOUR_PI_IP:3000/health`

**Mark seems confused?**
- Be specific about what you're testing
- Use the `/help` command to see available options
- Try `/status` to check if Pi services are healthy

**Want more detailed help?**
- Use commands like `/test api` for focused assistance
- Ask Mark about specific error messages you're seeing
- Request step-by-step guides for complex testing scenarios

## 🍌 Integration with Pi Infrastructure

Mark directly integrates with your Pi's:
- **🏗️ API Hub** - All HubSpot, Anthropic, and MCP endpoints
- **🛡️ Security Systems** - Threat detection, MFA, zero-trust, honeypots  
- **📊 Monitoring** - Performance metrics, analytics, health checks
- **🔗 Webhooks** - Real-time event processing and testing
- **🎯 Smart Routing** - Ollama-first AI with Claude fallback

**Mark makes your Pi infrastructure accessible through natural conversation!** 🐐

---

*Mark is powered by your Pi's Ollama installation with Claude fallback, giving you local AI assistance that understands your exact infrastructure setup.* 🍌🚀