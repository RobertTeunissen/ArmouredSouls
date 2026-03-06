# New Player Onboarding — ACC Deployment Checklist

Deployment is triggered by pushing to `main`. GitHub Actions runs the full pipeline before deploying to ACC.

---

## 1. Pre-Deployment Checks

### Backend
- [ ] All onboarding tests pass: `npx jest --maxWorkers=1 tests/onboarding tests/onboardingReset tests/onboardingAnalytics`
- [ ] No `console.log` / `console.debug` statements in production code

### Frontend
- [ ] All onboarding tests pass: `npx vitest run src/components/onboarding src/contexts/__tests__/OnboardingContext src/utils/__tests__/onboarding`
- [ ] All 21 SVG placeholder images present in `prototype/frontend/public/assets/onboarding/`

### Database
- [ ] Migration `20260304200102_add_onboarding_tracking` applies cleanly locally
- [ ] All 7 onboarding columns exist on `users` table after migration
- [ ] `reset_logs` table exists with correct schema

### Documentation
- [ ] `docs/prd_core/PRD_ONBOARDING_SYSTEM.md` updated
- [ ] `docs/implementation_notes/ONBOARDING_IMPLEMENTATION_NOTES.md` updated
- [ ] `docs/guides/ONBOARDING_ANALYTICS_GUIDE.md` updated
- [ ] `docs/troubleshooting/ONBOARDING_TROUBLESHOOTING.md` updated
- [ ] PRD pages updated: Dashboard, Robot Detail, Facilities, Weapon Shop, Database Schema

---

## 2. Database Migration

**Migration**: `20260304200102_add_onboarding_tracking`

**Changes** (all non-breaking, all columns have defaults):

| Column | Type | Default |
|--------|------|---------|
| `has_completed_onboarding` | Boolean | `false` |
| `onboarding_step` | Int | `0` |
| `onboarding_skipped` | Boolean | `false` |
| `onboarding_started_at` | DateTime? | `null` |
| `onboarding_completed_at` | DateTime? | `null` |
| `onboarding_skipped_at` | DateTime? | `null` |
| `account_reset_count` | Int | `0` |

**New table**: `reset_logs` — tracks account reset history.

**Data migration**: All existing users are marked `has_completed_onboarding = true` so they are not affected.

**Rollback SQL**:
```sql
ALTER TABLE users
  DROP COLUMN IF EXISTS has_completed_onboarding,
  DROP COLUMN IF EXISTS onboarding_step,
  DROP COLUMN IF EXISTS onboarding_skipped,
  DROP COLUMN IF EXISTS onboarding_started_at,
  DROP COLUMN IF EXISTS onboarding_completed_at,
  DROP COLUMN IF EXISTS onboarding_skipped_at,
  DROP COLUMN IF EXISTS account_reset_count;

DROP TABLE IF EXISTS reset_logs;
```

---

## 3. Deployment Steps

- [ ] Push to `main` branch
- [ ] Monitor GitHub Actions pipeline (expected ~5 min)
- [ ] Verify migration applies on ACC database
- [ ] Verify frontend build succeeds
- [ ] Verify backend starts without errors

---

## 4. Post-Deployment Verification

- [ ] Health check: `curl https://acc.armouredsouls.com/api/health`
- [ ] Verify existing users have `hasCompletedOnboarding = true`
- [ ] Register a new test user → onboarding triggers on dashboard
- [ ] Complete full 9-step tutorial flow
- [ ] Test skip functionality
- [ ] Test resume after logout/login
- [ ] Test reset account functionality
- [ ] Verify onboarding API endpoints respond correctly (see section 6)
- [ ] Check PM2 logs for errors: `pm2 logs armouredsouls-backend`

---

## 5. Rollback Procedure

| Scenario | Action |
|----------|--------|
| Migration fails | Database is backed up automatically pre-migration; restore from backup |
| Backend errors after deploy | `pm2 restart armouredsouls-backend` |
| Critical issues | Revert the commit, push to `main` again |
| Database rollback needed | Run the rollback SQL from section 2 |

---

## 6. New API Endpoints

All additions are non-breaking — no existing endpoints are modified.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/onboarding/state` | Get current onboarding state |
| POST | `/api/onboarding/state` | Update onboarding step |
| POST | `/api/onboarding/complete` | Mark onboarding complete |
| POST | `/api/onboarding/skip` | Skip onboarding |
| GET | `/api/onboarding/recommendations` | Get step recommendations |
| POST | `/api/onboarding/reset-account` | Reset user account |
| GET | `/api/onboarding/reset-eligibility` | Check reset eligibility |
| POST | `/api/onboarding/analytics` | Submit analytics event |
