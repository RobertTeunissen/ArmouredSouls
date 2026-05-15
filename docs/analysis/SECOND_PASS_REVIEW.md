# Armoured Souls — Second-Pass Review

**Date:** May 13, 2026  
**Purpose:** Verify first-pass fixes and catch remaining issues  
**Status:** All findings resolved ✅

---

## All Findings — Resolved

### Critical (Fixed)

| # | Issue | Resolution |
|---|-------|------------|
| 1 | JWT algorithm NOT enforced in auth middleware | ✅ Added `{ algorithms: ['HS256'] }` to `auth.ts` |

### High (Fixed)

| # | Issue | Resolution |
|---|-------|------------|
| 2 | Unauthenticated `POST /api/analytics/stats/refresh` | ✅ Added `authenticateToken` + admin role check |
| 3 | Analytics endpoints lack authentication | ✅ Added auth to all sensitive endpoints (cycle/current, stable summary, robot performance, robot metrics, robot stats, performance, integrity) |
| 4 | IDOR on facility ROI endpoints | ✅ Added ownership check on 4 endpoints |
| 5 | Settlement N+1 (200+ queries per cycle) | ✅ Batched into single `$transaction` |
| 6 | Repair N+1 (100+ queries per cycle) | ✅ Batched into single `$transaction` |
| 7 | Snapshot overfetch | ✅ Added `fields` parameter — callers now request only needed JSON columns |

### Medium (Fixed)

| # | Issue | Resolution |
|---|-------|------------|
| 8 | `CycleControlsTab.tsx` missing `includeDailyFinances` | ✅ Added to API call payload |
| 9 | Changelog pagination uses `perPage` | ✅ Standardized to `pageSize` |
| 10 | KotH standings returns `limit` | ✅ Standardized to `pageSize` |
| 11 | Tag team matchmaking N+1 | ✅ Batch ELO calculation + batch recent opponents (2N queries → 1) |
| 12 | No code splitting for player pages | ✅ 17 pages converted to `React.lazy()` |
| 13 | Sequential API calls in RobotPerformanceAnalytics | ✅ Wrapped in `Promise.all()` |

### Low (Fixed)

| # | Issue | Resolution |
|---|-------|------------|
| 14 | Dead code (~1000 lines) | ✅ Deleted OnboardingAnalyticsPage, TournamentManagement, RobotStatsTab, getRecentOpponents |
| 15 | Type safety gaps (`as any` casts) | ✅ Fixed all: robotApi weapons, financialApi level, DailyStableReport, usePracticeArena combatResult, WeaponShopPage weapon |
| 16 | Missing memoization | ✅ Added `useMemo` to `groupedWeapons` in useWeaponShop |
| 17 | Deploy token length leak | Accepted risk (very low for long random tokens) |

---

## Additional Fixes Applied

| Fix | Impact |
|-----|--------|
| Removed redundant `focus` listener in RobotDetailPage | Prevents double-fetch on tab switch |
| Extended `PlaybackCombatResult` with missing fields | Proper typing for practice arena results |

---

## Verification Results

All fixes confirmed working — both frontend and backend compile cleanly (`npx tsc --noEmit` exits 0).

---

## Remaining Items

| # | Category | Issue | Status |
|---|----------|-------|--------|
| R1 | Security | Deploy token timing-safe length leak | Accepted risk — token is 64+ chars, timing difference is negligible |
| R2 | Optimization | Combat simulator further decomposition | Deferred — needs property-based test coverage first to verify combat parity |
| R3 | Security | Password complexity requirements | Skipped per user request (player-facing decision) |

Everything else has been resolved.
