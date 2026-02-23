#!/bin/bash

# Script to fix foreign key constraint issues in test files
# Adds tagTeam.deleteMany() before robot.deleteMany() where missing

FILES=(
  "cycleSnapshot.property.test.ts"
  "eloProgression.property.test.ts"
  "trendAnalysis.property.test.ts"
  "facilityROI.property.test.ts"
  "leagueRebalancingService.test.ts"
  "tagTeamLeagueInstanceService.test.ts"
  "metricProgression.property.test.ts"
  "integration/bronzeLeagueRebalancing.test.ts"
  "matchmakingService.test.ts"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "Fixing $file..."
    # Add tagTeam.deleteMany() before robot.deleteMany() if not already present
    if ! grep -q "tagTeam.deleteMany" "$file"; then
      sed -i.bak '/await prisma\.robot\.deleteMany/i\    await prisma.tagTeam.deleteMany({});' "$file"
      echo "  ✓ Added tagTeam.deleteMany() to $file"
    else
      echo "  - Already has tagTeam.deleteMany() in $file"
    fi
  else
    echo "  ✗ File not found: $file"
  fi
done

echo "Done!"
