#!/usr/bin/env bash
# ============================================================================
# Armoured Souls — ecosystem.config.js DEPLOY_TAG test
#
# PM2 6 only hands an app the env keys its ecosystem file declares, so the
# deploy tag must be declared there for every environment. Evaluates the file
# with and without DEPLOY_TAG, as `pm2 reload ecosystem.config.js` does.
# (Checked against PM2 6.0.14 on 3 Nov 2026: without this, a reload kept the
# previous tag and ACC recorded none.)
#
# Usage: bash app/scripts/__tests__/ecosystem-deploy-tag.test.sh
# ============================================================================
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG="${SCRIPT_DIR}/../../ecosystem.config.js"
PASS=0
FAIL=0
pass() { PASS=$((PASS + 1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  ✗ $1"; }

# tags <env var assignment or empty>: prints "env|env_acceptance|env_production" tags.
tags() {
  env -u DEPLOY_TAG $1 node -e '
    const app = require(process.argv[1]).apps[0];
    const tag = (e) => (Object.prototype.hasOwnProperty.call(e, "DEPLOY_TAG") ? e.DEPLOY_TAG : "<absent>");
    console.log([app.env, app.env_acceptance, app.env_production].map(tag).join("|"));
  ' "$CONFIG"
}

echo "ecosystem.config.js DEPLOY_TAG"

got="$(tags DEPLOY_TAG=deploy-acc-20261103-183606)"
[[ "$got" == "deploy-acc-20261103-183606|deploy-acc-20261103-183606|deploy-acc-20261103-183606" ]] \
  && pass "declares the deploy tag in every environment" || fail "with a tag: got $got"

got="$(tags "")"
[[ "$got" == "<absent>|<absent>|<absent>" ]] \
  && pass "leaves the key out without a tag (no \"undefined\")" || fail "without a tag: got $got"

got="$(env -u DEPLOY_TAG node -e 'const a = require(process.argv[1]).apps[0]; console.log(a.env_acceptance.NODE_ENV, a.env_production.NODE_ENV)' "$CONFIG")"
[[ "$got" == "acceptance production" ]] && pass "keeps NODE_ENV per environment" || fail "NODE_ENV: got $got"

echo "${PASS} passed, ${FAIL} failed"
[[ $FAIL -eq 0 ]]
