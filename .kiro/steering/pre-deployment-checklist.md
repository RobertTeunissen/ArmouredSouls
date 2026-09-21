---
inclusion: manual
---

# Pre-Deployment Checklist

## Before pushing
- Confirm the branch, status, diff, and intended deployment target. Pushing `main` triggers ACC; PRD requires manual workflow dispatch and approval.
- No secrets, debug-only code, generated artifacts, unrelated files, or bypasses are included. Stage named paths and preserve hooks.
- Update affected PRDs, API/schema docs, implementation notes, and player-guide content.
- If dependencies changed, review the owning manifest/lockfile, advisories, license, and compatibility impact.
- If schema changed, verify the migration, generated Prisma client, fixtures, schema documentation, and CI schema-drift check.

## Blocking validation
Use `testing-strategy.md` as the canonical gate list. Before a release, run the applicable backend lint/build/typecheck/tier/unit/integration/heavy gates, frontend lint/build/unit gates, E2E, and `pnpm run verify:steering`. Do not replace the tiered commands with an unqualified `pnpm test`, and never bypass failures with `|| true` or `continue-on-error`.

For security-sensitive dependency changes, review the current workflow audit/allowlist behavior and `.security-audit-allowlist.json`; do not claim a clean audit unless the same workflow gate passes.

## Deployment observation
- Inspect the GitHub Actions run and required job dependencies.
- After ACC or approved PRD deployment, run the bounded deployment health check, verify `/api/health`, and perform frontend/login smoke checks.
- Review PM2/deploy logs and preserve failure artifacts before retrying.

## Rollback
Follow `environments-and-deployment.md`, `docs/guides/operations/TROUBLESHOOTING.md`, and `app/scripts/restore.sh`. The pre-migration backup is the rollback boundary; database restore is destructive and requires explicit confirmation. Do not improvise a reset, direct-main push, or destructive recovery command.
