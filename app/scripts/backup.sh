#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# Armoured Souls — Daily PostgreSQL Backup
# Retains 7 daily + 4 weekly backups
# ============================================================================

BACKUP_DIR="/opt/armouredsouls/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DAY_OF_WEEK=$(date +%u)  # 1=Monday, 7=Sunday
DAILY_RETAIN=7
WEEKLY_RETAIN=4

# Load database credentials from environment or .env file
if [ -f /opt/armouredsouls/backend/.env ]; then
  set -a
  source /opt/armouredsouls/backend/.env
  set +a
fi

DB_USER="${POSTGRES_USER:-armouredsouls}"
DB_NAME="${POSTGRES_DB:-armouredsouls}"
DB_HOST="${POSTGRES_HOST:-127.0.0.1}"
DB_PORT="${POSTGRES_PORT:-5432}"

mkdir -p "${BACKUP_DIR}/daily" "${BACKUP_DIR}/weekly"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# --- Create daily backup ---
DAILY_FILE="${BACKUP_DIR}/daily/${DB_NAME}_daily_${TIMESTAMP}.sql.gz"
log "Starting daily backup: ${DAILY_FILE}"

if pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" "${DB_NAME}" | gzip > "${DAILY_FILE}"; then
  FILE_SIZE=$(du -h "${DAILY_FILE}" | cut -f1)
  log "Daily backup complete: ${DAILY_FILE} (${FILE_SIZE})"
else
  log "ERROR: Daily backup failed"
  exit 1
fi

# --- Promote Sunday backup to weekly ---
if [ "${DAY_OF_WEEK}" -eq 7 ]; then
  WEEKLY_FILE="${BACKUP_DIR}/weekly/${DB_NAME}_weekly_${TIMESTAMP}.sql.gz"
  cp "${DAILY_FILE}" "${WEEKLY_FILE}"
  log "Weekly backup created: ${WEEKLY_FILE}"
fi

# --- Cleanup old daily backups (keep last N) ---
DAILY_COUNT=$(find "${BACKUP_DIR}/daily" -name "*.sql.gz" -type f | wc -l)
if [ "${DAILY_COUNT}" -gt "${DAILY_RETAIN}" ]; then
  DELETE_COUNT=$((DAILY_COUNT - DAILY_RETAIN))
  find "${BACKUP_DIR}/daily" -name "*.sql.gz" -type f -printf '%T+ %p\n' \
    | sort | head -n "${DELETE_COUNT}" | awk '{print $2}' \
    | xargs rm -f
  log "Cleaned up ${DELETE_COUNT} old daily backup(s)"
fi

# --- Cleanup old weekly backups (keep last N) ---
WEEKLY_COUNT=$(find "${BACKUP_DIR}/weekly" -name "*.sql.gz" -type f | wc -l)
if [ "${WEEKLY_COUNT}" -gt "${WEEKLY_RETAIN}" ]; then
  DELETE_COUNT=$((WEEKLY_COUNT - WEEKLY_RETAIN))
  find "${BACKUP_DIR}/weekly" -name "*.sql.gz" -type f -printf '%T+ %p\n' \
    | sort | head -n "${DELETE_COUNT}" | awk '{print $2}' \
    | xargs rm -f
  log "Cleaned up ${DELETE_COUNT} old weekly backup(s)"
fi

log "Backup process complete"
