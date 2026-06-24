# Robot Detail Page Split — Analysis & Recommended Direction

**Source**: Backlog #37  
**Date**: June 2026  
**Status**: Analysis complete, ready to spec

---

## Problem Statement

The Robot Detail Page (`/robots/:id`) serves two fundamentally different mental states through 8 tabs on a single page:

| Tab | Owner-Only | Orientation |
|-----|-----------|-------------|
| Overview | No | Review — StatisticalRankings + PerformanceByContext |
| Matches | No | Review — RecentBattles + UpcomingMatches |
| Upgrades | Yes | Prepare — UpgradePlanner |
| Tuning | Yes | Prepare — TuningPoolEditor |
| Battle Config | Yes | Prepare — Weapons, stance, yield threshold |
| Stats | Yes | Review — EffectiveStatsDisplay |
| Analytics | No | Review — RobotPerformanceAnalytics |
| League History | No | Review — LeagueTimeline + TeamBattleLeagueHistory |

The page tries to be both a retrospective analytics viewer and a prospective preparation workspace. Neither gets the environment it deserves.

---

## Five Deeper Problems

### 1. Context Contamination
A player reviewing analytics is in a relaxed, exploratory mode. A player tuning attributes before a cycle is focused and making trade-offs under constraint (credits, pool points, weapon slots). Mixing them means neither context gets appropriate information density or layout.

### 2. Fragmented Preparation Flow
A player upgrading their robot currently bounces: Upgrades tab → Stats tab (did my effective damage go up?) → Tuning tab → Battle Config tab (should I change stance given new stats?). The tab structure hides related information that should be visible simultaneously during decision-making.

### 3. Wasted Scouting Potential
The Stats tab is owner-only. Overview and Analytics are public, but the effective stat sheet is hidden. Making all analytical data public would create a scouting meta — opponents look up rival robots before tournaments — generating engagement without new features.

### 4. No Multi-Robot Workflow
Managing a stable means repeating the same flow (navigate to robot → click tab → adjust → navigate back → next robot) for each robot. There's no way to flow through multiple robots without context-switching through the list page.

### 5. Deep Linking Fragility
Tab state is stored in `?tab=tuning` query params. Sharing a robot link might land someone on an owner-only tab they can't see. The URL structure doesn't express the two distinct intents.

---

## Recommended Solution: Two Pages

### Page 1: Robot Profile (`/robots/:id`)

**Intent: "Tell me about this robot."**

A scrollable single-page profile for owners and opponents alike. No tabs — content flows top-to-bottom as a narrative of the robot's career.

**Sections (scroll-based with sticky section nav for orientation):**
- Robot identity header (image, name, owner, ELO, league, record)
- Overview — statistical rankings, performance by context
- Effective stats (read-only stat sheet — moved here, made public)
- Match history — recent battles, upcoming scheduled matches
- Analytics — performance trends over time
- League history — timeline, team battle history, championship titles

**Key decisions:**
- Everything is public. Opponents can scout. Competitive depth for free.
- No action buttons — this page doesn't change the robot.
- Sticky section nav highlights as you scroll (like a Wikipedia article outline). Users can scroll freely or jump.

### Page 2: Workshop (`/robots/:id/prepare`)

**Intent: "Get this robot ready for battle."**

Owner-only preparation workspace. Three core sections presented as collapsible panels with adaptive behavior.

**Sections:**
1. **⚔️ Battle Configuration** — Combat status (HP/shield/readiness/repair), loadout selector, weapon equip/unequip, stance selector, yield threshold
2. **⬆️ Attribute Upgrades** — Upgrade planner with academy caps, credit costs, commit button
3. **⚙️ Tuning Allocation** — Tuning pool editor with per-attribute steppers

**Key decisions:**
- **Collapsible accordion (mobile)**: Only one section expanded at a time. Prevents 15+ screens of scrolling content.
- **All visible or side-by-side (desktop)**: Enough real estate to show multiple panels. Battle config + tuning side-by-side, upgrades full-width below.
- **Sticky section nav**: Three compact buttons at the top (below robot header) that scroll-to / expand the relevant section. Functions as a mini tab bar on mobile.
- **Persistent status strip** fixed at bottom: credits remaining | unsaved tuning changes | upgrade cost total. Always visible.
- **Robot switcher**: Compact dropdown at the top to jump between robots without leaving the workshop context. Solves multi-robot management.
- **Live stats preview**: The EffectiveStatsDisplay appears in Workshop mode as a reactive preview with delta column ("effective dodge: 47 → 52 (+5)") that updates as you change tuning/upgrades/weapons.
- **Contextual cross-links**: "Your Targeting Systems would benefit from a weapon with bonus → Browse Shop"

---

## Navigation & Routing

| From | Action | Destination |
|------|--------|-------------|
| Robots List (`/robots`) | Click robot name/image | Profile (`/robots/:id`) |
| Robots List | Click "Configure" / wrench icon | Workshop (`/robots/:id/prepare`) |
| Dashboard robot card | Healthy robot click | Profile |
| Dashboard robot card | "Needs attention" state | Workshop |
| Robot Profile | "Prepare for Battle →" CTA (owner only) | Workshop |
| Workshop | "View profile →" link | Profile |
| Workshop | Robot switcher dropdown | Workshop for different robot |

**Nav structure unchanged** — no new top-level nav entry. Workshop is a sub-route of the robot, reached through a robot.

---

## Why This Layout (Not Pure Single-Scroll)

The Workshop's three sections contain massive amounts of interactive content:
- BattleConfigTab: combat status panel, loadout selector, 2 weapon slots, 5 stance blocks with descriptions, yield threshold slider
- TuningPoolEditor: 23 attributes across 4 categories with increment/decrement steppers
- UpgradePlanner: 23 attributes with cost calculations, academy caps, commit summary

As a flat scroll on mobile, this would be 15+ screen heights. The "simultaneous visibility" advantage disappears when you can't see the top from the bottom. The accordion pattern preserves the single-page identity (one URL, one context, shared state) while respecting mobile viewport constraints.

On desktop, the wider viewport means all three sections can be visible/expanded — delivering the simultaneous visibility where it actually matters (where players do serious optimization).

---

## Implementation Notes

**Existing architecture supports this well:**
- `useRobotDetail` hook (backlog #50 extraction) already manages all state and data fetching — can be shared across both pages or split into `useRobotProfile` + `useRobotWorkshop`
- Tab components (`BattleConfigTab`, `TuningPoolEditor`, `UpgradePlanner`) are already isolated and self-contained
- URL tab state (`?tab=...`) can be replaced with clean route-based navigation
- `useRobotStore` Zustand store exists for cross-page robot data

**New components needed:**
- Robot switcher (dropdown with robot list, quick-nav within workshop)
- Persistent status strip (credits, unsaved changes, planned cost)
- Collapsible section wrapper (accordion behavior on mobile, open on desktop)
- Sticky section nav (3-button mini bar)
- Live stats preview with delta column (variant of EffectiveStatsDisplay)

**Migration path:**
1. Create Workshop page with existing tab components reorganized as sections
2. Strip owner-only tabs from profile, make remaining content scrollable
3. Add routing (`/robots/:id/prepare`)
4. Add robot switcher and status strip to workshop
5. Update all links (dashboard cards, robots list, nav) to point to correct page
6. Remove `TabNavigation` component (no longer needed)

---

## Benefits Summary

| Aspect | Current | Proposed |
|--------|---------|----------|
| Pages | 1 (8 tabs) | 2 (profile + workshop) |
| Public info | Gated behind owner-only tabs | All analytical data public |
| Preparation flow | Scattered across 3 tabs | Single coherent workspace |
| Multi-robot management | Back to list each time | Robot switcher in workshop |
| Deep linking | `?tab=tuning` query params | `/robots/:id/prepare` clean URLs |
| Information density | Compromised (one layout) | Optimized per context |
| Scouting opponents | Limited | Full profile visible |
| Mobile UX | 8 tabs to navigate | Accordion sections, sticky nav |
