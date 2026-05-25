#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# Armoured Souls — Daily PostgreSQL Backup
# Configurable retention via env vars (defaults: 2 daily + 0 weekly).
# Old backups are cleaned BEFORE the disk-full guard so the script can
# self-recover when disk usage is already above the threshold.
# ============================================================================

BACKUP_DIR="/opt/armouredsouls/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DAY_OF_WEEK=$(date +%u)  # 1=Monday, 7=Sunday
DAILY_RETAIN="${BACKUP_DAILY_RETAIN:-2}"
WEEKLY_RETAIN="${BACKUP_WEEKLY_RETAIN:-0}"
PRE_DEPLOY_RETAIN="${BACKUP_PRE_DEPLOY_RETAIN:-2}"
DISK_THRESHOLD="${BACKUP_DISK_THRESHOLD:-85}"

# Read a single key from the .env file as plain text. Avoids `source .env`
# entirely — bash's `source` interprets unquoted values as commands, e.g.
# `LEAGUE_SCHEDULE=0 20 * * *` makes it try to run `20` and crashes the
# script with "20: command not found". This helper instead grabs the last
# line matching `KEY=`, strips the `KEY=` prefix and surrounding quotes,
# and returns the raw value. Same fix shape as preflight.sh (PR #332).
env_get() {
  local key="$1"
  local file="$2"
  [ -f "$file" ] || return 0
  grep -E "^${key}=" "$file" | tail -n 1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/; s/^'\''(.*)'\''$/\1/'
}

ENV_FILE="/opt/armouredsouls/backend/.env"
DB_USER="${POSTGRES_USER:-$(env_get POSTGRES_USER "$ENV_FILE")}"
DB_NAME="${POSTGRES_DB:-$(env_get POSTGRES_DB "$ENV_FILE")}"
DB_HOST="${POSTGRES_HOST:-$(env_get POSTGRES_HOST "$ENV_FILE")}"
DB_PORT="${POSTGRES_PORT:-$(env_get POSTGRES_PORT "$ENV_FILE")}"
MONITORING_DISCORD_WEBHOOK="${MONITORING_DISCORD_WEBHOOK:-$(env_get MONITORING_DISCORD_WEBHOOK "$ENV_FILE")}"
DISCORD_WEBHOOK_URL="${DISCORD_WEBHOOK_URL:-$(env_get DISCORD_WEBHOOK_URL "$ENV_FILE")}"

# Apply defaults after env resolution
DB_USER="${DB_USER:-armouredsouls}"
DB_NAME="${DB_NAME:-armouredsouls}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"

mkdir -p "${BACKUP_DIR}/daily" "${BACKUP_DIR}/weekly"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# --- Monitoring alert helper ---
send_alert() {
  local message="$1"
  local webhook="${MONITORING_DISCORD_WEBHOOK:-${DISCORD_WEBHOOK_URL:-}}"
  if [ -n "$webhook" ]; then
    curl -s -H "Content-Type: application/json" \
      -d "{\"content\": \"$message\"}" \
      "$webhook" > /dev/null 2>&1 || true
  fi
  log "$message"
}

# --- Cleanup old pre-deploy backups (runs BEFORE the disk guard so we can
#     still reclaim space when disk usage is already over the threshold) ---
PRE_DEPLOY_COUNT=$(find "${BACKUP_DIR}" -maxdepth 1 -name "pre_deploy_*.dump" -type f | wc -l)
if [ "${PRE_DEPLOY_COUNT}" -gt "${PRE_DEPLOY_RETAIN}" ]; then
  DELETE_COUNT=$((PRE_DEPLOY_COUNT - PRE_DEPLOY_RETAIN))
  find "${BACKUP_DIR}" -maxdepth 1 -name "pre_deploy_*.dump" -type f -printf '%T+ %p\n' \
    | sort | head -n "${DELETE_COUNT}" | awk '{print $2}' \
    | xargs rm -f
  log "Cleaned up ${DELETE_COUNT} old pre-deploy backup(s)"
fi

# --- Cleanup old daily backups (also runs BEFORE the disk guard) ---
# Without this, a single day above the disk threshold causes the script to
# bail out before the cleanup step at the bottom, leaving old backups on
# disk forever and making the disk-full state self-reinforcing. We saw this
# happen on ACC: backups stopped at May 18 with 3.1 GB of files locked up.
DAILY_COUNT=$(find "${BACKUP_DIR}/daily" \( -name "*.dump" -o -name "*.sql.gz" \) -type f | wc -l)
if [ "${DAILY_COUNT}" -gt "${DAILY_RETAIN}" ]; then
  DELETE_COUNT=$((DAILY_COUNT - DAILY_RETAIN))
  find "${BACKUP_DIR}/daily" \( -name "*.dump" -o -name "*.sql.gz" \) -type f -printf '%T+ %p\n' \
    | sort | head -n "${DELETE_COUNT}" | awk '{print $2}' \
    | xargs rm -f
  log "Cleaned up ${DELETE_COUNT} old daily backup(s)"
fi

# --- Cleanup old weekly backups (also runs BEFORE the disk guard) ---
WEEKLY_COUNT=$(find "${BACKUP_DIR}/weekly" \( -name "*.dump" -o -name "*.sql.gz" \) -type f | wc -l)
if [ "${WEEKLY_COUNT}" -gt "${WEEKLY_RETAIN}" ]; then
  DELETE_COUNT=$((WEEKLY_COUNT - WEEKLY_RETAIN))
  find "${BACKUP_DIR}/weekly" \( -name "*.dump" -o -name "*.sql.gz" \) -type f -printf '%T+ %p\n' \
    | sort | head -n "${DELETE_COUNT}" | awk '{print $2}' \
    | xargs rm -f
  log "Cleaned up ${DELETE_COUNT} old weekly backup(s)"
fi

# --- Disk space guard ---
DISK_USAGE=$(df / --output=pcent | tail -1 | tr -d ' %')
if [ "${DISK_USAGE}" -ge "${DISK_THRESHOLD}" ]; then
  log "SKIPPED: Disk usage ${DISK_USAGE}% exceeds ${DISK_THRESHOLD}% threshold — free space before next backup"
  send_alert "⚠️ Backup SKIPPED: Disk usage ${DISK_USAGE}% exceeds ${DISK_THRESHOLD}% threshold on $(hostname). No backup created."
  exit 0
fi

# --- Create daily backup ---
DAILY_FILE="${BACKUP_DIR}/daily/${DB_NAME}_daily_${TIMESTAMP}.dump"
log "Starting daily backup: ${DAILY_FILE}"

if pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -Fc "${DB_NAME}" > "${DAILY_FILE}"; then
  FILE_SIZE=$(du -h "${DAILY_FILE}" | cut -f1)
  log "Daily backup complete: ${DAILY_FILE} (${FILE_SIZE})"
else
  log "ERROR: Daily backup failed"
  send_alert "🚨 Backup FAILED: pg_dump returned error on $(hostname). Check backup logs."
  exit 1
fi

# --- Promote Sunday backup to weekly ---
if [ "${DAY_OF_WEEK}" -eq 7 ]; then
  WEEKLY_FILE="${BACKUP_DIR}/weekly/${DB_NAME}_weekly_${TIMESTAMP}.dump"
  cp "${DAILY_FILE}" "${WEEKLY_FILE}"
  log "Weekly backup created: ${WEEKLY_FILE}"
fi

log "Backup process complete"
