#!/bin/bash

# Migration script for adding battle rewards tracking fields
# Run this from the prototype/backend directory

echo "Applying migration: add_battle_rewards_tracking"
echo "This will add 4 new columns to the battles table:"
echo "  - robot1_prestige_awarded"
echo "  - robot2_prestige_awarded"  
echo "  - robot1_fame_awarded"
echo "  - robot2_fame_awarded"
echo ""

# Check if database is accessible
if ! PGPASSWORD=password psql -h localhost -U armouredsouls -d armouredsouls -c "SELECT 1" > /dev/null 2>&1; then
    echo "Error: Cannot connect to database. Make sure PostgreSQL is running."
    echo "You can start it with: docker-compose up -d"
    exit 1
fi

echo "Database connection successful."
echo ""

# Apply the migration
echo "Applying migration..."
PGPASSWORD=password psql -h localhost -U armouredsouls -d armouredsouls << 'EOF'
-- Add battle rewards tracking columns
ALTER TABLE battles 
ADD COLUMN IF NOT EXISTS robot1_prestige_awarded INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS robot2_prestige_awarded INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS robot1_fame_awarded INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS robot2_fame_awarded INTEGER NOT NULL DEFAULT 0;

-- Verify columns were added
\d battles
EOF

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration applied successfully!"
    echo ""
    echo "The battles table now includes reward tracking columns."
    echo "You can now use the admin page without errors."
else
    echo ""
    echo "❌ Migration failed. Please check the error messages above."
    exit 1
fi
