#!/usr/bin/env bash
set -euo pipefail

TARGET_ENV="${1:-}"
APP_NAME="armouredsouls-backend"
APP_ROOT="/opt/armouredsouls"
ECOSYSTEM_FILE="ecosystem.config.js"

if [[ "$TARGET_ENV" != "acceptance" && "$TARGET_ENV" != "production" ]]; then
  echo "Usage: $0 <acceptance|production>" >&2
  exit 2
fi

cd "$APP_ROOT"

PM2_PID="$(pm2 pid "$APP_NAME" 2>/dev/null || true)"
if [[ "$PM2_PID" =~ ^[1-9][0-9]*$ ]] && kill -0 "$PM2_PID" 2>/dev/null; then
  echo "Reloading $APP_NAME (PID $PM2_PID) in $TARGET_ENV"
  NODE_ENV="$TARGET_ENV" pm2 reload "$ECOSYSTEM_FILE" --env "$TARGET_ENV" --update-env
else
  echo "PM2 has no live $APP_NAME process (recorded PID: ${PM2_PID:-none}); rebuilding its process entry"
  pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
  NODE_ENV="$TARGET_ENV" pm2 start "$ECOSYSTEM_FILE" --env "$TARGET_ENV" --update-env
fi

# Persist the reconciled process list so a PM2 daemon or host restart restores
# the backend instead of leaving Caddy with no upstream process.
pm2 save
