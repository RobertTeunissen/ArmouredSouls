#!/bin/bash

# Script to automatically fix common test patterns
# Run from prototype/backend directory

echo "🔧 Fixing common test patterns..."

# Fix 1: Add weapon null check pattern
echo "📝 Adding weapon null checks..."
find tests -name "*.test.ts" -type f -exec sed -i.bak \
  's/const weapon = await prisma\.weapon\.findFirst();$/let weapon = await prisma.weapon.findFirst();\n    if (!weapon) {\n      weapon = await prisma.weapon.create({\n        data: { name: "Test Weapon", baseDamage: 10, cost: 1000, description: "Test weapon" }\n      });\n    }/g' {} \;

# Fix 2: Update test timeout in jest.config.js (already done manually)
echo "✅ Test timeout already updated to 60000ms"

# Fix 3: Add cleanup for test cycles
echo "📝 Note: Manual updates needed for cycle number conflicts"
echo "   - Import generateTestCycleNumber from testCycleHelper"
echo "   - Use unique cycle numbers in beforeEach"
echo "   - Add cleanup in afterEach"

# Clean up backup files
find tests -name "*.bak" -delete

echo "✅ Pattern fixes complete!"
echo ""
echo "Next steps:"
echo "1. Run: npm test -- --testNamePattern='weapon' to verify weapon fixes"
echo "2. Manually update tests with cycle number conflicts"
echo "3. Run full test suite: npm test"
