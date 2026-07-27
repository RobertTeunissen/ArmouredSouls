#!/usr/bin/env bash
# ============================================================================
# Armoured Souls — Disk Usage Monitor
#
# Checks root filesystem usage and alerts via Discord webhook.
# Cron: 0 * * * * /opt/armouredsouls/scripts/disk-monitor.sh
#
# WHY HOURLY, NOT EVERY 15 MINUTES (Spec #46 R9):
#   Disk consumption on this host is driven by the hourly battle and settlement
#   cron jobs — each run writes battles, participants, summaries, and audit
#   events. Usage therefore rises in steps at those hourly boundaries and is
#   essentially flat in between, so sampling every 15 minutes observes the same
#   number four times and buys no earlier detection.
#
#   Do not lengthen the interval beyond one hour either. Past that, latency on
#   the *first* alert grows with no benefit, because the cooldown below already
#   caps the rate for every alert after the first.
#
#   EXACTLY ONE cron entry may exist per host. Cron is installed by hand (see
#   docs/guides/operations/MONITORING.md), and a duplicate entry produced four
#   extra un-cooled-down alerts per hour on armouredsouls-acc. Verify with:
#     crontab -l | grep -c disk-monitor    # must print 1
#
# Environment (read via env_get, never sourced — see below):
#   MONITORING_DISCORD_WEBHOOK    - Primary webhook for ops alerts
#   DISCORD_WEBHOOK_URL           - Fallback if monitoring webhook not set
#   DISK_ALERT_COOLDOWN_SECONDS   - Override the 2-hour default
#
# Thresholds:
#   >= 80% — WARNING alert
#   >= 90% — CRITICAL alert
#   <  80% — Silent exit
#
# Cooldown: 2 hours per severity. While disk sits above a threshold the operator
# gets one alert every two hours, not one every cron tick. The cooldown resets
# when the disk drops below the threshold so the next cross-back-up alert fires
# immediately. State is kept in /var/lib/armouredsouls/ (or /tmp as a fallback)
# — content is the unix timestamp of the last alert.
#
# Always exits 0 to avoid cron error emails.
# ============================================================================

set -euo pipefail

# ── Environment loading ─────────────────────────────────────────────
#
# Never `source .env`. Bash evaluates unquoted values as commands: a line like
# `LEAGUE_SCHEDULE=0 20 * * *` parses as `LEAGUE_SCHEDULE=0` followed by an
# attempt to execute `20 * * *`, which aborts the script with
# `20: command not found`. This has bitten us twice already (PR #332 in
# preflight.sh, PR #336 in backup.sh). Read keys as plain text instead.
# Canonical implementation: app/scripts/backup.sh
env_get() {
  local key="$1"
  local file="$2"
  [ -f "$file" ] || return 0
  grep -E "^${key}=" "$file" | tail -n 1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/; s/^'\''(.*)'\''$/\1/'
}

ENV_FILE="${DISK_MONITOR_ENV_FILE:-/opt/armouredsouls/backend/.env}"

MONITORING_WEBHOOK="${MONITORING_DISCORD_WEBHOOK:-$(env_get MONITORING_DISCORD_WEBHOOK "$ENV_FILE")}"
FALLBACK_WEBHOOK="${DISCORD_WEBHOOK_URL:-$(env_get DISCORD_WEBHOOK_URL "$ENV_FILE")}"
WEBHOOK="${MONITORING_WEBHOOK:-$FALLBACK_WEBHOOK}"

HOSTNAME=$(hostname)

COOLDOWN_SECONDS="${DISK_ALERT_COOLDOWN_SECONDS:-$(env_get DISK_ALERT_COOLDOWN_SECONDS "$ENV_FILE")}"
COOLDOWN_SECONDS="${COOLDOWN_SECONDS:-7200}"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

# ── Cooldown state directory ────────────────────────────────────────
#
# Prefer /var/lib/armouredsouls (persists across reboots) but fall back to /tmp.
# The fallback is logged: /tmp is cleared on reboot, so a host silently running
# on the fallback loses its cooldown state and alerts more often than configured.
# STATE_DIR may be overridden for testing.
if [ -n "${STATE_DIR:-}" ]; then
  :
else
  STATE_DIR="/var/lib/armouredsouls"
  if [ ! -d "$STATE_DIR" ] || [ ! -w "$STATE_DIR" ]; then
    STATE_DIR="/tmp"
    log "NOTICE: /var/lib/armouredsouls unavailable or not writable; using ${STATE_DIR} for cooldown state. Cooldown will reset on reboot."
  fi
fi

# Get disk usage percentage for root filesystem
DISK_USAGE=$(df / --output=pcent | tail -1 | tr -d ' %')

# Get available space in human-readable format
AVAIL_KB=$(df / --output=avail | tail -1 | tr -d ' ')
if [ "$AVAIL_KB" -ge 1048576 ]; then
  AVAIL_HUMAN="$(awk "BEGIN {printf \"%.1f\", $AVAIL_KB / 1048576}")GB"
elif [ "$AVAIL_KB" -ge 1024 ]; then
  AVAIL_HUMAN="$(awk "BEGIN {printf \"%d\", $AVAIL_KB / 1024}")MB"
else
  AVAIL_HUMAN="${AVAIL_KB}KB"
fi

send_alert() {
  local message="$1"
  if [ -n "$WEBHOOK" ]; then
    curl -s -H "Content-Type: application/json" \
      -d "{\"content\": \"$message\"}" \
      "$WEBHOOK" > /dev/null 2>&1 || true
  fi
  log "$message"
}

# Cooldown gate: returns 0 (alert allowed) if no recent alert at this
# severity, 1 (skip) otherwise. Side-effect: when allowed, writes the
# current timestamp to the state file so the next call respects cooldown.
#
# A failed state write is LOGGED but still returns success. The failure mode
# matters: if the write silently fails, every tick alerts, which is noisy but
# visible. If we suppressed the alert instead, a broken state directory would
# make the monitor go quiet — the one outcome a disk monitor must never have.
# Degrade toward noise, never toward silence.
should_alert() {
  local severity="$1"
  local state_file="${STATE_DIR}/disk-alert-${severity}.last"
  local now
  now=$(date +%s)

  if [ -f "$state_file" ]; then
    local last
    last=$(cat "$state_file" 2>/dev/null || echo 0)
    # A truncated or garbled state file must not abort the script under `set -e`.
    case "$last" in
      ''|*[!0-9]*) last=0 ;;
    esac
    local elapsed=$((now - last))
    if [ "$elapsed" -lt "$COOLDOWN_SECONDS" ]; then
      return 1
    fi
  fi

  if ! echo "$now" > "$state_file" 2>/dev/null; then
    log "WARNING: could not write cooldown state to ${state_file}. Alerts will repeat every run until this is fixed."
  fi
  return 0
}

# Clears the cooldown state for a severity, so the *next* breach fires
# immediately. Called when disk drops below a threshold so the operator
# gets a clean alert when it climbs back up.
clear_alert_state() {
  local severity="$1"
  rm -f "${STATE_DIR}/disk-alert-${severity}.last" 2>/dev/null || true
}

if [ "$DISK_USAGE" -ge 90 ]; then
  if should_alert "critical"; then
    send_alert "🚨 Disk usage CRITICAL: ${DISK_USAGE}% used (${AVAIL_HUMAN} free) on ${HOSTNAME}. Immediate action required."
  fi
elif [ "$DISK_USAGE" -ge 80 ]; then
  # Dropped out of critical → reset critical cooldown so the next critical
  # crossing alerts immediately.
  clear_alert_state "critical"
  if should_alert "warning"; then
    send_alert "⚠️ Disk usage WARNING: ${DISK_USAGE}% used (${AVAIL_HUMAN} free) on ${HOSTNAME}"
  fi
else
  # Below all thresholds — clear both cooldowns so future breaches are fresh.
  clear_alert_state "critical"
  clear_alert_state "warning"
fi

exit 0
