# Armoured Souls — Monitoring & Alerting Guide

**Last Updated**: May 2026  
**Status**: ✅ Current

Comprehensive guide to the monitoring and alerting system. Covers all alert types, setup procedures, and response actions.

---

## Overview

The monitoring system uses lightweight, zero-cost components:

| Component | What it monitors | Alert channel |
|---|---|---|
| Enhanced Health Endpoint | Disk, memory, DB, modules | Discord (on threshold breach) |
| Startup Self-Test | Missing compiled modules | Discord + process exit |
| Disk Monitor Script | Root filesystem usage | Discord (cron every 15 min) |
| Backup Script Alerting | Backup failures/skips | Discord |
| Daily Health Report | All-in-one daily summary | Discord |
| Deploy Notifications | CI/CD success/failure | Discord |
| UptimeRobot | External availability | Discord + email |
| Scaleway Cockpit | CPU, memory, disk history | Cockpit dashboards |

---

## Alert Types Reference

### 🚨 CRITICAL Alerts (Immediate Action Required)

| Alert | Trigger | Message Format | Response |
|---|---|---|---|
| Disk Critical | Usage >= 90% | `🚨 Disk usage CRITICAL: {%}% used ({free} free) on {host}` | Free disk space immediately: remove old backups, vacuum journal, check Docker images |
| Startup Failed | Missing compiled modules | `🚨 STARTUP FAILED: Missing modules: [list]. Server did not start.` | SSH in, check `dist/` directory, run `pnpm run build`, restart PM2 |
| Backup Failed | pg_dump non-zero exit | `🚨 Backup FAILED: pg_dump returned error on {host}` | Check DB connectivity, disk space, backup logs |
| Deploy Failed | Any deploy step fails | `🚨 Deploy to {env} FAILED. Run: {url}` | Check GitHub Actions run, fix the failing step, re-deploy |

### ⚠️ WARNING Alerts (Investigate Soon)

| Alert | Trigger | Message Format | Response |
|---|---|---|---|
| Disk Warning | Usage 80–89% | `⚠️ Disk usage WARNING: {%}% used ({free} free) on {host}` | Plan disk cleanup within 24h |
| Backup Skipped | Disk guard triggered | `⚠️ Backup SKIPPED: Disk usage {%}% exceeds threshold on {host}` | Free disk space, verify next backup runs |
| Health Degraded | Daily report shows issues | `⚠️ Daily Health Report — Degraded` | Check the specific degraded item in the report |

### ✅ Informational

| Alert | Trigger | Message Format |
|---|---|---|
| Deploy Success | Deploy completes | `✅ Deploy to {env} complete. Health check passed.` |
| Daily Report OK | Daily cron fires | `✅ Daily Health Report — All systems operational` |

---

## Discord Webhook Setup

### Creating a Monitoring Channel

1. In your Discord server, create a dedicated `#ops-alerts` channel (separate from game notifications).
2. Go to Channel Settings → Integrations → Webhooks → New Webhook.
3. Name it "Armoured Souls Monitoring" and copy the webhook URL.

### Configuring the Webhook

**On the VPS** (in `/opt/armouredsouls/backend/.env`):
```bash
MONITORING_DISCORD_WEBHOOK=https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN
```

**In GitHub Actions** (for deploy notifications):
1. Go to Repository → Settings → Environments → acceptance (and production).
2. Add secret: `MONITORING_DISCORD_WEBHOOK` with the same webhook URL.

### Separation from Game Notifications

- `MONITORING_DISCORD_WEBHOOK` → `#ops-alerts` channel (disk, startup, backup, deploy alerts)
- `DISCORD_WEBHOOK_URL` → `#game-updates` channel (cycle completions, battle results)

If `MONITORING_DISCORD_WEBHOOK` is not set, alerts fall back to `DISCORD_WEBHOOK_URL`.

---

## UptimeRobot Setup

### Account & Monitor Configuration

1. Create a free account at [uptimerobot.com](https://uptimerobot.com).
2. Add a new monitor:
   - **Monitor Type**: HTTP(s)
   - **Friendly Name**: "Armoured Souls ACC" (or PRD)
   - **URL**: `https://acc.armouredsouls.com/api/health`
   - **Monitoring Interval**: 5 minutes
   - **Alert Contact**: Your Discord webhook + email

3. Repeat for production: `https://armouredsouls.com/api/health`

### Alert Configuration

- Set "Alert after X consecutive failures": **2** (avoids false positives from brief network blips)
- Add Discord webhook as alert contact: UptimeRobot → My Settings → Alert Contacts → Add → Webhook
- Add email as secondary alert contact

### Free Tier Limits

- 50 monitors (more than enough for ACC + PRD)
- 5-minute check intervals
- Email + webhook alerts included

---

## Scaleway Cockpit Setup

### Installing scaleway-vmagent

SSH into the VPS and run:

```bash
sudo add-apt-repository ppa:scaleway/stable
sudo apt update
sudo apt install scaleway-vmagent
sudo systemctl enable scaleway-vmagent
sudo systemctl start scaleway-vmagent
```

### Verifying Metrics

1. Go to Scaleway Console → your Project → Cockpit → Dashboards.
2. Select "Instance Overview" dashboard.
3. Metrics should appear within 5 minutes of agent installation.

### What's Available for Free

- **CPU usage** (included by default for all Instances)
- **Memory usage** (requires vmagent)
- **Disk usage** (requires vmagent)
- **Network I/O** (included by default)
- **31-day retention** at no cost
- No custom data charges — these are "Scaleway data"

### Accessing Cockpit

Scaleway Console → Project → Cockpit → Open dashboards (Grafana) → Instance Overview

---

## Disk Monitor Cron Setup

### Installation

Add to the deploy user's crontab:

```bash
crontab -e
```

Add this line — **hourly, and exactly one entry**:
```
0 * * * * /opt/armouredsouls/scripts/disk-monitor.sh >> /var/log/armouredsouls/disk-monitor.log 2>&1
```

### Cadence: hourly check, two-hour cooldown (Spec #46)

| Setting | Value | Where |
|---|---|---|
| Check interval | Hourly (`0 * * * *`) | crontab, per host |
| Disk_Alert_Cooldown | 7200 seconds (2 hours) per severity | `DISK_ALERT_COOLDOWN_SECONDS`, default in the script |

**Why hourly and not every 15 minutes.** Disk consumption on these hosts is driven by the hourly battle and settlement cron jobs — each run writes battles, participants, summaries, and audit events. Usage rises in *steps* at those hourly boundaries and is essentially flat in between, so a 15-minute interval samples the same number four times and buys no earlier detection.

**Why not longer than hourly.** Past one hour, latency on the *first* alert grows with no benefit, because the cooldown already caps the rate for every alert after the first. Hourly detection with a two-hour cooldown gives at most one alert every two hours while the disk stays above a threshold, and still catches the breach within an hour of it happening.

### The July 2026 alert storm on `armouredsouls-acc` — what actually happened

`armouredsouls-acc` was emitting roughly four CRITICAL alerts per hour while the disk sat at 99%. Spec #46 initially attributed this to a duplicate cron entry. **That was wrong**, and the investigation is recorded here so the wrong cause is not chased again.

Diagnosis on the host found:

| Check | Result |
|---|---|
| `crontab -l \| grep -c disk-monitor` | `1` — a single entry, no duplicate |
| Schedule | `*/15 * * * *` — 4 runs per hour |
| Deployed script | Had cooldown logic, defaulting to 3600s |
| `/var/lib/armouredsouls` | **Did not exist** |
| `/var/lib/armouredsouls/disk-alert-*` and `/tmp/disk-alert-*` | **Neither existed** |
| `disk-monitor.log` | Four `.env: line N: command not found` errors per run |

The actual cause was a chain, not a duplicate:

1. **`/var/lib/armouredsouls` did not exist**, so the script silently fell back to `/tmp`. The old script logged nothing about this, so nobody knew which state directory was in use.
2. **No cooldown state file was ever present in either location**, so `should_alert()` saw no prior alert and permitted one on every run. A 3600-second cooldown that never persists its timestamp is not a cooldown.
3. **The 15-minute interval multiplied that by four.** The interval was an amplifier, not the fault.
4. **`source /opt/armouredsouls/backend/.env` was corrupting the environment on every run.** Bash evaluates unquoted values as commands, so a line like `SOME_SCHEDULE=0 8 * * *` parses as `SOME_SCHEDULE=0` followed by an attempt to execute `8 * * *`. Four such lines failed every run. Any variable after the first failure — including `DISK_ALERT_COOLDOWN_SECONDS` — was unreliable.

Spec #46 addresses 1, 2, and 4 in the script itself: `env_get` replaces `source`, the `/tmp` fallback is logged, and a failed state write logs a warning naming the file. Item 3 is the cron change.

### ⚠️ Still verify exactly one cron entry per host

The duplicate-entry check remains worth running — cron is installed by hand and nothing in the repository prevents a second entry — but note that **acc's storm was not caused by one**, so a count of `1` does not clear the monitor. Work through the "Too Many Disk Alerts" checklist below rather than stopping at the cron count.

Spec #29 recorded a design decision that the disk monitor needs "no deduplication", on the reasoning that the cooldown makes repeat alerts self-limiting. The acc incident shows the real weakness in that reasoning: **the cooldown is only self-limiting if its state actually persists**, and the original script had no way to tell you when it did not. That is now logged rather than silent.

### Environment Variables

The script reads `/opt/armouredsouls/backend/.env` using the `env_get` helper — it does **not** `source` the file, because bash would evaluate unquoted values as commands (a cron expression like `LEAGUE_SCHEDULE=0 20 * * *` aborts the script). Ensure `MONITORING_DISCORD_WEBHOOK` is set there. `DISK_ALERT_COOLDOWN_SECONDS` is optional and overrides the two-hour default.

### Verification

```bash
# There must be EXACTLY ONE entry — this must print 1
crontab -l | grep -c disk-monitor

# Confirm the schedule is hourly, not */15
crontab -l | grep disk-monitor

# Confirm the deployed script matches the repository version
diff /opt/armouredsouls/scripts/disk-monitor.sh \
     /opt/armouredsouls/app/scripts/disk-monitor.sh && echo "in sync"

# Confirm the cooldown default is present in the deployed copy
grep -c 'COOLDOWN_SECONDS:-7200' /opt/armouredsouls/scripts/disk-monitor.sh

# Run manually to test
/opt/armouredsouls/scripts/disk-monitor.sh

# Check recent log output
tail -5 /var/log/armouredsouls/disk-monitor.log
```

### Local test harness

```bash
bash app/scripts/__tests__/disk-monitor.test.sh
```

Stubs `df`, redirects `STATE_DIR` to a temporary directory, and leaves the webhook unset, so it makes no network call and touches no real state. Covers the cooldown gate, the state-write failure path, cooldown clearing on recovery, and the exit status.

---

## Daily Health Report

### Schedule

Default: 08:00 UTC daily. Configurable via `DAILY_REPORT_SCHEDULE` env var (cron expression).

```bash
# Change to 09:00 UTC
DAILY_REPORT_SCHEDULE=0 9 * * *
```

### Content

The report includes: uptime, disk usage, memory usage, database connectivity, module integrity, logging health, and last cycle job info.

### Interpreting the Report

- **✅ All systems operational**: Everything is healthy. Alerting is working.
- **⚠️ Degraded**: One or more checks failed. Look at the specific line items.
- **No report received**: The application may be down, or the webhook is broken. Check UptimeRobot and SSH into the VPS.

---

## Battle Log Retention (Spec #39)

### Schedule

Runs at 01:30 UTC daily (after settlement, before backup). Hardcoded in `battleLogRetentionService.ts`.

### Behavior

- NULLs `battle_log` for all battles older than 7 days (configurable via `BATTLE_LOG_RETENTION_DAYS` env var)
- Processes in batches of 1000 with 100ms sleep between batches
- Idempotent — already-NULLed rows are skipped
- Pre-computed `battle_summaries` table preserves overview data permanently

### Logs

```bash
grep "retention" /var/log/armouredsouls/backend-out.log | tail -5
```

### Manual Retention + VACUUM

If disk pressure requires immediate action:

```bash
docker exec armouredsouls-postgres-1 psql -U as_acc -d armouredsouls_acc -c "UPDATE battles SET battle_log = NULL WHERE created_at < NOW() - INTERVAL '7 days' AND battle_log IS NOT NULL;"
docker exec armouredsouls-postgres-1 psql -U as_acc -d armouredsouls_acc -c "VACUUM FULL battles;"
```

---

## Deploy Notifications

### How They Work

The GitHub Actions deploy workflow sends Discord notifications:
- **On success**: After the enhanced health check passes
- **On failure**: When any step in the deploy job fails

Both include a link to the GitHub Actions run for quick investigation.

### Configuration

The `MONITORING_DISCORD_WEBHOOK` must be configured as a GitHub Actions environment secret:
1. Repository → Settings → Environments → acceptance → Add secret
2. Repository → Settings → Environments → production → Add secret

---

## Manual Testing

### Test Discord Webhook

```bash
curl -s -H "Content-Type: application/json" \
  -d '{"content": "🧪 Test alert from manual verification"}' \
  "$MONITORING_DISCORD_WEBHOOK"
```

### Simulate Disk Pressure

```bash
# Create a large file to push disk usage above 80%
fallocate -l 5G /tmp/disk-pressure-test

# Run the disk monitor
/opt/armouredsouls/scripts/disk-monitor.sh

# Clean up
rm /tmp/disk-pressure-test
```

### Test Startup Self-Test Failure

```bash
# Rename a critical module to simulate missing build
mv /opt/armouredsouls/backend/dist/utils/economyCalculations.js /opt/armouredsouls/backend/dist/utils/economyCalculations.js.bak

# Restart — should fail and alert
pm2 restart armouredsouls-backend

# Restore
mv /opt/armouredsouls/backend/dist/utils/economyCalculations.js.bak /opt/armouredsouls/backend/dist/utils/economyCalculations.js
pm2 restart armouredsouls-backend
```

### Test Health Endpoint

```bash
curl -s http://localhost:3001/api/health | jq .
```

---

## Troubleshooting

### Webhook Not Firing

1. **Check the URL**: `echo $MONITORING_DISCORD_WEBHOOK` — is it set?
2. **Test manually**: `curl -s -H "Content-Type: application/json" -d '{"content":"test"}' "$MONITORING_DISCORD_WEBHOOK"`
3. **Check Discord**: Is the webhook still active? (Webhooks can be deleted from Discord server settings)
4. **Check logs**: `grep "monitoring" /var/log/armouredsouls/backend-out.log | tail -20`

### scaleway-vmagent Not Reporting

1. **Check service status**: `sudo systemctl status scaleway-vmagent`
2. **Restart if needed**: `sudo systemctl restart scaleway-vmagent`
3. **Check Cockpit**: Metrics may take 5 minutes to appear after restart
4. **Instance compatibility**: If the Instance has been running for weeks, a console restart (not guest restart) may be needed to update VM configuration

### Cron Not Running

1. **Check crontab**: `crontab -l | grep disk-monitor`
2. **Check cron service**: `sudo systemctl status cron`
3. **Check log output**: `tail -20 /var/log/armouredsouls/disk-monitor.log`
4. **Check permissions**: `ls -la /opt/armouredsouls/scripts/disk-monitor.sh` — must be executable

### Too Many Disk Alerts

Symptom: more than one alert per Disk_Alert_Cooldown window while the disk sits above a threshold. Check in this order — **1 and 2 are what actually caused the July 2026 storm on acc**, so start there.

1. **Missing cooldown state.** The most likely cause, and the one that hit acc. If no state file exists, `should_alert()` permits an alert on every single run and the cooldown is inert.
   ```bash
   ls -la /var/lib/armouredsouls/disk-alert-* 2>&1     # expect a .last file per active severity
   ls -la /tmp/disk-alert-* 2>&1                       # check the fallback too
   ```
   If neither location has a file while the disk is above a threshold, the cooldown is not persisting. Continue to 2.

2. **State directory missing entirely.** `/var/lib/armouredsouls` is not created by the deploy; it must exist or the script falls back to `/tmp`.
   ```bash
   ls -ld /var/lib/armouredsouls 2>&1
   # If absent:
   sudo mkdir -p /var/lib/armouredsouls
   sudo chown "$(whoami)" /var/lib/armouredsouls
   ```
   The current script logs the fallback; older copies did so silently.
   ```bash
   grep 'using /tmp for cooldown state' /var/log/armouredsouls/disk-monitor.log | tail -5
   grep 'could not write cooldown state' /var/log/armouredsouls/disk-monitor.log | tail -5
   ```

3. **`.env` being sourced instead of read.** Look for `command not found` in the log — a sure sign of a script version that still uses `source`, which leaves every variable after the first bad line unreliable.
   ```bash
   grep 'command not found' /var/log/armouredsouls/disk-monitor.log | tail -5
   ```
   Fix by deploying the current script, which uses the `env_get` helper.

4. **Stale deployed copy.**
   ```bash
   grep -c 'COOLDOWN_SECONDS:-7200' /opt/armouredsouls/scripts/disk-monitor.sh   # MUST print 1
   diff /opt/armouredsouls/scripts/disk-monitor.sh /opt/armouredsouls/app/scripts/disk-monitor.sh
   ```

5. **Wrong interval.** Confirm the schedule is `0 * * * *` and not `*/15 * * * *`. Note this only multiplies an existing problem — it is not a cause on its own.

6. **Duplicate cron entry.** Worth ruling out, though it was *not* the cause on acc.
   ```bash
   crontab -l | grep -c disk-monitor        # expect 1
   sudo crontab -l | grep -c disk-monitor   # expect 0
   ls /etc/cron.d/ | grep -i -E 'disk|armoured'
   ```

### Disk Alerts Went Silent

A disk monitor that stops alerting is worse than one that alerts too often. The script is written to degrade toward noise, so silence points at the emitter rather than the cooldown:

1. `crontab -l | grep -c disk-monitor` — is it still installed?
2. `tail -20 /var/log/armouredsouls/disk-monitor.log` — is it running and just below threshold?
3. Verify the webhook: `grep MONITORING_DISCORD_WEBHOOK /opt/armouredsouls/backend/.env` (check the key exists; do not echo the value)
4. Run it by hand at a forced threshold using the test harness in the repository.

### Daily Report Not Arriving

1. **Check app is running**: `pm2 status`
2. **Check webhook config**: Verify `MONITORING_DISCORD_WEBHOOK` in `.env`
3. **Check schedule**: Verify `DAILY_REPORT_SCHEDULE` is valid cron (default: `0 8 * * *`)
4. **Check logs**: `grep "daily-health-report" /var/log/armouredsouls/backend-out.log | tail -10`
5. **If no log entries**: The cron job may not be registered — restart the app
