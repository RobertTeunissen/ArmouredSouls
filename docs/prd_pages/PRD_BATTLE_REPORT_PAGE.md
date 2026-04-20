# Product Requirements Document: Battle Report Page

**Project**: Armoured Souls  
**Document Type**: Product Requirements Document (PRD)  
**Version**: v2.0  
**Date**: April 20, 2026  
**Status**: Implemented ✅ (Spec #26 — Battle Report Overhaul + post-spec unification)

---

## Version History
- v2.0 - Major update reflecting full unification work (April 20, 2026)
  - All components now use unified `participants[]` with canonical ordering
  - Removed TagTeamInfo, KothParticipants, BattleLevelStats components
  - Added active combat time, target tracking, damage matrix heatmap, KotH scoring module
  - Portal-based tooltips, consistent card styling across all components
- v1.0 - Initial PRD created from implemented state (April 20, 2026)

---

## Executive Summary

The Battle Report page (`/battle/:id`) displays a detailed breakdown of a completed battle. It serves as the primary post-battle analysis tool, showing combat statistics, battle outcomes, playback visualization, and the full combat log.

**File**: `app/frontend/src/pages/BattleDetailPage.tsx`  
**Note**: The file is named `BattleDetailPage` but the GUI heading reads "Battle Report #". The component folder is `battle-detail/`.

**Key Principle**: One rendering path for all battle types. Every component receives the same `participants[]` array in the same canonical order. No battle-type-specific components or rendering branches.

**Key Features:**
- ✅ Tabbed layout on desktop (≥1024px), stacked on mobile
- ✅ Battle result banner with participant/spectator modes
- ✅ Unified N-column combat statistics table with active time, expected chances, targeting
- ✅ Battle outcomes with KotH-specific zone scoring module
- ✅ Damage matrix heatmap (3+ robots) with row/column totals
- ✅ Arena summary with spatial data
- ✅ Responsive battle playback viewer with 2D arena canvas
- ✅ Full combat message log
- ✅ Clickable robot/stable/battle-type links throughout
- ✅ Portal-based tooltips (never clipped by overflow containers)

---

## Page Structure

### URL
`/battle/:id` — where `:id` is the battle ID (integer).

### Access
Requires authentication. Any authenticated user can view any battle.

### Data Source
`GET /api/matches/battles/:id/log` — returns `BattleLogResponse` with full battle data including detailed combat events, robot info, participants, and spatial data.

### Canonical Participant Ordering

The page computes participant order once via `orderParticipants()` and passes it to all components. The rule is **winner first**:

- **KotH**: sorted by placement (1st, 2nd, 3rd…)
- **Tag Team**: winning team's robots first, then losing team
- **1v1 / Tournament**: winner first, loser second
- **Draw**: keeps API order

No component does its own sorting. Same order everywhere.

---

## Layout

### Desktop (≥1024px): Tabbed Layout

Two tabs via `TabLayout` component:

| Tab | Contents |
|-----|----------|
| **Overview** | BattleResultBanner, BattleStatisticsSummary, StableRewards (Battle Outcomes), DamageFlowDiagram (heatmap, 3+ robots only), ArenaSummary. If no playback: also CombatMessages. |
| **Playback** | BattlePlaybackViewer (2D arena canvas + synced combat log panel). Hidden when no spatial data (`arenaRadius` absent). |

### Mobile (<1024px): Stacked Layout

All sections rendered vertically without tabs. Playback only shown when spatial data exists.

---

## Card Styling Standard

All cards on the page follow the same pattern (except BattleResultBanner which is a themed banner):

- **Wrapper**: `bg-surface rounded-lg mb-3 p-3`
- **Heading**: `<h3>` with `text-lg font-bold mb-3` (white text, emoji prefix)
- **Table**: `w-full text-xs border-collapse`
- **Header row**: `text-secondary` on `<tr>`, robot names as blue `<Link>` to `/robots/:id`
- **Section sub-headers**: `pt-2 pb-0.5` td with `text-xs font-bold text-secondary` span
- **Data rows**: `border-t border-white/5`, label in `text-secondary`, values in `text-white font-medium`
- **Scroll wrapper** (3+ robots): `overflow-x-auto` div with dynamic `minWidth`
- **Label column width**: `33%` for ≤2 robots, `120px` for 3+

---

## Components

### 1. BattleResultBanner
**File**: `battle-detail/BattleResultBanner.tsx`

Displays the battle outcome with robot images, result heading, and battle context. Uses the unified `participants[]` array — one rendering path for all battle types.

**Two modes:**
- **Participant** (userId matches any participant's ownerId): "Victory" / "Defeat" / "Draw" with outcome-colored background. Losing participants at reduced opacity.
- **Spectator** (no match): "{Winner Name} Wins" or "Draw" in primary color. All participants at equal emphasis.

**Winner determination:**
- **KotH**: Winner is the participant with `placement === 1`. KotH always has a winner.
- **Tag Team**: Winner is by team — all robots on the winning team won. Uses `team` field.
- **Tournament**: Always has a winner. End method: "by Destruction", "by Yield", or "by HP Tiebreaker".
- **League**: Winner from `battleLog.winner` mapped to robot ID. Can be a draw.

**Battle end method:**
- KotH: always "by Zone Score"
- Tournament: "by Destruction" / "by Yield" / "by HP Tiebreaker" (never draw)
- League/Tag Team: "by Destruction" / "by Yield" / "by Time Limit" (can draw)

**Content:**
- Participant cards with robot image, robot name link (→ `/robots/:id`), stable name link (→ `/stables/:userId`)
- KotH: placement badges, no "vs" separators
- Tag Team: "vs" separator only between teams (not between teammates)
- 1v1: "vs" separator between the two robots
- Battle context line (clickable → relevant standings/tournament page)
- Duration

### 2. BattleStatisticsSummary
**File**: `battle-detail/BattleStatisticsSummary.tsx`

Unified N-column combat statistics table. One rendering path for all battle types — dynamic columns based on number of participants. Uses `participants[]` for robot info (stance, weapons) and `perRobot` from `computeBattleStatistics()` for combat data. Creates empty stats for participants that never entered combat (e.g. tag team reserves that never tagged in).

**Layout:**
- 2 robots (1v1, tournament): side-by-side table `[label | robot1 | robot2]`
- 3+ robots (tag team, KotH): horizontally scrollable table with `overflow-x-auto`

**Column headers**: Robot names as blue clickable links (→ `/robots/:id`).

**Robot info rows** (from `participants[]`):
- Stance (with emoji: ⚡ Offensive, 🛡️ Defensive, ⚖️ Balanced)
- Main weapon name + range band
- Offhand weapon name + range band (only shown if any participant has an offhand)

**Attacks section** (follows combat flow):
- Active Time — per-robot active combat duration with status: `✅ survived`, `💀 destroyed`, `🏳️ yielded`, `🔄 tagged out at Xs`, `🔄 tagged in at Xs`, `🪑 never entered`. Survivors show full battle duration. Eliminated robots show time from entry (0 for starters, tag-in time for reserves) to exit. Attack interval and DPS use this per-robot active duration.
- Opportunities — total attack attempts, with average interval based on active time
- Malfunctions — count + actual % + expected %
- Effective — opportunities minus malfunctions, with %
- Hits — count + actual % + expected %
- Misses — count + %
- Criticals — count + actual % + expected %

**Offhand section** (dual-wield only): Same structure as Attacks.

**Counters section** (if any triggered): Triggered, Hits, Misses with expected chances.

**Hit Severity section**: Breakdown row (glancing/solid/heavy/devastating counts).

**Damage Dealt section**: Total damage + DPS (based on active duration).

**Damage Taken section**: Total received, Shield Absorbed, HP Lost, Shield Recharged (if > 0).

**Targeting section** (shown for KotH or when any robot has target switches):
- Target Switches — how many times this robot changed target
- Per-target rows (`→ Robot Name`) — time spent targeting each opponent in seconds. Durations are normalized to sum to the robot's active time. Sorted by total time across all robots (most-targeted first). `—` if that robot never targeted that opponent.

**Expected chances**: From `formulaBreakdown.components`. Base values without random variance and without spatial modifiers. Falls back to variance-included values for old battle data.

### 3. StableRewards (Battle Outcomes)
**File**: `battle-detail/StableRewards.tsx`

Uses the unified `participants[]` array — one N-column table for all battle types.

**Unified N-column table:**
- Robot names as blue clickable column headers (→ `/robots/:id`)
- Placement (KotH only) — 🥇 1st / 🥈 2nd / 🥉 3rd / #4th etc.
- Result — 💀 Destroyed / 🏳️ Yielded / ✅ X% HP
- ELO — before → after (+/-diff)
- **Credits section**: Battle Reward, Streaming (if > 0), **Total** (bold)
- **Progression section** (if any): ⭐ Prestige, 🎖️ Fame

**KotH Scoring Module** (`⛰️ Zone Scoring`):
- Separate card rendered only for KotH battles
- Shows score threshold ("First to X zone points wins")
- N-column table with: Zone Score, Zone Time, Kills (if any), Damage Dealt
- Robot names as blue clickable column headers
- Data sourced from `kothParticipants[]` in the API response

### 4. DamageFlowDiagram (Damage Matrix)
**File**: `battle-detail/DamageFlowDiagram.tsx`

Heatmap grid showing who damaged whom. Only renders for 3+ robots (tag team, KotH) — for 1v1 the combat statistics table already shows damage dealt/received. Includes all participants even if they had zero combat (e.g. reserves that never tagged in).

- Rows = attackers, columns = defenders
- Robot names as blue clickable links (→ `/robots/:id`) on both axes
- Cell background color intensity scales with damage (sqrt scale for visual spread)
- Diagonal cells (self) show `—` with muted background
- **Row totals** ("Dealt" column): total damage dealt by each attacker
- **Column totals** ("Received" row): total damage received by each defender
- Heading: `🔀 Damage Matrix` with "Rows = attacker, columns = defender" subtitle

### 5. ArenaSummary
**File**: `battle-detail/ArenaSummary.tsx`

Spatial battle data: arena radius/diameter, distance moved per robot, starting/ending positions, range band distribution (melee/short/mid/long percentages). Only renders when `arenaRadius` is present.

### 6. BattlePlaybackViewer
**File**: `BattlePlaybackViewer/BattlePlaybackViewer.tsx`

2D arena canvas with playback controls and combat log panel.

- Responsive canvas (300–500px) via `useContainerSize` hook
- HiDPI rendering: canvas pixel buffer at `displaySize × devicePixelRatio`, context scaled by DPR
- Hexagonal robot shapes with team colors and facing direction arrow
- HP bars, shield bars, name labels
- Attack indicators, range band indicator, target lines
- KotH zone rendering with transition animations
- KotH scoreboard overlay: 160px panel with name truncation via `ctx.measureText()` to prevent text overflow into score column
- Playback controls: play/pause, speed (0.5×/1×/2×/4×), seek, skip to next event
- Combat log panel synced to playback time

### 7. CombatMessages
**File**: `battle-detail/CombatMessages.tsx`

Full combat event log with timestamps, color-coded by event type. Filters out financial/reward events.

### 8. TabLayout
**File**: `battle-detail/TabLayout.tsx`

Horizontal tab bar (Overview / Playback). Hides Playback tab when no spatial data.

### 9. AttributeTooltip
**File**: `battle-detail/AttributeTooltip.tsx`

Info icon (ℹ️) that shows which robot attributes influence a combat stat. Hover on desktop, tap on mobile.

- **Portal-based rendering** via `createPortal` to `document.body` — never clipped by `overflow-x-auto` or any other container
- Positioned using `getBoundingClientRect()` with `position: fixed` — viewport-relative
- Places above the trigger by default; flips below if it would go off the top of the viewport
- Horizontally centered on trigger, clamped to viewport edges
- Repositions on scroll and resize
- Shows attacker/defender attribute groups with category color coding
- Plain-language descriptions (no formula numbers)
- Placed on individual stat rows, not on section headers

---

## Architecture — Component × Battle Type Matrix

### Current State (Fully Migrated)

All display components use the unified `participants[]` array. Legacy components have been removed.

| Component | Uses `participants[]`? | Separate paths? | Status |
|-----------|----------------------|-----------------|--------|
| **BattleResultBanner** | ✅ Yes | No — one `ParticipantCard` for all types | ✅ Migrated |
| **BattleStatisticsSummary** | ✅ Yes | No — unified N-column table | ✅ Migrated |
| **StableRewards** (Battle Outcomes) | ✅ Yes | No — unified N-column table | ✅ Migrated |
| **DamageFlowDiagram** (Damage Matrix) | ✅ Yes | No — heatmap for 3+, hidden for 1v1 | ✅ Migrated |
| **KothParticipants** | N/A | N/A | ✅ Removed (file deleted) |
| **BattleLevelStats** | N/A | N/A | ✅ Removed (file deleted) |
| **TagTeamInfo** | N/A | N/A | ✅ Removed from page — tag-out timing in Active Time row |

### Migration Path

1. ✅ Add `participants[]` to the API response (built from `BattleParticipant` table)
2. ✅ Refactor `BattleResultBanner` — one rendering path, team-aware "vs" separators
3. ✅ Refactor `StableRewards` — unified N-column table + KotH scoring module
4. ✅ Remove `KothParticipants` from the page (file deleted)
5. ✅ Refactor `BattleStatisticsSummary` — unified N-column table with active time, targeting
6. ✅ Remove `TagTeamInfo` — tag-out timing folded into Active Time row
7. ✅ Remove `BattleLevelStats` (file deleted) — merged into other components
8. ✅ Rewrite `DamageFlowDiagram` — heatmap with row/column totals, participant links
9. ⏳ Deprecate and remove `robot1`/`robot2`, `tagTeam`, `kothParticipants` from the API response

---

## Data Flow

1. Page loads → fetches `getBattleLog(battleId)`
2. `orderParticipants()` computes canonical order (winner first) — baked into `battleLog.participants`
3. `computeBattleStatistics()` runs once on `detailedCombatEvents` (raw simulator output). Falls back to narrative `events` for old battles. Tracks:
   - Per-robot attack stats, damage, shield, counters, hit grades
   - Active combat time (entry to exit, tracking `tag_out`/`tag_in`/`destroyed`/`yield` events)
   - Target switching and per-target durations (normalized to sum to active time)
   - Expected chances from formula breakdowns
4. Statistics, damage flows, and expected chances passed as props to components
5. `useBattlePlaybackData()` hook extracts playback-specific data

---

## Battle Types Supported

| Type | Banner | Statistics | Outcomes | Damage Matrix | Playback | Special |
|------|--------|-----------|----------|---------------|----------|---------|
| League | ✅ | ✅ 2-col table | ✅ 2-col table | Hidden (1v1) | ✅ | League tier link |
| Tournament | ✅ | ✅ 2-col table | ✅ 2-col table | Hidden (1v1) | ✅ | Tournament link, round info |
| Tag Team | ✅ Team vs Team | ✅ 4-col table | ✅ 4-col table | ✅ 4×4 heatmap | ✅ | Tag-out/tag-in in Active Time |
| KotH | ✅ Placements | ✅ N-col scrollable | ✅ N-col + Zone Scoring | ✅ N×N heatmap | ✅ | Zone scoring, targeting section |

---

## Design System Compliance

- Background: `bg-background` (#0a0e14)
- Cards: `bg-surface` (#1a1f29) — all cards use identical wrapper styling
- Elevated: `bg-surface-elevated` (#252b38) — used for tooltips
- Typography: `text-3xl font-bold` page title, `<h3> text-lg font-bold` section headings (all white), `text-xs` table content
- Robot names: blue `text-primary` links everywhere (column headers, banner, outcomes)
- Motion: 150ms ease-out transitions, `prefers-reduced-motion` respected
- Spacing: p-3 card padding, mb-3 card margins
- Colors: All design system tokens, no raw Tailwind colors

---

## Known Issues & Future Enhancements

### Known Issues
- File naming inconsistency: `BattleDetailPage.tsx` vs "Battle Report" in GUI
- Old battles (pre-April 20, 2026) lack `hitChanceBase`/`critChanceBase` fields — expected chances fall back to variance-included values
- Old battles lack `tournamentId` — tournament links fall back to `/tournaments`
- Legacy API fields (`robot1`/`robot2`, `tagTeam`, `kothParticipants`) still returned alongside `participants[]` — used by playback viewer and KotH scoring module

### Backlog Items
- **#39 — League & Tag Team Instance Deep Linking**: Link to specific league instance, not just tier ([BACKLOG.md](../BACKLOG.md))
- **Fame/Prestige progression display**: Show totals, next level thresholds, progress in Battle Outcomes section
- **Deprecate legacy API fields**: Remove `robot1`/`robot2`, `tagTeam`, `kothParticipants` once all consumers use `participants[]`

---

## Related Documentation

- **Battle History Page**: [PRD_BATTLE_HISTORY_PAGE.md](PRD_BATTLE_HISTORY_PAGE.md) — list page that links to battle reports
- **Design System**: [DESIGN_SYSTEM_QUICK_REFERENCE.md](../design_ux/DESIGN_SYSTEM_QUICK_REFERENCE.md) — card styling, tab layout, battle result format
- **Frontend Standards**: [frontend-standards.md](../../.kiro/steering/frontend-standards.md) — `useContainerSize`, tab layout, `computeBattleStatistics` patterns
- **Spec**: [Spec #26 — Battle Report Overhaul](../../.kiro/specs/done-april26/26-battle-report-overhaul/)
