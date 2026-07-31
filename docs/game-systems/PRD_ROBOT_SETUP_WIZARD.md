# PRD: Guided Robot Setup Wizard (Spec #47)

## Overview

A 7-step guided wizard that activates after robot creation (non-onboarding path) and walks the player through configuring a new robot for battle. Accompanied by a persistent eligibility checklist on the Robot Detail Page that surfaces unmet scheduling gates.

## Wizard Flow

**Route:** `/robots/:id/setup`
**Trigger:** After successful robot creation via `CreateRobotPage` (when `isOnboarding === false`)
**Navigation:** Uses `{ replace: true }` so browser-back goes to the robots list, not the create form.

### Steps (fixed order)

| # | Step | What it does | Required? |
|---|------|-------------|-----------|
| 1 | Portrait | Choose a robot image (presets or custom upload) | No |
| 2 | Weapon Equip | Equip an owned weapon, buy-and-equip if none owned, or link to facilities if storage is full | No (but hard gate) |
| 3 | Battle Config | Set combat stance + yield threshold (combined on one screen) | No |
| 4 | Tuning Allocation | Distribute free tuning points or link to Tuning Bay tab | No |
| 5 | Team Assignment | Join an existing team or create a new one | No |
| 6 | Event Subscriptions | Subscribe to battle events (at least one needed for scheduling) | No (but hard gate) |
| 7 | Attribute Upgrades | Optional link to invest credits in attribute upgrades | No |

Every step is skippable. Each step commits immediately via existing API endpoints — there is no batch submission.

### Navigation Controls

- **Next** — completes current step, advances to next
- **Skip** — marks step as skipped, advances to next
- **Back** — shows previous step (does NOT revert committed data)
- **Skip All** — exits wizard, navigates to Robot Detail Page

### Persistence

- Wizard position stored in `localStorage` under key `robot-setup-${robotId}`
- Cleared on completion or Skip All
- If localStorage unavailable, wizard works without resume (graceful degradation)

## Scheduling Eligibility System

### Endpoint

`GET /api/robots/:id/scheduling-eligibility`

Returns a `SchedulingEligibilityReport`:
```json
{
  "robotId": 42,
  "isEligible": false,
  "isFullyConfigured": false,
  "gates": [
    { "id": "weapon_equipped", "label": "Weapon equipped", "severity": "hard", "met": false, "detail": "No main weapon equipped" },
    { "id": "event_subscribed", "label": "Subscribed to at least one battle event", "severity": "hard", "met": false, "detail": "No event subscriptions — robot will never be scheduled for battles" },
    { "id": "tuning_allocated", "label": "Tuning points allocated", "severity": "soft", "met": false, "detail": "Free stat bonuses available via Tuning Bay" }
  ]
}
```

### Gate Definitions

| Gate | Severity | Condition | Source |
|------|----------|-----------|--------|
| `weapon_equipped` | Hard | `checkSchedulingReadiness(robot).weaponCheck === true` | Existing matchmaking service |
| `event_subscribed` | Hard | Active subscription count > 0 | Existing subscription table |
| `tuning_allocated` | Soft | `tuningAllocation` record exists | Existing tuning_allocations table |

- **Hard gates** block the robot from being scheduled by the matchmaker
- **Soft gates** are recommendations shown as info-level suggestions

### Eligibility Checklist (Robot Detail Page)

The `RobotEligibilityChecklist` renders above the tab navigation on the Robot Detail Page:
- Shows when any hard gate is unmet (warning banner with action links)
- Shows soft-gate recommendations when `showRecommendations` is true
- Hidden when `isFullyConfigured === true`
- Only shown to the robot's owner
- Includes "Complete Setup" button linking back to the wizard

## Design Decisions

1. **No new database tables** — wizard state in localStorage, eligibility derived from existing data
2. **Immediate commit per step** — no batch, each API call saves instantly
3. **Mobile-first** — single-column layout, sticky bottom action bar, touch targets ≥ 44px
4. **Two creation paths stay separate** — onboarding has its own guided flow; the wizard only triggers for post-onboarding robot creation
5. **Generated robots excluded** — `is_generated` stables never see the wizard (created via direct Prisma inserts, always fully configured)
6. **Back doesn't revert** — navigation is visual only; mutations are already committed

## Relationship to Onboarding

The existing onboarding (5-step tutorial for new players) already covers robot configuration in its Step 3 (loadout, stance, weapons, portrait). The setup wizard does NOT trigger during onboarding. It only activates for robots created after onboarding is complete or skipped.

## Related Features

- **Backlog #37** (Robot Detail Page Split) — step components are standalone and reusable in the future "Prepare" workspace
- **Backlog #61** (this feature's backlog entry) — the original problem statement
- **Spec #35** (Booking Office) — subscription cap curve affects Event Subscription step
- **Spec #25** (Tuning Pool) — tuning allocation check in the Tuning step
