#!/bin/bash

# Diagnostic script to check cycle summary data flow
# Run this to identify where the data is breaking

echo "=== CYCLE SUMMARY DIAGNOSTIC SCRIPT ==="
echo ""

# Check if database is accessible
echo "1. Checking database connection..."
if command -v psql &> /dev/null; then
    echo "   ✓ psql found"
else
    echo "   ✗ psql not found - install PostgreSQL client"
    exit 1
fi

# Set database URL (adjust if needed)
DB_URL="postgresql://armouredsouls:password@localhost:5432/armouredsouls"

echo ""
echo "2. Checking AuditLog for battle_complete events..."
EVENT_COUNT=$(psql "$DB_URL" -t -c "SELECT COUNT(*) FROM \"AuditLog\" WHERE \"cycleNumber\" = 2 AND \"eventType\" = 'battle_complete';")
echo "   Found $EVENT_COUNT battle_complete events for cycle 2"

if [ "$EVENT_COUNT" -eq 0 ]; then
    echo "   ✗ NO EVENTS FOUND - Battles aren't being logged!"
    echo "   Problem: battleOrchestrator.ts isn't creating audit log events"
    exit 1
fi

echo ""
echo "3. Checking event payload structure..."
psql "$DB_URL" -c "
SELECT 
  payload->>'battleId' as battle,
  payload->>'streamingRevenue1' as stream1,
  payload->>'streamingRevenue2' as stream2,
  payload->>'winnerReward' as winner_reward,
  payload->>'loserReward' as loser_reward
FROM \"AuditLog\" 
WHERE \"cycleNumber\" = 2 AND \"eventType\" = 'battle_complete'
LIMIT 3;
"

echo ""
echo "4. Checking CycleSnapshot data..."
psql "$DB_URL" -c "
SELECT 
  \"cycleNumber\",
  \"stableMetrics\"::json->0->>'userId' as user_id,
  \"stableMetrics\"::json->0->>'totalCreditsEarned' as credits,
  \"stableMetrics\"::json->0->>'streamingIncome' as streaming,
  \"stableMetrics\"::json->0->>'merchandisingIncome' as merchandising
FROM \"CycleSnapshot\" 
WHERE \"cycle_number\" = 2;
"

echo ""
echo "5. Checking robot_streaming_revenue table..."
psql "$DB_URL" -c "
SELECT 
  \"robotId\",
  \"cycleNumber\",
  \"streamingRevenue\",
  \"battlesInCycle\"
FROM \"robot_streaming_revenue\"
WHERE \"cycle_number\" = 2
ORDER BY \"streamingRevenue\" DESC
LIMIT 5;
"

echo ""
echo "=== DIAGNOSIS COMPLETE ==="
echo ""
echo "If streaming income in CycleSnapshot is 0, run:"
echo "  curl -X POST http://localhost:3001/api/admin/snapshots/backfill -H 'Authorization: ******'"
echo ""
