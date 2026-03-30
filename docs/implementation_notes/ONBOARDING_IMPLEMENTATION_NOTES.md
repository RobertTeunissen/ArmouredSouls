# Onboarding System Implementation Notes

**Last Updated**: March 29, 2026
**Status**: Authoritative Reference

## Overview

The New Player Onboarding System is a streamlined 5-step interactive tutorial that automates strategic decisions and purchases for new players. Rather than a lengthy educational walkthrough, the onboarding makes real purchases (robots, weapons, facilities, attribute upgrades) based on player choices.

## Streamlined 5-Step Flow

### Display Step 1: Welcome + Strategy + Robot Creation (Backend Steps 1-2)
- Welcome message: "Welcome to Armoured Souls, Commander"
- Three roster strategy cards (1 Mighty, 2 Average, 3 Flimsy)
- "Create My Robot(s)" button opens naming modal
- Auto-purchases Roster Expansion facilities if needed (2+ robots)
- Creates robots with player-chosen names
- Advances backend steps 1→2→3 via direct API calls

### Display Step 2: Facility Investment (Backend Steps 3-5)
- Strategy-aware investment options:
  - 1 Mighty: Weapons Workshop, Training Facility, Merchandising Hub, Repair Bay
  - 2 Average: Weapons Workshop, Training Facility, Streaming Studio, Repair Bay
  - 3 Flimsy: Streaming Studio, Repair Bay (budget-constrained)
- Toggleable cards with recommendations pre-selected
- "Previous" triggers full account reset (confirmation modal)
- "Do Not Invest" skips without purchasing
- Advances backend steps 3→4→5→6

### Display Step 3: Battle-Ready Setup (Backend Steps 6-7)
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

3-level fallback chain: hands+range+tier → hands+tier → hands+cost≤max

Storage capacity full → auto-buys Storage Facility upgrade and retries.

### Display Step 4: Attribute Upgrades (Backend Step 8)
- All robots shown with portraits
- Per-robot multi-select focus categories: Combat, Defense, Mobility, AI & Team
- "Upgrade" spreads budget across all robots × selected attributes round-robin until < ₡50K remains
- "Skip — I'll upgrade later" advances without upgrading

### Display Step 5: Completion (Backend Step 9)
- Congratulations message with trophy
- Reminder about account reset from profile page
- "Complete Tutorial & Start Playing" → refreshes user data → navigates to /guide

## Component Architecture

### Active Step Components
```
prototype/frontend/src/components/onboarding/steps/
├── Step1_Welcome.tsx          # Welcome + strategy + robot creation
├── Step3_FacilityTiming.tsx   # Facility investment choices
├── Step6_WeaponEducation.tsx  # Per-robot battle-ready wizard
├── Step8_BattleReadiness.tsx  # Attribute upgrades
└── Step9_Completion.tsx       # Congratulations + complete
```

### Supporting Components
```
├── OnboardingContainer.tsx    # Main orchestrator, step mapping
├── ProgressIndicator.tsx      # Step X of 5 progress bar
├── BudgetTracker.tsx          # Real-time credit display (refreshes on step change)
├── RobotNamingModal.tsx       # Name input modal for robot creation
├── RosterStrategyCard.tsx     # Strategy selection cards
├── SkipConfirmationModal.tsx  # Skip tutorial confirmation
└── OnboardingErrorBoundary.tsx # Error boundary with retry
```

### Removed Components (no longer used)
- Step2_RosterStrategy.tsx (merged into Step1)
- Step4_BudgetAllocation.tsx (removed — automated)
- Step5_RobotCreation.tsx (merged into Step1)
- Step7_WeaponPurchase.tsx (merged into Step6)
- FacilityPriorityList.tsx (replaced by investment cards)
- FacilityBenefitCards.tsx (replaced by investment cards)
- BudgetAllocationChart.tsx (removed)
- BudgetComparisonTable.tsx (removed)
- LoadoutDiagram.tsx (replaced by actual LoadoutSelector)

## Backend Step Mapping

The backend still uses steps 1-9. The frontend maps them to 5 display steps:

| Backend Steps | Display Step | Component | Description |
|--------------|-------------|-----------|-------------|
| 1-2 | 1 | Step1_Welcome | Welcome + strategy + robots |
| 3-5 | 2 | Step3_FacilityTiming | Facility investment |
| 6-7 | 3 | Step6_WeaponEducation | Battle-ready wizard |
| 8 | 4 | Step8_BattleReadiness | Attribute upgrades |
| 9 | 5 | Step9_Completion | Congratulations |

## Key Technical Decisions

### Direct API Calls vs Context Methods
Step components use direct `apiClient` calls for step advancement and purchases instead of the OnboardingContext's `advanceStep`/`setStep` methods. This is because the context's `runAction` helper catches errors without re-throwing, making it impossible for calling code to detect failures.

### Account Reset for "Previous"
The "Previous" button on steps 2 and 3 triggers a full account reset (`POST /api/onboarding/reset-account`) rather than trying to undo individual purchases. This is safe during early onboarding since the user hasn't participated in any battles yet.

### BudgetTracker Refresh
The BudgetTracker re-fetches credits from `/api/user/profile` whenever `tutorialState.currentStep` changes, ensuring it reflects purchases made during step transitions.

### User Data Refresh on Completion
Step 9 calls `refreshUser()` from AuthContext after `completeTutorial()` to ensure the guide page shows the actual remaining credits, not the stale value from login.

## API Endpoints Used

- `POST /api/onboarding/state` — Update step/strategy/choices
- `POST /api/onboarding/complete` — Mark tutorial complete
- `POST /api/onboarding/reset-account` — Full account reset
- `POST /api/facilities/upgrade` — Purchase/upgrade facilities
- `POST /api/robots` — Create robot
- `POST /api/weapon-inventory/purchase` — Buy weapon
- `PUT /api/robots/:id/equip-main-weapon` — Equip main weapon
- `PUT /api/robots/:id/equip-offhand-weapon` — Equip offhand weapon
- `PUT /api/robots/:id/loadout-type` — Set loadout type
- `PATCH /api/robots/:id/stance` — Set battle stance
- `PUT /api/robots/:id/appearance` — Set robot portrait
- `POST /api/robots/:id/upgrades` — Bulk attribute upgrade
- `GET /api/weapons` — List all weapons
- `GET /api/facilities` — List facilities with levels
- `GET /api/robots` — List user's robots
- `GET /api/user/profile` — Get user profile with currency
