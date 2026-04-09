#!/bin/bash

# Script to update Streaming Studio multiplier from 0.1 to 1.0 in test files
# This updates all test expectations to match the new 100% per level multiplier

echo "Updating Streaming Studio multiplier in test files from 0.1 to 1.0..."

# Update streamingRevenueFormula.property.test.ts
echo "Updating streamingRevenueFormula.property.test.ts..."
sed -i.bak 's/studioLevel \* 0\.1/studioLevel * 1.0/g' tests/streamingRevenueFormula.property.test.ts

# Update battleLogStreamingRevenue.property.test.ts
echo "Updating battleLogStreamingRevenue.property.test.ts..."
sed -i.bak 's/studioLevel \* 0\.1/studioLevel * 1.0/g' tests/battleLogStreamingRevenue.property.test.ts

# Remove backup files
rm -f tests/*.bak

echo "✓ Test files updated successfully!"
echo ""
echo "Next steps:"
echo "1. Run tests: npm test"
echo "2. Review any failing tests and update expected values"
echo "3. Commit changes"
