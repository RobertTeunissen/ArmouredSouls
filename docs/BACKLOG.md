# Backlog — Ideas to Be Specced

Items identified during audits, reviews, and development. Prioritized by impact on player experience and system reliability.

**Priority scale**: High (should spec soon) · Medium (valuable but not blocking) · Low (nice to have) · Not scoped (future idea only)

---

## WSJF Priority Ranking

Based on player poll (April 2026, 16 votes) and backlog analysis. WSJF = (Business Value + Time Criticality + Risk Reduction) / Job Size. Each factor 1–5.

| Rank | Item | # | Votes | BV | TC | RR | Size | WSJF |
|------|------|---|-------|----|----|-----|------|------|
| 1 | Game Loop Audit | 6 | 3 🗳️ | 3 | 4 | 5 | 2 | **6.0** |
| 2 | Facility Investment Advisor | 1 | 1 🗳️ | 4 | 5 | 1 | 2 | **5.0** |
| 3 | Feature Flags | 15 | 1 🗳️ | 2 | 2 | 4 | 2 | **4.0** |
| 4 | Compress Prestige Multiplier Thresholds | 36 | 0 🗳️ | 1 | 1 | 1 | 1 | **3.0** |
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
| Monitoring and Alerting | 3 | [Spec #29](/.kiro/specs/to-do/29-monitoring-and-alerting/) | May 2026 |
| Admin Portal Redesign | 13 | [Spec #28](/.kiro/specs/done-april26/28-admin-portal-redesign/) | April 2026 |
| Admin Tuning Adoption Dashboard | 38 | [Spec #28](/.kiro/specs/done-april26/28-admin-portal-redesign/) | April 2026 |
| Achievement / Milestone System | 8 | [Spec #27](/.kiro/specs/done-april26/27-achievement-system/) | April 2026 |
| In-Game Changelog / "What's New" | 17 | [Spec #24](/.kiro/specs/done-april26/24-in-game-changelog/) | April 2026 |
| Tuning Pool (Tactical Tuning) | 9 | [Spec #25](/.kiro/specs/done-april26/25-tuning-bay/) | April 2026 |
| Battle Report Layout Overhaul | 14 | [Spec #26](/.kiro/specs/done-april26/26-battle-report-overhaul/) | April 2026 |
| Prestige Gating for Facilities | 21 | — (already implemented) | Pre-backlog |

---


### #1 — Facility Investment Advisor & ROI Calculator
**Source**: Known issue  
**Priority**: High — broken feature visible to players

The Investments & ROI tab and Investment Advisor tab on the Facilities page are not working as intended. The consolidation from the old pages was structural only — the data isn't flowing correctly. Players see empty or wrong numbers.

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

### #36 — Compress Prestige Multiplier Thresholds
**Source**: [Prestige & Fame Design Exploration](analysis/PRESTIGE_FAME_DESIGN_EXPLORATION.md), ACC cycle 35 data  

The original idea was to convert `getPrestigeMultiplier()` to a smooth formula (`1 + prestige/100,000`), but analysis showed this would nerf mid-game players heavily (+10% → +2% at 2K prestige) and remove the cap, causing runaway late-game scaling.

**The real problem is threshold spacing vs. actual prestige velocity.** On ACC at cycle 35, the top 10 players sit at 2K–3K prestige. Best robots earn ~25 prestige/day from battles, and achievement prestige is largely exhausted. At this rate the 5K tier is months away, and 10K+ tiers are effectively unreachable (years). The upper tiers are dead content — no player will experience them.

**Proposed fix — compress thresholds to match actual prestige economy:**

| Tier | Current Threshold | Proposed | Bonus |
|------|------------------|----------|-------|
| Established | 1,000 | 1,000 | +10% |
| Veteran | 5,000 | 2,500 | +20% |
| Elite | 10,000 | 5,000 | +30% |
| Champion | 25,000 | 10,000 | +40% |
| Legendary | 50,000 | 20,000 | +50% |

This makes the next tier reachable (~80 days for a top player at 3K → 5K) while keeping the cap aspirational (~680 days to 20K). Small code change in `getPrestigeMultiplier()` and `getNextPrestigeTier()`.

**Consideration**: Compressing thresholds buffs current top players immediately (3K prestige jumps from +10% to +20%). Evaluate economic impact on battle winnings income before applying.

### #37 — Robot Detail Page Split: Review vs Prepare / Stable Preparation Dashboard
**Source**: Tuning Pool spec discussion (spec #25)  

The Robot Detail page serves two distinct intents (Review: Overview/Matches/Analytics vs Prepare: Upgrades/Tuning/Battle Config/Stats). With 7 tabs, consider visual tab grouping or a Stable Preparation Dashboard for managing all robots from one view.

### #41 — Season System (100-Cycle Competitive Seasons)
**Source**: Game Loop Audit (#6) — Loop 3 (Competitive Loop) has no resets, meta shifts, or seasonal structure  
**Priority**: Not scoped — planned for after current high-priority items

100-cycle (100-day) seasons with LP soft-reset, end-of-season placement rewards, fresh leaderboards, and a visible countdown. Gives every player a reason to engage every cycle and makes the competitive loop feel alive instead of LP oscillating ±1 around a stable point.

**Design considerations:**
- LP soft-reset at season boundary (partial reset, not full wipe — preserve skill signal)
- End-of-season rewards based on final tier/placement (credits, prestige, cosmetics)
- Season history / archive (past season standings viewable)
- Possible per-season meta shift (featured arena modifier, weapon category bonus) to force adaptation
- Achievement system already designed with seasons in mind (#40 covers persistence question)
- Promotion/demotion history (#22) would enhance season-over-season progression tracking

**Dependencies**: #40 (achievement persistence decision), possibly #22 (promotion history).

### #40 — Achievement Persistence Across Seasons
**Source**: Achievement System spec (#27) discussion  
**Priority**: Not scoped — depends on season system design

When a season system is introduced, decide what happens to achievements: do they persist permanently (lifetime collection), reset each season (seasonal grind), or split into permanent and seasonal categories? The `UserAchievement` table currently has no season reference. Options include adding a `seasonId` column, creating a separate `SeasonalAchievement` table, or keeping achievements entirely outside the season reset scope. This decision should be made as part of the season system design, not retroactively bolted onto achievements.
