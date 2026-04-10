---
inclusion: manual
---

# Pre-Deployment Checklist

## Critical Checks Before Pushing to Main

**Important**: Pushing to `main` branch triggers automatic deployment to ACC environment.

### Required Verifications

1. **Backend Tests Pass Locally**
   - Run: `cd app/backend && npm test`
   - Verify: All tests pass (no failures allowed)
   - Check: Coverage meets minimum thresholds (80% general, 90% critical)
   - Run: `npm test -- --coverage` to verify coverage
   - Confirm: All new code has accompanying tests
   - **CRITICAL**: Do not push if any backend tests fail

2. **Frontend Tests Pass Locally**
   - Run: `cd app/frontend && npx vitest --run` (unit/component tests)
   - Verify: All frontend unit tests pass
   - E2E tests: CI now runs a fully provisioned E2E job (`e2e-tests`) that blocks deployment on failure — local E2E runs are optional but recommended before pushing large UI changes
   - Optional local E2E: `cd app/frontend && npx playwright test`
   - **CRITICAL**: CI will block the pipeline if any E2E test fails, so frontend regressions are caught automatically

3. **No Debug Code in Production**
   - Search for: `console.log`, `console.debug`, `console.warn`
   - Remove: All debugging statements from production code
   - Exception: Intentional logging via proper logging framework
   - Frontend: Wrap debug logs with `if (import.meta.env.DEV)` checks

4. **Environment Variables Documented**
   - Check: All new environment variables added to `.env.example`
   - Verify: Documentation updated if new variables required
   - Confirm: No secrets committed to repository

5. **Database Migrations Tested**
   - Run: `npx prisma migrate deploy` locally
   - Verify: Migration applies successfully
   - Check: No data loss or breaking changes
   - Update: `docs/prd_core/DATABASE_SCHEMA.md` if schema changed

6. **Documentation Updated**
   - Review: Affected PRD documents in docs/prd_core/ or docs/prd_pages/
   - Update: API documentation if endpoints changed
   - Document: Any breaking changes or new features
   - Check: README files current for modified modules

7. **Security Scanning Passes**
   - Run: `cd app/backend && npm audit --audit-level=high`
   - Verify: No high or critical vulnerabilities (or all are in `.security-audit-allowlist.json` with valid justification)
   - Run: `cd app/backend && npm run lint`
   - Verify: No ESLint security rule violations (`eslint-plugin-security` errors block CI)
   - Review: `.security-audit-allowlist.json` — check that all entries have a `nextReviewDate` in the future
   - Confirm: No new dependencies added without `npm audit` check

## Pre-Push Command Sequence

**Run these commands in order before pushing to main**:

```bash
# 1. Backend tests
cd app/backend
npm test

# 2. Security scanning
npm audit --audit-level=high
npm run lint

# 3. Frontend unit tests
cd ../frontend
npx vitest --run

# 4. Optional: E2E tests (CI runs these automatically)
# npx playwright test

# 5. If all pass, commit and push
cd ../..
git add -A
git commit -m "your commit message"
git push origin main
```

**STOP if either test suite fails. Fix issues before pushing.**

## Deployment Process

After verification:
1. Commit changes with descriptive message
2. Push to `main` branch
3. Monitor GitHub Actions for deployment status
4. Verify ACC deployment successful via smoke tests
5. Test functionality on ACC environment

## Rollback Procedure

If deployment fails:
1. Check GitHub Actions logs for error details
2. Database automatically backed up before migration
3. Contact team lead for rollback if needed
4. Fix issues locally and redeploy
