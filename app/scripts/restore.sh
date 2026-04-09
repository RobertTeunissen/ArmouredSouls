#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# Armoured Souls — PostgreSQL Backup Restore
# Usage: ./restore.sh <backup_file.sql.gz>
# ============================================================================

if [ $# -lt 1 ]; then
  echo "Usage: $0 <backup_file.sql.gz>"
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

FILE_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)

echo "============================================"
echo "  Armoured Souls — Database Restore"
echo "============================================"
echo ""
echo "  Backup file : ${BACKUP_FILE}"
echo "  File size   : ${FILE_SIZE}"
echo "  Database    : ${DB_NAME}"
echo "  Host        : ${DB_HOST}:${DB_PORT}"
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
dropdb -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" --if-exists "${DB_NAME}"
createdb -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" "${DB_NAME}"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Restoring from backup..."
gunzip -c "${BACKUP_FILE}" | psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" "${DB_NAME}" > /dev/null

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Running migrations..."
cd /opt/armouredsouls/backend
npx prisma migrate deploy

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting backend..."
pm2 start ecosystem.config.js 2>/dev/null || pm2 start /opt/armouredsouls/ecosystem.config.js

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Restore complete."
