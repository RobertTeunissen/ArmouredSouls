#!/bin/bash
# Test script to verify Training Academy cap enforcement in GUI
# This script demonstrates the fix for the GUI not reflecting academy cap changes

set -e

echo "=== Training Academy Cap GUI Fix Verification ==="
echo ""

# Configuration
API_BASE="http://localhost:3001/api"
TOKEN=""
USER_ID=""
ROBOT_ID=""

# Helper function to make authenticated requests
api_call() {
    local method=$1
    local endpoint=$2
    local data=$3
    
    if [ -z "$data" ]; then
        curl -s -X "$method" "${API_BASE}${endpoint}" \
            -H "Authorization: Bearer ${TOKEN}" \
            -H "Content-Type: application/json"
    else
        curl -s -X "$method" "${API_BASE}${endpoint}" \
            -H "Authorization: Bearer ${TOKEN}" \
            -H "Content-Type: application/json" \
            -d "$data"
    fi
}

echo "Step 1: Login..."
LOGIN_RESPONSE=$(curl -s -X POST "${API_BASE}/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin123"}')

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token')
USER_ID=$(echo "$LOGIN_RESPONSE" | jq -r '.user.id')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
    echo "❌ Login failed"
    echo "$LOGIN_RESPONSE"
    exit 1
fi

echo "✅ Logged in successfully (User ID: $USER_ID)"
echo ""

echo "Step 2: Check initial facilities..."
FACILITIES=$(api_call GET "/facilities")
COMBAT_ACADEMY_LEVEL=$(echo "$FACILITIES" | jq -r '.[] | select(.facilityType=="combat_training_academy") | .level' || echo "0")
echo "Combat Training Academy Level: ${COMBAT_ACADEMY_LEVEL:-0}"
echo ""

echo "Step 3: Get or create a test robot..."
ROBOTS=$(api_call GET "/robots")
ROBOT_COUNT=$(echo "$ROBOTS" | jq 'length')

if [ "$ROBOT_COUNT" -eq 0 ]; then
    echo "Creating a new robot..."
    ROBOT_RESPONSE=$(api_call POST "/robots" '{"name":"Test Robot"}')
    ROBOT_ID=$(echo "$ROBOT_RESPONSE" | jq -r '.id')
else
    ROBOT_ID=$(echo "$ROBOTS" | jq -r '.[0].id')
    echo "Using existing robot (ID: $ROBOT_ID)"
fi
echo ""

echo "Step 4: Check robot's current combatPower level..."
ROBOT=$(api_call GET "/robots/$ROBOT_ID")
COMBAT_POWER=$(echo "$ROBOT" | jq -r '.combatPower')
echo "Current combatPower: $COMBAT_POWER"
echo ""

echo "Step 5: Calculate expected cap..."
EXPECTED_CAP=$((COMBAT_ACADEMY_LEVEL == 0 ? 10 : \
               COMBAT_ACADEMY_LEVEL == 1 ? 15 : \
               COMBAT_ACADEMY_LEVEL == 2 ? 20 : \
               COMBAT_ACADEMY_LEVEL == 3 ? 25 : \
               COMBAT_ACADEMY_LEVEL == 4 ? 30 : \
               COMBAT_ACADEMY_LEVEL == 5 ? 35 : \
               COMBAT_ACADEMY_LEVEL == 6 ? 40 : \
               COMBAT_ACADEMY_LEVEL == 7 ? 42 : \
               COMBAT_ACADEMY_LEVEL == 8 ? 45 : \
               COMBAT_ACADEMY_LEVEL == 9 ? 48 : 50))
echo "Expected cap for academy level ${COMBAT_ACADEMY_LEVEL:-0}: $EXPECTED_CAP"
echo ""

echo "Step 6: Try to upgrade combatPower to level $((COMBAT_POWER + 1))..."
if [ "$COMBAT_POWER" -lt "$EXPECTED_CAP" ]; then
    UPGRADE_RESPONSE=$(api_call PUT "/robots/$ROBOT_ID/upgrade" '{"attribute":"combatPower"}' 2>&1)
    if echo "$UPGRADE_RESPONSE" | jq -e '.robot' > /dev/null 2>&1; then
        NEW_LEVEL=$(echo "$UPGRADE_RESPONSE" | jq -r '.robot.combatPower')
        echo "✅ Upgrade successful! New level: $NEW_LEVEL"
    else
        echo "❌ Upgrade failed: $(echo "$UPGRADE_RESPONSE" | jq -r '.error' || echo "$UPGRADE_RESPONSE")"
    fi
else
    echo "⚠️  Robot is already at cap ($COMBAT_POWER >= $EXPECTED_CAP)"
    echo "Attempting upgrade to verify cap enforcement..."
    UPGRADE_RESPONSE=$(api_call PUT "/robots/$ROBOT_ID/upgrade" '{"attribute":"combatPower"}' 2>&1)
    if echo "$UPGRADE_RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
        ERROR=$(echo "$UPGRADE_RESPONSE" | jq -r '.error')
        echo "✅ Cap enforced correctly: $ERROR"
    else
        echo "❌ Expected error but got: $UPGRADE_RESPONSE"
    fi
fi
echo ""

echo "=== Frontend Fix Verification ==="
echo ""
echo "The frontend changes fix the following issue:"
echo "1. Previously: After upgrading an academy, the GUI would not refresh"
echo "2. Previously: Users would see old cap values (e.g., still showing cap of 10)"
echo "3. Now: useLocation hook triggers re-fetch when navigating back"
echo "4. Now: Window focus event provides additional refresh trigger"
echo "5. Now: Manual refresh button (🔄) available for user convenience"
echo ""
echo "To test the GUI fix:"
echo "1. Open http://localhost:3000 in your browser"
echo "2. Login and navigate to a robot detail page"
echo "3. Note the current attribute caps"
echo "4. Click 'Facilities' in navigation"
echo "5. Upgrade Combat Training Academy"
echo "6. Click back to the robot (or use browser back button)"
echo "7. Verify cap updates automatically (or click 🔄 Refresh button)"
echo ""
