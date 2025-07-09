#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🦙 OLLAMA CONNECTION TEST - Pi API Hub${NC}"
echo -e "${BLUE}===============================================${NC}"

# Configuration
PI_API_URL="http://localhost:3000"
OLLAMA_URL="http://10.0.0.218:11434"
ADMIN_KEY="f00d268863ad4f08992aa8583d2b6ea96c65e649f206a9828334bbb3bbd8f7e7"

echo -e "\n${YELLOW}📍 Testing Ollama Direct Connection...${NC}"

# Test 1: Direct Ollama API connection
echo -e "${BLUE}1. Testing direct Ollama API at ${OLLAMA_URL}${NC}"
OLLAMA_RESPONSE=$(curl -s -w "%{http_code}" "${OLLAMA_URL}/api/tags")
HTTP_CODE="${OLLAMA_RESPONSE: -3}"
BODY="${OLLAMA_RESPONSE%???}"

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Direct Ollama connection: SUCCESS${NC}"
    echo -e "${GREEN}   Available models: $(echo "$BODY" | jq -r '.models[].name' | tr '\n' ' ')${NC}"
else
    echo -e "${RED}❌ Direct Ollama connection: FAILED (HTTP $HTTP_CODE)${NC}"
fi

# Test 2: Test specific model
echo -e "\n${BLUE}2. Testing llama3.2:latest model availability${NC}"
MODEL_CHECK=$(echo "$BODY" | jq -r '.models[] | select(.name=="llama3.2:latest") | .name')
if [ "$MODEL_CHECK" = "llama3.2:latest" ]; then
    echo -e "${GREEN}✅ llama3.2:latest model: AVAILABLE${NC}"
else
    echo -e "${RED}❌ llama3.2:latest model: NOT FOUND${NC}"
fi

# Test 3: Direct Ollama generation
echo -e "\n${BLUE}3. Testing direct Ollama generation${NC}"
OLLAMA_GEN=$(curl -s -X POST "${OLLAMA_URL}/api/generate" \
    -H "Content-Type: application/json" \
    -d '{
        "model": "llama3.2:latest",
        "prompt": "Say exactly: OLLAMA CONNECTED TO PI",
        "stream": false
    }')

if echo "$OLLAMA_GEN" | jq -e '.response' > /dev/null; then
    OLLAMA_RESPONSE_TEXT=$(echo "$OLLAMA_GEN" | jq -r '.response')
    echo -e "${GREEN}✅ Direct Ollama generation: SUCCESS${NC}"
    echo -e "${GREEN}   Response: $OLLAMA_RESPONSE_TEXT${NC}"
else
    echo -e "${RED}❌ Direct Ollama generation: FAILED${NC}"
fi

echo -e "\n${YELLOW}🍌 Testing Pi API Hub Integration...${NC}"

# Test 4: Pi API Hub health
echo -e "${BLUE}4. Testing Pi API Hub health${NC}"
PI_HEALTH=$(curl -s "${PI_API_URL}/health")
if echo "$PI_HEALTH" | jq -e '.status' > /dev/null; then
    echo -e "${GREEN}✅ Pi API Hub: HEALTHY${NC}"
else
    echo -e "${RED}❌ Pi API Hub: UNHEALTHY${NC}"
fi

# Test 5: AI routing through Pi API Hub
echo -e "\n${BLUE}5. Testing AI routing through Pi API Hub${NC}"
AI_RESPONSE=$(curl -s -X POST "${PI_API_URL}/api/anthropic/messages" \
    -H "Content-Type: application/json" \
    -d '{
        "messages": [{"role": "user", "content": "Say exactly: PI OLLAMA INTEGRATION WORKING"}],
        "max_tokens": 50
    }')

if echo "$AI_RESPONSE" | jq -e '.metadata.provider' > /dev/null; then
    PROVIDER=$(echo "$AI_RESPONSE" | jq -r '.metadata.provider')
    RESPONSE_TEXT=$(echo "$AI_RESPONSE" | jq -r '.data.content[0].text')
    RESPONSE_TIME=$(echo "$AI_RESPONSE" | jq -r '.metadata.responseTime')
    
    if [ "$PROVIDER" = "ollama" ]; then
        echo -e "${GREEN}✅ Pi API Hub AI routing: SUCCESS (Using Ollama)${NC}"
        echo -e "${GREEN}   Provider: $PROVIDER${NC}"
        echo -e "${GREEN}   Response: $RESPONSE_TEXT${NC}"
        echo -e "${GREEN}   Response Time: ${RESPONSE_TIME}ms${NC}"
    else
        echo -e "${YELLOW}⚠️  Pi API Hub AI routing: Using fallback ($PROVIDER)${NC}"
    fi
else
    echo -e "${RED}❌ Pi API Hub AI routing: FAILED${NC}"
fi

# Test 6: Ollama usage statistics
echo -e "\n${BLUE}6. Testing Ollama usage statistics${NC}"
AI_STATS=$(curl -s -H "x-admin-api-key: $ADMIN_KEY" "${PI_API_URL}/monitoring/ai")
if echo "$AI_STATS" | jq -e '.data.ollamaUsagePercent' > /dev/null; then
    OLLAMA_USAGE=$(echo "$AI_STATS" | jq -r '.data.ollamaUsagePercent')
    TOTAL_REQUESTS=$(echo "$AI_STATS" | jq -r '.data.totalRequests')
    OLLAMA_AVAILABLE=$(echo "$AI_STATS" | jq -r '.data.providerStatus.ollama.available')
    
    echo -e "${GREEN}✅ Ollama usage statistics: SUCCESS${NC}"
    echo -e "${GREEN}   Ollama Usage: $OLLAMA_USAGE${NC}"
    echo -e "${GREEN}   Total Requests: $TOTAL_REQUESTS${NC}"
    echo -e "${GREEN}   Ollama Available: $OLLAMA_AVAILABLE${NC}"
else
    echo -e "${RED}❌ Ollama usage statistics: FAILED${NC}"
fi

# Test 7: Advanced Analytics Engine
echo -e "\n${BLUE}7. Testing Advanced Analytics Engine${NC}"
ANALYTICS=$(curl -s -H "x-admin-api-key: $ADMIN_KEY" "${PI_API_URL}/analytics/enhanced/overview")
if echo "$ANALYTICS" | jq -e '.data' > /dev/null; then
    DATA_POINTS=$(echo "$ANALYTICS" | jq -r '.data.engine.dataPointsStored')
    ANALYSES=$(echo "$ANALYTICS" | jq -r '.data.engine.analysesCompleted')
    
    echo -e "${GREEN}✅ Advanced Analytics Engine: SUCCESS${NC}"
    echo -e "${GREEN}   Data Points Stored: $DATA_POINTS${NC}"
    echo -e "${GREEN}   Analyses Completed: $ANALYSES${NC}"
else
    echo -e "${RED}❌ Advanced Analytics Engine: FAILED${NC}"
fi

# Test 8: Template suggestion system
echo -e "\n${BLUE}8. Testing Template Suggestion System${NC}"
TEMPLATES=$(curl -s -H "x-admin-api-key: $ADMIN_KEY" "${PI_API_URL}/analytics/templates/stats")
if echo "$TEMPLATES" | jq -e '.data.templatesGenerated' > /dev/null; then
    TEMPLATES_GENERATED=$(echo "$TEMPLATES" | jq -r '.data.templatesGenerated')
    OPTIMIZATION_SUGGESTIONS=$(echo "$TEMPLATES" | jq -r '.data.optimizationSuggestions')
    
    echo -e "${GREEN}✅ Template Suggestion System: SUCCESS${NC}"
    echo -e "${GREEN}   Templates Generated: $TEMPLATES_GENERATED${NC}"
    echo -e "${GREEN}   Optimization Suggestions: $OPTIMIZATION_SUGGESTIONS${NC}"
else
    echo -e "${RED}❌ Template Suggestion System: FAILED${NC}"
fi

# Final Summary
echo -e "\n${BLUE}🎯 FINAL SUMMARY:${NC}"
echo -e "${BLUE}==================${NC}"

# Count successes
TESTS_PASSED=0
TOTAL_TESTS=8

# Check each test result
if [ "$HTTP_CODE" = "200" ]; then ((TESTS_PASSED++)); fi
if [ "$MODEL_CHECK" = "llama3.2:latest" ]; then ((TESTS_PASSED++)); fi
if echo "$OLLAMA_GEN" | jq -e '.response' > /dev/null; then ((TESTS_PASSED++)); fi
if echo "$PI_HEALTH" | jq -e '.status' > /dev/null; then ((TESTS_PASSED++)); fi
if echo "$AI_RESPONSE" | jq -e '.metadata.provider' > /dev/null && [ "$(echo "$AI_RESPONSE" | jq -r '.metadata.provider')" = "ollama" ]; then ((TESTS_PASSED++)); fi
if echo "$AI_STATS" | jq -e '.data.ollamaUsagePercent' > /dev/null; then ((TESTS_PASSED++)); fi
if echo "$ANALYTICS" | jq -e '.data' > /dev/null; then ((TESTS_PASSED++)); fi
if echo "$TEMPLATES" | jq -e '.data.templatesGenerated' > /dev/null; then ((TESTS_PASSED++)); fi

if [ $TESTS_PASSED -eq $TOTAL_TESTS ]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED! ($TESTS_PASSED/$TOTAL_TESTS)${NC}"
    echo -e "${GREEN}🦙 OLLAMA IS FULLY CONNECTED AND RESPONDING TO PI!${NC}"
    echo -e "${GREEN}🍌 FULL OLLAMA MODE IS OPERATIONAL!${NC}"
    echo -e "${GREEN}📊 ADVANCED ANALYTICS ENGINE IS ACTIVE!${NC}"
else
    echo -e "${YELLOW}⚠️  $TESTS_PASSED/$TOTAL_TESTS tests passed${NC}"
    echo -e "${YELLOW}Some issues detected - check output above${NC}"
fi

echo -e "\n${BLUE}🔗 Connection Details:${NC}"
echo -e "${BLUE}  Ollama URL: $OLLAMA_URL${NC}"
echo -e "${BLUE}  Pi API URL: $PI_API_URL${NC}"
echo -e "${BLUE}  Model: llama3.2:latest${NC}"
echo -e "${BLUE}  Integration: FULL OLLAMA MODE${NC}"
echo -e "${BLUE}  Analytics: Advanced Analytics Engine${NC}"

echo -e "\n${BLUE}📊 System Status:${NC}"
if [ $TESTS_PASSED -eq $TOTAL_TESTS ]; then
    echo -e "${GREEN}  Status: ALL SYSTEMS OPERATIONAL${NC}"
    echo -e "${GREEN}  Phase 3 Sprint 1: COMPLETE${NC}"
    echo -e "${GREEN}  Advanced Analytics: ACTIVE${NC}"
else
    echo -e "${YELLOW}  Status: SOME ISSUES DETECTED${NC}"
    echo -e "${YELLOW}  Check failed tests above${NC}"
fi