#!/bin/bash

# Test script for profile update endpoint
# Usage: ./test-profile-update.sh <token>

TOKEN="${1:-your-token-here}"
API_URL="http://localhost:3001/api"

echo "Testing profile update endpoint..."
echo "=================================="
echo ""

# Test 1: Update stable name
echo "Test 1: Update stable name"
curl -X PUT "${API_URL}/user/profile" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "stableName": "Test Stable"
  }' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s

echo ""
echo "=================================="
echo ""

# Test 2: Update notifications
echo "Test 2: Update notifications"
curl -X PUT "${API_URL}/user/profile" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "notificationsBattle": true,
    "notificationsLeague": false
  }' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s

echo ""
echo "=================================="
echo ""

# Test 3: Update theme
echo "Test 3: Update theme preference"
curl -X PUT "${API_URL}/user/profile" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "themePreference": "dark"
  }' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s

echo ""
echo "=================================="
