# Backlog — Ideas to Be Specced

Items identified during audits, reviews, and development. Prioritized by impact on player experience and system reliability.

**Priority scale**: High (should spec soon) · Medium (valuable but not blocking) · Low (nice to have) · Not scoped (future idea only)

---

## WSJF Priority Ranking

Based on player poll (April 2026, 16 votes) and backlog analysis. WSJF = (Business Value + Time Criticality + Risk Reduction) / Job Size. Each factor 1–5.

| Rank | Item | # | Votes | BV | TC | RR | Size | WSJF |
|------|------|---|-------|----|----|-----|------|------|
| 1 | Game Loop Audit | 6 | 3 🗳️ | 3 | 4 | 5 | 2 | **6.0** |
| 2 | ~~Facility Investment Advisor~~ | 1 | 1 🗳️ | 4 | 5 | 1 | 2 | **5.0** |
| 3 | Feature Flags | 15 | 1 🗳️ | 2 | 2 | 4 | 2 | **4.0** |
| 4 | ~~Compress Prestige Multiplier Thresholds~~ | 36 | 0 🗳️ | 1 | 1 | 1 | 1 | **3.0** |
| 5 | Landing Page | 4 | 0 🗳️ | 3 | 2 | 1 | 2 | **3.0** |
| 6 | Weapon Experimentation Problem | 5 | 1 🗳️ | 4 | 3 | 4 | 4 | **2.8** |
| 7 | Weapon Special Properties | 11 | 1 🗳️ | 3 | 2 | 2 | 4 | **1.8** |
| 8 | Season System (100-Cycle Seasons) | 41 | 0 🗳️ | 4 | 1 | 2 | 4 | **1.8** |
| 9 | Daily Login Bonuses & Seasonal Events | 34 | 0 🗳️ | 3 | 1 | 1 | 3 | **1.7** |
| 10 | Player Personas / Complexity Modes | 16 | 1 🗳️ | 2 | 1 | 2 | 3 | **1.7** |
| 11 | Arena / Terrain Modifiers | 12 | 1 🗳️ | 3 | 1 | 2 | 4 | **1.5** |
| 12 | 3v3 Team Battles | 31 | 0 🗳️ | 3 | 1 | 1 | 4 | **1.3** |
| 13 | Modular Package Extraction | 35 | 0 🗳️ | 1 | 1 | 2 | 3 | **1.3** |
| 14 | Robot Detail Page Split | 37 | 0 🗳️ | 2 | 1 | 1 | 3 | **1.3** |
| 15 | Achievement Persistence Across Seasons | 40 | 0 🗳️ | 2 | 1 | 1 | 3 | **1.3** |
| 16 | Weapon Crafting System | 29 | 0 🗳️ | 3 | 1 | 1 | 5 | **1.0** |
| 17 | Free-for-All / Battle Royale Mode | 30 | 0 🗳️ | 3 | 1 | 1 | 5 | **1.0** |
| 18 | Conditional Battle Triggers / AI Scripting | 32 | 0 🗳️ | 3 | 1 | 1 | 5 | **1.0** |
| 19 | Future Revenue Streams | 33 | 0 🗳️ | 2 | 1 | 1 | 4 | **1.0** |
| 20 | Unimplemented Facilities | 7 | 0 🗳️ | 2 | 1 | 1 | 5 | **0.8** |

### Recently Completed (removed from backlog)

| Item | # | Spec | Completed |
|------|---|------|-----------|
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


### #1 — ~~Facility Investment Advisor & ROI Calculator~~ ✅ Completed (Spec #30)
**Source**: Known issue  
**Priority**: ~~High — broken feature visible to players~~ → Fixed

The Investments & ROI tab and Investment Advisor tab on the Facilities page have been replaced with a single consolidated "Investment Overview" tab that uses cycle-snapshot-based ROI calculations via the `unifiedFacilityROIService`. See [Spec #30](/.kiro/specs/to-do/30-fix-investment-advisor/) for details.

### #4 — Landing Page / Marketing Front Page
**Source**: Current state — visitors land on a login/register form with no context  
**Priority**: High — first impression for new players

The current front page is just a login and registration module. New visitors have no idea what the game is, how it plays, or why they should sign up. Needs: game concept pitch, screenshots or gameplay preview, feature highlights (4 battle modes, 47 weapons, league system), call-to-action to register.

### #5 — Weapon Experimentation Problem — Players Never Switch Weapons
**Source**: Observed player behavior  
**Priority**: High — core gameplay loop stagnation

Players buy one weapon set and never change. The investment is too high and too permanent — there's no way to sell weapons back, no way to try before you buy, and no partial recovery on a bad purchase. This kills experimentation and makes the 47-weapon catalog feel like a 1-weapon catalog per player.

Possible solutions (not mutually exclusive — spec should evaluate combinations):
- **Weapon resale**: Sell weapons back at a percentage of purchase price (50–70%).
- **Practice Arena weapon trials**: Test-drive any weapon in a no-stakes practice fight before buying.
- **Weapon rental**: Rent a weapon for N battles at a fraction of purchase cost.
- **Weapon exchange/trade-in**: Swap an owned weapon for a different one of similar tier, paying only the price difference.
- **Workshop facility perk**: Higher Workshop levels could unlock better resale rates or free trial battles.

**Deeper issue — baseDamage dominance in the damage formula (discovered during Tuning Bay spec #25):**

The damage formula is `baseDamage × (1 + combatPower × 1.5 / 100) × loadout × weaponControl × stance`. Because `baseDamage` is a flat multiplier and attributes are percentage modifiers, weapon baseDamage is the single most important combat variable — far more impactful than any attribute investment or tuning.

Concrete example: a robot with +15 tuning on ALL 23 stats equipped with a Beam Pistol (baseDamage 5, ₡93K) loses 10/10 practice battles against an ExpertBot with a tier-3 weapon (baseDamage ~12). The 2.4× baseDamage gap overwhelms a +6 attribute advantage on every stat.

This means high-DPS weapons always win, attribute upgrades and tuning have diminishing returns relative to weapon choice, and the 47-weapon catalog effectively reduces to "sort by DPS, buy the best you can afford." The damage formula may need rebalancing.

### #6 — Game Loop Audit — Structural Design Flaws
**Source**: Design review  
**Priority**: High — foundational issues that limit long-term retention  
**Progress**: Loop 1 explored in depth — see [Game Loop 1 Core Loop Exploration](analysis/GAME_LOOP_1_CORE_LOOP_EXPLORATION.md). The Tuning Pool (spec #25) directly addressed the thin "Adjust" step. Weapon Experimentation (#5) is the remaining high-impact fix for Loop 1. Loops 2–6 and missing loops still need exploration.

The game has six identifiable loops, most of which degrade or stall at some point in the player lifecycle.

**Loop 1: Core Loop (Configure → Battle → Results → Adjust)** — ✅ Partially addressed. The Tuning Pool (spec #25) enriches the "Adjust" step with meaningful per-battle decisions. Weapon switching remains economically punished (see #5) — that's the remaining gap. See exploration doc for full analysis and rejected ideas (per-match overrides, stance depth, pre-battle orders).

**Loop 2: Economic Loop (Earn → Invest → Earn More)** — Not explored yet. Breaks in late game — credits accumulate with no meaningful sink once facilities and attributes are maxed.

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

### #20 — Performance Optimization
**Source**: Phase 2 roadmap  
**Priority**: Low — current scale doesn't demand it

Areas to investigate: slow Prisma queries, N+1 in analytics endpoints, pagination on heavy lists, in-memory caching for weapon catalog and facility configs.

### #22 — Promotion/Demotion History Tracking
**Source**: PRD_LEAGUE_SYSTEM.md  
**Priority**: Low — nice for analytics, not player-facing

Track league tier changes over time (PromotionHistory model). Enables progression charts and yo-yo detection.

**Achievement dependency**: The L15 "Ctrl+Z" achievement (get demoted and re-promoted in the same league within 10 cycles) requires this history data. Add L15 to the achievement config once promotion/demotion history is implemented.

### #23 — Historical Financial Tracking
**Source**: PRD_ECONOMY_SYSTEM.md  
**Priority**: Low — cycle snapshots provide basic history already

Dedicated financial trend tracking beyond what CycleSnapshot provides.

### #24 — Dashboard Enhancements
**Source**: PRD_DASHBOARD_PAGE.md  
**Priority**: Low — cosmetic improvements

Tournament wins/trophy display, loading skeletons, notification toasts. If fame cosmetics (titles, visual indicators) are implemented via #8, the dashboard should display them.

### #25 — Battle History URL State Persistence
**Source**: PRD_BATTLE_HISTORY_PAGE.md  
**Priority**: Low — QoL improvement

Persist filter/sort state in URL query params for shareable links and browser navigation.

### #26 — Hall of Records Performance Caching
**Source**: PRD_HALL_OF_RECORDS.md  
**Priority**: Low — only matters at scale

Cache leaderboard queries. Currently queries run on every request.

### #27 — Universal Search / Command Palette (Cmd+K)
**Source**: Deleted navigation analysis doc, backlog triage  
**Priority**: Low → Medium candidate — improves discoverability across the entire app

No global search exists. A universal search bar (header or Cmd+K overlay) querying robots, players, weapons, pages, guide articles, and battle history. Existing infrastructure: `SearchBar` component, guide search index API, admin user search pattern.

### #28 — Progressive Feature Disclosure
**Source**: Deleted navigation analysis doc  
**Priority**: Low — reduces new player overwhelm

Per the [Prestige & Fame Design Exploration](analysis/PRESTIGE_FAME_DESIGN_EXPLORATION.md): prestige-gated feature unlocks were largely rejected. A simple preference toggle (#16) may be more appropriate.

### #39 — League & Tag Team Instance Deep Linking
**Source**: Battle Report Overhaul (spec #26) follow-up  
**Priority**: Low — QoL improvement for battle report navigation

The battle report links to `/league-standings?tier=gold` but can't link to the specific league instance the battle was fought in. Same for tag team standings. League instances use string identifiers (e.g., `gold_1`) not numeric IDs, and the standings pages don't support URL-based instance selection. Fix: add `?instance=gold_1` query param support to LeagueStandingsPage and TagTeamStandingsPage, and include the league instance ID in the battle log API response. Also backfill `tournamentId` on old battle records so tournament links work for historical battles.


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

### #36 — ~~Compress Prestige Multiplier Thresholds~~ → ✅ Smooth Prestige Scaling (Completed May 2026)
**Source**: [Prestige & Fame Design Exploration](analysis/PRESTIGE_FAME_DESIGN_EXPLORATION.md), ACC cycle 35 data  

**Implemented**: Replaced hard threshold tiers with smooth formula `min(1.50, 1 + prestige / 50,000)`. Cap reached at 25,000 prestige (+50%). Scales linearly from 0% at 0 prestige. Consistent with merchandising and streaming formulas. No tiers, no steps — every point of prestige matters.

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
