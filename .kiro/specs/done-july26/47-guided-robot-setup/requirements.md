# Requirements Document

## Glossary

- **Setup_Wizard**: A 7-step guided flow rendered at `/robots/:id/setup` that walks a player through configuring a newly created robot for battle readiness. Persists progress in localStorage only.
- **Eligibility_Checklist**: A persistent warning banner on the Robot_Detail_Page that surfaces unmet Scheduling_Eligibility gates for the robot's owner.
- **Scheduling_Eligibility**: A server-derived report indicating whether a robot meets the minimum requirements to be scheduled for battles. Computed by `computeSchedulingEligibility()`.
- **Scheduling_Eligibility_Report**: The JSON response from `GET /api/robots/:id/scheduling-eligibility` containing `robotId`, `isEligible`, `isFullyConfigured`, and a `gates` array.
- **Hard_Gate**: An eligibility gate with severity `'hard'` that must be met for the robot to be scheduled. Currently: weapon equipped and at least one event subscription active.
- **Soft_Gate**: An eligibility gate with severity `'soft'` that is recommended but not required. Currently: tuning points allocated.
- **Wizard_State**: The client-side localStorage object (keyed `robot-setup-${robotId}`) tracking the player's current step, completed steps, and skipped steps.
- **Robot_Detail_Page**: The existing page at `/robots/:id` showing a robot's full configuration, stats, and battle history.
- **Generated_Stable**: A stable (user account) with `is_generated: true` — auto-generated bots that are created fully battle-ready and never see the Setup_Wizard or Eligibility_Checklist.
- **Loadout_Type**: A robot's weapon configuration type: `'single'`, `'weapon_shield'`, `'two_handed'`, or `'dual_wield'`.
- **Step_Component**: One of the 7 self-contained UI components rendered within the Setup_Wizard, each responsible for a single configuration concern.

## Introduction

This document defines the requirements for a guided robot setup workflow that activates after robot creation (non-onboarding path). The feature helps players configure newly created robots for battle readiness through a step-by-step wizard, and provides a persistent eligibility checklist on the Robot_Detail_Page for robots missing hard-gate requirements. The backend exposes a lightweight eligibility endpoint that derives all data from existing tables — no new database schema is introduced.

## Expected Contribution

This spec delivers the following measurable improvements:

1. **Reduced player confusion after robot creation** — Currently, after creating a robot the player lands on the Robot_Detail_Page with no guidance on what to do next. After this spec, new robots (non-onboarding) are routed into a 7-step wizard that covers all configuration needed for battle readiness.
2. **Reduced "unschedulable robot" support questions** — Players who skip setup steps will see a persistent Eligibility_Checklist on the Robot_Detail_Page with actionable links, replacing the current situation where robots silently never get scheduled.
3. **Single eligibility truth endpoint** — Before: readiness was scattered across `checkSchedulingReadiness()`, subscription queries, and tuning queries with no unified surface. After: one `GET /api/robots/:id/scheduling-eligibility` endpoint returns a complete report.
4. **Zero new database tables** — The entire feature is built on existing data. Wizard state lives in localStorage. Eligibility is computed from existing weapon, subscription, and tuning allocation records.
5. **No disruption to onboarding flow** — The two robot creation paths (onboarding vs normal) remain cleanly separated. Only the normal path triggers the wizard.

### Verification Criteria

After all tasks are complete, verify:

1. `grep -r "robot-setup-" app/frontend/src/ | grep localStorage` — confirms wizard state uses localStorage with the expected key pattern
2. `grep -r "scheduling-eligibility" app/backend/src/routes/ | wc -l` — at least 1 route registered
3. `grep -r "computeSchedulingEligibility" app/backend/src/services/ | wc -l` — at least 1 service function exists
4. `grep -r "RobotEligibilityChecklist" app/frontend/src/ | wc -l` — component exists and is imported in Robot_Detail_Page
5. `grep -r "RobotSetupWizard" app/frontend/src/ | wc -l` — wizard shell component exists
6. `grep -rn "replace.*true" app/frontend/src/ | grep -i "setup\|robot"` — CreateRobotPage navigates with `{ replace: true }`
7. Backend unit tests pass: `cd app/backend && pnpm run test:unit -- --testPathPattern="robotSchedulingEligibility"`
8. Frontend unit tests pass: `cd app/frontend && pnpm test -- --run --reporter=verbose 2>&1 | grep -E "(RobotSetupWizard|RobotEligibilityChecklist|useRobotSetupWizard)"`

## Requirements

### Requirement 1: Scheduling Eligibility Computation

**User Story:** As a player, I want the system to compute whether my robot meets battle scheduling requirements, so that I know what I need to configure before my robot can fight.

#### Acceptance Criteria

1. WHEN `computeSchedulingEligibility()` is called with a valid `robotId`, THE Scheduling_Eligibility_Service SHALL return a Scheduling_Eligibility_Report containing exactly 3 gates with IDs `'weapon_equipped'`, `'event_subscribed'`, and `'tuning_allocated'`
2. THE Scheduling_Eligibility_Service SHALL set `isEligible` to `true` if and only if all Hard_Gate entries in the `gates` array have `met: true`
3. THE Scheduling_Eligibility_Service SHALL set `isFullyConfigured` to `true` if and only if all gates (hard and soft) have `met: true`
4. WHEN checking `weapon_equipped`, THE Scheduling_Eligibility_Service SHALL delegate to the existing `checkSchedulingReadiness()` function and set `met` based on its `weaponCheck` result
5. WHEN checking `event_subscribed`, THE Scheduling_Eligibility_Service SHALL query the `subscription` table for active subscriptions belonging to the robot and set `met: true` when the count is greater than zero
6. WHEN checking `tuning_allocated`, THE Scheduling_Eligibility_Service SHALL query the `tuning_allocations` table and set `met: true` when a record exists for the robot
7. THE Scheduling_Eligibility_Service SHALL perform only read operations — no database rows are created, updated, or deleted during eligibility computation

### Requirement 2: Scheduling Eligibility Endpoint

**User Story:** As a frontend client, I want to fetch a robot's scheduling eligibility via a REST endpoint, so that the wizard and checklist can display current gate status.

#### Acceptance Criteria

1. THE Backend SHALL expose `GET /api/robots/:id/scheduling-eligibility` protected by `authenticateToken` and `validateRequest` middleware
2. WHEN a request is received, THE Endpoint SHALL verify robot ownership via `verifyRobotOwnership()` before computing eligibility
3. IF the requesting user does not own the robot, THEN THE Endpoint SHALL return HTTP 403
4. IF the robot does not exist, THEN THE Endpoint SHALL return HTTP 404
5. WHEN ownership is verified, THE Endpoint SHALL call `computeSchedulingEligibility()` and return the Scheduling_Eligibility_Report as JSON with HTTP 200

### Requirement 3: Setup Wizard Triggering

**User Story:** As a player who just created a robot (outside onboarding), I want to be guided through setup immediately, so that I don't have to figure out the configuration steps on my own.

#### Acceptance Criteria

1. WHEN a robot is successfully created via `CreateRobotPage` with `isOnboarding === false`, THE Frontend SHALL navigate to `/robots/:id/setup` with `{ replace: true }` so browser-back returns to the robots list
2. WHILE `isOnboarding === true` (either via `?onboarding=true` query param or the `Step1_Welcome` inline creation), THE Frontend SHALL NOT navigate to the Setup_Wizard and SHALL follow the existing onboarding navigation
3. THE Frontend SHALL NOT trigger the Setup_Wizard for robots belonging to a Generated_Stable

### Requirement 4: Wizard Step Navigation and Persistence

**User Story:** As a player, I want my setup progress saved locally so that if I refresh the page or return later, I can resume where I left off.

#### Acceptance Criteria

1. THE Setup_Wizard SHALL persist Wizard_State to localStorage under the key `robot-setup-${robotId}`
2. WHEN the Setup_Wizard mounts and localStorage contains a saved Wizard_State for the robot, THE Setup_Wizard SHALL resume at the saved `currentStep`
3. WHEN a player completes a step, THE Setup_Wizard SHALL add the step number to `completedSteps` and advance `currentStep` by one
4. WHEN a player skips a step, THE Setup_Wizard SHALL add the step number to `skippedSteps` and advance `currentStep` by one
5. WHEN a player clicks "Skip All", THE Setup_Wizard SHALL clear the localStorage entry and navigate to the Robot_Detail_Page
6. WHEN the wizard reaches completion (all 7 steps addressed), THE Setup_Wizard SHALL clear the localStorage entry and navigate to the Robot_Detail_Page
7. IF localStorage is unavailable, THEN THE Setup_Wizard SHALL function without persistence — the player starts from step 1 on every page load

### Requirement 5: Wizard Step Order and Content

**User Story:** As a player, I want the setup steps in a logical order that builds on previous choices, so that each step's context makes sense.

#### Acceptance Criteria

1. THE Setup_Wizard SHALL present steps in this fixed order: (1) Portrait, (2) Weapon Equip, (3) Battle Config, (4) Tuning Allocation, (5) Team Assignment, (6) Event Subscriptions, (7) Attribute Upgrades
2. THE Portrait Step SHALL wrap the existing `RobotImageSelector` component, allowing preset selection and optional custom upload
3. THE Weapon_Equip Step SHALL handle three sub-states: (a) player owns compatible weapons — show equip picker, (b) player has storage capacity and credits — show filtered shop with buy-and-equip, (c) storage full — show upgrade suggestion with link to facilities
4. THE Battle_Config Step SHALL combine the existing `StanceSelector` and `YieldThresholdSlider` on one screen
5. THE Tuning_Allocation Step SHALL display pool size summary and offer a quick-allocate option or a link to the full `TuningPoolEditor`
6. THE Team_Assignment Step SHALL show existing teams with open slots and offer inline team creation — placed before Event Subscriptions so the player knows which team events are relevant
7. THE Event_Subscription Step SHALL display an event checklist with subscription cap indicator, pre-checking relevant team events if the robot was assigned to a team in the previous step
8. THE Attribute_Upgrade Step SHALL show affordable upgrades with current credits and be fully skippable

### Requirement 6: Immediate Commit Per Step

**User Story:** As a player, I want each configuration choice saved immediately so that I don't lose progress if I close the browser mid-wizard.

#### Acceptance Criteria

1. WHEN a player completes a step that mutates server state, THE Step_Component SHALL call the existing API endpoint immediately (not batch at the end)
2. THE Step_Components SHALL use the following existing endpoints without modification: `PATCH /api/robots/:id/image`, `PUT /api/robots/:id/equip-main-weapon`, `PUT /api/robots/:id/equip-offhand-weapon`, `POST /api/weapon-inventory/purchase`, `PATCH /api/robots/:id/stance`, `PATCH /api/robots/:id/yield-threshold`, `PUT /api/subscriptions/robot/:robotId`
3. WHEN a step is completed and the player navigates back or refreshes, THE Setup_Wizard SHALL reflect the already-committed state from the server (idempotent re-application produces no error)

### Requirement 7: Eligibility Checklist on Robot Detail Page

**User Story:** As a player viewing my robot's detail page, I want to see a clear warning when my robot cannot be scheduled for battles, so that I know exactly what to fix.

#### Acceptance Criteria

1. WHEN the Robot_Detail_Page loads for a robot owned by the current user, THE Frontend SHALL fetch the Scheduling_Eligibility_Report
2. WHILE any Hard_Gate is unmet, THE Eligibility_Checklist SHALL render a warning banner above the tab navigation showing each unmet gate with its label and an action link
3. WHEN all Hard_Gates are met but Soft_Gates remain unmet, THE Eligibility_Checklist SHALL render the soft-gate items as recommendations (not warnings)
4. WHEN all gates are met (`isFullyConfigured === true`), THE Eligibility_Checklist SHALL NOT render
5. THE Eligibility_Checklist SHALL include a "Complete Setup" button that navigates to `/robots/:id/setup` so the player can use the wizard to resolve remaining gates
6. THE Eligibility_Checklist SHALL NOT render for robots not owned by the current user (viewers only see the robot, not the owner's to-do items)

### Requirement 8: Generated Robot Exclusion

**User Story:** As the system, I want generated robots to be excluded from the wizard and checklist flows, so that auto-generated bots don't trigger player-facing guidance UI.

#### Acceptance Criteria

1. THE Frontend SHALL NOT navigate to the Setup_Wizard after creating a robot through the Generated_Stable path (direct Prisma inserts, no `CreateRobotPage` involvement)
2. THE Eligibility_Checklist SHALL NOT render on the Robot_Detail_Page for robots belonging to a Generated_Stable
3. THE Scheduling_Eligibility_Report SHALL still be computable for generated robots via the API (the endpoint does not reject them), but no frontend UI path triggers it for generated robots

### Requirement 9: Mobile-First Responsive Layout

**User Story:** As a mobile player, I want the setup wizard to be fully usable on my phone, so that I can configure my robot without needing a desktop.

#### Acceptance Criteria

1. THE Setup_Wizard SHALL use a single-column vertical layout at all viewports with no horizontal scrolling at viewports ≥ 320px
2. THE Setup_Wizard SHALL render a sticky bottom action bar with "Next" / "Skip" / "Back" buttons, all with touch targets of at least 44px height
3. THE Setup_Wizard SHALL render a compact progress indicator at the top showing numbered steps with the current step highlighted
4. WHEN the viewport is below 1024px, THE Setup_Wizard SHALL render weapon grids as `grid-cols-1` and portrait thumbnails as `grid-cols-3`
5. WHEN the viewport is at or above 1024px, THE Setup_Wizard SHALL render weapon grids as `grid-cols-2` and portrait thumbnails as `grid-cols-4`, centered with `max-w-2xl mx-auto`
6. THE Setup_Wizard SHALL use `animate-fade-in` (200ms ease-out) for step transitions, skipped under `prefers-reduced-motion`
7. THE Eligibility_Checklist SHALL render full-width with stacked gate items and full-width action buttons on mobile (`w-full sm:w-auto`)

### Requirement 10: Error Handling

**User Story:** As a player, I want clear feedback when something goes wrong during setup, so that I know how to proceed.

#### Acceptance Criteria

1. IF a weapon equip fails because storage is full, THEN THE Weapon_Equip Step SHALL display a storage capacity warning with a link to upgrade the Storage Facility
2. IF a weapon purchase fails because of insufficient credits, THEN THE Weapon_Equip Step SHALL display the credit balance and a link to income facilities
3. IF the subscription cap is reached during Event Subscriptions, THEN THE Event_Subscription Step SHALL display the cap and suggest a facility upgrade
4. IF the robot is not found (404) or not owned (403) when loading the wizard, THEN THE Setup_Wizard SHALL display an appropriate error state and not render wizard steps
5. IF no teams have open slots during Team Assignment, THEN THE Team_Assignment Step SHALL offer inline team creation or a skip option

### Requirement 11: Navigation and Browser History

**User Story:** As a player, I want browser navigation to work intuitively around the wizard, so that pressing back doesn't take me to a stale create form.

#### Acceptance Criteria

1. WHEN navigating from `CreateRobotPage` to the Setup_Wizard, THE Frontend SHALL use `{ replace: true }` so that browser-back from the wizard navigates to the robots list (not the create form)
2. WHEN the wizard is completed or fully skipped, THE Frontend SHALL navigate to `/robots/:id` (the Robot_Detail_Page)
3. WHEN a player manually navigates to `/robots/:id/setup` for a robot that is already fully configured, THE Setup_Wizard SHALL show a completion state or redirect to the Robot_Detail_Page
