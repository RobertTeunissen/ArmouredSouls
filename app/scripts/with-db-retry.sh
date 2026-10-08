#!/usr/bin/env bash
set -euo pipefail
# ============================================================================
# Armoured Souls — retry a deploy-time database command on connection exhaustion
#
# Usage: bash with-db-retry.sh <command> [args...]
#   e.g. bash /opt/armouredsouls/scripts/with-db-retry.sh pnpm exec prisma db seed
#
# Why this exists:
# Deploy migrations and seeding run while the live backend is still serving
# players. Postgres on ACC/PRD allows `max_connections=20`. If the backend's
# pool is busy, a deploy-time client can be refused with "too many clients
# already" (Prisma P2037). That failed the 2026-10-07 ACC deploy at the seed
# step. The backend pool now leaves headroom (DB_POOL_MAX default 15, see
# src/lib/prisma.ts), but that only applies once the new backend is running,
# and a burst of traffic can still use it up.
#
# Behaviour:
# - Runs the command and streams its output.
# - Retries only when the output shows connection exhaustion. Any other
#   failure (bad migration, seed bug) exits immediately with the command's
#   status so real errors are never masked.
# - Migrations (`prisma migrate deploy`) and the seed are idempotent, so a
#   retry is safe.
#
# Tunables:
# - DB_RETRY_ATTEMPTS       (default 6)
# - DB_RETRY_DELAY_SECONDS  (default 20; the backend pool's idle timeout is
#                            30s, so a few waits let idle connections close)
# ============================================================================

if [ "$#" -eq 0 ]; then
  echo "usage: with-db-retry.sh <command> [args...]" >&2
  exit 2
fi

ATTEMPTS="${DB_RETRY_ATTEMPTS:-6}"
DELAY="${DB_RETRY_DELAY_SECONDS:-20}"
EXHAUSTION_PATTERN='too many clients|TooManyConnections|P2037|remaining connection slots are reserved'

output_file="$(mktemp)"
trap 'rm -f "$output_file"' EXIT

attempt=1
while :; do
  set +e
  "$@" 2>&1 | tee "$output_file"
  status=${PIPESTATUS[0]}
  set -e

  if [ "$status" -eq 0 ]; then
    exit 0
  fi

  if ! grep -qE "$EXHAUSTION_PATTERN" "$output_file"; then
    echo "with-db-retry: command failed (exit $status) for a reason other than connection exhaustion; not retrying." >&2
    exit "$status"
  fi

  if [ "$attempt" -ge "$ATTEMPTS" ]; then
    echo "with-db-retry: database connections still exhausted after $ATTEMPTS attempts; giving up." >&2
    exit "$status"
  fi

  echo "with-db-retry: database connections exhausted (attempt $attempt/$ATTEMPTS); retrying in ${DELAY}s..." >&2
  sleep "$DELAY"
  attempt=$((attempt + 1))
done
