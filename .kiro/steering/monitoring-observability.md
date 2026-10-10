---
inclusion: manual
---

# Monitoring and Observability Runbook

## Implemented signals
- `/api/health` reports environment, database, disk, memory, moderation, critical modules, and timestamp; it returns an unhealthy status/503 when required checks fail. The endpoint and `app/scripts/deployment-health-check.sh` are the sources of truth.
- Operational alerts cover startup/deploy failures, backup failure/skip, disk pressure, and daily health reporting. Discord webhook configuration, the disk monitor, UptimeRobot probes, and retention/cooldowns must be verified in `docs/guides/operations/MONITORING.md` rather than assumed from this file.
- Use structured, secret-safe application logging from `error-handling-logging.md`; do not invent a second logger or metrics contract.

## Automaton signals (Spec #55)
- One `[automaton-turns]` info line per Turn_Step: trigger, season, slot, source, processed, completed, skipped by reason, failed, actions by kind, credits spent/received, saving, blocked, `durationMs`.
- `[automaton-alert]` errors also go to the monitoring webhook (`sendMonitoringAlert`), with Catalogue_Key and reason, never secrets: `automaton_turn_failed`, `automaton_turn_step_failed`, `automaton_step_budget_exhausted` (Turn_Step > 300 s), `automaton_invalid_parameters`, `automaton_negative_balance`, `automaton_saving_streak` (informational), `automaton_upkeep_issues`, `automaton_upgrade_rejected`, `automaton_catalogue_sync_conflicts`. A failed strategy-file check at startup alerts and stops the server.
- Incident lever: the Program_Switch in `/admin/automatons`. Procedure: `docs/guides/AUTOMATON_OPERATIONS_GUIDE.md`.

## Logs and checks
- Backend/PM2: `pm2 logs armouredsouls-backend`.
- Caddy: `sudo journalctl -u caddy -f`.
- PostgreSQL: `docker logs <postgres-container> -f`.
- Backups: `/var/log/armouredsouls/backup.log`.
- CI/deploy: inspect the failed GitHub Actions job and artifacts.
- Health: `curl <verified-environment-url>/api/health`; validate JSON status, database, disk, modules, and expected environment.

Disk alert thresholds and cron cadence are owned by `MONITORING.md`, the deployed scripts, and environment configuration. Do not copy thresholds or claim an external probe is provisioned without verifying configuration.

## Incident response
1. Acknowledge and assess severity/scope.
2. Check health, recent deploys, PM2/Caddy/database logs, backups, and disk.
3. Mitigate safely: stop a bad rollout, restore service, or follow the documented database restore procedure.
4. Communicate status and preserve evidence.
5. Resolve the cause, verify health and smoke behavior, then document the incident and corrective action.

Use the runbooks in `docs/guides/operations/MAINTENANCE.md`, `MONITORING.md`, and `TROUBLESHOOTING.md`. This file intentionally does not prescribe an unimplemented `/api/metrics` endpoint, request-timing middleware, Prisma slow-query hook, distributed tracing system, or future monitoring vendor.
