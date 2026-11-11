# PRD: Guided Robot Setup Wizard (Spec #47)

**Last updated:** November 2026 (streamlined from 7 steps to the steps a robot still needs)

## Overview

A short guided setup that opens after robot creation (non-onboarding path) and gets the new robot battle-ready: a weapon and at least one battle event, the two hard scheduling gates. It ends in the robot's Workshop, which already has stance, yield, tuning and upgrades on one page, so the wizard does not repeat them. The Workshop shows notices for any gate the robot still fails.

## Wizard Flow

**Route:** `/robots/:id/setup`
**Trigger:** After successful robot creation via `CreateRobotPage` (when `isOnboarding === false`), and from the Workshop's **Finish setup** action.
**Navigation:** `CreateRobotPage` uses `{ replace: true }` so browser-back goes to the robots list, not the create form. Finishing or leaving the wizard replaces it with the Workshop (`/robots/:id/prepare`).

### Steps

The page loads the robot (from the owner's roster) and its eligibility report, then plans the steps once (`planSetupSteps` in `app/frontend/src/utils/robotSetupSteps.ts`):

| Step | Shown when | What it does |
|------|-----------|-------------|
| Portrait | Fresh robot (no weapon and no events) without an image | Opens the image picker. Picking saves and advances; closing skips. |
| Weapon | Weapon gate unmet | One click equips a spare compatible weapon from storage, or buys one of the six cheapest affordable compatible weapons and equips it. Storage full / no affordable weapon show a notice with a link to Facilities. |
| Team | Fresh robot in a stable of 2+ robots | Optional. Name (3–32 characters), 2v2 or 3v3 (3v3 needs three robots), teammates picked by the player. |
| Events | Events gate unmet | Checkbox list of every event. Opens with the robot's active entries, or 1v1 League, 1v1 Tournament and King of the Hill (eligible ones, up to the slot cap). One click ("Enter N events & finish") saves the whole set through `PUT /api/subscriptions/robot/:id` with `{ eventTypes }` (`saveRobotSubscriptions`, the same call as the Booking Office). Ineligible events show the roster reason; slots held by a booked match count toward the cap. |

A robot sent back from the Workshop only gets the steps it still needs (e.g. just Events). A robot that already passes both hard gates is redirected to the Workshop. Tuning is a soft gate and not a wizard step.

Clicks from "Create Robot" to battle-ready for a first robot: close or pick a portrait (1–2), buy and equip (1), enter events (1).

### Navigation Controls

- Each step has its own primary action and a **Skip** / **Skip for now** button.
- **← Back** (from the second step) shows the previous step again; saved changes stay saved.
- **Skip setup →** leaves for the Workshop at any time.
- Progress: "Step N of M · Name" and a numbered step list (`aria-current="step"`), hidden for a single step.
- No wizard state is stored: the steps are re-planned from server state when the page opens.

## Scheduling Eligibility System

### Endpoint

`GET /api/robots/:id/scheduling-eligibility` (owner only). Wire type `SchedulingEligibilityReport` in `app/shared/types/robot-setup.ts`:

```json
{
  "robotId": 42,
  "isEligible": false,
  "isFullyConfigured": false,
  "gates": [
    { "id": "weapon_equipped", "label": "Equip a weapon", "severity": "hard", "met": false, "detail": "No main weapon equipped" },
    { "id": "event_subscribed", "label": "Enter at least one battle event", "severity": "hard", "met": false, "detail": "No event subscriptions — robot will never be scheduled for battles" },
    { "id": "tuning_allocated", "label": "Allocate your tuning points", "severity": "soft", "met": false, "detail": "10 of 10 free tuning points unallocated" }
  ]
}
```

Labels name the task, because only unmet gates are shown (#582).

### Gate Definitions

| Gate | Severity | Condition |
|------|----------|-----------|
| `weapon_equipped` | Hard | `checkSchedulingReadiness(robot).weaponCheck === true` |
| `event_subscribed` | Hard | Active subscription count > 0 |
| `tuning_allocated` | Soft | No tuning points left: allocated points (sum of the robot's `tuning_allocations` row, 0 without one) ≥ pool size for the owner's Tuning Bay level. A row holding 0 points is unmet (#582). |

- **Hard gates** block the robot from being scheduled by the matchmaker
- **Soft gates** are recommendations

### Eligibility notices (Robot Workshop)

`RobotEligibilityChecklist` renders above the Build | Loadout sections of the Workshop, using `DashboardNotification`:
- Unmet hard gates: one warning, "Not ready for battle", listing the tasks, with a single **Finish setup** action (opens the wizard at the missing steps).
- Unmet tuning gate: an info notice with the unallocated point count and **Allocate tuning** (the Build section).
- Nothing while loading, on error, or when `isFullyConfigured` is true.

## Design Decisions

1. **No new database tables** — eligibility derived from existing data, steps planned from it on each visit
2. **Immediate commit per step** — no batch; each step's action saves instantly
3. **Only what the Workshop can't do** — stance, yield, tuning and attribute upgrades stay in the Workshop the wizard hands over to (the old Battle Config, Tuning and Upgrades steps duplicated it, and the Battle Config step showed defaults instead of the robot's values)
4. **Mobile-first** — single column, no fixed bottom bar (the old one covered the mobile tab bar), touch targets ≥ 44px, Workshop button and panel styles
5. **Two creation paths stay separate** — onboarding has its own guided flow; the wizard only triggers for post-onboarding robot creation
6. **Generated robots excluded** — `is_generated` stables never see the wizard

## Relationship to Onboarding

The onboarding tutorial (5 steps for new players) covers robot configuration in its own steps. The setup wizard does NOT trigger during onboarding. It only activates for robots created after onboarding is complete or skipped.

## Related Features

- **Robot Workshop** (#504, backlog #37) — the owner's preparation page; finishing or leaving the wizard lands there (`docs/prd_pages/PRD_ROBOT_DETAIL_PAGE.md`)
- **Backlog #61** (this feature's backlog entry) — the original problem statement
- **Spec #35** (Booking Office) — subscription cap and the shared save call
- **Spec #25** (Tuning Pool) — pool size used by the tuning gate
