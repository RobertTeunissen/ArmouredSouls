# Requirements Document

## Introduction

Add lightweight monitoring and alerting to Armoured Souls so that infrastructure failures, cycle job errors, and resource exhaustion are detected and reported within minutes — not discovered the next morning. The system targets a single Scaleway DEV1-S VPS (2 vCPU, 2GB RAM, 20GB SSD) running Ubuntu, and must operate within the constraints of that environment (no heavy agents, no paid SaaS beyond what Scaleway already provides for free).

## Glossary

- **Health_Probe**: An internal endpoint that validates application readiness by checking database connectivity, critical module availability, and disk space.
- **Disk_Monitor**: A lightweight cron-based script that checks disk usage and dispatches alerts when thresholds are crossed.
- **Startup_Self_Test**: A boot-time validation routine that verifies all critical modules and cron job handlers can be resolved before the application accepts traffic.
- **Alert_Channel**: A notification destination (Discord webhook) where monitoring alerts are delivered.
- **Scaleway_Cockpit**: Scaleway's built-in observability platform providing free Instance CPU metrics and optional custom metrics/logs (billed at €0.15/million samples for custom data).
- **scaleway-vmagent**: A lightweight agent provided by Scaleway that reports memory and disk metrics to Cockpit dashboards (free for Scaleway Instance data).
- **Deploy_Smoke_Test**: Post-deployment validation that confirms the application is functional after a restart or deploy.
- **Heartbeat_Check**: A periodic external probe (UptimeRobot or equivalent free service) that verifies the application is reachable from the internet.

## Expected Contribution

This spec addresses backlog item #3 (Monitoring and Alerting). Currently the system has zero proactive alerting — failures are discovered manually. Two real incidents (April 2026) went undetected for hours because no alerting existed for disk exhaustion or broken builds.

### Measurable Outcomes

1. **Disk exhaustion prevention**: Before: no disk usage alerting — full-disk caused two outages (one requiring hard VPS restart). After: cron-based disk monitor alerts via Discord at 80% usage, critical alert at 90%. Time-to-detection drops from "next morning" to <5 minutes.
2. **Cycle failure visibility**: Before: cycle job failures only visible in PM2 logs or admin panel (requires manual check). After: cycle failures already dispatch Discord notifications (existing `buildErrorMessage` in cycleScheduler), but startup failures and module resolution errors are silent. After this spec: startup self-test catches missing modules before the server accepts traffic, and failed startup triggers a Discord alert.
3. **Post-deploy confidence**: Before: deploy pipeline runs a basic `curl /api/health` that only checks DB connectivity. After: enhanced health endpoint validates disk space and critical module availability. Deploy smoke test catches partial builds (like the missing `utils/` directory incident).
4. **External uptime monitoring**: Before: no way to know if the VPS is unreachable from the internet. After: UptimeRobot (free tier, 5-minute intervals) monitors the public health endpoint and alerts via Discord/email on downtime.
5. **Scaleway Cockpit integration**: Before: Cockpit provides free CPU metrics for Instances but memory/disk metrics require `scaleway-vmagent` which isn't installed. After: vmagent installed, giving free memory and disk visibility in Cockpit dashboards without any custom data costs.
6. **Backup failure alerting**: Before: backup script logs to file but nobody reads it — a failed backup is only discovered when you need to restore. After: backup script sends Discord alert on failure or when disk guard skips a backup.

### Verification Criteria

1. `curl -s http://localhost:3001/api/health | jq '.disk'` returns an object with `usagePercent` and `status` fields.
2. `curl -s http://localhost:3001/api/health | jq '.modules'` returns an object with `status: "ok"` confirming critical modules are loadable.
3. `grep -r "startupSelfTest\|startup-self-test" app/backend/src/` returns matches confirming the self-test exists.
4. `find app/scripts -name "disk-monitor*" | wc -l` returns at least 1 (disk monitoring script exists).
5. `grep -r "ALERT_DISCORD_WEBHOOK\|MONITORING_DISCORD_WEBHOOK" app/scripts/ app/backend/src/` returns matches (alerting webhook is used).
6. `grep -r "diskSpace\|disk_space\|diskUsage" app/backend/src/index.ts app/backend/src/utils/` returns matches (health endpoint includes disk check).
7. `grep -r "discord\|webhook" app/scripts/backup.sh` returns matches (backup script has alert integration).
8. Running `npm run build` in `app/backend` succeeds without errors.
9. Running `npm run test:unit` in `app/backend` passes all new monitoring-related tests.
10. `find docs/guides/operations -name "*monitoring*" | wc -l` returns at least 1 (operations guide for monitoring exists).

## Requirements

### Requirement 1: Enhanced Health Endpoint

**User Story:** As an operator, I want the health endpoint to report disk space, memory usage, and critical module availability, so that automated probes can detect degraded states before they cause outages.

#### Acceptance Criteria

1. THE health endpoint (`GET /api/health`) SHALL return a `disk` object containing `usagePercent` (integer 0–100), `availableMB` (integer), and `status` ("ok" | "warning" | "critical").
2. THE health endpoint SHALL set `disk.status` to "warning" when `usagePercent` >= 80 and "critical" when `usagePercent` >= 90.
3. THE health endpoint SHALL return a `memory` object containing `usedMB` (integer), `totalMB` (integer), and `usagePercent` (integer 0–100).
4. THE health endpoint SHALL return a `modules` object containing `status` ("ok" | "degraded") and `missing` (string array of module names that failed to resolve).
5. THE health endpoint SHALL check that the following critical modules are resolvable: `../../utils/economyCalculations`, `../services/cycle/cycleScheduler`, `../services/notifications/notification-service`.
6. THE health endpoint SHALL return HTTP 200 when database is connected and disk status is not "critical", and HTTP 503 when database is disconnected OR disk status is "critical".
7. WHEN `disk.status` transitions to "warning" or "critical" (i.e., was previously "ok" or this is the first check since startup), THE health endpoint SHALL dispatch a Discord alert via the monitoring webhook with the disk usage details. Subsequent requests at the same severity level SHALL NOT re-alert (in-memory cooldown of 15 minutes per severity level to avoid spam from frequent probe hits).
8. THE health endpoint SHALL complete within 2 seconds under normal conditions (no long-running queries or file system scans).
9. THE health endpoint SHALL remain accessible without authentication (public probe target).

### Requirement 2: Startup Self-Test

**User Story:** As an operator, I want the application to validate its own integrity on startup, so that a broken build (missing compiled modules) is caught immediately rather than failing silently at runtime hours later.

#### Acceptance Criteria

1. THE startup self-test SHALL run after the Express app is created but before the server begins listening for connections.
2. THE startup self-test SHALL attempt to `require()` or dynamically `import()` each critical module listed in Requirement 1 AC 5, plus all cron job handler entry points used by the cycle scheduler.
3. WHEN any critical module fails to resolve, THE startup self-test SHALL log a CRITICAL error with the module path and error message.
4. WHEN any critical module fails to resolve, THE startup self-test SHALL dispatch a Discord alert via the monitoring webhook with the message: "🚨 STARTUP FAILED: Missing modules: [list]. Server did not start."
5. WHEN any critical module fails to resolve, THE startup self-test SHALL exit the process with code 1 (preventing PM2 from serving a broken application — PM2's `max_restarts: 10` will eventually stop restart attempts).
6. WHEN all critical modules resolve successfully, THE startup self-test SHALL log an INFO message: "Startup self-test passed: all critical modules verified."
7. THE startup self-test SHALL complete within 5 seconds (it only checks module resolution, not runtime behavior).

### Requirement 3: Disk Usage Monitor Script

**User Story:** As an operator, I want a cron job that monitors disk usage and alerts me via Discord when thresholds are crossed, so that I have advance warning before disk exhaustion causes an outage.

#### Acceptance Criteria

1. THE disk monitor script SHALL be a standalone bash script at `app/scripts/disk-monitor.sh`.
2. THE disk monitor script SHALL check the usage percentage of the root filesystem (`/`).
3. WHEN disk usage >= 80% AND < 90%, THE script SHALL send a WARNING alert to the Discord monitoring webhook: "⚠️ Disk usage WARNING: {percent}% used ({available}MB free) on {hostname}".
4. WHEN disk usage >= 90%, THE script SHALL send a CRITICAL alert to the Discord monitoring webhook: "🚨 Disk usage CRITICAL: {percent}% used ({available}MB free) on {hostname}. Immediate action required."
5. WHEN disk usage < 80%, THE script SHALL exit silently (no notification).
6. THE script SHALL use the `MONITORING_DISCORD_WEBHOOK` environment variable for the webhook URL.
7. THE script SHALL be idempotent — running it multiple times at the same disk usage level sends the same alert each time (stateless, no deduplication — cron frequency controls alert frequency).
8. THE script SHALL be scheduled via cron to run every 15 minutes.
9. THE script SHALL exit with code 0 regardless of disk status (cron should not generate error emails for normal operation).

### Requirement 4: Backup Failure Alerting

**User Story:** As an operator, I want the backup script to alert me when a backup fails or is skipped due to disk pressure, so that I know my disaster recovery capability is compromised.

#### Acceptance Criteria

1. WHEN the daily backup is skipped due to the disk space guard (usage >= threshold), THE backup script SHALL send a Discord alert: "⚠️ Backup SKIPPED: Disk usage {percent}% exceeds {threshold}% threshold on {hostname}. No backup created."
2. WHEN the `pg_dump` command fails (non-zero exit code), THE backup script SHALL send a Discord alert: "🚨 Backup FAILED: pg_dump returned error on {hostname}. Check backup logs."
3. THE backup script SHALL use the `MONITORING_DISCORD_WEBHOOK` environment variable for the webhook URL.
4. WHEN the webhook URL is not set, THE backup script SHALL log the alert message to stdout and continue (graceful degradation — don't break backups because alerting is misconfigured).
5. THE backup script SHALL not alter its existing backup logic — alerting is additive only.

### Requirement 5: External Uptime Monitoring

**User Story:** As an operator, I want an external service to monitor my application's availability from the internet, so that I'm alerted when the VPS is unreachable or the application is down.

#### Acceptance Criteria

1. THE monitoring setup documentation SHALL describe configuring UptimeRobot (free tier) to probe `https://{domain}/api/health` every 5 minutes.
2. THE documentation SHALL describe configuring UptimeRobot to alert via Discord webhook integration when the endpoint returns non-200 or is unreachable for 2 consecutive checks.
3. THE documentation SHALL describe configuring UptimeRobot to alert via email as a secondary channel.
4. THE documentation SHALL note that UptimeRobot free tier supports up to 50 monitors with 5-minute intervals — sufficient for both ACC and PRD environments.
5. THE health endpoint (Requirement 1) SHALL serve as the probe target — no separate uptime endpoint needed.

### Requirement 6: Scaleway Cockpit Integration

**User Story:** As an operator, I want memory and disk metrics visible in Scaleway Cockpit dashboards, so that I can view historical resource trends without installing heavy monitoring agents.

#### Acceptance Criteria

1. THE setup documentation SHALL describe installing `scaleway-vmagent` on the VPS via the Scaleway PPA (`sudo apt install scaleway-vmagent`).
2. THE documentation SHALL confirm that Instance metrics reported by vmagent (CPU, memory, disk) are free Scaleway data — no custom data ingestion charges.
3. THE documentation SHALL describe verifying metrics appear in the Cockpit Instance Overview dashboard within 5 minutes of agent installation.
4. THE documentation SHALL note that Cockpit provides 31-day retention for metrics at no cost.
5. THE documentation SHALL describe how to access Cockpit dashboards from the Scaleway console (Project → Cockpit → Dashboards → Instance Overview).

### Requirement 7: Post-Deploy Health Validation Enhancement

**User Story:** As an operator, I want the CI/CD deploy pipeline to validate the enhanced health endpoint after restart, so that partial builds or disk issues are caught before the deploy is marked successful.

#### Acceptance Criteria

1. THE deploy workflow health check step SHALL validate that the health endpoint returns `disk.status` != "critical" in addition to HTTP 200.
2. THE deploy workflow health check step SHALL validate that `modules.status` == "ok" (no missing modules).
3. WHEN the enhanced health check fails, THE deploy workflow SHALL exit with a non-zero code, marking the deployment as failed in GitHub Actions.
4. THE existing 30-second timeout for health check polling SHALL remain unchanged.

### Requirement 8: Deploy Failure Discord Notification

**User Story:** As an operator, I want to receive a Discord alert when a deployment to ACC or PRD fails at any step, so that I know immediately when a deploy didn't complete successfully — without needing to check the GitHub Actions UI.

#### Acceptance Criteria

1. WHEN any step in the `deploy-acc` job fails (rsync, npm install, prisma migrate, PM2 restart, health check), THE deploy workflow SHALL send a Discord alert to the monitoring webhook: "🚨 Deploy to ACC FAILED at step: {step_name}. Run: {github_run_url}".
2. WHEN any step in the `deploy-prd` job fails, THE deploy workflow SHALL send a Discord alert: "🚨 Deploy to PRD FAILED at step: {step_name}. Run: {github_run_url}".
3. THE failure notification step SHALL run with `if: failure()` so it executes only when a preceding step has failed.
4. THE failure notification step SHALL include a link to the GitHub Actions run for quick investigation.
5. THE deploy workflow SHALL use the `MONITORING_DISCORD_WEBHOOK` secret for the alert (configured as a GitHub Actions environment secret).
6. WHEN a deploy succeeds, THE deploy workflow SHALL send a success confirmation: "✅ Deploy to {env} complete. Health check passed (disk: {status}, modules: ok)."
7. THE success notification SHALL run with `if: success()` after the health check step passes.

### Requirement 9: Monitoring Discord Webhook Configuration

**User Story:** As an operator, I want a dedicated Discord webhook for monitoring alerts (separate from the game notification webhook), so that operational alerts don't get lost in player-facing game notifications.

#### Acceptance Criteria

1. THE system SHALL use a `MONITORING_DISCORD_WEBHOOK` environment variable for all monitoring/alerting notifications (disk alerts, startup failures, backup failures, deploy failures).
2. THE existing `DISCORD_WEBHOOK_URL` environment variable SHALL continue to be used exclusively for player-facing game notifications (cycle completions, battle results).
3. WHEN `MONITORING_DISCORD_WEBHOOK` is not set, monitoring alerts SHALL fall back to `DISCORD_WEBHOOK_URL` if available, and log to stdout if neither is set.
4. THE `.env.example` and `.env.acc.example` files SHALL document the `MONITORING_DISCORD_WEBHOOK` variable with a description.
5. THE `MONITORING_DISCORD_WEBHOOK` SHALL also be configured as a GitHub Actions environment secret for use in deploy failure/success notifications.

### Requirement 10: Daily Health Report

**User Story:** As an operator, I want a daily summary posted to the monitoring Discord channel confirming the system is healthy, so that silence doesn't mean "everything is fine" — it means "alerting might be broken."

#### Acceptance Criteria

1. THE system SHALL send a daily health report to the monitoring Discord webhook at a configurable time (default: 08:00 UTC, configurable via `DAILY_REPORT_SCHEDULE` cron expression).
2. THE daily report SHALL include: application uptime (time since last PM2 restart), current disk usage (percent and available MB), current memory usage (percent), database connectivity status, module integrity status, last successful cycle job name and timestamp, and current cycle number.
3. WHEN all checks are healthy, THE report message SHALL use a green checkmark format: "✅ Daily Health Report — All systems operational" followed by the metric summary.
4. WHEN any check is degraded (disk warning, module degraded, DB disconnected), THE report SHALL use a warning format: "⚠️ Daily Health Report — Degraded" followed by the metric summary with the degraded items highlighted.
5. THE daily report SHALL be implemented as a cron job within the Node.js application (using the existing `node-cron` dependency), following the same pattern as the cycle scheduler jobs.
6. THE daily report SHALL verify that logging is functional by writing a test log entry via Winston and confirming the log file was modified within the last 24 hours. If the log file is stale (not modified in 24h) or the write fails, THE report SHALL include a "⚠️ Logging: STALE" indicator.
7. THE daily report SHALL not block or interfere with cycle scheduler jobs (it runs independently, no lock acquisition needed).
8. WHEN the monitoring webhook is not configured, THE daily report SHALL log the report content at INFO level instead of sending to Discord.

### Requirement 11: Monitoring Operations Guide

**User Story:** As an operator, I want a comprehensive guide documenting all monitoring components, alert channels, and response procedures, so that anyone maintaining the system knows what's monitored and how to respond.

#### Acceptance Criteria

1. THE guide SHALL be located at `docs/guides/operations/MONITORING.md`.
2. THE guide SHALL document all alert types, their severity levels, trigger conditions, and recommended response actions.
3. THE guide SHALL document the Discord webhook setup (creating webhooks, configuring channels, separating game vs monitoring alerts).
4. THE guide SHALL document the UptimeRobot setup procedure with screenshots or step descriptions.
5. THE guide SHALL document the Scaleway Cockpit setup (vmagent installation, dashboard access, what metrics are available for free).
6. THE guide SHALL document the cron job schedule for the disk monitor and how to verify it's running.
7. THE guide SHALL document how to test each alert manually (e.g., simulating disk pressure, triggering a test webhook).
8. THE guide SHALL include a troubleshooting section for common monitoring issues (webhook not firing, vmagent not reporting, cron not running).
9. THE guide SHALL document the daily health report: its schedule, content, and how to change the reporting time.
10. THE guide SHALL document the deploy failure/success notifications and how to configure the `MONITORING_DISCORD_WEBHOOK` GitHub Actions secret.
