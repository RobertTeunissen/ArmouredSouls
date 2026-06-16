# Armoured Souls — Troubleshooting Guide

**Last Updated**: April 9, 2026  
**Status**: ✅ Current

Common issues and fixes for the VPS deployment.

---

## Common Deployment Failures

### Pipeline fails at "Install production dependencies"

**Symptom**: `pnpm install --frozen-lockfile --prod` fails on the VPS.

**Fix**: SSH into the VPS and check:

```bash
node --version   # Should be v24.x
pnpm --version
ls -la /opt/armouredsouls/backend/pnpm-lock.yaml  # Must exist
```

If `node` isn't found, reload nvm: `source ~/.bashrc`

### Pipeline hangs at "Install dependencies on VPS" (and the public site goes down)

**Symptom**: The "Install dependencies on VPS" step in the deploy job stays at `*` (running) for several minutes — typically the step completes in ~30–60 s when healthy. Eventually it hits the 10-min `command_timeout` and the job fails. While it's hung, the public site starts returning **502 from Caddy** and PM2 shows the backend in a `waiting restart` loop with a high restart counter.

**Why this happens.** The install step uses `pnpm install --frozen-lockfile --prod`. If the install hangs or is killed mid-execution (process killed by OOM, runner timeout, network glitch, manual cancel), `node_modules/` is left empty or partially populated. The running PM2 process then can't `require()` its dependencies on the next restart and crash-loops.

**Recovery (5 min):**

1. SSH to the VPS:

   ```bash
   ssh deploy@<VPS_IP>
   ```

2. Confirm the diagnosis:

   ```bash
   pm2 status   # Look for restarts > 0 and "waiting restart" status
   ls /opt/armouredsouls/backend/node_modules/.bin/tsx   # If missing, this is the bug
   ```

3. Manually re-run the install the workflow would have run:

   ```bash
   cd /opt/armouredsouls/backend
   NODE_ENV=production pnpm install --frozen-lockfile --prod
   pnpm exec prisma generate
   pm2 restart armouredsouls-backend
   sleep 5
   pm2 status
   curl -sI https://acc.armouredsouls.com/api/health
   ```

4. Health check should return 200. PM2 status should show `online` and `↺ 0` (or whatever it was before, no new restarts).

**Why the manual run usually completes when the CI run hung.** Three factors compound in CI:

- `appleboy/ssh-action` (drone-ssh) can buffer-stall on long-running commands with verbose stdout (lots of postinstall logs).
- The deploy job opens many SSH sessions back-to-back, sometimes tripping `MaxStartups` on the VPS sshd.
- The 2 GB RAM box can be under load from concurrent league/cycle processing during the deploy window.

A direct interactive SSH session has none of these issues.

**Note on the deploy state after recovery.** If the install hung, the workflow never reached migrate / seed / restart. The recovered backend is running the **previous** code, not the new code from the failing deploy. To actually land the new code, retry the deploy from GitHub Actions once the VPS is verified healthy. If retry hangs again at the same step, do not keep retrying — investigate before more attempts (see also: VPS load, `MaxStartups`, sshd `MaxSessions` settings).

### Pipeline fails at "Transfer artifacts via rsync"

**Symptom**: rsync connection refused or permission denied.

**Fix**:
- Verify the SSH key in GitHub secrets matches the deploy user's `authorized_keys`
- Verify the VPS IP in GitHub secrets is correct
- Check UFW allows port 22: `sudo ufw status`

### Pipeline fails at "Run database migrations"

**Symptom**: `prisma migrate deploy` fails.

**Fix**: SSH in and check:

```bash
# Is PostgreSQL running?
docker ps | grep armouredsouls-db

# Can Prisma connect?
cd /opt/armouredsouls/backend
pnpm exec prisma migrate status

# Check the DATABASE_URL in .env
grep DATABASE_URL .env
```

---

## Database Connection Issues

### Backend can't connect to PostgreSQL

```bash
# Check Docker container is running and healthy
docker ps
docker logs armouredsouls-db-prod --tail 20

# Test connection manually
docker exec armouredsouls-db-prod pg_isready -U as_prd

# Restart PostgreSQL if needed
cd /opt/armouredsouls
docker compose -f docker-compose.production.yml restart
```

### Too many connections

```bash
# Check active connections
docker exec armouredsouls-db-prod psql -U as_prd -d armouredsouls_prd -c \
  "SELECT count(*) FROM pg_stat_activity;"

# Kill idle connections if needed
docker exec armouredsouls-db-prod psql -U as_prd -d armouredsouls_prd -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND pid <> pg_backend_pid();"
```

If this happens frequently, check for connection leaks in the application or increase `max_connections` in `docker-compose.production.yml`.

---

## SSL Certificate Issues

Caddy handles SSL automatically. Issues are rare but can happen if:

### DNS not pointing to VPS

Caddy can't provision a certificate if the domain doesn't resolve to the VPS IP.

```bash
dig +short YOUR_DOMAIN
# Should return your VPS IP
```

### Caddy can't bind to port 80/443

```bash
sudo systemctl status caddy
sudo journalctl -u caddy --since "10 minutes ago"

# Check nothing else is using the ports
sudo lsof -i :80
sudo lsof -i :443
```

### Force certificate renewal

```bash
sudo caddy reload --config /etc/caddy/Caddyfile
```

---

## Process Crash Recovery

PM2 automatically restarts crashed processes (up to 10 restarts per 60 seconds).

### Check crash status

```bash
pm2 status
# Look for "errored" or high restart count

pm2 logs armouredsouls-backend --err --lines 50
```

### Manual restart

```bash
pm2 restart armouredsouls-backend
```

### If PM2 itself is down

```bash
pm2 resurrect   # Restore saved process list
# or
cd /opt/armouredsouls
pm2 start ecosystem.config.js
pm2 save
```

### After a VPS reboot

PM2 should auto-start if `pm2 startup` was configured. If not:

```bash
pm2 startup
# Run the printed command
pm2 start ecosystem.config.js
pm2 save
```

---

## Rollback Procedure

If a deployment breaks the application:

### 1. Stop the backend

```bash
pm2 stop armouredsouls-backend
```

### 2. Restore previous code

The CI/CD pipeline doesn't use symlinks — it rsyncs directly. To roll back, re-run the previous successful deployment from GitHub Actions, or manually restore from git:

```bash
cd /opt/armouredsouls/backend
git checkout PREVIOUS_COMMIT_SHA -- .
pnpm install --frozen-lockfile --prod
pnpm run build
```

### 3. Restore database (if migration caused issues)

```bash
# List available backups (pre-deploy backups are created automatically)
ls -lht /opt/armouredsouls/backups/

# Restore from the pre-deploy backup
/opt/armouredsouls/scripts/restore.sh /opt/armouredsouls/backups/pre_deploy_TIMESTAMP.dump
```

The restore script will:
- Stop the backend
- Drop and recreate the database
- Restore from the backup
- Run `prisma migrate deploy`
- Restart the backend

### 4. Restart

```bash
pm2 start armouredsouls-backend
```

### 5. Verify

```bash
curl http://localhost:3001/api/health
```

---

## Health Check Failures

### `/api/health` returns 503

The health endpoint returns 503 when the database is unreachable.

```bash
# Check database
docker ps | grep armouredsouls-db
docker exec armouredsouls-db-prod pg_isready -U as_prd

# Check backend logs
pm2 logs armouredsouls-backend --lines 20
```

### `/api/health` times out

```bash
# Is the backend process running?
pm2 status

# Is it listening on the right port?
curl http://127.0.0.1:3001/api/health

# Is Caddy proxying correctly?
sudo journalctl -u caddy --since "5 minutes ago"
```

---

## Rate Limiting Issues

The API has two rate limiters:
- **General**: 100 requests/minute per IP on `/api/*`
- **Auth**: 10 requests/minute per IP on `/api/auth/login` and `/api/auth/register`

### Getting 429 Too Many Requests

This is working as intended. The response includes a `Retry-After` header indicating when to retry.

If legitimate traffic is being rate-limited, adjust the limits in `app/backend/src/middleware/rateLimiter.ts` and redeploy.

### Rate limiter not working behind Caddy

The backend uses `X-Forwarded-For` for IP detection, and `trust proxy` is enabled. Caddy sets this header automatically. If rate limiting isn't working per-IP:

```bash
# Verify trust proxy is set
grep -r "trust proxy" /opt/armouredsouls/backend/dist/
```
