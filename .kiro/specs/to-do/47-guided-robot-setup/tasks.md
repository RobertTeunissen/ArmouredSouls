# Implementation Plan: Guided New Robot Setup Workflow

## Overview

This plan implements Spec #47 — a 7-step setup wizard triggered after robot creation (non-onboarding path), a persistent eligibility checklist on the Robot Detail Page, and a backend scheduling eligibility endpoint. No new database tables. 9 task groups, 30 tasks.

## Task Dependency Graph

```json
{
  "waves": [
    {"name": "Wave 1 — Backend + Hook", "tasks": ["Task Group 1", "Task Group 2"]},
    {"name": "Wave 2 — Wizard Shell + Checklist", "tasks": ["Task Group 3", "Task Group 6"]},
    {"name": "Wave 3 — Step Components + Dashboard", "tasks": ["Task Group 4", "Task Group 5", "Task Group 7"]},
    {"name": "Wave 4 — Documentation", "tasks": ["Task Group 8"]},
    {"name": "Wave 5 — Verification", "tasks": ["Task Group 9"]}
  ]
}
```

- **Wave 1**: Backend service (TG1) and wizard hook (TG2) — no dependencies, parallel.
- **Wave 2**: Wizard shell (TG3) depends on TG1+TG2. Eligibility checklist (TG6) depends on TG1 only.
- **Wave 3**: Step components (TG4, TG5) depend on TG3. Dashboard notification (TG7) is independent but logically follows TG6.
- **Wave 4**: Documentation (TG8) — done after all code is complete.
- **Wave 5**: Verification (TG9) — runs all checks after everything is in place.

## Tasks

### Task Group 1: Backend — Scheduling Eligibility Service and Endpoint

_Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 1.1 Create `app/backend/src/services/robot/robotSchedulingEligibilityService.ts` with `computeSchedulingEligibility(robotId)` function that returns a `SchedulingEligibilityReport` with exactly 3 gates (`weapon_equipped`, `event_subscribed`, `tuning_allocated`), delegating to `checkSchedulingReadiness()` for weapon check, querying `subscription` table for active count, and querying `tuningAllocation` for existence
- [x] 1.2 Add `GET /:id/scheduling-eligibility` route handler in `app/backend/src/routes/robots.ts` with `authenticateToken`, `validateRequest({ params: robotIdParamsSchema })`, `verifyRobotOwnership`, returning 403 for non-owners, 404 for missing robots, and 200 with the report
- [x] 1.3 Write unit tests in `app/backend/src/services/robot/__tests__/robotSchedulingEligibilityService.test.ts` covering: each gate independently, all gates met, no gates met, hard-only met (isEligible true, isFullyConfigured false), and verifying no write operations occur
- [x] 1.4 Write property-based tests with fast-check covering: eligibility consistency (random robot states → isEligible matches formula), gate completeness (always 3 gates with correct IDs), and no side effects (no Prisma writes)

### Task Group 2: Frontend — useRobotSetupWizard Hook

_Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

- [x] 2.1 Create `app/frontend/src/components/robot-setup/useRobotSetupWizard.ts` implementing the `useRobotSetupWizard(robotId)` hook with localStorage persistence under key `robot-setup-${robotId}`, state containing `currentStep`, `completedSteps`, `skippedSteps`, and methods `advance()`, `skipStep()`, `skipAll()`, `reset()`
- [x] 2.2 Implement graceful degradation when localStorage is unavailable (try/catch around read/write, fall back to in-memory state starting at step 1)
- [x] 2.3 Write unit tests in `app/frontend/src/components/robot-setup/__tests__/useRobotSetupWizard.test.ts` covering: initial state, resume from localStorage, advance increments step and appends to completedSteps, skipStep increments and appends to skippedSteps, skipAll clears storage, isComplete when step > 7, localStorage unavailable fallback

### Task Group 3: Frontend — RobotSetupWizard Shell and Route

_Requirements: 3.1, 3.2, 3.3, 4.5, 4.6, 5.1, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 10.4, 11.1, 11.2, 11.3_

- [x] 3.1 Add route `/robots/:id/setup` to the app router (protected, lazy-loaded) rendering `RobotSetupWizardPage`
- [x] 3.2 Create `app/frontend/src/components/robot-setup/RobotSetupWizard.tsx` — shell component that: fetches eligibility report on mount, uses `useRobotSetupWizard` hook, renders compact progress dots at top, active step card in middle, sticky bottom action bar with Next/Skip/Back buttons (min-h-[44px])
- [x] 3.3 Implement step rendering in fixed order (1-Portrait, 2-Weapon, 3-BattleConfig, 4-Tuning, 5-Team, 6-Subscriptions, 7-Attributes) using lazy-loaded step components
- [x] 3.4 Implement completion/skip-all behavior: clear localStorage, navigate to `/robots/:id`
- [x] 3.5 Implement "already fully configured" detection: when eligibility report shows `isFullyConfigured === true` on mount, redirect to `/robots/:id`
- [x] 3.6 Implement error state for 404/403 responses from the eligibility endpoint
- [x] 3.7 Implement mobile-first layout: single-column, no horizontal scroll ≥ 320px, `animate-fade-in` step transitions respecting `prefers-reduced-motion`, desktop centered with `max-w-2xl mx-auto`
- [x] 3.8 Modify `CreateRobotPage.tsx`: change the non-onboarding success path from `navigate(\`/robots/${data.robot.id}\`)` to `navigate(\`/robots/${data.robot.id}/setup\`, { replace: true })`
- [x] 3.9 Write component tests in `app/frontend/src/components/robot-setup/__tests__/RobotSetupWizard.test.tsx` covering: renders first step, advances on next, skips on skip, navigates away on skip-all, resumes from localStorage, shows error on 403/404, redirects when already configured

### Task Group 4: Frontend — Step Components (Steps 1–3)

_Requirements: 5.2, 5.3, 5.4, 6.1, 6.2, 6.3, 9.4, 9.5, 10.1, 10.2_

- [x] 4.1 Create `app/frontend/src/components/robot-setup/steps/PortraitStep.tsx` wrapping `RobotImageSelector` with wizard framing, portrait grid `grid-cols-3` mobile / `grid-cols-4` desktop, calling `PATCH /api/robots/:id/image` on selection, with onComplete/onSkip callbacks
- [x] 4.2 Create `app/frontend/src/components/robot-setup/steps/WeaponEquipStep.tsx` with three sub-states: (a) owns compatible weapons → show equip picker using `WeaponSelectionModal` pattern, (b) has storage + credits → inline filtered shop with buy-and-equip calling `POST /api/weapon-inventory/purchase` then `PUT /api/robots/:id/equip-main-weapon`, (c) storage full → warning with link to facilities. Weapon grid `grid-cols-1` mobile / `grid-cols-2` desktop
- [x] 4.3 Create `app/frontend/src/components/robot-setup/steps/BattleConfigStep.tsx` combining `StanceSelector` (top) and `YieldThresholdSlider` (bottom) on one screen, calling `PATCH /api/robots/:id/stance` and `PATCH /api/robots/:id/yield-threshold` on changes
- [x] 4.4 Write component tests for PortraitStep, WeaponEquipStep (all 3 sub-states), and BattleConfigStep

### Task Group 5: Frontend — Step Components (Steps 4–7)

_Requirements: 5.5, 5.6, 5.7, 5.8, 6.1, 6.2, 10.3, 10.5_

- [x] 5.1 Create `app/frontend/src/components/robot-setup/steps/TuningAllocationStep.tsx` showing pool size summary, quick-allocate option, and "do this later" skip link
- [x] 5.2 Create `app/frontend/src/components/robot-setup/steps/TeamAssignmentStep.tsx` fetching teams via `getMyTeamBattles()`, showing teams with open slots, offering inline team creation via `registerTeamBattle()`, handling "not enough robots" and "no open slots" states
- [x] 5.3 Create `app/frontend/src/components/robot-setup/steps/EventSubscriptionStep.tsx` using `useSubscriptionStore` data, rendering event checklist with cap indicator, pre-checking relevant team events if robot was just assigned to a team, calling `PUT /api/subscriptions/robot/:robotId`
- [x] 5.4 Create `app/frontend/src/components/robot-setup/steps/AttributeUpgradeStep.tsx` showing affordable upgrades with current credits, fully skippable
- [x] 5.5 Write component tests for TuningAllocationStep, TeamAssignmentStep (with/without open slots, not enough robots), EventSubscriptionStep (cap reached state), and AttributeUpgradeStep

### Task Group 6: Frontend — RobotEligibilityChecklist on Robot Detail Page

_Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 8.2, 9.7_

- [x] 6.1 Create `app/frontend/src/components/robot-setup/RobotEligibilityChecklist.tsx` that fetches `GET /api/robots/:id/scheduling-eligibility`, renders warning banner (following `TeamBattleReadinessWarning` pattern: `bg-warning/10 border-l-4 border-warning`) for unmet hard gates with action links, info-level recommendations for soft gates, hides when `isFullyConfigured`, includes "Complete Setup" button linking to `/robots/:id/setup`
- [x] 6.2 Integrate `RobotEligibilityChecklist` into `RobotDetailPage.tsx` — render above `TabNavigation` only when `isOwner === true` and the robot does not belong to a Generated_Stable
- [x] 6.3 Implement mobile layout: full-width card, stacked gate items, action buttons `w-full sm:w-auto`, all touch targets ≥ 44px
- [x] 6.4 Write component tests in `app/frontend/src/components/robot-setup/__tests__/RobotEligibilityChecklist.test.tsx` covering: renders hard-gate warnings, renders soft recommendations, hides when fully configured, hides for non-owners, "Complete Setup" button navigates correctly

### Task Group 7: Dashboard Notification Extension

_Requirements: 7.2_

- [x] 7.1 Extend `generateNotifications()` in `DashboardPage.tsx` to also flag robots with zero active subscriptions (currently only checks HP and weapon). Add a notification with type `'warning'`, message like "Robot X has no event subscriptions", action navigating to `/robots/:id/setup` or `/subscriptions`

### Task Group 8: Documentation Updates

_Requirements: (Documentation impact from design)_

- [x] 8.1 Update `.kiro/steering/project-overview.md` — add "Guided Robot Setup" as item 20 in the Key Systems list with a brief description referencing this spec
- [x] 8.2 Create `docs/game-systems/PRD_ROBOT_SETUP_WIZARD.md` documenting: the 7-step wizard flow, eligibility gate system (hard/soft), the scheduling-eligibility endpoint, mobile-first design decisions, and relationship to onboarding
- [x] 8.3 Update `docs/prd_pages/` — create or update the robot creation page PRD to reference the post-creation wizard navigation

### Task Group 9: Verification

_Requirements: All (verification criteria from requirements)_

- [x] 9.1 Run all verification criteria from the requirements document: grep checks for localStorage key pattern, route registration, service function, component imports, `{ replace: true }` usage
- [~] 9.2 Run backend unit tests: `cd app/backend && pnpm run test:unit -- --testPathPattern="robotSchedulingEligibility"`
- [~] 9.3 Run frontend tests: `cd app/frontend && pnpm test -- --run` and confirm RobotSetupWizard, RobotEligibilityChecklist, and useRobotSetupWizard test suites pass
- [x] 9.4 Verify `get_diagnostics` reports no errors on all new and modified files

## Notes

- Task Groups 1 and 2 have no dependencies and can be worked in parallel.
- Task Groups 4 and 5 can also be parallelized (different step components, no shared state).
- Task Group 6 depends only on Task Group 1 (the backend endpoint) and can be worked independently of the wizard shell.
- All step components reuse existing UI components and API endpoints — no new backend work beyond Task Group 1.
