#!/usr/bin/env bash
# ============================================================================
# Armoured Souls — disk-monitor.sh test harness (Spec #46 R9)
#
# The disk monitor is a shell script on a cron schedule with no test coverage,
# which is how a broken cooldown and a duplicate cron entry produced five alerts
# an hour without anything failing. This harness exercises the cooldown gate, the
# state-write failure path, and the exit status.
#
# Isolation strategy:
#   - A stub directory is prepended to PATH with a fake `df` reporting a scripted
#     usage percentage, so no real filesystem is involved.
#   - STATE_DIR points at a temporary directory, so no real cooldown state is
#     touched.
#   - The webhook is left unset and DISK_MONITOR_ENV_FILE points at a
#     non-existent path, so no network call is ever made.
#
# Usage: bash app/scripts/__tests__/disk-monitor.test.sh
# ============================================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONITOR="${SCRIPT_DIR}/../disk-monitor.sh"

if [ ! -f "$MONITOR" ]; then
  echo "FATAL: disk-monitor.sh not found at $MONITOR"
  exit 1
fi

PASS=0
FAIL=0
WORKROOT="$(mktemp -d)"
trap 'rm -rf "$WORKROOT"' EXIT

pass() { PASS=$((PASS + 1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  ✗ $1"; }

# ── Test scaffolding ────────────────────────────────────────────────

STUB_DIR="${WORKROOT}/stub"
mkdir -p "$STUB_DIR"

# Fake `df` honouring DF_PCENT and DF_AVAIL, matching the two invocations the
# monitor makes (`--output=pcent` and `--output=avail`).
cat > "${STUB_DIR}/df" <<'STUB'
#!/usr/bin/env bash
for arg in "$@"; do
  case "$arg" in
    --output=pcent) echo "Use%"; echo " ${DF_PCENT}%"; exit 0 ;;
    --output=avail) echo "Avail"; echo " ${DF_AVAIL}"; exit 0 ;;
  esac
done
echo "unexpected df invocation: $*" >&2
exit 1
STUB
chmod +x "${STUB_DIR}/df"

# Run the monitor with a scripted disk usage. Echoes combined output; the exit
# status is captured into RUN_STATUS.
RUN_STATUS=0
run_monitor() {
  local pcent="$1"
  local state_dir="$2"
  local cooldown="${3:-7200}"
  local output
  set +e
  output=$(
    PATH="${STUB_DIR}:${PATH}" \
    DF_PCENT="$pcent" \
    DF_AVAIL="860000" \
    STATE_DIR="$state_dir" \
    DISK_ALERT_COOLDOWN_SECONDS="$cooldown" \
    DISK_MONITOR_ENV_FILE="${WORKROOT}/nonexistent.env" \
    MONITORING_DISCORD_WEBHOOK="" \
    DISCORD_WEBHOOK_URL="" \
    bash "$MONITOR" 2>&1
  )
  RUN_STATUS=$?
  set -e
  printf '%s' "$output"
}

fresh_state_dir() {
  local d
  d="$(mktemp -d "${WORKROOT}/state.XXXXXX")"
  printf '%s' "$d"
}

count_alerts() {
  # Threshold alerts carry one of the two severity markers.
  grep -c -E 'Disk usage (CRITICAL|WARNING)' <<< "$1" || true
}

# ── Tests ───────────────────────────────────────────────────────────

echo "disk-monitor.sh"

# 1. Two consecutive critical runs inside the cooldown emit exactly one alert.
STATE="$(fresh_state_dir)"
OUT1="$(run_monitor 95 "$STATE")"
OUT2="$(run_monitor 95 "$STATE")"
if [ "$(count_alerts "$OUT1")" -eq 1 ] && [ "$(count_alerts "$OUT2")" -eq 0 ]; then
  pass "two consecutive CRITICAL runs within the cooldown emit exactly one alert"
else
  fail "two consecutive CRITICAL runs within the cooldown emit exactly one alert"
  echo "      run 1: $OUT1"
  echo "      run 2: $OUT2"
fi

# 2. A run after the cooldown has elapsed emits a second alert.
STATE="$(fresh_state_dir)"
run_monitor 95 "$STATE" > /dev/null
# Backdate the state file well past the cooldown window.
echo "$(( $(date +%s) - 10000 ))" > "${STATE}/disk-alert-critical.last"
OUT="$(run_monitor 95 "$STATE" 7200)"
if [ "$(count_alerts "$OUT")" -eq 1 ]; then
  pass "a run after the cooldown window has elapsed emits a second alert"
else
  fail "a run after the cooldown window has elapsed emits a second alert"
  echo "      output: $OUT"
fi

# 3. An unwritable state directory produces a diagnostic and still alerts.
STATE="$(fresh_state_dir)"
chmod 500 "$STATE"
OUT="$(run_monitor 95 "$STATE")"
if [ "$(count_alerts "$OUT")" -ge 1 ] && grep -q "WARNING: could not write cooldown state" <<< "$OUT"; then
  pass "an unwritable state directory logs a diagnostic and still emits the alert"
else
  fail "an unwritable state directory logs a diagnostic and still emits the alert"
  echo "      output: $OUT"
fi
chmod 700 "$STATE"

# 4. Dropping below the threshold clears the cooldown, so the next breach alerts.
STATE="$(fresh_state_dir)"
run_monitor 95 "$STATE" > /dev/null              # alerts, writes state
run_monitor 40 "$STATE" > /dev/null              # below all thresholds, clears state
OUT="$(run_monitor 95 "$STATE")"                 # should alert immediately
if [ "$(count_alerts "$OUT")" -eq 1 ]; then
  pass "a drop below the threshold clears the cooldown so the next breach alerts immediately"
else
  fail "a drop below the threshold clears the cooldown so the next breach alerts immediately"
  echo "      output: $OUT"
fi

# 5. Below all thresholds, the script is silent.
STATE="$(fresh_state_dir)"
OUT="$(run_monitor 40 "$STATE")"
if [ "$(count_alerts "$OUT")" -eq 0 ]; then
  pass "usage below 80% emits no alert"
else
  fail "usage below 80% emits no alert"
  echo "      output: $OUT"
fi

# 6. The WARNING band alerts at its own severity.
STATE="$(fresh_state_dir)"
OUT="$(run_monitor 85 "$STATE")"
if grep -q "Disk usage WARNING" <<< "$OUT" && ! grep -q "Disk usage CRITICAL" <<< "$OUT"; then
  pass "usage in the 80-89% band emits a WARNING, not a CRITICAL"
else
  fail "usage in the 80-89% band emits a WARNING, not a CRITICAL"
  echo "      output: $OUT"
fi

# 7. Dropping from CRITICAL to WARNING clears the critical cooldown.
STATE="$(fresh_state_dir)"
run_monitor 95 "$STATE" > /dev/null
run_monitor 85 "$STATE" > /dev/null
if [ ! -f "${STATE}/disk-alert-critical.last" ]; then
  pass "falling from CRITICAL to WARNING clears the critical cooldown"
else
  fail "falling from CRITICAL to WARNING clears the critical cooldown"
fi

# 8. The WARNING severity has its own independent cooldown.
STATE="$(fresh_state_dir)"
OUT1="$(run_monitor 85 "$STATE")"
OUT2="$(run_monitor 85 "$STATE")"
if [ "$(count_alerts "$OUT1")" -eq 1 ] && [ "$(count_alerts "$OUT2")" -eq 0 ]; then
  pass "the WARNING severity has its own independent cooldown"
else
  fail "the WARNING severity has its own independent cooldown"
fi

# 9. A garbled state file does not abort the script under `set -e`.
STATE="$(fresh_state_dir)"
echo "not-a-timestamp" > "${STATE}/disk-alert-critical.last"
OUT="$(run_monitor 95 "$STATE")"
if [ "$RUN_STATUS" -eq 0 ] && [ "$(count_alerts "$OUT")" -eq 1 ]; then
  pass "a garbled state file is treated as no prior alert and does not abort"
else
  fail "a garbled state file is treated as no prior alert and does not abort (status $RUN_STATUS)"
  echo "      output: $OUT"
fi

# 10. Exit status is zero in every case, including with the webhook unset.
STATUS_OK=1
for pcent in 40 85 95; do
  STATE="$(fresh_state_dir)"
  run_monitor "$pcent" "$STATE" > /dev/null
  if [ "$RUN_STATUS" -ne 0 ]; then
    STATUS_OK=0
    echo "      exit $RUN_STATUS at ${pcent}%"
  fi
done
STATE="$(fresh_state_dir)"
chmod 500 "$STATE"
run_monitor 95 "$STATE" > /dev/null
[ "$RUN_STATUS" -ne 0 ] && STATUS_OK=0
chmod 700 "$STATE"
if [ "$STATUS_OK" -eq 1 ]; then
  pass "exits zero in every case, including an unwritable state dir and no webhook"
else
  fail "exits zero in every case, including an unwritable state dir and no webhook"
fi

# 11. Steering compliance: no `source` of the env file, and fail-fast enabled.
if grep -qE '^\s*source /opt/armouredsouls' "$MONITOR"; then
  fail "does not source .env directly (bash would evaluate unquoted values)"
else
  pass "does not source .env directly (bash would evaluate unquoted values)"
fi

if grep -q 'set -euo pipefail' "$MONITOR"; then
  pass "sets -euo pipefail"
else
  fail "sets -euo pipefail"
fi

if grep -q 'env_get()' "$MONITOR"; then
  pass "uses the env_get helper pattern"
else
  fail "uses the env_get helper pattern"
fi

# 12. Cadence constants: 2-hour cooldown default and hourly cron in the header.
if grep -q 'COOLDOWN_SECONDS:-7200' "$MONITOR"; then
  pass "defaults the cooldown to 7200 seconds (2 hours)"
else
  fail "defaults the cooldown to 7200 seconds (2 hours)"
fi

if grep -q 'Cron: 0 \* \* \* \*' "$MONITOR"; then
  pass "documents the hourly cron schedule in the header"
else
  fail "documents the hourly cron schedule in the header"
fi

# ── Summary ─────────────────────────────────────────────────────────

echo ""
echo "  ${PASS} passed, ${FAIL} failed"
[ "$FAIL" -eq 0 ] || exit 1
exit 0
