#!/bin/bash
# Fix HTML Entity Encoding in HallOfRecordsPage.tsx
# This script diagnoses and fixes HTML entity encoding issues

set -e

echo "=================================================="
echo "HTML Entity Encoding Fix Script"
echo "=================================================="
echo ""

# Change to the correct directory
cd "$(dirname "$0")/prototype/frontend/src/pages"

FILE="HallOfRecordsPage.tsx"

echo "Step 1: Diagnosing the file..."
echo "---------------------------------------------------"

# Check if file exists
if [ ! -f "$FILE" ]; then
    echo "ERROR: $FILE not found!"
    exit 1
fi

echo "✓ File exists"
echo ""

# Check for HTML entities
echo "Step 2: Checking for HTML entities..."
echo "---------------------------------------------------"

HAS_ENTITIES=false

if grep -q "&amp;" "$FILE"; then
    echo "❌ FOUND: &amp; (should be &)"
    HAS_ENTITIES=true
    grep -n "&amp;" "$FILE" | head -5
fi

if grep -q "&lt;" "$FILE"; then
    echo "❌ FOUND: &lt; (should be <)"
    HAS_ENTITIES=true
fi

if grep -q "&gt;" "$FILE"; then
    echo "❌ FOUND: &gt; (should be >)"
    HAS_ENTITIES=true
fi

if [ "$HAS_ENTITIES" = false ]; then
    echo "✓ No HTML entities found - file appears clean!"
    echo ""
    echo "File content at line 389:"
    sed -n '389p' "$FILE"
    echo ""
    echo "If you're still getting errors, the issue may be:"
    echo "  1. An editor or IDE auto-converting on save"
    echo "  2. A filesystem sync tool (iCloud, Dropbox)"
    echo "  3. A git hook or filter"
    echo ""
    echo "Try running: npm run dev"
    exit 0
fi

echo ""
echo "Step 3: Creating backup..."
echo "---------------------------------------------------"
cp "$FILE" "${FILE}.backup.$(date +%Y%m%d_%H%M%S)"
echo "✓ Backup created: ${FILE}.backup.$(date +%Y%m%d_%H%M%S)"
echo ""

echo "Step 4: Fixing HTML entities..."
echo "---------------------------------------------------"

# Fix HTML entities (macOS sed syntax)
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS sed requires '' after -i
    sed -i '' 's/&amp;/\&/g' "$FILE"
    sed -i '' 's/&lt;/</g' "$FILE"
    sed -i '' 's/&gt;/>/g' "$FILE"
    sed -i '' 's/&quot;/"/g' "$FILE"
    sed -i '' 's/&#39;/'"'"'/g' "$FILE"
else
    # Linux sed
    sed -i 's/&amp;/\&/g' "$FILE"
    sed -i 's/&lt;/</g' "$FILE"
    sed -i 's/&gt;/>/g' "$FILE"
    sed -i 's/&quot;/"/g' "$FILE"
    sed -i 's/&#39;/'"'"'/g' "$FILE"
fi

echo "✓ HTML entities replaced"
echo ""

echo "Step 5: Verifying fix..."
echo "---------------------------------------------------"

if grep -q "&amp;" "$FILE"; then
    echo "❌ WARNING: Still found &amp; in file!"
else
    echo "✓ No &amp; found"
fi

if grep -q "&lt;" "$FILE"; then
    echo "❌ WARNING: Still found &lt; in file!"
else
    echo "✓ No &lt; found"
fi

if grep -q "&gt;" "$FILE"; then
    echo "❌ WARNING: Still found &gt; in file!"
else
    echo "✓ No &gt; found"
fi

echo ""
echo "Step 6: Showing fixed line 389..."
echo "---------------------------------------------------"
echo "Line 389 now reads:"
sed -n '389p' "$FILE"
echo ""

echo "=================================================="
echo "Fix complete!"
echo "=================================================="
echo ""
echo "Next steps:"
echo "  1. cd ../../.."
echo "  2. npm run dev"
echo ""
echo "If the error persists, something is modifying the file"
echo "AFTER this script runs. Check for:"
echo "  - VS Code auto-save/format-on-save"
echo "  - Other editor extensions"
echo "  - File sync tools (iCloud, Dropbox)"
echo ""
