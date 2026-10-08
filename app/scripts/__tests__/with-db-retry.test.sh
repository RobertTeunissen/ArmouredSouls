#!/usr/bin/env bash
# ============================================================================
# Armoured Souls — with-db-retry.sh test harness
#
# Drives the wrapper with a fake command whose behaviour is scripted per call
# through a counter file, so no database is involved. Delay is set to 0.
#
# Usage: bash app/scripts/__tests__/with-db-retry.test.sh
# ============================================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WRAPPER="${SCRIPT_DIR}/../with-db-retry.sh"

PASS=0
FAIL=0
WORKROOT="$(mktemp -d)"
trap 'rm -rf "$WORKROOT"' EXIT

pass() { PASS=$((PASS + 1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  ✗ $1"; }

# fake_command <script-of-outcomes>: each line is "ok", "exhausted" or "broken";
# call N uses line N (the last line repeats).
make_fake() {
  local outcomes="$1"
  local dir="$WORKROOT/$RANDOM$RANDOM"
  mkdir -p "$dir"
  printf '%s\n' "$outcomes" > "$dir/outcomes"
  echo 0 > "$dir/calls"
  cat > "$dir/fake" <<'FAKE'
#!/usr/bin/env bash
dir="$(dirname "$0")"
n=$(( $(cat "$dir/calls") + 1 ))
echo "$n" > "$dir/calls"
total=$(wc -l < "$dir/outcomes")
line=$(( n > total ? total : n ))
outcome=$(sed -n "${line}p" "$dir/outcomes")
case "$outcome" in
  ok) echo "seed complete"; exit 0 ;;
  exhausted) echo "Too many database connections opened: sorry, too many clients already" >&2; echo "code: 'P2037'"; exit 1 ;;
  broken) echo "Error: relation \"weapons\" does not exist" >&2; exit 3 ;;
esac
FAKE
  chmod +x "$dir/fake"
  echo "$dir"
}

run() {
  DB_RETRY_DELAY_SECONDS=0 DB_RETRY_ATTEMPTS="${ATTEMPTS:-6}" bash "$WRAPPER" "$1/fake" > "$1/out" 2>&1
}

echo "with-db-retry.sh"

d=$(make_fake "ok")
run "$d"; status=$?
if [ "$status" -eq 0 ] && [ "$(cat "$d/calls")" -eq 1 ]; then pass "succeeds first time without retrying"; else fail "first-time success (status=$status calls=$(cat "$d/calls"))"; fi

d=$(make_fake $'exhausted\nexhausted\nok')
run "$d"; status=$?
if [ "$status" -eq 0 ] && [ "$(cat "$d/calls")" -eq 3 ] && grep -q "attempt 2/6" "$d/out"; then pass "retries connection exhaustion until it succeeds"; else fail "retry until success (status=$status calls=$(cat "$d/calls"))"; fi

d=$(make_fake "broken")
run "$d"; status=$?
if [ "$status" -eq 3 ] && [ "$(cat "$d/calls")" -eq 1 ] && grep -q "not retrying" "$d/out"; then pass "does not retry other failures and keeps their exit code"; else fail "non-exhaustion failure (status=$status calls=$(cat "$d/calls"))"; fi

d=$(make_fake "exhausted")
ATTEMPTS=3 run "$d"; status=$?
if [ "$status" -eq 1 ] && [ "$(cat "$d/calls")" -eq 3 ] && grep -q "giving up" "$d/out"; then pass "gives up after the configured attempts with the command's status"; else fail "attempt limit (status=$status calls=$(cat "$d/calls"))"; fi

d=$(make_fake $'exhausted\nbroken')
run "$d"; status=$?
if [ "$status" -eq 3 ] && [ "$(cat "$d/calls")" -eq 2 ]; then pass "stops when a retry fails for a different reason"; else fail "exhaustion then real error (status=$status calls=$(cat "$d/calls"))"; fi

bash "$WRAPPER" > /dev/null 2>&1; status=$?
if [ "$status" -eq 2 ]; then pass "rejects a missing command with usage exit 2"; else fail "usage error (status=$status)"; fi

echo
echo "$PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
