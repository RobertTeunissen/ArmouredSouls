# Implementation Plan: Battle Report Overhaul

## Overview

Overhaul the Battle Report detail page and CompactBattleCard with structured statistics, Sankey damage flow diagram, responsive playback viewer, tabbed layout, design system alignment, robot images, and economic visibility enhancements. Implementation follows the dependency order: backend API changes first, then core computation utilities, new components, integration wiring, existing test updates, documentation, and verification.

## Tasks

- [x] 1. Backend API changes
  - [x] 1.1 Extend match history API with economic fields
    - In `app/backend/src/services/match/matchHistoryService.ts`, update `formatBattleHistoryEntry` to include `prestigeAwarded`, `fameAwarded`, and `streamingRevenue` from the `BattleParticipant` records for the requesting user's robot
    - In `app/frontend/src/utils/matchmakingApi.ts`, add optional fields `prestigeAwarded?: number`, `fameAwarded?: number`, `streamingRevenue?: number` to the `BattleHistory` interface
    - _Requirements: 7.5_

  - [x] 1.2 Extend battle log API with yielded, destroyed, imageUrl, loadoutType, and rangeBand fields
    - In the `getBattleLog` service, add `yielded` and `destroyed` booleans to robot1/robot2 objects, sourced from `BattleParticipant.yielded` and `BattleParticipant.destroyed`
    - Add `imageUrl` (nullable string) to robot1, robot2, tag team robot objects, and KotH participant objects, sourced from `Robot.imageUrl`
    - Add `loadoutType` and `rangeBand` fields to robot1/robot2 objects for sprite selection in the arena canvas
    - Update the `BattleLogResponse` TypeScript interface in `app/frontend/src/utils/matchmakingApi.ts` to include all new fields
    - _Requirements: 2.6, 9.3_

  - [x] 1.3 Write backend integration test for match history economic fields
    - Create `app/backend/src/services/match/__tests__/matchHistoryService.test.ts` (or extend if it exists)
    - Test that the match history response includes `prestigeAwarded`, `fameAwarded`, and `streamingRevenue` fields sourced from BattleParticipant records
    - _Requirements: 7.5_

- [x] 2. Checkpoint — Backend API changes complete
  - Ensure all backend tests pass (`npm test` in `app/backend`), ask the user if questions arise.

- [x] 3. Core computation utility — computeBattleStatistics
  - [x] 3.1 Implement computeBattleStatistics pure function
    - Create `app/frontend/src/utils/battleStatistics.ts`
    - Define interfaces: `RobotCombatStats`, `TeamCombatStats`, `DamageFlow`, `BattleStatistics` as specified in design Section 1
    - Implement `computeBattleStatistics(events, battleDuration, battleType?, tagTeamInfo?, robotMaxHP?)` that iterates over the events array and computes per-robot stats (attacks, hits, misses, criticals, malfunctions per main/offhand), counter stats (triggered, hits, misses, damageDealt with correct role reversal), shield stats (shieldDamageAbsorbed from `shieldDamage` field, shieldRecharged from positive `robotShield` deltas), hit severity grades (glancing/solid/heavy/devastating based on damage/maxHP thresholds), damage flows, and team aggregates for tag_team battles
    - Handle edge cases: zero attack events (`hasData: false`), division by zero for rates, missing `robotMaxHP` (default to "solid" grade), counter role reversal (attacker/defender swapped on counter events)
    - _Requirements: 1.1, 1.2, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 3.2 Write unit tests for computeBattleStatistics
    - Create `app/frontend/src/utils/__tests__/battleStatistics.test.ts`
    - Test cases: empty events array returns `hasData: false`; single attack event produces correct per-robot stats; mixed event types (attack, miss, critical, malfunction, counter, shield_break, shield_regen) produce correct counts; tag_team with 4 robots produces correct team grouping and aggregates; koth with 6 robots produces stats for all participants; counter events attribute stats to correct robots (role reversal); main/offhand split is correct for dual-wield events; hit severity grades are classified correctly at boundary values (4.9%, 5%, 15%, 30%, 30.1% of maxHP); zero attacks produces hitRate=0 (not NaN)
    - _Requirements: 1.1, 1.2, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 8.1, 8.2, 8.4_

  - [x] 3.3 Write property-based tests for computeBattleStatistics
    - Create `app/frontend/src/utils/__tests__/battleStatistics.property.test.ts`
    - Implement fast-check generators: `arbitraryBattleLogEvent()` generating events with random valid types, attacker/defender names, weapon, damage, hit, critical, malfunction, hand fields; `arbitraryEventsArray(minRobots, maxRobots)` generating arrays of 0-100 events with 2-6 distinct robot names
    - **Property 1: Event counting conservation** — sum of hits+misses+criticals+malfunctions across all robots equals count of attack-type events; sum of counters.hits+counters.misses equals count of counter events. Tag: `Feature: battle-report-overhaul, Property 1: Event counting conservation`. Validates: Requirements 1.1, 1.9, 8.1
    - **Property 1b: Main/offhand split conservation** — per-robot mainHand totals + offhand totals equal aggregate totals. Tag: `Feature: battle-report-overhaul, Property 1b: Main/offhand split conservation`. Validates: Requirement 1.8
    - **Property 2: Per-robot stats completeness** — N distinct robot names in events produces exactly N entries in perRobot; each robot's damageDealt equals sum of damage from events where robot is attacker. Tag: `Feature: battle-report-overhaul, Property 2: Per-robot stats completeness`. Validates: Requirements 1.2, 1.6
    - **Property 3: Team aggregation invariant** — for tag_team, each team's totalDamageDealt equals sum of member robots' damageDealt. Tag: `Feature: battle-report-overhaul, Property 3: Team aggregation invariant`. Validates: Requirement 1.5
    - **Property 4: Damage flow conservation** — sum of all damageFlows values equals total damage across all events. Tag: `Feature: battle-report-overhaul, Property 4: Damage flow conservation`. Validates: Requirements 3.1, 3.5
    - **Property 7: Hit rate formula correctness** — for robots with attacks>0, hitRate equals (hits/attacks)*100; for attacks===0, hitRate is 0. Tag: `Feature: battle-report-overhaul, Property 7: Hit rate formula correctness`. Validates: Requirement 8.2
    - **Property 8: Computation idempotence** — calling computeBattleStatistics twice with same input produces deeply equal output. Tag: `Feature: battle-report-overhaul, Property 8: Computation idempotence`. Validates: Requirement 8.5
    - **Property 9: Hit grade conservation** — sum of hitGrades (glancing+solid+heavy+devastating) equals robot's hits count. Tag: `Feature: battle-report-overhaul, Property 9: Hit grade conservation`. Validates: Requirement 1.7
    - Minimum 100 iterations per property test
    - _Requirements: 1.1, 1.2, 1.5, 1.6, 1.7, 1.8, 1.9, 8.1, 8.2, 8.5_

- [x] 4. Checkpoint — Core computation complete
  - Ensure all unit and property tests pass (`npx vitest run` in `app/frontend`), ask the user if questions arise.

- [x] 5. New components — BattleLevelStats and StableRewards
  - [x] 5.1 Implement BattleLevelStats component
    - Create `app/frontend/src/components/battle-detail/BattleLevelStats.tsx`
    - Display combat-specific outcomes per robot: damage dealt, final HP as percentage of maxHP, ELO change (before → after with diff), battle duration, and battle outcome (💀 Destroyed in error color / 🏳️ Yielded in warning color / ✅ Survived in success color with HP percentage)
    - Use `yielded` and `destroyed` booleans from the BattleLogResponse robot objects (added in task 1.2)
    - Render `RobotImage` (small, 64×64px) next to each robot's name
    - Handle tag_team (show per-team grouping) and koth (show per-participant) layouts
    - Use design system colors, typography, and spacing (p-3, mb-3, gap-3)
    - _Requirements: 2.1, 2.3, 2.6, 6.1, 6.2, 6.3, 6.6, 9.1, 9.2_

  - [x] 5.2 Implement StableRewards component
    - Create `app/frontend/src/components/battle-detail/StableRewards.tsx`
    - Display stable-level economic effects: credits earned (win/loss reward), prestige, fame, streaming revenue with separate line items and total
    - Label the section "Stable Rewards" with a distinct visual boundary (separate card) from BattleLevelStats
    - For tag_team: show per-team aggregates with expandable per-robot breakdown
    - For koth: show per-participant rewards in the KotH results table
    - Render `RobotImage` (small, 64×64px) next to each robot's name in reward rows
    - Use design system colors: info (#a371f7) for prestige, warning (#d29922) for fame, success (#3fb950) for credits, cyan-400 for streaming
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 6.1, 6.2, 6.3, 6.6, 9.1, 9.2_

  - [x] 5.3 Remove BattleSummary and update barrel exports
    - Delete `app/frontend/src/components/battle-detail/BattleSummary.tsx`
    - Update `app/frontend/src/components/battle-detail/index.ts`: remove `BattleSummary` export, add `BattleLevelStats` and `StableRewards` exports
    - Update `app/frontend/src/components/battle-detail/types.ts`: remove `BattleSummaryProps`, add `BattleLevelStatsProps` and `StableRewardsProps` interfaces
    - Update `app/frontend/src/pages/BattleDetailPage.tsx`: replace `BattleSummary` import with `BattleLevelStats` and `StableRewards`
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 6. New components — BattleStatisticsSummary and AttributeTooltip
  - [x] 6.1 Implement AttributeTooltip component
    - Create `app/frontend/src/components/battle-detail/AttributeTooltip.tsx`
    - Implement the `STAT_ATTRIBUTE_MAP` static lookup table mapping each stat (hitRate, critRate, critDamage, damage, malfunction, counterChance, attackSpeed, shieldRegen, penetration) to attacker and defender attributes with category and effect direction, as specified in design Section 3
    - Render an info icon (ℹ️) that shows a tooltip on hover/tap with two groups: "Attacker" and "Defender", listing attribute names with category color coding and increase/decrease effect
    - No formula numbers shown — only attribute names and their role
    - _Requirements: 1.4_

  - [x] 6.2 Implement BattleStatisticsSummary component
    - Create `app/frontend/src/components/battle-detail/BattleStatisticsSummary.tsx`
    - Accept `BattleStatistics` object and `battleType` as props
    - Render per-robot columns showing: main hand stats (attacks, hits, misses, criticals, malfunctions with hit rate %), offhand stats (if dual-wield), counters (triggered, hits, misses), hit severity breakdown ("3 hits: 1 glancing, 1 solid, 1 devastating"), shield stats (damage absorbed, shield recharged), damage totals (dealt, received)
    - Display hit rate and crit rate as percentage bars
    - For tag_team: team aggregate row above individual robot rows
    - For koth: scrollable grid for 3+ robots
    - Include `AttributeTooltip` info icons next to each stat label
    - Render `RobotImage` (small, 64×64px) next to each robot's column header
    - Display "No combat data available" when `statistics.hasData` is false
    - Use design system colors, typography, and spacing
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 6.1, 6.2, 6.3, 6.6, 9.1, 9.2_

  - [x] 6.3 Write unit tests for BattleStatisticsSummary
    - Create `app/frontend/src/components/battle-detail/__tests__/BattleStatisticsSummary.test.tsx`
    - Test cases: renders per-robot stats for 1v1 battle; renders team aggregates for tag_team battle; renders all participants for koth battle; renders "No combat data available" for empty events; AttributeTooltip shows correct attribute names on hover; renders main/offhand split for dual-wield robots
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 7. New component — DamageFlowDiagram (Sankey)
  - [x] 7.1 Implement DamageFlowDiagram component
    - Create `app/frontend/src/components/battle-detail/DamageFlowDiagram.tsx`
    - Use Recharts `<Sankey>` component (already installed as `recharts@^3.8.0`) to render damage flows
    - Verify the Sankey component exists in the installed version; if missing, fall back to a custom SVG implementation or `d3-sankey` directly
    - Nodes = robot names, Links = damage flows with value = total damage
    - Node colors from design system category palette: #f85149 (combat/red), #58a6ff (defense/blue), #3fb950 (chassis/green), #d29922 (AI/yellow), #a371f7 (team/purple), #e6edf3 (neutral)
    - For 1v1: two nodes with bidirectional flows; for tag_team: four nodes; for koth: up to six nodes
    - Tooltip on hover: "{source} → {target}: {damage} damage"
    - SVG with dark background matching surface color; minimum height 200px for 1v1, 300px for multi-robot
    - Display "No damage data" message when damageFlows is empty
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [x] 7.2 Write unit tests for DamageFlowDiagram
    - Create `app/frontend/src/components/battle-detail/__tests__/DamageFlowDiagram.test.tsx`
    - Test cases: renders Sankey diagram with 2 nodes for 1v1; renders "No damage data" when damageFlows is empty; tooltip shows correct format "{source} → {target}: {damage} damage"
    - _Requirements: 3.1, 3.2, 3.7_

- [x] 8. New component — TabLayout
  - [x] 8.1 Implement TabLayout component
    - Create `app/frontend/src/components/battle-detail/TabLayout.tsx`
    - Define `TabId = 'overview' | 'playback' | 'combat-log'`
    - Accept props: `activeTab`, `onTabChange`, `hasPlayback`, `children` (overview, playback, combatLog ReactNode)
    - Render horizontal tab bar with three tabs; active tab has `border-b-2 border-primary text-primary`; inactive tabs use `text-secondary` with hover transition
    - Tab bar background: `bg-surface-elevated`
    - When `hasPlayback` is false, hide the "Playback" tab
    - Tab state defaults to "overview" on initial load
    - Use design system motion: 150ms ease-out hover transitions
    - Respect `prefers-reduced-motion` media query
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 6.4, 6.5_

  - [x] 8.2 Write unit tests for TabLayout
    - Create `app/frontend/src/components/battle-detail/__tests__/TabLayout.test.tsx`
    - Test cases: renders tab bar with 3 tabs; hides Playback tab when `hasPlayback` is false; active tab shows correct content; clicking a tab calls `onTabChange` with correct TabId
    - _Requirements: 5.1, 5.2, 5.3, 5.8_

  - [x] 8.3 Add property-based tests for canvas sizing and total credits
    - Add to `app/frontend/src/utils/__tests__/battleStatistics.property.test.ts` (or create a separate file if cleaner)
    - **Property 5: Canvas size clamping and aspect ratio** — for any container width in [100, 1000], computed display size is clamped to [300, 500] and width === height. Tag: `Feature: battle-report-overhaul, Property 5: Canvas size clamping and aspect ratio`. Validates: Requirements 4.1, 4.4
    - **Property 6: Total credits computation** — for any non-negative reward and streamingRevenue, total credits equals reward + streamingRevenue. Tag: `Feature: battle-report-overhaul, Property 6: Total credits computation`. Validates: Requirement 7.3
    - _Requirements: 4.1, 4.4, 7.3_

- [x] 9. Checkpoint — New components complete
  - Ensure all new component tests pass (`npx vitest run` in `app/frontend`), ask the user if questions arise.

- [x] 10. BattleResultBanner redesign
  - [x] 10.1 Redesign BattleResultBanner component
    - Update `app/frontend/src/components/battle-detail/BattleResultBanner.tsx`
    - Implement two modes: participant (userId matches a robot's ownerId) and spectator (no match)
    - Participant mode: heading "Victory" (success), "Defeat" (error), or "Draw" (warning); subheading "by Destruction" / "by Yield" / "by Time Limit" / "by Zone Score" derived from `yielded`/`destroyed` fields; winner robot image (medium, full opacity) on left, loser (medium, reduced opacity) on right; background tint `bg-success/10`, `bg-error/10`, or `bg-warning/10` with matching border
    - Spectator mode: heading "{Winner Name} Wins" or "Draw" in primary color (#58a6ff); both robot images at equal emphasis; background `bg-primary/10` with `border-primary`
    - Tag team: show team stable names with 2 robot images per team grouped; participant/spectator variants
    - KotH: participant shows player's placement with robot image + winner info; spectator shows top 3 placements; color: 1st=success, 2-3=warning, 4+=secondary
    - Battle context line: battle type icon + league tier or tournament round + duration in `text-sm text-secondary`
    - Replace all raw Tailwind colors (bg-yellow-900, bg-orange-900, etc.) with design system tokens exclusively
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 6.1, 6.2, 6.3, 9.1, 9.2, 9.5, 9.6_

- [x] 11. Responsive ArenaCanvas and sprites
  - [x] 11.1 Create useContainerSize hook
    - Create `app/frontend/src/hooks/useContainerSize.ts`
    - Implement `useContainerSize(ref, options?)` using `ResizeObserver` to track container dimensions
    - Accept `minSize` and `maxSize` options, return clamped `{ width, height }`
    - Fall back to 500px fixed size if `ResizeObserver` is not supported
    - Fall back to `devicePixelRatio = 1` if undefined
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 11.2 Make ArenaCanvas responsive
    - Update `app/frontend/src/components/BattlePlaybackViewer/ArenaCanvas.tsx`
    - Remove `const CANVAS_SIZE = 500` constant
    - Use `useContainerSize` hook to observe parent container width, clamp to [300, 500]
    - Set canvas pixel dimensions to `displaySize * window.devicePixelRatio` for HiDPI rendering
    - Set CSS display size to `displaySize × displaySize` (1:1 aspect ratio)
    - Replace inline `style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}` with responsive CSS
    - Replace the wrapper div's hardcoded `style={{ width: CANVAS_SIZE, height: CANVAS_SIZE, flexShrink: 0 }}` with responsive CSS classes
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 11.3 Update BattlePlaybackViewer container for responsive layout
    - Update `app/frontend/src/components/BattlePlaybackViewer/BattlePlaybackViewer.tsx`
    - Remove `style={{ width: 500 }}` from the arena column div
    - Use responsive CSS: `w-full max-w-[500px]` on the arena column
    - Combat log panel height adapts to match arena height
    - _Requirements: 4.7_

  - [x] 11.4 Update arena background and boundary rendering
    - Update `app/frontend/src/components/BattlePlaybackViewer/canvasRenderer.ts`
    - Replace `clearCanvas()` with `renderArenaBackground()` that draws a subtle radial grid: concentric circles at 25%/50%/75% of arena radius using `#1a1f29`, plus radial gradient from `#0a0e14` center to `#0f1318` edge
    - Update arena boundary dashed circle to use design system tertiary color (`#57606a` instead of `#4B5563`)
    - Update `ArenaCanvas.tsx` canvas className from `bg-gray-900` to design system background color (`bg-background` or `#0a0e14`)
    - _Requirements: 4.6, 4.9, 6.1_

  - [x] 11.5 Create top-down robot sprite assets
    - Create directory `app/frontend/public/assets/arena-sprites/`
    - Create 16 PNG sprite files (64×64px, transparent background, dark metallic grayscale) per the sprite manifest in design Section 8: `robot-single-melee.png`, `robot-single-short.png`, `robot-single-mid.png`, `robot-single-long.png`, `robot-dual_wield-melee.png`, `robot-dual_wield-short.png`, `robot-dual_wield-mid.png`, `robot-dual_wield-long.png`, `robot-two_handed-melee.png`, `robot-two_handed-short.png`, `robot-two_handed-mid.png`, `robot-two_handed-long.png`, `robot-weapon_shield-melee.png`, `robot-weapon_shield-short.png`, `robot-weapon_shield-mid.png`, `robot-weapon_shield-long.png`
    - Use the image generation prompts from design Section 8 for AI image generation, or create placeholder sprites manually
    - _Requirements: 4.8_

  - [x] 11.6 Implement sprite rendering in canvasRenderer
    - Update `renderRobot()` in `app/frontend/src/components/BattlePlaybackViewer/canvasRenderer.ts` to accept optional `sprite: HTMLImageElement | undefined` parameter
    - If sprite provided: `ctx.save()` → `ctx.translate()` → `ctx.rotate(facingRad)` → `ctx.drawImage()` at `ROBOT_RADIUS * 2` size → team color ring overlay → `ctx.restore()`
    - If no sprite: render a styled geometric robot shape (hexagonal body with "head" bump) in team color — upgrade from plain circle
    - Team color applied as a tint overlay or colored outline ring around the sprite
    - _Requirements: 4.8_

  - [x] 11.7 Implement sprite preloading and selection in BattlePlaybackViewer
    - In `app/frontend/src/components/BattlePlaybackViewer/BattlePlaybackViewer.tsx`, add sprite preloading logic using a `useRef(new Map<string, HTMLImageElement>())` cache
    - Implement `getSpriteKey(loadoutType, rangeBand)` function
    - Preload sprites on battle data load using `loadoutType` and `rangeBand` from robot data (added in task 1.2)
    - Pass `spriteCache` ref to `ArenaCanvas` as a prop
    - Update `ArenaCanvas` to look up sprites by robot's loadout+range key and pass to `renderRobot()`
    - Handle load errors gracefully — fall back to geometric shape rendering
    - _Requirements: 4.8_

  - [x] 11.8 Fix KotH zone rotation visibility
    - Update `app/frontend/src/components/BattlePlaybackViewer/useKothPlaybackState.ts` to track both old and new zone positions during `zone_moving` → `zone_active` transitions
    - Update `renderKothZone()` in `canvasRenderer.ts` to show a visual transition during zone movement: fade out at old position and fade in at new position (or animated movement)
    - The zone transition must be visible to the player rather than snapping invisibly
    - _Requirements: 4.10_

- [x] 12. CompactBattleCard economic enhancement
  - [x] 12.1 Update CompactBattleCard with economic indicators
    - Update `app/frontend/src/components/CompactBattleCard.tsx`
    - Accept new props: `prestige?: number`, `fame?: number`, `streamingRevenue?: number`
    - Display `totalCredits = reward + (streamingRevenue ?? 0)` instead of just `reward`
    - Show `⭐+{prestige}` in info color (`#a371f7`) when prestige > 0
    - Show `🎖️+{fame}` in warning color (`#d29922`) when fame > 0
    - Omit indicators when values are 0 or undefined
    - Desktop layout (≥768px): prestige and fame indicators between the date column and the ELO change column
    - Mobile layout (<768px): prestige and fame in the stats row alongside ELO and credits
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.6, 7.7, 7.8_

  - [x] 12.2 Write unit tests for CompactBattleCard economic indicators
    - Create or extend `app/frontend/src/components/__tests__/CompactBattleCard.test.tsx`
    - Test cases: displays prestige indicator when prestige > 0; displays fame indicator when fame > 0; displays total credits (base + streaming); omits prestige when 0 or undefined; omits fame when 0 or undefined; prestige uses info color (#a371f7); fame uses warning color (#d29922)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.6_

- [x] 13. BattleDetailPage integration — wire everything together
  - [x] 13.1 Integrate TabLayout and new components into BattleDetailPage
    - Update `app/frontend/src/pages/BattleDetailPage.tsx`
    - Import and call `computeBattleStatistics` once when battle data loads, passing events, duration, battleType, tagTeamInfo, and robotMaxHP
    - Add `useMediaQuery` or Tailwind `lg:` breakpoint check (1024px) to switch between TabLayout and stacked layout
    - Desktop (≥1024px): render `<TabLayout>` with Overview tab (BattleResultBanner, BattleStatisticsSummary, BattleLevelStats, StableRewards, DamageFlowDiagram, ArenaSummary), Playback tab (BattlePlaybackViewer), Combat Log tab (CombatMessages)
    - Mobile (<1024px): render all sections in vertically stacked layout without tabs
    - Set `hasPlayback` based on whether `arenaRadius` exists in battle data; when false, hide Playback tab and include CombatMessages in Overview tab
    - Tab state defaults to "overview", preserved across data refreshes via component state
    - Remove the old `BattleSummary` usage (replaced by BattleLevelStats + StableRewards in task 5.3)
    - Pass `userId` to BattleResultBanner for participant/spectator detection
    - _Requirements: 1.3, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.8, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 13.2 Apply design system consistency to BattleDetailPage
    - Ensure page background uses `bg-background` (#0a0e14)
    - Ensure all cards use `bg-surface` (#1a1f29) and raised elements use `bg-surface-elevated` (#252b38)
    - Ensure typography follows design system: `text-3xl font-bold` for page title, `text-lg font-bold` for section headings, `text-sm` for body, `text-xs` for labels
    - Ensure accent colors: success for victories, error for defeats, warning for draws, info for prestige, primary for links
    - Ensure motion: 150ms ease-out hover transitions, 2px card hover lift, 200-300ms fade transitions
    - Ensure `prefers-reduced-motion` is respected
    - Ensure consistent spacing: p-3 card padding, mb-3 card margins, gap-3 grid gaps
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 13.3 Wire CompactBattleCard economic props in BattleHistoryPage
    - Update the BattleHistoryPage (or wherever CompactBattleCard is rendered) to pass `prestige`, `fame`, and `streamingRevenue` props from the `BattleHistory` API response to each `CompactBattleCard`
    - Map `battle.prestigeAwarded` → `prestige`, `battle.fameAwarded` → `fame`, `battle.streamingRevenue` → `streamingRevenue`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.7, 7.8_

  - [x] 13.4 Update barrel exports and types for all new components
    - Ensure `app/frontend/src/components/battle-detail/index.ts` exports: `BattleStatisticsSummary`, `BattleLevelStats`, `StableRewards`, `DamageFlowDiagram`, `TabLayout`, `AttributeTooltip` (and removes `BattleSummary`)
    - Ensure `app/frontend/src/components/battle-detail/types.ts` includes prop interfaces for all new components
    - _Requirements: 1.3, 2.1, 2.2, 5.1_

- [x] 14. Checkpoint — Integration complete
  - Ensure all tests pass (`npx vitest run` in `app/frontend` and `npm test` in `app/backend`), ask the user if questions arise.

- [x] 15. Existing test updates
  - [x] 15.1 Update KothMatchCards test fixtures
    - Update `app/frontend/src/components/__tests__/KothMatchCards.test.tsx`
    - Add new optional props (`prestige`, `fame`, `streamingRevenue`) to CompactBattleCard test fixtures
    - Add test cases for prestige/fame indicator rendering on KotH battle cards
    - Existing tests continue to pass (new props are optional)
    - _Requirements: 7.1, 7.2, 7.4_

  - [x] 15.2 Update BattlePlaybackViewer test assertions
    - Update `app/frontend/src/components/BattlePlaybackViewer/__tests__/BattlePlaybackViewer.test.tsx`
    - Update any layout assertions that reference hardcoded 500px dimensions to account for responsive sizing
    - Component props interface is unchanged — most tests survive as-is
    - _Requirements: 4.5, 4.7_

- [x] 16. Documentation updates
  - [x] 16.1 Update frontend-standards steering file
    - Update `.kiro/steering/frontend-standards.md`
    - Add the `useContainerSize` hook pattern as a recommended approach for responsive canvas/container sizing
    - Document the tab layout pattern: desktop tabs (≥1024px) / mobile stacked (<1024px) using `TabLayout` component
    - Reference the `computeBattleStatistics` pure function pattern as an example of client-side data derivation from API responses
    - _Requirements: 5.1, 5.2, 4.1_

  - [x] 16.2 Update Design System Quick Reference
    - Update `docs/design_ux/DESIGN_SYSTEM_QUICK_REFERENCE.md`
    - Update the "Battle Result Format" section to reflect the new tabbed layout, statistics summary, and Sankey diagram
    - Add the tab component pattern (TabLayout with active/inactive styling) to the "Component Patterns" section
    - Add the arena sprite asset naming convention to the "Asset File Naming" section
    - _Requirements: 6.1, 6.2, 6.3, 6.6_

  - [x] 16.3 Update Battle History PRD
    - Update `docs/prd_pages/PRD_BATTLE_HISTORY_PAGE.md` to document the new CompactBattleCard economic indicators (prestige, fame, total credits) and the new API fields (`prestigeAwarded`, `fameAwarded`, `streamingRevenue`)
    - _Requirements: 7.1, 7.2, 7.3, 7.5_

- [x] 17. Final verification
  - [x] 17.1 Run all tests and verification criteria
    - Run `npm test` in `app/backend` — all tests pass
    - Run `npx vitest run` in `app/frontend` — all tests pass
    - Verify new test files exist: `app/frontend/src/utils/__tests__/battleStatistics.test.ts`, `app/frontend/src/utils/__tests__/battleStatistics.property.test.ts`, `app/frontend/src/components/battle-detail/__tests__/BattleStatisticsSummary.test.tsx`, `app/frontend/src/components/battle-detail/__tests__/DamageFlowDiagram.test.tsx`, `app/frontend/src/components/battle-detail/__tests__/TabLayout.test.tsx`
    - Run verification criteria from requirements:
      1. `grep -r "CANVAS_SIZE = 500" app/frontend/src/components/BattlePlaybackViewer/` returns 0 results
      2. `grep -r "style={{ width: 500" app/frontend/src/components/BattlePlaybackViewer/` returns 0 results
      3. `grep -rn "prestigeAwarded\|fameAwarded\|streamingRevenue" app/frontend/src/components/CompactBattleCard.tsx` returns matches
      4. BattleDetailPage renders tab bar with "Overview", "Playback", "Combat Log" at ≥1024px (manual or Playwright)
      5. BattleStatisticsSummary component exists and unit tests pass
      6. DamageFlowDiagram component exists and renders for league, tag_team, koth
      7. `grep -rn "Stable Rewards\|stable-rewards\|StableRewards" app/frontend/src/components/battle-detail/` returns matches
      8. `ls app/frontend/src/components/battle-detail/BattleSummary.tsx` returns "No such file"
      9. `grep -rn "BattleSummary" app/frontend/src/components/battle-detail/index.ts` returns 0 results
      10. All tests pass (confirmed above)
    - _Requirements: all (1.1–1.10, 2.1–2.6, 3.1–3.7, 4.1–4.10, 5.1–5.8, 6.1–6.6, 7.1–7.8, 8.1–8.5, 9.1–9.6, 10.1–10.7)_

## Requirements Traceability Matrix

| Requirement | Acceptance Criteria | Covered by Tasks |
|---|---|---|
| 1. Battle Statistics Summary | 1.1 | 3.1, 3.2, 3.3, 6.2, 6.3 |
| | 1.2 | 3.1, 3.2, 3.3, 6.2, 6.3 |
| | 1.3 | 6.2, 6.3, 13.1, 13.4 |
| | 1.4 | 6.1, 6.2, 6.3 |
| | 1.5 | 3.1, 3.2, 3.3, 6.2, 6.3 |
| | 1.6 | 3.1, 3.2, 3.3, 6.2, 6.3 |
| | 1.7 | 3.1, 3.2, 3.3, 6.2 |
| | 1.8 | 3.1, 3.2, 3.3, 6.2 |
| | 1.9 | 3.1, 3.2, 3.3, 6.2 |
| | 1.10 | 3.1, 3.2, 6.2 |
| 2. Stable vs Battle Separation | 2.1 | 5.1, 5.3, 13.4 |
| | 2.2 | 5.2, 5.3, 13.4 |
| | 2.3 | 5.1, 5.2, 5.3 |
| | 2.4 | 5.2 |
| | 2.5 | 5.2 |
| | 2.6 | 1.2, 5.1 |
| 3. Sankey Damage Flow | 3.1 | 7.1, 7.2, 3.3 |
| | 3.2 | 7.1, 7.2 |
| | 3.3 | 7.1 |
| | 3.4 | 7.1 |
| | 3.5 | 3.1, 3.3, 7.1 |
| | 3.6 | 7.1 |
| | 3.7 | 7.1, 7.2 |
| 4. Responsive Playback | 4.1 | 11.1, 11.2, 8.3 |
| | 4.2 | 11.1, 11.2 |
| | 4.3 | 11.1, 11.2 |
| | 4.4 | 11.2, 8.3 |
| | 4.5 | 11.2, 15.2 |
| | 4.6 | 11.4 |
| | 4.7 | 11.3, 15.2 |
| | 4.8 | 11.5, 11.6, 11.7 |
| | 4.9 | 11.4 |
| | 4.10 | 11.8 |
| 5. Tabbed Layout | 5.1 | 8.1, 8.2, 13.1, 13.4 |
| | 5.2 | 8.1, 8.2, 13.1 |
| | 5.3 | 8.1, 8.2, 13.1 |
| | 5.4 | 8.1, 13.1 |
| | 5.5 | 8.1, 13.1 |
| | 5.6 | 8.1, 13.1 |
| | 5.7 | 8.1 |
| | 5.8 | 8.1, 8.2, 13.1 |
| 6. Design System | 6.1 | 5.1, 5.2, 6.2, 7.1, 10.1, 11.4, 13.1, 13.2 |
| | 6.2 | 5.1, 5.2, 6.2, 10.1, 13.1, 13.2 |
| | 6.3 | 5.1, 5.2, 6.2, 10.1, 13.1, 13.2 |
| | 6.4 | 8.1, 13.1, 13.2 |
| | 6.5 | 8.1, 13.1, 13.2 |
| | 6.6 | 5.1, 5.2, 6.2, 13.1, 13.2 |
| 7. CompactBattleCard | 7.1 | 12.1, 12.2, 13.3, 15.1 |
| | 7.2 | 12.1, 12.2, 13.3, 15.1 |
| | 7.3 | 12.1, 12.2, 8.3, 13.3 |
| | 7.4 | 12.1, 12.2, 13.3, 15.1 |
| | 7.5 | 1.1, 1.3, 13.3 |
| | 7.6 | 12.1, 12.2 |
| | 7.7 | 12.1, 13.3 |
| | 7.8 | 12.1, 13.3 |
| 8. Statistics Computation | 8.1 | 3.1, 3.2, 3.3 |
| | 8.2 | 3.1, 3.2, 3.3 |
| | 8.3 | 3.1 |
| | 8.4 | 3.1, 3.2 |
| | 8.5 | 3.1, 3.3 |
| 9. Robot Images | 9.1 | 5.1, 5.2, 6.2, 10.1 |
| | 9.2 | 5.1, 5.2, 6.2, 10.1 |
| | 9.3 | 1.2 |
| | 9.4 | 5.1, 5.2, 6.2, 10.1 |
| | 9.5 | 5.1, 5.2, 10.1 |
| | 9.6 | 5.1, 5.2, 6.2, 10.1 |
| 10. Result Banner | 10.1 | 10.1 |
| | 10.2 | 10.1 |
| | 10.3 | 10.1 |
| | 10.4 | 10.1 |
| | 10.5 | 10.1 |
| | 10.6 | 10.1 |
| | 10.7 | 10.1 |

## Notes

- All tasks are mandatory — none are marked optional
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The 16 robot sprite assets (task 11.5) are a separate creative task — use AI image generation or create placeholder sprites
- Backend changes are minimal (no schema migrations) — only API response formatting changes
