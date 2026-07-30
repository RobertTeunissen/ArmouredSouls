# Backlog — Ideas to Be Specced

Items identified during audits, reviews, and development. Prioritized by impact on player experience and system reliability.

**Priority scale**: Blocker (stops shipping) · High (should spec soon) · Medium (valuable but not blocking) · Low (nice to have) · Not scoped (future idea only)

## 🚫 Blockers

| # | Item | Why it blocks |
|---|------|---------------|
| [#64](#64--repair-the-integration-test-suite-90-of-148-suites-failing) | Repair the Integration Test Suite | Every test tier is now mandatory in CI, so **main cannot deploy** until it is cleared. Test compile errors are down from 454 to 222; see the item for the live count. |

---

## WSJF Priority Ranking

Based on player poll (April 2026, 16 votes) and backlog analysis. WSJF = (Business Value + Time Criticality + Risk Reduction) / Job Size. Each factor 1–5.

| Rank | Item | # | Votes | BV | TC | RR | Size | WSJF |
|------|------|---|-------|----|----|-----|------|------|
| 1 | Game Loop Audit | 6 | 3 🗳️ | 3 | 4 | 5 | 2 | **6.0** |
| 2 | Feature Flags | 15 | 1 🗳️ | 2 | 2 | 4 | 2 | **4.0** |
| 3 | Landing Page | 4 | 0 🗳️ | 3 | 2 | 1 | 2 | **3.0** |
| 4 | Practice Arena Catalog Access | 57 | 0 🗳️ | 2 | 1 | 1 | 1 | **4.0** |
| 5 | Robot Comparison Tool | 42 | 0 🗳️ | 2 | 1 | 1 | 2 | **2.0** |
| 6 | Dashboard Enhancements | 24 | 0 🗳️ | 2 | 1 | 1 | 2 | **2.0** |
| 7 | Weapon Special Properties | 11 | 1 🗳️ | 3 | 2 | 2 | 4 | **1.8** |
| — | Season System (100-Cycle Seasons) | 41 | — | — | — | — | — | **SHIPPED — Spec #45** |
| 9 | Daily Login Bonuses & Seasonal Events | 34 | 0 🗳️ | 3 | 1 | 1 | 3 | **1.7** |
| 10 | Player Personas / Complexity Modes | 16 | 1 🗳️ | 2 | 1 | 2 | 3 | **1.7** |
| 11 | Arena / Terrain Modifiers | 12 | 1 🗳️ | 3 | 1 | 2 | 4 | **1.5** |
| 12 | Modular Package Extraction | 35 | 0 🗳️ | 1 | 1 | 2 | 3 | **1.3** |
| 13 | Robot Detail Page Split | 37 | 0 🗳️ | 2 | 1 | 1 | 3 | **1.3** |
| 14 | Universal Search / Command Palette | 27 | 0 🗳️ | 2 | 1 | 1 | 3 | **1.3** |
| 15 | Progressive Feature Disclosure | 28 | 0 🗳️ | 2 | 1 | 1 | 3 | **1.3** |
| 16 | Weapon Crafting System | 29 | 0 🗳️ | 3 | 1 | 1 | 5 | **1.0** |
| 17 | Free-for-All / Battle Royale Mode | 30 | 0 🗳️ | 3 | 1 | 1 | 5 | **1.0** |
| 18 | Conditional Battle Triggers / AI Scripting | 32 | 0 🗳️ | 3 | 1 | 1 | 5 | **1.0** |
| 19 | Future Revenue Streams | 33 | 0 🗳️ | 2 | 1 | 1 | 4 | **1.0** |
| 20 | Player Marketplace | 44 | 0 🗳️ | 3 | 1 | 1 | 5 | **1.0** |
| 21 | Social Features (Friends, Guilds, Chat) | 45 | 0 🗳️ | 3 | 1 | 1 | 5 | **1.0** |
| 22 | Prestige Store | 47 | 0 🗳️ | 2 | 1 | 1 | 4 | **1.0** |
| 23 | Blueprint Library | 48 | 0 🗳️ | 1 | 1 | 1 | 3 | **1.0** |
| 24 | Cosmetic Customization System | 46 | 0 🗳️ | 2 | 1 | 1 | 5 | **0.8** |
| 25 | Matchup-Dependent Weapon Effectiveness | 58 | 0 🗳️ | 3 | 1 | 2 | 5 | **1.2** |

### Recently Completed (removed from backlog)

| Item | # | Spec | Completed |
|------|---|------|-----------|
| Grand Melee Mode (20-robot FFA) | 30 | [Spec #44](/.kiro/specs/to-do/44-grand-melee/) | June 2026 |
| Tag Team Battle Time Limit Enforcement (closed as working-as-designed, documented in BATTLE_SIMULATION_ARCHITECTURE.md § Tag Team Orchestrator) | 19 | — | June 2026 |
| Battle Table Denormalization Cleanup (19 deprecated columns dropped) | 18 | — (direct implementation, completes Spec #43 Task 6.4) | June 2026 |
| Spec #40 Legacy Column Drop (Phase 2) | 59 | [Spec #43](/.kiro/specs/to-do/43-legacy-column-drop/) | June 2026 |
| Battle Log Retention / TOAST Trim (pre-computed summaries, 7-day retention, nightly cron) | 53 | [Spec #39](/.kiro/specs/to-do/39-battle-log-retention/) | June 2026 |
| Database Unification (unified standings, financial ledger, leaderboard cache) | — | [Spec #40](/.kiro/specs/done-june26/40-database-unification/) | June 2026 |
| Unified Match Scheduling (single scheduling table, shared matchmaking pipeline) | — | [Spec #41](/.kiro/specs/done-june26/41-unified-match-scheduling/) | June 2026 |
| Tag Team System Unification | 55 | [Spec #42](/.kiro/specs/done-june26/42-tag-team-system-unification/) | June 2026 |
| Historical Financial Tracking | 23 | [Spec #40](/.kiro/specs/done-june26/40-database-unification/) | June 2026 |
| Mega-Orchestrator Refactor (combat-critical files) | 49 | — (direct implementation) | June 2026 |
| Unimplemented Facilities Removal (Research Lab, Medical Bay, Coaching Staff) | 7 | — (direct implementation) | June 2026 |
| Frontend Page Hook Extraction (RobotsPage, RobotDetailPage) | 50 | — (direct implementation) | June 2026 |
| Team Battle Tournaments (2v2 / 3v3) | 54 | [Spec #38](/.kiro/specs/done-june26/38-team-battle-tournaments/) | June 2026 |
| Cron Schedule Restructure — Daily-Everything Slot Map | 56 | [Spec #36](/.kiro/specs/done-may26/36-cron-schedule-restructure/) | June 2026 |
| Vitest Performance Tuning (CI scripts, dot reporter, coverage gitignore) | 52 | — (direct implementation) | June 2026 |
| Test Setup Convention Cleanup (co-located `__tests__/`, eliminated centralized sprawl) | 51 | — (direct implementation) | June 2026 |
| Backend Test Reclassification (66 no-DB tests → unit runner, zero overlap, ~2min CI savings) | — | — (direct implementation) | June 2026 |
| Tag Team System Unification | 55 | [Spec #42](/.kiro/specs/done-june26/42-tag-team-system-unification/) | June 2026 |
| Team Battles 2v2 and 3v3 (League) | 31 | [Spec #37](/.kiro/specs/done-may26/37-team-battles-2v2-3v3/) | June 2026 |
| Untrack Generated Prisma Client (68K lines out of git) | — | — (direct implementation) | May 2026 |
| HTTP Client Consolidation (typed `api` wrapper everywhere) | — | — (direct implementation) | May 2026 |
| Console → Structured Logger Migration (FE + BE) | — | — (direct implementation) | May 2026 |
| Env Validation with Zod (fail-fast in production) | — | — (direct implementation) | May 2026 |
| Pre-commit Hooks (husky + lint-staged) | — | — (direct implementation) | May 2026 |
| Dead Code Audit (knip Pass A + B, ~30 files removed) | — | — (direct implementation) | May 2026 |
| Backend `any` Eliminated from Production Source | — | — (direct implementation) | May 2026 |
| Weapon Refinement (per-instance permanent upgrades, 4 tiers, 5-slot cap) | 5 (partial) | [Spec #34](/.kiro/specs/done-may26/34-weapon-refinement/) | May 2026 |
| Battle Subscription Facility (Booking Office event-subscription semantics) | 55 | [Spec #35](/.kiro/specs/done-may26/35-booking-office-facility/) | June 2026 |
| Weapon Resale (Workshop-level-dependent rate, ₡0–100% recovery) | 5 (partial) | [Spec #33](/.kiro/specs/done-may26/33-weapon-resale/) | May 2026 |
| Performance Optimization | 20 | — (direct implementation) | May 2026 |
| Promotion/Demotion History Tracking | 22 | [Spec #32](/.kiro/specs/done-may26/32-league-history-tracking/) | May 2026 |
| Battle History URL State Persistence | 25 | — (direct implementation) | May 2026 |
| Hall of Records Performance Caching | 26 | — (direct implementation) | May 2026 |
| League & Tag Team Instance Deep Linking | 39 | — (direct implementation) | May 2026 |
| Facility Investment Advisor | 1 | [Spec #30](/.kiro/specs/done-may26/30-fix-investment-advisor/) | May 2026 |
| Smooth Prestige Multiplier Scaling | 36 | — (direct implementation) | May 2026 |
| Monitoring and Alerting | 3 | [Spec #29](/.kiro/specs/done-may26/29-monitoring-and-alerting/) | May 2026 |
| Admin Portal Redesign | 13 | [Spec #28](/.kiro/specs/done-april26/28-admin-portal-redesign/) | April 2026 |
| Admin Tuning Adoption Dashboard | 38 | [Spec #28](/.kiro/specs/done-april26/28-admin-portal-redesign/) | April 2026 |
| Achievement / Milestone System | 8 | [Spec #27](/.kiro/specs/done-april26/27-achievement-system/) | April 2026 |
| In-Game Changelog / "What's New" | 17 | [Spec #24](/.kiro/specs/done-april26/24-in-game-changelog/) | April 2026 |
| Tuning Pool (Tactical Tuning) | 9 | [Spec #25](/.kiro/specs/done-april26/25-tuning-bay/) | April 2026 |
| Battle Report Layout Overhaul | 14 | [Spec #26](/.kiro/specs/done-april26/26-battle-report-overhaul/) | April 2026 |
| Prestige Gating for Facilities | 21 | — (already implemented) | Pre-backlog |

---

### #4 — Landing Page / Marketing Front Page
**Source**: Current state — visitors land on a login/register form with no context  
**Priority**: High — first impression for new players

The current front page is just a login and registration module. New visitors have no idea what the game is, how it plays, or why they should sign up. Needs: game concept pitch, screenshots or gameplay preview, feature highlights (4 battle modes, 47 weapons, league system), call-to-action to register.

### #6 — Game Loop Audit — Structural Design Flaws
**Source**: Design review  
**Priority**: High — foundational issues that limit long-term retention  
**Progress**: Loop 1 explored in depth — see [Game Loop 1 Core Loop Exploration](analysis/GAME_LOOP_1_CORE_LOOP_EXPLORATION.md). The Tuning Pool (spec #25) addressed the thin "Adjust" step. The DPS Rebalance (spec #31) addresses baseDamage dominance. Weapon Resale (spec #33) and Weapon Refinement (spec #34) shipped. Loop 1 is complete. Loops 2–6 and missing loops still need exploration.

The game has six identifiable loops, most of which degrade or stall at some point in the player lifecycle.

**Loop 1: Core Loop (Configure → Battle → Results → Adjust)** — ✅ Addressed. The Tuning Pool (spec #25) enriches the "Adjust" step. The DPS Rebalance (spec #31) makes all four loadout types viable and ensures attribute investment competes with weapon purchases. Weapon Resale (spec #33) and Weapon Refinement (spec #34) shipped. See exploration doc for full analysis.

**Loop 2: Economic Loop (Earn → Invest → Earn More)** — Not explored yet. Breaks in late game — credits accumulate with no meaningful sink once facilities and attributes are maxed. Weapon upgrades (identified in #5 discussion) would serve as an ongoing credit sink. Season System (#41) would reset the economy entirely.

**Loop 3: Competitive Loop (Battle → Earn LP → Promote → Harder Opponents)** — Not explored yet. One-dimensional. No seasons, resets, or meta shifts.

**Loop 4: Reputation Loop (Win → Prestige/Fame → Unlock → Win More)** — Explored in [Prestige & Fame Design Exploration](analysis/PRESTIGE_FAME_DESIGN_EXPLORATION.md). Prestige gates functional but invisible. Achievement System (#8) identified as the right vehicle for milestone celebrations.

**Loop 5: Roster Loop (Buy Robot → Train → Battle → Specialize → Expand)** — Not explored yet. Robots don't interact outside Tag Team.

**Loop 6: Facility Investment Loop (Spend Now → Save Later)** — Not explored yet. Mechanically strong, experientially invisible.

**Missing loops**: experimentation, social/rivalry, collection/completion, seasonal/event, recovery/comeback.

### #11 — Weapon Special Properties
**Source**: PRD_WEAPON_ECONOMY.md, PRD_WEAPONS_LOADOUT.md  
**Priority**: Medium — would significantly deepen combat strategy

All 47 weapons currently have only attribute bonuses — no special effects. The pricing formula and combat simulator are designed to support properties like "ignores armor", "shield drain", "area damage" but none are implemented.

### #12 — Arena / Terrain Modifiers with Home Arena Selection
**Source**: Player idea, [GitHub #278](https://github.com/RobertTeunissen/ArmouredSouls/issues/278)  
**Priority**: Medium — adds meta variation and per-battle decision-making

Battles take place in a randomly assigned arena with gameplay modifiers (e.g. "corrosive atmosphere: -15% armor effectiveness"). Players choose a preferred "home arena" for a familiarity bonus. The `ArenaConfig` type already exists in the combat simulator for KotH but has no gameplay modifiers.

**Player ideas from #278**: Arena shape/size as a gameplay variable — big arena, small arena, "endless arena", square, octagon, rolling floor that changes direction. Different arenas favor different robot builds and weapon types, which ties into tuning strategy and incentivizes weapon diversity (synergy with #5).

### #15 — Feature Flags / Per-User Feature Rollout
**Source**: Backlog triage  
**Priority**: Medium — enables safer releases and A/B testing

Add a feature toggle system manageable from the admin portal. Flags can be global, percentage-based, or per-user/per-role.

### #16 — Player Personas / Complexity Modes
**Source**: Backlog triage  
**Priority**: Medium — different players want fundamentally different experiences

Two archetypes: "just let me fight" vs "show me everything." Per the [Prestige & Fame Design Exploration](analysis/PRESTIGE_FAME_DESIGN_EXPLORATION.md): gating depth by prestige doesn't work — a preference toggle may be the right approach.

### #24 — Dashboard Enhancements
**Source**: PRD_DASHBOARD_PAGE.md  
**Priority**: Low — cosmetic improvements  
**Progress**: Promotion/demotion notifications on the dashboard shipped June 2026 (PR #337).

Tournament wins/trophy display, loading skeletons, notification toasts. If fame cosmetics (titles, visual indicators) are implemented via #8, the dashboard should display them.

### #27 — Universal Search / Command Palette (Cmd+K)
**Source**: Deleted navigation analysis doc, backlog triage  
**Priority**: Low → Medium candidate — improves discoverability across the entire app

No global search exists. A universal search bar (header or Cmd+K overlay) querying robots, players, weapons, pages, guide articles, and battle history. Existing infrastructure: `SearchBar` component, guide search index API, admin user search pattern.

### #28 — Progressive Feature Disclosure
**Source**: Deleted navigation analysis doc  
**Priority**: Low — reduces new player overwhelm

Per the [Prestige & Fame Design Exploration](analysis/PRESTIGE_FAME_DESIGN_EXPLORATION.md): prestige-gated feature unlocks were largely rejected. A simple preference toggle (#16) may be more appropriate.

### #29 — Weapon Crafting System
Custom weapon design at Workshop Level 6+. Pricing formula already supports it.

### #30 — Free-for-All / Battle Royale Mode
Large-scale elimination (8–100 robots). [Design analysis](analysis/FREE_FOR_ALL_BATTLE_ROYALE_MODE.md) exists.

### #32 — Conditional Battle Triggers / Robot AI Scripting
Player-defined robot behaviors: "switch stance when HP < 30%", "target weakest in KotH".

### #33 — Future Revenue Streams
Trading commission, sponsorship deals, arena attendance, championship bonuses, daily login bonuses.

### #34 — Daily Login Bonuses & Seasonal Events
Consecutive login rewards, limited-time challenges, end-of-season league placement rewards.

### #35 — Modular Package Extraction
npm workspace extraction. Only relevant when multiple consumers need shared backend logic.

### #37 — Robot Detail Page Split: Review vs Prepare / Stable Preparation Dashboard
**Source**: Tuning Pool spec discussion (spec #25)  
**Analysis**: [Robot Detail Page Split Analysis](analysis/ROBOT_DETAIL_PAGE_SPLIT_ANALYSIS.md) (June 2026)

The Robot Detail page serves two distinct intents (Review: Overview/Matches/Analytics vs Prepare: Upgrades/Tuning/Battle Config/Stats). With 8 tabs, the page conflates retrospective analysis with prospective preparation — neither context gets appropriate density or layout. Analysis recommends splitting into two pages: a public Robot Profile (`/robots/:id`) as a scrollable career narrative, and an owner-only Workshop (`/robots/:id/prepare`) with collapsible accordion sections, a robot switcher for multi-robot workflows, and a persistent status strip. The "Stable Preparation Dashboard" concept is absorbed into the Workshop via the robot switcher rather than a separate page.

### #41 — Season System (100-Cycle Competitive Seasons) — SHIPPED

**Delivered by [Spec #45](/.kiro/specs/to-do/45-season-system/) (July 2026).** See [PRD_SEASON_SYSTEM.md](game-systems/PRD_SEASON_SYSTEM.md) for the authoritative description.

The shipped design differs from the direction recorded here in one significant way: **prestige and achievements reset** rather than persisting. Prestige gates facility levels, so carrying it forward would let a veteran open every season at facility depths a newer player could not reach, compounding indefinitely. Both are recorded per season in the archive instead.

Also shipped beyond the original sketch: a 2-cycle preparation window with all battle events suspended, four archive tables including a bounded standings snapshot that retains bot-held league positions, deletion (not reset) of auto-generated and seeded stables, a browsable Season Archive page, and retention of uploaded robot images across the reset.

### #42 — Robot Comparison Tool
**Source**: Removed from navbar — unimplemented page (`/robots/compare`)  
**Priority**: Low — QoL feature for experienced players

Side-by-side comparison of two or more robots' stats, attributes, weapons, and tuning allocations. Helps players make informed decisions about upgrades and loadout changes. Could include a simulated "who would win" prediction based on current builds.

### #44 — Player Marketplace
**Source**: Removed from navbar — unimplemented pages (`/marketplace`, `/marketplace/my-listings`, `/marketplace/history`)  
**Priority**: Not scoped — large feature, needs economic design

Player-to-player weapon trading marketplace. Players list weapons for sale at their chosen price, others browse and buy. Includes listing management ("My Listings") and transaction history. Needs careful economic balancing to avoid inflation/deflation. Consider: listing fees, transaction tax, price floors/ceilings, trade cooldowns.

**Dependencies**: Weapon resale mechanics (#5), possibly Season System (#41) which would reset inventories.

### #45 — Social Features (Friends, Guilds, Chat)
**Source**: Removed from navbar — unimplemented pages (`/friends`, `/notifications`, `/guilds`, `/guild`, `/guild/manage`, `/chat`)  
**Priority**: Not scoped — large feature set, low player demand so far

Full social layer: friend lists, in-game notifications, guild creation/management, guild chat. Would enable guild-vs-guild competitions, shared facilities, and social retention loops. Large scope — likely needs to be broken into multiple specs (friends first, then guilds, then chat).

### #46 — Cosmetic Customization System
**Source**: Removed from navbar — unimplemented pages (`/customize`, `/customize/skins`, `/customize/stable`, `/customize/poses`, `/customize/emotes`)  
**Priority**: Not scoped — monetization opportunity, no gameplay impact

Robot skins, stable visual customization, victory poses, and emotes/taunts. Pure cosmetic layer with no gameplay effect. Could serve as a credit sink for late-game players or a future monetization vector. Depends on having visual assets created.

**Potential credit sinks**: Skin unlocks, pose unlocks, emote packs, stable themes.

### #47 — Prestige Store
**Source**: Removed from navbar — unimplemented page (`/prestige-store`)  
**Priority**: Not scoped — depends on prestige having enough value

A store where players spend accumulated prestige points on exclusive rewards: cosmetic items, facility unlock discounts, unique weapon skins, or seasonal advantages. Gives prestige a tangible spend path beyond passive multipliers.

**Dependencies**: Cosmetic Customization (#46) for cosmetic rewards, Season System (#41) for seasonal prestige value.

### #48 — Blueprint Library
**Source**: Removed from navbar — unimplemented page (`/blueprints`)  
**Priority**: Not scoped — depends on Weapon Crafting (#29)

A collection of saved weapon blueprints for the crafting system. Players save successful designs, share blueprints with others, and browse community-created weapon configurations. Only relevant once Weapon Crafting (#29) is implemented.

**Dependencies**: Weapon Crafting System (#29).

### #57 — Practice Arena Catalog Access (Try Before You Buy)
**Source**: Weapon Experimentation Problem (#5), follow-up item 3  
**Priority**: Low — QoL, small scope

Let players test any weapon from the shop in practice battles, not just owned weapons. The What-If system already supports weapon overrides for owned weapons — extending to unowned weapons is a small change. Reduces purchase anxiety and encourages experimentation.

### #58 — Matchup-Dependent Weapon Effectiveness (Rock-Paper-Scissors)
**Source**: Weapon Experimentation Problem (#5), follow-up item 4  
**Priority**: Not scoped — large combat system change

Energy weapons bypass armor but shields resist them; ballistic shreds shields but armor blocks. Creates rock-paper-scissors dynamics that require owning multiple weapon types. Large scope — needs its own spec, careful balance work, and UI changes to communicate effectiveness. Synergizes with Arena Modifiers (#12) for meta variation.

### #60 — Drop Legacy League Columns from Robot Model
**Source**: Grand Melee spec implementation (Spec #44) — discovered during frontend unification
**Priority**: High — technical debt causing inconsistency across league modes

The Robot model still has `currentLeague`, `leagueId`, `leaguePoints`, and `cyclesInCurrentLeague` columns from before the Database Unification (Spec #40). All league data now lives in the `Standing` table, but these stale Robot columns are still read by the frontend robot store, the league standings page (for 1v1 indicators), and various mock data in tests. They should be dropped from the schema and all reads replaced with Standing table queries. Affects: `storeRobots`, `LeagueStandingsPage`, `matchmakingService` bye-robot factory, `practiceArenaService`, `teamBattleOrchestrator` bye-robot factory, seed file, and ~15 test files.

### #61 — Guided New Robot Setup Workflow
**Source**: Player experience — a newly created robot is not battle-ready and nothing walks the player through making it so
**Priority**: Medium — affects every new robot a player creates, including their first

Creating a robot is one step; making it actually compete takes six or seven more, spread across four pages. Nothing guides the player through them, and two of the steps are silent hard gates:

- **No weapon equipped** → `checkSchedulingReadiness()` rejects the robot, so matchmaking skips it. It is never scheduled for anything.
- **No event subscription** → the Booking Office gates participation in every battle event. Even a fully equipped robot never enters a match.

Either omission leaves a robot sitting idle indefinitely, and the player has no obvious signal why. The other steps are softer but still shape whether the robot performs or bleeds Credits: loadout type, stance, yield threshold (drives repair cost), tuning allocation, and attribute upgrades.

Proposal: a guided flow after robot creation that walks through equip weapon(s) for the chosen loadout → stance → yield threshold → tuning allocation → event subscriptions, with attribute upgrades offered as an optional final step. Skippable at any point, resumable later, and with a persistent "this robot is not battle-ready because…" indicator for anything still outstanding.

Open questions: whether this is a modal wizard, a checklist on the robot page, or an extension of the existing onboarding tour; and whether the same checklist should surface for robots that fall out of readiness later (weapon sold, subscription dropped at a season reset — everything except accounts and onboarding state resets each season, so returning players re-do all of this for every robot).

**Related**: #37 (Robot Detail Page Split) proposes an owner-only "Prepare" workspace covering the same actions — a creation wizard and that page should share components rather than duplicate them. #28 (Progressive Feature Disclosure) and #16 (Player Personas) overlap on how much to show a new player at once.

### #62 — Edge DDoS Protection in Front of ACC
**Source**: Subscription rate-limit investigation (Booking Office unification)
**Priority**: Medium — no edge protection exists today; the box is small enough that this matters

There is no protection ahead of the application. `app/Caddyfile` terminates TLS and sets headers and compression, but has no `rate_limit` directive and no connection caps, and there is no CDN or scrubbing layer in front. Everything currently rests on in-process `express-rate-limit` counters, which means every abusive request still costs a Node event-loop turn, a DB round trip in some cases, and TLS termination — on a 2 vCPU / 2 GB DEV1-S.

What exists and is worth keeping in mind: the general limiter is 300 req/min per client IP, register 30/min, login 10/15min, admin 120/min, per-user economic 100/min, body limit 1 MB. `app.set('trust proxy', 1)` is set and PM2 runs a single instance, so the counters are neither pooled into one bucket nor multiplied per worker — they behave as intended. The gap is purely that they are the *only* line of defence.

Options, cheapest first: Caddy's `rate_limit` plugin plus connection limits; Cloudflare in front (free tier covers L3/L4 and basic L7, and hides the origin IP, which also removes direct-to-IP attacks); Scaleway's own edge services. Cloudflare additionally solves the shared-IP fairness problem more cleanly than app-level keys can.

Not urgent while the player base is small and the origin IP is not widely known, but the fix is mostly configuration, so it is cheap to do before it is needed.

### #63 — Tighten the `require-validate-request` ESLint Rule
**Source**: Zod coverage audit (Booking Office unification)
**Priority**: Low — closes a blind spot in an otherwise complete control

`eslint-rules/require-validate-request.js` walks the AST of every `router.get/post/put/delete/patch` call in `src/routes/` and fails lint when `validateRequest` is absent. Coverage is genuinely 100% by that measure. The blind spot is that it checks the call *exists*, not that it validates anything: `validateRequest({})` satisfies it while validating nothing.

There are roughly 40 such sites. Most are legitimately input-free (`GET /overview`, `GET /scheduler/status`). The one real hole this hid has been fixed — `POST /api/admin/scheduler/trigger/:jobName` read an unvalidated route param and cast it into `triggerJob` — but nothing stops the next one.

Proposal: have the rule inspect the route path for `:params` and the handler for `req.body` / `req.query` access, and require the corresponding schema key to be present. An explicit opt-out comment for genuinely input-free routes keeps the noise down.

### #64 — Repair the Integration Test Suite (90 of 148 suites failing)
**Source**: Full-suite run during the Booking Office unification, 30 July 2026
**Priority**: Blocker — the CI gates are now real, so this blocks every deploy

**Why this was invisible.** Two independent holes, and the failing suites sat in the
intersection of both. They were never typechecked (`tsconfig.json` excludes tests,
so `pnpm run build` covers `src/` only) *and* never enforced: `deploy.yml` ran
`pnpm run test:integration 2>&1 | tail -n 500 || true`, and even without the
`|| true` the pipe alone discards the exit code because GitHub's default shell has
no `pipefail`. `deploy-acc` listed the job in `needs:`, so the graph showed a gate
that could not fire. Also found: `pnpm run lint || true` on both deploy lint steps,
`continue-on-error` on E2E, no frontend tests in `deploy.yml`, and `test:heavy`
running in no pipeline at all. All fixed — every tier is now mandatory and blocking,
which is what makes this item a blocker rather than a cleanup.

`pnpm run test:unit` is fully green (205 suites, 2881 tests). `pnpm run test:integration` reports **90 failed / 58 passed of 148 suites, 180 failed / 1000 passed of 1180 tests**. None of it is recent: the failures are tests that were never updated when earlier specs changed the schema and service surfaces, and TypeScript never caught them because a test that fails to compile simply reports "suite failed to run" and is easy to skim past.

Sampled causes:

| Suite | Cause |
|---|---|
| `tests/kothMatchmaking.test.ts` | imports `distributeIntoGroups`, removed by Spec #41 (unified match scheduling) |
| `tests/kothEngine.test.ts`, `kothEngine.property.test.ts` | reference `rotatingZone`, `processZoneRotation`, `KOTH_MATCH_DEFAULTS.rotatingZoneTimeLimit` — none exist |
| `tests/teamBattle.property.test.ts`, `tests/userGeneration.test.ts` | reference `prisma.scheduledTeamBattleMatch`, dropped by Spec #41 |
| `tests/analyticsApi.test.ts`, `tests/userGeneration.test.ts` | reference `battles.robot1Id` / `robot2Id`, dropped by Spec #43 |
| `tests/userGeneration.test.ts` | references `scheduledKothMatchParticipant`, now `scheduledMatchParticipant` |
| `tests/duplicateEmail.property.test.ts` and other auth suites | registration returns 400 where the test expects 201 — validation drift |
| `tests/leagues.test.ts` | expects an `error` key in a 400 body that is now `{}` |
| `src/services/achievement/__tests__/achievementService.test.ts` | fully mocked yet quarantined out of the unit runner; assertions have rotted |

Two structural problems worth fixing alongside the individual suites:

1. **Compile failures are invisible.** A suite that does not typecheck reports "failed to run" and does not fail loudly enough to have been noticed for months. `tsc --noEmit` covers `src/` but the test tsconfig evidently does not gate CI the same way.
2. **Suites are quarantined into the integration runner as "requires DB" when they are fully mocked.** The same mistake was found and fixed for four changelog suites, and `achievementService.test.ts` is another instance. A mocked suite parked behind a live-DB setup stops being run in practice, and then rots.

**Progress.** `tsconfig.test.json` + `pnpm run typecheck:tests` now typecheck the
suites, and that runs in CI as a blocking step. Test compile errors are down from
**454 to 221 across 32 files**; four orphaned suites deleted (they tested
`roiCalculatorService` and `distributeIntoGroups`, neither of which exists).
Repaired and verified passing: matchmakingService, profileUpdate,
stanceAndYieldAPI, finances, adminRobotStats, eloProgression, metricProgression,
middleware/auth, scheduling.property, the four streaming-revenue suites,
kothEngine (+property), hpTracking, leagueRebalancingService, resetService, and
analyticsApi. Remaining, largest first: `teamBattleCompleteCycle` (28),
`battleOrchestrator` (23), `tagTeamByeHandling` (16),
`tagTeamBattleLogCompleteness` (11), `onboardingApi` (10),
`kothOrchestrator.property` (10), `cycleSnapshot.property` (10), then a tail of
4–8 error files.

**A third hole, not yet closed.** `"lint": "eslint src"` never lints tests —
measured at **45 errors and 448 warnings across 304 test files**, mostly
auto-fixable (26 `prefer-const`, 13 `no-require-imports`). Two of those errors
were only ever caught because `lint-staged` lints staged files. Extending the
lint script to `tests` belongs to this item, per "every check is mandatory".

Expect a second wave of assertion failures once these compile — some suites have not
executed in months. Two already sampled: auth registration returns 400 where the
test expects 201, and `leagues.test.ts` expects an `error` key in a 400 body that is
now `{}`.

### #65 — Combat Event HP Fields: Half-Fixed Swap and a Possibly Stale Canonical Map
**Source**: Integration suite repair (Backlog #64), 30 July 2026
**Priority**: Medium — affects anything reading HP out of battle events, including replay

Found while removing a bug-demonstration test in `tests/hpTracking.pbt.test.ts` that
asserted `foundSwap === true`, i.e. it could only pass while the defect it documented
remained. Two separate problems came out of it.

**1. The attacker/defender swap is only half fixed.** The deprecated `robot1HP` /
`robot2HP` / `robot1Shield` / `robot2Shield` event fields are supposed to be
positional — robot 1 and robot 2 of the battle. `simulationLoop.ts` and
`simulationState.ts` populate them correctly from `states[0]` / `states[1]`, but
`attackResolution.ts` still writes `attackerState.currentHP` / `defenderState.currentHP`
into them at all six event sites. So on any attack event where robot 2 is the
attacker, the two fields are transposed. They are marked `@deprecated` in
`combatTypes.ts` with an instruction to use the `robotHP` map instead, so the choice
is to either finish the fix or drop the fields — leaving them half-right is the worst
of the three.

**2. The canonical `robotHP` map may predate the event it is attached to.**
`pushEvent` in `simulationLoop.ts` injects a cached snapshot and rebuilds it only when
`hpSnapshotDirty` is set. `attackResolution.ts` mutates `defenderState.currentHP`
directly and never sets that flag, so the map attached to an attack event can still
show pre-damage HP. This matters more than (1), because `robotHP` is documented as the
source of truth and is what consumers were told to migrate to.

Worth a focused check of when the snapshot is invalidated relative to damage
application, then a regression test asserting the map matches post-event state for
both attack directions — the test that should have existed instead of one asserting a
bug was present.

### #66 — Metric Progression Silently Attributes Battles to Cycle 1 When a Snapshot Is Missing
**Source**: Integration suite repair (Backlog #64), 30 July 2026
**Priority**: Medium — wrong analytics rather than an error, so it fails quietly

`robotPerformanceService` has two ways to answer "which cycle did this battle happen
in", and they disagree on what to do when there is no `CycleSnapshot`:

- `getCycleNumberForBattle` (single) tries snapshots, then falls back to the latest
  preceding `cycle_start` audit event, then to 1.
- `batchGetCycleNumbers` (used by `getRobotMetricProgression`, i.e. every progression
  chart) consults **snapshots only**. With no snapshot covering a timestamp it takes
  the closest preceding snapshot's cycle number, or 1 if there is none.

Snapshot creation is wrapped so that a failure cannot abort a cycle, which is correct
— but it means a missing snapshot is a live possibility, and when it happens every
battle in that window is filed under the wrong cycle (or cycle 1). The progression
series then renders with the points quietly in the wrong place, or empty, with no
error anywhere. Fix is to give the batch path the same audit-log fallback the single
path has, so the two cannot disagree, and to add a test that a progression built
without snapshots still lands on the right cycles.

Surfaced by `tests/analyticsApi.test.ts`, where the aggregate assertions need the
fixture to have *no* snapshots (`getRobotPerformanceSummary` prefers snapshot
`robotMetrics`, which are built from `battle_complete` audit events the fixture does
not emit) while the progression assertion needs snapshots to exist. Having to satisfy
both in one file is what made the divergence visible.

### #67 — Facility Advisor Recommends Upgrades Its Own ROI Figure Calls a Loss
**Source**: Integration suite repair (Backlog #64), 30 July 2026
**Priority**: Low — needs a product decision, not a bug fix

`facilityRecommendationService.evaluateFacility` measures two different horizons
and then mixes them:

- `projectedROI` is `(savingsPerCycle × 30 − upgradeCost) / upgradeCost` — a
  30-cycle window.
- `priority` comes from `projectedPayoffCycles`, which for the training facility
  and weapons workshop counts `high ≤ 20`, `medium ≤ 40`, else `low`.

The suppression guard at the end is `projectedROI <= 0 && priority === 'low'`. A
facility that pays back on cycle 40 therefore reports a **negative** 30-cycle ROI
at `medium` priority and survives the guard, so the advisor shows the player an
upgrade alongside a figure saying it loses money. A training facility at 3,750
credits saved per cycle against a 150,000 cost is exactly this case: ROI −0.25,
payoff 40 cycles, priority medium, recommended.

Either is defensible and it is a product call, which is why this is filed rather
than fixed:

1. **Treat the guard as authoritative** — drop `&& priority === 'low'`, so nothing
   with a non-positive projected ROI is ever recommended (bar the repair bay,
   which is a deliberate exception). Simple, but removes recommendations players
   get today, and a 40-cycle payback is not obviously a bad investment.
2. **Treat the horizon as the problem** — report ROI over the same window the
   priority bands use, or present payoff cycles as the headline number and drop
   the 30-cycle ROI from the UI. Keeps the recommendations, makes the number match
   the advice.

Whichever is chosen, `tests/facilityRecommendation.property.test.ts` Property 22.4
should go back to asserting the stronger invariant; it currently accepts "positive
ROI **or** pays back at all", with the reasoning noted inline.
