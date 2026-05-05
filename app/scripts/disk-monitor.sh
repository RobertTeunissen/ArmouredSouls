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
# Always exits 0 to avoid cron error emails.
# ============================================================================

# Load environment if available
if [ -f /opt/armouredsouls/backend/.env ]; then
  set -a
  source /opt/armouredsouls/backend/.env
  set +a
fi

WEBHOOK="${MONITORING_DISCORD_WEBHOOK:-${DISCORD_WEBHOOK_URL:-}}"
HOSTNAME=$(hostname)

# Get disk usage percentage for root filesystem
DISK_USAGE=$(df / --output=pcent | tail -1 | tr -d ' %')

# Get available space in human-readable format
AVAIL_KB=$(df / --output=avail | tail -1 | tr -d ' ')
if [ "$AVAIL_KB" -ge 1048576 ]; then
  AVAIL_HUMAN="$(echo "scale=1; $AVAIL_KB / 1048576" | bc)GB"
elif [ "$AVAIL_KB" -ge 1024 ]; then
  AVAIL_HUMAN="$(echo "scale=0; $AVAIL_KB / 1024" | bc)MB"
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

if [ "$DISK_USAGE" -ge 90 ]; then
  send_alert "🚨 Disk usage CRITICAL: ${DISK_USAGE}% used (${AVAIL_HUMAN} free) on ${HOSTNAME}. Immediate action required."
elif [ "$DISK_USAGE" -ge 80 ]; then
  send_alert "⚠️ Disk usage WARNING: ${DISK_USAGE}% used (${AVAIL_HUMAN} free) on ${HOSTNAME}"
fi

exit 0
