# Backlog — Ideas to Be Specced

Items identified during audits, reviews, and development. Prioritized by impact on player experience and system reliability.

**Priority scale**: High (should spec soon) · Medium (valuable but not blocking) · Low (nice to have) · Not scoped (future idea only)

---

## High Priority

### Facility Investment Advisor & ROI Calculator
**Source**: Known issue  
**Priority**: High — broken feature visible to players

The Investments & ROI tab and Investment Advisor tab on the Facilities page are not working as intended. The consolidation from the old pages was structural only — the data isn't flowing correctly. Players see empty or wrong numbers.

### Monitoring and Alerting
**Source**: Phase 2 roadmap  
**Priority**: High — no way to know if production breaks

Current observability: Winston logs, `CyclePerformanceMonitoringService`, `securityMonitor`, admin Security Dashboard. Missing: external uptime monitoring, alerting on backend crashes or cycle failures, log aggregation. Lightweight approach: UptimeRobot for uptime, Discord webhook for cycle failures (notification service already supports Discord).

### Landing Page / Marketing Front Page
**Source**: Current state — visitors land on a login/register form with no context  
**Priority**: High — first impression for new players

The current front page is just a login and registration module. New visitors have no idea what the game is, how it plays, or why they should sign up. Needs: game concept pitch, screenshots or gameplay preview, feature highlights (4 battle modes, 47 weapons, league system), call-to-action to register. Could be a simple static page above the login form or a dedicated `/` route that redirects authenticated users to the dashboard.

---

## Medium Priority

### Unimplemented Facilities (4 remaining)
**Source**: PRD_FACILITIES_PAGE.md  
**Priority**: Medium — players can buy them but they do nothing

4 of 14 facility types exist in the schema but have no gameplay effect:
- Research Lab — analytics, loadout presets, battle simulation
- Medical Bay — critical damage repair cost reduction (separate from Repair Bay)
- Coaching Staff — stable-wide stat bonuses via hired coaches
- Booking Office — tournament access and prestige rewards

### Achievement / Milestone System
**Source**: PRD_PRESTIGE_AND_FAME.md, PRD_ECONOMY_SYSTEM.md §6  
**Priority**: Medium — key engagement/retention driver

One-time rewards for milestones (ELO thresholds, win counts, streaks). Examples: first robot to ELO 1500 (₡50K + 50 prestige), 100 wins (₡250K + 200 prestige). Needs: database tables, tracking service, UI (dashboard trophies, notification toasts). Includes fame-based cosmetic unlocks as a later extension.

### Post-Battle Results Page
**Source**: PRD_BATTLE_RESULTS_PAGE.md (marked ❌ NOT IMPLEMENTED)  
**Priority**: Medium — players lack immediate feedback after battles

Dedicated post-battle summary showing prestige/fame earned, damage breakdown, and streaming revenue. Currently players only see results through Battle History and Battle Detail pages.

### Weapon Special Properties
**Source**: PRD_WEAPON_ECONOMY.md, PRD_WEAPONS_LOADOUT.md  
**Priority**: Medium — would significantly deepen combat strategy

All 47 weapons currently have only attribute bonuses — no special effects. The pricing formula and combat simulator are designed to support properties like "ignores armor", "shield drain", "area damage" but none are implemented. Requires combat simulator changes and balance testing.

---

## Low Priority

### Battle Table Denormalization Cleanup
**Source**: [Battle Execution Audit](analysis/BATTLE_EXECUTION_AUDIT.md)  
**Priority**: Low — works correctly, just redundant data

The `Battle` table dual-writes per-robot columns alongside `BattleParticipant`. Consider a migration to drop legacy columns and fully rely on `BattleParticipant`.

### Tag Team Battle Time Limit Enforcement
**Source**: [Battle Execution Audit](analysis/BATTLE_EXECUTION_AUDIT.md)  
**Priority**: Low — stored duration is correct, only simulation overruns

Tag team battles can theoretically exceed 300s because each phase has its own 120s cap. Fix by passing `remainingTime` to `simulateBattle()`.

### Performance Optimization
**Source**: Phase 2 roadmap  
**Priority**: Low — current scale doesn't demand it

Areas to investigate: slow Prisma queries, N+1 in analytics endpoints, pagination on heavy lists, in-memory caching for weapon catalog and facility configs.

### Prestige Gating for Facilities
**Source**: PRD_FACILITIES_PAGE.md §6, PRD_PRESTIGE_AND_FAME.md  
**Priority**: Low — documented but not blocking gameplay

Facility upgrades gated by prestige level. UI shows lock indicators. Adds progression depth but not essential.

### Promotion/Demotion History Tracking
**Source**: PRD_LEAGUE_SYSTEM.md  
**Priority**: Low — nice for analytics, not player-facing

Track league tier changes over time (PromotionHistory model). Enables progression charts and yo-yo detection.

### Historical Financial Tracking
**Source**: PRD_ECONOMY_SYSTEM.md  
**Priority**: Low — cycle snapshots provide basic history already

Dedicated financial trend tracking beyond what CycleSnapshot provides.

### Dashboard Enhancements
**Source**: PRD_DASHBOARD_PAGE.md  
**Priority**: Low — cosmetic improvements

Enhanced prestige display (rank tiers, progress bar), tournament wins/trophy display, loading skeletons, notification toasts.

### Battle History URL State Persistence
**Source**: PRD_BATTLE_HISTORY_PAGE.md  
**Priority**: Low — QoL improvement

Persist filter/sort state in URL query params for shareable links and browser navigation.

### Hall of Records Performance Caching
**Source**: PRD_HALL_OF_RECORDS.md  
**Priority**: Low — only matters at scale

Cache leaderboard queries. Currently queries run on every request.

### Command Palette (Cmd+K)
**Source**: Deleted navigation analysis doc  
**Priority**: Low — power user feature

Keyboard-driven quick access to pages, robots, and actions with fuzzy search.

### Progressive Feature Disclosure
**Source**: Deleted navigation analysis doc  
**Priority**: Low — reduces new player overwhelm

Unlock advanced features based on prestige level or activity milestones.

---

## Not Scoped (Future Ideas)

### Weapon Crafting System
**Source**: PRD_WEAPONS_LOADOUT.md, PRD_ECONOMY_SYSTEM.md  
Custom weapon design at Workshop Level 6+. Pricing formula already supports it. Legendary crafting at Level 10.

### Free-for-All / Battle Royale Mode
**Source**: [Design analysis](analysis/FREE_FOR_ALL_BATTLE_ROYALE_MODE.md)  
Large-scale elimination (8–100 robots). Detailed design analysis exists covering arena scaling, shrinking boundary, vulture problem, performance.

### 3v3 Team Battles
**Source**: Roadmap Phase 9  
BattleParticipant model already supports N robots. Needs team formation, matchmaking, rewards, orchestrator.

### Conditional Battle Triggers / Robot AI Scripting
**Source**: GAME_DESIGN.md  
Player-defined robot behaviors: "switch stance when HP < 30%", "target weakest in KotH". Requires scripting or rule-builder UI.

### Future Revenue Streams
**Source**: PRD_ECONOMY_SYSTEM.md §7  
Trading commission (marketplace), sponsorship deals, arena attendance, championship bonuses, daily login bonuses.

### Daily Login Bonuses & Seasonal Events
**Source**: PRD_ECONOMY_SYSTEM.md, GAME_DESIGN.md  
Consecutive login rewards, limited-time challenges, end-of-season league placement rewards.

### Modular Package Extraction
**Source**: Deleted migration strategy docs  
npm workspace extraction. Only relevant when multiple consumers need shared backend logic (mobile app, separate battle server, team scaling).
