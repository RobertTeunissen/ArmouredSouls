#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Auto-Generator Script: Changelog Draft Entries (Shell version)
#
# Runs as a post-deploy step in GitHub Actions on the runner itself.
# Scans git commits and completed specs since the last deploy tag,
# then creates draft changelog entries via the deploy API endpoint.
#
# Environment variables (required):
#   CHANGELOG_API_URL    — Base URL for the changelog API (e.g., https://acc.armouredsouls.com)
#   CHANGELOG_DEPLOY_TOKEN — Deploy service token for Authorization header
#   DEPLOY_ENV           — Environment name: "acc" or "prd"
#
# Usage:
#   bash app/backend/scripts/generate-changelog-drafts.sh
#
# Requirements: git, curl, jq (all available on ubuntu-latest runners)
# ---------------------------------------------------------------------------

set -euo pipefail

# ---------------------------------------------------------------------------
# Validate environment
# ---------------------------------------------------------------------------
if [[ -z "${CHANGELOG_API_URL:-}" || -z "${CHANGELOG_DEPLOY_TOKEN:-}" ]]; then
  echo "ERROR: Missing required env vars: CHANGELOG_API_URL, CHANGELOG_DEPLOY_TOKEN"
  exit 1
fi

DEPLOY_ENV="${DEPLOY_ENV:-acc}"
API_URL="${CHANGELOG_API_URL}"
TOKEN="${CHANGELOG_DEPLOY_TOKEN}"

echo "=== Changelog Draft Generator ==="
echo "API URL: ${API_URL}"
echo "Environment: ${DEPLOY_ENV}"

# ---------------------------------------------------------------------------
# Find last deploy tag
# ---------------------------------------------------------------------------
LAST_TAG=$(git tag --sort=-creatordate | grep -E "^deploy-${DEPLOY_ENV}-" | head -n 1 || true)

if [[ -z "$LAST_TAG" ]]; then
  echo "No deploy tags found. Using first commit as baseline."
  LAST_TAG=$(git rev-list --max-parents=0 HEAD)
fi

echo "Baseline: ${LAST_TAG}"

# ---------------------------------------------------------------------------
# Fetch existing sourceRefs for idempotency
# ---------------------------------------------------------------------------
echo "Fetching existing sourceRefs..."
EXISTING_REFS=$(curl -sf \
  -H "Authorization: Bearer ${TOKEN}" \
  "${API_URL}/api/changelog/deploy/sources" 2>/dev/null || echo '{"sourceRefs":[]}')

# ---------------------------------------------------------------------------
# Collect completed specs since last tag
# ---------------------------------------------------------------------------
SPEC_FILES=$(git diff --name-only "${LAST_TAG}..HEAD" -- '.kiro/specs/done-*' 2>/dev/null || true)

declare -A SPEC_DIRS_SEEN
CREATED=0

if [[ -n "$SPEC_FILES" ]]; then
  while IFS= read -r filepath; do
    # Extract spec dir: .kiro/specs/done-april26/24-in-game-changelog/requirements.md → .kiro/specs/done-april26/24-in-game-changelog
    IFS='/' read -ra PARTS <<< "$filepath"
    if [[ ${#PARTS[@]} -ge 4 ]]; then
      SPEC_DIR="${PARTS[0]}/${PARTS[1]}/${PARTS[2]}/${PARTS[3]}"
      SPEC_NAME="${PARTS[3]}"

      # Skip if already processed
      if [[ -n "${SPEC_DIRS_SEEN[$SPEC_NAME]:-}" ]]; then
        continue
      fi
      SPEC_DIRS_SEEN[$SPEC_NAME]=1

      # Skip if already exists in API
      if echo "$EXISTING_REFS" | jq -e --arg ref "$SPEC_NAME" '.sourceRefs | index($ref) != null' > /dev/null 2>&1; then
        echo "  Skipping spec '${SPEC_NAME}' (already exists)"
        continue
      fi

      # Categorize based on name
      CATEGORY="feature"
      LOWER_NAME=$(echo "$SPEC_NAME" | tr '[:upper:]' '[:lower:]')
      if [[ "$LOWER_NAME" == *fix* || "$LOWER_NAME" == *bug* ]]; then
        CATEGORY="bugfix"
      elif [[ "$LOWER_NAME" == *balance* ]]; then
        CATEGORY="balance"
      fi

      # Build title from spec name: strip leading number prefix, convert dashes to spaces, title-case
      TITLE_BASE=$(echo "$SPEC_NAME" | sed 's/^[0-9]*-//')
      TITLE=$(echo "$TITLE_BASE" | sed 's/-/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2))}1')

      # Try to extract introduction from requirements.md
      BODY=""
      REQ_FILE="${SPEC_DIR}/requirements.md"
      if [[ -f "$REQ_FILE" ]]; then
        BODY=$(awk '/^## Introduction/{found=1; next} /^## /{if(found) exit} found{print}' "$REQ_FILE" | head -20 | tr '\n' ' ' | sed 's/  */ /g' | cut -c1-500)
      fi
      if [[ -z "$BODY" ]]; then
        BODY="Changes from spec: ${SPEC_NAME}"
      fi

      # Create draft via API
      PAYLOAD=$(jq -n \
        --arg title "$TITLE" \
        --arg body "$BODY" \
        --arg category "$CATEGORY" \
        --arg sourceType "spec" \
        --arg sourceRef "$SPEC_NAME" \
        '{title: $title, body: $body, category: $category, status: "draft", sourceType: $sourceType, sourceRef: $sourceRef}')

      HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${TOKEN}" \
        -d "$PAYLOAD" \
        "${API_URL}/api/changelog/deploy")

      if [[ "$HTTP_CODE" == "201" ]]; then
        echo "  ✓ Created draft: '${TITLE}' [${CATEGORY}] (spec)"
        CREATED=$((CREATED + 1))
      else
        echo "  ✗ Failed to create draft for spec '${SPEC_NAME}' (HTTP ${HTTP_CODE})"
      fi
    fi
  done <<< "$SPEC_FILES"
fi

# ---------------------------------------------------------------------------
# Collect non-spec commits since last tag
# ---------------------------------------------------------------------------
COMMITS=$(git log --oneline "${LAST_TAG}..HEAD" 2>/dev/null || true)

if [[ -n "$COMMITS" ]]; then
  # Filter out spec-related commits
  NON_SPEC_COMMITS=$(echo "$COMMITS" | grep -iv '\[spec\]' || true)

  if [[ -n "$NON_SPEC_COMMITS" ]]; then
    FIRST_SHA=$(echo "$NON_SPEC_COMMITS" | tail -1 | awk '{print substr($1,1,7)}')
    LAST_SHA=$(echo "$NON_SPEC_COMMITS" | head -1 | awk '{print substr($1,1,7)}')
    SOURCE_REF="${FIRST_SHA}..${LAST_SHA}"

    # Check idempotency
    ALREADY_EXISTS=$(echo "$EXISTING_REFS" | jq -e --arg ref "$SOURCE_REF" '.sourceRefs | index($ref) != null' 2>/dev/null || echo "false")

    if [[ "$ALREADY_EXISTS" != "true" ]]; then
      DEPLOY_DATE=$(date +%Y-%m-%d)
      COMMIT_LIST=$(echo "$NON_SPEC_COMMITS" | awk '{$1=""; print "- " substr($0,2)}' | head -30)
      BODY="Commits included in this deploy:\n${COMMIT_LIST}"

      PAYLOAD=$(jq -n \
        --arg title "Deploy ${DEPLOY_DATE}" \
        --arg body "$BODY" \
        --arg sourceType "commit" \
        --arg sourceRef "$SOURCE_REF" \
        '{title: $title, body: $body, category: "bugfix", status: "draft", sourceType: $sourceType, sourceRef: $sourceRef}')

      HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${TOKEN}" \
        -d "$PAYLOAD" \
        "${API_URL}/api/changelog/deploy")

      if [[ "$HTTP_CODE" == "201" ]]; then
        echo "  ✓ Created draft: 'Deploy ${DEPLOY_DATE}' [bugfix] (commits)"
        CREATED=$((CREATED + 1))
      else
        echo "  ✗ Failed to create commit draft (HTTP ${HTTP_CODE})"
      fi
    else
      echo "  Skipping commit draft '${SOURCE_REF}' (already exists)"
    fi
  fi
fi

echo ""
echo "✅ Created ${CREATED} changelog draft(s)."
