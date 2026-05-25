#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# Armoured Souls — Disk Diagnostic
#
# Standalone, read-only inspection of where disk space is being used.
# Designed to run on demand from SSH or be triggered by an admin.
#
# Output is one consolidated report covering the usual suspects:
#   - top-level dirs under /opt/armouredsouls
#   - /var/log/* (system + service logs)
#   - PM2 logs (~/.pm2/logs)
#   - Postgres data dir + WAL + Docker volumes
#   - Application-specific dirs we know about (cycle_logs, backups, uploads)
#
# Usage:
#   bash /opt/armouredsouls/scripts/disk-diagnostic.sh
#
# Output goes to stdout. Pipe through `column -t` or `less` if needed.
# Always exits 0; sections that fail (permission denied, no such dir) are
# silently skipped rather than aborting the whole report.
# ============================================================================

print_header() {
  echo
  echo "===== $1 ====="
}

# Top consumers anywhere under a path. Suppresses "permission denied" noise.
top_under() {
  local path="$1"
  local depth="${2:-1}"
  local count="${3:-10}"
  if [ -d "$path" ]; then
    du -h --max-depth="$depth" "$path" 2>/dev/null \
      | sort -hr \
      | head -n "$count"
  else
    echo "  (not found: $path)"
  fi
}

print_header "DISK USAGE OVERVIEW"
df -h / /var /opt 2>/dev/null | awk 'NR==1 || /\// {print}' || df -h /

print_header "TOP /opt/armouredsouls/* (depth 1)"
top_under /opt/armouredsouls 1 15

print_header "TOP /var/log/* (depth 1)"
top_under /var/log 1 15

print_header "PM2 LOGS (~/.pm2/logs)"
top_under "$HOME/.pm2/logs" 1 10

print_header "BACKEND CYCLE LOGS"
if [ -d /opt/armouredsouls/backend/cycle_logs ]; then
  CYCLE_COUNT=$(find /opt/armouredsouls/backend/cycle_logs -maxdepth 1 -name 'cycle*.csv' -type f 2>/dev/null | wc -l)
  CYCLE_SIZE=$(du -sh /opt/armouredsouls/backend/cycle_logs 2>/dev/null | cut -f1)
  echo "  Total: ${CYCLE_SIZE} across ${CYCLE_COUNT} files"
  echo "  Largest 5:"
  ls -lhS /opt/armouredsouls/backend/cycle_logs 2>/dev/null | head -6 | tail -5 | awk '{printf "    %s  %s\n", $5, $NF}'
else
  echo "  (no cycle_logs dir)"
fi

print_header "BACKUPS"
if [ -d /opt/armouredsouls/backups ]; then
  BACKUP_TOTAL=$(du -sh /opt/armouredsouls/backups 2>/dev/null | cut -f1)
  echo "  Total: ${BACKUP_TOTAL}"
  echo "  By category:"
  du -sh /opt/armouredsouls/backups/daily /opt/armouredsouls/backups/weekly 2>/dev/null \
    | awk '{printf "    %s  %s\n", $1, $2}'
  echo "  Pre-deploy dumps:"
  PRE_COUNT=$(find /opt/armouredsouls/backups -maxdepth 1 -name 'pre_deploy_*.dump' -type f 2>/dev/null | wc -l)
  PRE_SIZE=$(du -sh /opt/armouredsouls/backups/pre_deploy_*.dump 2>/dev/null | tail -1 | cut -f1 || echo "0")
  if [ "$PRE_COUNT" -gt 0 ]; then
    PRE_TOTAL=$(du -ch /opt/armouredsouls/backups/pre_deploy_*.dump 2>/dev/null | tail -1 | cut -f1)
    echo "    ${PRE_COUNT} files, total ${PRE_TOTAL}"
  else
    echo "    (none)"
  fi
else
  echo "  (no backups dir)"
fi

print_header "USER UPLOADS"
top_under /opt/armouredsouls/backend/uploads 2 10

print_header "POSTGRES (via Docker volumes if present)"
if command -v docker >/dev/null 2>&1; then
  docker system df 2>/dev/null || echo "  (docker available but `docker system df` failed)"
else
  echo "  (docker not on PATH — Postgres may be running natively)"
fi

print_header "APT CACHE"
if [ -d /var/cache/apt ]; then
  APT_SIZE=$(du -sh /var/cache/apt 2>/dev/null | cut -f1)
  echo "  /var/cache/apt: ${APT_SIZE}"
  echo "  (clean with: sudo apt-get clean)"
fi

print_header "JOURNAL"
if command -v journalctl >/dev/null 2>&1; then
  journalctl --disk-usage 2>/dev/null || echo "  (journalctl --disk-usage failed)"
fi

echo
echo "===== END OF REPORT ====="
exit 0
