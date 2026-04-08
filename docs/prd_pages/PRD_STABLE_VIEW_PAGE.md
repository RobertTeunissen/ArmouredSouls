# Product Requirements Document: Stable View Page

**Project**: Armoured Souls  
**Document Type**: Product Requirements Document (PRD)  
**Version**: v1.0  
**Date**: April 2, 2026  
**Status**: Implemented ✅

---

## Executive Summary

The Stable View Page (`/stables/:userId`) is the first social/scouting feature in Armoured Souls. It allows any authenticated player to view another user's stable — their robots (public performance data), facilities (levels and types), and aggregate statistics (prestige, championship titles, win rate). Sensitive data such as exact attribute levels, battle configuration, equipped weapons, and current combat state remain hidden to preserve competitive strategy.

**Key Achievements:**
- ✅ Public stable viewing for any authenticated user
- ✅ Robot roster display with public-only data (ELO, league, W/D/L, fame, kills, damage stats)
- ✅ Facility summary grouped by 4 categories with level progress indicators
- ✅ Aggregate stable statistics (total battles, wins, losses, draws, win rate, highest ELO, active robots)
- ✅ Prestige rank title display (Novice → Legendary)
- ✅ Sensitive robot data stripped via `sanitizeRobotForPublic`
- ✅ Navigation links from 6+ existing pages (League Standings, Leaderboards, Hall of Records, Tag Team Standings)
- ✅ Responsive layout (320px and above)
- ✅ Error states: 404, network error, loading, empty robots

---

## References

- **Design System**: [docs/design_ux/DESIGN_SYSTEM_QUICK_REFERENCE.md](../design_ux/DESIGN_SYSTEM_QUICK_REFERENCE.md)
- **Stable System**: [docs/prd_core/STABLE_SYSTEM.md](../prd_core/STABLE_SYSTEM.md)
- **Prestige & Fame**: [docs/prd_core/PRD_PRESTIGE_AND_FAME.md](../prd_core/PRD_PRESTIGE_AND_FAME.md)
- **Related Files**:
  - Frontend Page: `prototype/frontend/src/pages/StableViewPage.tsx`
  - Backend Route: `prototype/backend/src/routes/stables.ts`
  - Shared Utility: `prototype/backend/src/utils/prestigeUtils.ts`
  - Robot Card Component: `prototype/frontend/src/components/RobotDashboardCard.tsx` (public variant)
  - Navigation Component: `prototype/frontend/src/components/OwnerNameLink.tsx`

---

## Route

`/stables/:userId` — Protected route (requires authentication)

---

## Page Layout

```
/stables/:userId Page Layout

├── Navigation Bar (global)
├── Back Button
│   └── Returns to previous page (browser history)
├── Stable Header ✅
│   ├── Stable Name (or username fallback)
│   ├── Prestige Value + Rank Title (Novice/Established/Veteran/Elite/Champion/Legendary)
│   └── Championship Titles count
├── Stable Statistics Section ✅
│   ├── Total Battles
│   ├── Total Wins
│   ├── Total Losses
│   ├── Total Draws
│   ├── Win Rate (percentage)
│   ├── Highest ELO
│   └── Active Robots count
├── Robots Section ✅
│   ├── Grid of RobotDashboardCard (public variant)
│   │   ├── Robot image, name
│   │   ├── ELO, league, league points
│   │   ├── W/D/L record, win rate
│   │   ├── Fame + fame tier badge
│   │   ├── Total battles, kills
│   │   ├── Lifetime damage dealt/taken
│   │   └── Click navigates to /robots/:robotId
│   └── Sorted by ELO descending
├── Facilities Section ✅
│   ├── Economy & Discounts group
│   ├── Capacity & Storage group
│   ├── Training Academies group
│   └── Advanced Features group
│       └── Each facility: name + "Level X/Y" progress
└── Error/Empty States ✅
    ├── Loading indicator while fetching
    ├── "Stable not found" + back link (404)
    ├── "Failed to load stable. Please try again." + retry button (network error)
    └── "This stable has no robots yet" (empty robots)
```

---

## Sections

### Stable Header

Displays the target user's identity and prestige information:
- **Stable name**: Uses `stableName` if set, falls back to `username`
- **Prestige**: Numeric value with rank title badge
- **Championship titles**: Count of titles won

Prestige rank tiers:
| Prestige Range | Rank Title |
|---|---|
| 0–999 | Novice |
| 1,000–4,999 | Established |
| 5,000–9,999 | Veteran |
| 10,000–24,999 | Elite |
| 25,000–49,999 | Champion |
| 50,000+ | Legendary |

### Stable Statistics

Grid of stat cards showing aggregate performance across all robots:
- Total Battles, Total Wins, Total Losses, Total Draws
- Win Rate (percentage, 1 decimal place)
- Highest ELO across all robots
- Active Robots count

All stats are computed server-side from robot data.

### Robots

Grid of `RobotDashboardCard` components using the `"public"` variant:
- Sorted by ELO rating descending
- Each card shows: image, name, ELO, league, league points, W/D/L record, win rate, fame, fame tier, total battles, kills, lifetime damage dealt, lifetime damage taken
- Each card omits: HP bar, shield bar, battle readiness badge, weapon details
- Clicking a card navigates to `/robots/:robotId`
- Bye Robots are excluded from the response

### Facilities

Facilities are grouped into 4 categories, each showing facility name and "Level X/Y" progress:

| Category | Facility Types |
|---|---|
| Economy & Discounts | repair_bay, training_facility, weapons_workshop, merchandising_hub, streaming_studio |
| Capacity & Storage | roster_expansion, storage_facility |
| Training Academies | combat_training_academy, defense_training_academy, mobility_training_academy, ai_training_academy |
| Advanced Features | research_lab, medical_bay, coaching_staff, booking_office |

The facilities section is read-only — no upgrade costs, operating costs, or upgrade buttons are shown.

---

## Error States

| State | Trigger | UI |
|---|---|---|
| Loading | API request in progress | Loading indicator with "Loading stable..." |
| Not Found (404) | API returns 404 | "Stable not found" message + back link |
| Network Error | Fetch fails / 5xx | "Failed to load stable. Please try again." + retry button |
| Empty Robots | API returns `robots: []` | "This stable has no robots yet" in robots section |

---

## Responsive Behavior

| Viewport | Robot Cards | Facilities | Statistics |
|---|---|---|---|
| Mobile (< 640px) | Single column | Stacked vertically | Compact reflow, no horizontal scroll |
| Tablet (640px–1023px) | 2-column grid | Multi-column | Grid layout |
| Desktop (≥ 1024px) | 3-column grid | Multi-column | Grid layout |

- Minimum supported viewport: 320px
- Touch-friendly tap targets: minimum 44px
- No horizontal scrolling at any viewport size

---

## API Endpoint

### `GET /api/stables/:userId`

**Authentication**: Required (JWT via `authenticateToken` middleware)  
**Validation**: `userId` validated as positive integer via Zod `positiveIntParam`

**Response Shape**:
```typescript
{
  user: {
    id: number;
    username: string;
    stableName: string | null;
    prestige: number;
    prestigeRank: string;
    championshipTitles: number;
  };
  robots: PublicRobot[];       // Sanitized, sorted by ELO desc
  facilities: FacilitySummary[];
  stats: {
    totalBattles: number;
    totalWins: number;
    totalLosses: number;
    totalDraws: number;
    winRate: number;
    highestElo: number;
    activeRobots: number;
  };
}
```

**Error Responses**:
- `401` — Unauthenticated request
- `400` — Invalid userId parameter
- `404` — User not found
- `500` — Database/server error

**Security**: All robots are sanitized via `sanitizeRobotForPublic`, stripping 23 core attributes, battle config (stance, yield threshold, loadout type), combat state (current HP, current shield, damage taken), and equipment IDs.

---

## Navigation Integration

The `OwnerNameLink` component renders owner/stable names as clickable links to `/stables/:userId` on the following pages:
- LeagueStandingsPage — owner column in standings table
- LeaderboardsPrestigePage — stable name in prestige leaderboard
- LeaderboardsFamePage — stable name in fame leaderboard
- LeaderboardsLossesPage — stable name in losses leaderboard
- HallOfRecordsPage — owner names in record cards
- TagTeamStandingsPage — owner names in tag team standings

---

## File Structure

### Backend
```
prototype/backend/src/routes/
└── stables.ts                 # GET /api/stables/:userId endpoint

prototype/backend/src/utils/
└── prestigeUtils.ts           # Shared getPrestigeRank, getFameTier utilities
```

### Frontend
```
prototype/frontend/src/pages/
└── StableViewPage.tsx         # Stable view page

prototype/frontend/src/components/
├── RobotDashboardCard.tsx     # Extended with variant="public" support
└── OwnerNameLink.tsx          # Reusable owner name link component
```

### Tests
```
prototype/backend/tests/
├── stables.test.ts                        # Unit tests for stables endpoint
├── stableSanitization.property.test.ts    # Property-based tests (Properties 1-6)
└── prestigeUtils.property.test.ts         # Property 4: prestige rank mapping

prototype/frontend/src/pages/__tests__/
├── StableViewPage.test.tsx                # Unit tests for StableViewPage
└── StableViewPage.property.test.ts        # Property 7: facility category grouping
```
