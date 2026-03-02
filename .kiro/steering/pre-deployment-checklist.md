---
inclusion: always
---

# Pre-Deployment Checklist

## Critical Checks Before Pushing to Main

**Important**: Pushing to `main` branch triggers automatic deployment to ACC environment.

### Required Verifications

1. **Tests Pass Locally**
   - Run: `cd prototype/backend && npm test`
   - Verify: All tests pass (no failures allowed)
   - Check: Coverage meets minimum thresholds (80% general, 90% critical)
   - Run: `npm test -- --coverage` to verify coverage
   - Confirm: All new code has accompanying tests

2. **No Debug Code in Production**
   - Search for: `console.log`, `console.debug`, `console.warn`
   - Remove: All debugging statements from production code
   - Exception: Intentional logging via proper logging framework

3. **Environment Variables Documented**
   - Check: All new environment variables added to `.env.example`
   - Verify: Documentation updated if new variables required
   - Confirm: No secrets committed to repository

4. **Database Migrations Tested**
   - Run: `npx prisma migrate deploy` locally
   - Verify: Migration applies successfully
   - Check: No data loss or breaking changes
   - Update: `docs/prd_core/DATABASE_SCHEMA.md` if schema changed

5. **Documentation Updated**
   - Review: Affected PRD documents in docs/prd_core/ or docs/prd_pages/
   - Update: API documentation if endpoints changed
   - Document: Any breaking changes or new features
   - Check: README files current for modified modules

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
