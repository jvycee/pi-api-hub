# 🍌 OLLAMA TEMPLATE SUGGESTION ENGINE - TESTING GUIDE 🍌

## **Testing That Ollama is Actually Being Used**

### **🎯 Quick Verification Steps:**

1. **Check if Ollama is running on your Pi:**
   ```bash
   # On Pi
   ps aux | grep ollama
   curl http://localhost:11434/api/tags
   ```

2. **Run the auto-deployment (if changes were made):**
   ```bash
   # Your latest changes should auto-deploy via GitHub Actions
   # Check GitHub Actions tab for deployment status
   ```

3. **Run the comprehensive test script:**
   ```bash
   # On Pi
   cd ~/pi-api-hub
   node test-ollama-integration.js --auto
   ```

### **🔍 Manual Testing Methods:**

#### **Method 1: Direct AI Endpoint Test**
```bash
# Test AI endpoint to see which provider is used
curl -X POST http://localhost:3000/api/anthropic/messages \
  -H "Content-Type: application/json" \
  -H "x-admin-api-key: YOUR_ADMIN_KEY" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Hello, can you help me optimize API performance?"
      }
    ],
    "max_tokens": 50,
    "taskType": "analysis"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {...},
  "metadata": {
    "provider": "ollama",  // <-- This confirms Ollama is being used
    "routingReason": "...",
    "responseTime": "...",
    "costSavingMode": true
  }
}
```

#### **Method 2: Monitor AI Usage Stats**
```bash
# Check AI routing statistics
curl -H "x-admin-api-key: YOUR_ADMIN_KEY" \
  http://localhost:3000/monitoring/ai
```

**Look for:**
- `ollamaUsagePercent > 0`
- `primaryProvider: "ollama"`
- `totalRequests > 0`

#### **Method 3: Generate Traffic and Check Templates**
```bash
# Generate traffic to trigger template analysis
for i in {1..10}; do
  curl -H "x-admin-api-key: YOUR_ADMIN_KEY" \
    http://localhost:3000/health
  curl -H "x-admin-api-key: YOUR_ADMIN_KEY" \
    http://localhost:3000/monitoring/dashboard
done

# Wait for analysis
sleep 60

# Check for AI insights
curl -H "x-admin-api-key: YOUR_ADMIN_KEY" \
  http://localhost:3000/analytics/ai-insights
```

### **🚀 Automated Testing Scripts:**

#### **1. Interactive Test Script**
```bash
cd ~/pi-api-hub
node test-ollama-integration.js
```

**Features:**
- Tests Ollama connection
- Generates traffic for templates
- Checks AI insights
- Monitors Ollama usage

#### **2. Bash Monitoring Script**
```bash
cd ~/pi-api-hub
./monitor-ollama-usage.sh --auto
```

**Features:**
- Checks Ollama service
- Tests API routing
- Monitors template activity
- Generates test traffic

#### **3. Jest Test Suite**
```bash
cd ~/pi-api-hub
npm test test/analytics-ollama.test.js
```

### **📊 What to Look For:**

#### **✅ Signs Ollama is Working:**
1. **AI Endpoint Response:**
   - `metadata.provider: "ollama"`
   - Response contains actual AI-generated content

2. **AI Stats:**
   - `ollamaUsagePercent > 0`
   - `primaryProvider: "ollama"`

3. **Template Stats:**
   - `templatesGenerated > 0`
   - `optimizationSuggestions > 0`

4. **AI Insights:**
   - `totalSuggestions > 0`
   - Suggestions have `source: "ollama"`

#### **❌ Signs Ollama is NOT Working:**
1. **AI Endpoint Response:**
   - `metadata.provider: "anthropic"` (fallback)
   - Error messages about Ollama connection

2. **AI Stats:**
   - `ollamaUsagePercent: 0`
   - `primaryProvider: "anthropic"`

3. **Template Stats:**
   - `optimizationSuggestions: 0`
   - No AI insights generated

### **🔧 How the Template System Works:**

1. **Request Recording:**
   - Every request is recorded by `RequestTemplateManager`
   - Templates are built from request patterns

2. **Analysis Trigger:**
   - Every 5 minutes (configurable)
   - Analyzes inefficient endpoints
   - Generates optimization suggestions via Ollama

3. **Ollama Integration:**
   - Sends analysis data to Ollama
   - Requests specific optimization recommendations
   - Parses and stores suggestions

### **🎯 Testing Scenarios:**

#### **Scenario 1: Fresh Deployment**
```bash
# 1. Deploy code
git push origin main

# 2. Wait for deployment
sleep 60

# 3. Generate traffic
for i in {1..20}; do
  curl -H "x-admin-api-key: YOUR_KEY" http://localhost:3000/health
done

# 4. Wait for analysis
sleep 300  # 5 minutes

# 5. Check results
curl -H "x-admin-api-key: YOUR_KEY" http://localhost:3000/analytics/ai-insights
```

#### **Scenario 2: Continuous Monitoring**
```bash
# Run monitoring script in background
./monitor-ollama-usage.sh --monitor &

# Generate continuous traffic
while true; do
  curl -H "x-admin-api-key: YOUR_KEY" http://localhost:3000/monitoring/dashboard
  sleep 10
done
```

#### **Scenario 3: Specific Endpoint Testing**
```bash
# Test specific endpoint optimization
curl -H "x-admin-api-key: YOUR_KEY" \
  http://localhost:3000/analytics/optimize/GET/monitoring/dashboard
```

### **📋 Troubleshooting:**

#### **Issue: Ollama not responding**
```bash
# Check Ollama service
sudo systemctl status ollama
sudo systemctl restart ollama

# Check Ollama models
ollama list
ollama pull llama3.1:8b  # If model missing
```

#### **Issue: No AI insights generated**
```bash
# Check template stats
curl -H "x-admin-api-key: YOUR_KEY" \
  http://localhost:3000/analytics/templates/stats

# Generate more traffic if needed
for i in {1..50}; do
  curl -H "x-admin-api-key: YOUR_KEY" \
    http://localhost:3000/monitoring/dashboard
done
```

#### **Issue: AI falling back to Anthropic**
```bash
# Check AI handler stats
curl -H "x-admin-api-key: YOUR_KEY" \
  http://localhost:3000/monitoring/ai

# Check Ollama connectivity
curl http://localhost:11434/api/tags
```

### **🕒 Timeline Expectations:**

- **Immediate:** Ollama connection test should work
- **1-2 minutes:** Templates start generating
- **5-10 minutes:** First AI analysis triggered
- **10-15 minutes:** AI insights appear in dashboard

### **🔍 Log Monitoring:**

```bash
# Monitor Pi API Hub logs
pm2 logs pi-api-hub | grep -i ollama

# Monitor system logs
journalctl -u ollama -f

# Monitor analytics logs
pm2 logs pi-api-hub | grep -i "analytics\|template\|optimization"
```

### **🎉 Success Indicators:**

When everything is working, you should see:
- AI insights with `source: "ollama"`
- Ollama usage percentage > 0
- Template optimization suggestions
- Cost savings from using Ollama over Claude

The system is designed to learn and improve over time, so don't worry if you don't see immediate results. The more traffic you generate, the better the suggestions become! 🍌