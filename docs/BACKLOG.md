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
| 7 | Weapon Special Properties | 11 | 1 🗳️ | 3 | 2 | 2 | 4 | **1.8** |
| 8 | Season System (100-Cycle Seasons) | 41 | 0 🗳️ | 4 | 1 | 2 | 4 | **1.8** |
| 9 | Daily Login Bonuses & Seasonal Events | 34 | 0 🗳️ | 3 | 1 | 1 | 3 | **1.7** |
| 10 | Player Personas / Complexity Modes | 16 | 1 🗳️ | 2 | 1 | 2 | 3 | **1.7** |
| 11 | Arena / Terrain Modifiers | 12 | 1 🗳️ | 3 | 1 | 2 | 4 | **1.5** |
| 12 | Battle Table Denormalization Cleanup | 18 | 0 🗳️ | 1 | 1 | 1 | 2 | **1.5** |
| 13 | Tag Team Battle Time Limit Enforcement | 19 | 0 🗳️ | 1 | 1 | 1 | 2 | **1.5** |
| 14 | Historical Financial Tracking | 23 | 0 🗳️ | 1 | 1 | 1 | 2 | **1.5** |
| 15 | 3v3 Team Battles | 31 | 0 🗳️ | 3 | 1 | 1 | 4 | **1.3** |
| 16 | Modular Package Extraction | 35 | 0 🗳️ | 1 | 1 | 2 | 3 | **1.3** |
| 17 | Robot Detail Page Split | 37 | 0 🗳️ | 2 | 1 | 1 | 3 | **1.3** |
| 18 | Achievement Persistence Across Seasons | 40 | 0 🗳️ | 2 | 1 | 1 | 3 | **1.3** |
| 19 | Events Calendar | 43 | 0 🗳️ | 2 | 1 | 1 | 3 | **1.3** |
| 20 | Universal Search / Command Palette | 27 | 0 🗳️ | 2 | 1 | 1 | 3 | **1.3** |
| 21 | Progressive Feature Disclosure | 28 | 0 🗳️ | 2 | 1 | 1 | 3 | **1.3** |
| 22 | Weapon Crafting System | 29 | 0 🗳️ | 3 | 1 | 1 | 5 | **1.0** |
| 23 | Free-for-All / Battle Royale Mode | 30 | 0 🗳️ | 3 | 1 | 1 | 5 | **1.0** |
| 24 | Conditional Battle Triggers / AI Scripting | 32 | 0 🗳️ | 3 | 1 | 1 | 5 | **1.0** |
| 25 | Future Revenue Streams | 33 | 0 🗳️ | 2 | 1 | 1 | 4 | **1.0** |
| 26 | Player Marketplace | 44 | 0 🗳️ | 3 | 1 | 1 | 5 | **1.0** |
| 27 | Social Features (Friends, Guilds, Chat) | 45 | 0 🗳️ | 3 | 1 | 1 | 5 | **1.0** |
| 28 | Prestige Store | 47 | 0 🗳️ | 2 | 1 | 1 | 4 | **1.0** |
| 29 | Blueprint Library | 48 | 0 🗳️ | 1 | 1 | 1 | 3 | **1.0** |
| 30 | Unimplemented Facilities | 7 | 0 🗳️ | 2 | 1 | 1 | 5 | **0.8** |
| 31 | Cosmetic Customization System | 46 | 0 🗳️ | 2 | 1 | 1 | 5 | **0.8** |

### Recently Completed (removed from backlog)

| Item | # | Spec | Completed |
|------|---|------|-----------|
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

1. ~~**Weapon resale** — Sell weapons back at Workshop-level-dependent rates (40–75%). Quality-of-life improvement that reduces switching cost. Workshop gets a second meaningful purpose beyond purchase discounts.~~ ✅ **Shipped May 22, 2026** as [Spec #33](/.kiro/specs/to-do/33-weapon-resale/) — final formula was `level × 10` (0% at L0, 100% at L10), mirroring the purchase discount slope.

2. **Weapon upgrades** — Level individual weapon instances over time (reliability, attribute bonuses, minor damage, unique passives at thresholds). Creates attachment and identity. A fully upgraded cheap weapon could match a stock expensive weapon. Ongoing credit sink that solves late-game economic stagnation. Key design question: should upgrades make weapons *stronger* or *different*? Different is better for diversity.

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

### #7 — Unimplemented Facilities (4 remaining)
**Source**: PRD_FACILITIES_PAGE.md  
**Priority**: Medium — players can buy them but they do nothing

4 of 14 facility types exist in the schema but have no gameplay effect:
- Research Lab — analytics, loadout presets, battle simulation
- Medical Bay — critical damage repair cost reduction (separate from Repair Bay)
- Coaching Staff — stable-wide stat bonuses via hired coaches
- Booking Office — tournament access and prestige rewards

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

### #31 — 3v3 Team Battles
BattleParticipant model already supports N robots. Needs team formation, matchmaking, rewards, orchestrator.

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
