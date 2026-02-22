#!/bin/bash

# Script to update test files from income_generator to merchandising_hub
# This is a helper script - review changes before committing

echo "Updating test files to use merchandising_hub instead of income_generator..."

# List of test files to update
TEST_FILES=(
  "tests/facilityTransactionLogging.test.ts"
  "tests/eventLogger.property.test.ts"
  "tests/roiCalculatorService.test.ts"
  "tests/facilityRecommendationService.test.ts"
  "tests/incomeGeneratorNoStreaming.property.test.ts"
  "tests/facilityROI.property.test.ts"
)

for file in "${TEST_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "Updating $file..."
    # Use sed to replace income_generator with merchandising_hub
    sed -i.bak "s/'income_generator'/'merchandising_hub'/g" "$file"
    sed -i.bak 's/"income_generator"/"merchandising_hub"/g' "$file"
    sed -i.bak 's/income_generator/merchandising_hub/g' "$file"
    
    # Update specific test values
    # Old: Level 1 cost = 400000, operating cost = 1000
    # New: Level 1 cost = 150000, operating cost = 200
    sed -i.bak 's/400000/150000/g' "$file"
    sed -i.bak 's/1000/200/g' "$file"
    
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
