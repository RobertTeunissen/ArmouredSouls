#!/usr/bin/env bash
# ============================================================================
# Armoured Souls — Discord alert payload test harness
#
# backup.sh, disk-monitor.sh and preflight.sh build the Discord webhook JSON
# by hand. Before json_escape existed, preflight's multi-line "Deploy ABORTED"
# alert put raw newlines into the JSON string, Discord answered HTTP 400, and
# `curl -s … || true` hid it. This harness extracts each script's json_escape,
# builds the payload exactly as send_alert does, and parses it with Node.
#
# No network call is made and no script is executed.
#
# Usage: bash app/scripts/__tests__/alert-json.test.sh
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS=(backup.sh disk-monitor.sh preflight.sh)

PASS=0
FAIL=0
pass() { PASS=$((PASS + 1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  ✗ $1"; }

if ! command -v node > /dev/null 2>&1; then
  echo "FATAL: node is required to parse the payloads"
  exit 1
fi

# Message with every character that breaks hand-built JSON, shaped like the
# preflight disk-full alert (newlines, code fences, quotes, a backslash, a tab).
MESSAGE=$(printf '%s' "🚨 Deploy ABORTED on host: disk 97% (\"1.2G\" free).

Top consumers:
\`\`\`
4.1G	/opt/armouredsouls/backups
C:\\path
\`\`\`
Investigate before retrying.")

echo "alert JSON payloads"

for name in "${SCRIPTS[@]}"; do
  script="${SCRIPT_DIR}/../${name}"
  body="$(sed -n '/^json_escape() {/,/^}/p' "$script")"
  if [ -z "$body" ]; then
    fail "${name} defines json_escape"
    continue
  fi
  pass "${name} defines json_escape"

  # Fresh subshell per script, so one script's helper cannot mask another's.
  payload="$(eval "$body"; printf '{"content": "%s"}' "$(json_escape "$MESSAGE")")"
  status=0
  roundtrip="$(printf '%s' "$payload" | node -e '
    let raw = "";
    process.stdin.on("data", (c) => { raw += c; });
    process.stdin.on("end", () => {
      try { process.stdout.write(JSON.parse(raw).content); } catch { process.exit(3); }
    });
  ')" || status=$?
  if [ "$status" -eq 0 ] && [ "$roundtrip" = "$MESSAGE" ]; then
    pass "${name} builds valid JSON that round-trips a multi-line message"
  else
    fail "${name} builds valid JSON that round-trips a multi-line message (node exit ${status})"
  fi

  if grep -q 'DISCORD_WEBHOOK_URL' <(sed -n '/^send_alert() {/,/^}/p' "$script"); then
    fail "${name} send_alert never falls back to the player channel"
  else
    pass "${name} send_alert never falls back to the player channel"
  fi
done

echo ""
echo "  ${PASS} passed, ${FAIL} failed"
[ "$FAIL" -eq 0 ]
