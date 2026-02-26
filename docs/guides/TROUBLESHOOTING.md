# Armoured Souls — Troubleshooting Guide

Common issues and fixes for the VPS deployment.

---

## Common Deployment Failures

### Pipeline fails at "Install production dependencies"

**Symptom**: `npm ci --production` fails on the VPS.

**Fix**: SSH into the VPS and check:

```bash
node --version   # Should be v18.x
npm --version
ls -la /opt/armouredsouls/backend/package-lock.json  # Must exist
```

If `node` isn't found, reload nvm: `source ~/.bashrc`

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
npx prisma migrate status

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
npm ci --production
npm run build
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

If legitimate traffic is being rate-limited, adjust the limits in `prototype/backend/src/middleware/rateLimiter.ts` and redeploy.

### Rate limiter not working behind Caddy

The backend uses `X-Forwarded-For` for IP detection, and `trust proxy` is enabled. Caddy sets this header automatically. If rate limiting isn't working per-IP:

```bash
# Verify trust proxy is set
grep -r "trust proxy" /opt/armouredsouls/backend/dist/
```
