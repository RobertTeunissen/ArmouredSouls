# ONBOARDING SYSTEM TROUBLESHOOTING GUIDE

## Overview

Quick reference for diagnosing and fixing issues with the New Player Onboarding System (5-step interactive tutorial; backend internally uses steps 1-9). Covers stuck states, display issues, reset problems, and manual database fixes.

**Key files**:
- Backend service: `app/backend/src/services/onboardingService.ts`
- Backend routes: `app/backend/src/routes/onboarding.ts`
- Analytics service: `app/backend/src/services/onboardingAnalyticsService.ts`
- Error definitions: `app/backend/src/errors/onboardingErrors.ts`
- Frontend orchestrator: `app/frontend/src/components/onboarding/OnboardingContainer.tsx`
- Frontend context: `app/frontend/src/contexts/OnboardingContext.tsx`

**Related docs**:
- [PRD_ONBOARDING_SYSTEM.md](../prd_core/PRD_ONBOARDING_SYSTEM.md)
- [ONBOARDING_IMPLEMENTATION_NOTES.md](../implementation_notes/ONBOARDING_IMPLEMENTATION_NOTES.md)

---

## Common Issues and Solutions

### 1. Player Stuck on a Step (Can't Advance)

**Symptom**: Player clicks "Next" but nothing happens, or the button is disabled.

**Cause**: Steps 5, 7, and 8 (backend internal steps) require real actions before advancing:
- **Step 5 (internal)**: Must create the required number of robots (1, 2, or 3 depending on strategy)
- **Step 7 (internal)**: Must purchase at least one weapon
- **Step 8 (internal)**: Must equip a weapon to a robot

**Solution**: Check what the step requires and guide the player to complete the action. The "Continue" button enables only after the required API call succeeds.

**Manual fix** (if the action was completed but state didn't update):
```sql
UPDATE users SET onboarding_step = <nextStep> WHERE id = <userId>;
```

Or use Prisma Studio:
```bash
cd app/backend
npx prisma studio
```
Navigate to User table → find user → update `onboardingStep`.

---

### 2. Onboarding Not Showing for New Player

**Symptom**: New player registers but lands on the regular dashboard instead of the tutorial.

**Cause**: `hasCompletedOnboarding` may be incorrectly set to `true`, or the frontend redirect logic in `DashboardPage.tsx` isn't triggering.

**Diagnosis**:
```sql
SELECT id, username, has_completed_onboarding, onboarding_skipped, onboarding_step
FROM users WHERE id = <userId>;
```

**Expected for new player**: `has_completed_onboarding = false`, `onboarding_skipped = false`, `onboarding_step = 1`

**Fix**:
```sql
UPDATE users SET
  has_completed_onboarding = false,
  onboarding_skipped = false,
  onboarding_step = 1
WHERE id = <userId>;
```

If the values are already correct, check the frontend — the dashboard integration checks `hasCompletedOnboarding` to decide whether to show the tutorial CTA or the regular welcome section.

---

### 3. Onboarding Keeps Showing for Existing Player

**Symptom**: Player who has been playing for a while keeps seeing the tutorial prompt on the dashboard.

**Cause**: The `add_onboarding_tracking` migration didn't run correctly, or the user was created after migration but before the code deployment that sets `hasCompletedOnboarding = true` for existing users.

**Fix**:
```sql
UPDATE users SET has_completed_onboarding = true WHERE id = <userId>;
```

**Bulk fix** (if multiple existing players are affected):
```sql
-- Mark all users who have robots as completed (they clearly aren't new)
UPDATE users SET has_completed_onboarding = true
WHERE id IN (SELECT DISTINCT "userId" FROM robots)
  AND has_completed_onboarding = false;
```

---

### 4. Budget Tracker Shows Wrong Amount

**Symptom**: The budget sidebar (visible during the Facilities and Battle-Ready steps) shows a credit balance that doesn't match the player's actual credits.

**Cause**: Frontend `BudgetTracker` state is out of sync with the backend. This can happen if the player made purchases in another tab or if an API call succeeded but the local state update failed.

**Solution**: Hard refresh the page (Ctrl+Shift+R) to re-fetch state from the backend.

**If it persists**, check the actual credit balance:
```sql
SELECT id, username, credits FROM users WHERE id = <userId>;
```

Compare with what the frontend is displaying. If the DB value is correct, the issue is in the frontend state hydration.

---

### 5. "RESET" Confirmation Not Working

**Symptom**: Player types "RESET" in the reset confirmation modal but the button stays disabled or returns an error.

**Cause**: The confirmation match is case-sensitive and exact. Player may be typing "Reset", "reset", or "RESET " (with trailing space).

**Solution**: Must type exactly `RESET` — all uppercase, no spaces before or after.

**Backend validation** (in `onboardingService.ts`):
```typescript
if (confirmation !== "RESET") {
  throw new OnboardingError("INVALID_RESET_CONFIRMATION", ...);
}
```

---

### 6. Reset Blocked but No Obvious Active Commitments

**Symptom**: Player tries to reset but gets `RESET_BLOCKED` error. They claim they have no active matches or tournaments.

**Cause**: Stale data — a match or tournament may have completed but the eligibility check is using cached data, or there are pending battle results that haven't been processed yet.

**Diagnosis**:
```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3001/api/onboarding/reset-eligibility
```

The response includes specific blockers. Check each one:
```sql
-- Check for scheduled matches
SELECT * FROM matchmaking_queue WHERE robot_id IN (
  SELECT id FROM robots WHERE "userId" = <userId>
);

-- Check for active tournaments
SELECT * FROM tournament_participants tp
JOIN tournaments t ON tp.tournament_id = t.id
WHERE tp.user_id = <userId> AND t.status != 'completed';

-- Check for pending battles
SELECT * FROM battles
WHERE (robot1_id IN (SELECT id FROM robots WHERE "userId" = <userId>)
   OR robot2_id IN (SELECT id FROM robots WHERE "userId" = <userId>))
  AND status = 'pending';
```

**Solution**: Wait for the current cycle to complete and retry. If the data is genuinely stale, an admin can override by updating the user's state directly in the database (see Section 4 below).

---

### 7. Analytics Events Not Being Recorded

**Symptom**: Onboarding analytics dashboard shows no data, or funnel analysis has gaps.

**Cause**: `POST /api/onboarding/analytics` endpoint may be failing silently. The frontend batches events and sends them — if the endpoint errors, events are lost.

**Diagnosis**:
1. Check backend logs for errors on the analytics endpoint
2. Test the endpoint directly:
```bash
curl -X POST http://localhost:3001/api/onboarding/analytics \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"event": "step_entered", "data": {"step": 1, "timestamp": "2026-03-02T10:00:00Z"}}'
```

3. Verify `onboardingAnalyticsService` is properly initialized (check for import/startup errors in PM2 logs)

---

### 8. Step Components Not Loading (Blank Screen)

**Symptom**: Player navigates to a step and sees a blank area where the step content should be.

**Cause**: Step components are lazy-loaded via `React.lazy()`. A network issue or build error can cause chunk loading to fail.

**Diagnosis**:
1. Open browser console (F12) — look for chunk loading errors like `ChunkLoadError` or `Loading chunk X failed`
2. Check the Network tab for failed requests to `.js` chunk files

**Solution**:
- Hard refresh (Ctrl+Shift+R) to retry chunk loading
- If it persists, verify the build includes all step component chunks:
```bash
cd app/frontend
npm run build
ls dist/assets/*.js | wc -l  # Should include step chunks
```
- The `OnboardingErrorBoundary` should catch this and offer a "Retry" button, then a "Skip to Dashboard" fallback

---

### 9. Onboarding State Lost After Login

**Symptom**: Player logs out and back in, and their onboarding progress resets to Step 1.

**Cause**: State is fetched from the backend via `GET /api/onboarding/state` on login. If this endpoint fails, the `OnboardingContext` defaults to Step 1.

**Diagnosis**:
1. Check backend logs for errors on the state endpoint
2. Verify the user's actual state in the database:
```sql
SELECT onboarding_step, onboarding_strategy, onboarding_choices,
       has_completed_onboarding, onboarding_skipped
FROM users WHERE id = <userId>;
```

**If DB shows correct step but frontend resets**: The API call is failing. Check network errors, JWT expiration, or CORS issues.

**If DB shows step = 1**: The state was actually reset — check if a reset was triggered, or if the debounced state sync (500ms) wrote back a stale value before logout.

---

## Reset Eligibility Blockers

The `GET /api/onboarding/reset-eligibility` endpoint checks these conditions before allowing a reset:

| Blocker | Description | How to Check |
|---------|-------------|--------------|
| Scheduled matches | Robot is in the matchmaking queue for an upcoming cycle | `SELECT * FROM matchmaking_queue WHERE robot_id IN (SELECT id FROM robots WHERE "userId" = <userId>)` |
| Active tournaments | Player is enrolled in a tournament that hasn't concluded | Check `tournament_participants` joined with `tournaments` where status ≠ 'completed' |
| Pending battles | Battle results haven't been processed yet | Check `battles` with status = 'pending' for user's robots |
| Rate limit | Maximum 3 resets per 30-day rolling window | `SELECT COUNT(*) FROM reset_logs WHERE user_id = <userId> AND reset_at > NOW() - INTERVAL '30 days'` |

**Manual override (admin)**: If a blocker is stale or incorrect, an admin can bypass eligibility checks by updating the user's state directly in the database and logging the action manually in `reset_logs`.

---

## Manually Fixing Stuck Tutorial States

### Reset Onboarding to Step 1

```sql
UPDATE users SET
  onboarding_step = 1,
  has_completed_onboarding = false,
  onboarding_skipped = false,
  onboarding_strategy = NULL,
  onboarding_choices = '{}',
  onboarding_started_at = NULL,
  onboarding_completed_at = NULL
WHERE id = <userId>;
```

### Force-Complete Onboarding

```sql
UPDATE users SET
  has_completed_onboarding = true,
  onboarding_completed_at = NOW()
WHERE id = <userId>;
```

### Skip to a Specific Step

```sql
UPDATE users SET onboarding_step = <stepNumber> WHERE id = <userId>;
```

⚠️ **Warning**: This bypasses step validation. Internal steps 5, 7, and 8 expect the player to have completed real actions (robot creation, weapon purchase, weapon equipping). Skipping to these steps without the prerequisite data may cause errors.

### Clear Reset Rate Limit (Admin Only)

```sql
DELETE FROM reset_logs
WHERE user_id = <userId>
  AND reset_at > NOW() - INTERVAL '30 days';
```

### Using Prisma Studio

```bash
cd app/backend
npx prisma studio
```

Navigate to the **User** table, find the user by ID or username, and edit onboarding fields directly. Changes save immediately.

---

## Backend Error Codes

| Code | HTTP Status | Meaning | Action |
|------|-------------|---------|--------|
| `TUTORIAL_STATE_NOT_FOUND` | 404 | No onboarding state for user. Auto-initializes on first call. | Should not persist. If it does, check DB connection and that the user record exists. |
| `INVALID_STEP_TRANSITION` | 400 | Player tried to skip ahead (e.g., jump from Step 2 to Step 5). | Frontend should prevent this. If it occurs, check `OnboardingContext` reducer logic. |
| `RESET_BLOCKED` | 403 | Active commitments prevent reset. | Response body includes specific blockers. See Reset Eligibility Blockers section above. |
| `INVALID_RESET_CONFIRMATION` | 400 | Confirmation text doesn't match "RESET" exactly. | Inform player: must be all caps, no spaces. |
| `RESET_RATE_LIMITED` | 429 | Exceeded 3 resets in 30-day rolling window. | Player must wait. Admin can clear rate limit (see manual fixes above). |

---

## Diagnostic Queries

### Count Users by Onboarding Status

```sql
SELECT
  CASE
    WHEN has_completed_onboarding = true THEN 'Completed'
    WHEN onboarding_skipped = true THEN 'Skipped'
    ELSE 'In Progress (Step ' || onboarding_step || ')'
  END AS status,
  COUNT(*) AS user_count
FROM users
GROUP BY status
ORDER BY user_count DESC;
```

### Find Users Stuck on a Step for More Than X Days

```sql
SELECT id, username, onboarding_step, onboarding_started_at,
       NOW() - onboarding_started_at AS time_stuck
FROM users
WHERE has_completed_onboarding = false
  AND onboarding_skipped = false
  AND onboarding_started_at < NOW() - INTERVAL '7 days'
ORDER BY onboarding_started_at ASC;
```

### Check Reset History for a User

```sql
SELECT id, robots_deleted, weapons_deleted, facilities_deleted,
       credits_before_reset, reason, reset_at
FROM reset_logs
WHERE user_id = <userId>
ORDER BY reset_at DESC;
```

### Verify Migration Ran Correctly

All pre-existing users (those who had robots before the migration) should be marked as completed:

```sql
-- Users with robots but NOT marked as completed = migration issue
SELECT u.id, u.username, u.has_completed_onboarding, COUNT(r.id) AS robot_count
FROM users u
JOIN robots r ON r."userId" = u.id
WHERE u.has_completed_onboarding = false
  AND u.onboarding_skipped = false
GROUP BY u.id, u.username, u.has_completed_onboarding;
```

**If this returns rows**, the data migration didn't cover all existing users. Fix with:
```sql
UPDATE users SET has_completed_onboarding = true
WHERE id IN (SELECT DISTINCT "userId" FROM robots)
  AND has_completed_onboarding = false;
```

### Check Strategy Distribution (Analytics Health)

```sql
SELECT onboarding_strategy, COUNT(*) AS count
FROM users
WHERE onboarding_strategy IS NOT NULL
GROUP BY onboarding_strategy
ORDER BY count DESC;
```

If one strategy has >60% of selections, the onboarding recommendations may need rebalancing.

---

## Quick Debugging Flow

When a player reports an onboarding issue:

1. **Get their user ID** (from username or email)
2. **Check their onboarding state**:
   ```sql
   SELECT id, username, onboarding_step, has_completed_onboarding,
          onboarding_skipped, onboarding_strategy, onboarding_choices
   FROM users WHERE id = <userId>;
   ```
3. **Check backend logs** for errors with their user ID:
   ```bash
   pm2 logs armouredsouls-backend --lines 200 | grep <userId>
   ```
4. **Check the specific endpoint** they're hitting (state, complete, skip, reset)
5. **Apply the appropriate fix** from the sections above
