# Product Requirements Document: Robot Profile and Workshop (`/robots/:id`, `/robots/:id/prepare`)
**Project**: Armoured Souls  
**Document Type**: Product Requirements Document (PRD)  
**Version**: v2.0\
**Date**: November 6, 2026\
**Status**: ✅ Implemented (#504, backlog #37)
**Pages**: `/robots/:id` (public Robot Profile), `/robots/:id/prepare` (owner-only Workshop)
> **Note**: For the robots list page (`/robots`), see [PRD_ROBOTS_LIST_PAGE.md](PRD_ROBOTS_LIST_PAGE.md). The v1.x tabbed Robot Detail page (8 tabs, decimal-attribute rollout) is in git history before November 2026.

---

## Overview

The old Robot Detail page mixed two jobs in eight tabs: looking back at a robot (Overview, Matches, Analytics, League History) and preparing it (Upgrades, Tuning, Battle Config, Stats). Version 2 splits them by use case:

| Use case | Page | Who | Layout |
|----------|------|-----|--------|
| Scout an opponent, or look at my own robot's season | **Robot Profile** `/robots/:id` | Everyone (logged in) | One scrolling page, no tabs |
| Upgrade and equip my robot | **Workshop** `/robots/:id/prepare` | Owner only | Two sections: **Build** and **Loadout** |

The end-of-season flow this serves: dashboard → Robots → repair → open a robot → upgrade attributes and tuning → next robot → log out, without returning to the list between robots.

## Routing

- Owner clicks on their own robot go to the Workshop: robots list, navigation dropdown, mobile drawer, dashboard robot cards and notifications, team page, Weapon Shop inventory "Equipped on", setup wizard and eligibility checklist. Every other robot link goes to the Profile. Helpers: `workshopPath`, `robotPath`, `workshopPathForTab` in `app/frontend/src/utils/robotRoutes.ts`.
- The Profile shows its owner a **Workshop →** button; the Workshop links back with **Public profile →**.
- Old links keep working. On `/robots/:id?tab=…` the owner is redirected: `upgrades`, `tuning`, `stats` → `/prepare`; `battle-config` → `/prepare?section=loadout`. Other tabs, and every visitor, stay on the Profile.
- `/robots/:id/prepare` for a robot the user does not own redirects to the Profile. Onboarding lands on `?section=loadout&onboarding=true` with the tutorial banner.

## Robot Profile (`/robots/:id`)

Sections, top to bottom (`app/frontend/src/components/robot-profile/`):

1. **Header** — image, name, owner stable link (with the Automaton_Badge for Automaton stables), "fighting since" month, the tier chip (highest tier this season plus how many modes hold it, e.g. "Champion ×3", shared with the stable page), up to one season accolade chip, achievement count. Stats: ELO, Fame, robots destroyed, battles (all modes) and a last-10 strip (green win, gold first place, red loss, grey other).
2. **This season** — one card per mode played: tier, rank in its league instance ("#5 of 30, in Champion 1"), LP, and the record (W·L·D for 1v1/team modes, first places for KotH and Grand Melee) with a success bar. Team modes add the team name. A caption lists modes not entered.
3. **Form** — ELO over the last 10 cycles, the 6 most recent matches (mode, tier, result, ELO change; each links to its battle) and upcoming matches. The owner also sees a Battle history link.
4. **History** — one tier band per mode across this season's cycles with a colour legend, the promotion/demotion count, and tournament results.
5. **Achievements** — earned by this robot, rarest first, with holder counts; 6 shown, "+N more".

**Hidden from visitors (and not on the Profile at all):** attributes, effective stats, tuning, weapons, loadout, stance, yield, HP and the per-attribute leaderboard ranks. Opponents learn a build by watching its recent battles. `GET /api/robots/:id` already strips owner-only fields for visitors (`robotSanitizer.ts`).

### Data

`GET /api/robots/:id/profile` (`authenticateToken`, `robotIdParamsSchema`; 404 when the robot does not exist) returns, from `services/robot/robot-profile-service.ts`:

| Field | Content |
|-------|---------|
| `standings` | Current-season standings per mode (`PublicRobotStanding` + `rank`, `instanceSize`). Rank counts rows in the same league instance with more LP (`standings` is the ranking source of truth). |
| `form` | Last 10 results across all modes (`getRecentResults`, with `eloChange`). |
| `achievements` | This robot's achievements with tier, badge and holder count. |
| `accolades` | Season accolades for this robot. Matched on owner `userId` + `subjectType 'robot'` + `subjectName`, so a renamed robot loses older accolades from its profile. |

The ELO chart, league history (`/league-history`, team histories) and tournaments (`/performance-context`) use their existing endpoints. Season scoping follows the live-season rule: cross-season data comes only from archive tables.

**Removed:** `GET /api/robots/:id/rankings` (per-attribute percentile ranks). It exposed build information to any logged-in player and has no UI anymore. Also removed: the damage-per-cycle and credits-per-cycle charts and the damage bars by context. A per-robot credits view has no new home yet.

## Workshop (`/robots/:id/prepare`)

Owner-only (`app/frontend/src/pages/RobotWorkshopPage.tsx`, `components/robot-workshop/`).

### Top of the page

- **Robot switcher** — previous/next arrows and a dropdown over the stable's robots, keeping the current section. Leaving with unsaved Build changes asks for confirmation.
- **Header** — image (editable), name, tier chip, ELO and gear summary, condition bar (HP and shield).
- **Repair** — "Repair all damaged · ₡X" with this robot's price on the second line. Uses the existing `POST /api/robots/repair-all` (manual repair, half the automatic price). There is deliberately no single-robot repair: it would be a new credit writer. Shows "All robots fully repaired" when nothing is damaged.
- **Eligibility checklist** with recommendations (`RobotEligibilityChecklist`).

### Build section

One table replaces the Upgrades, Tuning and Stats tabs. Rows are grouped by academy category, each with its cap and academy level; a category whose attributes are all at cap folds to one line ("All 6 at cap 10 · tuned +2 each").

| Column | Meaning |
|--------|---------|
| Level | Current level (permanent, bought with credits). |
| Upgrade to | Stepper for the planned level, plus **Max** (as far as credits allow). |
| Cost | Credits for the planned levels (Training Facility discount included). |
| Tuning | Stepper for this season's free tuning points. |
| Max | Tuning room: cap + 5 − level. When the plan raises the level, shows "now → after". |
| Base + tuning | Value before → after the plan. |
| In battle | With weapons, loadout and stance; hover for the breakdown. |

- Toolbar: tuning pool used/size and Tuning Bay level, **Max upgrades** (raises every attribute one level at a time while credits last, so credits spread evenly), **Reset tuning**.
- An attribute whose planned level leaves less tuning room than allocated shows a note; on save that tuning is clamped to the new room.
- Mobile: each row stacks as four lines (name and level; upgrade stepper and cost; tuning stepper and room; base + tuning and in battle).

**Status bar** (fixed at the bottom): credits, upgrade cost, tuning used, credits after, **Discard**, **Save** / **Save · next robot ▶**. Save commits the upgrades first, then the tuning; if a step fails, later steps are not saved and a toast says so. There is no confirmation modal; the bar shows the cost before saving. On Loadout the bar only appears while Build changes are unsaved.

### Loadout section

The existing battle configuration (`BattleConfigTab`: loadout type, equipped weapons, stance, yield threshold with repair-cost scenarios) beside an **In battle** panel: per attribute, base (level + tuning), weapon bonus, loadout %, stance % and total. By default it lists only attributes the gear or stance changes; "Show all 23 attributes" expands it. Loadout changes save as they are made.

**Unequip confirmation (#536).** Unequipping is never blocked. When the robot has booked matches (`heldSlots` from the subscription overview, fetched for owners only), the shared `ConfirmationModal` warns first:

| Slot | Title | Message | Buttons |
|------|-------|---------|---------|
| Main | "Unequip main weapon?" | "{robot} has booked matches ({events}). Without a main weapon it will forfeit them unless re-armed before they run." | "Unequip anyway" (destructive) / "Keep weapon" |
| Offhand | "Unequip offhand weapon?" | "{robot} has booked matches ({events}). Without an offhand it will fight them with a single weapon." | "Unequip anyway" / "Keep offhand" |

Copy lives in `app/frontend/src/utils/unequipWarning.ts`. Readiness is re-checked when each booked battle starts: no main weapon forfeits, an incomplete loadout fights as Single.

## Automaton stables (Spec #55)

Automaton robots have a Profile like any other robot, with the Automaton_Badge after the owner name. They have no Workshop (no login). Blueprint, strategy and backstory fields never reach the page (`SENSITIVE_ROBOT_FIELDS`).

## Accessibility and layout

- Touch targets are at least 44 px on small screens (steppers, Max, switcher, section tabs).
- The Workshop sections are a `tablist`; the Profile has no tabs.
- Charts and tier bands carry text alternatives (`role="img"` with an `aria-label`); recent-match links have a full `aria-label`.
- Text truncates with a `title` where names can be long (team names, robot names, tournaments).

## Testing

| Tier | Files |
|------|-------|
| Backend unit | `services/robot/__tests__/robotProfileService.test.ts`, `services/common/__tests__/stableViewSections.test.ts` |
| Backend integration | `tests/robotProfile.test.ts`, `tests/stables.test.ts`, `routes/__tests__/leagueHistoryPublic.test.ts` |
| Frontend | `pages/__tests__/RobotProfilePage.test.tsx`, `RobotWorkshopPage.test.tsx`, `components/robot-profile/__tests__/ProfileSections.test.tsx`, `components/robot-workshop/__tests__/AttributeInfo.test.tsx`, `utils/__tests__/workshopBuild.test.ts`, `robotProfileFormat.test.ts`, `BattleConfigTab.unequipWarning.test.tsx` |
| E2E | `critical-journey.spec.ts` (equip in Loadout), `tuning-bay.spec.ts` (tuning in Build), `financial-flow.spec.ts` (upgrade in Build), `automaton-badge.spec.ts` (Profile badge) |

## Version history

| Version | Date | Change |
|---------|------|--------|
| 1.0–1.5 | 2026 | Tabbed Robot Detail page: decimal attributes, effective stats table, Automaton badge, unequip confirmation |
| 2.0 | 2026-11-06 | Split into public Profile and owner Workshop (#504); rankings endpoint and analytics charts removed |
