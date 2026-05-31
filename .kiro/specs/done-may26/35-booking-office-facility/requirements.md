# Requirements Document

## Spec: Booking Office Facility — Event Subscription System

## Glossary

- **Booking Office**: The existing-but-unimplemented facility row in `app/backend/src/config/facilities.ts` (`type: 'booking_office'`, `implemented: false`). This spec implements it with event-subscription semantics.
- **Event_Subscription_System**: The new mechanism, owned by the Booking Office facility, that controls which Subscribable Events each robot is enrolled in.
- **Subscribable_Event**: A battle event mode whose participation is controlled by the Event Subscription System. Every battle event that exists today and every battle event added in the future is subscribable through the same registry. v1 set: 1v1 League, 1v1 Tournament, Tag Team, KotH.
- **Subscription**: A row representing a single robot's opt-in to a single Subscribable Event. A robot holds zero or more Subscriptions, capped by the per-robot Max_Events_Per_Robot. Persistent across cycles until the player changes it.
- **Max_Events_Per_Robot**: The maximum number of concurrent Subscriptions any single robot owned by a Stable may hold, derived from the Stable's `booking_office` facility level via the Max_Events_Per_Robot. Every robot in the Stable gets the same cap.
- **Max_Events_Per_Robot**: The configured table mapping Booking Office level → number of allowed Subscriptions per robot. v1 curve: L0 = 3, L1 = 4, L2 = 5, L3 = 6, L4 = 7, L5 = 8, L6 = 9, L7 = 10, L8 = 11, L9 = 12, L10 = 13. The curve is config-driven so it can be changed without code changes.
- **Event_Registry**: The typed enumeration of all Subscribable Events known to the codebase. New event modes register themselves once and become subscribable. Single source of truth.
- **Subscription_Lock**: The rule that prevents a player from unsubscribing a robot from a Subscribable Event while THAT ROBOT has a queued battle for that event. Mirrors the `TEAM_LOCKED_FOR_BATTLE` pattern from the team-battles spec. Locks are per robot — other robots in the same Stable are unaffected.
- **Migration_Cycle**: The cycle on which this spec ships to ACC. As of writing, ACC is on cycle 58. The migration grants every existing Stable a Booking Office Level 1 (free) and creates Subscriptions for every existing robot to all four current battle modes (1v1 League, 1v1 Tournament, Tag Team, KotH), so no robot loses access to anything it had before. **One-off action**: the script runs once at deploy time and is then removed from the codebase in a follow-up PR (see R6.11). It is not a cron job, not invoked from `cycleScheduler`, and not re-runnable in production after the cleanup PR lands.
- **Stable**: The existing player-account concept (`User` in Prisma).
- **Cycle_Scheduler**: The existing production cron at `app/backend/src/services/cycle/cycleScheduler.ts`. Extended by this spec only via the Event Registry hook — no new cron jobs.
- **Onboarding_Subscription_Picker**: A new step in the existing onboarding flow that prompts a brand-new Stable to pick Subscriptions for its first robot from the Event Registry, up to the robot's Max_Events_Per_Robot. The picker filters the registry by the Stable's robot count so events the robot cannot physically participate in are not selectable.
- **Roster_Eligibility_Filter**: A typed predicate that, for a given Subscribable Event and a given Stable's robot count, returns whether a robot in that Stable can participate in that event. v1 rules: `league` and `tournament` always eligible; `tag_team` requires the Stable to own ≥ 2 robots (and the robot must be part of a registered TagTeam for matchmaking); `koth` always eligible. Used by the Onboarding_Subscription_Picker, the seeded user generator's random subscription pick, and the subscription management surface.

## Introduction

The Booking Office facility row exists in `app/backend/src/config/facilities.ts` with `implemented: false` and a description that already reads "Access to tournaments and prestige events". Its prestige curve and cost curve are defined. Nothing reads it. This spec ships the facility with **event-subscription semantics**: a Stable's Booking Office level dictates how many concurrent battle events each of its robots may be enrolled in.

Reason this spec exists, and why it lands before Spec `team-battles-2v2-3v3`: every battle event we add (the existing four, plus future Team Battle 2v2 / 3v3, plus future team tournaments, plus future seasonal events) needs a way to gate participation per robot. Without it, every robot is auto-enrolled in every event, and reward streams plus matchmaking pools become unmanageable. Building a one-off gate inside the team-battles spec ties a system-wide mechanic to one feature. Building it here, first, gives every future event a single registry to plug into.

The current battle types in the codebase, all of which become Subscribable Events under this spec, are:

- **1v1 League** (`app/backend/src/services/league/`) — automatic today, every cycle, every battle-ready robot.
- **1v1 Tournament** (`app/backend/src/services/tournament/`) — episodic, multi-cycle brackets, auto-created today.
- **Tag Team** (`app/backend/src/services/tag-team/`) — automatic on odd cycles for Stables that registered a `TagTeam`.
- **KotH** (`app/backend/src/services/koth/`) — automatic, all battle-ready robots in eligible leagues.

Yes, **1v1 League is also subscribable**. It's still the default in every onboarding picker and every migration row, but a robot whose owner genuinely wants to opt it out of the 1v1 ladder (e.g. a dedicated team-battle robot) can. The system makes no special case for it.

The Max_Events_Per_Robot gives each robot 3 free Subscriptions at Level 0, then one additional Subscription per Booking Office level up to Level 10 (cap 13). The cap is per robot — every robot owned by the Stable gets the same cap, derived from the Stable's Booking Office level. 3 free is the floor a robot needs to "enjoy the game" without facility investment. The 10-level curve has room for 13 events; we'll have 8 modes once the team-battles spec lands (existing 4 + 2v2 league + 3v3 league + 2v2 tournament + 3v3 tournament), so upper Booking Office levels currently grant headroom for future modes.

ACC is on cycle 58. Every existing robot receives Subscriptions to all four current modes, and every existing Stable receives a free Booking Office Level 1 at deploy — no current robot loses access. New Stables created post-deploy start at Level 0; their first robot gets 3 picked Subscriptions chosen during onboarding (with the option to add a 4th right away by purchasing Booking Office Level 1 during onboarding).

This spec deliberately reuses the existing facility framework (`Facility` Prisma model, `app/backend/src/config/facilities.ts` config-driven costs and prestige requirements, `app/backend/src/routes/facility.ts` purchase/upgrade routes). No new facility infrastructure. The Subscription is a new table joined to the Robot, gated by the owning Stable's Facility row.

Team formation is separate from subscription. Subscribing a robot to `tag_team` makes it eligible to be placed on a TagTeam row. The TagTeam row (active + reserve) is still required for matchmaking. Same for future 2v2 / 3v3 teams. Subscription = pool eligibility; team formation = selection from pool. Multiple teams per Stable per size are possible: e.g. 5 robots subscribed to `team_2v2`, player forms 2 teams of 2 (4 robots locked when matched, 5th free). The actual team formation is spec 37's concern; this spec establishes the per-robot subscription pool.

## Context: Discussion Notes

### Why Booking Office and not a new facility

`facilities.ts` already has a `booking_office` row with `implemented: false`. Its description ("Access to tournaments and prestige events") already maps to event participation. Its prestige curve (0 → 10000 across 10 levels, matching Repair Bay / Workshop pattern) is reasonable. The original cost curve (₡250K → ₡2.5M) was anchored to "premium tournament unlock" pricing — too steep for the actual benefit (one extra subscription slot per level per robot). This spec lowers the cost curve to a linear `level × ₡75,000` (L1 = ₡75K, L2 = ₡150K, …, L10 = ₡750K), matching the Storage Facility tier — both are "one extra slot per level" facilities and should have comparable pricing. Repurposing slightly — from "tournament unlock" specifically to "event subscription generally" — beats adding a 15th facility type. The facility framework already has UI, purchase flow, prestige gating, and admin tooling. We just turn it on.

### Why 3 free Subscriptions per robot at Level 0

A robot should be able to participate in the core game loop without the Stable buying the facility. Three picks lets a robot run 1v1 League + 1v1 Tournament + KotH without paying for a facility on day one. A robot in a multi-robot Stable can swap one of those for Tag Team once the Stable owns a second robot. The 3-free floor stops Booking Office from feeling like a tax on multi-robot strategies.

### Why "+1 per level" instead of a steeper curve

Linear scaling is easy to communicate ("buy a level, get a slot per robot"), and it matches the cost curve, which is already linear-ish in `facilities.ts`. A steep early curve (e.g. L1 = 6, L2 = 8) would make L1 feel mandatory and turn "complete the set" into a compulsory progression beat. A flat linear +1 per level lets a player decide level-by-level whether the next slot is worth the credits.

### Why every battle mode is subscribable, including 1v1 League

Two reasons. First, simplicity: one mechanism, no exception list, no "default" branch in matchmaking. Every matchmaker calls the same eligibility helper per robot. Second, edge-case respect: a player running a dedicated team-battle robot has a legitimate reason to opt that robot out of 1v1, and refusing to model that creates UX friction (e.g. the robot's dashboard shows 1v1 stats the player doesn't care about, the robot gets matched into 1v1 battles its build isn't tuned for). 1v1 League is still the default in onboarding and the migration; it's just not architecturally privileged.

### Why toggle-based, not slot-based

A robot's Subscription set is a flat set of Subscribable Event identifiers, capped at the curve value for the Stable's facility level. We don't need numbered slots. Players check the events they want per robot; the count must not exceed the cap. Simpler UI, simpler model, no slot-swap mechanic.

### Why subscriptions are per-robot

Four reasons:

1. **Specialisation.** Players want to build specialised robots — a 1v1 duelist, a team-battle tank, a KotH brawler. Per-robot subscriptions let the player express that intent directly: subscribe the duelist to `league` and `tournament`, subscribe the tank to `tag_team` and `team_2v2`. Stable-level subscriptions force every robot into the same event pool regardless of build.

2. **Per-robot locks.** Subscription locks prevent unsubscribing while a battle is queued. With Stable-level subscriptions, one robot's queued match locks the entire Stable. With per-robot subscriptions, only the robot with the queued match is locked — other robots in the same Stable remain free to change.

3. **Team pool formation.** Subscribing a robot to `tag_team` or `team_2v2` makes it eligible for team formation. The player then selects from the subscribed pool to form actual teams. This two-layer model (subscription = pool, team formation = selection) is cleaner when subscriptions are per-robot because the pool is explicitly defined per robot.

4. **Multiple teams per size.** A 5-robot Stable with all 5 subscribed to `team_2v2` can form 2 teams of 2 (with 1 spare). Per-robot subscriptions make this natural; Stable-level subscriptions would need a separate "which robots participate" layer that duplicates what per-robot subscriptions already provide.

### Why cap is per robot, not per Stable

A 5-robot Stable shouldn't be penalised compared to a 1-robot Stable. If the cap were per Stable (e.g. 3 total subscriptions shared across all robots), a multi-robot Stable would need to ration subscriptions across robots, making roster expansion feel punishing. Per-robot cap means every robot gets the same opportunity regardless of how many siblings it has. The Booking Office level investment scales naturally: more robots = more total subscription rows, but the per-robot cap stays fair.

### Why team formation is separate from subscription

Subscription answers "is this robot in the pool for this event type?" Team formation answers "which robots from the pool form an actual team?" These are distinct decisions:

- A robot subscribed to `tag_team` is eligible but not yet on a team. The player must still register a TagTeam (active + reserve) from the subscribed pool.
- A robot subscribed to `team_2v2` is eligible but the player must still form a 2v2 team from the subscribed pool.
- Multiple teams per size are possible from the same subscribed pool.

Conflating subscription with team formation would mean subscribing automatically creates a team (wrong — the player hasn't chosen partners yet) or that team creation automatically subscribes (wrong — the player might want to subscribe first, form the team later). Two layers, clearly separated.

### Onboarding subscription picker

Brand-new Stables go through the existing onboarding flow. During onboarding, the Stable creates 1 robot. We add a step where the player picks Subscriptions for that robot (matching the L0 cap of 3), filtered by the Roster_Eligibility_Filter so the player cannot pick events the robot cannot physically participate in.

A brand-new Stable starts with 1 robot, so the v1 picker presents `league`, `tournament`, and `koth` as eligible — `tag_team` is hidden until the Stable owns a second robot. The picker auto-selects all three eligible events as the default.

The inline "buy Booking Office Level 1 now" affordance is **not shown for 1-robot Stables**. A 1-robot Stable cannot meaningfully use a 4th Subscription at v1 (the only 4th option would be Tag Team, which requires 2 robots). Showing the affordance would either be a misleading recommendation or a wasted purchase. The affordance is reserved for future cases where new event modes raise the eligible count above the L0 cap.

After onboarding completes, the player can buy Booking Office Level 1 the normal way from the Facilities page once their robot roster grows. The subscription management surface on the Robot Detail page honours the Roster_Eligibility_Filter the same way the picker does.

### Migration approach for cycle 58

Every existing robot on ACC gets Subscriptions to all four current modes: `league`, `tournament`, `tag_team`, `koth`. Every existing Stable gets a free Booking Office Level 1 (granted via the migration; no credits charged).

Per-robot: if a Stable has 3 robots, that's 3 × 4 = 12 subscription rows created. The free L1 grant gives each robot a cap of 4, exactly matching the 4 Subscriptions each robot receives. Idempotent: re-running the migration does not double-grant or duplicate.

The free L1 grant is a one-time migration concession, not the default for new Stables. New Stables created after the deploy start at Level 0 with 3 onboarding-picked Subscriptions for their first robot.

### Why switching is free with a next-cycle delay

A credit cost on switching turns the system into a punishment for changing your mind. We want players to experiment with robot specialisation. Free switching keeps the decision low-stakes. The next-cycle delay (you can swap at any time, the new subscription is honoured starting the next cycle) avoids race conditions: the matchmaker reads the Subscription set at the start of its run, the robot's switches between runs are queued and applied at the next run boundary.

### Why a Subscription Lock when battles are queued

If a robot has a Tag Team match scheduled for next cycle and the player unsubscribes that robot from Tag Team in this cycle, the matchmaker has already paired that robot's team. Either we cancel the queued match (frustrating for the opponent) or we honour the queued match anyway (subscription was a lie). Cleanest: prevent the unsubscription while a battle is queued for THAT ROBOT, with error code `EVENT_SUBSCRIPTION_LOCKED`. Mirrors `TEAM_LOCKED_FOR_BATTLE` in the team-battles spec. Crucially, the lock is per robot — other robots in the same Stable are unaffected.

### Out of Scope

- **Cross-stable subscriptions / guild-wide events.** Each Stable manages its own robots' Subscriptions. Multi-stable event participation is Backlog #45 (social features).
- **Subscription marketplace / lending.** No transferring subscriptions between robots or Stables.
- **Admin override of individual robot subscriptions.** Admins can grant Booking Office levels directly via the existing facility admin tooling; they do not edit Subscriptions on a robot's behalf. Players manage their own.
- **Re-implementing the existing Booking Office description.** The description and benefits text in `facilities.ts` is rewritten by this spec to reflect event subscriptions; the cost and prestige curves are kept as-is.
- **Changes to the existing `Facility` Prisma model.** Subscriptions live in a new table joined to `Robot`; the Facility row itself is unchanged in shape.
- **Updating the team-battles-2v2-3v3 spec to consume this system.** That spec is on hold; once this spec ships, the team-battles spec gets an update pass to register the two new modes and reuse the existing eligibility helper. Out of scope here.
- **Real-time subscription change notifications.** Subscription changes take effect at the next cycle boundary. No live-update infrastructure.
- **Subscription history / time-travel.** We persist the current Subscription set per robot. We do not log every historical change as a queryable event (the existing audit log captures changes for compliance, but there's no in-game subscription history page).
- **Crediting credits back when a robot is unsubscribed from an event mid-cycle.** No partial refunds, no rebates. The robot simply stops participating starting next cycle.
- **Team formation logic.** This spec establishes the per-robot subscription pool. Actual team formation (TagTeam registration, 2v2/3v3 team creation) is handled by existing tag-team logic and future spec 37. Subscription = pool eligibility; team formation = selection from pool.

## Expected Contribution

This spec implements the dormant Booking Office facility with event-subscription semantics. It establishes the Event Subscription System as the single mechanism for gating robot participation in battle events, replacing the current implicit auto-enrolment model. Subscriptions are per-robot, enabling robot specialisation and clean per-robot locking.

1. **Booking Office facility activated.** Before — `booking_office` exists in `facilities.ts` with `implemented: false`; nothing in the codebase reads it. After — the facility is `implemented: true`, its description updated to reflect event-subscription semantics, and its cost/prestige curves drive purchase progression. Verifiable by: `implemented: true` in config, the existing facility purchase route accepts purchases for `booking_office`, and Stables can see and buy levels.

2. **Event Subscription System gates every battle mode uniformly per robot.** Before — each of the four current battle modes auto-includes any robot that meets per-mode criteria. After — each mode's matchmaker calls a single shared eligibility helper (`isRobotSubscribedTo(robotId, eventType)`) before pairing or pool inclusion; robots not subscribed are silently excluded. Verifiable by: a robot subscribed to KotH and 1v1 Tournament but not 1v1 League is excluded from 1v1 League matchmaking; the same robot is included in KotH; same pattern for every other mode.

3. **Max_Events_Per_Robot config-driven.** Before — no concept of subscription cap. After — the cap-per-level table is a single configuration constant (e.g. `BOOKING_OFFICE_MAX_EVENTS_PER_ROBOT = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]` indexed by level). The cap applies per robot. Verifiable by: the constant exists in one file; the helper that computes the cap reads from the constant; changing the array changes the cap with no other code changes.

4. **Event Registry as the single source of truth.** Before — no abstraction; each event mode is hard-wired into the cycle scheduler. After — a typed `SubscribableEventType` enum and a registry hook (`registerSubscribableEvent({type, label, lockingPredicate})`) define every Subscribable Event in one place. Future modes register themselves; the Booking Office UI reads the registry to render the available event list dynamically. Verifiable by: the registry contains exactly the v1 set (`league`, `tournament`, `tag_team`, `koth`); adding a new entry to the registry exposes it in the UI without further code changes.

5. **Per-robot subscription persistence and switching mechanics.** Before — no concept of a Subscription. After — a `subscription` table per robot, capped at `BOOKING_OFFICE_MAX_EVENTS_PER_ROBOT[level]` (where level is the owning Stable's Booking Office level), switchable freely with next-cycle effect, locked per robot while that robot has a queued battle. Verifiable by: a robot whose Stable is at Booking Office L0 cannot create a 4th Subscription; an attempt to drop a robot's Tag Team Subscription while that robot has a queued Tag Team match returns `EVENT_SUBSCRIPTION_LOCKED`; a switch made mid-cycle takes effect at the next matchmaking run.

6. **ACC migration: free L1 + all four modes for every existing robot.** Before — every robot on ACC participates in 1v1 League automatically; participates in Tag Team if its Stable has a `TagTeam` row; participates in KotH if battle-ready; participates in 1v1 Tournament when an active tournament exists. After — every existing Stable holds Booking Office Level 1 (free, granted by the migration) and every existing robot holds Subscriptions to all four current modes. Verifiable by: post-migration count of `booking_office` facilities at level ≥ 1 equals the pre-migration `User` count; total Subscription rows equals total robots × 4.

7. **Onboarding per-robot subscription picker.** Before — onboarding does not surface event participation. After — onboarding includes a step where the player picks 3 Subscriptions for their first robot from the Event Registry, with an inline "buy Booking Office Level 1 now to pick a 4th" affordance (hidden for 1-robot Stables at v1). Verifiable by: the onboarding UI renders the picker; default selections are `league`, `tournament`, `koth`; completing onboarding persists the chosen Subscriptions for the robot.

8. **Robot-level subscription management UI.** Before — no subscription management surface. After — the Robot Detail page includes a subscription management section showing the robot's current subscriptions, available events, cap, and lock state. Verifiable by: navigating to a robot's detail page shows its subscriptions; subscribe/unsubscribe actions work per robot.

9. **Future events plug in without spec rework.** Before — adding a new event mode requires hand-wiring eligibility into the cycle scheduler and inventing a per-event opt-in story. After — adding a new event mode is a single registry call (`registerSubscribableEvent({...})`) plus the matchmaking-hook implementation; it appears in the subscription UI automatically. Verifiable by: the team-battles-2v2-3v3 spec, when it lands, adds two registry entries (`team_2v2`, `team_3v3`) and reuses the existing `isRobotSubscribedTo` check — no changes to this spec's code beyond the registry entries themselves.

### Verification Criteria

After all tasks are complete, the following automatable checks confirm the spec was delivered as designed.

1. `grep -n "implemented: true" app/backend/src/config/facilities.ts | grep -B 5 "booking_office"` — the Booking Office facility row is `implemented: true`.
2. `grep -n "Access to" app/backend/src/config/facilities.ts | grep -i "booking_office\|event subscription"` — the description text reflects event-subscription semantics.
3. `grep -n "BOOKING_OFFICE_MAX_EVENTS_PER_ROBOT" app/backend/src/config/` — the slot cap curve constant exists exactly once and is exported for reuse.
4. `psql ... -c "\d subscription"` — a `subscription` table exists holding `(id, robot_id, event_type, created_at)` with a unique constraint on `(robot_id, event_type)`. FK to `Robot.id`. No `stable_id` column.
5. `psql ... -c "SELECT COUNT(*) FROM facility WHERE facility_type = 'booking_office' AND level >= 1;"` — after the migration, the count equals the number of pre-existing Stables.
6. `psql ... -c "SELECT event_type, COUNT(*) FROM subscription GROUP BY event_type;"` — after the migration, the count for each of `league`, `tournament`, `tag_team`, and `koth` equals the pre-migration total robot count.
7. `psql ... -c "SELECT id FROM robots WHERE id NOT IN (SELECT robot_id FROM subscription WHERE event_type = 'league');"` — returns zero rows after migration (no existing robot left without the four base subscriptions).
8. `grep -rn "isRobotSubscribedTo\b" app/backend/src/services/league/ app/backend/src/services/tournament/ app/backend/src/services/tag-team/ app/backend/src/services/koth/` — every battle-mode matchmaker invokes the shared eligibility helper before pairing or pool inclusion.
9. `grep -rn "registerSubscribableEvent\b" app/backend/src/services/` — the registry registration call exists exactly once per Subscribable Event (v1: 4 calls — `league`, `tournament`, `tag_team`, `koth`).
10. `cd app/backend && npm test -- subscription` — all backend tests for the Subscription System pass: per-robot cap enforcement, switching with next-cycle effect, per-robot lock-on-queued-battle, registry registration, eligibility check.
11. `cd app/backend && npm test -- bookingOfficeMigration` — the migration script test asserts: idempotent; every existing Stable has Booking Office level ≥ 1 (existing higher levels preserved); every existing robot has Subscriptions to `league`, `tournament`, `tag_team`, `koth`; new robots created post-migration start with no Subscriptions until explicitly subscribed.
12. `cd app/frontend && npm test -- BookingOffice OnboardingSubscription RobotSubscription` — frontend tests pass: robot-level subscription management UI cap enforcement, lock-state rendering, switch confirmation flow, onboarding subscription picker default selections.
13. Manual integration on a dev DB seeded to a cycle-58-equivalent state: run the migration, confirm post-migration that every robot still gets paired in 1v1 League, every previously-active Tag Team robot still gets paired in Tag Team, every robot still gets considered for KotH and Tournament.
14. Manual integration: a robot whose Stable is at Booking Office L0 with 3 Subscriptions attempts to subscribe to a 4th event; the request is rejected with error code `SUBSCRIPTION_CAP_EXCEEDED`. The Stable purchases Booking Office L1; the 4th subscription for that robot succeeds.
15. Manual integration: a robot with a queued Tag Team match attempts to drop its Tag Team Subscription; the request is rejected with error code `EVENT_SUBSCRIPTION_LOCKED`. Another robot in the same Stable (without a queued match) can freely change its subscriptions. The match executes the next cycle; the first robot then drops the Subscription successfully.
16. Manual integration: a brand-new Stable goes through onboarding; the picker presents the event list for the first robot with `league`, `tournament`, `koth` pre-selected; the player can swap any of the three; completing onboarding persists exactly the picked Subscriptions for that robot.
17. `grep -n "Booking Office" docs/game-systems/PRD_FACILITIES_PAGE.md docs/architecture/PRD_SERVICE_DIRECTORY.md` — both documents reference the Booking Office facility and the Event Subscription System.
18. `grep -n "Booking Office\|Event Subscription" .kiro/steering/project-overview.md` — the steering file lists the Event Subscription System under "Key Systems".
19. `grep -n "#55\|booking-office\|Booking Office" docs/BACKLOG.md` — Backlog #55 (Battle Subscription Facility) is marked completed and references this spec at `.kiro/specs/35-booking-office-facility/`. Backlog #7 is updated to remove Booking Office from the unimplemented-facilities list.
20. `grep -n "registerSubscribableEvent" docs/architecture/PRD_SERVICE_DIRECTORY.md` — the service directory documents the registry hook for new event modes.

## Requirements

### R1: Booking Office Facility Activation

**R1.1** THE `booking_office` facility row in `app/backend/src/config/facilities.ts` SHALL have `implemented: true` after this spec is delivered.

**R1.2** THE description string of the `booking_office` row SHALL be updated to reflect event-subscription semantics, naming the system as the Event Subscription System and describing that the per-level Max_Events_Per_Robot grants additional concurrent event subscriptions per robot.

**R1.3** THE cost curve of the `booking_office` row in `facilities.ts` SHALL be set to a linear `level × 75000` schedule, replacing the original premium pricing. Final values: `costs: [75000, 150000, 225000, 300000, 375000, 450000, 525000, 600000, 675000, 750000]`. THE prestige curve SHALL be set to `prestigeRequirements: [0, 0, 0, 1000, 0, 0, 5000, 0, 10000, 0]`, matching the Repair Bay and Workshop pattern (L4 = 1000, L7 = 5000, L9 = 10000), replacing the original steep curve.

**R1.4** THE existing facility purchase route at `app/backend/src/routes/facility.ts` SHALL accept purchases and upgrades for `booking_office` without code changes specific to this facility type, relying on the generic facility framework.

**R1.5** WHEN a Stable purchases or upgrades the `booking_office` facility, THE existing prestige requirement check defined by the `prestigeRequirements` array on the row SHALL apply identically to all other implemented facilities.

**R1.6** THE `booking_office` `maxLevel` SHALL remain at 10 (the value already configured in `facilities.ts`).

### R2: Slot Cap Curve

**R2.1** THE Event_Subscription_System SHALL expose a Max_Events_Per_Robot as a single configuration constant `BOOKING_OFFICE_MAX_EVENTS_PER_ROBOT` in `app/backend/src/config/`, an array indexed 0..10 mapping Booking Office level to the maximum allowed Subscription count per robot, with v1 values `[3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]`.

**R2.2** WHEN any code path needs to know the Subscription cap for a robot, IT SHALL look up the cap by reading `BOOKING_OFFICE_MAX_EVENTS_PER_ROBOT[level]` for the owning Stable's current `booking_office` facility level (treating absence of the facility as level 0). The cap applies identically to every robot owned by that Stable.

**R2.3** THE Max_Events_Per_Robot SHALL produce a Subscription cap of at least 3 for every robot regardless of whether the owning Stable owns the Booking Office facility.

**R2.4** THE Max_Events_Per_Robot SHALL be monotonically non-decreasing: for every level `L` ∈ [0, 9], `BOOKING_OFFICE_MAX_EVENTS_PER_ROBOT[L+1] >= BOOKING_OFFICE_MAX_EVENTS_PER_ROBOT[L]`.

**R2.5** WHEN the Max_Events_Per_Robot constant is changed (e.g. a new event mode is added and the curve needs revisiting), no other code change SHALL be required for the new cap to take effect across matchmaking, the subscription UI, the onboarding picker, and the admin tooling.

### R3: Subscription Model and Cap Enforcement

**R3.1** THE Event_Subscription_System SHALL persist Subscriptions in a new database table joined by `robot_id` to `Robot`, where each row holds the robot identifier, the Subscribable Event type, and a created-at timestamp, with a unique constraint on `(robot_id, event_type)`. The table SHALL have a foreign key to `Robot.id`. There SHALL be no `stable_id` column — the Stable is derived via `robot.userId`.

**R3.2** WHEN a player attempts to create a Subscription for a robot that would result in a Subscription count for that robot greater than `BOOKING_OFFICE_MAX_EVENTS_PER_ROBOT[level]` (where level is the owning Stable's Booking Office level), THE Event_Subscription_System SHALL reject the request with error code `SUBSCRIPTION_CAP_EXCEEDED` and SHALL leave the existing Subscription set unchanged.

**R3.3** WHEN a player attempts to create a Subscription for a Subscribable Event the robot is already subscribed to, THE Event_Subscription_System SHALL reject the request with error code `SUBSCRIPTION_DUPLICATE` and SHALL leave the existing Subscription set unchanged.

**R3.4** WHEN a player attempts to create a Subscription for an event type that is not in the Event_Registry, THE Event_Subscription_System SHALL reject the request with error code `SUBSCRIPTION_UNKNOWN_EVENT`.

**R3.5** WHEN a player removes a Subscription from a robot, THE Event_Subscription_System SHALL delete the corresponding Subscription row, AND the freed slot SHALL be available for a different Subscription on the next subscription operation.

**R3.6** THE Event_Subscription_System SHALL NOT permit a robot to hold more than one Subscription for the same `event_type` at any time.

**R3.7** WHEN the `booking_office` facility level for a Stable changes via purchase or admin action, THE Event_Subscription_System SHALL NOT automatically create or remove Subscriptions for any robot; each robot's Subscription set is changed only by explicit subscribe and unsubscribe operations and by the migration in R6.

**R3.8** IF a downward facility level change ever causes a robot's current Subscription count to exceed `BOOKING_OFFICE_MAX_EVENTS_PER_ROBOT[newLevel]`, THEN THE Event_Subscription_System SHALL retain all current Subscriptions for that robot (no automatic deletion) AND SHALL prevent creation of any new Subscription for that robot until the count is at or below the new cap. Note: this spec does not provide a player-facing facility downgrade flow; admins only.

### R4: Switching Behaviour and Subscription Lock

**R4.1** WHEN a player creates or removes a Subscription for a robot, THE change SHALL persist immediately to the database, AND the change SHALL take effect at the next Cycle_Scheduler matchmaking run for that event type.

**R4.2** Subscription create and remove operations SHALL NOT charge any credit cost.

**R4.3** WHEN a player attempts to remove a Subscription for a robot from a Subscribable Event, IF THAT ROBOT has a queued battle for that event scheduled in the next cycle that has not yet executed, THEN THE Event_Subscription_System SHALL reject the removal with error code `EVENT_SUBSCRIPTION_LOCKED`. Other robots in the same Stable are unaffected by this lock.

**R4.4** WHEN a player attempts to remove a Subscription for a robot from a Subscribable Event, IF that robot does NOT have a queued battle for that event, THEN THE Event_Subscription_System SHALL permit the removal regardless of whether other robots in the same Stable have queued battles for that event.

**R4.5** A Subscription Lock for a robot SHALL be released as soon as the queued battle for that robot for that event executes (success, draw, or cancellation).

**R4.6** THE Event_Subscription_System SHALL apply Subscription create and remove operations atomically in a Prisma interactive transaction with `SELECT … FOR UPDATE` on the robot's Subscription rows, preventing concurrent operations from violating the cap or duplicating subscriptions.

**R4.7** Tournament-style Subscribable Events SHALL apply a stricter Subscription Lock per robot:
1. WHEN a robot is alive in an active tournament bracket (i.e. has not been eliminated in a prior round and the tournament has not ended), THE `tournament` Subscription Lock SHALL apply for that robot.
2. WHEN that robot is eliminated (loses a round) or the tournament ends, THE Subscription Lock SHALL release for that robot.
3. THE rule applies identically to every tournament-style Subscribable Event registered in the future (e.g. Team Battle 2v2 Tournament, Team Battle 3v3 Tournament). The registry's `lockingPredicate` for each tournament-style event SHALL implement this rule per robot.

**R4.8** Bracket eligibility for any tournament-style Subscribable Event SHALL be evaluated per robot at bracket-generation time, NOT at battle-execution time. Specifically:
1. WHEN a tournament's bracket is generated, THE bracket generator SHALL include only robots that hold the relevant Subscription at that moment.
2. WHEN a robot is subscribed mid-tournament (between bracket generation and tournament end), THE robot SHALL NOT be inserted into the active bracket; the robot becomes eligible for the next bracket only.
3. WHEN a player attempts to unsubscribe a robot mid-tournament for an event in which the robot is alive, R4.7's lock blocks the unsubscribe. WHEN the robot is already eliminated or the tournament has ended, the unsubscribe is permitted.

**R4.9** League-style Subscribable Events SHALL apply the standard per-robot per-cycle queued-battle Subscription Lock (R4.3): unsubscribe is blocked only while that robot has a battle queued in the next cycle. After the queued battle executes, the robot can be unsubscribed even though it holds league points; its league points SHALL persist (frozen at the current value) and SHALL be restored when the robot is resubscribed.

### R5: Event Registry

**R5.1** THE Event_Subscription_System SHALL expose a `SubscribableEventType` discriminated union typed at the TypeScript level, where each member identifies a single Subscribable Event by a stable string identifier.

**R5.2** THE Event_Subscription_System SHALL expose a `registerSubscribableEvent({type, label, lockingPredicate})` registry hook that registers a single Subscribable Event with the registry, where `type` is a `SubscribableEventType`, `label` is a player-facing display string, and `lockingPredicate` is a function `(robotId) => Promise<boolean>` returning whether that robot has a queued battle for that event.

**R5.3** WHEN the Event_Subscription_System is initialised, THE registry SHALL be populated with exactly four v1 entries: `league`, `tournament`, `tag_team`, `koth`.

**R5.4** WHEN a duplicate `registerSubscribableEvent` call is made for an already-registered `SubscribableEventType`, THE registry SHALL reject the duplicate registration at module-load time with a clear error so the developer fixes it before the system runs.

**R5.5** THE Event_Subscription_System SHALL expose a single helper function `isRobotSubscribedTo(robotId, eventType): Promise<boolean>` that every battle-mode matchmaker SHALL invoke per robot before including that robot in matchmaking.

**R5.6** THE Event_Registry SHALL be the single source of truth for the set of Subscribable Events; the subscription management UI and the Onboarding_Subscription_Picker SHALL render the event list by reading the registry rather than hardcoding events.

**R5.7** THE registration of `league`, `tournament`, `tag_team`, and `koth` in the Event_Registry SHALL provide accurate per-robot `lockingPredicate` implementations:
1. `league` — returns `true` if the robot is referenced by a `ScheduledLeagueMatch` row whose `status = 'scheduled'`.
2. `tournament` — returns `true` if the robot is referenced by an open (non-completed) `ScheduledTournamentMatch` row (i.e. the robot is alive in an active bracket).
3. `tag_team` — returns `true` if the robot is on a `TagTeam` row (as active or reserve) referenced by a `ScheduledTagTeamMatch` row whose `status = 'scheduled'`.
4. `koth` — returns `true` if the robot is referenced by a `ScheduledKothMatchParticipant` row whose match status is `'scheduled'`.

### R6: Migration and ACC Cycle-58 Backward Compatibility

**R6.1** A migration script SHALL run as part of the deploy that ships this spec, performing the following actions:
1. For every existing `User` (Stable) row: upsert the Stable's `Facility` row with `facilityType = 'booking_office'` and `level = max(existing_level, 1)`. The migration never lowers an existing level.
2. For every existing `Robot` row: insert the four base Subscription rows: `league`, `tournament`, `tag_team`, `koth`. Existing Subscription rows are preserved; duplicates are not inserted.

**R6.2** THE migration script SHALL be idempotent: running it more than once SHALL produce the same final state as a single run, with no double-grants of facility levels or duplicated Subscription rows.

**R6.3** THE migration script SHALL emit a structured summary at the end of the run reporting: total Stables processed, total robots processed, total `booking_office` facilities granted (new), total `booking_office` levels increased to L1, total Subscription rows created per event type, total Stables/robots left unchanged.

**R6.4** WHEN the migration completes, FOR every existing robot, THE robot SHALL hold all four base Subscriptions (`league`, `tournament`, `tag_team`, `koth`) AND the owning Stable SHALL hold a `booking_office` facility at level ≥ 1.

**R6.5** Robots created after the migration completes SHALL start with zero Subscriptions until they are explicitly subscribed via the subscription management UI or the Onboarding_Subscription_Picker (R8).

**R6.6** THE migration SHALL run within a single Prisma transaction per Stable (covering the Stable's facility upsert and all its robots' subscription inserts) so partial failures roll back per-Stable rather than aborting the whole migration.

**R6.7** IF the migration encounters an error processing an individual Stable, THEN THE migration SHALL log the error with the Stable identifier and continue with the next Stable, and SHALL include the failed Stables in the final summary report.

**R6.8** Seeded user generation in `app/backend/src/utils/userGeneration.ts` SHALL be extended so that every newly seeded robot receives exactly 3 randomly chosen Subscriptions, drawn from the set of Subscribable Events that pass the Roster_Eligibility_Filter for that robot's owning Stable's robot count, AND IF the eligible set has fewer than 3 events, THE seeded robot SHALL receive Subscriptions for every eligible event (count < 3) without raising an error.

**R6.9** WHEN seeded user generation runs for a 1-robot Stable, THE Roster_Eligibility_Filter SHALL exclude `tag_team` from the candidate set, so the random pick is drawn from `{league, tournament, koth}` only.

**R6.10** WHEN seeded user generation runs for a Stable with 2 or more robots, THE candidate set SHALL include all four v1 Subscribable Events (`league`, `tournament`, `tag_team`, `koth`), AND IF the seeded tier's existing `createTagTeam` flag is `true`, THE robots on the TagTeam SHALL receive a `tag_team` Subscription unconditionally and the remaining 2 random picks SHALL be drawn from the other three events.

**R6.11** THE migration script SHALL be a one-off action: a follow-up cleanup PR SHALL delete the migration script, its tests, and any related glue code from the codebase after the migration has run successfully on production AND the structured summary from R6.3 has been verified. The cleanup PR SHALL be tracked as a task in this spec's `tasks.md` and SHALL be merged before the spec is moved to `done-{month}{year}/`.

**R6.12** THE migration script SHALL NOT be registered with `cycleScheduler`, SHALL NOT be reachable from any admin route, and SHALL NOT be triggerable from the application runtime; it is invoked once via the deploy pipeline (e.g. `npm run migrate:booking-office`) and is otherwise inert.

### R7: Matchmaking Integration for All Subscribable Events

**R7.1** WHEN `runMatchmaking` (1v1 League) runs, THE matchmaker SHALL invoke `isRobotSubscribedTo(robotId, 'league')` for every candidate robot and SHALL exclude any robot for which the helper returns `false` from the matchmaking pool.

**R7.2** WHEN `autoCreateNextTournament` or any other 1v1 Tournament eligibility routine selects participating robots, THE routine SHALL invoke `isRobotSubscribedTo(robotId, 'tournament')` for each candidate robot and SHALL exclude robots for which the helper returns `false`.

**R7.3** WHEN `runTagTeamMatchmaking` runs, THE matchmaker SHALL invoke `isRobotSubscribedTo(robotId, 'tag_team')` for every robot on every candidate TagTeam and SHALL exclude any TagTeam where either the active or reserve robot returns `false` from the matchmaking pool.

**R7.4** WHEN `runKothMatchmaking` runs, THE matchmaker SHALL invoke `isRobotSubscribedTo(robotId, 'koth')` for every candidate robot and SHALL exclude any robot for which the helper returns `false` from the candidate pool.

**R7.5** WHEN a battle-mode matchmaker excludes a robot due to a missing Subscription, THE matchmaker SHALL emit a single informational log entry per excluded robot per matchmaking run, recording the robot identifier, the owning Stable identifier, the event type, and the cycle number, with no exception propagation.

### R8: Onboarding Subscription Picker

**R8.1** THE existing onboarding flow SHALL include a new step in which a brand-new Stable picks Subscriptions for its first robot from the Event_Registry, filtered by the Roster_Eligibility_Filter for the Stable's current robot count.

**R8.2** WHEN the Onboarding_Subscription_Picker is rendered, THE picker SHALL display the set of Subscribable Events that pass the Roster_Eligibility_Filter for the Stable, AND SHALL pre-select up to 3 events from that filtered set (preferring `league`, `tournament`, `koth` in that order when `tag_team` is filtered out due to 1-robot Stable).

**R8.3** WHEN the Stable's robot count is exactly 1, THE Onboarding_Subscription_Picker SHALL exclude `tag_team` from the displayed event list AND SHALL NOT render the inline "purchase Booking Office Level 1 now" affordance — a 1-robot Stable cannot meaningfully use a 4th Subscription at v1.

**R8.4** WHEN the Stable's robot count is 2 or more (i.e. the filtered eligible event count exceeds the current Max_Events_Per_Robot), THE Onboarding_Subscription_Picker SHALL render an inline "purchase Booking Office Level 1 now" affordance that, when the player accepts it, runs through the existing facility purchase route (charging credits per the existing cost curve and applying the existing prestige requirement check) and, on success, raises the picker's cap to 4 so the player can select a 4th Subscription for the robot before completing onboarding.

**R8.5** WHEN a brand-new Stable completes onboarding, THE Event_Subscription_System SHALL persist exactly the Subscriptions selected in the picker for the first robot, AND SHALL persist the Booking Office L1 row only if the player accepted the inline purchase under R8.4.

**R8.6** WHEN the inline-buy affordance is rendered (per R8.4) and the brand-new Stable does not have enough credits to purchase Booking Office Level 1, THE affordance SHALL be visibly disabled with a tooltip explaining the credit requirement, AND the picker SHALL still allow completing onboarding with the L0 cap.

**R8.7** WHEN the inline-buy affordance is rendered (per R8.4) and the brand-new Stable does not yet meet the prestige requirement for Booking Office L1, THE affordance SHALL be visibly disabled with a tooltip explaining the prestige requirement (informational; for the v1 Booking Office row, L1 has a 1000 prestige requirement). In this case the player completes onboarding at the L0 cap.

**R8.8** THE Onboarding_Subscription_Picker SHALL render the available event list dynamically from the Event_Registry combined with the Roster_Eligibility_Filter, so registering new Subscribable Events later (e.g. team battle 2v2 / 3v3) automatically surfaces them in onboarding for Stables whose robot count meets the new event's roster requirement.

### R9: UI Surfaces

**R9.1** THE Facilities page SHALL render the Booking Office row identically to other implemented facilities (level, cost-to-next-level, prestige requirement, benefits) using the existing facility-card component, AND THE Booking Office card SHALL include a link to the Booking Office overview surface (R9.10).

**R9.1.1** THE Facilities page SHALL hide every facility row whose `implemented: false` flag is set in `app/backend/src/config/facilities.ts`. At delivery time of this spec, that means Research Lab, Medical Bay, and Coaching Staff rows SHALL NOT appear on the Facilities page. Implementation: filter at the API boundary (the `/api/facilities` route returns only implemented rows) and at the UI boundary (the Facilities page does not render unimplemented rows even if returned by the API).

**R9.1.2** THE filter in R9.1.1 SHALL be config-driven (reading `implemented: true` from `facilities.ts`) so that future facilities flip from hidden to visible by setting their flag, with no UI code changes required.

**R9.1.3** THE existing `Facility` rows in the database for any facility whose `implemented: false` flag is set SHALL be left untouched by this spec. If a player previously purchased an unimplemented facility (e.g. Research Lab L1), the row stays in the database but is invisible in the UI; the existing facility purchase route SHALL continue to reject new purchases for unimplemented facilities (existing behaviour, no change).

**R9.2** THE Robot Detail page SHALL include a subscription management section showing: the robot's current Subscriptions, the current Max_Events_Per_Robot derived from the owning Stable's Booking Office level, and the list of available unsubscribed Subscribable Events read from the Event_Registry filtered by the Roster_Eligibility_Filter. The player SHALL be able to subscribe and unsubscribe the robot from this section.

**R9.10** A Booking Office overview surface SHALL be reachable from the Facilities page Booking Office card AND from the main navigation, AND the surface SHALL display a Stable-level matrix view: all robots owned by the Stable as rows, all Subscribable Events from the Event_Registry as columns, with each cell showing whether that robot is subscribed to that event (with subscribe/unsubscribe toggle per cell), the current Max_Events_Per_Robot per robot, and per-event totals (how many of the Stable's robots are subscribed to each event). The player SHALL be able to manage subscriptions for any robot from this overview without navigating to each Robot Detail page individually.

**R9.11** THE Booking Office overview surface (R9.10) SHALL display per-event summary counts at the top or bottom of each event column (e.g. "3 of 5 robots subscribed to 3v3 League") so the player can see at a glance which events have full coverage and which do not.

**R9.3** WHEN a robot's current Subscription count equals the Max_Events_Per_Robot, THE subscription management section SHALL disable the "subscribe" affordance for unsubscribed events and SHALL display an explicit message stating that the Stable must upgrade Booking Office to subscribe this robot to additional events.

**R9.4** WHEN a Subscription for a robot is currently locked under R4.3, THE subscription management section SHALL render that Subscription with a visible "lock" indicator and SHALL disable the "unsubscribe" affordance for that Subscription, AND SHALL display the queued battle's scheduled cycle.

**R9.5** WHEN a player creates or removes a Subscription for a robot via the UI, THE UI SHALL display a confirmation message indicating that the change takes effect at the next matchmaking run for that event.

**R9.6** THE Robots page SHALL display on each robot card which events that robot is currently subscribed to, as a compact list of event badges or icons.

**R9.7** WHEN a robot's Subscription count is zero, THE subscription management section on the Robot Detail page SHALL render an explicit empty-state placeholder explaining that the robot currently has no Subscriptions and that no battles will be scheduled for this robot until it is subscribed to at least one event.

**R9.8** THE subscription management section SHALL apply the Roster_Eligibility_Filter to the registry, hiding events the robot cannot participate in given the Stable's current robot count, AND WHEN an event is hidden because of insufficient robots, THE section SHALL display a brief explanatory note (e.g. "Tag Team requires 2 or more robots in your Stable") so the player understands why the event is unavailable.

**R9.9** WHEN a Stable that previously had a robot subscribed to an event drops below the robot count required by that event (e.g. a 2-robot Stable subscribed to Tag Team loses a robot), THE existing Subscription rows SHALL be retained in the database, AND the subscription management section SHALL render those Subscriptions with a "no longer eligible" indicator until the Stable rebuilds its roster or the player unsubscribes the robot; the matchmaker SHALL continue to exclude the robot from that event via the existing per-mode robot-count check.

### R10: Validation, Authorization, Security

**R9.12** Every new UI surface introduced by this spec (Booking Office overview matrix, Robot Detail subscription section, onboarding subscription picker, event badges on robot cards) SHALL be fully usable on mobile viewports (≥ 320px width) following the project's mobile-first approach and the responsive tab layout pattern documented in `.kiro/steering/frontend-standards.md`. Specifically:
1. The Booking Office overview matrix (R9.10) SHALL collapse to a stacked card layout on viewports < 1024px, showing one robot per card with its subscriptions as toggleable badges.
2. The Robot Detail subscription section (R9.2) SHALL render as a vertical list of event toggles on mobile, with no horizontal overflow.
3. The onboarding subscription picker (R8.1) SHALL render as a full-width vertical list of selectable events on mobile.
4. Event badges on robot cards (R9.6) SHALL wrap to multiple lines rather than overflow horizontally on narrow viewports.

### R10: Validation, Authorization, Security

**R10.1** Every new route exposed by this spec SHALL declare a Zod schema for body, query, and params (as applicable) and SHALL use the existing `validateRequest` middleware from `app/backend/src/middleware/schemaValidator.ts`, AND no route file added by this spec SHALL contain an ESLint disable directive for the `custom-routes/require-validate-request` rule.

**R10.2** WHEN a Subscription create or remove route is invoked, THE route SHALL invoke an ownership-verification helper inside the same Prisma interactive transaction as the mutation, verifying that the requester owns the robot (via `robot.userId`), such that ownership is verified and the mutation commits atomically with no intervening read.

**R10.3** IF an ownership-verification helper for a Subscription mutation fails because the requester does not own the robot, THEN THE route SHALL return HTTP status 403 with response body string `"Access denied"` and a payload byte-identical across ownership-failure causes.

**R10.4** Subscription create and remove operations SHALL emit one `audit_log` row per operation with `eventType` value `'subscription_create'` or `'subscription_remove'`, payload including the robot identifier, the owning Stable identifier, and the event type, persisted before the operation returns to the caller.

**R10.5** WHEN the migration script runs, THE migration SHALL emit an `audit_log` row per Stable processed, recording the granted facility level and total Subscription rows created across all robots, so the migration is auditable.

**R10.6** Booking Office facility purchase and upgrade operations SHALL continue to use the existing `lockUserForSpending` pattern from `app/backend/src/lib/creditGuard.ts` per the existing facility purchase code path; no changes to the credit-guard pattern are introduced by this spec. The inline-buy affordance from the Onboarding_Subscription_Picker SHALL also use this pattern.

### R11: Telemetry and Observability

**R11.1** WHEN a Subscription is created or removed for a robot, THE Event_Subscription_System SHALL emit a structured log entry recording the robot identifier, the owning Stable identifier, the event type, the operation, the Stable's Booking Office level at the time, and the robot's new total Subscription count.

**R11.2** WHEN a battle-mode matchmaker excludes a robot due to a missing Subscription, THE matchmaker SHALL count that exclusion in a per-run aggregate and emit a single summary log line at the end of the matchmaking run reporting the total exclusions per event type.

**R11.3** THE admin Stables dashboard SHALL render the Booking Office level per Stable and, in the robot detail view, the Subscription set per robot.

**R11.4** THE admin Cycle Controls page SHALL render the per-cycle Subscription-exclusion totals from R11.2 alongside the existing matchmaking summary.

**R11.5** THE admin portal SHALL include a Subscription Analytics view showing: per-event subscriber counts (total robots subscribed per event type), trend over the last 30 cycles, and a per-Stable breakdown (which Stables have the most robots subscribed to each event). This view enables admins to see what's popular and what is not.

### R12: Documentation Updates

**R12.1** `docs/game-systems/PRD_FACILITIES_PAGE.md` SHALL contain a section with the heading `## Booking Office` describing the facility's event-subscription semantics, the per-robot Max_Events_Per_Robot, the switching behaviour, the per-robot lock-on-queued-battle rule, and the list of Subscribable Events.

**R12.2** `docs/architecture/PRD_SERVICE_DIRECTORY.md` SHALL contain an entry for the Event_Subscription_System describing the `registerSubscribableEvent` registry hook and the `isRobotSubscribedTo` helper, with a one-line description of each module added by this spec.

**R12.3** `.kiro/steering/project-overview.md` SHALL include the entry `Booking Office / Event Subscription System` in the "Key Systems" list.

**R12.4** `.kiro/steering/game-mechanics-reference.md` SHALL list the Event Subscription System as the gating mechanism for all battle event modes, and SHALL document the per-robot Max_Events_Per_Robot.

**R12.5** `docs/BACKLOG.md` SHALL mark Backlog #55 (Battle Subscription Facility) as completed with a reference to this spec at `.kiro/specs/35-booking-office-facility/`. Backlog #7 (Unimplemented Facilities) SHALL be updated to remove Booking Office from the list of remaining unimplemented facilities.

**R12.6** A new in-game guide article SHALL be created via the existing in-game guide system explaining the Booking Office facility, what events are subscribable per robot, how to subscribe and switch per robot, the per-robot lock-on-queued-battle rule, and how to add a 4th Subscription via the inline buy during onboarding.

**R12.7** A public changelog entry SHALL be created via the in-game changelog system explaining the new facility, the migration behaviour for existing players (free L1 + all four current Subscriptions for every robot, no loss of access), and the implications for new players (3 onboarding-picked Subscriptions per robot at L0, more via Booking Office levels).

**R12.8** A pull request or release for this spec SHALL be blocked from merging or shipping IF any of the documentation updates required by R12.1 through R12.7 is absent.

### R13: Property-Based Test Coverage

**R13.1** A property-based test SHALL exist that, for at least 100 randomised runs over robots owned by Stables with a randomly chosen Booking Office level in the closed interval [0, 10] and a randomly chosen subset of Subscribable Events from the v1 registry, asserts that the per-robot Subscription cap defined by `BOOKING_OFFICE_MAX_EVENTS_PER_ROBOT[level]` is never violated by any sequence of subscribe and unsubscribe operations on that robot.

**R13.2** A property-based test SHALL exist that, for at least 100 randomised runs, asserts that the migration script is idempotent per robot: applying it twice produces the same final state as applying it once for any starting state of `User`, `Robot`, `Facility`, `TagTeam`, `Tournament`, and `BattleParticipant` rows.

**R13.3** A property-based test SHALL exist that, for at least 100 randomised runs over robots with random Booking Office levels (via their owning Stable) and random Subscription sets, asserts that `isRobotSubscribedTo(robotId, eventType)` returns `true` if and only if a Subscription row exists for `(robotId, eventType)` regardless of the Booking Office level.

**R13.4** A property-based test SHALL exist that asserts the registry rejects duplicate `registerSubscribableEvent` calls for the same event type at module-load time.

**R13.5** A property-based test SHALL exist that asserts `BOOKING_OFFICE_MAX_EVENTS_PER_ROBOT` is monotonically non-decreasing and that `BOOKING_OFFICE_MAX_EVENTS_PER_ROBOT[0] >= 3`.

**R13.6** WHEN any property defined in R13.1–R13.5 fails, fast-check SHALL report the seed and the shrunk counter-example AND THE CI run SHALL fail.

### R14: Cycle Integration

**R14.1** THE Event_Subscription_System SHALL NOT add any new cron job to the Cycle_Scheduler; the existing per-event matchmaking jobs are extended via the registry hook only.

**R14.2** THE Event_Subscription_System SHALL be initialised on application startup (in `app/backend/src/index.ts` or an equivalent startup hook) before the Cycle_Scheduler initialises, so that `isRobotSubscribedTo` is available to every matchmaker.

**R14.3** THE existing local "run N cycles" admin tool (`adminCycleService.executeBulkCycles`) SHALL exercise Subscription-aware matchmaking in the same way production does, with no spec-specific changes to the bulk-cycle service required beyond what the matchmakers themselves now do.

**R14.4** THE existing admin manual-trigger endpoints in `app/backend/src/routes/admin.ts` for League matchmaking, Tag Team matchmaking, KotH matchmaking, Tournament progression, and any future matchmaking endpoint SHALL execute through the same Subscription-checking matchmakers; no parallel "ignore subscription" path SHALL be introduced.
