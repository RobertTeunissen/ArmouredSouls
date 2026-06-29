# Backlog — Ideas to Be Specced

Items identified during audits, reviews, and development. Prioritized by impact on player experience and system reliability.

**Priority scale**: High (should spec soon) · Medium (valuable but not blocking) · Low (nice to have) · Not scoped (future idea only)

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
| 8 | Season System (100-Cycle Seasons) | 41 | 0 🗳️ | 4 | 1 | 2 | 4 | **1.8** |
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

### #60 — Drop Legacy League Columns from Robot Model
**Source**: Grand Melee spec implementation (Spec #44) — discovered during frontend unification
**Priority**: High — technical debt causing inconsistency across league modes

The Robot model still has `currentLeague`, `leagueId`, `leaguePoints`, and `cyclesInCurrentLeague` columns from before the Database Unification (Spec #40). All league data now lives in the `Standing` table, but these stale Robot columns are still read by the frontend robot store, the league standings page (for 1v1 indicators), and various mock data in tests. They should be dropped from the schema and all reads replaced with Standing table queries. Affects: `storeRobots`, `LeagueStandingsPage`, `matchmakingService` bye-robot factory, `practiceArenaService`, `teamBattleOrchestrator` bye-robot factory, seed file, and ~15 test files.

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

### #41 — Season System (100-Cycle Competitive Seasons)
**Source**: Game Loop Audit (#6) — Loop 3 (Competitive Loop) has no resets, meta shifts, or seasonal structure  
**Priority**: Not scoped — planned for after current high-priority items

100-cycle (100-day) seasons with a full reset at season boundary. Forces strategic experimentation every season and permanently solves the late-game economic stagnation (Loop 2) and weapon lock-in (Loop 1).

**Design direction — full reset:**

At season end, the player's stable is archived (viewable as history) and they start fresh with starting credits, no robots, no weapons, no facilities, no attributes, no league placement. The only things that persist across seasons:

| Persists | Resets |
|----------|--------|
| Achievements (permanent collection) | Credits / balance (back to starting amount) |
| Lifetime prestige (cumulative) | Robots (archived) |
| Season history / archive | Weapons (gone with robots) |
| Account / login | Facilities (rebuild each season) |
| | Attributes (fresh robots = fresh stats) |
| | Fame (robot-level, dies with robot) |
| | LP / league tier (fresh standings) |
| | ELO (reset to 1200) |
| | Tuning allocations (fresh robots) |
| | Win/loss record (archived) |

**Why full reset works for this game:**
- Forces experimentation — can't run the same build, must make new choices with starting resources
- Levels the playing field — new players joining mid-season aren't months behind
- Makes every economic decision interesting again (credits are scarce)
- Solves weapon experimentation (#5) naturally — players try different weapons each season
- Solves economic loop stagnation (#6 Loop 2) permanently — no late-game credit hoarding
- Early decisions (which weapon first? which facility?) become interesting every season

**Why prestige persists:**
- The one number that says "I've been here a while" — visible tenure marker
- Gates facilities — veterans can access higher facility levels faster (still need to buy them, but not locked out). Fair reward for experience without insurmountable advantage.
- Battle winnings multiplier gives veterans a slight income edge — rebuild a bit faster, not dominant

**Risks to address in spec:**
- Loss aversion — players watching 100 days of work vanish. Mitigation: archive is viewable, achievements celebrate accomplishments, prestige carries forward.
- Grind fatigue — rebuilding from zero could feel like a treadmill. Mitigation: knowledge carries forward (you're better at building), prestige gives a small edge, each season can have a meta modifier to keep it fresh.
- Early season repetition — first 10–20 days could feel samey. Mitigation: seasonal meta modifiers (weapon category bonuses, arena conditions) change the optimal opening strategy.
- Achievement system must carry enough weight as the permanent progression layer.

**Player framing:** "Seasons are 100 days. At the end, your stable is archived — you can view your past seasons' history, robots, and final standings. Then you start fresh with new starting credits, a blank slate, and everything you've learned. Your achievements and prestige carry forward. Your legacy grows, but the competition resets."

**Dependencies**: #40 (achievement persistence — confirmed permanent), possibly #12 (arena modifiers as seasonal meta shifts).

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