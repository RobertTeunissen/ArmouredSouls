#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# Armoured Souls — Pre-migration database backup (deploy step)
#
# Runs in every ACC/PRD deploy after pre-flight and before
# `prisma migrate deploy`. Writes backups/pre_deploy_<timestamp>.dump
# (pg_dump custom format, restorable with restore.sh) and keeps the newest
# BACKUP_PRE_DEPLOY_RETAIN of them (default 1). The previous dump is deleted
# only after the new one is complete and pg_restore can read it.
#
# Exits non-zero — failing the deploy BEFORE migrations run — when no dump
# can be made. The inline step this replaces only tried `docker exec` into a
# hard-coded container, failed on every ACC deploy from at least 12 Oct 2026,
# and printed a warning while the migrations ran without a backup.
#
# Settings and dump method: as backup.sh (backup-common.sh).
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] pre-deploy-backup: $1"
}

# shellcheck source=backup-common.sh
. "${SCRIPT_DIR}/backup-common.sh"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
resolve_db_connection
mkdir -p "${BACKUP_DIR}"
remove_partial_dumps "${BACKUP_DIR}"

if ! select_dump_method; then
  send_alert "🚨 Deploy ABORTED on $(hostname): no working pg_dump on the host or in Docker container '${CONTAINER_NAME}', so no pre-migration backup could be made. Migrations were not run."
  exit 1
fi
log "Dumping ${DB_NAME} via ${DUMP_VIA} pg_dump"

DUMP_FILE="${BACKUP_DIR}/pre_deploy_${TIMESTAMP}.dump"
PARTIAL_FILE="${DUMP_FILE}.partial"

if ! dump_database -Fc > "${PARTIAL_FILE}"; then
  rm -f "${PARTIAL_FILE}"
  send_alert "🚨 Deploy ABORTED on $(hostname): the pre-migration pg_dump failed. Migrations were not run; the previous pre-deploy backup was kept."
  exit 1
fi
if ! list_custom_dump "${PARTIAL_FILE}"; then
  rm -f "${PARTIAL_FILE}"
  send_alert "🚨 Deploy ABORTED on $(hostname): the pre-migration dump failed verification (pg_restore --list). Migrations were not run; the previous pre-deploy backup was kept."
  exit 1
fi
mv -f "${PARTIAL_FILE}" "${DUMP_FILE}"
log "Backup created: ${DUMP_FILE} ($(du -h "${DUMP_FILE}" | cut -f1))"

prune_backups "${BACKUP_DIR}" "${PRE_DEPLOY_RETAIN}" 'pre_deploy_*.dump'
