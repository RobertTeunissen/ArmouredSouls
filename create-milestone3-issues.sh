#!/bin/bash

# Script to create 3 GitHub issues for Milestone 3 bugs
# Requires: GitHub CLI (gh) installed and authenticated

echo "Creating Milestone 3 GitHub Issues..."
echo ""

# Issue #1: Training Facility discount
echo "Creating Issue #1: Training Facility discount..."
gh issue create \
  --title "Training Facility discount not displaying on Robot Detail page" \
  --label "bug,milestone-3,frontend,state-management,high-priority" \
  --body-file issue1.txt

echo ""

# Issue #2: Attribute cap display
echo "Creating Issue #2: Attribute cap display..."
gh issue create \
  --title "Attribute cap display shows theoretical max (50) instead of current cap based on facility level" \
  --label "bug,milestone-3,frontend,UI/UX,state-management,high-priority" \
  --body-file issue2.txt

echo ""

# Issue #3: Backend verification
echo "Creating Issue #3: Backend verification..."
gh issue create \
  --title "Verify Training Academy backend cap enforcement matches STABLE_SYSTEM.md specifications" \
  --label "verification-needed,milestone-3,backend,testing,medium-priority" \
  --body-file issue3.txt

echo ""
echo "✅ All 3 issues created successfully!"
echo "View them at: https://github.com/RobertTeunissen/ArmouredSouls/issues"
