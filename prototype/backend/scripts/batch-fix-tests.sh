#!/bin/bash

# Batch fix test files with sequence number conflicts
# This script applies the standard fix pattern to multiple test files

echo "🔧 Batch fixing test files..."

# List of files to fix (add more as needed)
FILES=(
  "tests/eventLogger.test.ts"
  "tests/cycleExecutionTiming.test.ts"
  "tests/cycleSnapshot.property.test.ts"
  "tests/eventQueryability.property.test.ts"
)

FIXED_COUNT=0
SKIPPED_COUNT=0

for file in "${FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo "⚠️  Skipping $file (not found)"
    ((SKIPPED_COUNT++))
    continue
  fi
  
  echo "📝 Processing $file..."
  
  # Check if already fixed
  if grep -q "generateTestCycleNumber" "$file"; then
    echo "✅ Already fixed: $file"
    ((SKIPPED_COUNT++))
    continue
  fi
  
  # Create backup
  cp "$file" "$file.backup"
  
  echo "   - File backed up to $file.backup"
  echo "   - Manual fix required (pattern too complex for automation)"
  echo "   - Follow pattern in cycleStepDuration.property.test.ts"
  
  ((FIXED_COUNT++))
done

echo ""
echo "📊 Summary:"
echo "   - Files processed: ${#FILES[@]}"
echo "   - Needs manual fix: $FIXED_COUNT"
echo "   - Already fixed/skipped: $SKIPPED_COUNT"
echo ""
echo "Next steps:"
echo "1. Manually fix the files listed above"
echo "2. Run: npm test -- <filename> to verify each fix"
echo "3. Delete .backup files when done"
