# Armoured Souls — Maintenance Guide

Routine maintenance tasks for keeping the VPS healthy.

---

## Log Inspection

### PM2 Logs

```bash
# Live tail
pm2 logs armouredsouls-backend

# Last 100 lines
pm2 logs armouredsouls-backend --lines 100

# Error log only
tail -f /var/log/armouredsouls/backend-error.log
```

### Backup Logs

```bash
tail -50 /var/log/armouredsouls/backup.log
```

### Caddy Logs

```bash
sudo journalctl -u caddy --since "1 hour ago"
sudo journalctl -u caddy -f   # live tail
```

### Docker / PostgreSQL Logs

```bash
docker logs armouredsouls-db-prod --tail 50
docker logs armouredsouls-db-prod -f   # live tail
```

---

## Backup Verification

Backups run daily at 2:00 AM via cron. Check that they're being created:

```bash
# List recent daily backups
ls -lht /opt/armouredsouls/backups/daily/ | head -10

# List weekly backups
ls -lht /opt/armouredsouls/backups/weekly/

# Check backup log for errors
grep -i error /var/log/armouredsouls/backup.log | tail -10
```

Retention policy: 7 daily + 4 weekly backups. Older files are automatically cleaned up.

### Test a Backup (Non-Destructive)

To verify a backup is valid without restoring it to the live database:

```bash
# Check the file isn't empty / corrupted
gunzip -t /opt/armouredsouls/backups/daily/LATEST_BACKUP.sql.gz
# No output = file is valid
```

---

## SSL Certificate Status

Caddy handles SSL certificates automatically via Let's Encrypt. Certificates renew ~30 days before expiry.

To verify:

```bash
# Check certificate expiry
echo | openssl s_client -connect YOUR_DOMAIN:443 -servername YOUR_DOMAIN 2>/dev/null | openssl x509 -noout -dates

# Check Caddy status
sudo systemctl status caddy
```

If Caddy is running and your domain resolves correctly, SSL is handled. No manual renewal needed.

---

## Database Maintenance

### Connection Monitoring

```bash
# Check active connections
docker exec armouredsouls-db-prod psql -U as_prd -d armouredsouls_prd -c \
  "SELECT count(*) as active_connections FROM pg_stat_activity WHERE state = 'active';"

# Check max connections setting
docker exec armouredsouls-db-prod psql -U as_prd -d armouredsouls_prd -c \
  "SHOW max_connections;"
```

The production config sets `max_connections=20`. The Prisma connection string uses `connection_limit=10`, leaving headroom for maintenance connections.

### Vacuum

PostgreSQL runs autovacuum by default. To check its status or run manually:

```bash
# Check autovacuum status
docker exec armouredsouls-db-prod psql -U as_prd -d armouredsouls_prd -c \
  "SELECT relname, last_autovacuum, last_autoanalyze FROM pg_stat_user_tables ORDER BY last_autovacuum DESC NULLS LAST LIMIT 10;"

# Manual vacuum (rarely needed)
docker exec armouredsouls-db-prod psql -U as_prd -d armouredsouls_prd -c "VACUUM ANALYZE;"
```

### Database Size

```bash
docker exec armouredsouls-db-prod psql -U as_prd -d armouredsouls_prd -c \
  "SELECT pg_size_pretty(pg_database_size('armouredsouls_prd'));"
```

---

## Server Resource Monitoring

### Disk Usage

```bash
df -h /                                    # Root filesystem
du -sh /opt/armouredsouls/backups/         # Backup size
du -sh /var/log/armouredsouls/             # Log size
docker system df                           # Docker disk usage
```

DEV1-S has 20 GB SSD. Keep an eye on disk usage — if it exceeds 80%, clean up old logs or backups.

### Memory

```bash
free -h
```

DEV1-S has 2 GB RAM. Typical usage: ~500 MB PostgreSQL + ~200 MB Node.js + ~200 MB system.

### CPU

```bash
top -bn1 | head -20
# or
htop   # if installed: sudo apt install htop
```

---

## PM2 Process Monitoring

```bash
# Process status
pm2 status

# Detailed process info
pm2 describe armouredsouls-backend

# Real-time monitoring dashboard
pm2 monit

# Restart the backend
pm2 restart armouredsouls-backend

# Reload with zero downtime (graceful)
pm2 reload armouredsouls-backend
```

### Log Rotation

PM2 logs rotate at 50 MB (configured in `ecosystem.config.js`). To manually flush:

```bash
pm2 flush
```

### PM2 Auto-Start on Reboot

Verify PM2 is set to start on boot:

```bash
pm2 startup
pm2 save
```
