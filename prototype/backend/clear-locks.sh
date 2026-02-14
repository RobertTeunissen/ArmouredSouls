#!/bin/bash

echo "🔓 Clearing PostgreSQL advisory locks..."

# Clear all advisory locks
psql -U armouredsouls -h localhost -d armouredsouls -c "SELECT pg_advisory_unlock_all();" 2>/dev/null

# Also terminate any hanging connections
psql -U armouredsouls -h localhost -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'armouredsouls' AND pid <> pg_backend_pid();" 2>/dev/null

echo "✅ Locks cleared!"
echo ""
echo "Now you can run: npx prisma migrate reset --force"
