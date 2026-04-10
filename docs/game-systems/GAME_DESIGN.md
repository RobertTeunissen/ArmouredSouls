# Armoured Souls — Game Design Document

**Last Updated**: April 2, 2026  
**Version**: v2.0

---

## Version History
- v1.0 - Initial game design document
- v1.1 - Added implementation status markers to track progress
- v1.2 - Added King of the Hill mode, updated weapon counts
- v1.3 - Onboarding, tag teams, weapon count corrections
- v2.0 - Refocused as a pure game design document. Removed all implementation status markers and roadmap tracking (see [ROADMAP.md](../ROADMAP.md) for that). Consolidated redundant sections.

---

## Core Game Concept

**Genre**: Strategy Simulation / Management Game  
**Inspiration**: Football Manager — players manage input variables, the engine processes outcomes  
**Target Audience**: Casual players (ages 15+)  
**Session Length**: 15–30 minutes per day  
**Gameplay Style**: Asynchronous scheduled battles

**Core Loop**: Configure robots → Enlist in battles → View results → Adjust strategy → Repeat

---

## Battle System

### Scheduled Simulation Model

Battles are not real-time and not turn-based. Players configure their robots ahead of time, battles are scheduled at fixed processing windows, and the server simulates all matches simultaneously. Players log in afterward to view outcomes.

**Player Control**:
- Pre-battle: Full control over robot configuration, weapon selection, stance, yield threshold
- During battle: No manual intervention — outcomes are determined by pre-configured settings

### Battle Modes

| Mode | Format | Schedule | Details |
|---|---|---|---|
| League | 1v1 ranked | Daily (20:00 UTC) | ELO-based matchmaking, 6-tier league system, draws allowed |
| Tournament | 1v1 bracket | Daily (08:00 UTC) | Single elimination, no draws (HP tiebreaker), round-based rewards |
| Tag Team | 2v2 | Daily (12:00 UTC) | Active + reserve robot per team, tag-out on yield/destruction, 48h cadence |
| King of the Hill | 5-6 robot FFA | Mon/Wed/Fri (16:00 UTC) | Zone control scoring, placement-based rewards, no ELO impact |

### Combat Engine

The simulation engine is tick-based (100ms ticks, 120s max duration) and deterministic — same inputs always produce same outputs. Each tick processes shield regeneration, attack cooldowns, hit/miss/crit calculations, damage application, and end-condition checks.

Key mechanics:
- Weapon cooldowns and attack speed
- Hit chance (accuracy vs evasion)
- Critical strikes and damage dampening
- Armor/penetration damage reduction
- Shield absorption before HP damage
- Counter-attack protocols
- Yield threshold (robot surrenders at configured HP %)
- Weapon malfunction chance (reduced by Weapon Control attribute)

### Battle Duration

Time-based combat with a 120-second maximum. Battles end when a robot is destroyed (0 HP), yields (below threshold), or time runs out (draw or HP% tiebreaker in tournaments).

---

## Robot System

### 23 Core Attributes

Robots have 23 weapon-neutral attributes across 5 categories, each ranging from 1.00 to 50.00 (Decimal precision):

| Category | Attributes |
|---|---|
| Combat Systems (6) | Combat Power, Targeting Systems, Critical Systems, Penetration, Weapon Control, Attack Speed |
| Defensive Systems (5) | Armor Plating, Shield Capacity, Evasion Thrusters, Damage Dampeners, Counter Protocols |
| Chassis & Mobility (5) | Hull Integrity, Servo Motors, Gyro Stabilizers, Hydraulic Systems, Power Core |
| AI Processing (4) | Combat Algorithms, Threat Analysis, Adaptive AI, Logic Cores |
| Team Coordination (3) | Sync Protocols, Support Systems, Formation Tactics |

### Loadout System

4 loadout configurations with 47 weapons (41 weapons + 6 shields) across 4 range bands (melee, short, mid, long):

| Loadout | Description |
|---|---|
| Single | One weapon, one hand |
| Weapon + Shield | One weapon + one shield |
| Two-Handed | One powerful two-handed weapon |
| Dual-Wield | Two one-handed weapons |

### Battle Stances

3 stances modify attribute effectiveness: Offensive, Defensive, Balanced.

### Yield Threshold

Configurable 0–50% HP threshold where the robot surrenders instead of fighting to destruction. Lower threshold = more damage taken but higher chance of winning. Higher threshold = less repair cost but may forfeit winnable fights.

---

## Progression System

### Three Currencies

| Currency | Scope | Earned By | Spent On |
|---|---|---|---|
| Credits (₡) | Stable | Battle rewards, passive income, tournaments | Upgrades, weapons, facilities, repairs |
| Prestige | Stable | Battle victories (never spent) | Unlock threshold for content and facilities |
| Fame | Robot | Individual victories, performance bonuses | Robot reputation ranking |

### Robot Improvement

- Attribute upgrades (cost scales with level: `(current_level + 1) × 1,500`)
- Weapon purchases from the 47-weapon catalog
- Loadout and stance optimization
- Training academy facilities unlock higher attribute caps (10 → 50)

### League System

6-tier competitive ranking: Bronze → Silver → Gold → Platinum → Diamond → Champion

- League points: +3 win, -1 loss, +1 draw
- Top 10% per instance promoted (with ≥25 LP), bottom 10% demoted
- LP carries over across promotions/demotions
- Multiple instances per tier (max 100 robots each)
- ELO rating (K=32) used for matchmaking, not combat

---

## Stable Management

### Robot Collection

Players manage a stable of 1–10 robots (expandable via Roster Expansion facility). Each robot competes independently in leagues and earns its own fame.

### 14 Facilities

Stable-wide upgrades with 10 levels each (except Roster Expansion: 9 levels):

| Facility | Effect |
|---|---|
| Repair Bay | Reduces repair costs |
| Training Facility | Reduces attribute upgrade costs |
| Weapons Workshop | Weapon purchase discounts |
| Research Lab | Battle analytics, loadout presets |
| Medical Bay | Critical damage cost reduction |
| Roster Expansion | Robot slots (1 → 10) |
| Storage Facility | Weapon storage capacity |
| Coaching Staff | Stable-wide attribute bonuses |
| Booking Office | Tournament access tiers |
| Combat Training Academy | Combat Systems attribute cap (10 → 50) |
| Defense Training Academy | Defensive Systems attribute cap (10 → 50) |
| Mobility Training Academy | Chassis & Mobility attribute cap (10 → 50) |
| AI Training Academy | AI Processing + Team Coordination cap (10 → 50) |
| Merchandising Hub | Passive income (scales with prestige) |

Each facility has investment costs and daily operating costs. The economic tension between facility investment and robot upgrades is a core strategic decision.

### Viable Strategies

Multiple paths to success are intentional:
- One powerful robot (quality over quantity)
- Many weaker robots (breadth across leagues)
- Specialist builds (tank, glass cannon, balanced, evasion)
- Economic focus (facilities first, robots later)
- Tournament specialist vs league grinder

---

## Economy Design

### Daily Cycle

The game runs on a daily economic cycle:
1. Battle processing (leagues, tournaments, tag teams, KotH at their scheduled times)
2. Settlement (23:00 UTC): passive income, operating costs, balance logging, cycle increment

### Income Sources
- Battle win/loss/draw rewards (scale by league tier)
- Tournament placement rewards
- KotH placement rewards
- Merchandising Hub passive income
- Streaming revenue (from Streaming Studio facility)

### Expenses
- Robot repairs (damage-based, multiplied if destroyed)
- Attribute upgrades
- Weapon purchases
- Facility upgrades and operating costs

### Starting Resources
- ₡3,000,000 credits
- 1 robot slot (Roster Expansion level 0)
- All attributes at 1.00
- No facilities purchased

---

## Onboarding

### Philosophy
Easy to learn, hard to master. New players are guided through a 5-step tutorial that covers robot creation, facility investment, loadout configuration, attribute upgrades, and tag team formation. The tutorial can be skipped at any time.

### Tutorial Steps (UI)
1. Welcome + Strategy Selection + Robot Creation
2. Facility Investment
3. Battle-Ready Setup (loadout, stance, weapons, portrait)
4. Attribute Upgrades + Tag Team
5. Completion

The backend tracks 9 granular steps internally; the UI consolidates these into 5 display steps for simplicity.

---

## Social & Competition

### Leaderboards
- Global ELO rankings
- League standings by tier
- Prestige leaderboard (stable-level)
- Fame leaderboard (robot-level)
- Losses leaderboard
- Hall of Records (various career stats, KotH streaks)
- Tag Team standings

### Spectating
- Battle history and detailed combat logs are viewable
- Battle replay with timestamped events

### Not Yet Designed
- Guilds/clans
- Friend system
- In-game chat
- Trading/marketplace
- Regional rankings

---

## Monetization (Design Principles)

**Model**: Free-to-play with optional purchases (not yet implemented)

Design constraints:
- No pay-to-win: Players cannot buy power directly, only resources/currency
- No artificial time-gating: Progression is not slowed to push purchases
- Prestige and fame must be earned through gameplay, never purchased
- Cosmetics are fair game for monetization

---

## Target Experience

### Session Structure
- Quick sessions: 5–20 minutes typical
- One meaningful login per day
- Check battle results → adjust robots → queue for next cycle
- Strategic planning between cycles (upgrades, loadouts, facility investments)

### Player Types Supported
- Casual: Log in daily, make a few tweaks, enjoy results
- Optimizer: Deep-dive into attribute math, weapon synergies, loadout theory
- Collector: Build a diverse stable with specialized robots
- Competitor: Push for Champion league, tournament wins, Hall of Records entries

---

## Platform Strategy

**Current**: Responsive web application (desktop + mobile browsers)  
**Future**: Native mobile apps via React Native (not yet planned in detail)

---

## Future Design Considerations

These are design ideas that haven't been fully specified yet:

- Conditional triggers ("activate weapon X after 3 minutes" or "when badly damaged")
- Guild/clan wars (mass battles between groups)
- Story mode / lore introduction
- Seasonal events and limited-time challenges
- Achievement system (beyond prestige/fame milestones)
- Trading/marketplace (player-driven economy)
- Advanced team modes (3v3, 5v5)
- Free-for-all / Battle Royale mode (larger than KotH)

---

## Related Documentation

- [ROADMAP.md](../ROADMAP.md) — Implementation status, milestones, and what's done/in-progress/planned
- [ARCHITECTURE.md](ARCHITECTURE.md) — System architecture and tech stack
- [COMBAT_FORMULAS.md](COMBAT_FORMULAS.md) — Detailed combat math
- [PRD_ECONOMY_SYSTEM.md](PRD_ECONOMY_SYSTEM.md) — Economy system specification
- [PRD_PRESTIGE_AND_FAME.md](PRD_PRESTIGE_AND_FAME.md) — Prestige and fame calculations
- [STABLE_SYSTEM.md](STABLE_SYSTEM.md) — Facility costs and mechanics
- [PRD_WEAPONS_LOADOUT.md](PRD_WEAPONS_LOADOUT.md) — Complete weapon catalog
- [PRD_MATCHMAKING.md](PRD_MATCHMAKING.md) — Matchmaking algorithm
- [PRD_ONBOARDING_SYSTEM.md](PRD_ONBOARDING_SYSTEM.md) — Onboarding system specification
- [BATTLE_SIMULATION_ARCHITECTURE.md](BATTLE_SIMULATION_ARCHITECTURE.md) — Battle engine internals
