#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# Armoured Souls — Deploy Pre-flight Check
#
# Runs at the start of every deploy, BEFORE `npm install`. Two jobs:
#
#   1. Free up disk space by trimming old pre-deploy dumps and overflow
#      daily/weekly backups. Mirrors backup.sh's retention logic so we don't
#      have to wait for the next backup cron to reclaim space.
#
#   2. Abort the deploy with a clear error and a Discord alert if disk usage
#      is still too high after cleanup. Better to fail fast at second 1 than
#      have npm install hit ENOSPC and time out at minute 10.
#
# Why this is its own script (not inline YAML):
# - Same logic for ACC + prod — having it in two places in deploy.yml drifts.
# - Shared with the daily backup cron's retention logic.
# - Easier to test locally and update without touching workflow YAML.
#
# Why this isn't part of backup.sh:
# - backup.sh runs on a cron schedule. preflight.sh runs on demand at deploy.
# - backup.sh skips when disk is full. preflight.sh _has to_ free disk and
#   only fails if it couldn't free enough.
#
# Tunables (override via env vars):
# - PRE_DEPLOY_RETAIN: how many pre_deploy_*.dump files to keep (default: 2)
# - DAILY_RETAIN:      how many daily backups to keep (default: 2)
# - WEEKLY_RETAIN:     how many weekly backups to keep (default: 0)
# - CYCLE_LOGS_RETAIN: how many per-cycle CSV logs to keep (default: 30)
# - CYCLE_LOGS_DIR:    location of cycleLogger.ts output (default: /opt/armouredsouls/backend/cycle_logs)
# - DISK_HARD_LIMIT:   abort deploy if disk ≥ this percent post-cleanup (default: 90)
# ============================================================================

BACKUP_DIR="${BACKUP_DIR:-/opt/armouredsouls/backups}"
PRE_DEPLOY_RETAIN="${PRE_DEPLOY_RETAIN:-2}"
DAILY_RETAIN="${DAILY_RETAIN:-2}"
WEEKLY_RETAIN="${WEEKLY_RETAIN:-0}"
DISK_HARD_LIMIT="${DISK_HARD_LIMIT:-90}"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] preflight: $1"
}

# --- Monitoring alert helper (best-effort, never blocks) ---
send_alert() {
  local message="$1"
  local webhook="${MONITORING_DISCORD_WEBHOOK:-${DISCORD_WEBHOOK_URL:-}}"
  if [ -n "$webhook" ]; then
    curl -s -H "Content-Type: application/json" \
      -d "{\"content\": \"$message\"}" \
      "$webhook" > /dev/null 2>&1 || true
  fi
}

# --- Load DB env so the alert message can reference the host ---
if [ -f /opt/armouredsouls/backend/.env ]; then
  set -a
  # shellcheck disable=SC1091
  source /opt/armouredsouls/backend/.env
  set +a
fi

# --- Disk usage helper (portable: works on Linux + BSD/macOS) ---
# Returns the disk percent for `/` as an integer (no `%` sign).
# On Linux we'd prefer `df / --output=pcent`, but we keep this form
# consistent with backup.sh and friendlier to local testing on macOS.
disk_pct() {
  df -P / | awk 'NR==2 {print $5}' | tr -d '%'
}

mkdir -p "${BACKUP_DIR}/daily" "${BACKUP_DIR}/weekly"

DISK_BEFORE=$(disk_pct)
log "Disk usage before cleanup: ${DISK_BEFORE}%"

# --- 1. Cleanup old pre-deploy dumps -----------------------------------------
PRE_DEPLOY_COUNT=$(find "${BACKUP_DIR}" -maxdepth 1 -name "pre_deploy_*.dump" -type f | wc -l)
if [ "${PRE_DEPLOY_COUNT}" -gt "${PRE_DEPLOY_RETAIN}" ]; then
  DELETE_COUNT=$((PRE_DEPLOY_COUNT - PRE_DEPLOY_RETAIN))
  find "${BACKUP_DIR}" -maxdepth 1 -name "pre_deploy_*.dump" -type f -printf '%T+ %p\n' \
    | sort | head -n "${DELETE_COUNT}" | awk '{print $2}' \
    | xargs -r rm -f
  log "Removed ${DELETE_COUNT} old pre-deploy backup(s) (kept latest ${PRE_DEPLOY_RETAIN})"
fi

# --- 2. Cleanup overflow daily backups (defensive — backup.sh runs nightly) --
DAILY_COUNT=$(find "${BACKUP_DIR}/daily" \( -name "*.dump" -o -name "*.sql.gz" \) -type f | wc -l)
if [ "${DAILY_COUNT}" -gt "${DAILY_RETAIN}" ]; then
  DELETE_COUNT=$((DAILY_COUNT - DAILY_RETAIN))
  find "${BACKUP_DIR}/daily" \( -name "*.dump" -o -name "*.sql.gz" \) -type f -printf '%T+ %p\n' \
    | sort | head -n "${DELETE_COUNT}" | awk '{print $2}' \
    | xargs -r rm -f
  log "Removed ${DELETE_COUNT} overflow daily backup(s) (kept latest ${DAILY_RETAIN})"
fi

# --- 3. Cleanup overflow weekly backups --------------------------------------
WEEKLY_COUNT=$(find "${BACKUP_DIR}/weekly" \( -name "*.dump" -o -name "*.sql.gz" \) -type f | wc -l)
if [ "${WEEKLY_COUNT}" -gt "${WEEKLY_RETAIN}" ]; then
  DELETE_COUNT=$((WEEKLY_COUNT - WEEKLY_RETAIN))
  find "${BACKUP_DIR}/weekly" \( -name "*.dump" -o -name "*.sql.gz" \) -type f -printf '%T+ %p\n' \
    | sort | head -n "${DELETE_COUNT}" | awk '{print $2}' \
    | xargs -r rm -f
  log "Removed ${DELETE_COUNT} overflow weekly backup(s) (kept latest ${WEEKLY_RETAIN})"
fi

# --- 4. Cleanup old per-cycle CSV logs ---------------------------------------
# `cycleLogger.ts` writes one CSV per cycle to `cycle_logs/`. There's no in-app
# retention, so this directory grows monotonically (one file per hour). Keep
# the most recent N for forensics; trim the rest.
CYCLE_LOGS_DIR="${CYCLE_LOGS_DIR:-/opt/armouredsouls/backend/cycle_logs}"
CYCLE_LOGS_RETAIN="${CYCLE_LOGS_RETAIN:-30}"
if [ -d "${CYCLE_LOGS_DIR}" ]; then
  CYCLE_COUNT=$(find "${CYCLE_LOGS_DIR}" -maxdepth 1 -name "cycle*.csv" -type f | wc -l)
  if [ "${CYCLE_COUNT}" -gt "${CYCLE_LOGS_RETAIN}" ]; then
    DELETE_COUNT=$((CYCLE_COUNT - CYCLE_LOGS_RETAIN))
    find "${CYCLE_LOGS_DIR}" -maxdepth 1 -name "cycle*.csv" -type f -printf '%T+ %p\n' \
      | sort | head -n "${DELETE_COUNT}" | awk '{print $2}' \
      | xargs -r rm -f
    log "Removed ${DELETE_COUNT} old cycle log(s) (kept latest ${CYCLE_LOGS_RETAIN})"
  fi
fi

# --- 4. Disk hard-limit check -------------------------------------------------
DISK_AFTER=$(disk_pct)
DISK_FREE_HUMAN=$(df -h / | awk 'NR==2 {print $4}')
log "Disk usage after cleanup: ${DISK_AFTER}% (${DISK_FREE_HUMAN} free)"

if [ "${DISK_AFTER}" -ge "${DISK_HARD_LIMIT}" ]; then
  log "ERROR: Disk usage ${DISK_AFTER}% still ≥ ${DISK_HARD_LIMIT}% threshold after cleanup"

  # Diagnostic: top 10 disk consumers under /opt and /var, and PM2 log size.
  # Helps us know what to add to the cleanup logic next time. We capture into
  # a heredoc so the Discord message stays compact (top 5 lines per section).
  log "--- Top disk consumers (diagnostic) ---"
  TOP_OPT=$(du -sh /opt/armouredsouls/* 2>/dev/null | sort -hr | head -5 || echo "  (du failed)")
  TOP_VAR=$(du -sh /var/log/* 2>/dev/null | sort -hr | head -5 || echo "  (du failed)")
  PM2_LOGS=$(du -sh "$HOME/.pm2/logs" 2>/dev/null || echo "  (no pm2 logs dir)")
  CYCLE_LOGS=$(du -sh /opt/armouredsouls/backend/cycle_logs 2>/dev/null || echo "  (no cycle_logs)")

  echo "${TOP_OPT}"
  echo "${TOP_VAR}"
  echo "PM2:        ${PM2_LOGS}"
  echo "cycle_logs: ${CYCLE_LOGS}"

  # Compose Discord alert with the diagnostic summary inline so we don't have
  # to SSH in to investigate. Discord truncates over 2000 chars; we aim for ~1500.
  ALERT_BODY=$(printf '%s' \
"🚨 Deploy ABORTED on $(hostname): disk ${DISK_AFTER}% (${DISK_FREE_HUMAN} free) ≥ ${DISK_HARD_LIMIT}% after cleanup.

Top consumers:
**/opt/armouredsouls/**
\`\`\`
${TOP_OPT}
\`\`\`
**/var/log/**
\`\`\`
${TOP_VAR}
\`\`\`
PM2 logs: ${PM2_LOGS}
cycle_logs: ${CYCLE_LOGS}

Investigate before retrying.")
  send_alert "${ALERT_BODY}"
  exit 1
fi

log "Pre-flight check passed"
