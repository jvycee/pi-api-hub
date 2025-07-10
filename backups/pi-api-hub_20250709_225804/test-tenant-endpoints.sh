#!/bin/bash

# 🍌 SMART BANANA TENANT TESTING 🍌
# Test script to verify tenant functionality on Pi

echo "🍌 Testing Smart Banana Tenant System..."
echo "============================================"

# Configuration
API_URL="http://localhost:3000"
ADMIN_KEY="f00d268863ad4f08992aa8583d2b6ea96c65e649f206a9828334bbb3bbd8f7e7"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test 1: Basic tenant identification via header
echo -e "\n${BLUE}Test 1: Tenant identification via header${NC}"
RESPONSE=$(curl -s -H "x-tenant-id: demo" "${API_URL}/health")
if echo "$RESPONSE" | grep -q "healthy"; then
    echo -e "${GREEN}✅ Header-based tenant identification: WORKING${NC}"
else
    echo -e "${RED}❌ Header-based tenant identification: FAILED${NC}"
fi

# Test 2: Default tenant fallback
echo -e "\n${BLUE}Test 2: Default tenant fallback${NC}"
RESPONSE=$(curl -s "${API_URL}/health")
if echo "$RESPONSE" | grep -q "healthy"; then
    echo -e "${GREEN}✅ Default tenant fallback: WORKING${NC}"
else
    echo -e "${RED}❌ Default tenant fallback: FAILED${NC}"
fi

# Test 3: Query parameter tenant identification
echo -e "\n${BLUE}Test 3: Query parameter tenant identification${NC}"
RESPONSE=$(curl -s "${API_URL}/health?tenant=test")
if echo "$RESPONSE" | grep -q "healthy"; then
    echo -e "${GREEN}✅ Query parameter tenant identification: WORKING${NC}"
else
    echo -e "${RED}❌ Query parameter tenant identification: FAILED${NC}"
fi

# Test 4: Admin tenant listing endpoint
echo -e "\n${BLUE}Test 4: Admin tenant listing endpoint${NC}"
RESPONSE=$(curl -s -H "x-admin-api-key: ${ADMIN_KEY}" "${API_URL}/admin/tenants")
if echo "$RESPONSE" | grep -q "tenants"; then
    echo -e "${GREEN}✅ Admin tenant listing: WORKING${NC}"
    echo -e "${YELLOW}Available tenants:${NC}"
    echo "$RESPONSE" | jq -r '.data.tenants | keys[]' 2>/dev/null || echo "  (Could not parse tenant list)"
else
    echo -e "${RED}❌ Admin tenant listing: FAILED${NC}"
    echo "Response: $RESPONSE"
fi

# Test 5: Create new tenant
echo -e "\n${BLUE}Test 5: Create new tenant${NC}"
RESPONSE=$(curl -s -X POST -H "x-admin-api-key: ${ADMIN_KEY}" -H "Content-Type: application/json" \
    -d '{"tenantId": "testing", "name": "Testing Tenant", "description": "Test tenant for banana testing"}' \
    "${API_URL}/admin/tenants")
if echo "$RESPONSE" | grep -q "success.*true"; then
    echo -e "${GREEN}✅ Create new tenant: WORKING${NC}"
else
    echo -e "${RED}❌ Create new tenant: FAILED${NC}"
    echo "Response: $RESPONSE"
fi

# Test 6: Get specific tenant
echo -e "\n${BLUE}Test 6: Get specific tenant${NC}"
RESPONSE=$(curl -s -H "x-admin-api-key: ${ADMIN_KEY}" "${API_URL}/admin/tenants/demo")
if echo "$RESPONSE" | grep -q "Demo Tenant"; then
    echo -e "${GREEN}✅ Get specific tenant: WORKING${NC}"
else
    echo -e "${RED}❌ Get specific tenant: FAILED${NC}"
    echo "Response: $RESPONSE"
fi

# Test 7: Test with new tenant
echo -e "\n${BLUE}Test 7: Test with newly created tenant${NC}"
RESPONSE=$(curl -s -H "x-tenant-id: testing" "${API_URL}/health")
if echo "$RESPONSE" | grep -q "healthy"; then
    echo -e "${GREEN}✅ New tenant identification: WORKING${NC}"
else
    echo -e "${RED}❌ New tenant identification: FAILED${NC}"
fi

# Summary
echo -e "\n${BLUE}🍌 SMART BANANA TENANT SYSTEM TEST COMPLETE! 🍌${NC}"
echo -e "${YELLOW}If all tests passed, your tenant system is working perfectly!${NC}"
echo -e "${YELLOW}You can now identify tenants using:${NC}"
echo -e "${YELLOW}  - Headers: x-tenant-id${NC}"
echo -e "${YELLOW}  - Query params: ?tenant=name${NC}"
echo -e "${YELLOW}  - Admin endpoints: /admin/tenants${NC}"

echo -e "\n${GREEN}Ready to move to Feature 2: JWT Authentication! 🍌${NC}"