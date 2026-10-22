#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# Armoured Souls — Daily PostgreSQL Backup (cron, 02:00)
#
# Writes one gzip'd SQL dump to backups/daily/ and keeps the newest
# BACKUP_DAILY_RETAIN of them (default 1). The previous dump is deleted only
# AFTER the new one has been written and verified, so a failed run never
# leaves the host with fewer backups than before, and the disk holds one dump
# more than the retention only while the new one is being written (~20 min).
#
# Overflow beyond the retention (for example after lowering it) is still
# removed BEFORE the disk guard, so the script can recover on a full disk.
#
# Settings: process environment → /opt/armouredsouls/backend/.env → default.
#   BACKUP_DAILY_RETAIN       daily dumps to keep (default 1, minimum 1)
#   BACKUP_WEEKLY_RETAIN      weekly copies of the Sunday dump (default 0)
#   BACKUP_PRE_DEPLOY_RETAIN  pre-migration dumps to keep (default 1)
#   BACKUP_DISK_THRESHOLD     skip the backup at or above this disk % (default 85)
#   BACKUP_CONTAINER_NAME     Postgres container for the docker fallback
#
# Dump method: host pg_dump if it runs, else `docker exec` into the container.
# Shared helpers and the retention model: backup-common.sh.
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# shellcheck source=backup-common.sh
. "${SCRIPT_DIR}/backup-common.sh"

DISK_THRESHOLD="$(setting BACKUP_DISK_THRESHOLD 85)"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DAY_OF_WEEK=$(date +%u)  # 1=Monday, 7=Sunday
DAILY_DIR="${BACKUP_DIR}/daily"
WEEKLY_DIR="${BACKUP_DIR}/weekly"

resolve_db_connection
mkdir -p "${DAILY_DIR}" "${WEEKLY_DIR}"
remove_partial_dumps "${DAILY_DIR}"

# --- Remove overflow beyond the retention (BEFORE the disk guard) ---
prune_backups "${BACKUP_DIR}" "${PRE_DEPLOY_RETAIN}" 'pre_deploy_*.dump'
prune_backups "${DAILY_DIR}" "${DAILY_RETAIN}" '*.dump' '*.sql.gz'
prune_backups "${WEEKLY_DIR}" "${WEEKLY_RETAIN}" '*.dump' '*.sql.gz'

# --- Disk space guard ---
DISK_USAGE=$(df / --output=pcent | tail -1 | tr -d ' %')
if [ "${DISK_USAGE}" -ge "${DISK_THRESHOLD}" ]; then
  log "SKIPPED: Disk usage ${DISK_USAGE}% exceeds ${DISK_THRESHOLD}% threshold — free space before next backup"
  send_alert "⚠️ Backup SKIPPED: Disk usage ${DISK_USAGE}% exceeds ${DISK_THRESHOLD}% threshold on $(hostname). No backup created; the previous backup was kept."
  exit 0
fi

if ! select_dump_method; then
  send_alert "🚨 Backup FAILED on $(hostname): pg_dump not available on host or in Docker container '${CONTAINER_NAME}'. The previous backup was kept."
  exit 1
fi
if [ "${DUMP_VIA}" = docker ]; then
  log "pg_dump not functional on host — using docker exec (container: ${CONTAINER_NAME})"
fi

# --- Create the daily backup as .partial, verify, then publish ---
DAILY_FILE="${DAILY_DIR}/${DB_NAME}_daily_${TIMESTAMP}.sql.gz"
PARTIAL_FILE="${DAILY_FILE}.partial"
log "Starting daily backup: ${DAILY_FILE}"

if ! dump_database | gzip > "${PARTIAL_FILE}"; then
  rm -f "${PARTIAL_FILE}"
  log "ERROR: Daily backup failed"
  send_alert "🚨 Backup FAILED: pg_dump returned error on $(hostname). The previous backup was kept. Check backup logs."
  exit 1
fi
if ! gzip -t "${PARTIAL_FILE}"; then
  rm -f "${PARTIAL_FILE}"
  log "ERROR: Daily backup failed verification (gzip -t)"
  send_alert "🚨 Backup FAILED on $(hostname): the new dump failed verification (gzip -t). The previous backup was kept."
  exit 1
fi
mv -f "${PARTIAL_FILE}" "${DAILY_FILE}"
FILE_SIZE=$(du -h "${DAILY_FILE}" | cut -f1)
log "Daily backup complete: ${DAILY_FILE} (${FILE_SIZE})"

# --- Only now drop the backups the new one replaces ---
prune_backups "${DAILY_DIR}" "${DAILY_RETAIN}" '*.dump' '*.sql.gz'

# --- Promote Sunday backup to weekly ---
# Skip entirely when BACKUP_WEEKLY_RETAIN is 0. Otherwise every Sunday we'd copy
# a full dump only for the next run's cleanup to delete it — on ACC that was a
# wasted 4.5GB duplicate sitting on disk for 24h (July 2026 disk-full incident).
if [ "${WEEKLY_RETAIN}" -eq 0 ]; then
  log "Weekly promotion skipped (BACKUP_WEEKLY_RETAIN=0)"
elif [ "${DAY_OF_WEEK}" -eq 7 ]; then
  WEEKLY_FILE="${WEEKLY_DIR}/${DB_NAME}_weekly_${TIMESTAMP}.sql.gz"
  cp "${DAILY_FILE}" "${WEEKLY_FILE}"
  log "Weekly backup created: ${WEEKLY_FILE}"
  prune_backups "${WEEKLY_DIR}" "${WEEKLY_RETAIN}" '*.dump' '*.sql.gz'
fi

log "Backup process complete"
