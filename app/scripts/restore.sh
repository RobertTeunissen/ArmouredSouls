#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# Armoured Souls — PostgreSQL Backup Restore
# Usage: ./restore.sh <backup_file.dump|backup_file.sql.gz>
#
# Supports two modes:
#   1. Host pg_restore/psql (if postgresql-client is installed)
#   2. Docker exec fallback (pipes the dump into the running container)
# ============================================================================

CONTAINER_NAME="${BACKUP_CONTAINER_NAME:-armouredsouls-db-prod}"

if [ $# -lt 1 ]; then
  echo "Usage: $0 <backup_file.dump|backup_file.sql.gz>"
  echo ""
  echo "Available backups:"
  ls -lht /opt/armouredsouls/backups/daily/ 2>/dev/null || echo "  No daily backups found"
  ls -lht /opt/armouredsouls/backups/weekly/ 2>/dev/null || echo "  No weekly backups found"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "ERROR: Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

# Read credentials from .env using safe text parsing (no source)
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
DB_PASS="${POSTGRES_PASSWORD:-$(env_get POSTGRES_PASSWORD "$ENV_FILE")}"

# Apply defaults
DB_USER="${DB_USER:-armouredsouls}"
DB_NAME="${DB_NAME:-armouredsouls}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_PASS="${DB_PASS:-}"

# Determine restore method
use_docker=false
if ! command -v pg_restore &> /dev/null; then
  if docker exec "${CONTAINER_NAME}" pg_restore --version &> /dev/null; then
    use_docker=true
  else
    echo "ERROR: pg_restore not available on host or in container ${CONTAINER_NAME}"
    exit 1
  fi
fi

FILE_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)

echo "============================================"
echo "  Armoured Souls — Database Restore"
echo "============================================"
echo ""
echo "  Backup file : ${BACKUP_FILE}"
echo "  File size   : ${FILE_SIZE}"
echo "  Database    : ${DB_NAME}"
if [ "$use_docker" = true ]; then
  echo "  Method      : docker exec (container: ${CONTAINER_NAME})"
else
  echo "  Host        : ${DB_HOST}:${DB_PORT}"
fi
echo "  User        : ${DB_USER}"
echo ""
echo "  WARNING: This will DROP and recreate the"
echo "  database '${DB_NAME}'. All current data"
echo "  will be lost."
echo ""
read -rp "  Are you sure you want to proceed? (yes/no): " CONFIRM

if [ "${CONFIRM}" != "yes" ]; then
  echo "Restore cancelled."
  exit 0
fi

echo ""
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Stopping backend..."
pm2 stop armouredsouls-backend 2>/dev/null || true

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Dropping and recreating database..."
if [ "$use_docker" = true ]; then
  docker exec "${CONTAINER_NAME}" dropdb -U "${DB_USER}" --if-exists "${DB_NAME}"
  docker exec "${CONTAINER_NAME}" createdb -U "${DB_USER}" "${DB_NAME}"
else
  PGPASSWORD="${DB_PASS}" dropdb -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" --if-exists "${DB_NAME}"
  PGPASSWORD="${DB_PASS}" createdb -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" "${DB_NAME}"
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Restoring from backup..."
if [[ "${BACKUP_FILE}" == *.dump ]]; then
  if [ "$use_docker" = true ]; then
    docker exec -i "${CONTAINER_NAME}" pg_restore -U "${DB_USER}" -d "${DB_NAME}" --no-owner --no-acl < "${BACKUP_FILE}"
  else
    PGPASSWORD="${DB_PASS}" pg_restore -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" --no-owner --no-acl "${BACKUP_FILE}"
  fi
else
  if [ "$use_docker" = true ]; then
    gunzip -c "${BACKUP_FILE}" | docker exec -i "${CONTAINER_NAME}" psql -U "${DB_USER}" "${DB_NAME}" > /dev/null
  else
    gunzip -c "${BACKUP_FILE}" | PGPASSWORD="${DB_PASS}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" "${DB_NAME}" > /dev/null
  fi
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Running migrations..."
cd /opt/armouredsouls/backend
pnpm exec prisma migrate deploy

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting backend..."
pm2 start ecosystem.config.js 2>/dev/null || pm2 start /opt/armouredsouls/ecosystem.config.js

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Restore complete."
