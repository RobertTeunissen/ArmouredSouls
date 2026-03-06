# Onboarding System Implementation Notes

**Last Updated**: March 2, 2026  
**Status**: Authoritative Reference

## Overview

The New Player Onboarding System is a 9-step interactive tutorial that guides new players through strategic decisions about roster composition, facility priorities, weapon loadouts, and budget allocation. It replaces the previous static "Welcome to Your Stable" dashboard messaging with a structured, state-tracked tutorial flow.

Players make real purchases (robots, weapons) during the tutorial — it is not a simulation. State persists across sessions via the User table, and existing players are automatically marked as completed during migration.

## Component Architecture

### File Locations

```
prototype/frontend/src/
├── components/onboarding/
│   ├── OnboardingContainer.tsx       # Main orchestrator
│   ├── OnboardingErrorBoundary.tsx   # Error boundary with retry/skip
│   ├── GuidedUIOverlay.tsx           # Semi-transparent overlay + tooltips
│   ├── ProgressIndicator.tsx         # Step X of 9 progress bar
│   ├── BudgetTracker.tsx             # Real-time credit sidebar (Steps 5-8)
│   ├── RosterStrategyCard.tsx        # Strategy selection cards (Step 2)
│   ├── BudgetAllocationChart.tsx     # Pie/bar chart for budget viz
│   ├── FacilityPriorityList.tsx      # Ordered facility recommendations
│   ├── LoadoutDiagram.tsx            # Visual weapon loadout configs
│   ├── ResetAccountModal.tsx         # Reset with "RESET" confirmation
│   ├── steps/
│   │   ├── Step1_Welcome.tsx
│   │   ├── Step2_RosterStrategy.tsx
│   │   ├── Step3_FacilityTiming.tsx
│   │   ├── Step4_BudgetAllocation.tsx
│   │   ├── Step5_RobotCreation.tsx
│   │   ├── Step6_WeaponEducation.tsx
│   │   ├── Step7_WeaponPurchase.tsx
│   │   ├── Step8_BattleReadiness.tsx
│   │   └── Step9_Completion.tsx
├── contexts/
│   └── OnboardingContext.tsx          # State provider + useOnboarding hook
├── utils/
│   └── onboardingAnalytics.ts        # Client-side event tracking
├── types/
│   └── onboarding.types.ts           # TypeScript definitions
```

### OnboardingContainer

Main orchestrator component. Responsibilities:
- Renders the current step component based on `tutorialState.currentStep`
- Handles step navigation (next, previous, skip)
- Integrates `ProgressIndicator` (always visible) and `BudgetTracker` (Steps 5-8)
- Manages tutorial completion and skip confirmation flows
- Step components are lazy-loaded via `React.lazy()` with next-step preloading

### OnboardingErrorBoundary

Wraps the entire onboarding flow. On component error:
1. Displays error message with "Retry" button
2. Falls back to "Skip to Dashboard" if retry fails
3. Logs error details via analytics

### OnboardingContext

Uses `React.Context` + `useReducer` pattern. Provides:
- `currentStep`, `tutorialState`, `playerChoices` via `useOnboarding()` hook
- Step transition validation (can go back, cannot skip ahead)
- State sync to backend via debounced API calls (500ms)
- Error state tracked with `errorInfo` for user-friendly messages

```typescript
// Simplified context shape
interface OnboardingState {
  currentStep: number;
  strategy: string | null;
  choices: OnboardingChoices;
  isLoading: boolean;
  errorInfo: { code: string; message: string } | null;
}
```

### Step Components

Each step (Step1 through Step9) is a self-contained lazy-loaded component. Steps receive props from `OnboardingContainer` and dispatch actions through `useOnboarding()`. Steps 5, 7, and 8 involve real API calls (robot creation, weapon purchase, weapon equipping).

## API Endpoints

### Route Files
- `prototype/backend/src/routes/onboarding.ts` — Core tutorial endpoints
- `prototype/backend/src/routes/onboardingAnalytics.ts` — Analytics event ingestion

### Service Files
- `prototype/backend/src/services/onboardingService.ts` — State management, completion, skip
- `prototype/backend/src/services/onboardingAnalyticsService.ts` — Event storage and aggregation

### Error Handling
- `prototype/backend/src/errors/onboardingErrors.ts` — Custom `OnboardingError` class with error codes

### Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/onboarding/state` | Get current tutorial state for authenticated user |
| POST | `/api/onboarding/state` | Update tutorial state (step, choices) |
| POST | `/api/onboarding/complete` | Mark tutorial complete, set `onboardingCompletedAt` |
| POST | `/api/onboarding/skip` | Skip tutorial, set `onboardingSkipped = true` |
| GET | `/api/onboarding/recommendations` | Personalized recommendations based on strategy |
| POST | `/api/onboarding/reset-account` | Reset account (requires `{ confirmation: "RESET" }`) |
| GET | `/api/onboarding/reset-eligibility` | Check if reset is allowed (no pending battles/tournaments) |
| POST | `/api/onboarding/analytics` | Ingest analytics events |

All endpoints require JWT authentication middleware.

### Error Codes

Defined in `onboardingErrors.ts`:
- `TUTORIAL_STATE_NOT_FOUND` — Auto-initializes if missing
- `INVALID_STEP_TRANSITION` — Cannot skip ahead
- `RESET_BLOCKED` — Active matches, tournaments, or pending battles
- `INVALID_RESET_CONFIRMATION` — Confirmation text doesn't match "RESET"

## State Management Approach

### State Flow

1. User registers → `onboardingService.initializeTutorialState(userId)` called
2. User logs in → frontend fetches state via `GET /api/onboarding/state`
3. `OnboardingContext` hydrates from API response
4. User interacts → local state updates immediately (optimistic)
5. State changes debounced (500ms) → `POST /api/onboarding/state`
6. On completion → `POST /api/onboarding/complete` → redirect to dashboard

### Persistence

State lives on the User table (not a separate table). This was a deliberate decision for simplicity and query performance — onboarding state is always fetched alongside user data.

`onboardingChoices` is stored as a JSON blob containing strategy selection, facility preferences, weapon choices, and any other tutorial decisions.

### Step Transition Rules

- Forward: Only to `currentStep + 1` (no skipping ahead)
- Backward: Any previous step allowed
- On resume (after logout): Starts from last saved `onboardingStep`

## Database Schema

### User Table Additions

```prisma
model User {
  // ... existing fields ...
  hasCompletedOnboarding  Boolean   @default(false)
  onboardingSkipped       Boolean   @default(false)
  onboardingStep          Int       @default(1)
  onboardingStrategy      String?   @db.VarChar(20)
  onboardingChoices       Json      @default("{}")
  onboardingStartedAt     DateTime?
  onboardingCompletedAt   DateTime?
}
```

### ResetLog Table

```prisma
model ResetLog {
  id                Int      @id @default(autoincrement())
  userId            Int
  robotsDeleted     Int
  weaponsDeleted    Int
  facilitiesDeleted Int
  creditsBeforeReset Decimal @db.Decimal(15, 2)
  reason            String?
  resetAt           DateTime @default(now())

  user User @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([resetAt])
}
```

### Migration

- Migration name: `add_onboarding_tracking`
- Data migration marks all existing users with `hasCompletedOnboarding = true`
- New registrations default to `hasCompletedOnboarding = false`

## Image Asset Organization

```
prototype/frontend/public/assets/onboarding/
├── strategies/          # Roster strategy illustrations (400×300px)
│   ├── roster-1-mighty.png
│   ├── roster-2-average.png
│   └── roster-3-flimsy.png
├── loadouts/            # Loadout type diagrams (300×200px)
│   ├── loadout-single.png
│   ├── loadout-weapon-shield.png
│   ├── loadout-two-handed.png
│   └── loadout-dual-wield.png
├── facilities/          # Facility icons (64×64px)
├── battles/             # Battle type illustrations (600×400px)
│   ├── battle-league.png
│   ├── battle-tag-team.png
│   └── battle-tournament.png
├── charts/              # Budget charts per strategy (400×400px)
│   ├── budget-chart-1-mighty.png
│   ├── budget-chart-2-average.png
│   └── budget-chart-3-flimsy.png
└── diagrams/            # Explanatory diagrams
    ├── attribute-bonus-stacking.png (500×300px)
    └── cycle-schedule.png (800×200px)
```

All images should be optimized PNGs (<100KB each) or SVG placeholders. Images are lazy-loaded with descriptive `alt` text.

## Existing Component Reuse

The onboarding reuses 12 existing components to reduce implementation time and maintain UI consistency:

| Existing Component | Used In | How |
|---|---|---|
| ConfirmationModal | ResetAccountModal | Extended with "RESET" text confirmation input |
| Toast | All steps | Success/error notifications |
| LoadoutSelector | Step 6 | Teaching loadout types with educational tooltips |
| StanceSelector | Step 6 | Battle stance education |
| FacilityIcon | FacilityPriorityList | Facility icons in priority display |
| FacilityROICalculator | Step 3 | ROI calculations for facility education |
| HPBar | Step 8 | Robot health display during battle readiness |
| BattleReadinessBadge | Step 8 | Battle readiness indicators |
| WeaponSlot | Step 8 | Weapon equipping flow |
| FinancialSummary | BudgetTracker | Adapted for real-time credit tracking sidebar |
| TabNavigation | OnboardingContainer | Adapted for step navigation |
| ComparisonBar | Step 4 | Budget allocation comparison |

## Analytics Integration

### Client-Side

`onboardingAnalytics.ts` provides a `trackOnboardingEvent(event, data)` utility. Events are batched and sent to `/api/onboarding/analytics`.

### Key Events

| Event | When | Data |
|-------|------|------|
| `step_entered` | User navigates to a step | `{ step, timestamp }` |
| `step_completed` | User completes a step | `{ step, duration }` |
| `strategy_selected` | Step 2 strategy chosen | `{ strategy }` |
| `tutorial_skipped` | User skips tutorial | `{ lastStep, reason? }` |
| `tutorial_completed` | User finishes Step 9 | `{ totalDuration, strategy }` |
| `reset_requested` | User initiates account reset | `{ reason }` |

### Backend

`onboardingAnalyticsService.ts` stores events and provides aggregation queries for funnel analysis (completion rates by step, strategy distribution, drop-off points).

## Performance Optimizations

| Optimization | Implementation |
|---|---|
| Lazy loading | Step components loaded via `React.lazy()` |
| Preloading | Next step preloaded while current step is displayed |
| Debounced sync | API state updates debounced at 500ms |
| Recommendation caching | Cached for 5 minutes (TTL cache) |
| Image lazy loading | Images below the fold use `loading="lazy"` |
| Memoization | `React.memo` on step components to prevent unnecessary re-renders |

### Performance Targets

- Initial load: < 2 seconds
- Step transition: < 100ms
- Tooltip render: < 50ms
- API response: < 500ms

## Error Handling

### Frontend

- **OnboardingErrorBoundary**: Catches component errors, offers retry then skip-to-dashboard fallback
- **Network errors**: Retry button with exponential backoff (1s, 2s, 4s)
- **Invalid step transitions**: Prevented in `OnboardingContext` reducer, shows warning toast
- **Session timeout**: Redirects to login; onboarding state persists in DB and resumes on next login
- **Missing tutorial state**: Auto-initializes via `initializeTutorialState()` if not found

### Backend

Custom `OnboardingError` class extends base error with:
- `code`: Machine-readable error code (e.g., `RESET_BLOCKED`)
- `message`: Human-readable description
- `statusCode`: HTTP status (400, 403, 404, 500)

All errors logged with context (userId, currentStep, attempted action).

### Reset Validation

Before allowing account reset, `validateResetEligibility()` checks:
- No scheduled matches pending
- No active tournament participation
- No pending battle results
- Confirmation text matches "RESET" exactly

Reset executes in a single database transaction: deletes robots, weapons, facilities; resets credits to ₡3,000,000; logs to `ResetLog`; resets onboarding state to Step 1.

## Dashboard Integration

The onboarding replaces the existing "Welcome to Your Stable" section in `DashboardPage.tsx` (lines 229-267):

- **New users** (`hasCompletedOnboarding = false`, step 1): "Start Your Journey" with "Begin Interactive Tutorial" CTA
- **Incomplete onboarding** (step > 1, not completed): "Resume Tutorial" with progress indicator showing "Continue from Step X of 9"
- **Completed/skipped users**: Existing welcome messaging preserved as fallback

A compact progress indicator appears in the dashboard header for users with incomplete onboarding.

## See Also

- [PRD_ONBOARDING_SYSTEM.md](../prd_core/PRD_ONBOARDING_SYSTEM.md) — Full product requirements
- [PRD_ECONOMY_SYSTEM.md](../prd_core/PRD_ECONOMY_SYSTEM.md) — Starting budget and facility costs
- [PRD_WEAPONS_LOADOUT.md](../prd_core/PRD_WEAPONS_LOADOUT.md) — Weapon types and loadout configurations
- [COMBAT_FORMULAS.md](../prd_core/COMBAT_FORMULAS.md) — Battle mechanics and repair cost formulas
