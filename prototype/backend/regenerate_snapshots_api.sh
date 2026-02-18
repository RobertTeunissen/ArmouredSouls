#!/bin/bash

# Regenerate cycle snapshots using the admin API
# Make sure the backend is running before executing this script

echo "=== Regenerating Cycle Snapshots ==="
echo ""

# Get admin token (assuming user 1 is admin with default password)
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  | grep -o '"token":"[^"]*' \
  | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "Failed to get admin token. Make sure:"
  echo "1. Backend is running"
  echo "2. Admin user exists with username 'admin' and password 'admin123'"
  exit 1
fi

echo "✓ Got admin token"
echo ""

# Call the backfill endpoint
echo "Calling backfill endpoint..."
curl -X POST http://localhost:3001/api/admin/snapshots/backfill \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  | jq '.'

echo ""
echo "=== Done ==="
