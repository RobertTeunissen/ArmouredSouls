#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# Armoured Souls — Daily PostgreSQL Backup
# Configurable retention via env vars (defaults: 2 daily + 0 weekly).
# Old backups are cleaned BEFORE the disk-full guard so the script can
# self-recover when disk usage is already above the threshold.
#
# Supports two modes:
#   1. Host pg_dump (if postgresql-client is installed on the VPS)
#   2. Docker exec fallback (uses pg_dump inside the running container)
# ============================================================================

BACKUP_DIR="/opt/armouredsouls/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DAY_OF_WEEK=$(date +%u)  # 1=Monday, 7=Sunday
DAILY_RETAIN="${BACKUP_DAILY_RETAIN:-2}"
WEEKLY_RETAIN="${BACKUP_WEEKLY_RETAIN:-0}"
PRE_DEPLOY_RETAIN="${BACKUP_PRE_DEPLOY_RETAIN:-2}"
DISK_THRESHOLD="${BACKUP_DISK_THRESHOLD:-85}"
CONTAINER_NAME="${BACKUP_CONTAINER_NAME:-armouredsouls-db-prod}"

# Read a single key from the .env file as plain text. Avoids `source .env`
# entirely — bash's `source` interprets unquoted values as commands.
env_get() {
  local key="$1"
  local file="$2"
  [ -f "$file" ] || return 0
  grep -E "^${key}=" "$file" | tail -n 1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/; s/^'\''(.*)'\''$/\1/'
}

ENV_FILE="/opt/armouredsouls/backend/.env"

# --- Parse DATABASE_URL if individual POSTGRES_* vars are absent ---
# Format: postgresql://user:password@host:port/dbname?params
parse_database_url() {
  local url="$1"
  # Strip protocol prefix and query params
  local without_proto="${url#*://}"
  local without_params="${without_proto%%\?*}"
  # Extract user:password@host:port/dbname
  local userinfo="${without_params%%@*}"
  local hostinfo="${without_params#*@}"
  PARSED_USER="${userinfo%%:*}"
  PARSED_PASS="${userinfo#*:}"
  local hostport="${hostinfo%%/*}"
  PARSED_DB="${hostinfo#*/}"
  PARSED_HOST="${hostport%%:*}"
  PARSED_PORT="${hostport#*:}"
  # If no port separator was found, default to 5432
  if [ "$PARSED_PORT" = "$PARSED_HOST" ]; then
    PARSED_PORT="5432"
  fi
}

# Try individual vars first, then fall back to DATABASE_URL parsing
DB_USER="${POSTGRES_USER:-$(env_get POSTGRES_USER "$ENV_FILE")}"
DB_NAME="${POSTGRES_DB:-$(env_get POSTGRES_DB "$ENV_FILE")}"
DB_HOST="${POSTGRES_HOST:-$(env_get POSTGRES_HOST "$ENV_FILE")}"
DB_PORT="${POSTGRES_PORT:-$(env_get POSTGRES_PORT "$ENV_FILE")}"
DB_PASS="${POSTGRES_PASSWORD:-$(env_get POSTGRES_PASSWORD "$ENV_FILE")}"

# If DB_USER is still empty, parse from DATABASE_URL
if [ -z "${DB_USER}" ]; then
  RAW_DATABASE_URL="${DATABASE_URL:-$(env_get DATABASE_URL "$ENV_FILE")}"
  if [ -n "${RAW_DATABASE_URL}" ]; then
    parse_database_url "${RAW_DATABASE_URL}"
    DB_USER="${DB_USER:-$PARSED_USER}"
    DB_NAME="${DB_NAME:-$PARSED_DB}"
    DB_HOST="${DB_HOST:-$PARSED_HOST}"
    DB_PORT="${DB_PORT:-$PARSED_PORT}"
    DB_PASS="${DB_PASS:-$PARSED_PASS}"
  fi
fi

MONITORING_DISCORD_WEBHOOK="${MONITORING_DISCORD_WEBHOOK:-$(env_get MONITORING_DISCORD_WEBHOOK "$ENV_FILE")}"
DISCORD_WEBHOOK_URL="${DISCORD_WEBHOOK_URL:-$(env_get DISCORD_WEBHOOK_URL "$ENV_FILE")}"

# Apply defaults after env resolution
DB_USER="${DB_USER:-armouredsouls}"
DB_NAME="${DB_NAME:-armouredsouls}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_PASS="${DB_PASS:-}"

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

# --- Determine backup method ---
# Prefer host pg_dump if available; fall back to docker exec.
use_docker=false
if ! command -v pg_dump &> /dev/null; then
  if docker exec "${CONTAINER_NAME}" pg_dump --version &> /dev/null; then
    use_docker=true
    log "pg_dump not found on host — using docker exec (container: ${CONTAINER_NAME})"
  else
    log "ERROR: pg_dump not available on host or in container ${CONTAINER_NAME}"
    send_alert "🚨 Backup FAILED on $(hostname): pg_dump not available on host or in Docker container '${CONTAINER_NAME}'."
    exit 1
  fi
fi

# --- Cleanup old pre-deploy backups (runs BEFORE the disk guard) ---
PRE_DEPLOY_COUNT=$(find "${BACKUP_DIR}" -maxdepth 1 -name "pre_deploy_*.dump" -type f | wc -l)
if [ "${PRE_DEPLOY_COUNT}" -gt "${PRE_DEPLOY_RETAIN}" ]; then
  DELETE_COUNT=$((PRE_DEPLOY_COUNT - PRE_DEPLOY_RETAIN))
  find "${BACKUP_DIR}" -maxdepth 1 -name "pre_deploy_*.dump" -type f -printf '%T+ %p\n' \
    | sort | head -n "${DELETE_COUNT}" | awk '{print $2}' \
    | xargs rm -f
  log "Cleaned up ${DELETE_COUNT} old pre-deploy backup(s)"
fi

# --- Cleanup old daily backups (runs BEFORE the disk guard) ---
DAILY_COUNT=$(find "${BACKUP_DIR}/daily" \( -name "*.dump" -o -name "*.sql.gz" \) -type f | wc -l)
if [ "${DAILY_COUNT}" -gt "${DAILY_RETAIN}" ]; then
  DELETE_COUNT=$((DAILY_COUNT - DAILY_RETAIN))
  find "${BACKUP_DIR}/daily" \( -name "*.dump" -o -name "*.sql.gz" \) -type f -printf '%T+ %p\n' \
    | sort | head -n "${DELETE_COUNT}" | awk '{print $2}' \
    | xargs rm -f
  log "Cleaned up ${DELETE_COUNT} old daily backup(s)"
fi

# --- Cleanup old weekly backups (runs BEFORE the disk guard) ---
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

run_pg_dump() {
  if [ "$use_docker" = true ]; then
    # Run pg_dump inside the Docker container, stream output to host file
    docker exec "${CONTAINER_NAME}" pg_dump -U "${DB_USER}" -Fc "${DB_NAME}" > "${DAILY_FILE}"
  else
    # Run pg_dump on the host with password via PGPASSWORD
    PGPASSWORD="${DB_PASS}" pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -Fc "${DB_NAME}" > "${DAILY_FILE}"
  fi
}

if run_pg_dump; then
  FILE_SIZE=$(du -h "${DAILY_FILE}" | cut -f1)
  log "Daily backup complete: ${DAILY_FILE} (${FILE_SIZE})"
else
  # Remove empty/partial dump file on failure
  rm -f "${DAILY_FILE}"
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
