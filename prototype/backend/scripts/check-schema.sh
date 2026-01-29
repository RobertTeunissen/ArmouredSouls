#!/bin/bash

# Quick check script to verify schema.prisma is correct
# Run this from prototype/backend directory

echo "🔍 Checking schema.prisma configuration..."
echo ""

# Check if file exists
if [ ! -f "prisma/schema.prisma" ]; then
    echo "❌ Error: prisma/schema.prisma not found"
    echo "   Are you in the prototype/backend directory?"
    exit 1
fi

# Check for incorrect output line in generator block
if grep -A5 "generator client" prisma/schema.prisma | grep -q "output.*="; then
    echo "❌ PROBLEM FOUND: Your schema.prisma has an 'output' line in the generator block"
    echo ""
    echo "Your generator block:"
    grep -A5 "generator client" prisma/schema.prisma | head -6
    echo ""
    echo "This is INCORRECT. The repository version should NOT have an output line."
    echo ""
    echo "To fix this, run:"
    echo "  git restore prisma/schema.prisma"
    echo ""
    echo "Or manually edit prisma/schema.prisma and remove the 'output' line"
    echo "so the generator block looks like:"
    echo ""
    echo "  generator client {"
    echo "    provider = \"prisma-client-js\""
    echo "  }"
    echo ""
    exit 1
else
    echo "✅ schema.prisma generator block is correct (no output line)"
    echo ""
    echo "Your generator block:"
    grep -A5 "generator client" prisma/schema.prisma | head -4
    echo ""
fi

# Check if file differs from repository
EXIT_CODE=0
if command -v git &> /dev/null; then
    if git diff --quiet HEAD -- prisma/schema.prisma 2>/dev/null; then
        echo "✅ schema.prisma matches the repository version"
    else
        echo "⚠️  WARNING: Your schema.prisma differs from the repository version"
        echo ""
        echo "To see differences:"
        echo "  git diff prisma/schema.prisma"
        echo ""
        echo "To restore repository version:"
        echo "  git restore prisma/schema.prisma"
        echo ""
        EXIT_CODE=1
    fi
fi

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Schema verification complete!"
else
    echo "⚠️  Schema verification complete with warnings - see above"
fi

exit $EXIT_CODE
