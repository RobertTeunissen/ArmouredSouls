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
| 4 | Weapon Experimentation Problem | 5 | 1 🗳️ | 4 | 3 | 4 | 4 | **2.8** |
| 5 | Robot Comparison Tool | 42 | 0 🗳️ | 2 | 1 | 1 | 2 | **2.0** |
| 6 | Dashboard Enhancements | 24 | 0 🗳️ | 2 | 1 | 1 | 2 | **2.0** |
| 7 | Frontend Page Hook Extraction (RobotsPage, RobotDetailPage) | 50 | 0 🗳️ | 1 | 1 | 2 | 2 | **2.0** |
| 8 | Weapon Special Properties | 11 | 1 🗳️ | 3 | 2 | 2 | 4 | **1.8** |
| 9 | Season System (100-Cycle Seasons) | 41 | 0 🗳️ | 4 | 1 | 2 | 4 | **1.8** |
| 10 | Mega-Orchestrator Refactor (combat-critical files) | 49 | 0 🗳️ | 3 | 2 | 4 | 5 | **1.8** |
| 11 | Daily Login Bonuses & Seasonal Events | 34 | 0 🗳️ | 3 | 1 | 1 | 3 | **1.7** |
| 12 | Player Personas / Complexity Modes | 16 | 1 🗳️ | 2 | 1 | 2 | 3 | **1.7** |
| 13 | Arena / Terrain Modifiers | 12 | 1 🗳️ | 3 | 1 | 2 | 4 | **1.5** |
| 14 | Battle Table Denormalization Cleanup | 18 | 0 🗳️ | 1 | 1 | 1 | 2 | **1.5** |
| 15 | Tag Team Battle Time Limit Enforcement | 19 | 0 🗳️ | 1 | 1 | 1 | 2 | **1.5** |
| 16 | Historical Financial Tracking | 23 | 0 🗳️ | 1 | 1 | 1 | 2 | **1.5** |
| 17 | Test Setup Convention Cleanup | 51 | 0 🗳️ | 1 | 1 | 1 | 2 | **1.5** |
| 18 | Vitest Performance Tuning | 52 | 0 🗳️ | 1 | 1 | 1 | 2 | **1.5** |
| 19 | Modular Package Extraction | 35 | 0 🗳️ | 1 | 1 | 2 | 3 | **1.3** |
| 20 | Robot Detail Page Split | 37 | 0 🗳️ | 2 | 1 | 1 | 3 | **1.3** |
| 21 | Achievement Persistence Across Seasons | 40 | 0 🗳️ | 2 | 1 | 1 | 3 | **1.3** |
| 22 | Events Calendar | 43 | 0 🗳️ | 2 | 1 | 1 | 3 | **1.3** |
| 23 | Universal Search / Command Palette | 27 | 0 🗳️ | 2 | 1 | 1 | 3 | **1.3** |
| 24 | Progressive Feature Disclosure | 28 | 0 🗳️ | 2 | 1 | 1 | 3 | **1.3** |
| 25 | ~~Battle Subscription Facility~~ | ~~55~~ | 0 🗳️ | ~~2~~ | ~~1~~ | ~~1~~ | ~~3~~ | ~~**1.3**~~ | ✅ Completed |
| 26 | Weapon Crafting System | 29 | 0 🗳️ | 3 | 1 | 1 | 5 | **1.0** |
| 27 | Free-for-All / Battle Royale Mode | 30 | 0 🗳️ | 3 | 1 | 1 | 5 | **1.0** |
| 28 | Conditional Battle Triggers / AI Scripting | 32 | 0 🗳️ | 3 | 1 | 1 | 5 | **1.0** |
| 29 | Future Revenue Streams | 33 | 0 🗳️ | 2 | 1 | 1 | 4 | **1.0** |
| 30 | Player Marketplace | 44 | 0 🗳️ | 3 | 1 | 1 | 5 | **1.0** |
| 31 | Social Features (Friends, Guilds, Chat) | 45 | 0 🗳️ | 3 | 1 | 1 | 5 | **1.0** |
| 32 | Prestige Store | 47 | 0 🗳️ | 2 | 1 | 1 | 4 | **1.0** |
| 33 | Blueprint Library | 48 | 0 🗳️ | 1 | 1 | 1 | 3 | **1.0** |
| 34 | Team Battle Tournaments (2v2 / 3v3) | 54 | 0 🗳️ | 3 | 1 | 1 | 5 | **1.0** |
| 35 | Unimplemented Facilities | 7 | 0 🗳️ | 2 | 1 | 1 | 4 | **1.0** |
| 36 | Cosmetic Customization System | 46 | 0 🗳️ | 2 | 1 | 1 | 5 | **0.8** |

### In Progress

| Item | # | Spec | Status |
|------|---|------|--------|
| Team Battles 2v2 and 3v3 (League) | 31 | [Spec 37 team-battles-2v2-3v3](/.kiro/specs/to-do/37-team-battles-2v2-3v3/) | In progress (not yet completed) — delivers the league piece; tournaments split out as #54 and subscription facility as #55 |
| Cron Schedule Restructure — Daily-Everything Slot Map | 56 | [Spec 36 cron-schedule-restructure](/.kiro/specs/to-do/36-cron-schedule-restructure/) | In progress — restructures cron layout to daily 10-slot map with heavy-mode spacing, reserved slots for future battle modes, and midnight settlement |

### Recently Completed (removed from backlog)

| Item | # | Spec | Completed |
|------|---|------|-----------|
| Untrack Generated Prisma Client (68K lines out of git) | — | — (direct implementation) | May 2026 |
| HTTP Client Consolidation (typed `api` wrapper everywhere) | — | — (direct implementation) | May 2026 |
| Console → Structured Logger Migration (FE + BE) | — | — (direct implementation) | May 2026 |
| Env Validation with Zod (fail-fast in production) | — | — (direct implementation) | May 2026 |
| Pre-commit Hooks (husky + lint-staged) | — | — (direct implementation) | May 2026 |
| Dead Code Audit (knip Pass A + B, ~30 files removed) | — | — (direct implementation) | May 2026 |
| Backend `any` Eliminated from Production Source | — | — (direct implementation) | May 2026 |
| Weapon Refinement (per-instance permanent upgrades, 4 tiers, 5-slot cap) | 5 (partial) | [Spec #34](/.kiro/specs/done-may26/34-weapon-refinement/) | May 2026 |
| Battle Subscription Facility (Booking Office event-subscription semantics) | 55 | [Spec #35](/.kiro/specs/to-do/35-booking-office-facility/) | June 2026 |
| Weapon Resale (Workshop-level-dependent rate, ₡0–100% recovery) | 5 (partial) | [Spec #33](/.kiro/specs/to-do/33-weapon-resale/) | May 2026 |
| Performance Optimization | 20 | — (direct implementation) | May 2026 |
| Promotion/Demotion History Tracking | 22 | [Spec #32](/.kiro/specs/to-do/32-league-history-tracking/) | May 2026 |
| Battle History URL State Persistence | 25 | — (direct implementation) | May 2026 |
| Hall of Records Performance Caching | 26 | — (direct implementation) | May 2026 |
| League & Tag Team Instance Deep Linking | 39 | — (direct implementation) | May 2026 |
| Facility Investment Advisor | 1 | [Spec #30](/.kiro/specs/to-do/30-fix-investment-advisor/) | May 2026 |
| Smooth Prestige Multiplier Scaling | 36 | — (direct implementation) | May 2026 |
| Monitoring and Alerting | 3 | [Spec #29](/.kiro/specs/to-do/29-monitoring-and-alerting/) | May 2026 |
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

### #5 — Weapon Experimentation Problem — Players Never Switch Weapons
**Source**: Observed player behavior  
**Priority**: High — core gameplay loop stagnation  
**Progress**: baseDamage dominance identified as root cause. DPS rebalance specced — see [Spec #31](/.kiro/specs/to-do/31-weapon-dps-rebalance/). Weapon resale and weapon upgrades identified as follow-up features after the rebalance lands.

Players buy one weapon set and never change. The investment is too high and too permanent — there's no way to sell weapons back, no way to try before you buy, and no partial recovery on a bad purchase. This kills experimentation and makes the 47-weapon catalog feel like a 1-weapon catalog per player.

**Root cause — baseDamage dominance in the damage formula:**

The damage formula is `baseDamage × (1 + combatPower × 1.5 / 100) × loadout × weaponControl × stance`. Because `baseDamage` is a flat multiplier and attributes are percentage modifiers, weapon baseDamage is the single most important combat variable — far more impactful than any attribute investment or tuning. The DPS spread between cheapest and most expensive 1H weapon is 3.0× (2.0 DPS to 6.0 DPS). Attributes can only provide ~1.5× multiplier at high investment. The weapon always wins.

**Analysis findings (May 2026):**
- Five top-tier 1H weapons (Vibro Mace, Volt Sabre, Nova Caster, Particle Lance, all at 18 dmg/3s = 6.0 DPS, ₡425K) are identical in the only thing that matters (DPS). Their attribute bonuses differ but are drowned out by the baseDamage gap.
- Dual wielding two top weapons (~₡850K) produces ~2.5× the DPS of a single weapon — making it the only viable strategy.
- Shield builds (Weapon + Aegis Bulwark) lose decisively because fights end too fast for defensive mechanics to matter (avg 33.8s, 42.9% kill rate).
- A robot with all attributes at 1 and a Volt Sabre beats a robot with all attributes at 15 and a Practice Sword by 127%.
- With ₡3M starting budget, players can afford both top weapons AND good attributes — the weapon is still the obvious first buy.

**Solution — DPS Rebalance (Spec #31):**
- Compress baseDamage spread from 3.0× to 2.0× (top 1H goes from 18 to 12 baseDamage)
- Increase pricing formula DPS multiplier from M=3 to M=6 so prices stay within ±1%
- No HP/shield/cooldown/attribute changes — battles get ~33% longer (~45s avg), giving defensive builds time to work
- After rebalance: all four loadout types (DW, 2H, single, shield) are within 15% of each other on effective combat power
- After rebalance: attribute-heavy builds with cheap weapons can compete with weapon-heavy builds (DPS×EHP favors the attribute player at equal budget)

**Follow-up features (to spec after rebalance lands):**

1. ~~**Weapon resale** — Sell weapons back at Workshop-level-dependent rates (40–75%). Quality-of-life improvement that reduces switching cost. Workshop gets a second meaningful purpose beyond purchase discounts.~~ ✅ **Shipped May 22, 2026** as [Spec #33](/.kiro/specs/done-may26/33-weapon-resale/) — final formula was `level × 10` (0% at L0, 100% at L10), mirroring the purchase discount slope.

2. ~~**Weapon upgrades** — Level individual weapon instances over time (reliability, attribute bonuses, minor damage, unique passives at thresholds). Creates attachment and identity. A fully upgraded cheap weapon could match a stock expensive weapon. Ongoing credit sink that solves late-game economic stagnation.~~ ✅ **Shipped May 23, 2026** as [Spec #34](/.kiro/specs/done-may26/34-weapon-refinement/) — branded **Weapon Refinement** (kept "Tuning" reserved for the Tuning Pool). Four tiers (Hone / Augment / Sharpen / Forge), 5-slot cap, Workshop-gated, refinement spend folds into `pricePaid` so resale partially recovers it. Identity-first: rank prefixes, custom names, slot bar visible everywhere a weapon is displayed.

3. **Practice Arena catalog access** — Let players test any weapon from the shop in practice battles (not just owned weapons). The What-If system already supports weapon overrides for owned weapons — extending to unowned is a small change.

4. **Matchup-dependent effectiveness** — Energy weapons bypass armor but shields resist them; ballistic shreds shields but armor blocks. Creates rock-paper-scissors requiring multiple weapons. Large scope, future spec.

### #6 — Game Loop Audit — Structural Design Flaws
**Source**: Design review  
**Priority**: High — foundational issues that limit long-term retention  
**Progress**: Loop 1 explored in depth — see [Game Loop 1 Core Loop Exploration](analysis/GAME_LOOP_1_CORE_LOOP_EXPLORATION.md). The Tuning Pool (spec #25) addressed the thin "Adjust" step. The DPS Rebalance (spec #31) addresses baseDamage dominance, making weapon choice and attribute investment both meaningful. Weapon resale and weapon upgrades are identified as the remaining follow-ups for Loop 1. Loops 2–6 and missing loops still need exploration.

The game has six identifiable loops, most of which degrade or stall at some point in the player lifecycle.

**Loop 1: Core Loop (Configure → Battle → Results → Adjust)** — ✅ Mostly addressed. The Tuning Pool (spec #25) enriches the "Adjust" step. The DPS Rebalance (spec #31) makes all four loadout types viable and ensures attribute investment competes with weapon purchases. Remaining gaps: weapon resale (reduce switching cost) and weapon upgrades (create attachment and ongoing progression). See exploration doc for full analysis.

**Loop 2: Economic Loop (Earn → Invest → Earn More)** — Not explored yet. Breaks in late game — credits accumulate with no meaningful sink once facilities and attributes are maxed. Weapon upgrades (identified in #5 discussion) would serve as an ongoing credit sink. Season System (#41) would reset the economy entirely.

**Loop 3: Competitive Loop (Battle → Earn LP → Promote → Harder Opponents)** — Not explored yet. One-dimensional. No seasons, resets, or meta shifts.

**Loop 4: Reputation Loop (Win → Prestige/Fame → Unlock → Win More)** — Explored in [Prestige & Fame Design Exploration](analysis/PRESTIGE_FAME_DESIGN_EXPLORATION.md). Prestige gates functional but invisible. Achievement System (#8) identified as the right vehicle for milestone celebrations.

**Loop 5: Roster Loop (Buy Robot → Train → Battle → Specialize → Expand)** — Not explored yet. Robots don't interact outside Tag Team.

**Loop 6: Facility Investment Loop (Spend Now → Save Later)** — Not explored yet. Mechanically strong, experientially invisible.

**Missing loops**: experimentation, social/rivalry, collection/completion, seasonal/event, recovery/comeback.

### #7 — Unimplemented Facilities (3 remaining)
**Source**: PRD_FACILITIES_PAGE.md  
**Priority**: Medium — players can buy them but they do nothing

3 of 14 facility types exist in the schema but have no gameplay effect:
- Research Lab — analytics, loadout presets, battle simulation
- Medical Bay — critical damage repair cost reduction (separate from Repair Bay)
- Coaching Staff — stable-wide stat bonuses via hired coaches

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

### #18 — Battle Table Denormalization Cleanup
**Source**: [Battle Execution Audit](analysis/BATTLE_EXECUTION_AUDIT.md)  
**Priority**: Low — works correctly, just redundant data

The `Battle` table dual-writes per-robot columns alongside `BattleParticipant`. Consider a migration to drop legacy columns.

### #19 — Tag Team Battle Time Limit Enforcement
**Source**: [Battle Execution Audit](analysis/BATTLE_EXECUTION_AUDIT.md)  
**Priority**: Low — stored duration is correct, only simulation overruns

Tag team battles can theoretically exceed 300s because each phase has its own 120s cap.

### #23 — Historical Financial Tracking
**Source**: PRD_ECONOMY_SYSTEM.md  
**Priority**: Low — cycle snapshots provide basic history already

Dedicated financial trend tracking beyond what CycleSnapshot provides.

### #24 — Dashboard Enhancements
**Source**: PRD_DASHBOARD_PAGE.md  
**Priority**: Low — cosmetic improvements

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

### #31 — Team Battles 2v2 and 3v3 (League) — IN PROGRESS
**Source**: Backlog triage; expanded into spec  
**Priority**: In progress — see [Spec 37 team-battles-2v2-3v3](/.kiro/specs/to-do/37-team-battles-2v2-3v3/)

Active spec covering 2v2 and 3v3 league battles, persistent Teams per size, Team Coordination ally effects, daily 2v2/3v3 alternation, unified `/team-battles` UI, achievement integration, seeded-stable enrolment, and admin manual triggers. Tournaments are explicitly out of scope and tracked separately as #54 below.

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

The Robot Detail page serves two distinct intents (Review: Overview/Matches/Analytics vs Prepare: Upgrades/Tuning/Battle Config/Stats). With 7 tabs, consider visual tab grouping or a Stable Preparation Dashboard for managing all robots from one view.

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

### #40 — Achievement Persistence Across Seasons
**Source**: Achievement System spec (#27) discussion  
**Priority**: Not scoped — resolved: achievements persist permanently

Achievements persist permanently across seasons (lifetime collection). They are the primary permanent progression layer alongside prestige. The `UserAchievement` table needs no `seasonId` column — achievements are entirely outside the season reset scope. Some achievements may reference seasonal accomplishments (e.g., "reach Diamond in 3 different seasons") but the awards themselves never reset.

### #42 — Robot Comparison Tool
**Source**: Removed from navbar — unimplemented page (`/robots/compare`)  
**Priority**: Low — QoL feature for experienced players

Side-by-side comparison of two or more robots' stats, attributes, weapons, and tuning allocations. Helps players make informed decisions about upgrades and loadout changes. Could include a simulated "who would win" prediction based on current builds.

### #43 — Events Calendar
**Source**: Removed from navbar — unimplemented page (`/events`)  
**Priority**: Not scoped — depends on seasonal/event system (#34, #41)

A calendar view showing upcoming tournaments, seasonal events, daily login bonus windows, and cycle milestones. Only useful once time-limited events exist in the game. Depends on Daily Login Bonuses (#34) or Season System (#41) being implemented first.

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

### #54 — Team Battle Tournaments (2v2 / 3v3)
**Source**: Spec discussion during team-battles-2v2-3v3 review (May 2026)  
**Priority**: Medium — natural follow-up once league Team Battles ship

Bracketed tournament play for 2v2 and 3v3 Team Battles. Depends on the Team Battle league spec (#31) shipping first because it reuses Team registration, Team_ELO, the Team Battle Engine, and the unified `/team-battles` UI.

**Approach (decided): Option B — generalise the existing tournament system.**

The existing `Tournament`, `ScheduledTournamentMatch`, and `processTournamentBattle` are robot-keyed (`robot1Id`, `robot2Id`, `winnerId` referencing `Robot`, with `tournamentMatchesAsRobot1`/`tournamentMatchesAsRobot2` relations on the Robot model). Adding parallel `TeamTournament`/`ScheduledTeamTournamentMatch` tables would double the surface and split tournament code paths. Instead, the agreed direction is to **refactor the tournament schema and code to be entity-keyed (Robot OR Team)**, so a single tournament system serves 1v1, 2v2, and 3v3 brackets.

**Why this is its own spec:**
- The schema change is a Mega-Orchestrator Refactor-class change — Backlog #49 explicitly flags this kind of work as needing its own spec.
- Bundling it into the league Team Battles spec would put two large efforts in motion simultaneously, making regressions hard to attribute.
- The tournament system has 3+ cycles of historical data and championship titles tied to `User.championshipTitles` — the migration needs careful staging.

**Schema refactor scope:**
- Add `participantType` (`'robot'` | `'team_2v2'` | `'team_3v3'`) and `participantId` to `Tournament` and `ScheduledTournamentMatch`. The existing `robot1Id`/`robot2Id`/`winnerId` columns either become nullable and dual-populated during migration, or are renamed to `participant1Id`/`participant2Id` with the type discriminator.
- Migrate existing rows: `participantType = 'robot'`, `participantId = robotId`.
- `generateBracketPairs` accepts `seededParticipants` (Robot[] or Team[]) instead of `seededRobots`.
- `processTournamentBattle` dispatches to either the existing 1v1 orchestrator or the Team Battle Engine based on `participantType`.
- `advanceWinnersToNextRound` is participant-type-agnostic.
- `autoCreateNextTournament` gains a `tournamentType` parameter so admins can create per-type tournaments.

**Tournament-specific design questions for the spec to answer:**
- **Championship title accounting.** Currently winning a tournament increments `User.championshipTitles`. For team tournaments: increment for each member's owner (all the same User in this spec since teams are single-stable), or only once per tournament regardless of team size? Or introduce `User.teamChampionshipTitles2v2` and `User.teamChampionshipTitles3v3`?
- **C18 "Autobots, Roll Out!" achievement** is already being expanded to require all six modes (league + KotH + tag-team + tournament + team_2v2 + team_3v3) in the league spec. Tournaments piggyback on `User.championshipTitles > 0` — does that include team tournament wins, or do team tournaments need a separate counter?
- **Cadence and scheduling.** Tournaments span multiple cycles (one round per cycle). The 2v2/3v3 daily alternation rule for league mode does not translate. Options: alternate per tournament (one tournament is 2v2, next is 3v3), run them in parallel (2v2 and 3v3 tournaments active simultaneously with separate brackets), or schedule per type (2v2 tournaments every Monday, 3v3 every Thursday). Decide in spec.
- **Eligibility.** Top N teams per tier per size? Open to all eligible teams? Stable-snapshot at create time? What happens when a team is dissolved mid-tournament — does the team forfeit, do remaining members forfeit, or does the team auto-substitute?
- **Reward shape.** Does the team-tournament prize pot match 1v1 tournament prizes, scale by team size, scale by team mode popularity? Distributed across team members per the existing R7.4-style contribution split?
- **Bracket size.** Existing 1v1 tournaments use power-of-2 brackets via `generateBracketPairs`. Team tournaments likely smaller pool (fewer registered teams than robots) — minimum viable bracket size needs a sensible floor.
- **Eligibility gating.** Should team tournaments require a facility (Booking Office, currently unimplemented per Backlog #7) or a prestige threshold? See gating discussion below.
- **Manual matchmaking / friendlies.** Out of scope for the league spec; should team tournaments support admin-triggered exhibition brackets? See also #55 — battle subscription facility — which would feed both league and tournament event sign-ups.

**Gating discussion (decision needed in spec):**
- **Facility-based gating.** Booking Office (Backlog #7) is the existing-but-unimplemented facility whose description already references "Unlock Silver/Gold/Platinum/Diamond league tournaments". Implementing it for team tournaments aligns its purpose. Levels would gate which league tier is allowed to enter.
- **Subscription-facility gating** (#55). The new battle subscription facility is the more general gating mechanism. If it lands first, team tournament entry could go through it.
- **Prestige threshold.** Simpler, no schema; risk is invisible gating.
- **No gating.** Open to all eligible teams. Cleanest for early adoption.

**Dependencies:**
- #31 (Team Battles league) must ship first — establishes Team registration, Team_ELO, Team Battle Engine, achievement triggers, unified `/team-battles` UI.
- Decision on #55 (battle subscription facility) preferred but not blocking — gating can fall back to direct facility/prestige checks.
- #49 (Mega-Orchestrator Refactor) is not a hard dependency but the tournament refactor is similar in shape; coordinate ordering.

**Scope estimate:** Medium-to-large. Schema migration + data backfill + dual-orchestrator dispatch + UI updates (admin tournament creation flow gains type selector, tournament detail page renders team brackets, results screen handles N robots per side) + championship-title semantics + achievement wiring. Do not start until #31 has been live on ACC for at least one cycle to validate the league mode.

### #55 — Battle Subscription Facility — ✅ COMPLETED
**Source**: Spec discussion during team-battles-2v2-3v3 review (May 2026)  
**Priority**: ~~Medium~~ → Completed  
**Spec**: [Spec #35 — Booking Office Facility](/.kiro/specs/to-do/35-booking-office-facility/)

Implemented as the **Booking Office** facility with event-subscription semantics. The system introduces a per-robot subscription model gating participation in all battle events (1v1 League, 1v1 Tournament, Tag Team, KotH) through a single, extensible Event Registry. The Booking Office facility level determines how many concurrent event subscriptions each robot may hold (3 at L0, +1 per level up to 13 at L10). Free switching with next-cycle effect, per-robot lock-on-queued-battle rule, onboarding subscription picker, and migration granting existing players free L1 + all four subscriptions per robot.


---

## Engineering Maintenance Items

These came out of the May 2026 codebase audit. They're internal-quality-of-life items rather than gameplay/UX features, but they affect velocity, reliability, and onboarding for every future change. Listed at the end so the gameplay backlog above stays the primary view.

### #49 — Mega-Orchestrator Refactor (Combat-Critical Files)
**Source**: Codebase audit (May 2026) — original audit item #1
**Priority**: Medium — high-impact architectural win, but needs a spec before starting

**Problem.** Five files exceed 1,500 lines, all in combat-critical territory:

| File | Lines | Domain |
|------|-------|--------|
| `app/backend/src/services/tag-team/tagTeamBattleOrchestrator.ts` | 2,157 | Tag team battle orchestration |
| `app/backend/src/services/battle/combatSimulator.ts` | 2,011 | Core combat state machine |
| `app/backend/src/services/achievement/achievementService.ts` | 1,904 | Achievement evaluation across 77 achievements |
| `app/backend/src/services/battle/combatMessageGenerator.ts` | 1,847 | Narrative event generation |
| `app/backend/src/services/arena/kothEngine.ts` | 1,786 | King of the Hill multi-robot battles |

`coding-standards.md` says "Maximum function length: ~50 lines" — these files are orders of magnitude past that as wholes, and almost certainly contain individual functions well past it too.

**Why it matters.**
- Combat is the single most critical surface in the game. `coding-standards.md` mandates 90% test coverage for it. Mega-files make targeted regression testing harder because everything is coupled.
- GitNexus impact analysis loses precision when one file contains a dozen logical units — every change shows the whole file as "affected."
- Onboarding new contributors to combat code is unreasonable when the entry point is a 2,000-line file.
- Any change has ambiguous blast radius. Bug fixes near the orchestration boundary risk side effects in unrelated handlers in the same file.

**Expected shape after refactor.** The pattern we want is "200-line coordinator delegating to handlers" — same approach the frontend already uses for things like the `WeaponShopPage` (a thin shell that pulls from `useWeaponShop`). For example `combatSimulator.ts` should become:

- A small state-machine driver (~200 lines)
- Per-phase handler modules (initiative, attack resolution, damage application, status effects, victory check)
- A clear boundary where each handler can be unit-tested in isolation

`tagTeamBattleOrchestrator.ts` similarly: orchestrate phases (active battle, tag transitions, reserve battle), but delegate per-phase logic to dedicated modules.

**Strategy.** Pick **one file at a time**, in this order (lowest blast-radius first to build confidence):

1. `combatMessageGenerator.ts` (1,847) — pure functions, easy to split by event type, no state
2. `achievementService.ts` (1,904) — split by achievement category (combat / progression / economy)
3. `kothEngine.ts` (1,786) — already isolated to KotH battles, lower coupling than 1v1
4. `combatSimulator.ts` (2,011) — the riskiest; do it last with full regression suite green
5. `tagTeamBattleOrchestrator.ts` (2,157) — depends on a refactored `combatSimulator`

**Each refactor is its own spec.** Don't try to do all five in one PR. Each should:
- Run `gitnexus impact` on the target file before starting (record affected processes and modules)
- Define the new module boundary in the design doc
- Include a regression test plan (at minimum, all existing combat tests must pass without modification)
- Land behind a feature flag if possible (parallel implementation, swap on green)

**Scope estimate.** ~3–5 days per file with test suite green throughout. Do not start without:
1. The DPS Rebalance (#5 follow-up) landing first — combat balance changes during a refactor would muddy regression detection.
2. A regression test inventory documenting which tests cover which paths.
3. Agreement on the target module structure (avoid the trap of "split now, decide structure later").

**Dependencies.** None blocking, but don't start during another active spec on combat. Coordinate with weapon refinement / DPS rebalance work.

---

### #50 — Frontend Page Hook Extraction (RobotsPage, RobotDetailPage)
**Source**: Codebase audit (May 2026) — original audit item #8
**Priority**: Low — natural follow-on to the HTTP client migration

**Problem.** Two player-facing pages still mix data fetching, business logic, and rendering in single 800-line components:

| File | Lines |
|------|-------|
| `app/frontend/src/pages/RobotsPage.tsx` | 818 |
| `app/frontend/src/pages/RobotDetailPage.tsx` | 815 |

Both pages own:
- API calls for robots + facilities + weapons + league standings + battle history
- Complex state (sort, filters, view mode, selected robot, repair confirmation, image selector, toast, league rank)
- Business logic (repair cost calculation, readiness assessment, sort comparators)
- Rendering of multiple sections (header, stats, tabs, modals)

This was tolerable before the HTTP client consolidation. After that work, every fetch in these files is now one line of `await api.get(...)` — which makes the data-fetching layer easy to extract cleanly.

**Strategy.**
1. **Create `useRobotsList(userId)`** — owns the GET + filter + sort state + repair-all action. Returns `{ robots, loading, error, repairAll, sortBy, setSortBy, filters, setFilters }`. RobotsPage becomes a presentational shell consuming this hook. Pattern matches existing `useWeaponShop`, `useFacilities`, `usePracticeArena`.

2. **Create `useRobotDetail(robotId)`** — owns the per-robot GET + weapon/facility/league fetches + tab state + image selector state. Returns the same shape. RobotDetailPage becomes a presentational shell.

3. **Extract section components.** Each page has clear visual sections (header card, stats row, tabs, action bar). Pull each into its own component once the hook abstraction is in place. Target ~150 lines per page after the split.

**Why this is low-priority.** It's a code-organization win, not a correctness or performance win. The current pages work. But:
- They're hard to test as units.
- Onboarding to "how do I add a tab to RobotDetailPage" is hard.
- The summary in TASK 3 even noted that an old `useRobotDetail` hook had been started and abandoned — someone clearly tried this once and got distracted.

**Note on the `useRobotDetail` hook deletion.** The audit summary mentions a `useRobotDetail` hook was deleted as part of dead-code cleanup because nothing used it. Do not assume that hook was the right shape — it was abandoned, not feature-complete. Start fresh and use `useWeaponShop` as the reference pattern.

**Scope estimate.** ~1 day per page with tests. Total ~2 days. Mostly mechanical after the migration we just shipped.

**Dependencies.** None. Could be picked up at any time.

---

### #51 — Test Setup Convention Cleanup
**Source**: Codebase audit (May 2026) — original audit item #9
**Priority**: Low — works correctly, just inconsistent

**Problem.** Test files live in two conventions in the same repo:

- **Co-located** — `src/components/foo/__tests__/Foo.test.tsx` (sibling of source)
- **Centralized** — `src/__tests__/SomePage/...` (separate from source)

Multiple `accessibility.test.tsx`, multiple `setupTests`-like patterns, scattered helpers. Vitest runs all of them so nothing's broken, but it makes "where do I add a test for X" ambiguous and means similar tests can drift out of sync.

**Strategy.**
1. Audit the centralized `src/__tests__/` tree and decide per directory whether the tests belong with their source file or are genuinely cross-cutting (e.g. integration-style tests spanning multiple modules).
2. Move co-locatable tests to `__tests__/` folders next to their source, following the dominant pattern.
3. Keep cross-cutting / integration-style tests in a dedicated `src/__tests__/integration/` folder.
4. Document the convention in `CONTRIBUTING.md` so it doesn't drift again.

**Scope estimate.** ~½ day. No code changes, just file moves + import path updates. Safe behind the test suite.

**Dependencies.** None.

---

### #52 — Vitest Performance Tuning
**Source**: Codebase audit (May 2026) — original audit item #10
**Priority**: Low — current 13s for 1568 tests is fine, but there are easy wins

**Problem.** Frontend test runs:
- 1,568 tests in ~13 seconds (acceptable but not optimized)
- Default reporter produces a lot of output dots
- Coverage is not collected by default
- Vitest caching/sharding likely not configured

**Strategy.**
1. **Reporter:** switch to `--reporter=verbose` for development, `--reporter=dot` only in CI logs where parsing-friendly output matters.
2. **Coverage default:** add `npm run test:coverage` as a separate script using `@vitest/coverage-v8`. Don't make it the default — slows iteration.
3. **Caching:** Vitest auto-caches dependencies; verify the cache directory is excluded from `git clean` and CI doesn't `rm -rf` it.
4. **Sharding:** for CI, consider `--shard=1/4` etc. across parallel jobs if test time becomes a bottleneck. Not urgent at 13s.
5. **Watch mode hygiene:** confirm `--watch` doesn't re-run unrelated suites on every change.

**Scope estimate.** ~½ day. Most of it is profiling current behavior to confirm what's actually slow vs. what just looks slow.

**Dependencies.** None.


### #53 — Battle Log Retention / TOAST Trim
**Source**: Disk-pressure investigation, May 25, 2026 (ACC deploy timeout)
**Priority**: Medium — non-urgent after disk resize, but real growth on a finite budget

The `battle_log` JSON column on the `battles` table accumulates indefinitely. As of cycle #56 with ~49,341 battles on ACC, the column's TOAST storage was **4.6 GB** (≈98 KB per battle on average). At ~880 battles per cycle that's roughly **85 MB/day** of new TOAST. With a 25 GB disk and the rest of the system holding around 10 GB steady-state, we have ~6 months of runway before disk pressure returns. Not urgent now, but bounded.

**The data being accumulated:**
- `battleLog.events` — narrative event stream rendered in the battle report
- `battleLog.detailedCombatEvents` — per-tick combat resolution with formula breakdowns, used by the BattleDetailsModal "View Details" expansion in the admin tools
- `battleLog.placements` (KotH) — per-robot zone scoring and placement
- `battleLog.kothData` — KotH match config

The only consumers of these payloads are:
1. The player-facing battle report (`/battles/:id` style routes via `RecentBattles`, `RobotDetailPage`, etc.)
2. The admin BattleDetailsModal's combat-event expansion
3. The Hall of Records cache (which extracts a few summary fields from `battleLog`)

99% of "view this battle" interactions happen within hours of the battle finishing. After a few days the full event stream is essentially never read.

**Investigation findings:**

| Metric | Value |
|--------|-------|
| Total battles | 49,341 |
| Heap size | 9 MB |
| Index size (7 indexes, all in active use) | 4.8 MB |
| TOAST size | **4,620 MB** |
| Avg TOAST per battle | ~98 KB |

The seven battles indexes are healthy and seeing real query traffic — none are candidates for dropping. The size is purely TOAST.

**Three remediation options, ordered by safety:**

1. **Strip `battleLog` from old battles (recommended).** `UPDATE battles SET battle_log = NULL WHERE created_at < NOW() - INTERVAL '<retention>'` followed by `pg_repack` or `VACUUM FULL battles`. Keeps row, participants, ELO, winner, rewards — drops only the heavy JSON. Reclaims most of the TOAST.
2. **Compress more aggressively (Postgres 14+).** Switch the column to `lz4` compression (`ALTER TABLE battles ALTER COLUMN battle_log SET COMPRESSION lz4`). Only affects new rows, so it complements #1 rather than replacing it.
3. **Hard delete old battles entirely.** Faster recovery, but cascades to `BattleParticipant` and risks anything that aggregates from the `battles` table. Lifetime stats already live on `Robot` directly so leaderboards are fine, but recent-battles lists, hall-of-records, and tournament history would lose data. Riskier.

**Open design questions for the spec:**

- **Retention window.** A blanket 7 days is the simplest answer. A smarter policy could keep the full log for tournament finals indefinitely, KotH for 30 days, and league for 7 — but that complexity needs justification.
- **Retention vs feature visibility.** The "View Details" expansion in the admin BattleDetailsModal currently goes silent on battles with no detailed events. Does it need to render a "log no longer available" placeholder, or is silent-empty acceptable?
- **Should the strip be application-side or DB-side?** A nightly cron in `app/scripts/` is simpler. A periodic Prisma-side maintenance task is more discoverable from the codebase. A native Postgres `pg_cron` job is most reliable but adds operational surface area.
- **Hall of Records caching.** The Hall of Records pulls summary fields from `battleLog` for several record types. Verify the cache has already extracted everything it needs from old battles before we strip them.
- **Should we also do the compression switch as a same-PR change?** Almost certainly yes — it gives us both immediate reclamation and slower future growth.

**Scope estimate.** ~½ day for a v1 (single retention window, single cron job, manual one-shot for first cleanup) plus ~½ day for verification + monitoring. Larger if we go for differentiated retention.

**Dependencies.** None blocking. Hall of Records caching would benefit from being verified before we strip historical battle logs (#26 is already shipped, but worth a sanity check).

**Risks to address:**
- **Replay regression.** Anyone clicking "view battle" on an N+1 day battle gets a degraded experience. Mitigation: clear UI affordance ("battle log archived") and ideally extend the retention window if players complain.
- **Vacuum lock.** `VACUUM FULL battles` takes an exclusive lock and could lock out battle inserts for the duration. Either use `pg_repack` (no lock, requires extension) or run during a quiet maintenance window. Probably the latter for v1, the former once `pg_repack` is installed.
- **One-time vs ongoing.** The first cleanup will reclaim ~4 GB; subsequent daily runs will reclaim ~85 MB/day. Confirm cron actually runs and the alert if it doesn't.
