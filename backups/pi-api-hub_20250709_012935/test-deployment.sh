#!/bin/bash

# 🍌 BANANA-POWERED DEPLOYMENT TEST SCRIPT 🍌
# Test deployment pipeline locally before pushing to GitHub

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🍌 Testing Pi API Hub Deployment Pipeline 🍌${NC}"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ package.json not found. Run this from the project root!${NC}"
    exit 1
fi

# Test 1: Check if deploy script exists and is executable
echo -e "${YELLOW}📋 Test 1: Checking deployment script...${NC}"
if [ -f "deploy.sh" ] && [ -x "deploy.sh" ]; then
    echo -e "${GREEN}✅ deploy.sh exists and is executable${NC}"
else
    echo -e "${RED}❌ deploy.sh missing or not executable${NC}"
    echo "Run: chmod +x deploy.sh"
    exit 1
fi

# Test 2: Check GitHub Actions workflow
echo -e "${YELLOW}📋 Test 2: Checking GitHub Actions workflow...${NC}"
if [ -f ".github/workflows/deploy.yml" ]; then
    echo -e "${GREEN}✅ GitHub Actions workflow exists${NC}"
else
    echo -e "${RED}❌ GitHub Actions workflow missing${NC}"
    exit 1
fi

# Test 3: Check PM2 ecosystem config
echo -e "${YELLOW}📋 Test 3: Checking PM2 configuration...${NC}"
if [ -f "ecosystem.config.js" ]; then
    echo -e "${GREEN}✅ PM2 ecosystem config exists${NC}"
else
    echo -e "${RED}❌ PM2 ecosystem config missing${NC}"
    exit 1
fi

# Test 4: Check if required directories exist
echo -e "${YELLOW}📋 Test 4: Checking directory structure...${NC}"
mkdir -p logs backups
echo -e "${GREEN}✅ Required directories created${NC}"

# Test 5: Validate app.js syntax
echo -e "${YELLOW}📋 Test 5: Validating app.js syntax...${NC}"
if node -c app.js; then
    echo -e "${GREEN}✅ app.js syntax is valid${NC}"
else
    echo -e "${RED}❌ app.js has syntax errors${NC}"
    exit 1
fi

# Test 6: Check if environment variables are documented
echo -e "${YELLOW}📋 Test 6: Checking environment documentation...${NC}"
if grep -q "HUBSPOT_API_KEY" DEPLOYMENT_SETUP.md; then
    echo -e "${GREEN}✅ Environment variables documented${NC}"
else
    echo -e "${RED}❌ Environment variables not documented${NC}"
    exit 1
fi

# Test 7: Simulate deployment steps (dry run)
echo -e "${YELLOW}📋 Test 7: Simulating deployment steps...${NC}"

# Check Git status
if git status --porcelain | grep -q .; then
    echo -e "${YELLOW}⚠️  Uncommitted changes detected${NC}"
else
    echo -e "${GREEN}✅ Git working directory clean${NC}"
fi

# Check if we can fetch from origin
if git fetch --dry-run; then
    echo -e "${GREEN}✅ Git fetch works${NC}"
else
    echo -e "${RED}❌ Git fetch failed${NC}"
    exit 1
fi

# Test 8: Check package.json scripts
echo -e "${YELLOW}📋 Test 8: Checking package.json scripts...${NC}"
if grep -q '"start"' package.json; then
    echo -e "${GREEN}✅ Start script exists${NC}"
else
    echo -e "${YELLOW}⚠️  No start script in package.json${NC}"
fi

# Test 9: Check health endpoint
echo -e "${YELLOW}📋 Test 9: Testing health endpoint code...${NC}"
if grep -q '/health' app.js; then
    echo -e "${GREEN}✅ Health endpoint exists in app.js${NC}"
else
    echo -e "${RED}❌ Health endpoint missing from app.js${NC}"
    exit 1
fi

# Test 10: Check for required dependencies
echo -e "${YELLOW}📋 Test 10: Checking dependencies...${NC}"
if npm list --depth=0 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ All dependencies installed${NC}"
else
    echo -e "${YELLOW}⚠️  Some dependencies missing, run: npm install${NC}"
fi

echo -e "${GREEN}🎉 All deployment tests passed! 🎉${NC}"
echo -e "${YELLOW}📋 Next steps:${NC}"
echo "1. Set up SSH keys on Pi (see DEPLOYMENT_SETUP.md)"
echo "2. Configure GitHub Secrets"
echo "3. Push to main branch to trigger deployment"
echo "4. Monitor GitHub Actions for deployment status"
echo ""
echo -e "${GREEN}🍌 Ready for BANANA-POWERED AUTO-DEPLOYMENT! 🍌${NC}"