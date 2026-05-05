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
| Startup Failed | Missing compiled modules | `🚨 STARTUP FAILED: Missing modules: [list]. Server did not start.` | SSH in, check `dist/` directory, run `npm run build`, restart PM2 |
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

Add this line:
```
*/15 * * * * /opt/armouredsouls/scripts/disk-monitor.sh >> /var/log/armouredsouls/disk-monitor.log 2>&1
```

### Environment Variables

The script sources `/opt/armouredsouls/backend/.env` automatically. Ensure `MONITORING_DISCORD_WEBHOOK` is set there.

### Verification

```bash
# Check cron is registered
crontab -l | grep disk-monitor

# Run manually to test
/opt/armouredsouls/scripts/disk-monitor.sh

# Check recent log output
tail -5 /var/log/armouredsouls/disk-monitor.log
```

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

### Daily Report Not Arriving

1. **Check app is running**: `pm2 status`
2. **Check webhook config**: Verify `MONITORING_DISCORD_WEBHOOK` in `.env`
3. **Check schedule**: Verify `DAILY_REPORT_SCHEDULE` is valid cron (default: `0 8 * * *`)
4. **Check logs**: `grep "daily-health-report" /var/log/armouredsouls/backend-out.log | tail -10`
5. **If no log entries**: The cron job may not be registered — restart the app
