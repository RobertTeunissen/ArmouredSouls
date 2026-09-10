#!/usr/bin/env bash
set -euo pipefail

EXPECTED_ENV="${1:-}"
HEALTH_URL="${2:-http://localhost:3001/api/health}"
TIMEOUT_SECONDS="${HEALTH_CHECK_TIMEOUT_SECONDS:-30}"

if [[ "$EXPECTED_ENV" != "acceptance" && "$EXPECTED_ENV" != "production" ]]; then
  echo "Usage: $0 <acceptance|production> [health-url]" >&2
  exit 2
fi

if ! [[ "$TIMEOUT_SECONDS" =~ ^[1-9][0-9]*$ ]]; then
  echo "HEALTH_CHECK_TIMEOUT_SECONDS must be a positive integer" >&2
  exit 2
fi

STARTED_AT=$(date +%s)
DEADLINE=$((STARTED_AT + TIMEOUT_SECONDS))
ATTEMPT=0
HEALTH_RESPONSE=""
LAST_ERROR="No probe completed"

while (( $(date +%s) < DEADLINE )); do
  ATTEMPT=$((ATTEMPT + 1))
  NOW=$(date +%s)
  REMAINING=$((DEADLINE - NOW))
  PROBE_TIMEOUT=4
  if (( REMAINING < PROBE_TIMEOUT )); then
    PROBE_TIMEOUT=$REMAINING
  fi
  if (( PROBE_TIMEOUT < 1 )); then
    break
  fi

  set +e
  RESPONSE=$(curl --silent --show-error --fail-with-body \
    --connect-timeout 1 \
    --max-time "$PROBE_TIMEOUT" \
    "$HEALTH_URL" 2>&1)
  CURL_STATUS=$?
  set -e

  if (( CURL_STATUS == 0 )); then
    HEALTH_RESPONSE="$RESPONSE"
    break
  fi

  LAST_ERROR="curl exit ${CURL_STATUS}: ${RESPONSE}"
  NOW=$(date +%s)
  REMAINING=$((DEADLINE - NOW))
  if (( REMAINING <= 0 )); then
    break
  fi
  SLEEP_SECONDS=2
  if (( REMAINING < SLEEP_SECONDS )); then
    SLEEP_SECONDS=$REMAINING
  fi
  sleep "$SLEEP_SECONDS"
done

if [[ -z "$HEALTH_RESPONSE" ]]; then
  ELAPSED=$(( $(date +%s) - STARTED_AT ))
  echo "Health check failed after ${ELAPSED}s (${ATTEMPT} bounded attempts)" >&2
  echo "Last probe: ${LAST_ERROR}" >&2
  exit 1
fi

HEALTH_JSON="$HEALTH_RESPONSE" EXPECTED_ENV="$EXPECTED_ENV" node <<'NODE'
const raw = process.env.HEALTH_JSON ?? '';
const expectedEnvironment = process.env.EXPECTED_ENV;

let health;
try {
  health = JSON.parse(raw);
} catch (error) {
  console.error(`DEPLOY BLOCKED: Health response is not valid JSON: ${String(error)}`);
  process.exit(1);
}

const failures = [];
if (health.status !== 'ok') failures.push(`status=${String(health.status)}`);
if (health.database !== 'connected') failures.push(`database=${String(health.database)}`);
if (health.disk?.status === 'critical') failures.push('disk=critical');
if (health.modules?.status !== 'ok') {
  failures.push(`modules=${String(health.modules?.status)} missing=${JSON.stringify(health.modules?.missing ?? [])}`);
}
if (health.environment !== expectedEnvironment) {
  failures.push(`environment=${String(health.environment)} expected=${expectedEnvironment}`);
}

if (failures.length > 0) {
  console.error(`DEPLOY BLOCKED: ${failures.join('; ')}`);
  process.exit(1);
}

console.log(
  `Deployment health check passed ` +
  `(environment: ${health.environment}, disk: ${health.disk.status}, modules: ${health.modules.status})`,
);
NODE
