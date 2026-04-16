# Backlog — Ideas to Be Specced

Items identified during audits, reviews, and development. Prioritized by impact on player experience and system reliability.

**Priority scale**: High (should spec soon) · Medium (valuable but not blocking) · Low (nice to have) · Not scoped (future idea only)

---

## WSJF Priority Ranking

Based on player poll (April 2026, 16 votes) and backlog analysis. WSJF = (Business Value + Time Criticality + Risk Reduction) / Job Size. Each factor 1–5.

| Rank | Item | # | Votes | BV | TC | RR | Size | WSJF |
|------|------|---|-------|----|----|-----|------|------|
| 1 | Game Loop Audit | 6 | 3 🗳️ | 3 | 4 | 5 | 2 | **6.0** |
| 2 | Monitoring and Alerting | 3 | 2 🗳️ | 3 | 4 | 4 | 2 | **5.5** |
| 3 | Facility Investment Advisor | 1 | 1 🗳️ | 4 | 5 | 1 | 2 | **5.0** |
| 4 | Admin Tuning Adoption Dashboard | 38 | — | 2 | 2 | 1 | 1 | **5.0** |
| 5 | Feature Flags | 15 | 1 🗳️ | 2 | 2 | 4 | 2 | **4.0** |
| 6 | Battle Report Layout Overhaul | 14 | 9 🗳️ | 5 | 3 | 2 | 3 | **3.3** |
| 7 | Achievement / Milestone System | 8 | 3 🗳️ | 4 | 2 | 3 | 3 | **3.0** |
| 8 | Landing Page | 4 | 0 🗳️ | 3 | 2 | 1 | 2 | **3.0** |
| 9 | Weapon Experimentation Problem | 5 | 1 🗳️ | 4 | 3 | 4 | 4 | **2.8** |
| 10 | Weapon Special Properties | 11 | 1 🗳️ | 3 | 2 | 2 | 4 | **1.8** |
| 11 | Admin Portal Redesign | 13 | 1 🗳️ | 2 | 1 | 2 | 3 | **1.7** |
| 12 | Player Personas / Complexity Modes | 16 | 1 🗳️ | 2 | 1 | 2 | 3 | **1.7** |
| 13 | Arena / Terrain Modifiers | 12 | 1 🗳️ | 3 | 1 | 2 | 4 | **1.5** |
| 14 | Unimplemented Facilities | 7 | 0 🗳️ | 2 | 1 | 1 | 5 | **0.8** |

### Recommended Build Order

**Tier 1 — Do Now** (next 2–4 weeks): #1 broken feature (~1 week), #6 design audit (parallel), #3 monitoring (lightweight)

**Tier 2 — Build Next** (weeks 4–8): #14 battle report overhaul (9 combined votes — strongest player signal), #38 admin tuning dashboard (small, quick win)

**Tier 3 — Plan After** (weeks 8–12): #8 achievements, #15 feature flags, #5 weapon experimentation (needs #6 audit input)

**Tier 4 — Backlog**: Everything else — revisit after Tier 3.

### Recently Completed (removed from backlog)

| Item | # | Spec | Completed |
|------|---|------|-----------|
| In-Game Changelog / "What's New" | 17 | [Spec #24](/.kiro/specs/done-april26/24-in-game-changelog/) | April 2026 |
| Tuning Pool (Tactical Tuning) | 9 | [Spec #25](/.kiro/specs/done-april26/25-tuning-bay/) | April 2026 |
| Prestige Gating for Facilities | 21 | — (already implemented) | Pre-backlog |

---

## High Priority

### #1 — Facility Investment Advisor & ROI Calculator
**Source**: Known issue  
**Priority**: High — broken feature visible to players

The Investments & ROI tab and Investment Advisor tab on the Facilities page are not working as intended. The consolidation from the old pages was structural only — the data isn't flowing correctly. Players see empty or wrong numbers.

### #3 — Monitoring and Alerting
**Source**: Phase 2 roadmap  
**Priority**: High — no way to know if production breaks

Current observability: Winston logs, `CyclePerformanceMonitoringService`, `securityMonitor`, admin Security Dashboard. Missing: external uptime monitoring, alerting on backend crashes or cycle failures, log aggregation. Lightweight approach: UptimeRobot for uptime, Discord webhook for cycle failures (notification service already supports Discord).

**Incident — April 2026 (ACC)**: Full-disk condition during robot image feature launch required a hard VPS restart. The restart left a partial `dist/` build (entire `utils/` directory missing). The server appeared healthy (PM2 status: online) but the daily settlement cron failed at 23:00 UTC with `Cannot find module '../../utils/economyCalculations'`. The error was only discovered the next morning via a Discord notification. Root causes: (1) no disk usage alerting, (2) no post-restart build verification, (3) dynamic `import()` in settlement allowed the server to start despite missing modules.

Specific gaps this exposed — should be addressed in the spec:
- **Disk usage monitoring**: Cron job or agent that alerts (Discord webhook) when disk usage crosses 80%.
- **Post-restart/deploy build verification**: A health check that validates critical modules are loadable and key endpoints respond.
- **Startup self-test**: On boot, verify that all cron job handlers can resolve their dependencies (especially dynamic imports).
- **Log rotation cleanup**: More aggressive `logrotate` config to prevent logs from contributing to disk pressure.

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

The game has six identifiable loops, most of which degrade or stall at some point in the player lifecycle. This needs a deep design audit before we build more features on top of broken foundations.

**Loop 1: Core Loop (Configure → Battle → Results → Adjust)** — The "Adjust" step was too thin; the Tuning Pool (spec #25) enriches it with meaningful per-battle decisions. Weapon switching remains economically punished (see #5).

**Loop 2: Economic Loop (Earn → Invest → Earn More)** — Works early/mid game. Breaks in late game — credits accumulate with no meaningful sink once facilities and attributes are maxed.

**Loop 3: Competitive Loop (Battle → Earn LP → Promote → Harder Opponents)** — One-dimensional. No lateral movement, no reason to try different builds. No seasons, resets, or meta shifts.

**Loop 4: Reputation Loop (Win → Prestige/Fame → Unlock → Win More)** — Prestige gates are functional but invisible. Fame feeds a streaming formula players never see. See [Prestige & Fame Design Exploration](analysis/PRESTIGE_FAME_DESIGN_EXPLORATION.md).

**Loop 5: Roster Loop (Buy Robot → Train → Battle → Specialize → Expand)** — Robots don't interact outside Tag Team. No synergy, no stable-wide strategy.

**Loop 6: Facility Investment Loop (Spend Now → Save Later)** — Mechanically strong, experientially invisible. No "your Repair Bay saved you ₡50K this cycle" feedback.

**Missing loops**: experimentation, social/rivalry, collection/completion, seasonal/event, recovery/comeback.

---

## Medium Priority

### #7 — Unimplemented Facilities (4 remaining)
**Source**: PRD_FACILITIES_PAGE.md  
**Priority**: Medium — players can buy them but they do nothing

4 of 14 facility types exist in the schema but have no gameplay effect:
- Research Lab — analytics, loadout presets, battle simulation
- Medical Bay — critical damage repair cost reduction (separate from Repair Bay)
- Coaching Staff — stable-wide stat bonuses via hired coaches
- Booking Office — tournament access and prestige rewards

### #8 — Achievement / Milestone System
**Source**: PRD_PRESTIGE_AND_FAME.md, PRD_ECONOMY_SYSTEM.md §6  
**Priority**: Medium — key engagement/retention driver

One-time rewards for milestones (ELO thresholds, win counts, streaks). Includes fame-based cosmetic unlocks as a later extension. Per the [Prestige & Fame Design Exploration](analysis/PRESTIGE_FAME_DESIGN_EXPLORATION.md): this is the recommended vehicle for prestige/fame milestone celebrations.

### #11 — Weapon Special Properties
**Source**: PRD_WEAPON_ECONOMY.md, PRD_WEAPONS_LOADOUT.md  
**Priority**: Medium — would significantly deepen combat strategy

All 47 weapons currently have only attribute bonuses — no special effects. The pricing formula and combat simulator are designed to support properties like "ignores armor", "shield drain", "area damage" but none are implemented.

### #12 — Arena / Terrain Modifiers with Home Arena Selection
**Source**: Player idea  
**Priority**: Medium — adds meta variation and per-battle decision-making

Battles take place in a randomly assigned arena with gameplay modifiers (e.g. "corrosive atmosphere: -15% armor effectiveness"). Players choose a preferred "home arena" for a familiarity bonus. The `ArenaConfig` type already exists in the combat simulator for KotH but has no gameplay modifiers.

### #13 — Admin Portal Redesign / Separate Admin App
**Source**: Backlog triage  
**Priority**: Medium — admin tooling is scattered across the main app

The admin experience currently lives as routes within the player-facing app. As admin features grow, it makes sense to either redesign the admin section with its own layout/navigation or extract it into a separate portal entirely.

### #38 — Admin Tuning Adoption Dashboard
**Source**: Tuning Bay feature (spec #25)  
**Priority**: Medium — admin visibility into feature adoption

Add an admin view showing which players/robots have configured their tuning allocations and which haven't. Per-player summary, per-robot detail, aggregate adoption stats, filters. Feeds into broader admin analytics (#13).

### #14 — Battle Report Layout Overhaul
**Source**: Backlog triage  
**Priority**: Medium — current layout undersells the combat data and hides economic context

Redesign the battle report with better visual hierarchy: timeline visualization, damage flow diagrams, round-by-round breakdown. Includes credit reward breakdown (base + prestige bonus), prestige/fame on CompactBattleCard, and battle log verbosity levels (shorthand vs verbose showing formula inputs).

### #15 — Feature Flags / Per-User Feature Rollout
**Source**: Backlog triage  
**Priority**: Medium — enables safer releases and A/B testing

Add a feature toggle system manageable from the admin portal. Flags can be global, percentage-based, or per-user/per-role.

### #16 — Player Personas / Complexity Modes
**Source**: Backlog triage  
**Priority**: Medium — different players want fundamentally different experiences

Two archetypes: "just let me fight" vs "show me everything." Per the [Prestige & Fame Design Exploration](analysis/PRESTIGE_FAME_DESIGN_EXPLORATION.md): gating depth by prestige doesn't work — a preference toggle may be the right approach.

---

## Low Priority

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

---

## Not Scoped (Future Ideas)

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

### #36 — Convert Battle Winnings Bonus to Smooth Scaling
**Source**: [Prestige & Fame Design Exploration](analysis/PRESTIGE_FAME_DESIGN_EXPLORATION.md)  

`getPrestigeMultiplier()` uses hard thresholds while other formulas scale smoothly. Convert to a smooth formula like `1 + prestige/100,000`. Small code change.

### #37 — Robot Detail Page Split: Review vs Prepare / Stable Preparation Dashboard
**Source**: Tuning Pool spec discussion (spec #25)  

The Robot Detail page serves two distinct intents (Review: Overview/Matches/Analytics vs Prepare: Upgrades/Tuning/Battle Config/Stats). With 7 tabs, consider visual tab grouping or a Stable Preparation Dashboard for managing all robots from one view.
