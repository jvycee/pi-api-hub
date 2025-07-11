#!/bin/bash

# 🍌 BANANA-POWERED OPERATIONS TOOLKIT 🍌
# Unified script for all Pi API Hub operations
# Consolidates: deploy.sh, test-deployment.sh, monitor-deployment.sh, 
#              test-ollama-connection.sh, test-tenant-endpoints.sh, monitor-ollama-usage.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
PROJECT_NAME="pi-api-hub"
SERVICE_NAME="pi-api-hub"
BACKUP_DIR="./backups"
LOG_FILE="./logs/ops.log"
HEALTH_CHECK_URL="http://localhost:3000/health"
OLLAMA_URL="http://10.0.0.120:11434"
PI_API_URL="http://localhost:3000"

# Logging functions
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    echo "[ERROR] $1" >> "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS] $1${NC}"
    echo "[SUCCESS] $1" >> "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
    echo "[WARNING] $1" >> "$LOG_FILE"
}

# =================== DEPLOYMENT FUNCTIONS ===================

is_service_running() {
    if command -v pm2 &> /dev/null; then
        pm2 describe "$SERVICE_NAME" > /dev/null 2>&1
    elif command -v docker &> /dev/null; then
        docker ps --format "table {{.Names}}" | grep -q "^$SERVICE_NAME$"
    else
        pgrep -f "node.*app.js" > /dev/null 2>&1
    fi
}

stop_service() {
    log "🛑 Stopping $SERVICE_NAME..."
    
    if command -v pm2 &> /dev/null; then
        if pm2 describe "$SERVICE_NAME" > /dev/null 2>&1; then
            pm2 stop "$SERVICE_NAME"
            success "PM2 service stopped"
        fi
    elif command -v docker &> /dev/null; then
        if docker ps --format "table {{.Names}}" | grep -q "^$SERVICE_NAME$"; then
            docker stop "$SERVICE_NAME" && docker rm "$SERVICE_NAME"
            success "Docker container stopped"
        fi
    else
        if pgrep -f "node.*app.js" > /dev/null 2>&1; then
            pkill -f "node.*app.js"
            success "Node.js processes terminated"
        fi
    fi
}

create_backup() {
    log "📦 Creating backup..."
    mkdir -p "$BACKUP_DIR"
    
    BACKUP_NAME="${PROJECT_NAME}_$(date +%Y%m%d_%H%M%S)"
    BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"
    
    rsync -av --exclude='node_modules' --exclude='logs' --exclude='.git' --exclude='backups' . "$BACKUP_PATH/"
    success "Backup created: $BACKUP_PATH"
    
    # Keep only last 3 backups (reduced from 5)
    ls -t "$BACKUP_DIR" | tail -n +4 | xargs -r -I {} rm -rf "$BACKUP_DIR/{}"
}

start_service() {
    log "🚀 Starting $SERVICE_NAME..."
    
    if command -v pm2 &> /dev/null; then
        if [ -f "ecosystem.config.js" ]; then
            pm2 start ecosystem.config.js --env production
        else
            pm2 start app.js --name "$SERVICE_NAME" --env production
        fi
        success "Service started with PM2"
    elif command -v docker &> /dev/null && [ -f "Dockerfile" ]; then
        docker build -t "$SERVICE_NAME" .
        docker run -d --name "$SERVICE_NAME" -p 3000:3000 --env-file .env "$SERVICE_NAME"
        success "Service started with Docker"
    else
        nohup node app.js > logs/app.log 2>&1 &
        success "Service started with Node.js"
    fi
}

health_check() {
    log "🏥 Performing health check..."
    local attempts=0
    local max_attempts=15
    
    while [ $attempts -lt $max_attempts ]; do
        if curl -f -s "$HEALTH_CHECK_URL" > /dev/null 2>&1; then
            success "Health check passed!"
            return 0
        fi
        attempts=$((attempts + 1))
        log "Health check attempt $attempts/$max_attempts failed, retrying..."
        sleep 2
    done
    
    error "Health check failed after $max_attempts attempts"
    return 1
}

deploy() {
    log "🍌 Starting deployment..."
    
    [ ! -f "package.json" ] && error "package.json not found!" && exit 1
    
    create_backup
    is_service_running && stop_service
    
    # Pull latest code
    log "📥 Pulling latest code..."
    git stash > /dev/null 2>&1 || true
    git fetch origin main && git reset --hard origin/main
    
    # Install dependencies if package.json changed
    if git diff HEAD~1 --name-only | grep -q "package.json"; then
        log "📦 Installing dependencies..."
        npm install --production
    fi
    
    start_service
    
    if health_check; then
        success "🍌 DEPLOYMENT SUCCESSFUL! 🍌"
    else
        error "Deployment failed health check"
        exit 1
    fi
}

# =================== TESTING FUNCTIONS ===================

test_deployment() {
    echo -e "${YELLOW}🍌 Testing Deployment Pipeline 🍌${NC}"
    
    local tests_passed=0
    local total_tests=8
    
    # Test 1: Scripts exist
    echo -e "${BLUE}Test 1: Checking scripts...${NC}"
    if [ -f "scripts/ops-toolkit.sh" ] && [ -x "scripts/ops-toolkit.sh" ]; then
        echo -e "${GREEN}✅ ops-toolkit.sh exists${NC}"
        ((tests_passed++))
    else
        echo -e "${RED}❌ ops-toolkit.sh missing${NC}"
    fi
    
    # Test 2: GitHub Actions
    echo -e "${BLUE}Test 2: GitHub Actions...${NC}"
    if [ -f ".github/workflows/deploy.yml" ]; then
        echo -e "${GREEN}✅ GitHub Actions workflow exists${NC}"
        ((tests_passed++))
    else
        echo -e "${RED}❌ GitHub Actions missing${NC}"
    fi
    
    # Test 3: PM2 config
    echo -e "${BLUE}Test 3: PM2 config...${NC}"
    if [ -f "ecosystem.config.js" ]; then
        echo -e "${GREEN}✅ PM2 config exists${NC}"
        ((tests_passed++))
    else
        echo -e "${RED}❌ PM2 config missing${NC}"
    fi
    
    # Test 4: Directories
    echo -e "${BLUE}Test 4: Directory structure...${NC}"
    mkdir -p logs backups scripts
    echo -e "${GREEN}✅ Required directories created${NC}"
    ((tests_passed++))
    
    # Test 5: Syntax validation
    echo -e "${BLUE}Test 5: Syntax validation...${NC}"
    if node -c app.js 2>/dev/null; then
        echo -e "${GREEN}✅ app.js syntax valid${NC}"
        ((tests_passed++))
    else
        echo -e "${RED}❌ app.js syntax errors${NC}"
    fi
    
    # Test 6: Git status
    echo -e "${BLUE}Test 6: Git status...${NC}"
    if git status --porcelain | grep -q .; then
        echo -e "${YELLOW}⚠️  Uncommitted changes${NC}"
    else
        echo -e "${GREEN}✅ Git working directory clean${NC}"
        ((tests_passed++))
    fi
    
    # Test 7: Health endpoint
    echo -e "${BLUE}Test 7: Health endpoint...${NC}"
    if grep -q '/health' app.js; then
        echo -e "${GREEN}✅ Health endpoint exists${NC}"
        ((tests_passed++))
    else
        echo -e "${RED}❌ Health endpoint missing${NC}"
    fi
    
    # Test 8: Dependencies
    echo -e "${BLUE}Test 8: Dependencies...${NC}"
    if npm list --depth=0 > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Dependencies installed${NC}"
        ((tests_passed++))
    else
        echo -e "${YELLOW}⚠️  Run: npm install${NC}"
    fi
    
    echo -e "\n${GREEN}Tests passed: $tests_passed/$total_tests${NC}"
}

# =================== MONITORING FUNCTIONS ===================

check_status() {
    echo -e "${YELLOW}📊 System Status ($(date))${NC}"
    
    # Service status
    if command -v pm2 &> /dev/null; then
        echo -e "${BLUE}PM2 Status:${NC}"
        pm2 status 2>/dev/null || echo "PM2 not running"
    fi
    
    # Health check
    echo -e "${BLUE}Health Check:${NC}"
    if curl -s -f "$HEALTH_CHECK_URL" > /dev/null; then
        echo -e "${GREEN}✅ Service healthy${NC}"
    else
        echo -e "${RED}❌ Service unhealthy${NC}"
    fi
    
    # Mark/Mark2 status
    echo -e "${BLUE}AI Assistants:${NC}"
    if curl -s "$PI_API_URL/api/mark/status" | jq -e '.data.available' > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Mark (Pi API Hub): Ready${NC}"
    else
        echo -e "${RED}❌ Mark: Unavailable${NC}"
    fi
    
    if curl -s "$PI_API_URL/api/mark2/status" | jq -e '.data.available' > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Mark2 (General AI): Ready${NC}"
    else
        echo -e "${RED}❌ Mark2: Unavailable${NC}"
    fi
    
    # Recent logs
    echo -e "${BLUE}Recent Logs:${NC}"
    [ -f "logs/ops.log" ] && tail -3 logs/ops.log || echo "No logs found"
}

monitor_deployment() {
    echo -e "${YELLOW}👀 Monitoring deployment activity...${NC}"
    last_commit=$(git rev-parse HEAD)
    
    while true; do
        git fetch origin main > /dev/null 2>&1
        current_commit=$(git rev-parse origin/main)
        
        if [ "$current_commit" != "$last_commit" ]; then
            echo -e "${GREEN}🚀 New deployment detected!${NC}"
            echo -e "${BLUE}Commit: $current_commit${NC}"
            
            if [ -f "logs/ops.log" ]; then
                tail -f logs/ops.log &
                TAIL_PID=$!
                sleep 30
                kill $TAIL_PID 2>/dev/null
            fi
            
            last_commit=$current_commit
            check_status
        fi
        sleep 10
    done
}

# =================== OLLAMA TESTING FUNCTIONS ===================

test_ollama() {
    echo -e "${BLUE}🦙 OLLAMA CONNECTION TEST${NC}"
    local tests_passed=0
    local total_tests=6
    
    # Test 1: Direct Ollama
    echo -e "${BLUE}1. Direct Ollama connection...${NC}"
    if OLLAMA_RESPONSE=$(curl -s "${OLLAMA_URL}/api/tags" | jq '.models[].name' 2>/dev/null); then
        echo -e "${GREEN}✅ Ollama connected${NC}"
        echo -e "${GREEN}   Models: $(echo "$OLLAMA_RESPONSE" | tr '\n' ' ')${NC}"
        ((tests_passed++))
    else
        echo -e "${RED}❌ Ollama connection failed${NC}"
    fi
    
    # Test 2: Model availability  
    echo -e "${BLUE}2. llama3.2:latest availability...${NC}"
    if curl -s "${OLLAMA_URL}/api/tags" | jq -e '.models[] | select(.name=="llama3.2:latest")' > /dev/null; then
        echo -e "${GREEN}✅ llama3.2:latest available${NC}"
        ((tests_passed++))
    else
        echo -e "${RED}❌ llama3.2:latest missing${NC}"
    fi
    
    # Test 3: Generation test
    echo -e "${BLUE}3. Generation test...${NC}"
    if curl -s -X POST "${OLLAMA_URL}/api/generate" \
        -H "Content-Type: application/json" \
        -d '{"model": "llama3.2:latest", "prompt": "Say: CONNECTED", "stream": false}' | \
        jq -e '.response' > /dev/null; then
        echo -e "${GREEN}✅ Generation working${NC}"
        ((tests_passed++))
    else
        echo -e "${RED}❌ Generation failed${NC}"
    fi
    
    # Test 4: Pi API Hub health
    echo -e "${BLUE}4. Pi API Hub integration...${NC}"
    if curl -s "$PI_API_URL/health" | jq -e '.status' > /dev/null; then
        echo -e "${GREEN}✅ Pi API Hub healthy${NC}"
        ((tests_passed++))
    else
        echo -e "${RED}❌ Pi API Hub unhealthy${NC}"
    fi
    
    # Test 5: Mark integration
    echo -e "${BLUE}5. Mark AI integration...${NC}"
    if curl -s "$PI_API_URL/api/mark/test" | jq -e '.data.success' > /dev/null; then
        echo -e "${GREEN}✅ Mark integration working${NC}"
        ((tests_passed++))
    else
        echo -e "${RED}❌ Mark integration failed${NC}"
    fi
    
    # Test 6: Mark2 integration
    echo -e "${BLUE}6. Mark2 AI integration...${NC}"
    if curl -s "$PI_API_URL/api/mark2/test" | jq -e '.data.success' > /dev/null; then
        echo -e "${GREEN}✅ Mark2 integration working${NC}"
        ((tests_passed++))
    else
        echo -e "${RED}❌ Mark2 integration failed${NC}"
    fi
    
    echo -e "\n${GREEN}Ollama tests passed: $tests_passed/$total_tests${NC}"
    
    if [ $tests_passed -eq $total_tests ]; then
        echo -e "${GREEN}🎉 ALL OLLAMA TESTS PASSED!${NC}"
    else
        echo -e "${YELLOW}⚠️  Some Ollama tests failed${NC}"
    fi
}

# =================== SSL CERTIFICATE FUNCTIONS ===================

generate_ssl_cert() {
    echo -e "${BLUE}🔒 Generating self-signed certificate...${NC}"
    
    mkdir -p certs
    
    if openssl req -x509 -newkey rsa:4096 -keyout certs/server.key -out certs/server.crt -days 365 -nodes \
        -subj "/C=US/ST=Development/L=Local/O=Pi API Hub/CN=localhost" 2>/dev/null; then
        
        chmod 600 certs/server.key
        chmod 644 certs/server.crt
        
        echo -e "${GREEN}✅ SSL certificate generated!${NC}"
        echo -e "${BLUE}Certificate: certs/server.crt${NC}"
        echo -e "${BLUE}Private Key: certs/server.key${NC}"
        echo -e "${YELLOW}⚠️  Development only! Use proper CA cert for production.${NC}"
    else
        echo -e "${RED}❌ Failed to generate SSL certificate${NC}"
    fi
}

# =================== MAIN MENU ===================

show_menu() {
    echo -e "${CYAN}🍌 BANANA-POWERED OPERATIONS TOOLKIT 🍌${NC}"
    echo -e "${CYAN}======================================${NC}"
    echo ""
    echo -e "${YELLOW}DEPLOYMENT:${NC}"
    echo "  1. Deploy latest code"
    echo "  2. Test deployment pipeline"
    echo "  3. Create backup"
    echo ""
    echo -e "${YELLOW}MONITORING:${NC}"
    echo "  4. Check system status"
    echo "  5. Monitor for deployments"
    echo "  6. Watch logs"
    echo ""
    echo -e "${YELLOW}TESTING:${NC}"
    echo "  7. Test Ollama connection"
    echo "  8. Test Mark/Mark2 AI"
    echo "  9. Full system test"
    echo ""
    echo -e "${YELLOW}SERVICE CONTROL:${NC}"
    echo " 10. Start service"
    echo " 11. Stop service"
    echo " 12. Restart service"
    echo ""
    echo -e "${YELLOW}UTILITIES:${NC}"
    echo " 13. Generate SSL certificate"
    echo ""
    echo " 14. Exit"
    echo ""
}

# =================== MAIN EXECUTION ===================

# Create required directories
mkdir -p logs scripts

# Handle command line arguments
case "${1:-menu}" in
    "deploy"|"d")
        deploy
        ;;
    "test"|"t")
        test_deployment
        ;;
    "status"|"s")
        check_status
        ;;
    "monitor"|"m")
        monitor_deployment
        ;;
    "ollama"|"o")
        test_ollama
        ;;
    "start")
        start_service
        ;;
    "stop")
        stop_service
        ;;
    "restart"|"r")
        stop_service && sleep 2 && start_service
        ;;
    "backup"|"b")
        create_backup
        ;;
    "ssl"|"cert")
        generate_ssl_cert
        ;;
    "menu"|*)
        while true; do
            show_menu
            read -p "Choose option [1-14]: " choice
            
            case $choice in
                1) deploy ;;
                2) test_deployment ;;
                3) create_backup ;;
                4) check_status ;;
                5) monitor_deployment ;;
                6) echo "Watching logs..." && tail -f logs/ops.log 2>/dev/null || echo "No logs yet" ;;
                7) test_ollama ;;
                8) 
                    echo "Testing Mark..." && curl -s "$PI_API_URL/api/mark/test" | jq . || echo "Mark test failed"
                    echo "Testing Mark2..." && curl -s "$PI_API_URL/api/mark2/test" | jq . || echo "Mark2 test failed"
                    ;;
                9) test_deployment && test_ollama ;;
                10) start_service ;;
                11) stop_service ;;
                12) stop_service && sleep 2 && start_service ;;
                13) generate_ssl_cert ;;
                14) echo -e "${GREEN}Goodbye! 🍌${NC}" && exit 0 ;;
                *) echo -e "${RED}Invalid choice${NC}" ;;
            esac
            echo ""
            read -p "Press Enter to continue..."
            clear
        done
        ;;
esac