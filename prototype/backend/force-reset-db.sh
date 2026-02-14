#!/bin/bash

echo "🔄 Force resetting database..."

# Kill any backend processes
echo "1. Stopping backend processes..."
pkill -f "tsx watch" 2>/dev/null || true
pkill -f "node.*backend" 2>/dev/null || true
sleep 2

# Drop and recreate database using psql directly
echo "2. Dropping database..."
psql -U armouredsouls -h localhost -c "DROP DATABASE IF EXISTS armouredsouls WITH (FORCE);" postgres 2>/dev/null || \
  psql -U armouredsouls -h localhost -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'armouredsouls' AND pid <> pg_backend_pid(); DROP DATABASE IF EXISTS armouredsouls;" postgres

echo "3. Creating fresh database..."
psql -U armouredsouls -h localhost -c "CREATE DATABASE armouredsouls;" postgres

echo "4. Running migrations..."
npx prisma migrate deploy

echo "5. Seeding database..."
npx prisma db seed

echo "✅ Database reset complete!"
echo ""
echo "You can now start the backend with: npm run dev"
