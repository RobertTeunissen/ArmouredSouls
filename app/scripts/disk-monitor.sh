#!/usr/bin/env bash
# ============================================================================
# Armoured Souls — Disk Usage Monitor
#
# Checks root filesystem usage and alerts via Discord webhook.
# Cron: */15 * * * * /opt/armouredsouls/scripts/disk-monitor.sh
#
# Environment:
#   MONITORING_DISCORD_WEBHOOK - Primary webhook for ops alerts
#   DISCORD_WEBHOOK_URL        - Fallback if monitoring webhook not set
#
# Thresholds:
#   >= 80% — WARNING alert
#   >= 90% — CRITICAL alert
#   <  80% — Silent exit
#
# Cooldown: 60 minutes per severity. While disk sits above a threshold the
# operator gets one alert per hour, not one every cron tick. The cooldown
# resets when the disk drops below the threshold so the next cross-back-up
# alert fires immediately. State is kept in /var/lib/armouredsouls/ (or
# /tmp as a fallback) — content is the unix timestamp of the last alert.
#
# Always exits 0 to avoid cron error emails.
# ============================================================================

# Load environment if available
if [ -f /opt/armouredsouls/backend/.env ]; then
  set -a
  # shellcheck disable=SC1091
  source /opt/armouredsouls/backend/.env
  set +a
fi

WEBHOOK="${MONITORING_DISCORD_WEBHOOK:-${DISCORD_WEBHOOK_URL:-}}"
HOSTNAME=$(hostname)
COOLDOWN_SECONDS="${DISK_ALERT_COOLDOWN_SECONDS:-3600}"

# Cooldown state directory. Prefer /var/lib/armouredsouls (persists across
# reboots) but fall back to /tmp if it doesn't exist or isn't writable.
STATE_DIR="/var/lib/armouredsouls"
if [ ! -d "$STATE_DIR" ] || ! [ -w "$STATE_DIR" ]; then
  STATE_DIR="/tmp"
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
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $message"
}

# Cooldown gate: returns 0 (alert allowed) if no recent alert at this
# severity, 1 (skip) otherwise. Side-effect: when allowed, writes the
# current timestamp to the state file so the next call respects cooldown.
should_alert() {
  local severity="$1"
  local state_file="${STATE_DIR}/disk-alert-${severity}.last"
  local now
  now=$(date +%s)

  if [ -f "$state_file" ]; then
    local last
    last=$(cat "$state_file" 2>/dev/null || echo 0)
    local elapsed=$((now - last))
    if [ "$elapsed" -lt "$COOLDOWN_SECONDS" ]; then
      return 1
    fi
  fi

  echo "$now" > "$state_file" 2>/dev/null || true
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
