---
inclusion: always
---

# Armoured Souls Project Overview

## Project Type
Browser-based robot combat strategy game with turn-based mechanics, league systems, and economic simulation.

## Technology Stack

### Backend
- **Runtime**: Node.js 24 LTS
- **Language**: TypeScript 5.8 (strict mode)
- **Framework**: Express 5
- **ORM**: Prisma 7 (PostgreSQL)
- **Authentication**: JWT with bcrypt password hashing
- **Process Manager**: PM2 (production)
- **Testing**: Jest 30 with property-based testing (fast-check)

### Frontend
- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite 6
- **Styling**: Tailwind CSS 4
- **Testing**: Vitest 4 with property-based testing (fast-check)
- **State Management**: Zustand + React Context + hooks
- **HTTP Client**: Fetch API / Axios

### Database
- **DBMS**: PostgreSQL 17
- **Containerization**: Docker Compose
- **Migrations**: Prisma Migrate
- **Connection Pooling**: Prisma connection limits

### Infrastructure
- **Reverse Proxy**: Caddy (automatic HTTPS)
- **Hosting**: Scaleway DEV1-S VPS (2 vCPU, 2GB RAM)
- **CI/CD**: GitHub Actions
- **Firewall**: UFW (Ubuntu)
- **Backups**: Automated daily PostgreSQL dumps

## Project Structure
- `/app/backend` - Main backend application (services organized into 18 domain subdirectories under src/services/)
- `/app/frontend` - React frontend application
- `/app/shared` - Shared TypeScript modules imported by both frontend and backend (game formulas, discount calculations)
- `/docs` - Comprehensive documentation organized by category (includes modular architecture migration plan in `docs/guides/`)

## Key Systems
1. **Combat System** - Turn-based robot battles with weapons, armor, and damage calculations
2. **League System** - Competitive ranking with promotions/relegations
3. **Economy** - Credits, facilities, investments, weapon shop. The two passive income facilities sit on deliberately different axes: **Merchandising Hub** scales with prestige *per robot slot* (`prestige ÷ Roster_Capacity`, where capacity is `roster_expansion` level + 1), rewarding concentrated rosters; **Streaming Studio** scales per robot per battle via fame, rewarding breadth. Raw stable prestige accrues once per winning robot and so grows with roster size, which is why merchandising normalises by capacity (Spec #46). Repair costs — the Repair_Quote, the Repair Bay discount `min(90, repairBayLevel × (5 + activeRobotCount)) / 100` and the 50% Manual_Repair_Discount — are declared once in the Shared_Repair_Module `app/shared/utils/repairCost.ts` and imported by both Frontend and Backend; repair *spend* is read only from Repair_Spend_Source (`audit_logs` rows with `eventType: 'robot_repair'`), never from a `battle_complete` payload, the cached quote column or `financial_ledger` (Spec #48)
4. **Cycle System** - Automated daily game cycles
5. **Fame & Prestige** - Player progression 
6. **Tournament System** - Competitive events
7. **Changelog System** - In-game "What's New" feed with admin-authored entries (draft/publish workflow) and player notification modal. Entries are written by hand only — there is no automatic generation from deploys, commits, or season rollovers
8. **Tuning Pool System** - Per-robot tactical attribute tuning with facility-gated pool size (Spec #25)
9. **Achievement System** - 77-achievement progression layer with badges, progress tracking, rarity, pinned showcase, and toast notifications (Spec #27)
10. **Admin Portal** - Dedicated admin experience with sidebar navigation, 18 route-based lazy-loaded pages, Zustand shared state (useAdminStore), AdminRoute guard, 6 analytics dashboards, shared UI component library, and server-side audit trail (Spec #28)
11. **Monitoring & Alerting** - Discord webhook alerts for disk/startup/backup/deploy failures, daily health report, UptimeRobot external probes, Scaleway Cockpit metrics (Spec #29)
12. **League History Tracking** - Persistent tier change tracking for robots and teams (entityType `'tag_team'` references TeamBattle.id for 2v2 tag team history), admin analytics dashboard with yo-yo detection, player-facing timeline visualizations, achievement data support (Spec #32)
13. **Booking Office / Event Subscription System** - Per-robot subscription model gating participation in all battle events (league_1v1, tournament_1v1, tag_team, koth, league_2v2, league_3v3, tournament_2v2, tournament_3v3, grand_melee) through a single extensible Event Registry, with facility-level-driven cap curve (3 base + 1 per level). **One rule for all nine events**: subscribing is free under the cap, unsubscribing is free, immediate and always allowed, and a match already on the schedule still runs while keeping its slot occupied until fought — so slot accounting is `subscriptions ∪ outstanding obligations`. The nine per-event locking predicates and `EVENT_SUBSCRIPTION_LOCKED` were removed; the shared "does this robot owe a match?" question lives in `services/scheduling/eventScheduleScope`, the same module pre-battle repair scoping uses. All writes funnel through `applySubscriptionChange`, exposed as both single toggles and a bulk `PUT /api/subscriptions/robot/:robotId` (Spec #35). **A subscription always returns something**: when the schedule cannot give a subscribed robot a real opponent it receives a Bye_Event instead, in all nine modes — the odd-entity walkover, the thin `koth`/`grand_melee` tier instance below `MIN_GROUP_SIZE`, and the non-power-of-two tournament bracket. A bye pays the participation floor of its mode at that mode's own scale (`getParticipationReward(tier) × teamSize`, or the round's loss reward in tournaments) and nothing else — no prestige, no fame, no streaming revenue. Nothing is simulated, so a bye can never damage a robot, never produce a repair bill and never draw. Declared once in `app/backend/src/utils/byeRewards.ts` and written once by `services/battle/byeResolutionService.ts`, with six call sites that hold no bye logic. Auto-repair covers a byed robot in every mode, and a bye holds its slot through the same `services/scheduling/eventScheduleScope` question with no bye-specific branch (Spec #49)
14. **Daily Cron Schedule** - 11-slot daily schedule with heavy-mode spacing (1v1 League 08:00, 2v2 League 09:00, 3v3 League 14:00, KotH 13:00, Grand Melee 17:00), team2v2Tournament at 15:00 UTC, team3v3Tournament at 18:00 UTC, and midnight settlement. All events run daily; subscriptions gate participation. All league modes use a unified matchmaking pipeline (LP-primary scoring, tier/instance scoping from Standing records, shared recent-opponent tracking from `scheduled_matches_v2`, `checkSchedulingReadiness` weapon validation, `defaultScheduledFor` 24h+rounded). Canonical slot map in `docs/architecture/PRD_SERVICE_DIRECTORY.md` § Cron Schedule (Specs #36, #41, #44)
15. **Team Battle Mode (2v2 and 3v3 League + Tag Team)** - Persistent Teams with multiple combat modes. 2v2 teams participate in both simultaneous 2v2 League combat and sequential Tag Team combat (1v1 with tag-out mechanics, Active/Reserve slot roles, separate `tagTeamLp` track and tag team league tiers). 3v3 teams participate in simultaneous 3v3 League combat. All modes share the `TeamBattle` model with per-mode LP and stats isolation (`teamLp`/`totalLeagueWins` for league, `tagTeamLp`/`totalTagTeamWins` for tag team). Tag team is a combat mode on 2v2 TeamBattle, not a separate entity. Team Coordination ally effects (focus fire, shield regen, formation defence), shared LP-primary matchmaking, N× reward multiplier, daily cadence (2v2 at 09:00, 3v3 at 14:00 UTC), subscription-gated participation via Booking Office using `hasSubscription()` per mode (`league_2v2`, `tag_team`, `league_3v3`), eligibility feedback with `ineligibilityReason`/`ineligibilityDetail` shown on Dashboard and Team Management page (Specs #37, Tag Team System Unification)
16. **Team Battle Tournaments (2v2 and 3v3)** - Single-elimination bracketed tournaments for persistent teams, entity-agnostic tournament schema with participantType discriminator, Team Battle Engine combat with coordination effects, daily round cadence (2v2 at 15:00 UTC, 3v3 at 18:00 UTC), subscription-gated via tournament_2v2/tournament_3v3 events, per-type championship title tracking, stepped prestige curve with championship bonus (Spec #38)
17. **Battle Summary & Retention** - Pre-computed `battle_summaries` table written at battle creation (per-robot stats, damage flows, positions, KotH placements, survival data). `battle_log` column is ephemeral — NULLed after 7 days by nightly retention cron at 01:30 UTC. Overview tab reads from summary permanently; Playback tab only available for recent battles. `battles.winning_side` column stores team battle winner for fast aggregate queries (Spec #39)
18. **Grand Melee Mode** - 20-robot free-for-all elimination at 17:00 UTC daily, F1-style placement scoring (25/18/15/12/10/8/6/4/2/1), subscription-gated via Booking Office, full league system with tier promotion/demotion (Spec #44)
19. **Season System** - 100-cycle competitive seasons separated by 2-cycle preparation windows. At each Season_Rollover everything is archived then deleted: robots, weapons, refinements, facilities, attributes, tuning, credits, teams, subscriptions, standings, fame, prestige, achievements, championship titles, and all battle/analytics history. Only accounts, profile and onboarding settings, uploaded robot images, and the four archive tables survive. Prestige and achievements deliberately reset (superseding backlog #41) because prestige gates facility levels. Generated_Stables (auto-generated bots and seeded `test_user_*` stables, flagged by `users.is_generated`) are deleted rather than reset, but their league positions and records survive as denormalized text in `season_standing_snapshots` and `season_accolades`. Season 0 is the legacy pre-system timeline, has no fixed length, and closes only by admin manual rollover. Competitive cycle 1 is a scheduling-only cycle; first battles run on cycle 2. Balance changes are applied during preparation by convention, with no enforcement mechanism (Spec #45)
20. **Guided Robot Setup** - 7-step client-side wizard (`/robots/:id/setup`) triggered after robot creation (non-onboarding path only). Steps: Portrait → Weapon Equip → Battle Config (stance + yield) → Tuning Allocation → Team Assignment → Event Subscriptions → Attribute Upgrades. Each step commits immediately via existing endpoints. A `RobotEligibilityChecklist` on the Robot Detail Page surfaces unmet scheduling gates (weapon + subscription = hard gates; tuning = soft gate). Backend `computeSchedulingEligibility()` derives eligibility from existing data — no new tables. Wizard state lives in localStorage only (Spec #47)
21. **Dashboard** - The player landing page: `app/frontend/src/pages/DashboardPage.tsx` composing the notification stack (`utils/dashboardNotifications.ts`), the Overview_Row (`components/dashboard/` — `OverviewRow`, `PrestigeTile`, `TodaysBattlesTile`, `CreditsTile` and the shared `DashboardTile`) and Recent Battles, all fed by one hook, `hooks/useDashboardData.ts`. Every changing figure is stated on the **Current_Cycle** basis (most recent midnight UTC settlement boundary up to now) with the **Last_Completed_Cycle** as its comparison — never a rolling 24 hours and never "since last login". Served by `GET /api/dashboard/current-cycle` (`services/dashboard/cycleProgressService.ts`), a read-only aggregate covering all nine daily Battle_Slots (Spec #48)

## Documentation Organization
- `docs/architecture/` - System architecture, schema, combat engine, security
- `docs/game-systems/` - Game design and system specifications
- `docs/prd_pages/` - Page-specific requirements
- `docs/guides/` - Setup, deployment, maintenance guides
- `docs/analysis/` - Feature analysis and planning
- `docs/balance_changes/` - Game balance modifications
- `docs/design_ux/` - Design system and brand guidelines
- `docs/implementation_notes/` - Technical implementation details

## Development Principles
- Modular architecture for maintainability
- Comprehensive documentation for all features
- Security-first approach (see docs/architecture/PRD_SECURITY.md)
- Database-driven game state management
- RESTful API design
- **Unified post-battle robot updates**: All battle orchestrators (1v1 league, 1v1 tournament, 2v2/3v3 league, team tournament, tag team, KotH) call `updateRobotCombatStats()` from `src/services/battle/battlePostCombat.ts` to persist combat stats. No inline `prisma.robot.update` for HP/ELO/counters — see `docs/architecture/PRD_BATTLE_DATA_ARCHITECTURE.md` § Post-Battle Robot State Update
