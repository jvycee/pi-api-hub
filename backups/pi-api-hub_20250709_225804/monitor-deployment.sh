#!/bin/bash

# 🍌 BANANA-POWERED DEPLOYMENT MONITOR 🍌
# Run this on your Pi to monitor deployments

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${YELLOW}🍌 Pi API Hub Deployment Monitor 🍌${NC}"
echo -e "${BLUE}Press Ctrl+C to exit${NC}"
echo ""

# Function to check service status
check_status() {
    echo -e "${YELLOW}📊 Current Status ($(date))${NC}"
    
    # PM2 status
    if command -v pm2 &> /dev/null; then
        echo -e "${BLUE}PM2 Status:${NC}"
        pm2 status
        echo ""
    fi
    
    # Health check
    echo -e "${BLUE}Health Check:${NC}"
    if curl -s -f http://localhost:3000/health > /dev/null; then
        echo -e "${GREEN}✅ Service is healthy${NC}"
    else
        echo -e "${RED}❌ Service is unhealthy${NC}"
    fi
    
    # Recent logs
    echo -e "${BLUE}Recent Logs:${NC}"
    if [ -f "logs/deploy.log" ]; then
        tail -5 logs/deploy.log
    else
        echo "No deployment logs found"
    fi
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# Function to monitor deployment
monitor_deployment() {
    echo -e "${YELLOW}👀 Monitoring for deployment activity...${NC}"
    
    # Watch for git changes
    last_commit=$(git rev-parse HEAD)
    
    while true; do
        # Check for new commits
        git fetch origin main > /dev/null 2>&1
        current_commit=$(git rev-parse origin/main)
        
        if [ "$current_commit" != "$last_commit" ]; then
            echo -e "${GREEN}🚀 New deployment detected!${NC}"
            echo -e "${BLUE}Old commit: $last_commit${NC}"
            echo -e "${BLUE}New commit: $current_commit${NC}"
            
            # Watch deployment logs
            echo -e "${YELLOW}📝 Watching deployment logs...${NC}"
            if [ -f "logs/deploy.log" ]; then
                tail -f logs/deploy.log &
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

# Main menu
echo "Choose monitoring option:"
echo "1. Check current status"
echo "2. Monitor for deployments"
echo "3. Watch deployment logs"
echo "4. Watch PM2 logs"
echo "5. Check health endpoint"

read -p "Enter choice [1-5]: " choice

case $choice in
    1)
        check_status
        ;;
    2)
        monitor_deployment
        ;;
    3)
        echo -e "${YELLOW}📝 Watching deployment logs...${NC}"
        if [ -f "logs/deploy.log" ]; then
            tail -f logs/deploy.log
        else
            echo "No deployment logs found"
        fi
        ;;
    4)
        echo -e "${YELLOW}📝 Watching PM2 logs...${NC}"
        pm2 logs pi-api-hub
        ;;
    5)
        echo -e "${YELLOW}🏥 Health check endpoint:${NC}"
        curl -s http://localhost:3000/health | jq . || curl -s http://localhost:3000/health
        ;;
    *)
        echo "Invalid choice"
        ;;
esac