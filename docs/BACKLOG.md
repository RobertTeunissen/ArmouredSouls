# Backlog — Ideas to Be Specced

Items identified during audits, reviews, and development. Prioritized by impact on player experience and system reliability.

**Priority scale**: High (should spec soon) · Medium (valuable but not blocking) · Low (nice to have) · Not scoped (future idea only)

---

## WSJF Priority Ranking

Based on player poll (April 2026, 16 votes) and backlog analysis. WSJF = (Business Value + Time Criticality + Risk Reduction) / Job Size. Each factor 1–5. Items already in spec queue (#8 Battle Replay, #9 Web Push, #20 Robot Image Upload) excluded.

| Rank | Item | # | Votes | BV | TC | RR | Size | WSJF |
|------|------|---|-------|----|----|-----|------|------|
| 1 | Game Loop Audit | 6 | 3 🗳️ | 3 | 4 | 5 | 2 | **6.0** |
| 2 | Monitoring and Alerting | 3 | 2 🗳️ | 3 | 4 | 4 | 2 | **5.5** |
| 3 | Facility Investment Advisor | 1 | 1 🗳️ | 4 | 5 | 1 | 2 | **5.0** |
| 4 | In-Game Changelog / "What's New" | 17 | 4 🗳️ | 4 | 3 | 2 | 2 | **4.5** |
| 5 | Feature Flags | 15 | 1 🗳️ | 2 | 2 | 4 | 2 | **4.0** |
| 6 | Battle Report Layout Overhaul | 14 | 9 🗳️ | 5 | 3 | 2 | 3 | **3.3** |
| 7 | Achievement / Milestone System | 8 | 3 🗳️ | 4 | 2 | 3 | 3 | **3.0** |
| 8 | Landing Page | 4 | 0 🗳️ | 3 | 2 | 1 | 2 | **3.0** |
| 9 | Weapon Experimentation Problem | 5 | 1 🗳️ | 4 | 3 | 4 | 4 | **2.8** |
| 10 | Flex-Point Attribute Bucket | 9 | 1 🗳️ | 3 | 2 | 3 | 4 | **2.0** |
| 11 | Weapon Special Properties | 11 | 1 🗳️ | 3 | 2 | 2 | 4 | **1.8** |
| 12 | Admin Portal Redesign | 13 | 1 🗳️ | 2 | 1 | 2 | 3 | **1.7** |
| 13 | Player Personas / Complexity Modes | 16 | 1 🗳️ | 2 | 1 | 2 | 3 | **1.7** |
| 14 | Arena / Terrain Modifiers | 12 | 1 🗳️ | 3 | 1 | 2 | 4 | **1.5** |
| 15 | Unimplemented Facilities | 7 | 0 🗳️ | 2 | 1 | 1 | 5 | **0.8** |

### Recommended Build Order

**Tier 1 — Do Now** (next 2–4 weeks): #1 broken feature (~1 week), #6 design audit (parallel), #3 monitoring (lightweight)

**Tier 2 — Build Next** (weeks 4–8): #14 battle report overhaul (9 combined votes — strongest player signal, now includes rewards context from old #10), #17 changelog (~1 week)

**Tier 3 — Plan After** (weeks 8–12): #8 achievements, #15 feature flags, #5 weapon experimentation (needs #6 audit input)

**Tier 4 — Backlog**: Everything else — revisit after Tier 3.

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
- **Disk usage monitoring**: Cron job or agent that alerts (Discord webhook) when disk usage crosses 80%. Would have caught the full-disk condition before it required a hard restart.
- **Post-restart/deploy build verification**: A health check that validates critical modules are loadable and key endpoints respond. PM2 `online` status only means the process started — not that the app is functional.
- **Startup self-test**: On boot, verify that all cron job handlers can resolve their dependencies (especially dynamic imports). Fail loudly at startup rather than silently at 23:00.
- **Log rotation cleanup**: 26+ rotated log files were sitting in `/var/log/armouredsouls/`. More aggressive `logrotate` config to prevent logs from contributing to disk pressure.

### #4 — Landing Page / Marketing Front Page
**Source**: Current state — visitors land on a login/register form with no context  
**Priority**: High — first impression for new players

The current front page is just a login and registration module. New visitors have no idea what the game is, how it plays, or why they should sign up. Needs: game concept pitch, screenshots or gameplay preview, feature highlights (4 battle modes, 47 weapons, league system), call-to-action to register. Could be a simple static page above the login form or a dedicated `/` route that redirects authenticated users to the dashboard.

### #5 — Weapon Experimentation Problem — Players Never Switch Weapons
**Source**: Observed player behavior  
**Priority**: High — core gameplay loop stagnation

Players buy one weapon set and never change. The investment is too high and too permanent — there's no way to sell weapons back, no way to try before you buy, and no partial recovery on a bad purchase. This kills experimentation and makes the 47-weapon catalog feel like a 1-weapon catalog per player. The Player Archetypes Guide already documents this trap (₡700K wasted on wrong weapons with no recourse).

Currently there is no sell/resale mechanic at all. The weapon shop PRD marks rentals as "not planned" and trading as "future Phase 2+".

Possible solutions (not mutually exclusive — spec should evaluate combinations):
- **Weapon resale**: Sell weapons back at a percentage of purchase price (50–70%). Simple, immediate. Risk: too generous and weapons become risk-free; too stingy and nobody uses it.
- **Practice Arena weapon trials**: Let players test-drive any weapon in a no-stakes practice fight before buying. Zero economic risk, high information value. Could tie into the existing Practice Arena system.
- **Weapon rental**: Rent a weapon for N battles at a fraction of purchase cost. Lower commitment, ongoing cost. Previously marked as "not planned" but worth reconsidering given the experimentation problem.
- **Weapon exchange/trade-in**: Swap an owned weapon for a different one of similar tier, paying only the price difference. Reduces switching cost without injecting credits.
- **Workshop facility perk**: Higher Workshop levels could unlock better resale rates or free trial battles, giving the facility more gameplay value.

The fix likely needs both a way to *recover value* from unwanted weapons (resale/trade-in) and a way to *reduce information asymmetry* before purchase (trials/practice). One without the other only half-solves it.

**Deeper issue — baseDamage dominance in the damage formula (discovered during Tuning Bay spec #25):**

The damage formula is `baseDamage × (1 + combatPower × 1.5 / 100) × loadout × weaponControl × stance`. Because `baseDamage` is a flat multiplier and attributes are percentage modifiers, weapon baseDamage is the single most important combat variable — far more impactful than any attribute investment or tuning.

Concrete example: a robot with base attributes at 1 and +15 tuning on ALL 23 stats (effective 16 across the board) equipped with a Beam Pistol (baseDamage 5, ₡93K) loses 10/10 practice battles against an ExpertBot (base attributes 10, no tuning) with a tier-3 weapon (baseDamage ~12). The math:
- Player robot: 5 × (1 + 16×1.5/100) = 5 × 1.24 = **6.2 damage/hit**, 2s cooldown = **3.1 DPS**
- ExpertBot: 12 × (1 + 10×1.5/100) = 12 × 1.15 = **13.8 damage/hit**, 3s cooldown = **4.6 DPS**

The ExpertBot does 48% more DPS despite having 6 fewer points in every attribute. The player's +30% HP advantage (130 vs 100) doesn't compensate. A 2.4× baseDamage difference (+140%) overwhelms a +6 attribute advantage (+22.5% via combatPower).

This means:
- **High-DPS weapons always win** — a ₡200K weapon with baseDamage 12 beats a ₡93K weapon with baseDamage 5 regardless of attribute investment
- **Weapon attribute bonuses are marginally important** — they improve win chances less than the baseDamage/cooldown ratio (DPS)
- **Attribute upgrades and tuning have diminishing returns** relative to weapon choice — spending ₡200K on a better weapon is always more impactful than spending ₡200K on attributes or tuning
- **The 47-weapon catalog effectively reduces to "sort by DPS, buy the best you can afford"** — weapon bonuses, range bands, and special properties are secondary to raw DPS

This reinforces the experimentation problem: not only can't players switch weapons, but the penalty for choosing a low-DPS weapon is so severe that no amount of attribute investment can compensate. The damage formula may need rebalancing to make attributes more impactful relative to baseDamage, or weapon DPS ranges need to be compressed so the gap between budget and premium weapons is smaller.

### #6 — Game Loop Audit — Structural Design Flaws
**Source**: Design review  
**Priority**: High — foundational issues that limit long-term retention

The game has six identifiable loops, most of which degrade or stall at some point in the player lifecycle. This needs a deep design audit before we build more features on top of broken foundations.

**Loop 1: Core Loop (Configure → Battle → Results → Adjust)**
The "Adjust" step is too thin. After viewing results, the only meaningful changes are stance tweaks, yield threshold, and occasional attribute upgrades. Weapon switching is economically punished (see weapon experimentation item). Loadout changes require new weapons. The loop often collapses into: configure once → watch results on repeat. The daily rhythm is sound, but the decision space between cycles is too narrow.

**Loop 2: Economic Loop (Earn → Invest → Earn More)**
Works in early/mid game when upgrade targets are clear. Breaks down in late game — once facilities are maxed and attributes hit academy caps, credits accumulate with no meaningful sink. There's no late-game spending that feels worthwhile. The compounding income from Merchandising Hub and Streaming Studio is well-designed but eventually outpaces all expenses, removing economic tension entirely.

**Loop 3: Competitive Loop (Battle → Earn LP → Promote → Harder Opponents)**
One-dimensional. LP is the only axis. There's no lateral movement — no reason to try a different build once you've found one that climbs. The system rewards optimizing a single strategy, not exploring alternatives. Once a player hits Champion (or their natural ceiling), the loop has nowhere to go. No seasons, no resets, no meta shifts to force adaptation.

**Loop 4: Reputation Loop (Win → Prestige/Fame → Unlock → Win More)**
Prestige gates are functional but invisible. Players earn prestige passively and hit gates they didn't anticipate. There's no "I'm 500 prestige away from unlocking X" moment surfaced in the UI. Fame is even more abstract — it feeds a streaming revenue formula that players never see or understand. The progression *exists* mechanically but players don't *experience* it as progression.

Deep-dive on what prestige and fame should actually do: see [Prestige & Fame Design Exploration](analysis/PRESTIGE_FAME_DESIGN_EXPLORATION.md). Key findings: prestige tier names are cosmetic labels that unlock nothing, fame tiers are also cosmetic, facility prestige gates are the only real unlocks but are situational. The exploration concluded that fame cosmetics (auto-generated titles, visual indicators, signature moves) are the highest-impact direction, and the Achievement System (#8) is the right vehicle for milestone celebrations across both prestige and fame — rather than building a separate milestone system.

**Loop 5: Roster Loop (Buy Robot → Train → Battle → Specialize → Expand)**
Robots don't interact with each other outside Tag Team. No synergy between builds, no stable-wide strategy, no "my roster composition matters." Feels like running parallel instances of the same single-player game. The Coaching Staff facility (designed, not built) would add some stable-wide identity, but even that is just a flat bonus.

**Loop 6: Facility Investment Loop (Spend Now → Save Later)**
Mechanically strong — the ROI math is real. Experientially invisible. Players don't *feel* the savings. There's no "your Repair Bay saved you ₡50K this cycle" feedback. The investment payoff is silent, which means the loop doesn't generate the satisfaction it should.

**Missing loops (not broken — absent entirely):**
- No experimentation loop (no low-risk way to try things)
- No social/rivalry loop (competition is anonymous, no narrative between players)
- No collection/completion loop (47 weapons, zero incentive to own more than 2)
- No seasonal/event loop (every day is identical, no meta variation, no urgency)
- No recovery/comeback loop (losing players fall further behind with no catch-up mechanic)

This item is about diagnosis, not solutions. Needs a proper design deep-dive to understand which loops are most critical to fix first, how they interact, and what the minimum viable changes are to restore engagement at each stage of the player lifecycle.

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

Per the [Prestige & Fame Design Exploration](analysis/PRESTIGE_FAME_DESIGN_EXPLORATION.md): don't force-connect these to prestige/fame milestones. If the original mechanics don't hold up, redesign or scrap them independently. Players have never seen these facilities do anything — there's no expectation to preserve.

### #8 — Achievement / Milestone System
**Source**: PRD_PRESTIGE_AND_FAME.md, PRD_ECONOMY_SYSTEM.md §6  
**Priority**: Medium — key engagement/retention driver

One-time rewards for milestones (ELO thresholds, win counts, streaks). Examples: first robot to ELO 1500 (₡50K + 50 prestige), 100 wins (₡250K + 200 prestige). Needs: database tables, tracking service, UI (dashboard trophies, notification toasts). Includes fame-based cosmetic unlocks as a later extension.

Per the [Prestige & Fame Design Exploration](analysis/PRESTIGE_FAME_DESIGN_EXPLORATION.md): this system is now the recommended vehicle for prestige/fame milestone celebrations — achievements should trigger on prestige thresholds ("Reached 1,000 prestige — Established!"), fame thresholds ("Robot reached Famous tier!"), and combat accomplishments. This means achievements handle the "bar fills, something happens" job for both prestige and fame, rather than building separate milestone systems for each.

### #9 — Flex-Point Attribute Bucket (Pre-Battle Tactical Allocation) — ✅ Specced & Implemented (Spec #25)
**Source**: Player feedback (Tymen, LortGob)  
**Priority**: Medium — directly addresses the thin "Adjust" step in the core loop  
**Status**: Implemented as the **Tuning Pool (Tactical Tuning)** system in [Spec #25](/.kiro/specs/to-do/25-tuning-bay/). The Tuning Bay facility provides a pool of reallocatable bonus attribute points per robot, with pool size scaling from 10 (free) to 110 (L10). See `docs/game-systems/TUNING_BAY_SYSTEM.md` for the full system specification.

Idea: a percentage of a robot's total attribute points (e.g. 20%) becomes a flexible pool that the player can reallocate before each battle depending on the opponent. Fixed attributes stay locked, flex points are assigned per matchup. If you don't allocate them, you fight without — rewarding players who invest time in scouting and preparation.

This solves multiple problems at once:
- Enriches the core loop's "Adjust" step — there's now a meaningful decision between every battle
- Rewards engagement depth (the "show me everything" player archetype benefits most)
- Creates counter-play and opponent reading as a skill
- Doesn't invalidate existing attribute investments — flex points are derived from what you already have

Implementation angle from LortGob: tie it to a facility (new, or repurpose Research Lab). Facility level determines the size of the flex pool (e.g. 5% at level 1, up to 20% at level 10). This avoids disrupting the current season — existing players keep their fixed builds, the flex system layers on top as a new investment. Also creates a meaningful late-game credit sink and a reason to keep upgrading the facility.

Design questions to resolve:
- What's the right percentage range? 20% of total stats is significant — could swing matchups hard
- Per-robot or per-battle allocation? (per-battle is more interesting but more UI work)
- Can you see opponent stats before allocating? (scouting as a prerequisite — ties into Spy Facility idea from Player Personas item)
- How does this interact with Tag Team / KotH where you don't know your exact opponent?
- Does the flex pool come from existing points (weakening your base) or is it bonus points on top?

### #11 — Weapon Special Properties
**Source**: PRD_WEAPON_ECONOMY.md, PRD_WEAPONS_LOADOUT.md  
**Priority**: Medium — would significantly deepen combat strategy

All 47 weapons currently have only attribute bonuses — no special effects. The pricing formula and combat simulator are designed to support properties like "ignores armor", "shield drain", "area damage" but none are implemented. Requires combat simulator changes and balance testing.

### #12 — Arena / Terrain Modifiers with Home Arena Selection
**Source**: Player idea  
**Priority**: Medium — adds meta variation and per-battle decision-making

Battles take place in a randomly assigned arena, each with gameplay modifiers (e.g. "corrosive atmosphere: -15% armor effectiveness", "magnetic field: +10% shield regen", "tight quarters: melee range bonus", "open plains: long-range advantage"). Players can choose a preferred "home arena" for their robot or stable, which gives a slight familiarity bonus when drawn — but also means opponents can scout your preference and build against it.

What this solves:
- Injects variety into the daily loop — same matchup plays differently on different terrain
- Creates a new axis of strategy (build for your home arena vs build generalist)
- Feeds the scouting/intel angle (Spy Facility could reveal opponent's home arena)
- Natural content drip — new arenas can be added over time as meta-shifting events
- Addresses the "every day is identical" problem from the game loop audit

The `ArenaConfig` type already exists in the combat simulator for KotH (geometry, radius, zones) but has no gameplay modifiers — this would extend it.

Design questions:
- How many arenas? Start small (5–8) or go wide?
- How strong should modifiers be? Subtle nudges (5%) or build-defining (20%+)?
- Home arena per robot or per stable?
- Does home arena cost credits to set/change? (another facility tie-in?)
- How does this interact with Tag Team and KotH which already have arena configs?

### #13 — Admin Portal Redesign / Separate Admin App
**Source**: Backlog triage  
**Priority**: Medium — admin tooling is scattered across the main app

The admin experience currently lives as routes within the player-facing app. As admin features grow (security dashboard, cycle management, user management, feature toggles), it makes sense to either redesign the admin section with its own layout/navigation or extract it into a separate portal entirely. A separate app would allow independent deployment, stricter access controls, and a purpose-built UI without bloating the player bundle.

### #14 — Battle Report Layout Overhaul
**Source**: Backlog triage, PRD_BATTLE_RESULTS_PAGE.md (deleted)  
**Priority**: Medium — current layout undersells the combat data and hides economic context

The existing Battle Detail page shows the data but the layout doesn't do it justice. Redesign the battle report with better visual hierarchy: timeline visualization, damage flow diagrams, round-by-round breakdown with animations or transitions, weapon effectiveness highlights.

**Rewards & economic context** (folded in from deleted #10 — Battle Detail Progression Context):
The page already shows credits, prestige, fame, and streaming revenue per robot, but the economic context is missing. Specifically:
- **Credit reward breakdown**: Split total credits into base reward + prestige bonus component (e.g. "₡25,000 = ₡20,000 base + ₡5,000 prestige bonus (+10%)"). `getPrestigeMultiplier()` already calculates this but it's not surfaced.
- **Prestige/fame on CompactBattleCard**: The Battle History list view shows ELO change and credits but not prestige/fame earned. Adding small indicators lets players scan reputation impact without clicking into each battle. Data already available from `BattleParticipant`.
- Design colors: Prestige `#a371f7` (purple), Fame `#58a6ff` (cyan-blue).
- Accessibility: ARIA labels on any progress elements, color-blind friendly indicators (not color-only).

Note: prestige/fame *progression bars* were considered and rejected — prestige tier names are cosmetic leaderboard labels that unlock nothing, fame tiers are also cosmetic, and facility prestige gates are only relevant to players actively upgrading that specific facility. The only universally relevant prestige thresholds are the battle winnings bonus tiers (1K/5K/10K/25K/50K), which are too thin to justify a progression UI. Meaningful prestige/fame milestones need to be *designed first* (see Game Loop Audit #6 and the open design question about what prestige and fame should actually do) before building display for them.

**Battle log verbosity levels**: Players have asked for more detail in combat events. Two modes:
- **Shorthand** (current): `"Dikke Aap missed"`
- **Verbose**: `"Dikke Aap missed (76% hit chance — Combat Power 34 vs Evasion Thrusters 28)"`

Verbose mode would show the underlying formula inputs: hit chance percentages, which attributes drove the outcome, damage breakdowns with armor/penetration values, crit chance on critical hits, etc. Ties into the Player Personas / Complexity Modes item (#16) — verbose mode is exactly what the "show me everything" player wants, while shorthand suits the "just let me fight" player.

Per the [Prestige & Fame Design Exploration](analysis/PRESTIGE_FAME_DESIGN_EXPLORATION.md): verbose mode was considered as a prestige-gated unlock but the gating question is unresolved — it may depend on player *type* (preference toggle) rather than experience level (prestige threshold). See open question #1 in that doc.

### #15 — Feature Flags / Per-User Feature Rollout
**Source**: Backlog triage  
**Priority**: Medium — enables safer releases and A/B testing

Add a feature toggle system manageable from the admin portal. Flags can be global (on/off), percentage-based (roll out to 10% of users), or per-user/per-role. Enables: gradual rollout of new features, A/B testing gameplay changes, kill switches for problematic features, beta access for specific users. Needs: flags table, middleware/hook to check flags, admin UI to manage them, frontend context/hook to gate UI components.

### #16 — Player Personas / Complexity Modes
**Source**: Backlog triage  
**Priority**: Medium — different players want fundamentally different experiences

Not all players want the same depth. Two archetypes: the "just let me fight" player who wants streamlined combat with minimal management, and the "show me everything" player who wants full stat transparency, detailed analytics, and granular control. Possible approaches: a complexity toggle in settings that shows/hides advanced panels, or tie it to a facility — e.g. a "Spy Facility" that progressively unlocks deeper analytics and opponent intel as it levels up (fits the existing facility progression model). The Spy Facility angle would give the transparency a gameplay cost, making it a strategic choice rather than just a UI preference. Cross-ref: "Progressive Feature Disclosure" (#28) covers time-gated unlocks — this is about *player-chosen* depth. Also relates to "Unimplemented Facilities" (#7) if the Spy Facility route is taken.

Per the [Prestige & Fame Design Exploration](analysis/PRESTIGE_FAME_DESIGN_EXPLORATION.md): the verbose combat log (see #14) is the most concrete expression of this item. The exploration found that gating depth by prestige doesn't work well — it depends on player type, not experience. A preference toggle may be the right approach, which simplifies this from a game system into a UI setting.

### #17 — In-Game Changelog / "What's New" Component
**Source**: Player communication need  
**Priority**: Medium — players miss updates that directly affect their strategy

When players log in, show them meaningful game updates: balance changes, new features, bug fixes that affect gameplay. Currently there's no in-game communication channel — players only find out about changes if they happen to notice or hear about it in Discord.

Should be as automated as possible. Ideal flow: developer writes a short changelog entry (or it's generated from deploy/release notes), tagged with categories (balance, feature, bugfix, economy). On login, players see a dismissable modal or sidebar with unread updates since their last visit. Each entry explains what changed and how it impacts them — not just "fixed bug #1234" but "Repair Bay discount now correctly applies to all robots in your stable."

Could tie into the Feature Flags system (#14) — when a feature is toggled on for a player, auto-generate a "What's New" entry for them. Also relevant for balance changes (weapon damage adjustments, economy tweaks) where players need to know their builds may be affected.

Design considerations:
- Where does changelog content live? Markdown files in the repo, a DB table, or a CMS?
- How granular? Per-deploy, per-feature, or curated batches?
- Dismissal tracking — per-user "last seen changelog" timestamp vs per-entry read state?
- Can it surface personalized impact? ("You own a Plasma Cannon — its damage was adjusted by -5%")

---

## Low Priority

### #18 — Battle Table Denormalization Cleanup
**Source**: [Battle Execution Audit](analysis/BATTLE_EXECUTION_AUDIT.md)  
**Priority**: Low — works correctly, just redundant data

The `Battle` table dual-writes per-robot columns alongside `BattleParticipant`. Consider a migration to drop legacy columns and fully rely on `BattleParticipant`.

### #19 — Tag Team Battle Time Limit Enforcement
**Source**: [Battle Execution Audit](analysis/BATTLE_EXECUTION_AUDIT.md)  
**Priority**: Low — stored duration is correct, only simulation overruns

Tag team battles can theoretically exceed 300s because each phase has its own 120s cap. Fix by passing `remainingTime` to `simulateBattle()`.

### #20 — Performance Optimization
**Source**: Phase 2 roadmap  
**Priority**: Low — current scale doesn't demand it

Areas to investigate: slow Prisma queries, N+1 in analytics endpoints, pagination on heavy lists, in-memory caching for weapon catalog and facility configs.

### #21 — Prestige Gating for Facilities
**Source**: PRD_FACILITIES_PAGE.md §6, PRD_PRESTIGE_AND_FAME.md  
**Priority**: Low — ✅ already implemented and enforced

Facility upgrades gated by prestige level are already enforced in `routes/facility.ts` with thresholds defined in `config/facilities.ts`. The UI shows lock indicators on the Facilities page. This item can be closed.

Per the [Prestige & Fame Design Exploration](analysis/PRESTIGE_FAME_DESIGN_EXPLORATION.md): these gates are the only real prestige unlocks, but they're situational — only relevant when a player is actively trying to upgrade a specific facility. They stay as-is.

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

Enhanced prestige display (rank tiers, progress bar), tournament wins/trophy display, loading skeletons, notification toasts.

Note: prestige progress bars toward tier names were evaluated and rejected in the [Prestige & Fame Design Exploration](analysis/PRESTIGE_FAME_DESIGN_EXPLORATION.md) — tier names are cosmetic labels that unlock nothing. If fame cosmetics (titles, visual indicators) are implemented, the dashboard should display them, but progress bars toward arbitrary thresholds are not worth building until those thresholds mean something.

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

No global search exists. Players can't search for a robot by name, find another player's stable, look up a weapon, or jump to a specific page without navigating manually. The only search inputs are page-local filters (battle history, admin user lookup, guide articles).

A universal search bar (header or Cmd+K overlay) that queries across:
- **Robots** — by name, owner, league tier
- **Players/Stables** — by username
- **Weapons** — by name, type, tier
- **Pages** — fuzzy match on page names and sections
- **Guide articles** — already has a search index (`/api/guide/search-index`)
- **Battle history** — by robot names, battle ID

Implementation options:
- **Simple**: Single search input in the header, backend `/api/search?q=...` endpoint that queries multiple tables with `ILIKE` and returns categorized results. Frontend renders grouped results (robots, players, weapons, pages).
- **Power user**: Cmd+K modal with keyboard navigation, recent searches, and type-ahead. More effort but better UX for engaged players.
- **Hybrid**: Start with the header search bar, add Cmd+K shortcut later.

Existing infrastructure to leverage:
- `SearchBar` component already exists (`app/frontend/src/components/SearchBar.tsx`)
- Guide search index API already built
- Admin user search endpoint pattern (`/api/admin/users/search`) can be generalized

Could pair with the In-Game Changelog (#17) — search should also surface changelog entries so players can find "what changed about X."

### #28 — Progressive Feature Disclosure
**Source**: Deleted navigation analysis doc  
**Priority**: Low — reduces new player overwhelm

Unlock advanced features based on prestige level or activity milestones.

Per the [Prestige & Fame Design Exploration](analysis/PRESTIGE_FAME_DESIGN_EXPLORATION.md): prestige-gated feature unlocks were largely rejected — most proposed unlocks either already exist (opponent battle history is public), don't work with current game mechanics (loadout presets, conditional stances), or depend on player type rather than experience level (verbose combat log). A simple preference toggle (#16) may be more appropriate than prestige-gated disclosure for most cases.

---

## Not Scoped (Future Ideas)

### #29 — Weapon Crafting System
**Source**: PRD_WEAPONS_LOADOUT.md, PRD_ECONOMY_SYSTEM.md  
Custom weapon design at Workshop Level 6+. Pricing formula already supports it. Legendary crafting at Level 10.

### #30 — Free-for-All / Battle Royale Mode
**Source**: [Design analysis](analysis/FREE_FOR_ALL_BATTLE_ROYALE_MODE.md)  
Large-scale elimination (8–100 robots). Detailed design analysis exists covering arena scaling, shrinking boundary, vulture problem, performance.

### #31 — 3v3 Team Battles
**Source**: Roadmap Phase 9  
BattleParticipant model already supports N robots. Needs team formation, matchmaking, rewards, orchestrator.

### #32 — Conditional Battle Triggers / Robot AI Scripting
**Source**: GAME_DESIGN.md  
Player-defined robot behaviors: "switch stance when HP < 30%", "target weakest in KotH". Requires scripting or rule-builder UI.

### #33 — Future Revenue Streams
**Source**: PRD_ECONOMY_SYSTEM.md §7  
Trading commission (marketplace), sponsorship deals, arena attendance, championship bonuses, daily login bonuses.

### #34 — Daily Login Bonuses & Seasonal Events
**Source**: PRD_ECONOMY_SYSTEM.md, GAME_DESIGN.md  
Consecutive login rewards, limited-time challenges, end-of-season league placement rewards.

### #35 — Modular Package Extraction
**Source**: Deleted migration strategy docs  
npm workspace extraction. Only relevant when multiple consumers need shared backend logic (mobile app, separate battle server, team scaling).

### #36 — Convert Battle Winnings Bonus to Smooth Scaling
**Source**: [Prestige & Fame Design Exploration](analysis/PRESTIGE_FAME_DESIGN_EXPLORATION.md)  
**Priority**: Low — small code change, independent of everything else

`getPrestigeMultiplier()` in `utils/economyCalculations.ts` uses hard thresholds (+10% at 1K, +20% at 5K, etc.) while merchandising and streaming revenue scale smoothly. No design reason for the inconsistency. Convert to a smooth formula like `1 + prestige/100,000` (gives +1% at 1K, +5% at 5K, +10% at 10K, +50% at 50K — same ballpark). Update tests in `economyCalculations.test.ts` and `incomeMultipliers.test.ts`. Also remove `getNextPrestigeTier()` which only exists to support the threshold display.

### #37 — Robot Detail Page Split: Review vs Prepare / Stable Preparation Dashboard
**Source**: Tuning Pool spec discussion (spec #25)  
**Priority**: Low — UX concern that grows with feature count

The Robot Detail page serves two distinct player intents that are currently mixed in one flat tab bar:

**Review (looking back)**: Overview/rankings, Matches, Analytics — "how did my robot perform?"  
**Prepare (looking forward)**: Upgrades, Tuning, Battle Config, Stats — "how do I set up my robot for the next fight?"

With the Tuning tab (spec #25), the page grows to 7 tabs. The two intents are served at different moments — checking results after a cycle vs preparing before the next battle — but the UI doesn't distinguish them.

**Short-term option**: Visual tab grouping — split the tab bar into two labeled sections (📊 Review | ⚙️ Prepare) with a subtle divider. No navigation change, just visual clarity. Could be done as a CSS/layout change to TabNavigation.

**Longer-term question**: Which concerns belong at stable level vs robot level?

- **Stable level** (managed once, applies to all robots): Tuning Bay facility level, upcoming matches across all robots, stable-wide analytics, roster performance comparison, facility management.
- **Robot level** (managed per-robot): Tuning point allocation, weapon loadout, stance/yield, attribute upgrades, individual battle history.

The tuning pool highlights this tension: the pool size is stable-level (facility), but allocation is per-robot. A player with 4 robots visits 4 separate pages to prepare for a cycle. A **Stable Preparation Dashboard** — a single page showing all robots' upcoming matches with inline tuning/stance controls — would reduce this friction. Think of it as the manager's desk: prepare the whole team from one view.

This becomes more valuable as the game adds features that require per-robot preparation (tuning pool, potential future conditional stances, weapon swaps). Not urgent with ~10 players and 1–4 robots each, but worth designing before the robot detail page becomes unmanageable.

Related: Robot Detail Page tab reorder is handled in spec #25 task 8.2.
