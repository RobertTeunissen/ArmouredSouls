# Backlog — Ideas to Be Specced

Items identified during audits, reviews, and development. Prioritized by impact on player experience and system reliability.

**Priority scale**: High (should spec soon) · Medium (valuable but not blocking) · Low (nice to have) · Not scoped (future idea only)

---

## High Priority

### #1 — Facility Investment Advisor & ROI Calculator
**Source**: Known issue  
**Priority**: High — broken feature visible to players

The Investments & ROI tab and Investment Advisor tab on the Facilities page are not working as intended. The consolidation from the old pages was structural only — the data isn't flowing correctly. Players see empty or wrong numbers.

### #2 — Monitoring and Alerting
**Source**: Phase 2 roadmap  
**Priority**: High — no way to know if production breaks

Current observability: Winston logs, `CyclePerformanceMonitoringService`, `securityMonitor`, admin Security Dashboard. Missing: external uptime monitoring, alerting on backend crashes or cycle failures, log aggregation. Lightweight approach: UptimeRobot for uptime, Discord webhook for cycle failures (notification service already supports Discord).

### #3 — Landing Page / Marketing Front Page
**Source**: Current state — visitors land on a login/register form with no context  
**Priority**: High — first impression for new players

The current front page is just a login and registration module. New visitors have no idea what the game is, how it plays, or why they should sign up. Needs: game concept pitch, screenshots or gameplay preview, feature highlights (4 battle modes, 47 weapons, league system), call-to-action to register. Could be a simple static page above the login form or a dedicated `/` route that redirects authenticated users to the dashboard.

### #4 — Weapon Experimentation Problem — Players Never Switch Weapons
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

### #5 — Game Loop Audit — Structural Design Flaws
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

### #6 — Unimplemented Facilities (4 remaining)
**Source**: PRD_FACILITIES_PAGE.md  
**Priority**: Medium — players can buy them but they do nothing

4 of 14 facility types exist in the schema but have no gameplay effect:
- Research Lab — analytics, loadout presets, battle simulation
- Medical Bay — critical damage repair cost reduction (separate from Repair Bay)
- Coaching Staff — stable-wide stat bonuses via hired coaches
- Booking Office — tournament access and prestige rewards

### #7 — Achievement / Milestone System
**Source**: PRD_PRESTIGE_AND_FAME.md, PRD_ECONOMY_SYSTEM.md §6  
**Priority**: Medium — key engagement/retention driver

One-time rewards for milestones (ELO thresholds, win counts, streaks). Examples: first robot to ELO 1500 (₡50K + 50 prestige), 100 wins (₡250K + 200 prestige). Needs: database tables, tracking service, UI (dashboard trophies, notification toasts). Includes fame-based cosmetic unlocks as a later extension.

### #8 — Flex-Point Attribute Bucket (Pre-Battle Tactical Allocation)
**Source**: Player feedback (Tymen, LortGob)  
**Priority**: Medium — directly addresses the thin "Adjust" step in the core loop

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

### #9 — Post-Battle Results Page
**Source**: PRD_BATTLE_RESULTS_PAGE.md (marked ❌ NOT IMPLEMENTED)  
**Priority**: Medium — players lack immediate feedback after battles

Dedicated post-battle summary showing prestige/fame earned, damage breakdown, and streaming revenue. Currently players only see results through Battle History and Battle Detail pages.

### #10 — Weapon Special Properties
**Source**: PRD_WEAPON_ECONOMY.md, PRD_WEAPONS_LOADOUT.md  
**Priority**: Medium — would significantly deepen combat strategy

All 47 weapons currently have only attribute bonuses — no special effects. The pricing formula and combat simulator are designed to support properties like "ignores armor", "shield drain", "area damage" but none are implemented. Requires combat simulator changes and balance testing.

### #11 — Arena / Terrain Modifiers with Home Arena Selection
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

### #12 — Admin Portal Redesign / Separate Admin App
**Source**: Backlog triage  
**Priority**: Medium — admin tooling is scattered across the main app

The admin experience currently lives as routes within the player-facing app. As admin features grow (security dashboard, cycle management, user management, feature toggles), it makes sense to either redesign the admin section with its own layout/navigation or extract it into a separate portal entirely. A separate app would allow independent deployment, stricter access controls, and a purpose-built UI without bloating the player bundle.

### #13 — Battle Report Layout Overhaul
**Source**: Backlog triage  
**Priority**: Medium — current layout undersells the combat data

The existing Battle Detail page shows the data but the layout doesn't do it justice. Redesign the battle report with better visual hierarchy: timeline visualization, damage flow diagrams, round-by-round breakdown with animations or transitions, weapon effectiveness highlights. Related: "Post-Battle Results Page" (#9) covers a *new* post-battle summary screen — this item is about improving the detailed report itself.

Also: battle log verbosity levels. Players have asked for more detail in combat events. Two modes:
- **Shorthand** (current): `"Dikke Aap missed"`
- **Verbose**: `"Dikke Aap missed (76% hit chance — Combat Power 34 vs Evasion Thrusters 28)"`

Verbose mode would show the underlying formula inputs: hit chance percentages, which attributes drove the outcome, damage breakdowns with armor/penetration values, crit chance on critical hits, etc. Ties into the Player Personas / Complexity Modes item (#16) — verbose mode is exactly what the "show me everything" player wants, while shorthand suits the "just let me fight" player.

### #14 — Feature Flags / Per-User Feature Rollout
**Source**: Backlog triage  
**Priority**: Medium — enables safer releases and A/B testing

Add a feature toggle system manageable from the admin portal. Flags can be global (on/off), percentage-based (roll out to 10% of users), or per-user/per-role. Enables: gradual rollout of new features, A/B testing gameplay changes, kill switches for problematic features, beta access for specific users. Needs: flags table, middleware/hook to check flags, admin UI to manage them, frontend context/hook to gate UI components.

### #15 — Player Personas / Complexity Modes
**Source**: Backlog triage  
**Priority**: Medium — different players want fundamentally different experiences

Not all players want the same depth. Two archetypes: the "just let me fight" player who wants streamlined combat with minimal management, and the "show me everything" player who wants full stat transparency, detailed analytics, and granular control. Possible approaches: a complexity toggle in settings that shows/hides advanced panels, or tie it to a facility — e.g. a "Spy Facility" that progressively unlocks deeper analytics and opponent intel as it levels up (fits the existing facility progression model). The Spy Facility angle would give the transparency a gameplay cost, making it a strategic choice rather than just a UI preference. Cross-ref: "Progressive Feature Disclosure" (#25) covers time-gated unlocks — this is about *player-chosen* depth. Also relates to "Unimplemented Facilities" (#6) if the Spy Facility route is taken.

---

## Low Priority

### #16 — Battle Table Denormalization Cleanup
**Source**: [Battle Execution Audit](analysis/BATTLE_EXECUTION_AUDIT.md)  
**Priority**: Low — works correctly, just redundant data

The `Battle` table dual-writes per-robot columns alongside `BattleParticipant`. Consider a migration to drop legacy columns and fully rely on `BattleParticipant`.

### #17 — Tag Team Battle Time Limit Enforcement
**Source**: [Battle Execution Audit](analysis/BATTLE_EXECUTION_AUDIT.md)  
**Priority**: Low — stored duration is correct, only simulation overruns

Tag team battles can theoretically exceed 300s because each phase has its own 120s cap. Fix by passing `remainingTime` to `simulateBattle()`.

### #18 — Performance Optimization
**Source**: Phase 2 roadmap  
**Priority**: Low — current scale doesn't demand it

Areas to investigate: slow Prisma queries, N+1 in analytics endpoints, pagination on heavy lists, in-memory caching for weapon catalog and facility configs.

### #19 — Prestige Gating for Facilities
**Source**: PRD_FACILITIES_PAGE.md §6, PRD_PRESTIGE_AND_FAME.md  
**Priority**: Low — documented but not blocking gameplay

Facility upgrades gated by prestige level. UI shows lock indicators. Adds progression depth but not essential.

### #20 — Promotion/Demotion History Tracking
**Source**: PRD_LEAGUE_SYSTEM.md  
**Priority**: Low — nice for analytics, not player-facing

Track league tier changes over time (PromotionHistory model). Enables progression charts and yo-yo detection.

### #21 — Historical Financial Tracking
**Source**: PRD_ECONOMY_SYSTEM.md  
**Priority**: Low — cycle snapshots provide basic history already

Dedicated financial trend tracking beyond what CycleSnapshot provides.

### #22 — Dashboard Enhancements
**Source**: PRD_DASHBOARD_PAGE.md  
**Priority**: Low — cosmetic improvements

Enhanced prestige display (rank tiers, progress bar), tournament wins/trophy display, loading skeletons, notification toasts.

### #23 — Battle History URL State Persistence
**Source**: PRD_BATTLE_HISTORY_PAGE.md  
**Priority**: Low — QoL improvement

Persist filter/sort state in URL query params for shareable links and browser navigation.

### #24 — Hall of Records Performance Caching
**Source**: PRD_HALL_OF_RECORDS.md  
**Priority**: Low — only matters at scale

Cache leaderboard queries. Currently queries run on every request.

### #25 — Command Palette (Cmd+K)
**Source**: Deleted navigation analysis doc  
**Priority**: Low — power user feature

Keyboard-driven quick access to pages, robots, and actions with fuzzy search.

### #26 — Progressive Feature Disclosure
**Source**: Deleted navigation analysis doc  
**Priority**: Low — reduces new player overwhelm

Unlock advanced features based on prestige level or activity milestones.

---

## Not Scoped (Future Ideas)

### #27 — Weapon Crafting System
**Source**: PRD_WEAPONS_LOADOUT.md, PRD_ECONOMY_SYSTEM.md  
Custom weapon design at Workshop Level 6+. Pricing formula already supports it. Legendary crafting at Level 10.

### #28 — Free-for-All / Battle Royale Mode
**Source**: [Design analysis](analysis/FREE_FOR_ALL_BATTLE_ROYALE_MODE.md)  
Large-scale elimination (8–100 robots). Detailed design analysis exists covering arena scaling, shrinking boundary, vulture problem, performance.

### #29 — 3v3 Team Battles
**Source**: Roadmap Phase 9  
BattleParticipant model already supports N robots. Needs team formation, matchmaking, rewards, orchestrator.

### #30 — Conditional Battle Triggers / Robot AI Scripting
**Source**: GAME_DESIGN.md  
Player-defined robot behaviors: "switch stance when HP < 30%", "target weakest in KotH". Requires scripting or rule-builder UI.

### #31 — Future Revenue Streams
**Source**: PRD_ECONOMY_SYSTEM.md §7  
Trading commission (marketplace), sponsorship deals, arena attendance, championship bonuses, daily login bonuses.

### #32 — Daily Login Bonuses & Seasonal Events
**Source**: PRD_ECONOMY_SYSTEM.md, GAME_DESIGN.md  
Consecutive login rewards, limited-time challenges, end-of-season league placement rewards.

### #33 — Modular Package Extraction
**Source**: Deleted migration strategy docs  
npm workspace extraction. Only relevant when multiple consumers need shared backend logic (mobile app, separate battle server, team scaling).
