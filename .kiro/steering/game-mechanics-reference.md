---
inclusion: fileMatch
fileMatchPattern: "**/backend/src/game-engine/**,**/backend/src/services/battle/**,**/backend/src/services/combat/**,**/backend/src/services/matchmaking/**,**/backend/src/services/league/**,**/backend/src/services/cycle/**,**/backend/src/services/economy/**,**/backend/src/services/fame/**,**/backend/src/services/facility/**,**/backend/src/services/tournament/**,**/backend/src/services/team-battle/**"
---

# Game Mechanics Reference

This file contains only cross-domain mechanics that must be visible while changing game services. Feature rules belong in the relevant PRD; battle, repair, bye, season, and financial invariants belong in `battle-data-architecture.md` and `backend-finance.md`.

## Booking Office and subscriptions
- The Booking Office gates robot participation in all nine registered events: `league_1v1`, `league_2v2`, `league_3v3`, `tag_team`, `koth`, `grand_melee`, `tournament_1v1`, `tournament_2v2`, and `tournament_3v3`.
- `SUBSCRIBABLE_EVENT_TYPES` is the source for the event union and Zod schemas. New modes register through `registerSubscribableEvent`.
- The per-robot cap is `3 + bookingOfficeLevel`; subscriptions are per robot, not per stable.
- Subscribing is free under the cap. Unsubscribing is free, immediate, and always allowed. A scheduled match keeps its slot until resolved, so accounting is `subscriptions ∪ outstanding obligations`.
- The shared “does this robot owe a match?” question lives in `services/scheduling/eventScheduleScope`, including pre-battle repair scope. Do not reintroduce per-event locking predicates or `EVENT_SUBSCRIPTION_LOCKED`.
- All writes use `applySubscriptionChange`; single and bulk subscription endpoints must behave identically. Scheduling changes apply at the next event moment exposed by `nextSchedulingMoments`.
- Subscription state is active-only; old pending/activation behavior is not a valid state model.

## Cycle and team modes
- All registered battle events run daily; subscriptions gate participation. See `docs/game-systems/PRD_CYCLE_SYSTEM.md` and `PRD_SERVICE_DIRECTORY.md` for cadence.
- 2v2/3v3 League is simultaneous N-versus-N combat; Tag Team is phased with one active robot per side. Team LP/ELO tracks are separate from robot and tag-team tracks; team ELO is computed from members when matchmaking runs.
- Team matchmaking and league adapters are shared infrastructure, not per-route implementations. Team-specific effects, rewards, cadence, and API eligibility details belong in `docs/game-systems/PRD_MATCHMAKING.md`.

## Canonical references
- Combat and loadouts: `docs/architecture/COMBAT_FORMULAS.md`, `docs/game-systems/PRD_WEAPONS_LOADOUT.md`, `docs/game-systems/PRD_ROBOT_ATTRIBUTES.md`.
- Leagues and matchmaking: `docs/game-systems/PRD_LEAGUE_SYSTEM.md`, `docs/game-systems/PRD_MATCHMAKING.md`.
- Economy, facilities, fame, prestige, and tournaments: the corresponding PRDs under `docs/game-systems/` and `docs/prd_pages/`.
- Player-facing mechanics changes must also follow `guide-content-maintenance.md` and update the affected article.
