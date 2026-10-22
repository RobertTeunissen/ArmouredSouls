# shellcheck shell=bash
# ============================================================================
# Armoured Souls — shared backup helpers
#
# Sourced (never executed) by backup.sh, pre-deploy-backup.sh and preflight.sh,
# so the three agree on settings, database access and retention. Callers run
# under `set -euo pipefail` and define `log` before calling `send_alert`.
#
# Retention model (MAINTENANCE.md, "Backups"):
#   - BACKUP_DAILY_RETAIN daily dumps (default 1) and BACKUP_PRE_DEPLOY_RETAIN
#     pre-migration dumps (default 1).
#   - An old dump is deleted only after its replacement is complete and
#     verified, so a failed dump never leaves the host with fewer backups.
#   - A dump is written as `<name>.partial` and renamed when done, so a
#     half-written file is never counted (or kept) as a backup.
# ============================================================================

BACKUP_DIR="${BACKUP_DIR:-/opt/armouredsouls/backups}"
BACKUP_ENV_FILE="${BACKUP_ENV_FILE:-/opt/armouredsouls/backend/.env}"

# Read one key from the .env file as plain text. Never `source .env`: bash
# evaluates unquoted values as commands (`LEAGUE_SCHEDULE=0 20 * * *` runs
# `20`). `|| true` matters: a missing key makes grep exit 1, and under
# `set -euo pipefail` that would abort the calling script.
env_get() {
  local key="$1"
  local file="$2"
  [ -f "$file" ] || return 0
  grep -E "^${key}=" "$file" | tail -n 1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/; s/^'\''(.*)'\''$/\1/' || true
}

# setting KEY DEFAULT — the process environment, then the .env file, then DEFAULT.
# Cron starts with an almost empty environment, so .env is where hosts set these.
setting() {
  local key="$1"
  local default="$2"
  local value="${!key:-}"
  if [ -z "$value" ]; then
    value="$(env_get "$key" "$BACKUP_ENV_FILE")"
  fi
  printf '%s' "${value:-$default}"
}

# retain_setting KEY DEFAULT MIN — a whole-number retention setting of at least
# MIN. An invalid value fails loudly instead of deleting the wrong backups.
retain_setting() {
  local key="$1"
  local default="$2"
  local min="$3"
  local value
  value="$(setting "$key" "$default")"
  case "$value" in
    ''|*[!0-9]*)
      echo "ERROR: ${key}=${value} is not a whole number" >&2
      return 1
      ;;
  esac
  if [ "$value" -lt "$min" ]; then
    echo "ERROR: ${key}=${value} is below the minimum of ${min}" >&2
    return 1
  fi
  printf '%s' "$value"
}

DAILY_RETAIN="$(retain_setting BACKUP_DAILY_RETAIN 1 1)"
PRE_DEPLOY_RETAIN="$(retain_setting BACKUP_PRE_DEPLOY_RETAIN 1 1)"
WEEKLY_RETAIN="$(retain_setting BACKUP_WEEKLY_RETAIN 0 0)"
CONTAINER_NAME="$(setting BACKUP_CONTAINER_NAME armouredsouls-db-prod)"
# No fallback to DISCORD_WEBHOOK_URL: that is the player-facing game channel.
MONITORING_DISCORD_WEBHOOK="$(setting MONITORING_DISCORD_WEBHOOK '')"

# --- Discord alerts ------------------------------------------------------------

# Escape a string for use inside a JSON string literal. A raw newline, quote
# or backslash makes the payload invalid JSON, which Discord rejects with
# HTTP 400 — silently, since curl's output is discarded.
# Same implementation as disk-monitor.sh (standalone; it does not source this file).
json_escape() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  s="${s//$'\r'/\\r}"
  s="${s//$'\t'/\\t}"
  printf '%s' "$s"
}

# Best effort: an unreachable webhook never changes the caller's exit status.
send_alert() {
  local message="$1"
  local webhook="${MONITORING_DISCORD_WEBHOOK:-}"
  if [ -n "$webhook" ]; then
    curl -s -H "Content-Type: application/json" \
      -d "{\"content\": \"$(json_escape "$message")\"}" \
      "$webhook" > /dev/null 2>&1 || true
  fi
  log "$message"
}

# --- Database connection -----------------------------------------------------

# Sets DB_USER, DB_NAME, DB_HOST, DB_PORT and DB_PASS from POSTGRES_* (env or
# .env), falling back to parsing DATABASE_URL
# (postgresql://user[:password]@host[:port]/dbname?params).
resolve_db_connection() {
  DB_USER="$(setting POSTGRES_USER '')"
  DB_NAME="$(setting POSTGRES_DB '')"
  DB_HOST="$(setting POSTGRES_HOST '')"
  DB_PORT="$(setting POSTGRES_PORT '')"
  DB_PASS="$(setting POSTGRES_PASSWORD '')"

  if [ -z "$DB_USER" ] || [ -z "$DB_NAME" ]; then
    local url
    url="$(setting DATABASE_URL '')"
    if [ -n "$url" ]; then
      local without_proto="${url#*://}"
      local without_params="${without_proto%%\?*}"
      local userinfo="${without_params%%@*}"
      local hostinfo="${without_params#*@}"
      local hostport="${hostinfo%%/*}"
      local parsed_pass=""
      if [[ "$userinfo" == *":"* ]]; then
        parsed_pass="${userinfo#*:}"
      fi
      local parsed_host="${hostport%%:*}"
      local parsed_port="${hostport#*:}"
      if [ "$parsed_port" = "$parsed_host" ]; then
        parsed_port="5432"
      fi
      DB_USER="${DB_USER:-${userinfo%%:*}}"
      DB_NAME="${DB_NAME:-${hostinfo#*/}}"
      DB_HOST="${DB_HOST:-$parsed_host}"
      DB_PORT="${DB_PORT:-$parsed_port}"
      DB_PASS="${DB_PASS:-$parsed_pass}"
    fi
  fi

  DB_USER="${DB_USER:-armouredsouls}"
  DB_NAME="${DB_NAME:-armouredsouls}"
  DB_HOST="${DB_HOST:-127.0.0.1}"
  DB_PORT="${DB_PORT:-5432}"
}

# Sets DUMP_VIA to `host` or `docker`; returns 1 when neither can run pg_dump.
# Host first: some hosts have a pg_dump wrapper that `command -v` finds but that
# fails to run without a matching postgresql-client package, so test it.
select_dump_method() {
  if pg_dump --version > /dev/null 2>&1; then
    DUMP_VIA=host
  elif docker exec "${CONTAINER_NAME}" pg_dump --version > /dev/null 2>&1; then
    DUMP_VIA=docker
  else
    return 1
  fi
}

# dump_database [pg_dump options...] — writes the dump to stdout.
dump_database() {
  if [ "${DUMP_VIA}" = docker ]; then
    docker exec "${CONTAINER_NAME}" pg_dump -U "${DB_USER}" "$@" "${DB_NAME}"
  else
    PGPASSWORD="${DB_PASS}" pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" "$@" "${DB_NAME}"
  fi
}

# list_custom_dump FILE — succeeds when pg_restore can read the archive's table
# of contents, i.e. the custom-format dump is complete.
list_custom_dump() {
  if [ "${DUMP_VIA}" = docker ]; then
    docker exec -i "${CONTAINER_NAME}" pg_restore --list < "$1" > /dev/null
  else
    pg_restore --list "$1" > /dev/null
  fi
}

# --- Retention ---------------------------------------------------------------

# prune_backups DIR RETAIN PATTERN... — delete all but the RETAIN newest files
# (by modification time) directly in DIR that match any PATTERN, and log each
# deletion. `*.partial` files never match `*.dump` / `*.sql.gz`.
prune_backups() {
  local dir="$1"
  local retain="$2"
  shift 2
  [ -d "$dir" ] || return 0
  local victim
  while IFS= read -r victim; do
    [ -n "$victim" ] || continue
    rm -f -- "${dir}/${victim}"
    log "Removed old backup: ${dir}/${victim} (keeping the newest ${retain})"
  done < <(
    cd "$dir" || exit 0
    shopt -s nullglob
    files=()
    for pattern in "$@"; do
      # Unquoted on purpose: the pattern is a glob to expand in DIR.
      # shellcheck disable=SC2206
      files+=($pattern)
    done
    [ "${#files[@]}" -gt "$retain" ] || exit 0
    ls -1t -- "${files[@]}" | tail -n +"$((retain + 1))"
  )
}

# Removes `*.partial` leftovers of a dump that was interrupted (crash, reboot).
remove_partial_dumps() {
  local dir="$1"
  [ -d "$dir" ] || return 0
  find "$dir" -maxdepth 1 -type f -name '*.partial' -exec rm -f {} + 2>/dev/null || true
}
