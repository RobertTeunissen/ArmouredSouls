#!/usr/bin/env bash
# ============================================================================
# Armoured Souls — backup.sh / pre-deploy-backup.sh / preflight.sh harness
#
# Covers the retention model in backup-common.sh: an old dump is deleted only
# after its replacement is written and verified, a failed dump keeps the
# previous backup, and the three scripts agree on the retention settings.
#
# Isolation: pg_dump, pg_restore, docker, df and curl are stubs on PATH;
# BACKUP_DIR and BACKUP_ENV_FILE point into a temporary directory. No database,
# network or real backup is touched. Temporary files go to $TMPDIR.
#
# Usage: bash app/scripts/__tests__/backup.test.sh
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS="$(cd "${SCRIPT_DIR}/.." && pwd)"

PASS=0
FAIL=0
pass() { PASS=$((PASS + 1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  ✗ $1"; }
check() { if eval "$2"; then pass "$1"; else fail "$1"; echo "      output: ${OUT//$'\n'/$'\n'              }"; fi; }

WORKROOT="$(mktemp -d "${TMPDIR:-/tmp}/backup-test.XXXXXX")"
trap 'rm -rf "$WORKROOT"' EXIT
STUB_DIR="${WORKROOT}/stub"
mkdir -p "$STUB_DIR"

# ── Stubs ───────────────────────────────────────────────────────────

# Host pg_dump. STUB_HOST_PG_DUMP: ok | missing | fail.
cat > "${STUB_DIR}/pg_dump" <<'STUB'
#!/usr/bin/env bash
mode="${STUB_HOST_PG_DUMP:-ok}"
if [ "${1:-}" = "--version" ]; then
  [ "$mode" = missing ] && exit 1
  echo "pg_dump (PostgreSQL) 17.0"; exit 0
fi
[ "$mode" = missing ] && exit 1
case " $* " in *" -Fc "*) printf 'PGDMP custom archive\n' ;; *) printf -- '-- PostgreSQL database dump\nSELECT 1;\n' ;; esac
[ "$mode" = fail ] && { echo "pg_dump: error: connection lost" >&2; exit 1; }
exit 0
STUB

# Host pg_restore: `--list FILE` exits STUB_PG_RESTORE_EXIT (default 0).
cat > "${STUB_DIR}/pg_restore" <<'STUB'
#!/usr/bin/env bash
exit "${STUB_PG_RESTORE_EXIT:-0}"
STUB

# docker exec [-i] CONTAINER pg_dump|pg_restore ... STUB_DOCKER: ok | missing.
cat > "${STUB_DIR}/docker" <<'STUB'
#!/usr/bin/env bash
[ "${STUB_DOCKER:-missing}" = ok ] || exit 1
shift                                  # exec
[ "${1:-}" = "-i" ] && shift
shift                                  # container
tool="$1"; shift
[ "${1:-}" = "--version" ] && { echo "$tool (PostgreSQL) 17.0"; exit 0; }
case "$tool" in
  pg_dump) case " $* " in *" -Fc "*) printf 'PGDMP custom archive\n' ;; *) printf -- '-- dump via docker\n' ;; esac ;;
  pg_restore) cat > /dev/null; exit "${STUB_PG_RESTORE_EXIT:-0}" ;;
esac
STUB

# df for `/ --output=pcent`, `-P /`, `-Pk /` and `-h /`. DF_PCENT, DF_AVAIL_KB.
cat > "${STUB_DIR}/df" <<'STUB'
#!/usr/bin/env bash
pct="${DF_PCENT:-50}"; avail="${DF_AVAIL_KB:-20000000}"
case " $* " in
  *"--output=pcent"*) echo "Use%"; echo " ${pct}%" ;;
  *" -h "*) echo "Filesystem Size Used Avail Use% Mounted"; echo "/dev/sda1 45G 20G 20G ${pct}% /" ;;
  *) echo "Filesystem 1024-blocks Used Available Capacity Mounted"; echo "/dev/sda1 47000000 20000000 ${avail} ${pct}% /" ;;
esac
STUB

printf '#!/usr/bin/env bash\nexit 0\n' > "${STUB_DIR}/curl"
chmod +x "${STUB_DIR}"/*

# ── Scaffolding ─────────────────────────────────────────────────────

# Fresh backup tree plus an empty .env; sets BK and ENVF.
fresh() {
  BK="$(mktemp -d "${WORKROOT}/case.XXXXXX")"
  mkdir -p "${BK}/backups/daily" "${BK}/backups/weekly"
  ENVF="${BK}/backend.env"
  printf 'NODE_ENV=acceptance\nPOSTGRES_USER=as_acc\nPOSTGRES_DB=armouredsouls_acc\n' > "$ENVF"
}

# make_file PATH MINUTES_AGO [CONTENT_KIND]
make_file() {
  local path="$1" minutes="$2" kind="${3:-gz}"
  case "$kind" in
    gz) printf -- '-- old dump\n' | gzip > "$path" ;;
    custom) printf 'PGDMP old\n' > "$path" ;;
    empty) : > "$path" ;;
  esac
  local epoch=$(( $(date +%s) - minutes * 60 ))
  local stamp
  stamp="$(date -r "$epoch" +%Y%m%d%H%M 2>/dev/null || date -d "@${epoch}" +%Y%m%d%H%M)"
  touch -t "$stamp" "$path"
}

# run SCRIPT [VAR=value...] — runs with stubs; sets OUT and STATUS.
run() {
  local script="$1"; shift
  STATUS=0
  OUT="$(
    env -u BACKUP_DAILY_RETAIN -u BACKUP_PRE_DEPLOY_RETAIN -u BACKUP_WEEKLY_RETAIN \
        -u BACKUP_CONTAINER_NAME -u MONITORING_DISCORD_WEBHOOK -u DATABASE_URL \
        -u POSTGRES_USER -u POSTGRES_DB -u POSTGRES_PASSWORD \
      PATH="${STUB_DIR}:${PATH}" BACKUP_DIR="${BK}/backups" BACKUP_ENV_FILE="$ENVF" \
      CYCLE_LOGS_DIR="${BK}/no-cycle-logs" "$@" \
      bash "${SCRIPTS}/${script}" 2>&1
  )" || STATUS=$?
}

count() { find "$1" -maxdepth 1 -type f -name "$2" | wc -l | tr -d ' '; }
exists() { [ -f "$1" ]; }

# ── backup.sh ───────────────────────────────────────────────────────

echo "backup.sh"

fresh
make_file "${BK}/backups/daily/armouredsouls_acc_daily_OLD.sql.gz" 1440
run backup.sh
NEW="$(find "${BK}/backups/daily" -name '*.sql.gz' -type f)"
check "keeps one daily dump by default: the new one replaces the old one" \
  '[ "$STATUS" -eq 0 ] && [ "$(count "${BK}/backups/daily" "*.sql.gz")" -eq 1 ] && ! exists "${BK}/backups/daily/armouredsouls_acc_daily_OLD.sql.gz"'
check "the new daily dump is a complete gzip file named after the database" \
  '[[ "$NEW" == *"/armouredsouls_acc_daily_"*".sql.gz" ]] && gzip -t "$NEW"'
check "deletes the old dump only after the new one is complete (logged in that order)" \
  '[ "$(grep -n "Daily backup complete" <<< "$OUT" | cut -d: -f1)" -lt "$(grep -n "Removed old backup" <<< "$OUT" | cut -d: -f1)" ]'
check "leaves no .partial file behind" '[ "$(count "${BK}/backups/daily" "*.partial")" -eq 0 ]'

fresh
make_file "${BK}/backups/daily/old.sql.gz" 1440
run backup.sh STUB_HOST_PG_DUMP=fail
check "a failed pg_dump exits non-zero, keeps the previous dump and removes the partial file" \
  '[ "$STATUS" -ne 0 ] && exists "${BK}/backups/daily/old.sql.gz" && [ "$(count "${BK}/backups/daily" "*")" -eq 1 ] && [ "$(count "${BK}/backups/daily" "*.partial")" -eq 0 ]'
check "the failure alert says the previous backup was kept" 'grep -q "Backup FAILED: pg_dump returned error.*previous backup was kept" <<< "$OUT"'

fresh
make_file "${BK}/backups/daily/old.sql.gz" 1440
run backup.sh STUB_HOST_PG_DUMP=missing STUB_DOCKER=missing
check "no working pg_dump anywhere: exits non-zero and keeps the previous dump" \
  '[ "$STATUS" -ne 0 ] && exists "${BK}/backups/daily/old.sql.gz" && grep -q "pg_dump not available" <<< "$OUT"'

fresh
run backup.sh STUB_HOST_PG_DUMP=missing STUB_DOCKER=ok
check "falls back to docker exec when the host pg_dump does not run" \
  '[ "$STATUS" -eq 0 ] && grep -q "using docker exec" <<< "$OUT" && [ "$(count "${BK}/backups/daily" "*.sql.gz")" -eq 1 ]'

fresh
make_file "${BK}/backups/daily/a.sql.gz" 4320
make_file "${BK}/backups/daily/b.sql.gz" 2880
make_file "${BK}/backups/daily/c.sql.gz" 1440
run backup.sh DF_PCENT=90
check "on a full disk: trims overflow to the retention, keeps the newest, and skips the backup" \
  '[ "$STATUS" -eq 0 ] && grep -q "SKIPPED" <<< "$OUT" && [ "$(count "${BK}/backups/daily" "*.sql.gz")" -eq 1 ] && exists "${BK}/backups/daily/c.sql.gz"'

fresh
printf 'BACKUP_DAILY_RETAIN=2\n' >> "$ENVF"
make_file "${BK}/backups/daily/a.sql.gz" 2880
make_file "${BK}/backups/daily/b.sql.gz" 1440
run backup.sh
check "reads BACKUP_DAILY_RETAIN from .env: with 2, keeps the newest old dump and the new one" \
  '[ "$STATUS" -eq 0 ] && [ "$(count "${BK}/backups/daily" "*.sql.gz")" -eq 2 ] && exists "${BK}/backups/daily/b.sql.gz" && ! exists "${BK}/backups/daily/a.sql.gz"'

fresh
printf 'BACKUP_DAILY_RETAIN=0\n' >> "$ENVF"
make_file "${BK}/backups/daily/a.sql.gz" 2880
make_file "${BK}/backups/daily/b.sql.gz" 1440
run backup.sh
check "an invalid retention (0) fails loudly and deletes nothing" \
  '[ "$STATUS" -ne 0 ] && grep -q "below the minimum" <<< "$OUT" && [ "$(count "${BK}/backups/daily" "*.sql.gz")" -eq 2 ]'

fresh
make_file "${BK}/backups/daily/x.sql.gz.partial" 60
run backup.sh
check "removes a .partial left by an interrupted run" '[ "$STATUS" -eq 0 ] && ! exists "${BK}/backups/daily/x.sql.gz.partial"'

# ── pre-deploy-backup.sh ────────────────────────────────────────────

echo "pre-deploy-backup.sh"

fresh
make_file "${BK}/backups/pre_deploy_20260615_204621.dump" 180000 empty
make_file "${BK}/backups/pre_deploy_20261021_152700.dump" 1440 custom
run pre-deploy-backup.sh
check "creates a verified pre-deploy dump and keeps only the newest one" \
  '[ "$STATUS" -eq 0 ] && [ "$(count "${BK}/backups" "pre_deploy_*.dump")" -eq 1 ] && ! exists "${BK}/backups/pre_deploy_20261021_152700.dump" && grep -q "Backup created" <<< "$OUT"'
check "uses the custom format (-Fc) that restore.sh restores with pg_restore" \
  'grep -q PGDMP "$(find "${BK}/backups" -maxdepth 1 -name "pre_deploy_*.dump")"'

fresh
make_file "${BK}/backups/pre_deploy_prev.dump" 1440 custom
run pre-deploy-backup.sh STUB_PG_RESTORE_EXIT=1
check "a dump pg_restore cannot read fails the step and keeps the previous dump" \
  '[ "$STATUS" -ne 0 ] && exists "${BK}/backups/pre_deploy_prev.dump" && [ "$(count "${BK}/backups" "*.partial")" -eq 0 ] && grep -q "Deploy ABORTED.*verification" <<< "$OUT"'

fresh
make_file "${BK}/backups/pre_deploy_prev.dump" 1440 custom
run pre-deploy-backup.sh STUB_HOST_PG_DUMP=fail
check "a failed pg_dump fails the step (migrations must not run) and keeps the previous dump" \
  '[ "$STATUS" -ne 0 ] && exists "${BK}/backups/pre_deploy_prev.dump" && grep -q "Migrations were not run" <<< "$OUT"'

fresh
run pre-deploy-backup.sh STUB_HOST_PG_DUMP=missing STUB_DOCKER=missing
check "no working pg_dump anywhere fails the step instead of skipping the backup" \
  '[ "$STATUS" -ne 0 ] && grep -q "no working pg_dump" <<< "$OUT"'

fresh
run pre-deploy-backup.sh STUB_HOST_PG_DUMP=missing STUB_DOCKER=ok BACKUP_CONTAINER_NAME=armouredsouls-db-prod
check "falls back to the container when the host has no working pg_dump" \
  '[ "$STATUS" -eq 0 ] && grep -q "via docker pg_dump" <<< "$OUT"'

# ── preflight.sh ────────────────────────────────────────────────────

echo "preflight.sh"

fresh
make_file "${BK}/backups/daily/a.sql.gz" 4320
make_file "${BK}/backups/daily/b.sql.gz" 1440
make_file "${BK}/backups/pre_deploy_1.dump" 2880 custom
make_file "${BK}/backups/pre_deploy_2.dump" 1440 custom
make_file "${BK}/backups/pre_deploy_3.dump.partial" 30 custom
run preflight.sh
check "trims to the shared retention (1 daily, 1 pre-deploy) and removes partial dumps" \
  '[ "$STATUS" -eq 0 ] && exists "${BK}/backups/daily/b.sql.gz" && ! exists "${BK}/backups/daily/a.sql.gz" && exists "${BK}/backups/pre_deploy_2.dump" && [ "$(count "${BK}/backups" "pre_deploy_*")" -eq 1 ]'

fresh
run preflight.sh DF_PCENT=92
check "still aborts the deploy when the disk stays at or above the hard limit" '[ "$STATUS" -ne 0 ] && grep -q "Deploy ABORTED" <<< "$OUT"'

# ── Shared helpers ──────────────────────────────────────────────────

echo "shared helpers"

for s in backup.sh pre-deploy-backup.sh preflight.sh; do
  if grep -q '^\. "\${SCRIPT_DIR}/backup-common.sh"' "${SCRIPTS}/${s}" \
     && ! grep -qE '^(env_get|send_alert|json_escape)\(\)' "${SCRIPTS}/${s}"; then
    pass "${s} uses backup-common.sh instead of its own copies of the helpers"
  else
    fail "${s} uses backup-common.sh instead of its own copies of the helpers"
  fi
done

echo ""
echo "  ${PASS} passed, ${FAIL} failed"
[ "$FAIL" -eq 0 ]
