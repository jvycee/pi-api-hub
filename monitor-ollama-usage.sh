#!/bin/bash

# 🍌 BANANA-POWERED OLLAMA USAGE MONITOR 🍌
# Script to monitor if Ollama is actually being called

echo "🍌 Starting Ollama Usage Monitor 🍌"
echo "====================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="http://localhost:3000"
ADMIN_API_KEY="${ADMIN_API_KEY:-your-admin-key}"

# Function to check Ollama service
check_ollama_service() {
    echo -e "${BLUE}🔍 Checking Ollama service...${NC}"
    
    # Check if Ollama is running
    if pgrep -f "ollama" > /dev/null; then
        echo -e "${GREEN}✅ Ollama process is running${NC}"
    else
        echo -e "${RED}❌ Ollama process not found${NC}"
        return 1
    fi
    
    # Check if Ollama is responding
    if curl -s -f "http://localhost:11434/api/tags" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Ollama API is responding${NC}"
    else
        echo -e "${RED}❌ Ollama API not responding${NC}"
        return 1
    fi
    
    # List available models
    echo -e "${BLUE}📋 Available models:${NC}"
    curl -s "http://localhost:11434/api/tags" | grep -o '"name":"[^"]*"' | sed 's/"name":"//g' | sed 's/"//g' | sed 's/^/  - /'
    
    return 0
}

# Function to monitor Ollama logs
monitor_ollama_logs() {
    echo -e "${BLUE}👀 Monitoring Ollama logs for activity...${NC}"
    echo -e "${YELLOW}Press Ctrl+C to stop monitoring${NC}"
    
    # Monitor system logs for Ollama activity
    if command -v journalctl &> /dev/null; then
        journalctl -u ollama -f --no-pager
    else
        # Fallback to process monitoring
        echo -e "${YELLOW}⚠️  journalctl not available, monitoring process activity...${NC}"
        while true; do
            if pgrep -f "ollama" > /dev/null; then
                echo -e "${GREEN}[$(date)] ✅ Ollama process active${NC}"
            else
                echo -e "${RED}[$(date)] ❌ Ollama process not found${NC}"
            fi
            sleep 5
        done
    fi
}

# Function to test API routing
test_api_routing() {
    echo -e "${BLUE}🧪 Testing API routing...${NC}"
    
    # Test AI endpoint
    response=$(curl -s -X POST "$BASE_URL/api/anthropic/messages" \
        -H "Content-Type: application/json" \
        -H "x-admin-api-key: $ADMIN_API_KEY" \
        -d '{
            "messages": [
                {
                    "role": "user",
                    "content": "Test message for routing check. Please respond with: OLLAMA_TEST_RESPONSE"
                }
            ],
            "max_tokens": 50,
            "taskType": "analysis"
        }')
    
    if echo "$response" | grep -q "success.*true"; then
        echo -e "${GREEN}✅ AI endpoint responded${NC}"
        
        # Check which provider was used
        provider=$(echo "$response" | grep -o '"provider":"[^"]*"' | sed 's/"provider":"//g' | sed 's/"//g')
        
        if [ "$provider" = "ollama" ]; then
            echo -e "${GREEN}🎉 OLLAMA WAS USED!${NC}"
            echo -e "${BLUE}📊 Response details:${NC}"
            echo "$response" | jq '.metadata' 2>/dev/null || echo "$response"
        else
            echo -e "${YELLOW}⚠️  Provider used: $provider (not Ollama)${NC}"
        fi
    else
        echo -e "${RED}❌ AI endpoint failed${NC}"
        echo -e "${RED}Response: $response${NC}"
    fi
}

# Function to check AI routing stats
check_ai_stats() {
    echo -e "${BLUE}📊 Checking AI routing statistics...${NC}"
    
    response=$(curl -s -X GET "$BASE_URL/monitoring/ai" \
        -H "x-admin-api-key: $ADMIN_API_KEY")
    
    if echo "$response" | grep -q "success.*true"; then
        echo -e "${GREEN}✅ AI stats retrieved${NC}"
        
        # Extract key metrics
        ollama_usage=$(echo "$response" | grep -o '"ollamaUsagePercent":[^,]*' | sed 's/"ollamaUsagePercent"://g')
        anthropic_usage=$(echo "$response" | grep -o '"anthropicUsagePercent":[^,]*' | sed 's/"anthropicUsagePercent"://g')
        total_requests=$(echo "$response" | grep -o '"totalRequests":[^,]*' | sed 's/"totalRequests"://g')
        
        echo -e "${BLUE}📈 Usage Statistics:${NC}"
        echo -e "   Total Requests: $total_requests"
        echo -e "   Ollama Usage: $ollama_usage%"
        echo -e "   Anthropic Usage: $anthropic_usage%"
        
        if [ "$ollama_usage" != "0" ]; then
            echo -e "${GREEN}🎉 OLLAMA IS BEING USED!${NC}"
        else
            echo -e "${YELLOW}⚠️  Ollama usage is 0%${NC}"
        fi
    else
        echo -e "${RED}❌ Failed to get AI stats${NC}"
    fi
}

# Function to generate test traffic
generate_test_traffic() {
    echo -e "${BLUE}🔄 Generating test traffic to trigger Ollama...${NC}"
    
    # Generate multiple requests to trigger analytics
    for i in {1..5}; do
        echo -e "${BLUE}📊 Request $i/5...${NC}"
        
        curl -s -X POST "$BASE_URL/api/anthropic/messages" \
            -H "Content-Type: application/json" \
            -H "x-admin-api-key: $ADMIN_API_KEY" \
            -d '{
                "messages": [
                    {
                        "role": "user",
                        "content": "Help me optimize this API endpoint performance. This is test request #'$i'"
                    }
                ],
                "max_tokens": 100,
                "taskType": "analysis"
            }' > /dev/null
        
        # Small delay
        sleep 1
    done
    
    echo -e "${GREEN}✅ Generated 5 test requests${NC}"
    echo -e "${YELLOW}⏳ Waiting for analytics processing...${NC}"
    sleep 3
}

# Function to check template manager activity
check_template_activity() {
    echo -e "${BLUE}🔍 Checking template manager activity...${NC}"
    
    # Check template stats
    response=$(curl -s -X GET "$BASE_URL/analytics/templates/stats" \
        -H "x-admin-api-key: $ADMIN_API_KEY")
    
    if echo "$response" | grep -q "success.*true"; then
        echo -e "${GREEN}✅ Template stats retrieved${NC}"
        
        # Extract key metrics
        total_requests=$(echo "$response" | grep -o '"totalRequests":[^,]*' | sed 's/"totalRequests"://g')
        templates_generated=$(echo "$response" | grep -o '"templatesGenerated":[^,]*' | sed 's/"templatesGenerated"://g')
        optimization_suggestions=$(echo "$response" | grep -o '"optimizationSuggestions":[^,]*' | sed 's/"optimizationSuggestions"://g')
        
        echo -e "${BLUE}📈 Template Statistics:${NC}"
        echo -e "   Total Requests: $total_requests"
        echo -e "   Templates Generated: $templates_generated"
        echo -e "   Optimization Suggestions: $optimization_suggestions"
        
        if [ "$optimization_suggestions" != "0" ]; then
            echo -e "${GREEN}🎉 TEMPLATE MANAGER IS GENERATING SUGGESTIONS!${NC}"
        else
            echo -e "${YELLOW}⚠️  No optimization suggestions yet${NC}"
        fi
    else
        echo -e "${RED}❌ Failed to get template stats${NC}"
    fi
}

# Function to check AI insights
check_ai_insights() {
    echo -e "${BLUE}🤖 Checking AI insights...${NC}"
    
    response=$(curl -s -X GET "$BASE_URL/analytics/ai-insights" \
        -H "x-admin-api-key: $ADMIN_API_KEY")
    
    if echo "$response" | grep -q "success.*true"; then
        echo -e "${GREEN}✅ AI insights retrieved${NC}"
        
        # Check for suggestions
        if echo "$response" | grep -q '"totalSuggestions":[^0]'; then
            echo -e "${GREEN}🎉 AI SUGGESTIONS FOUND!${NC}"
            echo -e "${BLUE}📊 AI Insights:${NC}"
            echo "$response" | jq '.data.suggestions[]? | {endpoint: .endpoint, recommendation: .recommendation, source: .source}' 2>/dev/null || echo "$response"
        else
            echo -e "${YELLOW}⚠️  No AI suggestions found yet${NC}"
        fi
    else
        echo -e "${RED}❌ Failed to get AI insights${NC}"
    fi
}

# Main menu
show_menu() {
    echo -e "\n${BLUE}🍌 OLLAMA USAGE MONITOR MENU 🍌${NC}"
    echo "1. Check Ollama Service"
    echo "2. Test API Routing"
    echo "3. Check AI Statistics"
    echo "4. Generate Test Traffic"
    echo "5. Check Template Activity"
    echo "6. Check AI Insights"
    echo "7. Monitor Ollama Logs"
    echo "8. Run Full Check"
    echo "9. Exit"
}

# Full check function
run_full_check() {
    echo -e "${BLUE}🔄 Running full Ollama usage check...${NC}"
    
    check_ollama_service
    echo ""
    test_api_routing
    echo ""
    check_ai_stats
    echo ""
    generate_test_traffic
    echo ""
    check_template_activity
    echo ""
    check_ai_insights
    
    echo -e "\n${GREEN}✅ Full check completed!${NC}"
}

# Main execution
if [ "$1" = "--auto" ] || [ "$1" = "-a" ]; then
    run_full_check
    exit 0
elif [ "$1" = "--monitor" ] || [ "$1" = "-m" ]; then
    monitor_ollama_logs
    exit 0
fi

# Interactive mode
while true; do
    show_menu
    read -p "Enter your choice (1-9): " choice
    
    case $choice in
        1)
            check_ollama_service
            ;;
        2)
            test_api_routing
            ;;
        3)
            check_ai_stats
            ;;
        4)
            generate_test_traffic
            ;;
        5)
            check_template_activity
            ;;
        6)
            check_ai_insights
            ;;
        7)
            monitor_ollama_logs
            ;;
        8)
            run_full_check
            ;;
        9)
            echo -e "${GREEN}👋 Goodbye!${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}❌ Invalid choice${NC}"
            ;;
    esac
    
    echo -e "\n${YELLOW}Press Enter to continue...${NC}"
    read
done