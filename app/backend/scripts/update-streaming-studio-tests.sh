#!/bin/bash

# Script to update test files for Streaming Studio multiplier change
# Old: 1 + (studioLevel * 0.1)
# New: 1 + (studioLevel * 1.0)

echo "Updating test files for Streaming Studio multiplier change (0.1 → 1.0)..."

# List of test files to update
TEST_FILES=(
  "tests/streamingRevenueFormula.property.test.ts"
  "tests/battleLogStreamingRevenue.property.test.ts"
)

for file in "${TEST_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "Updating $file..."
    
    # Replace studio multiplier formula
    sed -i.bak 's/studioLevel \* 0\.1/studioLevel * 1.0/g' "$file"
    
    echo "  ✓ Updated $file (backup saved as $file.bak)"
  else
    echo "  ✗ File not found: $file"
  fi
done

echo ""
echo "Done! Please review the changes and run tests:"
echo "  npm test"
echo ""
echo "If everything looks good, remove backup files:"
echo "  rm tests/*.bak"
