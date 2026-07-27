# Requirements Document

## Spec: Season System — 100-Cycle Competitive Seasons with Full Reset

## Glossary

- **Season**: A bounded competitive period consisting of a Preparation_Phase followed by a Competitive_Phase of Season_Length_Cycles cycles, identified by a monotonically increasing Season_Number.
- **Season_Number**: The integer identifier of a season. Season_Zero carries 0, the first full season carries 1, and the value increments by 1 at each Season_Rollover.
- **Competitive_Phase**: The portion of a season during which the Settlement_Job and all Battle_Event_Jobs execute normally. Length is Season_Length_Cycles (default 100).
- **Preparation_Phase**: The portion of a season that precedes the Competitive_Phase, during which no Battle_Event_Job executes and the Settlement_Job performs only phase advancement. Length is Preparation_Length_Cycles (default 2).
- **Season_Phase**: The current phase of the current season, one of `preparation` or `competitive`.
- **Season_Cycle**: The 1-based index of the current day within the Competitive_Phase, equal to `competitiveCyclesCompleted + 1`.
- **Season_Service**: The backend service that owns the `seasons` table, exposes the current Season_Phase and Season_Cycle, advances phases, and decides whether a scheduled job may execute.
- **Season_Rollover**: The operation that ends a Competitive_Phase by writing the Season_Archive, purging season-scoped data, resetting player state, and creating the next Season in the Preparation_Phase.
- **Season_Rollover_Service**: The backend service that executes Season_Rollover.
- **Season_Archive**: The permanent, denormalized historical record of a completed season, comprising one Stable_Season_Archive per user, its Robot_Season_Archive rows, and its Season_Accolade rows.
- **Season_Archive_Service**: The backend service that writes the Season_Archive during the archive step of a Season_Rollover, invoked by the Season_Rollover_Service. Named entity-first archive rows (Stable_Season_Archive, Robot_Season_Archive) are its outputs.
- **Stable_Season_Archive**: One row per user per completed season holding stable-level final figures (credits, prestige, achievements, aggregate battle record, championship titles, facility levels).
- **Robot_Season_Archive**: One row per robot per completed season holding the robot's final identity, combat statistics, per-mode final standings, and team memberships as denormalized values.
- **Season_Accolade**: A captured Hall_of_Records placement belonging to a Stable_Season_Archive, recording category, rank, subject name, and value (for example "3rd most kills in 1v1 League").
- **Cycle_Scheduler**: The existing production scheduler (`cycleScheduler.ts`) that fires 10 cron jobs daily plus settlement at 00:00 UTC.
- **Settlement_Job**: The 00:00 UTC scheduler job that currently processes passive income, operating costs, cycle counters, snapshots, user generation, and cache refreshes.
- **Battle_Event_Job**: Any of the 10 Cycle_Scheduler jobs that schedule or execute battles: `league`, `tournament`, `tagTeam`, `koth`, `team2v2League`, `team3v3League`, `team2v2Tournament`, `team3v3Tournament`, `grandMelee`.
- **Infrastructure_Job**: A scheduled job unrelated to game progression: the daily health report (00:30 UTC), battle log retention (01:30 UTC), and the system database backup (02:00 UTC).
- **Global_Cycle_Counter**: The `cycle_metadata.total_cycles` value used as `cycleNumber` by audit logs, cycle snapshots, financial ledger rows, and league history rows.
- **Standing**: A row in the `standings` table, the single source of truth for competitive ranking data per entity per mode (Spec #40).
- **Instance_Rank**: A Standing's 1-based position when all Standings sharing the same `mode`, `tier`, and `leagueInstanceId` are ordered by `leaguePoints` descending, then `wins` descending, then `entityId` ascending.
- **Booking_Office**: The facility whose level determines how many concurrent event subscriptions each robot may hold (Spec #35).
- **Hall_of_Records**: The records surface backed by `recordsQueryService`, covering combat, upset, career, economic, prestige, KotH, team battle, Grand Melee, and tournament champion records.
- **Leaderboard_Cache**: The `leaderboard_cache` table refreshed each settlement (Spec #40).
- **Starting_Credits**: The credit balance granted to every user at the start of a Competitive_Phase, equal to ₡3,000,000 (the existing `users.currency` default).
- **Season_Summary_Modal**: The frontend modal shown once to a returning player after a Season_Rollover, summarising the player's archived season.
- **Season_Countdown_Banner**: The frontend banner shown during the final Countdown_Cycles cycles of a Competitive_Phase announcing the upcoming reset.
- **Season_Progress_Indicator**: The persistent frontend element that states the current Season_Number and the position of the current cycle within the season, for example `Season 3 · Cycle 42 / 100`.
- **Rollover_Preview**: A read-only computation that reports the counts of rows a Season_Rollover would archive and purge, without modifying data.
- **Season_API**: The backend route module exposing season state and Season_Archive data to the frontend.
- **Generated_Stable**: A user account created by the system rather than by a human registration. Two sources exist: the auto user generation of Settlement_Job step 7 (`generateBattleReadyUsers`, usernames prefixed `auto_wimpbot`, `auto_averagebot`, `auto_expertbot`) and the seed script's test stables (`seed.ts`, usernames prefixed `test_user_`). Both are competitive filler with no player behind them.
- **Human_Stable**: A user account belonging to a person. Comprises accounts created by registration through the Onboarding_Service and the seeded `admin` account.
- **Season_Standing_Snapshot**: A bounded, season-level record of the final competitive positions of a completed season, stored as denormalized text and including Generated_Stable entries, so that a season's leagues and records remain accurate after Generated_Stables are deleted.
- **Image_Library**: The per-user collection of custom robot images a player has uploaded, stored at `uploads/user-robots/{userId}/` and surviving Season_Rollover so that a player can re-apply their own artwork to a new season's robots and so that archived seasons keep rendering the robots they describe. Scoped strictly to the owning user; a player never sees or selects another player's uploads.
- **Static_Robot_Asset**: A shipped image under `/assets/robots/` referenced by Generated_Stable robots (for example `/assets/robots/wimpbot_512x512.webp`). Shared, build-managed, and never subject to upload retention, deletion, or orphan cleanup.
- **Retained_Images_Per_Stable**: The maximum number of custom images retained per user. Default 20. Configured by the environment variable `RETAINED_IMAGES_PER_STABLE`.
- **Account_Reset**: The existing per-user "start over" operation backed by `resetService.ts`, which deletes the user's robots, weapons, and facilities and restores Starting_Credits, rate limited to 3 requests per hour and recorded in `reset_logs`.
- **Season_Zero**: The legacy season created by the migration to represent the open-ended timeline that ran before the Season System existed. Carries `seasonNumber` 0, has no fixed length, and ends only when an administrator schedules its closure.
- **Admin_Season_Portal**: The admin portal page and its supporting endpoints for viewing season state, previewing a rollover, triggering a rollover, and adjusting phase lengths.
- **Stable_Page**: The existing player-facing stable page (`StableViewPage.tsx`) that this spec extends with the season history block.
- **Season_Archive_Page**: The new player-facing page at `/seasons` that lists every completed season and its final standings, champions, and accolades across all stables.
- **Onboarding_Service**: The existing service that grants the starting package to a newly registered user.
- **Season_Length_Cycles**: The number of competitive cycles per season. Default 100. Configured by the environment variable `SEASON_LENGTH_CYCLES`.
- **Preparation_Length_Cycles**: The number of preparation cycles per season. Default 2. Configured by the environment variable `PREPARATION_LENGTH_CYCLES`.
- **Countdown_Cycles**: The number of trailing competitive cycles during which the Season_Countdown_Banner appears. Default 7. Configured by the environment variable `COUNTDOWN_CYCLES`.
- **Accolade_Depth**: The number of top placements captured per Hall_of_Records category at rollover. Default 10. Configured by the environment variable `ACCOLADE_DEPTH`.

Naming convention used in this document: domain concepts are written in `Pascal_Snake` (Season_Rollover, Season_Length_Cycles) and always appear in the glossary. Backticked lowercase identifiers are literal code artefacts — database columns, API response fields, table names, and environment variable keys (`seasonNumber`, `standings`, `SEASON_LENGTH_CYCLES`).

## Introduction

The Season System converts Armoured Souls from an open-ended single-timeline game into a series of 100-cycle competitive seasons separated by 2-cycle preparation windows. At the end of a season everything a player built is archived and then deleted: robots, weapons, weapon refinements, facilities, attributes, tuning allocations, credits, teams, subscriptions, standings (LP, tier, ELO), fame, prestige, achievements, championship titles, and the entire battle and analytics history. Only user accounts, account-level profile settings, and the Season_Archive survive.

This is a deliberate change from the design direction recorded in backlog item #41, which had prestige and achievements persisting across seasons. This spec resets both. Prestige currently gates facility levels (Workshop L4 at 1,000 prestige, L7 at 5,000, L9 at 10,000) and drives merchandising income, so resetting prestige makes facility depth a mid-season goal that must be re-earned every season rather than a permanent veteran advantage. Achievements reset with everything else and are recorded per season in the archive, which turns the achievement collection into a per-season scorecard rather than a lifetime one.

The 2-cycle Preparation_Phase exists so that no player misses the first league or tournament day of a new season. During preparation, all 10 Battle_Event_Jobs are suspended and the Settlement_Job performs no economic processing, so the Global_Cycle_Counter does not advance. Players can buy robots, weapons, and facilities, allocate attributes and tuning, form teams, subscribe to events through the Booking_Office, and test builds in the Practice Arena. Balance changes are deployed manually into this window and announced through a changelog entry, so the new season opens on a shifted meta.

The Season_Archive is displayed as a condensed block on the Stable page, giving that page a persistent narrative: one collapsed row per past season showing the stable's final figures, expandable to reveal each robot's final standing per mode, its team memberships, and the accolades the stable earned ("owned the robot with the 3rd most kills in 1v1 League in Season 3").

## Expected Contribution

This spec addresses backlog item #41 (Season System) and the Loop 2 and Loop 3 findings of the Game Loop Audit (#6): a stagnant late-game economy and a one-dimensional competitive loop with no resets or meta shifts.

1. **Bounded competitive timeline.** Before — one continuous timeline; credits and facility levels accumulate without limit; late-game players have no meaningful credit sink. After — the season ends after 100 competitive cycles, every player restarts from Starting_Credits with an empty stable, and every economic decision is scarce again. Verifiable by: a `seasons` row exists with a phase and cycle count; after a rollover, every user has ₡3,000,000, zero robots, zero facilities, and zero standings.

2. **Permanent, queryable stable history from purged data.** Before — history lives in the operational tables (robots, battles, standings) and is lost if those rows are deleted. After — four archive tables hold denormalized per-season records that survive every purge: per-stable and per-robot archives for Human_Stables, plus a bounded Season_Standing_Snapshot and accolade set that includes Generated_Stable competitors so league positions and records stay accurate. Verifiable by: archive row counts equal pre-rollover Human_Stable and robot counts; the Stable page and Season_Archive_Page render past seasons after the operational tables are empty and the bot stables are gone.

3. **A preparation window with no scheduled combat.** Before — all 10 battle events fire every day unconditionally; a reset mid-schedule would drop players into a league day with no robots. After — during the Preparation_Phase every Battle_Event_Job returns without scheduling or executing, the Settlement_Job runs only phase advancement, and events resume on competitive cycle 1. Verifiable by: no `scheduled_matches_v2` rows and no `battles` rows are created on preparation cycles; the Global_Cycle_Counter is unchanged across the preparation window.

4. **Bounded database growth on a 2GB VPS.** Before — `audit_logs`, `financial_ledger`, `cycle_snapshots`, `battle_summaries`, and `league_history` grow without bound, and auto-generated stables accumulate at a rate of N per cycle N with no ceiling. After — all of those tables are purged at each rollover once the archive is written, Generated_Stables are deleted rather than archived, and the bot population restarts from one stable on cycle 1. Verifiable by: those tables are empty immediately after rollover; the archive tables are non-empty and contain only Human_Stable rows; `users` holds zero Generated_Stable rows immediately after rollover.

5. **Season-scoped competition surfaces.** Before — Hall_of_Records and Leaderboard_Cache aggregate over all time with no period label. After — both are inherently current-season scoped, labelled with the Season_Number, and the notable placements of each season are frozen into Season_Accolade rows before the purge. Verifiable by: records responses carry a season label; accolade rows exist for the completed season.

6. **Operable rollover.** Before — no mechanism exists to end, extend, or rehearse a global reset. After — an admin can preview a rollover, trigger it manually, and extend the current phase, with every action recorded in the admin audit log and announced to Discord. Verifiable by: preview returns counts without mutating data; a manual rollover produces an `admin_audit_logs` row.

7. **Season history readable on a phone.** Before — no season surfaces exist. After — all seven new surfaces (Season_Archive_Page, Stable_Page history block, Season_Summary_Modal, Season_Countdown_Banner, Season_Progress_Indicator, Dashboard preparation state, Admin_Season_Portal) render from 320 to 1920 pixels with no horizontal overflow and 44-pixel touch targets. Verifiable by: frontend tests assert each surface at 320, 375, and 1024 pixels with no element exceeding the viewport width.

### Verification Criteria

After all tasks are complete, run these checks to confirm the spec delivered:

1. `grep -n "model Season" app/backend/prisma/schema.prisma` — season and archive models present
2. `grep -rn "seasonService\|Season_Phase\|getCurrentSeason" app/backend/src/services/cycle/cycleScheduler.ts` — scheduler consults the Season_Service
3. `grep -rn "preparation" app/backend/src/services/season/` — preparation phase logic present
4. `npm test -- --testPathPattern="season" --silent` — all season tests pass
5. `npm test -- --testPathPattern="cycleScheduler" --silent` — scheduler tests pass with phase gating
6. `npm test -- --testPathPattern="resetService" --silent` — account reset tests pass, asserting archives survive a reset
7. `cd app/frontend && npm run build` — frontend build succeeds with season history block and modal
8. `grep -rn "season" app/frontend/src/pages/StableViewPage.tsx` — Stable page renders season history
9. `grep -rn "seasons" app/backend/src/routes/` — season API and admin endpoints registered
10. `grep -rn "Season" docs/architecture/PRD_SERVICE_DIRECTORY.md` — cron schedule documents preparation suspension
11. `grep -rn "season" .kiro/steering/project-overview.md` — steering file lists the Season System
12. `grep -rn "SeasonProgressIndicator" app/frontend/src/components/ app/frontend/src/pages/DashboardPage.tsx` — cycle progress indicator rendered in navigation and on the Dashboard
13. `ls app/backend/src/content/guide/seasons/ && grep -n "seasons" app/backend/src/content/guide/sections.json` — guide section authored and registered
14. `grep -rn "reset\|season" app/backend/src/content/guide/prestige-fame/ app/backend/src/content/guide/achievements/` — prestige and achievement articles corrected to state they reset
15. `test -f docs/game-systems/PRD_SEASON_SYSTEM.md` — core PRD exists
16. `grep -n "seasons" app/frontend/src/App.tsx app/frontend/src/components/Navigation.tsx` — Season_Archive_Page routed and linked in navigation
17. `grep -n "SEASON_LENGTH_CYCLES" docs/guides/operations/LOCAL_SETUP.md` — local fast-season instructions documented
18. `cd app/frontend && npm test -- season` — season surface tests pass, including the 320/375/1024 pixel viewport and touch target assertions of Requirement 28.12
19. `grep -n "isGenerated" app/backend/prisma/schema.prisma app/backend/src/utils/userGeneration.ts` — generated stables carry an explicit flag rather than relying on username prefixes
20. `psql ... -c "SELECT COUNT(*) FROM users WHERE is_generated = true;"` — returns 0 immediately after a rollover, and grows again from the first competitive settlement
21. `psql ... -c "SELECT COUNT(*) FROM season_standing_snapshots WHERE is_generated_subject = true;"` — bot league positions survive the deletion of the stables that held them

## Requirements

### Requirement 1: Season State Model

**User Story:** As a player, I want the game to track which season is running and how far into it we are, so that I know how much time remains before the reset.

#### Acceptance Criteria

1. THE Season_Service SHALL persist exactly one current Season record containing `seasonNumber`, `phase`, `competitiveCyclesCompleted`, `preparationCyclesCompleted`, `startedAt`, and `endedAt`
2. THE Season_Service SHALL constrain `phase` to the values `preparation` and `competitive`
3. THE Season_Service SHALL expose the current `seasonNumber`, `phase`, Season_Cycle, Season_Length_Cycles, and the count of remaining competitive cycles through a single read operation
4. WHILE the current Season_Phase is `competitive`, THE Season_Service SHALL report Season_Cycle as `competitiveCyclesCompleted + 1`
5. WHILE the current Season_Phase is `preparation`, THE Season_Service SHALL report the 1-based preparation day as `preparationCyclesCompleted + 1` and SHALL report Season_Cycle as 0
6. IF no Season record exists when the Season_Service is read, THEN THE Season_Service SHALL create Season_Zero as specified in Requirement 24.1
7. THE Season_Service SHALL keep `seasonNumber` unique across all Season records and SHALL increment `seasonNumber` by exactly 1 for each Season created by a Season_Rollover
8. THE Season_Service SHALL retain the Season records of completed seasons with `endedAt` set and `phase` set to `completed`

### Requirement 2: Season Phase Advancement at Settlement

**User Story:** As a system operator, I want season phase transitions to happen at the daily settlement boundary, so that phase changes are deterministic and aligned with the existing cycle boundary.

#### Acceptance Criteria

1. WHEN the Settlement_Job starts, THE Settlement_Job SHALL read the current Season_Phase from the Season_Service before performing any other step
2. WHILE the current Season_Phase is `competitive`, THE Settlement_Job SHALL execute all existing settlement steps and SHALL then increment `competitiveCyclesCompleted` by 1
3. WHERE the current Season_Number is 1 or greater, WHEN `competitiveCyclesCompleted` reaches Season_Length_Cycles during a settlement, THE Settlement_Job SHALL invoke Season_Rollover after all existing settlement steps have completed
4. WHILE the current Season_Phase is `preparation`, THE Settlement_Job SHALL skip passive income, operating costs, end-of-cycle balance logging, Global_Cycle_Counter increment, `cyclesInTier` increment, analytics snapshot creation, practice arena stat flushing, user auto-generation, achievement rarity refresh, and leaderboard refresh, and SHALL increment `preparationCyclesCompleted` by 1
5. WHEN `preparationCyclesCompleted` reaches Preparation_Length_Cycles during a settlement, THE Season_Service SHALL set the current Season_Phase to `competitive`, set `competitiveCyclesCompleted` to 0, and set `startedAt` to the current time
6. WHILE the current Season_Phase is `preparation`, THE Settlement_Job SHALL leave the Global_Cycle_Counter unchanged
7. WHEN the Settlement_Job completes during a `preparation` phase, THE Settlement_Job SHALL log the preparation day index and the number of preparation cycles remaining


### Requirement 3: Battle Event Suspension During Preparation

**User Story:** As a player rebuilding a stable, I want no matches or tournaments scheduled during the preparation window, so that I do not forfeit battles or miss the first competitive day.

#### Acceptance Criteria

1. WHILE the current Season_Phase is `preparation`, THE Cycle_Scheduler SHALL return from every Battle_Event_Job without running repairs, matchmaking, league rebalancing, battle execution, tournament round advancement, or tournament auto-creation
2. WHEN a Battle_Event_Job is skipped because the current Season_Phase is `preparation`, THE Cycle_Scheduler SHALL record the job as a successful run with a reason of `season_preparation` and SHALL log the job name and the current preparation day
3. WHILE the current Season_Phase is `preparation`, THE Cycle_Scheduler SHALL create no `scheduled_matches_v2` rows, no `battles` rows, and no `tournaments` rows
4. WHILE the current Season_Phase is `preparation`, THE Cycle_Scheduler SHALL continue to execute every Infrastructure_Job
5. WHEN the current Season_Phase changes from `preparation` to `competitive`, THE Cycle_Scheduler SHALL execute every Battle_Event_Job normally at its configured time on that same cycle
6. WHEN an administrator manually triggers a Battle_Event_Job while the current Season_Phase is `preparation`, THE Cycle_Scheduler SHALL decline the trigger and SHALL return a message identifying the preparation window as the reason
7. WHEN a Battle_Event_Job runs on competitive cycle 1, THE Battle_Event_Job SHALL find no matches due for execution and SHALL schedule matches for competitive cycle 2, so that competitive cycle 1 is a scheduling cycle and every cycle from 2 onward both executes and schedules
8. THE Dashboard SHALL state on competitive cycle 1 that matches have been scheduled and that the first battles run on the next cycle
9. THE `seasons` guide section SHALL state that the first battles of a season run on competitive cycle 2 because every Battle_Event_Job executes previously scheduled matches before scheduling new ones

### Requirement 4: Preparation Phase Player Capabilities

**User Story:** As a player, I want the preparation window to be a full building window, so that I can construct a new stable and experiment with the new meta before competition starts.

#### Acceptance Criteria

1. WHILE the current Season_Phase is `preparation`, THE Season_Service SHALL permit robot creation, weapon purchase, weapon refinement, weapon resale, facility purchase and upgrade, attribute upgrades, tuning allocation, loadout and stance changes, team creation and membership changes, and event subscription changes
2. WHILE the current Season_Phase is `preparation`, THE Season_Service SHALL permit Practice Arena battles
3. WHEN a player subscribes a robot to an event during the Preparation_Phase, THE Booking_Office SHALL persist the subscription so that the robot is eligible for matchmaking on the first competitive cycle
4. WHILE the current Season_Phase is `preparation`, THE Dashboard SHALL display the preparation day index, the number of preparation cycles remaining, and a statement that no competitive battles are scheduled
5. WHILE the current Season_Phase is `preparation`, THE Dashboard SHALL omit upcoming battle listings rather than displaying an empty error state
6. WHILE the current Season_Phase is `preparation`, THE Account_Reset SHALL be permitted, so that a player who mis-spends the opening credits can start the season over
7. WHEN an Account_Reset executes, THE Account_Reset SHALL delete only current-season state — robots, weapon inventory, weapon refinements, facilities, tuning allocations, subscriptions, team memberships, and the user's Standing rows — SHALL restore Starting_Credits, and SHALL retain the user's Image_Library per Requirement 30.19
8. WHEN an Account_Reset executes, THE Account_Reset SHALL leave every Stable_Season_Archive, Robot_Season_Archive, and Season_Accolade row of every completed season unchanged
9. WHEN an Account_Reset executes, THE Stable_Page season history block SHALL continue to display every completed season of that stable
10. WHEN an Account_Reset executes, THE Account_Reset SHALL reset the user's `prestige`, `championshipTitles`, the per-type championship counters, `pinnedAchievements`, `totalPracticeBattles`, and `user_achievements` rows to the same values a Season_Rollover sets in Requirements 9.2 and 9.3, so that a reset cannot preserve a competitive advantage earned earlier in the same season
11. WHEN an Account_Reset executes, THE Account_Reset SHALL leave the user's last seen Season_Number unchanged, so that dismissing the Season_Summary_Modal is not undone
12. WHILE the current Season_Phase is `preparation`, THE Account_Reset eligibility check SHALL report no scheduled-match, tournament, or pending-battle blocker, because no such rows exist during preparation
13. WHERE an Account_Reset would delete a robot that already holds a `scheduled_matches_v2` row created on competitive cycle 1 or later, THE Account_Reset SHALL be declined with the existing scheduled-match blocker
14. THE Account_Reset SHALL continue to record a `reset_logs` row, and THE Season_Rollover SHALL preserve `reset_logs` per Requirement 11.3

### Requirement 5: Season Rollover Ordering and Atomicity

**User Story:** As a player, I want my season to be archived before anything is deleted, so that a failed rollover can never destroy my history.

#### Acceptance Criteria

1. WHEN Season_Rollover executes, THE Season_Rollover_Service SHALL write the complete Season_Archive for the completing season before deleting or resetting any data
2. WHEN the archive step completes, THE Season_Rollover_Service SHALL verify that one Stable_Season_Archive row exists for every Human_Stable and that the total Robot_Season_Archive row count equals the pre-rollover count of robots owned by Human_Stables
3. IF the archive verification of Requirement 5.2 fails, THEN THE Season_Rollover_Service SHALL abort the rollover, leave all operational data unchanged, leave the current Season_Phase set to `competitive`, and report a failure
4. WHEN archive verification succeeds, THE Season_Rollover_Service SHALL execute the purge and reset steps of Requirements 9 and 10, and SHALL then create the next Season record with `phase` set to `preparation` and `preparationCyclesCompleted` set to 0
5. THE Season_Rollover_Service SHALL be idempotent per season: WHEN Season_Rollover is invoked for a Season_Number that already has a complete Season_Archive, THE Season_Rollover_Service SHALL skip the archive step and proceed to the purge and reset steps
6. WHEN Season_Rollover executes the purge and reset steps, THE Season_Rollover_Service SHALL process users in batches inside database transactions so that no user is left with a partially reset stable
7. WHEN Season_Rollover completes, THE Season_Rollover_Service SHALL record an entry containing the completed Season_Number, the counts of archived stables and robots, and the counts of purged rows per table

### Requirement 6: Stable Season Archive Contents

**User Story:** As a player, I want a permanent record of what my stable achieved each season, so that my history is visible after the reset.

#### Acceptance Criteria

1. THE Season_Archive_Service SHALL write one Stable_Season_Archive row per Human_Stable per completed season, uniquely keyed by `seasonNumber` and `userId`, and SHALL write none for a Generated_Stable per Requirement 29.4
2. THE Stable_Season_Archive SHALL store the user's final credit balance, prestige earned during the season, and the stable name in use at the end of the season
3. THE Stable_Season_Archive SHALL store the aggregate battle record across the user's robots: total battles, wins, losses, draws, and win rate
4. THE Stable_Season_Archive SHALL store the highest ELO reached by any of the user's robots and the total fame held by the user's robots at the end of the season
5. THE Stable_Season_Archive SHALL store the total championship titles and the per-type championship titles for 1v1, 2v2, and 3v3 tournaments
6. THE Stable_Season_Archive SHALL store the count of achievements unlocked, the count of achievements available, and the list of unlocked achievement identifiers
7. THE Stable_Season_Archive SHALL store the facility type and level of every facility owned at the end of the season
8. THE Stable_Season_Archive SHALL store the robot count and the team count held at the end of the season
9. THE Season_Archive_Service SHALL store every value in the Stable_Season_Archive as a denormalized copy that holds no foreign key to any purged row, with `userId` as the single exception

### Requirement 7: Robot Season Archive Contents

**User Story:** As a player, I want to see the robots I fielded each season and where each finished, so that past seasons read as a record of specific machines rather than a single total.

#### Acceptance Criteria

1. THE Season_Archive_Service SHALL write one Robot_Season_Archive row per robot per completed season, linked to the owning Stable_Season_Archive
2. THE Robot_Season_Archive SHALL store the robot's name, image path, frame identifier, and paint job as text values
3. THE Robot_Season_Archive SHALL store the robot's final ELO, fame, wins, losses, draws, total battles, lifetime damage dealt, lifetime damage taken, and kills
4. THE Robot_Season_Archive SHALL store, for every Standing whose `entityType` is `robot` and whose `entityId` matches the robot, the `mode`, `tier`, `leagueInstanceId`, `leaguePoints`, `wins`, `losses`, `draws`, `bestWinStreak`, and Instance_Rank
5. THE Robot_Season_Archive SHALL store, for every team the robot belonged to at the end of the season, the team name, team size, and for each team mode the `tier`, `leagueInstanceId`, `leaguePoints`, and Instance_Rank of the team's Standing
6. THE Season_Archive_Service SHALL compute Instance_Rank by ordering all Standings that share the same `mode`, `tier`, and `leagueInstanceId` by `leaguePoints` descending, then `wins` descending, then `entityId` ascending, counting Generated_Stable entities in that ordering so that an archived rank states the robot's true league position rather than its position among Human_Stable robots
7. THE Robot_Season_Archive SHALL store the robot's final loadout as the names of the equipped main weapon and offhand weapon at the end of the season
8. WHERE a robot held no Standing in a given mode, THE Season_Archive_Service SHALL omit that mode from the archived standings rather than storing a zero-valued entry

### Requirement 8: Season Accolade Capture

**User Story:** As a player, I want notable placements from the season frozen into my history, so that I can point at what my stable was known for.

#### Acceptance Criteria

1. WHEN Season_Rollover executes the archive step, THE Season_Archive_Service SHALL read the Hall_of_Records for the completing season and SHALL capture the top Accolade_Depth placements of every records category
2. THE Season_Accolade SHALL store the category identifier, the 1-based rank, the subject type, the subject name, the owning stable name, the numeric value, the value label, the competitive mode where the category is mode-specific, and a flag marking whether the subject belonged to a Generated_Stable
3. THE Season_Archive_Service SHALL capture placements held by Generated_Stables as well as Human_Stables, so that the recorded rank of a Human_Stable placement is its true rank within the season rather than its rank among Human_Stables only
4. THE Season_Accolade SHALL belong to the completed season and SHALL carry a nullable `userId` that is set only where the subject was owned by a Human_Stable at the end of the season
5. THE Stable_Page season history block SHALL display only the Season_Accolade rows whose `userId` matches the stable being viewed
6. THE Season_Archive_Page SHALL display every Season_Accolade row of a season, labelling Generated_Stable subjects as system-generated competitors
7. THE Season_Archive_Service SHALL capture accolades from the combat, upset, career, economic, prestige, KotH, team battle, Grand Melee, and tournament champion record categories
8. IF a records category returns no rows for the completing season, THEN THE Season_Archive_Service SHALL record no accolades for that category and SHALL continue capturing the remaining categories
9. IF the accolade capture of a single category fails, THEN THE Season_Archive_Service SHALL log the category and the failure and SHALL continue the archive step, and the archive verification of Requirement 5.2 SHALL remain unaffected
10. WHEN Season_Rollover executes the archive step, THE Season_Archive_Service SHALL write a Season_Standing_Snapshot capturing, for every competitive mode and every tier and league instance present in the `standings` table, the top Accolade_Depth entities ordered by Instance_Rank
11. THE Season_Standing_Snapshot SHALL store per entry the mode, tier, `leagueInstanceId`, Instance_Rank, entity type, entity name, owning stable name, `leaguePoints`, wins, losses, draws, and a flag marking whether the entity belonged to a Generated_Stable
12. THE Season_Standing_Snapshot SHALL include Generated_Stable entities, so that the champion of each tier of a completed season remains identifiable after those stables are deleted
13. THE Season_Standing_Snapshot SHALL store every value as denormalized text or numbers holding no foreign key to any purged or deleted row
14. THE Season_Standing_Snapshot SHALL be bounded to Accolade_Depth entries per mode, tier, and league instance, so that its row count does not scale with the Generated_Stable population
15. THE Season_Archive_Page SHALL render the final standings per mode of Requirement 25.3 from the Season_Standing_Snapshot, labelling Generated_Stable entries as system-generated competitors

### Requirement 9: Competitive and Economic Data Reset Scope

**User Story:** As a player, I want every competitive and economic advantage cleared at season end, so that each season starts from a level playing field.

#### Acceptance Criteria

1. WHEN Season_Rollover executes the reset step, THE Season_Rollover_Service SHALL delete every row of `robots`, `battle_participants`, `tuning_allocations`, `subscriptions`, `weapon_inventory`, `weapon_refinement`, `facilities`, `team_battles`, `team_battle_members`, `standings`, `scheduled_matches_v2`, `scheduled_match_participants`, `tournaments`, and `tournament_matches`
2. WHEN Season_Rollover executes the reset step, THE Season_Rollover_Service SHALL delete every row of `user_achievements`
3. WHEN Season_Rollover executes the reset step, THE Season_Rollover_Service SHALL set every Human_Stable's `currency` to Starting_Credits, `prestige` to 0, `championshipTitles` to 0, `championshipTitles1v1` to 0, `championshipTitles2v2` to 0, `championshipTitles3v3` to 0, `pinnedAchievements` to an empty list, and `totalPracticeBattles` to 0
4. WHEN Season_Rollover sets a user's `currency` to Starting_Credits, THE Season_Rollover_Service SHALL apply Starting_Credits regardless of whether the pre-rollover balance was positive, zero, or negative
5. WHEN Season_Rollover deletes robots that hold custom uploaded images, THE Season_Rollover_Service SHALL retain the image files as specified in Requirement 30
6. WHEN Season_Rollover completes, THE Season_Rollover_Service SHALL leave zero rows in every table listed in Requirements 9.1 and 9.2
7. THE Season_Rollover_Service SHALL release archived robot names for reuse, and THE Robot_Season_Archive SHALL retain each archived robot name as text so that a later robot with the same name creates no conflict with the archive

### Requirement 10: History and Analytics Purge Scope

**User Story:** As a system operator, I want per-cycle history purged at rollover, so that database size stays bounded to a single season on the production VPS.

#### Acceptance Criteria

1. WHEN Season_Rollover executes the purge step after archive verification succeeds, THE Season_Rollover_Service SHALL delete every row of `battles`, `battle_summaries`, `audit_logs`, `cycle_snapshots`, `financial_ledger`, `league_history`, `leaderboard_cache`, and `practice_arena_daily_stats`
2. WHEN Season_Rollover completes the purge step, THE Season_Rollover_Service SHALL reset the Global_Cycle_Counter to 0 and SHALL set `lastCycleAt` to the rollover time
3. WHEN the first competitive settlement of a new season completes, THE Leaderboard_Cache SHALL contain entries computed exclusively from that season's data
4. THE Season_Rollover_Service SHALL execute the purge step only after the archive verification of Requirement 5.2 has succeeded
5. WHEN Season_Rollover completes the purge step, THE Season_Rollover_Service SHALL run a database space reclamation step on the purged tables and SHALL log the reclamation outcome
6. IF the space reclamation step of Requirement 10.5 fails, THEN THE Season_Rollover_Service SHALL log the failure and SHALL report the rollover as successful

### Requirement 11: Preserved Data

**User Story:** As a returning player, I want my account and settings intact after a reset, so that I can log in and start building immediately.

#### Acceptance Criteria

1. WHEN Season_Rollover completes, THE Season_Rollover_Service SHALL leave every Human_Stable `users` row present with `id`, `username`, `email`, `passwordHash`, `role`, `stableName`, `profileVisibility`, `notificationsBattle`, `notificationsLeague`, `themePreference`, `tokenVersion`, `lastSeenChangelog`, `lastLoginAt`, and `createdAt` unchanged, and SHALL delete Generated_Stable rows per Requirement 29.3
2. WHEN Season_Rollover completes, THE Season_Rollover_Service SHALL leave `hasCompletedOnboarding`, `onboardingSkipped`, `onboardingStep`, `onboardingStrategy`, `onboardingChoices`, `onboardingStartedAt`, and `onboardingCompletedAt` unchanged so that returning players do not repeat onboarding
3. WHEN Season_Rollover completes, THE Season_Rollover_Service SHALL leave every row of `weapons`, `changelog_entries`, `admin_audit_logs`, `reset_logs`, `seasons`, and the three Season_Archive tables unchanged
4. WHEN Season_Rollover completes, THE Season_Rollover_Service SHALL leave the Season_Archive rows of all previously completed seasons unchanged

### Requirement 12: New Season Initialization

**User Story:** As a returning player, I want a clean slate with starting credits at the beginning of a season, so that I can choose a completely new strategy.

#### Acceptance Criteria

1. WHEN a new Season enters the Preparation_Phase, THE Season_Service SHALL leave every user with Starting_Credits, zero robots, zero weapons, zero facilities, zero teams, zero subscriptions, and zero standings
2. THE Season_Service SHALL grant no robots, weapons, or facilities automatically to returning players
3. WHEN a user registers while the current Season_Phase is `preparation` or `competitive`, THE Onboarding_Service SHALL grant the same starting package it grants today and SHALL apply no season-elapsed compensation
4. WHILE the current Season_Phase is `competitive`, THE Season_Service SHALL apply the same Starting_Credits and the same starting package to users who register mid-season as to users who register on the first competitive cycle
5. WHEN a user holds zero robots at the start of a Competitive_Phase, THE Booking_Office SHALL report zero active subscriptions for that user

### Requirement 13: Season-Scoped Records and Leaderboards

**User Story:** As a player, I want records and leaderboards to reflect the current season, so that rankings are achievable within the season I am playing.

#### Acceptance Criteria

1. THE Hall_of_Records SHALL compute every record category exclusively from data created during the current season
2. THE Hall_of_Records SHALL include the current `seasonNumber` in every records response and THE frontend SHALL label the records surface with that Season_Number
3. THE Leaderboard_Cache SHALL contain entries computed exclusively from data created during the current season
4. WHILE the current Season_Phase is `preparation`, THE Hall_of_Records SHALL report every category as empty and THE frontend SHALL display a message stating that the new season has not started
5. THE Hall_of_Records SHALL expose the Season_Accolade rows of completed seasons through the Season_Archive rather than through the current-season record categories

### Requirement 14: Stable Page Season History Block

**User Story:** As a player, I want my season history condensed on my Stable page, so that the page tells the story of my stable across seasons.

#### Acceptance Criteria

1. THE Stable_Page SHALL display a season history block containing one row per completed season for the stable, ordered by `seasonNumber` descending
2. THE Stable_Page SHALL display in each collapsed season row the Season_Number, the final credit balance, the prestige earned, the aggregate win-loss-draw record, the win rate, the best tier reached with its mode, the championship title count, and the achievement count
3. WHEN a player expands a season row, THE Stable_Page SHALL display every Robot_Season_Archive of that season with the robot name, image, final ELO, fame, win-loss-draw record, and the final tier, league instance, league points, and Instance_Rank per mode
4. WHEN a player expands a season row, THE Stable_Page SHALL display the team names, team sizes, and final team standings archived for that season
5. WHEN a player expands a season row, THE Stable_Page SHALL display the Season_Accolade entries of that season as a labelled list stating the rank, the category, and the subject name
6. WHERE a stable has no completed seasons, THE Stable_Page SHALL display a message stating that the stable's first season is in progress
7. THE Stable_Page SHALL render the season history block at viewport widths of 320 pixels and above without horizontal scrolling, per Requirement 28
8. THE Stable_Page SHALL load the collapsed season history rows in the initial stable request and SHALL load the expanded per-robot detail of a season on demand

### Requirement 15: Season Summary Modal

**User Story:** As a returning player, I want a summary of my archived season when I log in after a rollover, so that the reset is acknowledged rather than silent.

#### Acceptance Criteria

1. THE Season_Service SHALL persist per user the highest Season_Number whose summary the user has seen
2. WHEN a user loads the application and a completed Stable_Season_Archive exists with a Season_Number greater than the user's last seen Season_Number, THE frontend SHALL display the Season_Summary_Modal
3. THE Season_Summary_Modal SHALL display the completed Season_Number, the final credit balance, the prestige earned, the aggregate win-loss-draw record, the best tier reached with its mode, the achievement count, and up to three Season_Accolade entries
4. THE Season_Summary_Modal SHALL display the number of preparation cycles remaining before competitive play resumes
5. WHEN a user dismisses the Season_Summary_Modal, THE Season_Service SHALL record the completed Season_Number as the user's last seen Season_Number so that the modal is displayed once per season per user
6. WHERE a user has no completed Stable_Season_Archive, THE frontend SHALL display no Season_Summary_Modal

### Requirement 16: Season Countdown and Phase Indicators

**User Story:** As a player, I want advance warning before the season ends, so that I can plan the last cycles instead of being surprised.

#### Acceptance Criteria

1. WHILE the current Season_Phase is `competitive` and the number of remaining competitive cycles is Countdown_Cycles or fewer, THE frontend SHALL display the Season_Countdown_Banner stating the Season_Number, the number of remaining competitive cycles, and that all stable contents will be archived and reset
2. THE Season_Countdown_Banner SHALL link to the Stable page season history block
3. WHEN a player dismisses the Season_Countdown_Banner, THE frontend SHALL suppress the banner for the remainder of that cycle and SHALL display the banner again on the next cycle

### Requirement 17: Season Progress Display

**User Story:** As a player, I want the current cycle number and the season length visible while I play, so that I always know how far into the season I am and how much of it is left.

#### Acceptance Criteria

1. THE frontend SHALL display the Season_Progress_Indicator on every authenticated page
2. WHILE the current Season_Phase is `competitive`, THE Season_Progress_Indicator SHALL state the current Season_Number, the Season_Cycle, and Season_Length_Cycles in the form `Season {Season_Number} · Cycle {Season_Cycle} / {Season_Length_Cycles}`
3. WHILE the current Season_Phase is `preparation`, THE Season_Progress_Indicator SHALL state the upcoming Season_Number, the preparation day index, and Preparation_Length_Cycles in the form `Season {Season_Number} · Preparation {day} / {Preparation_Length_Cycles}`
4. THE Dashboard SHALL display the current Season_Number, the Season_Cycle, Season_Length_Cycles, and the number of remaining competitive cycles
5. THE frontend SHALL derive every value in the Season_Progress_Indicator exclusively from the season state endpoint of Requirement 20.1 and SHALL hold no locally computed cycle count
6. WHERE the viewport width is below 1024 pixels, THE Season_Progress_Indicator SHALL render a condensed form stating the Season_Number and the Season_Cycle over Season_Length_Cycles without horizontal scrolling at widths of 320 pixels and above
7. IF the season state endpoint fails, THEN THE frontend SHALL omit the Season_Progress_Indicator rather than displaying placeholder or stale cycle values
8. THE Hall_of_Records SHALL label its current-season data with the Season_Number and the Season_Cycle at which the data was read

### Requirement 18: Admin Season Management

**User Story:** As an administrator, I want to preview, trigger, and adjust the season boundary, so that I can rehearse a rollover and respond to problems without waiting for the schedule.

#### Acceptance Criteria

1. THE Admin_Season_Portal SHALL display the current Season_Number, phase, cycles completed, cycles remaining, and the timestamp of the last rollover
2. WHEN an administrator requests a Rollover_Preview, THE Season_Rollover_Service SHALL report the number of stables and robots that would be archived and the number of rows that would be purged per table, and SHALL modify no data
3. WHEN an administrator triggers a manual Season_Rollover with an explicit confirmation value, THE Season_Rollover_Service SHALL execute the rollover of Requirements 5 through 11
4. IF an administrator triggers a manual Season_Rollover without the explicit confirmation value, THEN THE Season_Rollover_Service SHALL decline the request and SHALL report that confirmation is required
5. WHEN an administrator extends the current Competitive_Phase by a positive number of cycles, THE Season_Service SHALL increase the effective season length for the current season by that number of cycles and SHALL leave Season_Length_Cycles unchanged for later seasons
6. WHEN an administrator changes the remaining number of preparation cycles to a value between 0 and 7 inclusive, THE Season_Service SHALL apply that value to the current Preparation_Phase
7. WHEN an administrator performs any season management action, THE Admin_Season_Portal SHALL record an `admin_audit_logs` entry containing the administrator identifier, the action, and the resulting season state
8. THE Admin_Season_Portal SHALL restrict every season management endpoint to users holding the `admin` role

### Requirement 19: Rollover Failure Handling and Observability

**User Story:** As a system operator, I want a failed rollover to be loud and recoverable, so that a partial reset never goes unnoticed.

#### Acceptance Criteria

1. WHEN Season_Rollover starts, THE Season_Rollover_Service SHALL dispatch a notification stating the completing Season_Number and the start time
2. WHEN Season_Rollover completes, THE Season_Rollover_Service SHALL dispatch a notification stating the completing Season_Number, the archived stable and robot counts, the total purged row count, and the duration
3. IF Season_Rollover fails at any step, THEN THE Season_Rollover_Service SHALL dispatch a notification stating the failing step and the error message
4. IF Season_Rollover fails during the purge or reset step, THEN THE Season_Rollover_Service SHALL leave the Season_Phase set to `competitive` and SHALL report the rollover as incomplete so that a retry can resume from Requirement 5.5
5. WHILE a Season_Rollover is executing, THE Season_Rollover_Service SHALL prevent a second concurrent Season_Rollover from starting
6. WHEN Season_Rollover completes, THE Season_Rollover_Service SHALL log the elapsed duration of the archive step, the purge step, and the reset step separately

### Requirement 20: Season API Surface

**User Story:** As a frontend developer, I want season state and archive data available through the API, so that every surface can render consistent season information.

#### Acceptance Criteria

1. THE Season_API SHALL expose an endpoint returning the current Season_Number, phase, Season_Cycle, Season_Length_Cycles, remaining competitive cycles, preparation day index, and remaining preparation cycles
2. THE Season_API SHALL expose an endpoint returning the collapsed Stable_Season_Archive rows for a given user identifier ordered by Season_Number descending
3. THE Season_API SHALL expose an endpoint returning the Robot_Season_Archive rows, archived team standings, and Season_Accolade rows for a given user identifier and Season_Number
4. WHEN a request targets a user identifier that has no Stable_Season_Archive for the requested Season_Number, THE Season_API SHALL return a 404 response
5. WHERE a stable's `profileVisibility` is not `public` and the requester is not the owner, THE Season_API SHALL apply the same visibility rules to archive endpoints that the stable endpoint applies today
6. THE Season_API SHALL validate every route parameter, query parameter, and body field with a Zod schema through the `validateRequest` middleware

### Requirement 21: Season Configuration

**User Story:** As a system operator, I want season lengths configurable, so that I can shorten a season on the acceptance environment without a code change.

#### Acceptance Criteria

1. THE Season_Service SHALL read Season_Length_Cycles from the environment variable `SEASON_LENGTH_CYCLES` with a default of 100 and SHALL require an integer value of 1 or greater
2. THE Season_Service SHALL read Preparation_Length_Cycles from the environment variable `PREPARATION_LENGTH_CYCLES` with a default of 2 and SHALL require an integer value of 0 or greater
3. THE Season_Service SHALL read Countdown_Cycles from the environment variable `COUNTDOWN_CYCLES` with a default of 7 and SHALL require an integer value of 0 or greater
4. THE Season_Service SHALL read Accolade_Depth from the environment variable `ACCOLADE_DEPTH` with a default of 10 and SHALL require an integer value of 1 or greater
5. THE Season_Service SHALL read Retained_Images_Per_Stable from the environment variable `RETAINED_IMAGES_PER_STABLE` with a default of 20 and SHALL require an integer value of 1 or greater
6. IF a season configuration value fails validation at startup, THEN THE Season_Service SHALL fail startup with a message naming the invalid configuration key
7. WHEN Season_Length_Cycles changes while a season is in its Competitive_Phase, THE Season_Service SHALL apply the new value to the comparison in Requirement 2.3 on the next settlement

### Requirement 22: Season Change Communication

**User Story:** As a returning player, I want to be told what changed when a new season starts, so that I do not have to discover a shifted meta by losing battles with a build that used to work.

#### Acceptance Criteria

1. WHEN a Season_Rollover completes, THE Season_Rollover_Service SHALL create a `changelog_entries` row with status `draft` and category `balance` naming the new Season_Number, for an administrator to complete and publish during the Preparation_Phase
2. IF the changelog draft creation of Requirement 22.1 fails, THEN THE Season_Rollover_Service SHALL log the failure and SHALL report the rollover as successful, because player communication must never fail a rollover
3. THE Season_Summary_Modal SHALL link to the changelog so that a returning player can read what changed for the new season
4. WHILE the current Season_Phase is `preparation`, THE Dashboard SHALL link to the changelog alongside the preparation messaging of Requirement 4.4
5. THE Admin_Season_Portal SHALL surface the draft changelog entry created by Requirement 22.1 so that an administrator can find and publish it without searching the changelog list

### Requirement 23: Balance Changes Across a Season Boundary

**User Story:** As a game designer, I want to deploy a balance change during a preparation window and have it simply take effect for the coming season, without writing migration, recomputation, or compensation logic.

#### Acceptance Criteria

1. WHEN a balance value changes between two seasons, THE Season_Service SHALL require no data migration, no recomputation, and no player compensation, because every player holds zero robots, zero weapons, zero facilities, and zero attribute levels at the start of a Preparation_Phase
2. THE Season_Archive SHALL store literal outcome values that no later balance change recomputes, so that an archived season remains readable under the balance rules of every later season
3. THE Season_Archive_Page and the Stable_Page season history block SHALL present archived figures without restating them in terms of current balance values
4. THE Preparation_Phase SHALL be the recommended window for applying balance changes, enforced by convention and documentation rather than by any code path, because the acceptance environment is the only deployed environment and must stay deployable at any point in a season
5. THE `docs/balance_changes/README.md` SHALL state that balance changes are applied during a Preparation_Phase and SHALL require each balance change document to name the Season_Number in which it took effect

### Requirement 24: Season Zero Migration and Closure

**User Story:** As an administrator, I want the timeline that already ran before this spec to become a labelled legacy season that I close with one deliberate action, so that the first real season starts from a clean, honestly labelled boundary.

#### Acceptance Criteria

1. WHEN the migration runs against a database that holds no Season record, THE migration SHALL create one Season record with `seasonNumber` 0, `phase` set to `competitive`, `competitiveCyclesCompleted` set to the current Global_Cycle_Counter value, `preparationCyclesCompleted` set to 0, and `endedAt` set to null
2. THE Season_Service SHALL treat Season_Zero as having no fixed length and SHALL NOT invoke Season_Rollover for Season_Zero on the basis of the Requirement 2.3 comparison, regardless of how far `competitiveCyclesCompleted` exceeds Season_Length_Cycles
3. THE Season_Service SHALL leave Season_Zero running indefinitely, SHALL continue to execute every Settlement_Job step and every Battle_Event_Job normally, and SHALL invoke no Season_Rollover until an administrator triggers one
4. WHILE the current Season_Number is 0, THE Season_Progress_Indicator SHALL state `Season 0 · Cycle {Season_Cycle}` and SHALL omit Season_Length_Cycles and the remaining cycle count
5. THE only way to close Season_Zero SHALL be the manual Season_Rollover of Requirement 18.3, which executes immediately rather than waiting for a settlement boundary
6. WHEN Season_Rollover completes for Season_Zero, THE Season_Rollover_Service SHALL create the next Season with `seasonNumber` 1 and `phase` set to `preparation`
7. THE Stable_Season_Archive of Season_Zero SHALL carry a flag marking it as a legacy archive
8. WHERE a Stable_Season_Archive or Robot_Season_Archive figure of Season_Zero cannot be scoped to a single season because no season baseline was recorded — prestige earned, aggregate battle record, highest ELO, achievement counts, championship titles — THE Season_Archive_Service SHALL store the career-to-date value
9. WHERE a season row is flagged as a legacy archive, THE Stable_Page SHALL label it as career totals accumulated before the Season System rather than as a completed fixed-length season
10. THE migration SHALL be idempotent: WHEN the migration runs against a database that already holds a Season record, THE migration SHALL create no additional Season record

### Requirement 25: Season Archive Browsing

**User Story:** As a player, I want to browse the completed seasons of the whole game, so that past seasons are a shared history rather than something only visible on my own stable page.

#### Acceptance Criteria

1. THE Season_Archive_Page SHALL be reachable at the route `/seasons` and SHALL list every completed season ordered by Season_Number descending
2. THE Season_Archive_Page SHALL display for each completed season the Season_Number, the number of competitive cycles it ran, its start and end dates, the number of participating stables, and whether it is flagged as a legacy archive
3. WHEN a player selects a completed season, THE Season_Archive_Page SHALL display that season's final standings per mode, its champion stables, and its Season_Accolade entries
4. THE Season_Archive_Page SHALL render the per-season detail for each competitive mode present in that season's archive, including 1v1 League, 2v2 League, 3v3 League, Tag Team, KotH, Grand Melee, and each tournament type
5. THE Season_Archive_Page SHALL render every stable name as a link to that stable's Stable_Page season history block
6. WHERE no season has completed, THE Season_Archive_Page SHALL display a message stating that the first season is still in progress
7. THE primary navigation SHALL include a link to the Season_Archive_Page grouped with the Hall_of_Records entry
8. THE Season_Archive_Page SHALL be readable by any authenticated user and SHALL apply the same `profileVisibility` rules to stable names that the Season_API applies in Requirement 20.5
9. THE Season_Archive_Page SHALL render at viewport widths of 320 pixels and above without horizontal scrolling, collapsing the per-season detail into stacked sections below 1024 pixels, per Requirement 28
10. THE Season_Archive_Page SHALL paginate or lazily load season detail so that the initial request returns only the season list

### Requirement 26: In-Game Guide Content

**User Story:** As a player, I want the in-game guide to explain seasons and to stop telling me that prestige and achievements are permanent, so that the guide matches how the game now works.

#### Acceptance Criteria

1. THE in-game guide SHALL include a `seasons` section registered in `sections.json` with articles covering the season structure, what resets at a Season_Rollover, what survives, the Preparation_Phase, and how to read the Season_Archive
2. THE `seasons` guide section SHALL state explicitly that robots, weapons, facilities, attributes, tuning, credits, teams, subscriptions, standings, fame, prestige, achievements, and championship titles are deleted at a Season_Rollover, and that accounts, profile settings, and the Season_Archive survive
3. THE `seasons` guide section SHALL explain that no battle events are scheduled during the Preparation_Phase and that subscriptions set during preparation take effect on the first competitive cycle
4. THE `prestige-fame` guide section SHALL be corrected to state that prestige resets at each Season_Rollover and is not a permanent lifetime total
5. THE `achievements` guide section SHALL be corrected to state that achievements reset at each Season_Rollover and are recorded per season in the Season_Archive
6. THE `leagues`, `economy`, `grand-melee`, `king-of-the-hill`, `team-battles`, and `tournaments` guide sections SHALL be reviewed and corrected wherever they describe progression as permanent or open-ended
7. THE `getting-started` guide section SHALL state the current season length and that a new player joining mid-season receives the same starting package as everyone else

### Requirement 27: Local Development and Test Support

**User Story:** As a developer, I want to exercise a full season rollover on my local machine within minutes, so that I can verify archive contents and reset scope without waiting 100 days.

#### Acceptance Criteria

1. THE Season_Service SHALL honour Season_Length_Cycles and Preparation_Length_Cycles values as low as 1 and 0 respectively, so that a full season can be driven locally in a handful of cycles
2. THE Admin_Season_Portal manual settlement trigger SHALL advance the season phase counters exactly as a scheduled settlement does, so that a rollover can be reached without waiting for cron
3. THE seed script SHALL create a Season record when none exists, matching the migration behaviour of Requirement 24.1
4. THE seed script SHALL produce enough stables, robots, teams, standings, and completed battles for a local Season_Rollover to write a non-empty Season_Archive containing Robot_Season_Archive rows, archived team standings, and Season_Accolade rows
5. THE `docs/guides/operations/LOCAL_SETUP.md` SHALL document the season environment variables, the values to use for a fast local season, and the sequence of admin actions that drives a rollover end to end
6. THE test suite SHALL cover a full rollover against a seeded database, asserting the archive row counts of Requirement 5.2 and the zero-row assertions of Requirements 9.6 and 10.1
7. THE test suite SHALL cover the Season_Zero closure path of Requirement 24, asserting that no rollover occurs while no closure is scheduled and that the rollover occurs after the scheduled cycle count elapses

### Requirement 28: Mobile Responsiveness of Season Surfaces

**User Story:** As a player on a phone, I want every season surface to be fully usable at my screen width, so that reading my history or checking the season countdown does not require a desktop.

#### Acceptance Criteria

1. THE Season_Archive_Page, the Stable_Page season history block, the Season_Summary_Modal, the Season_Countdown_Banner, the Season_Progress_Indicator, the Dashboard preparation state, and the Admin_Season_Portal SHALL each render without horizontal scrolling at viewport widths from 320 pixels to 1920 pixels inclusive
2. WHERE the viewport width is below 1024 pixels, THE Season_Archive_Page SHALL render each season as a stacked card rather than a table row, and SHALL render the per-mode final standings as vertically stacked sections rather than side-by-side columns
3. WHERE the viewport width is below 1024 pixels, THE Stable_Page season history block SHALL render each collapsed season as a full-width card whose figures wrap onto multiple lines rather than a fixed-column row
4. WHERE the viewport width is below 1024 pixels, THE expanded per-robot detail of a season row SHALL stack each Robot_Season_Archive as its own card with its per-mode standings listed vertically beneath it
5. THE Season_Archive_Page and the Stable_Page season history block SHALL follow the responsive tab layout pattern documented in `.kiro/steering/frontend-standards.md` — desktop tabs at 1024 pixels and above via `useMediaQuery`, all sections stacked vertically below that width
6. WHERE a season surface presents tabular data with more columns than fit the viewport, THE surface SHALL reduce the visible columns to the identifying column plus the primary figure rather than allowing horizontal overflow
7. EVERY interactive control on a season surface — season row expanders, mode selectors, modal dismiss, banner dismiss, and every Admin_Season_Portal action — SHALL present a touch target of at least 44 by 44 pixels

8. THE Season_Summary_Modal SHALL fit within the viewport at 320 pixels wide and 568 pixels tall, scrolling its own content vertically rather than overflowing the viewport, and SHALL keep its dismiss control reachable without scrolling
9. THE Season_Countdown_Banner SHALL wrap its text onto multiple lines below 640 pixels rather than truncating the remaining cycle count, and SHALL keep its dismiss control clear of its link target
10. WHERE the viewport width is below 1024 pixels, THE Admin_Season_Portal SHALL stack the season state figures, the Rollover_Preview counts, and the action controls into a single column, and SHALL keep destructive actions visually separated from the phase length controls
11. THE Rollover_Preview per-table row counts SHALL render as a vertical label-and-value list below 1024 pixels rather than a wide table
12. THE frontend test suite SHALL assert for each season surface that it renders at 320, 375, and 1024 pixel widths, that no element exceeds the viewport width, and that every interactive control meets the touch target of Requirement 28.7

### Requirement 29: Generated Stable Handling at Rollover

**User Story:** As a system operator, I want auto-generated stables deleted rather than emptied at a Season_Rollover, so that a new season does not start with thousands of dead bot accounts and an archive dominated by bots.

#### Acceptance Criteria

1. THE `users` table SHALL carry an explicit boolean column marking whether a row is a Generated_Stable, set to true by `generateBattleReadyUsers` and by the seed script's test stable creation, and false by the Onboarding_Service and by the seed script's `admin` account creation, so that classification does not depend on username prefix matching
2. THE migration SHALL backfill the column of Requirement 29.1 to true for every existing user whose username begins with `auto_wimpbot`, `auto_averagebot`, `auto_expertbot`, or `test_user_`, and to false for every other user including `admin`
3. WHEN Season_Rollover executes the reset step, THE Season_Rollover_Service SHALL delete every Generated_Stable `users` row along with all of its owned rows, rather than resetting it to Starting_Credits
4. WHEN Season_Rollover deletes a Generated_Stable, THE Season_Rollover_Service SHALL write no Stable_Season_Archive and no Robot_Season_Archive for that stable
5. THE archive verification of Requirement 5.2 SHALL count only Human_Stable rows and the robots they own, so that deleting Generated_Stables does not fail verification
6. WHERE a Season_Accolade placement or Season_Standing_Snapshot entry belongs to a Generated_Stable, THE Season_Archive_Service SHALL retain it with its Generated_Stable flag set and its `userId` left null, so that the competitive record of the season stays accurate after the stable is deleted
7. THE Season_Standing_Snapshot and Season_Accolade rows SHALL survive the deletion of the Generated_Stables they reference, because Requirements 8.11 and 8.13 store the entity and stable names as denormalized text
8. WHEN Season_Rollover completes, THE Season_Rollover_Service SHALL leave every Human_Stable `users` row present and reset as specified in Requirements 9.3 and 11.1
9. WHEN Season_Rollover completes, THE Season_Rollover_Service SHALL report the number of Generated_Stables deleted alongside the archived and purged counts of Requirement 5.7
10. WHEN the first competitive settlement of a new season runs, THE Settlement_Job SHALL auto-generate stables from the reset Global_Cycle_Counter, so that the bot population rebuilds from a single stable on cycle 1 and grows with the season rather than starting at the previous season's volume
11. WHILE the current Season_Phase is `preparation`, THE Settlement_Job SHALL generate no stables, per Requirement 2.4
12. THE Rollover_Preview SHALL report the number of Generated_Stables that would be deleted separately from the number of Human_Stables that would be archived
13. THE Season_Archive_Page SHALL report the count of participating stables as two separate figures: the number of Human_Stables and the number of Generated_Stables that competed in that season
14. THE `docs/game-systems/PRD_AUTO_USER_GENERATION.md` SHALL document that Generated_Stables are deleted at each Season_Rollover, that generation restarts from the reset Global_Cycle_Counter, and that seeded test stables are classified as Generated_Stables
15. WHEN Season_Rollover deletes a Generated_Stable, THE Season_Rollover_Service SHALL record the count of Generated_Stables that competed in the completing season on the Season record, so that Requirement 29.13 can report it after the rows are gone

### Requirement 30: Uploaded Robot Image Retention

**User Story:** As a player who uploaded custom artwork for a robot, I want that image to survive the reset, so that I can rebuild the same character next season and so that my archived seasons do not render broken images.

#### Acceptance Criteria

1. WHEN Season_Rollover deletes a robot that holds a custom uploaded image, THE Season_Rollover_Service SHALL delete the `robots` row but SHALL retain the image file on disk
2. THE Robot_Season_Archive SHALL retain the image path of Requirement 7.2 as a path that still resolves to a file on disk, so that the expanded season row of Requirement 14.3 renders the robot's image rather than a broken reference
3. THE `cleanupOrphans` referenced-URL set SHALL include every image path held by a Robot_Season_Archive row, so that archived images are never treated as orphans
4. THE Image_Library SHALL present to each player every custom image that player uploaded and that is still retained, whether or not a current robot uses it
5. THE Image_Library SHALL return only images stored under the requesting user's own upload directory, and SHALL never expose or list an image uploaded by another user
6. WHEN a player submits an image path for a robot, THE Image_Library SHALL verify that the path resolves inside that user's own upload directory before persisting it, and IF it does not, THEN THE Image_Library SHALL reject the request with a generic `403 Access denied` that reveals nothing about whether the image exists
7. THE Image_Library SHALL apply the existing path traversal protection of `getAbsolutePath` to every submitted image path
8. WHERE a player views another stable's robots or another stable's archived seasons, THE frontend SHALL render those robots' images for display only and SHALL offer no action that copies or selects another user's image
9. WHEN a player creates a robot or changes a robot's image, THE Image_Library SHALL allow selecting one of that player's own retained images without re-uploading it and without re-running content moderation, because the image passed moderation when it was first uploaded
10. THE Image_Library SHALL retain at most Retained_Images_Per_Stable images per user
11. IF a player attempts an upload while already holding Retained_Images_Per_Stable retained images, THEN THE Image_Library SHALL reject the upload and SHALL report the limit and that an existing image must be deleted first, rather than silently evicting one of the player's images
12. THE Image_Library SHALL allow a player to delete any of their own retained images, and SHALL verify ownership as specified in Requirement 30.6 before deleting
13. THE Image_Library SHALL require an explicit confirmation before deleting an image, because deletion removes the file permanently
14. WHEN a player deletes an image that a current robot uses, THE Image_Library SHALL set that robot's `imageUrl` to null so the robot falls back to the default icon, and SHALL name the affected robots in the confirmation prompt
15. WHEN a player deletes an image that a Robot_Season_Archive row references, THE Image_Library SHALL set the archived image path to null so that the Stable_Page and Season_Archive_Page render a default silhouette for that archived robot, leaving every other archived value unchanged
16. THE Image_Library SHALL display for each retained image how many current robots use it and how many archived seasons reference it, so that a player can judge what a deletion costs before confirming
17. THE Image_Library SHALL display the number of retained images against Retained_Images_Per_Stable, so that a player can see how close they are to the limit
18. THE Season_Service SHALL read Retained_Images_Per_Stable from the environment variable `RETAINED_IMAGES_PER_STABLE` with a default of 20 and SHALL require an integer value of 1 or greater
19. WHEN an Account_Reset executes, THE Account_Reset SHALL retain the user's uploaded images under the same rules as Requirements 30.1 and 30.3 rather than deleting them eagerly
20. WHEN a user account is deleted, THE system SHALL delete that user's entire image directory, because no archive of a deleted user survives
21. THE Image_Library SHALL apply the existing per-user upload rate limiter and content moderation to every new upload, unchanged
22. THE Image_Library SHALL render at viewport widths of 320 pixels and above without horizontal scrolling, per Requirement 28
23. THE Rollover_Preview SHALL report the number of image files that would be retained and the number that would be deleted
24. WHEN Season_Rollover deletes a Generated_Stable and its robots, THE Season_Rollover_Service SHALL delete no file under the static asset directory, because Generated_Stable robots reference shared build assets at `/assets/robots/` rather than uploaded files
25. WHEN auto user generation creates robots in a new season, THE generated robots SHALL reference the same static asset paths they reference today, so that a new season's Generated_Stables have images without any per-season asset provisioning
26. THE Image_Library, the `deleteImage` operation, and the `cleanupOrphans` scan SHALL operate exclusively within `uploads/user-robots/` and SHALL never traverse or delete the static asset directory

### Requirement 31: Documentation and Steering Updates

**User Story:** As a developer, I want the season boundary reflected in project documentation, so that later work does not assume an open-ended timeline.

#### Acceptance Criteria

1. THE `docs/architecture/PRD_SERVICE_DIRECTORY.md` Cron Schedule section SHALL state that all Battle_Event_Jobs and the economic steps of the Settlement_Job are suspended during the Preparation_Phase
2. THE `.kiro/steering/project-overview.md` Key Systems list SHALL include the Season System with its reset scope and preparation window
3. THE `.kiro/steering/coding-standards.md` SHALL state that season-scoped queries must not assume data older than the current season exists, and that cross-season history must be read from the Season_Archive tables
4. THE `docs/architecture/DATABASE_SCHEMA.md` SHALL document the `seasons` table and the three Season_Archive tables
5. THE `docs/BACKLOG.md` entry for item #41 SHALL be replaced by a reference to this spec
6. THE `docs/architecture/DATABASE_SCHEMA.md` SHALL document Season_Zero and the legacy archive flag
7. A new `docs/game-systems/PRD_SEASON_SYSTEM.md` SHALL be created as the authoritative description of the season structure, the reset and preservation scope, the Preparation_Phase, the Season_Archive model, and Season_Zero, so that the system is documented outside this spec directory
8. THE `docs/game-systems/PRD_CYCLE_SYSTEM.md` SHALL document that the Settlement_Job reads the Season_Phase first, skips every economic step during preparation, leaves the Global_Cycle_Counter unchanged during preparation, and invokes Season_Rollover at the season boundary
9. THE `docs/game-systems/PRD_PRESTIGE_AND_FAME.md` SHALL state that prestige and fame reset at each Season_Rollover, superseding any statement that prestige is a permanent lifetime total
10. THE `docs/game-systems/PRD_ACHIEVEMENT_SYSTEM.md` SHALL state that achievements reset at each Season_Rollover and are recorded per season in the Stable_Season_Archive
11. THE `docs/game-systems/PRD_LEAGUE_SYSTEM.md` SHALL state that standings, tiers, LP, and ELO reset at each Season_Rollover and that league history is purged once archived
12. THE `docs/game-systems/README.md` SHALL list the new `PRD_SEASON_SYSTEM.md`
13. THE `docs/prd_pages/` documentation for the Stable page SHALL describe the season history block, and a new page document SHALL describe the Season_Archive_Page
14. THE `docs/guides/ADMIN_PANEL_GUIDE.md` SHALL document the Admin_Season_Portal, the Rollover_Preview, the manual rollover, the phase length controls, and the Season_Zero closure scheduling
15. THE `docs/game-systems/PRD_SEASON_SYSTEM.md` SHALL define the Preparation_Phase as the window in which balance changes are applied
16. THE `docs/game-systems/PRD_SEASON_SYSTEM.md` SHALL record that this spec resets prestige and achievements, superseding the persistence direction stated in backlog item #41
17. THE `docs/architecture/DATABASE_SCHEMA.md` SHALL document the Generated_Stable flag on `users` and the Season_Standing_Snapshot table
18. THE `seasons` guide section SHALL state that custom uploaded robot images survive the reset and can be re-applied to a new season's robots
