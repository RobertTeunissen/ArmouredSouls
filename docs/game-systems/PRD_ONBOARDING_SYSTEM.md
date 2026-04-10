# Product Requirements Document: New Player Onboarding System

**Project**: Armoured Souls  
**Document Type**: Product Requirements Document (PRD)  
**Version**: v2.0  
**Last Updated**: April 9, 2026  
**Status**: ✅ Implemented  
**Owner**: Robert Teunissen  
**Epic**: New Player Onboarding

**Revision History**:

v1.0 (Mar 2, 2026): Initial PRD — 9-step tutorial design  
v1.1 (Mar 15, 2026): Strategy analysis, budget system, facility ROI calculations  
v1.2 (Mar 29, 2026): Streamlined to 5 display steps with automated purchases  
v2.0 (Apr 9, 2026): Major rewrite — consolidated with ONBOARDING_IMPLEMENTATION_NOTES.md, replaced outdated 9-step flow with actual 5-step implementation, corrected component architecture, added proper versioning

---

**Related Documents**:
- [PRD_ECONOMY_SYSTEM.md](PRD_ECONOMY_SYSTEM.md) — Starting budget, facility costs, revenue streams
- [PRD_WEAPONS_LOADOUT.md](PRD_WEAPONS_LOADOUT.md) — Weapon types, loadout configurations, pricing
- [PRD_ROBOT_ATTRIBUTES.md](PRD_ROBOT_ATTRIBUTES.md) — Robot creation costs, attribute upgrades
- [COMBAT_FORMULAS.md](COMBAT_FORMULAS.md) — Battle mechanics and damage calculations
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) — Current database schema
- [ONBOARDING_TROUBLESHOOTING.md](../guides/ONBOARDING_TROUBLESHOOTING.md) — Operational troubleshooting guide
- [ONBOARDING_ANALYTICS_GUIDE.md](../guides/ONBOARDING_ANALYTICS_GUIDE.md) — Analytics dashboard guide

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Background & Context](#2-background--context)
3. [Goals & Objectives](#3-goals--objectives)
4. [5-Step Tutorial Flow](#4-5-step-tutorial-flow)
5. [Backend Step Mapping](#5-backend-step-mapping)
6. [Component Architecture](#6-component-architecture)
7. [Key Technical Decisions](#7-key-technical-decisions)
8. [Roster Strategies](#8-roster-strategies)
9. [Budget System](#9-budget-system)
10. [Reset Functionality](#10-reset-functionality)
11. [Skip and Resume](#11-skip-and-resume)
12. [Database Schema](#12-database-schema)
13. [API Endpoints](#13-api-endpoints)
14. [Accessibility](#14-accessibility)
15. [Analytics](#15-analytics)
16. [Performance](#16-performance)
17. [Testing Requirements](#17-testing-requirements)

---

## 1. Executive Summary

The New Player Onboarding System is a streamlined 5-step interactive tutorial that automates strategic decisions and purchases for new players. Rather than a lengthy educational walkthrough, the onboarding makes real purchases (robots, weapons, facilities, attribute upgrades) based on player choices.

The backend internally uses steps 1–9. The frontend maps these to 5 display steps.

**Target Audience**: New players who have just registered and have not yet created a robot or purchased any facilities.

**Key Goals**:
- Teach strategic decision-making through real choices with real consequences
- Reduce early player churn by providing clear direction
- Help players understand the fundamental question: "How many robots should I build?"
- Ensure players end the tutorial with at least one battle-ready robot

---

## 2. Background & Context

New players land on the dashboard with ₡3,000,000 in credits and no direction. This leads to:
- Spending all credits on a single weapon without a robot to equip it on
- Buying facilities in suboptimal order
- Creating 3+ robots but not having enough credits to equip any
- High early churn

---

## 3. Goals & Objectives

### Success Metrics

| Metric | Target |
|--------|--------|
| Tutorial completion rate | ≥ 70% |
| Day-7 retention (onboarded) | ≥ 50% |
| First battle within 24h | ≥ 80% |
| Average time to complete | 5–10 min |
| Strategy distribution | No single strategy > 60% |

### Non-Goals

- Teaching advanced mechanics (league promotion, tournaments, prestige optimization)
- Replacing existing game documentation
- Forcing a specific strategy (recommendations only)
- Gating game access behind tutorial completion (skip is always available)

---

## 4. 5-Step Tutorial Flow

### Display Step 1: Welcome + Strategy + Robot Creation
**Backend Steps**: 1–2

- Welcome message: "Welcome to Armoured Souls, Commander"
- Three roster strategy cards (1 Mighty, 2 Average, 3 Flimsy)
- "Create My Robot(s)" button opens naming modal
- Auto-purchases Roster Expansion facilities if needed (2+ robots)
- Creates robots with player-chosen names
- Advances backend steps 1→2→3 via direct API calls

### Display Step 2: Facility Investment
**Backend Steps**: 3–5

Strategy-aware investment options:
- **1 Mighty**: Weapons Workshop, Training Facility, Merchandising Hub, Repair Bay
- **2 Average**: Weapons Workshop, Training Facility, Streaming Studio, Repair Bay
- **3 Flimsy**: Streaming Studio, Repair Bay (budget-constrained)

Toggleable cards with recommendations pre-selected. "Previous" triggers full account reset (confirmation modal). "Do Not Invest" skips without purchasing.

### Display Step 3: Battle-Ready Setup
**Backend Steps**: 6–7

Per-robot wizard loop:
1. **Loadout** — Uses actual LoadoutSelector component from robot detail page
2. **Stance** — Uses actual StanceSelector component from robot detail page
3. **Range** — Melee, Short, Mid, Long selection
4. **Main Weapon** — 3 random picks from price tier (Budget/Mid/Premium based on robot count, bumped up if Weapons Workshop purchased)
5. **Offhand** — 3 picks for shield (weapon_shield) or second weapon (dual_wield)
6. **Portrait** — RobotImageSelector for choosing robot appearance

Weapon price tiers mirror WimpBot/AverageBot/ExpertBot system:
- 3 robots → Budget (₡50K–₡150K), or Mid with workshop
- 2 robots → Mid (₡150K–₡300K), or Premium with workshop
- 1 robot → Premium (₡300K+), or Elite with workshop

3-level fallback chain: hands+range+tier → hands+tier → hands+cost≤max. Storage capacity full → auto-buys Storage Facility upgrade and retries.

### Display Step 4: Attribute Upgrades
**Backend Step**: 8

- All robots shown with portraits
- Per-robot multi-select focus categories: Combat, Defense, Mobility, AI & Team
- "Upgrade" spreads budget across all robots × selected attributes round-robin until < ₡50K remains
- "Skip — I'll upgrade later" advances without upgrading

### Display Step 5: Completion
**Backend Step**: 9

- Congratulations message with trophy
- Reminder about account reset from profile page
- "Complete Tutorial & Start Playing" → refreshes user data → navigates to /guide

---

## 5. Backend Step Mapping

The backend uses steps 1–9. The frontend maps them to 5 display steps:

| Backend Steps | Display Step | Component | Description |
|--------------|-------------|-----------|-------------|
| 1–2 | 1 | Step1_Welcome | Welcome + strategy + robots |
| 3–5 | 2 | Step3_FacilityTiming | Facility investment |
| 6–7 | 3 | Step6_WeaponEducation | Battle-ready wizard |
| 8 | 4 | Step8_BattleReadiness | Attribute upgrades |
| 9 | 5 | Step9_Completion | Congratulations |

---

## 6. Component Architecture

### Key Source Files

- Backend service: `app/backend/src/services/onboarding/onboardingService.ts`
- Backend routes: `app/backend/src/routes/onboarding.ts`
- Analytics service: `app/backend/src/services/analytics/onboardingAnalyticsService.ts`
- Error definitions: `app/backend/src/errors/onboardingErrors.ts`
- Frontend orchestrator: `app/frontend/src/components/onboarding/OnboardingContainer.tsx`
- Frontend context: `app/frontend/src/contexts/OnboardingContext.tsx`

### Step Components

```
app/frontend/src/components/onboarding/steps/
├── Step1_Welcome.tsx          # Welcome + strategy + robot creation
├── Step3_FacilityTiming.tsx   # Facility investment choices
├── Step6_WeaponEducation.tsx  # Per-robot battle-ready wizard
├── Step8_BattleReadiness.tsx  # Attribute upgrades
└── Step9_Completion.tsx       # Congratulations + complete
```

### Supporting Components

```
app/frontend/src/components/onboarding/
├── OnboardingContainer.tsx    # Main orchestrator, step mapping
├── ProgressIndicator.tsx      # Step X of 5 progress bar
├── BudgetTracker.tsx          # Real-time credit display (refreshes on step change)
├── RobotNamingModal.tsx       # Name input modal for robot creation
├── RosterStrategyCard.tsx     # Strategy selection cards
├── SkipConfirmationModal.tsx  # Skip tutorial confirmation
└── OnboardingErrorBoundary.tsx # Error boundary with retry
```

---

## 7. Key Technical Decisions

### Direct API Calls vs Context Methods
Step components use direct `apiClient` calls for step advancement and purchases instead of the OnboardingContext's `advanceStep`/`setStep` methods. The context's `runAction` helper catches errors without re-throwing, making it impossible for calling code to detect failures.

### Account Reset for "Previous"
The "Previous" button on steps 2 and 3 triggers a full account reset (`POST /api/onboarding/reset-account`) rather than trying to undo individual purchases. Safe during early onboarding since the user hasn't participated in any battles yet. Rate-limited to 3 requests per hour per user.

### BudgetTracker Refresh
Re-fetches credits from `/api/user/profile` whenever `tutorialState.currentStep` changes, ensuring it reflects purchases made during step transitions.

### User Data Refresh on Completion
Step 9 calls `refreshUser()` from AuthContext after `completeTutorial()` to ensure the guide page shows actual remaining credits, not the stale value from login.

---

## 8. Roster Strategies

### Strategy Comparison

| Aspect | 1 Mighty Robot | 2 Average Robots | 3 Flimsy Robots |
|--------|---------------|-------------------|------------------|
| Robot Cost | ₡500,000 | ₡1,000,000 | ₡1,500,000 |
| Budget for Upgrades | ₡2,150,000 | ₡1,650,000 | ₡1,150,000 |
| Battles per Day | ~2.2 | ~3.6 | ~5.0 |
| Daily Repair Costs | Low (₡5K–₡15K) | Medium (₡10K–₡30K) | High (₡15K–₡50K) |
| Streaming Revenue | Lower | Moderate | Higher |
| Management Complexity | Simple | Moderate | Complex |
| Risk Profile | High (single point of failure) | Balanced | Spread (individually weak) |
| Recommended For | Quality-focused | New players (default) | Optimization-focused |

### 1 Mighty Robot
All resources focused on a single powerful robot. Fewer battles but higher win rate. Simpler management. Higher risk — no backup if your robot loses.

**Recommended Loadout**: Two-Handed or Weapon + Shield  
**Recommended First Weapon**: Power Sword (₡325,000) or Plasma Cannon (₡408,000)

### 2 Average Robots (Recommended)
Balanced resource distribution. Good learning experience — compare strategies between robots. One robot can compensate for the other.

**Recommended Loadout**: One offensive (Single or Two-Handed) + one defensive (Weapon + Shield)  
**Recommended First Weapons**: Bolt Carbine (₡93,000) + Combat Shield (₡78,000)

### 3 Flimsy Robots
Most battles per day, highest streaming revenue potential, fastest fame accumulation. But individually weak, highest repair costs, most complex management.

**Recommended Loadout**: Mix of Single Weapon and Dual-Wield  
**Recommended First Weapons**: Practice Sword (₡50,000) × 3

---

## 9. Budget System

### Starting Budget
₡3,000,000 (per [PRD_ECONOMY_SYSTEM.md](PRD_ECONOMY_SYSTEM.md)). Budget tracker visible during steps 2–4.

### Budget Warnings

| Threshold | Level | Message |
|-----------|-------|---------|
| ₡600,000 remaining | Yellow | "Your budget is getting low. Consider saving for repairs." |
| ₡200,000 remaining | Red | "Critical: You may not have enough for repairs after your first battles." |

Warnings are non-blocking banners — players can still make purchases.

---

## 10. Reset Functionality

### Reset Scope

**Reset**: Credits restored to ₡3,000,000, all robots/weapons/facilities/upgrades deleted, onboarding reset to Step 1, league standings and fame/prestige reset.  
**Preserved**: User account, creation date, reset history log.

### Eligibility Checks

| Check | Condition |
|-------|-----------|
| Scheduled Matches | No robots in upcoming matchmaking queue |
| Active Tournaments | Not enrolled in any active tournament |
| Pending Battles | No battles currently in progress |

### Confirmation Flow
1. System checks eligibility via `GET /api/onboarding/reset-eligibility`
2. Warning dialog displayed
3. Player must type exactly `RESET` (case-sensitive)
4. On confirmation, execute reset and redirect to Step 1

### Rate Limiting
Maximum 3 resets per 30-day rolling window. Admin can override.

---

## 11. Skip and Resume

### Skip
"Skip Tutorial" link visible on every step. Confirmation dialog shown. Sets `onboardingSkipped = true`, `hasCompletedOnboarding = true`. Redirects to dashboard.

### Resume
On login, if `hasCompletedOnboarding === false` and `onboardingSkipped === false`, redirect to onboarding at saved `onboardingStep`. All previous choices preserved.

### Replay
From Settings → Tutorial → "Replay Tutorial". Resets onboarding state to Step 1. Tutorial runs in replay mode — purchases are informational only.

---

## 12. Database Schema

### User Table Additions

```prisma
model User {
  hasCompletedOnboarding  Boolean   @default(false) @map("has_completed_onboarding")
  onboardingSkipped       Boolean   @default(false) @map("onboarding_skipped")
  onboardingStep          Int       @default(1)     @map("onboarding_step")
  onboardingStrategy      String?   @map("onboarding_strategy") @db.VarChar(20)
  onboardingChoices       Json      @default("{}")  @map("onboarding_choices")
  onboardingStartedAt     DateTime? @map("onboarding_started_at")
  onboardingCompletedAt   DateTime? @map("onboarding_completed_at")
}
```

### ResetLog Table

```prisma
model ResetLog {
  id                  Int       @id @default(autoincrement())
  userId              Int       @map("user_id")
  robotsDeleted       Int       @map("robots_deleted")
  weaponsDeleted      Int       @map("weapons_deleted")
  facilitiesDeleted   Int       @map("facilities_deleted")
  creditsBeforeReset  Decimal   @map("credits_before_reset") @db.Decimal(15, 2)
  reason              String?
  resetAt             DateTime  @default(now()) @map("reset_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([resetAt])
  @@map("reset_logs")
}
```

---

## 13. API Endpoints

All endpoints require JWT authentication.

### Onboarding State

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/onboarding/state` | Get current onboarding state |
| POST | `/api/onboarding/state` | Update step/strategy/choices |
| POST | `/api/onboarding/complete` | Mark tutorial complete |
| POST | `/api/onboarding/skip` | Skip tutorial |
| GET | `/api/onboarding/recommendations` | Get strategy-specific recommendations |

### Account Reset

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/onboarding/reset-eligibility` | Check if reset is allowed |
| POST | `/api/onboarding/reset-account` | Reset account (requires `confirmation: "RESET"`) |

### Analytics

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/onboarding/analytics` | Submit analytics event |

### Game APIs Used During Onboarding

| Method | Endpoint | Used In |
|--------|----------|---------|
| POST | `/api/robots` | Step 1 — Create robot |
| POST | `/api/facilities/upgrade` | Step 2 — Purchase facilities |
| POST | `/api/weapon-inventory/purchase` | Step 3 — Buy weapon |
| PUT | `/api/robots/:id/equip-main-weapon` | Step 3 — Equip main weapon |
| PUT | `/api/robots/:id/equip-offhand-weapon` | Step 3 — Equip offhand |
| PUT | `/api/robots/:id/loadout-type` | Step 3 — Set loadout |
| PATCH | `/api/robots/:id/stance` | Step 3 — Set stance |
| PUT | `/api/robots/:id/appearance` | Step 3 — Set portrait |
| POST | `/api/robots/:id/upgrades` | Step 4 — Bulk attribute upgrade |

---

## 14. Accessibility

### Keyboard Navigation

| Key | Action |
|-----|--------|
| Tab / Shift+Tab | Navigate interactive elements |
| Enter | Activate button or select option |
| Space | Toggle checkbox or radio |
| Escape | Close modals |
| Arrow Keys | Navigate strategy cards and loadout options |

### WCAG 2.1 AA Compliance

| Requirement | Implementation |
|-------------|----------------|
| Color contrast | Minimum 4.5:1 text, 3:1 UI components |
| Focus indicators | 2px solid outline on all interactive elements |
| Text alternatives | Alt text on images, aria-labels on icons |
| Resize support | Readable at 200% zoom without horizontal scroll |
| Motion preferences | Respects `prefers-reduced-motion` |
| Screen reader | Logical reading order, `aria-live` for dynamic content |

### Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| ≥ 1024px | Side-by-side: content + budget tracker sidebar |
| 768px–1023px | Stacked: content above, budget tracker below |
| < 768px | Single column, budget tracker as collapsible header |

---

## 15. Analytics

### Events Tracked

**Step-Level**: `onboarding_started`, `step_entered`, `step_completed`, `step_back`, `onboarding_completed`, `onboarding_skipped`, `onboarding_resumed`

**Action-Level**: `strategy_selected`, `robot_created`, `weapon_purchased`, `weapon_equipped`, `budget_warning`, `reset_requested`

### Key Funnel Metrics
- Step 1 → Step 2 conversion (target > 95%)
- Step 1 → Step 3 (strategy to first weapon)
- Step 3 → Step 5 (weapon to completion)
- Overall completion rate (target ≥ 70%)

### Retention Correlation
- Day-1, Day-7, Day-30 retention: completed vs skipped vs never started
- First battle timing after completion
- Strategy performance (win rate, balance, churn by strategy)

---

## 16. Performance

| Metric | Target |
|--------|--------|
| Initial load | < 2s (lazy-loaded step components) |
| Step transition | < 300ms (preload next step) |
| API response | < 500ms (debounced state updates, 500ms) |
| Image assets | < 100KB each (SVG/WebP) |

Step components are lazy-loaded via `React.lazy()`. State is saved with 500ms debounce, with immediate save on purchases. The `OnboardingErrorBoundary` catches chunk loading failures and offers retry then skip-to-dashboard fallback.

---

## 17. Testing Requirements

### Backend Tests

**Onboarding Service** (`tests/onboarding.test.ts`):
- State retrieval (new, in-progress, completed users)
- Step progression validation (no skipping ahead)
- Choices merge correctly
- Complete/skip set correct flags

**Reset Service** (`tests/onboardingReset.test.ts`):
- Credits restored, robots/weapons/facilities deleted
- ResetLog entry created
- Eligibility checks (scheduled matches, tournaments, pending battles)
- Confirmation validation ("RESET" exact match)
- Rate limit enforcement (3 per 30 days)

**Analytics** (`tests/onboardingAnalytics.test.ts`):
- Event recording and retrieval

### Frontend Tests

- Step navigation respects completion rules
- Strategy cards are keyboard navigable
- Budget tracker updates on state changes
- Skip/reset confirmation modals work correctly
- Accessibility: ARIA labels, focus management, screen reader announcements

---

## Appendix A: Onboarding State Machine

```
Login → Check State
  ├── Completed → Dashboard
  ├── In Progress → Resume at saved step
  └── Not Started → Step 1
        ↓
  Step Flow (1 → 2 → 3 → 4 → 5)
  ├── Skip at any step → Dashboard
  └── Complete Step 5 → Dashboard
```

## Appendix B: Glossary

| Term | Definition |
|------|-----------|
| Stable | A player's collection of robots, facilities, and resources |
| Roster | The set of robots a player owns |
| Loadout | Weapon configuration (single, weapon+shield, two-handed, dual-wield) |
| Cycle | Automated game processing period that runs battles and updates standings |
| LP | League Points — determine standings within a league |
| ROI | Return on Investment — how quickly a purchase pays for itself |
