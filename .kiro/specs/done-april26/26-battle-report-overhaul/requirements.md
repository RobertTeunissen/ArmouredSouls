# Requirements Document

## Introduction

Overhaul the Battle Report detail page (`/battle/:id`) and enhance the CompactBattleCard on the Battle History list page (`/battle-history`). The current Battle Report page stacks all content vertically, mixes battle-level and stable-level economic data in a single summary, lacks statistical analysis of combat events, has a hardcoded 500×500px playback canvas that breaks on mobile, and does not fully align with the dark industrial design system. This feature adds a structured statistics summary, a Sankey-style damage flow diagram, responsive playback viewer, tabbed layout, design system alignment, and improved economic visibility on the CompactBattleCard. Corresponds to backlog item #14.

## Glossary

- **Battle_Report_Page**: The page at route `/battle/:id` that displays detailed information about a completed battle, including result banner, summary, arena data, playback viewer, and combat log.
- **Battle_Statistics_Summary**: A new component that computes and displays aggregate combat statistics (attacks, hits, misses, criticals, malfunctions, shield absorbs, counters) derived from the battle log events array.
- **Attribute_Tooltip**: An informational tooltip or info icon that maps a combat statistic to ALL robot attributes that influence it, on both the attacker and defender side (e.g., hit chance is affected by attacker's targetingSystems, combatAlgorithms, adaptiveAI, logicCores, stance AND defender's evasionThrusters, gyroStabilizers).
- **Stable_Level_Effects**: Economic outcomes of a battle that affect the player's stable rather than the battle itself: prestige awarded, fame awarded, streaming revenue, and total credits earned.
- **Battle_Level_Stats**: Combat-specific outcomes: damage dealt, final HP, ELO change, and battle duration.
- **Sankey_Diagram**: A flow diagram showing directed damage relationships between combatants, with flow width proportional to damage dealt.
- **Arena_Canvas**: The HTML Canvas element in the BattlePlaybackViewer that renders the 2D arena, currently hardcoded at 500×500px.
- **Tab_Layout**: A tabbed navigation pattern (Overview / Playback / Combat Log) used on desktop viewports, collapsing to stacked sections on mobile.
- **CompactBattleCard**: The compact battle entry component on the `/battle-history` page that shows battle outcome, matchup, ELO change, and reward.
- **Design_System**: The dark industrial visual theme defined in `docs/design_ux/DESIGN_SYSTEM_QUICK_REFERENCE.md` with specific colors, typography, spacing, and motion guidelines.
- **NarrativeEvent**: A battle log event object containing timestamp, type, message, and optional attacker/defender/weapon/damage/hit/critical/malfunction fields.
- **BattleParticipant**: The database model storing per-robot battle outcomes including credits, streamingRevenue, prestigeAwarded, fameAwarded, damageDealt, finalHP, eloBefore, eloAfter, yielded, and destroyed.

## Expected Contribution

This spec addresses backlog item #14 (Battle Report Layout Overhaul), which received 9 combined player votes — the strongest player signal in the backlog. The current battle report undersells combat data, hides economic context, and breaks on mobile.

1. **Battle outcome visibility**: Players currently see a flat list of combat messages with no aggregate analysis. After: a structured statistics summary shows hit rates, crit rates, malfunctions, shield absorbs — connecting robot attributes to combat outcomes. Before: 0 statistical summaries. After: 1 per battle report.
2. **Economic clarity**: Prestige, fame, streaming revenue, and credits are currently mixed with battle stats in a single summary card. After: stable-level economic effects are visually separated from battle-level combat stats. Before: 1 mixed summary card. After: 2 distinct sections.
3. **Mobile playback**: The ArenaCanvas is hardcoded at 500×500px and overflows on mobile viewports. After: responsive canvas scales from 300px to 500px based on viewport. Before: 0 mobile-responsive breakpoints in the playback viewer. After: full responsive scaling.
4. **Page information density**: Adding statistics, Sankey diagram, and separated sections to the existing vertical stack would overwhelm the page. After: tabbed layout on desktop (Overview / Playback / Combat Log) organizes content into digestible sections. Before: 1 vertical stack. After: 3 tabs on desktop, stacked sections on mobile.
5. **Core loop progression visibility**: CompactBattleCard on the history list shows only ELO change and base reward. After: prestige, fame, and total credits (including streaming revenue) are visible per battle. Before: 2 progression indicators per card (ELO, reward). After: 4 indicators (ELO, total credits, prestige, fame).
6. **Design system alignment**: The battle report page uses inconsistent spacing, colors, and typography compared to the rest of the site. After: all components follow the design system quick reference. Before: mixed adherence. After: full alignment with documented design tokens.

### Verification Criteria

1. `grep -r "CANVAS_SIZE = 500" app/frontend/src/components/BattlePlaybackViewer/` returns 0 results (hardcoded canvas size removed).
2. `grep -r "style={{ width: 500" app/frontend/src/components/BattlePlaybackViewer/` returns 0 results (hardcoded inline widths removed).
3. `grep -rn "prestigeAwarded\|fameAwarded\|streamingRevenue" app/frontend/src/components/CompactBattleCard.tsx` returns matches (economic fields rendered on compact card).
4. The BattleDetailPage renders a tab bar with "Overview", "Playback", and "Combat Log" tabs at viewport widths ≥ 1024px (manual verification or Playwright test).
5. The BattleStatisticsSummary component exists and computes aggregate stats from battle log events (file exists at expected path, unit tests pass).
6. A Sankey-style damage flow diagram component exists and renders for league, tag_team, and koth battle types (file exists, renders without errors).
7. `grep -rn "Stable Rewards\|stable-rewards\|StableRewards" app/frontend/src/components/battle-detail/` returns matches (stable-level effects are visually separated).
8. `ls app/frontend/src/components/battle-detail/BattleSummary.tsx` returns "No such file" (old mixed summary component removed, replaced by BattleLevelStats + StableRewards).
9. `grep -rn "BattleSummary" app/frontend/src/components/battle-detail/index.ts` returns 0 results (old export removed).
10. All existing tests pass after changes: `npm test` in `app/frontend` exits 0. New test files exist at expected paths: `battleStatistics.test.ts`, `battleStatistics.property.test.ts`, `BattleStatisticsSummary.test.tsx`, `DamageFlowDiagram.test.tsx`, `TabLayout.test.tsx`.

## Requirements

### Requirement 1: Battle Statistics Summary

**User Story:** As a player, I want to see a structured statistical breakdown of my battle, so that I can understand how my robot's attributes translated into combat outcomes.

#### Acceptance Criteria

1. WHEN a Battle Report is loaded, THE Battle_Statistics_Summary SHALL compute aggregate statistics from the battle log events array, including: total attack opportunities, hits, misses, criticals, malfunctions, counters (triggered, hit, missed), shield damage absorbed, total shield recharged, and battle duration.
2. WHEN a Battle Report is loaded for a battle with two or more participants, THE Battle_Statistics_Summary SHALL display per-robot statistics showing each robot's individual hit count, miss count, critical count, malfunction count, counter count (triggered, hit, missed), damage dealt, damage received, shield damage absorbed, and shield recharged.
3. THE Battle_Statistics_Summary SHALL display alongside the existing combat messages, without replacing or removing the combat log.
4. WHEN a player hovers over or taps an info icon next to a combat statistic, THE Attribute_Tooltip SHALL display ALL robot attributes that influence that statistic, grouped by attacker and defender role. For example, hit chance SHALL show attacker attributes (targetingSystems, combatAlgorithms, adaptiveAI, logicCores, stance) and defender attributes (evasionThrusters, gyroStabilizers). The tooltip SHALL not expose formula numbers — only attribute names and their role (increases/decreases the stat).
5. WHEN a Battle Report is loaded for a tag_team battle, THE Battle_Statistics_Summary SHALL aggregate statistics per team (2 robots each) in addition to per-robot statistics.
6. WHEN a Battle Report is loaded for a koth battle, THE Battle_Statistics_Summary SHALL display statistics for all participants (up to 6 robots), grouped by individual robot.
7. THE Battle_Statistics_Summary SHALL classify each successful hit into a severity grade based on the damage dealt relative to the defender's max HP: "Glancing" (< 5%), "Solid" (5–15%), "Heavy" (15–30%), "Devastating" (> 30%). The summary SHALL display the count of hits per grade per robot (e.g., "3 hits: 1 glancing, 1 solid, 1 devastating") without showing raw damage numbers.
8. THE Battle_Statistics_Summary SHALL separate main hand and offhand statistics. For robots with dual-wield loadouts, the summary SHALL show per-hand breakdowns: main hand attacks/hits/misses/malfunctions and offhand attacks/hits/misses/malfunctions, using the `hand` field on each event.
9. THE Battle_Statistics_Summary SHALL track counter-attacks as a distinct category: counters triggered (total), counter hits, counter misses, and counter damage dealt. Counter events have `type === 'counter'` with swapped attacker/defender roles (the defender becomes the attacker). Counter hit/miss is determined by the `hit` field on the counter event.
10. THE Battle_Statistics_Summary SHALL display total shield damage absorbed per robot (sum of `shieldDamage` from events where the robot is the defender) and total shield recharged per robot (computed from positive shield value changes between consecutive events using the `robotShield` map).

### Requirement 2: Stable-Level vs Battle-Level Separation

**User Story:** As a player, I want battle stats and economic effects visually separated, so that I can distinguish what happened in combat from what my stable earned.

#### Acceptance Criteria

1. THE Battle_Report_Page SHALL display Battle_Level_Stats (damage dealt, final HP, ELO change, battle duration, and battle outcome per robot: destroyed, yielded, or survived) in a distinct visual group labeled with a battle-related heading.
2. THE Battle_Report_Page SHALL display Stable_Level_Effects (credits earned from win/loss, prestige awarded, fame awarded, streaming revenue) in a separate visual group labeled "Stable Rewards" or equivalent.
3. THE Battle_Report_Page SHALL render the Battle_Level_Stats group and the Stable_Level_Effects group with distinct visual boundaries (separate cards, dividers, or background treatments) so that a player can distinguish them at a glance.
4. WHEN a Battle Report is loaded for a tag_team battle, THE Battle_Report_Page SHALL display Stable_Level_Effects aggregated per team, with per-robot breakdown available.
5. WHEN a Battle Report is loaded for a koth battle, THE Battle_Report_Page SHALL display Stable_Level_Effects per participant in the KotH results table.
6. THE BattleLogResponse SHALL include `yielded` and `destroyed` boolean fields for each robot (robot1, robot2), sourced from the BattleParticipant model. For KotH, `destroyed` is already included per participant.

### Requirement 3: Sankey-Style Damage Flow Diagram

**User Story:** As a player, I want a visual diagram showing who dealt damage to whom, so that I can quickly understand damage distribution in multi-robot battles.

#### Acceptance Criteria

1. WHEN a Battle Report is loaded, THE Battle_Report_Page SHALL render a Sankey_Diagram showing directed damage flows between combatants, with flow width proportional to damage dealt.
2. WHEN a Battle Report is loaded for a league or tournament battle (2 robots), THE Sankey_Diagram SHALL display bidirectional damage flows between the two combatants.
3. WHEN a Battle Report is loaded for a tag_team battle (4 robots), THE Sankey_Diagram SHALL display damage flows between all robots that dealt damage to each other.
4. WHEN a Battle Report is loaded for a koth battle (up to 6 robots), THE Sankey_Diagram SHALL display damage flows between all participants that dealt damage to each other.
5. THE Sankey_Diagram SHALL derive damage flow data by aggregating attacker-defender-damage tuples from the battle log events array.
6. THE Sankey_Diagram SHALL use the Design_System color palette, assigning distinct colors per robot or team.
7. WHEN a player hovers over a damage flow in the Sankey_Diagram, THE Sankey_Diagram SHALL display a tooltip showing the source robot name, target robot name, and total damage value.

### Requirement 4: Responsive Playback Viewer

**User Story:** As a player on a mobile device, I want the battle playback viewer to scale to my screen size, so that I can watch battle replays on any device.

#### Acceptance Criteria

1. THE Arena_Canvas SHALL scale responsively to fit the available container width, with a minimum size of 300px and a maximum size of 500px.
2. WHILE the viewport width is less than 768px, THE Arena_Canvas SHALL occupy the full available width minus horizontal padding.
3. WHILE the viewport width is 768px or greater, THE Arena_Canvas SHALL render at a fixed 500px width within the playback layout.
4. THE Arena_Canvas SHALL maintain a 1:1 aspect ratio at all rendered sizes.
5. THE Arena_Canvas SHALL replace the current inline `style={{ width: 500, height: 500 }}` with responsive CSS that adapts to the container.
6. THE Arena_Canvas SHALL use Design_System colors for the canvas background (#0a0e14 or surface equivalent) and arena boundary rendering.
7. THE BattlePlaybackViewer container SHALL use responsive CSS instead of the current hardcoded `style={{ width: 500 }}` on the arena column.
8. THE Arena_Canvas SHALL render robots as top-down robot sprites instead of plain colored circles. Sprites SHALL vary by loadout type (single, weapon_shield, two_handed, dual_wield) and primary weapon range band (melee, short, mid, long), giving visual feedback about each robot's equipment. Sprites SHALL be tinted with the robot's team color and rotate to match the robot's facing direction. WHEN a sprite is not available for a combination, the canvas SHALL fall back to a styled geometric robot shape with team color.
9. THE Arena_Canvas SHALL render the arena background with a subtle radial grid pattern or gradient to give depth, replacing the current plain black background. The grid SHALL use Design_System surface colors (#1a1f29 lines on #0a0e14 background).
10. FOR KotH battles with rotating zones, THE Arena_Canvas SHALL visually show the zone moving to its new position during `zone_moving` events, rather than snapping invisibly. The zone transition SHALL be visible to the player (e.g., fading out at old position and fading in at new position, or animated movement).

### Requirement 5: Tabbed Page Layout

**User Story:** As a player, I want the battle report organized into tabs on desktop, so that the page is not overwhelmed by the new additions.

#### Acceptance Criteria

1. WHILE the viewport width is 1024px or greater, THE Battle_Report_Page SHALL display content in a tabbed layout with tabs: "Overview", "Playback", and "Combat Log".
2. WHILE the viewport width is less than 1024px, THE Battle_Report_Page SHALL display all sections in a vertically stacked layout without tabs.
3. WHEN the "Overview" tab is selected, THE Battle_Report_Page SHALL display the Battle Result Banner, Battle_Statistics_Summary, Battle_Level_Stats, Stable_Level_Effects, Sankey_Diagram, and Arena Summary.
4. WHEN the "Playback" tab is selected, THE Battle_Report_Page SHALL display the BattlePlaybackViewer with arena canvas and playback controls.
5. WHEN the "Combat Log" tab is selected, THE Battle_Report_Page SHALL display the full combat messages list.
6. THE Battle_Report_Page SHALL preserve the currently selected tab when the page data refreshes, and default to the "Overview" tab on initial load.
7. THE tab navigation SHALL follow the Design_System styling: surface-elevated background for the tab bar, primary color (#58a6ff) for the active tab indicator, and text-secondary color for inactive tabs.
8. IF the battle has no spatial data (no arenaRadius), THEN THE Battle_Report_Page SHALL hide the "Playback" tab and display the combat log within the "Overview" tab.

### Requirement 6: Design System Consistency

**User Story:** As a player, I want the battle report page to match the rest of the site's dark industrial theme, so that the experience feels cohesive.

#### Acceptance Criteria

1. THE Battle_Report_Page SHALL use Design_System background color (#0a0e14) for the page background, surface color (#1a1f29) for card backgrounds, and surface-elevated color (#252b38) for raised elements.
2. THE Battle_Report_Page SHALL use Design_System typography: text-3xl font-bold for the page title, text-lg font-bold for section headings, text-sm for body text, and text-xs for labels.
3. THE Battle_Report_Page SHALL use Design_System accent colors: success (#3fb950) for victories and positive values, error (#f85149) for defeats and negative values, warning (#d29922) for draws and caution states, info (#a371f7) for prestige, and primary (#58a6ff) for links and interactive elements.
4. THE Battle_Report_Page SHALL use Design_System motion guidelines: hover transitions of 150ms ease-out, card hover lift of 2px, and fade transitions of 200-300ms.
5. THE Battle_Report_Page SHALL respect the `prefers-reduced-motion` media query by disabling animations when the user has requested reduced motion.
6. THE Battle_Report_Page SHALL use consistent spacing: p-3 for card padding, mb-3 for card margins, gap-3 for grid gaps, matching the existing component patterns.

### Requirement 7: CompactBattleCard Economic Enhancement

**User Story:** As a player, I want to see prestige, fame, and total credits earned on each battle card in my history, so that I can track my progression at a glance.

#### Acceptance Criteria

1. THE CompactBattleCard SHALL display prestige earned per battle using the format "⭐+{value}" when prestige is greater than zero.
2. THE CompactBattleCard SHALL display fame earned per battle using the format "🎖️+{value}" when fame is greater than zero.
3. THE CompactBattleCard SHALL display total credits earned (base reward + streaming revenue) instead of only the base battle reward.
4. WHEN prestige or fame values are not available in the BattleHistory API response, THE CompactBattleCard SHALL omit the respective indicator rather than displaying a zero value.
5. THE Battle History API response SHALL include prestigeAwarded, fameAwarded, and streamingRevenue fields per battle, sourced from the BattleParticipant records for the requesting user's robot.
6. THE CompactBattleCard SHALL render prestige in info color (#a371f7), fame in warning color (#d29922), and total credits in the existing text-primary color (#e6edf3).
7. WHILE the viewport width is less than 768px, THE CompactBattleCard SHALL display prestige and fame indicators in the stats row alongside ELO change and credits.
8. WHILE the viewport width is 768px or greater, THE CompactBattleCard SHALL display prestige and fame indicators between the date column and the ELO change column.

### Requirement 8: Battle Statistics Computation

**User Story:** As a developer, I want battle statistics computed from the event log on the frontend, so that no backend changes are needed for the statistics summary.

#### Acceptance Criteria

1. THE Battle_Statistics_Summary SHALL compute statistics by iterating over the `battleLog.events` array and counting events by type: "attack" (with hit=true), "miss" (or attack with hit=false), "critical", "malfunction", "counter", "shield_break", "shield_regen", "yield", and "destroyed".
2. THE Battle_Statistics_Summary SHALL compute per-robot hit rate as (hits / total attack opportunities) × 100, displayed as a percentage.
3. THE Battle_Statistics_Summary SHALL compute total battle duration from the `duration` field on the BattleLogResponse.
4. THE Battle_Statistics_Summary SHALL handle battles with zero attack events by displaying "No combat data available" instead of division-by-zero or NaN values.
5. FOR ALL valid battle log event arrays, computing statistics and then re-computing from the same array SHALL produce identical results (idempotent computation).

### Requirement 9: Robot Images in Battle Report

**User Story:** As a player, I want to see my robots' images in the battle report, so that I can quickly identify which robot is which — especially in tag team and KotH battles with multiple participants.

#### Acceptance Criteria

1. THE Battle_Report_Page SHALL display robot images (via the existing RobotImage component) next to each robot's name in the BattleResultBanner, BattleLevelStats, StableRewards, and BattleStatisticsSummary components.
2. THE Battle_Report_Page SHALL use the "small" size (64×64px) for robot images in statistics grids and stat rows, and "medium" size (128×128px) in the result banner.
3. THE BattleLogResponse SHALL include an `imageUrl` field (nullable) for each robot (robot1, robot2, tag team robots, KotH participants), sourced from the Robot model's `imageUrl` column.
4. WHEN a robot has no image (imageUrl is null), THE RobotImage component SHALL display the existing placeholder (🤖 icon with first letter of robot name).
5. WHEN a Battle Report is loaded for a tag_team battle, THE Battle_Report_Page SHALL display images for all 4 robots (2 active + 2 reserve per team), grouped by team.
6. WHEN a Battle Report is loaded for a koth battle, THE Battle_Report_Page SHALL display images for all participants (up to 6 robots) in the KotH results table and statistics grid.

### Requirement 10: Result Banner Redesign

**User Story:** As a player, I want the battle result banner to clearly show whether I won or lost, how the battle ended, and who fought — using the site's design language instead of confusing color codes.

#### Acceptance Criteria

1. THE BattleResultBanner SHALL use Design_System colors exclusively: success (#3fb950) for the viewing player's victory, error (#f85149) for the viewing player's defeat, warning (#d29922) for draws, and primary (#58a6ff) for neutral/spectator view. It SHALL NOT use raw Tailwind colors (bg-yellow-900, bg-orange-900, etc.).
2. WHEN the viewing player owns one of the participating robots, THE BattleResultBanner SHALL display the outcome from their perspective: "Victory", "Defeat", or "Draw". WHEN the viewing player does not own any participating robot (spectator view), THE BattleResultBanner SHALL display the outcome neutrally: "{Winner Name} Wins" or "Draw" — using primary color (#58a6ff) instead of success/error.
3. THE BattleResultBanner SHALL display how the battle ended: "by Destruction", "by Yield", "by Time Limit", or "by Zone Score" (KotH). This is derived from the `yielded` and `destroyed` fields on the BattleParticipant data.
4. THE BattleResultBanner SHALL display robot images (medium size) for both combatants. WHEN the viewing player owns a robot, the winner is visually emphasized and the loser de-emphasized (reduced opacity or smaller size). WHEN spectating, both robots are displayed at equal emphasis.
5. FOR tag_team battles, THE BattleResultBanner SHALL show both teams with their stable names and robot images grouped per team.
6. FOR koth battles, THE BattleResultBanner SHALL show the winner's placement and image. WHEN the viewing player owns a participant, it SHALL also show the player's robot placement. WHEN spectating, it SHALL show the top 3 placements.
7. THE BattleResultBanner SHALL display battle context: battle type icon, league tier or tournament round, and duration — consistent with the existing pattern but using Design_System typography (text-sm text-secondary for metadata).
