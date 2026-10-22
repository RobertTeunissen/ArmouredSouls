# Armoured Souls — Maintenance Guide

**Last Updated**: October 2026  
**Status**: ✅ Current

Routine maintenance tasks for keeping the VPS healthy.

> **See also**: [Monitoring & Alerting Guide](MONITORING.md) for automated alerts, Discord webhook setup, and incident response procedures.

---

## Log Inspection

> **Note**: Critical errors (disk exhaustion, startup failures, backup failures) also trigger Discord alerts automatically. See [MONITORING.md](MONITORING.md) for details.

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

## Backups

Two kinds of database dump live in `/opt/armouredsouls/backups/`:

| Dump | Written by | When | Format | Kept (default) | Setting |
|---|---|---|---|---|---|
| `daily/<db>_daily_<ts>.sql.gz` | `scripts/backup.sh` (cron) | 02:00 server time (UTC) | gzip'd SQL | 1 | `BACKUP_DAILY_RETAIN` |
| `pre_deploy_<ts>.dump` | `scripts/pre-deploy-backup.sh` (deploy step) | every deploy, before migrations | `pg_dump -Fc` | 1 | `BACKUP_PRE_DEPLOY_RETAIN` |
| `weekly/<db>_weekly_<ts>.sql.gz` | `scripts/backup.sh` | Sundays | copy of the daily | 0 (off) | `BACKUP_WEEKLY_RETAIN` |

So a host normally holds two recent restore points: last night's dump and the dump taken just before the last deploy's migrations. Settings are read from the process environment, then `/opt/armouredsouls/backend/.env`, then the default above. `backup.sh`, `pre-deploy-backup.sh` and `preflight.sh` share one implementation (`scripts/backup-common.sh`), so they always agree on the retention.

**How a dump is replaced.** Each dump is written as `<name>.partial`, verified (`gzip -t` for the daily, `pg_restore --list` for the pre-deploy dump), renamed, and only then is the previous dump of that kind deleted. A failed or interrupted dump therefore never removes the last good backup. The disk briefly holds one extra dump while the new one is written (about 20 minutes on ACC in October 2026). Before October 2026 the old daily dump was deleted *before* the new one was written, so with a retention of 2 the disk held 3 dumps every night until the next deploy trimmed it.

**When the pre-migration backup fails, the deploy fails.** `pre-deploy-backup.sh` exits non-zero, with a `🚨 Deploy ABORTED` Discord alert, when no working `pg_dump` exists or the dump cannot be verified, and the migrations do not run. It uses the same method as the nightly backup: the host `pg_dump` first, then `docker exec` into `BACKUP_CONTAINER_NAME` (default `armouredsouls-db-prod`). The inline step it replaced only tried the container, failed on every ACC deploy from at least 12 October 2026, and let the migrations run without a backup after printing a warning.

`scripts/preflight.sh` runs at the start of each deploy and also trims the backups to the retention. Normally that is a no-op; it catches overflow after a retention change and leftover `.partial` files.

**Overlap between the nightly backup and a deploy.** All three scripts take a host-wide lock (`backups/.backup.lock`, holding the owner's PID) for their backup work, so they never clean up or dump while another is writing. A deploy during the 02:00 backup:
- preflight skips its backup cleanup and logs `A backup is running … skipping backup cleanup`;
- `pre-deploy-backup.sh` waits up to 30 min (`BACKUP_LOCK_WAIT_SECONDS`) for the nightly dump to finish, then fails the deploy if it still cannot get the lock.

The nightly backup likewise waits up to 60 min for a running pre-deploy dump. A lock whose PID is no longer running, or that is over 6 hours old, is taken over automatically. To clear one by hand, check that no backup is running (`pgrep -af 'backup.sh|pre-deploy-backup.sh|pg_dump'`), then `rm -rf /opt/armouredsouls/backups/.backup.lock`.

### Verify

```bash
# Dumps on disk: expect one daily and (after the first deploy) one pre_deploy dump
ls -lh /opt/armouredsouls/backups/daily/ /opt/armouredsouls/backups/pre_deploy_*.dump

# Last runs
grep -E 'Daily backup complete|Removed old backup|SKIPPED|ERROR' /var/log/armouredsouls/backup.log | tail -10

# The retention a host is actually using (unset means the default of 1)
grep -E '^BACKUP_(DAILY|PRE_DEPLOY|WEEKLY)_RETAIN=' /opt/armouredsouls/backend/.env
```

### Test a Backup (Non-Destructive)

To verify a backup is valid without restoring it to the live database:

```bash
# Daily dump: no output = valid gzip
gunzip -t /opt/armouredsouls/backups/daily/LATEST_BACKUP.sql.gz

# Pre-deploy dump: prints the archive's table of contents if it is complete
docker exec -i armouredsouls-db-prod pg_restore --list < /opt/armouredsouls/backups/pre_deploy_TIMESTAMP.dump | head
```

Restore either kind with `scripts/restore.sh <file>` (see [TROUBLESHOOTING.md](TROUBLESHOOTING.md)); it is destructive and asks for confirmation.

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

ACC and PRD run Postgres with `max_connections=20` (`docker-compose.production.yml`). The connection budget is:

| Client | Max connections | Set by |
|---|---|---|
| Backend pool | 15 | `DB_POOL_MAX` (default 15, `src/lib/dbPoolConfig.ts`). The nightly Automaton Turn_Step uses up to 2 × `AUTOMATON_TURN_CONCURRENCY` of these (6 at the default 3) and is clamped to leave 5 free for players |
| Deploy seed | 2 | `prisma/seed.ts` |
| Migrations, `pg_dump`, `psql` | 1–2 each | — |

`connection_limit` in `DATABASE_URL` has no effect: it is a Prisma query-engine parameter, and the pg driver adapter ignores it. Keep `DB_POOL_MAX` at least 5 below `max_connections`. Deploy migrations and the seed run through `scripts/with-db-retry.sh`, which retries when Postgres reports "too many clients".

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

ACC has a disk of about 45 GB (`df -h /` in October 2026: 11 GB free at 76% used). The 20 GB and 25 GB sizes in older notes are outdated; check `df -h /` rather than this figure after any resize.

Disk budget on ACC, October 2026 (estimated from `df` readings and dump sizes, not a per-directory measurement):

| Item | Approx. size |
|---|---|
| Everything except backups (OS, Docker, Postgres data, app, logs) | ~26.5 GB |
| One daily dump (`*.sql.gz`) | ~3.7 GB, +0.2 GB on the last measured day |
| One pre-deploy dump (`-Fc`) | similar to a daily dump (not yet measured) |
| **Steady state: 1 daily + 1 pre-deploy** | **~34 GB (~76%)** |
| Peak while a new dump is written (~20 min) | ~37.5 GB (~83%) |

The disk monitor alerts at 80% (WARNING) and 90% (CRITICAL); `backup.sh` skips the nightly backup at 85% (`BACKUP_DISK_THRESHOLD`), and a deploy aborts at 90% or when the free space is under 1.5× the largest dump. If usage exceeds 80% outside the nightly backup window, clean up old logs, check `docker system df`, or see [Disk Resize After Cloud Disk Upgrade](#disk-resize-after-cloud-disk-upgrade) below.

**Growth.** Every cycle adds battles, so the database and each dump keep growing (3.5 GB → 3.7 GB between the 21 and 22 October 2026 dumps). Battle Log Retention (Spec #39, 01:30 UTC daily, see [MONITORING.md](MONITORING.md#battle-log-retention-spec-39)) clears `battle_log` after 7 days, which keeps the dumps smaller, but Postgres does not return the freed space to the disk until a `VACUUM FULL`. When the steady state approaches 80%, the remaining levers are a larger disk or moving the dumps off the VPS; lowering the retention below one daily and one pre-deploy dump would leave a single restore point.

### Disk Resize After Cloud Disk Upgrade

When the underlying cloud disk is resized (e.g., upgrading the Scaleway VPS disk from 20 GB to 25 GB), the **partition** does not automatically grow with it. The new bytes are visible to the kernel but unallocated. `df -h /` will keep showing the old size until you extend the partition and the filesystem.

**Symptom:** Scaleway dashboard shows the new disk size, but `df -h /` shows the old size and disk-full alerts continue.

**Diagnose:**

```bash
lsblk                       # Disk size vs partition size
sudo fdisk -l /dev/sda      # Partition end sector vs total sectors
```

If `sda` shows the new size (e.g., `23.3G` for a 25 GB allocation) but `sda1` is smaller (e.g., `17.6G`), the gap between the two is unallocated space waiting for the partition to grow.

**Resize, online and non-destructive:**

```bash
# Extends the partition into the unused space
sudo growpart /dev/sda 1

# Online-resizes the ext4 filesystem to match
sudo resize2fs /dev/sda1

# Verify
df -h /
lsblk
```

If `growpart` isn't installed:

```bash
sudo apt-get update && sudo apt-get install -y cloud-guest-utils
```

**Why it's safe.** `growpart` only edits the GPT entry to extend the end-sector — no data movement. `resize2fs` on a mounted ext4 filesystem just adds new inodes at the tail of the existing structure. Both operations are non-destructive and survive reboots.

**Why it can fail.**
- `growpart` errors if the partition is already at the maximum or if there's no free space after the last partition (would mean the cloud disk wasn't actually resized).
- `resize2fs` only fails if the filesystem is already corrupted, in which case bigger problems exist.

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
