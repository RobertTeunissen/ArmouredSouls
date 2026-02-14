#!/bin/bash

echo "🔄 Resetting database (simple method)..."

# Kill any backend processes
echo "1. Stopping backend processes..."
pkill -f "tsx" 2>/dev/null || true
pkill -f "node" 2>/dev/null || true
sleep 3

# Use db push to sync schema (this works even with connections)
echo "2. Syncing schema..."
npx prisma db push --force-reset --accept-data-loss

# Seed the database
echo "3. Seeding database..."
npx prisma db seed

echo ""
echo "✅ Database reset complete!"
echo ""
echo "You can now start the backend with: npm run dev"
