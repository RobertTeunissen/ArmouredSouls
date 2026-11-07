# Product Requirements Document: Stable View Page

**Project**: Armoured Souls  
**Document Type**: Product Requirements Document (PRD)  
**Version**: v2.0  
**Date**: November 6, 2026 (v2.0: profile revamp; v1.1: Season 2 facility categories, Refinement Lab)  
**Status**: Implemented ✅

---

## Executive Summary

The Stable View Page (`/stables/:userId`) is the public profile of a stable. Any authenticated player can open it to see who the stable is, how it is doing this season, its roster, its trophies, its latest results, its facilities and its season history. Sensitive data (attribute levels, battle configuration, equipped weapons, current combat state) stays hidden.

v2.0 (stable page revamp) replaced the v1 layout, a wall of ten equal stat tiles, a three-column card grid and grouped facility progress bars, with a profile built for stables of any size (the median stable has 2 robots, the largest 11):

- A robot's tier is its **highest tier over every tiered mode**, not league 1v1: robots specialise in 2v2, Grand Melee and so on.
- The **trophy cabinet fills itself**: fewer than 1 in 80 human stables had pinned an achievement, so nearly every page showed six empty slots.
- A **season history** that reads like the live page at the time, with the latest completed season open.

---

## References

- **Design System**: [docs/design_ux/DESIGN_SYSTEM_QUICK_REFERENCE.md](../design_ux/DESIGN_SYSTEM_QUICK_REFERENCE.md)
- **Stable System**: [docs/game-systems/STABLE_SYSTEM.md](../game-systems/STABLE_SYSTEM.md)
- **Seasons**: Spec #45 (season archive, `SeasonHistoryBlock`)
- **Automaton Stables**: [docs/game-systems/PRD_AUTOMATON_STABLES.md](../game-systems/PRD_AUTOMATON_STABLES.md)
- **Player guide**: `achievements/badges-and-showcase.md`, `seasons/reading-your-archive.md`

---

## Route

`/stables/:userId` — Protected route (requires authentication)

---

## Page Layout

```
/stables/:userId
├── ← Back (browser history)
├── Header
│   ├── Stable name (username fallback) + Automaton badge + prestige rank chip
│   ├── "{username} · Member since {Month YYYY} · Season N, cycle X of Y"
│   ├── Honours chips: titles per format ("5× 3v3 Tournament champion"), up to two #1 Hall of Records placements
│   └── Figures: Prestige · Titles · Robots
├── This season (only when the stable has robots)
│   ├── Highest tier per robot: segmented bar + legend ("6 Champion · 4 Platinum · 1 Gold")
│   └── Best tier per mode: one chip per tiered mode ("2v2 · Diamond", "3v3 · –")
├── Roster (xl: 2/3 width)          ├── Trophy cabinet (xl: 1/3 width)
│   ├── Table | Cards toggle        │   ├── Up to 6 badges: pins, then rarest unlocks
│   ├── Sortable rows               │   ├── "Held by N players" / "Pinned"
│   │   # · robot · ELO ·           │   ├── Best Hall of Records placements (up to 3)
│   │   highest tier chip ·         │   └── Owner: Customise (pinner) · All achievements →
│   │   6-mode tier strip ·         └── Recent results
│   │   fame · kills                    ├── Last 5 battles, each a link to /battle/:id
│   └── Cards view: RobotDashboardCard      └── Owner: Battle history →
├── Facilities: built facilities as chips, highest level first ("13 of 14 built · 1 maxed")
└── Season history (SeasonHistoryBlock)
```

### Highest tier and the mode strip

- Tiered modes, in display order: League 1v1, League 2v2, League 3v3, Tag Team, King of the Hill, Grand Melee (`TIERED_STANDINGS_MODES` in `app/shared/utils/automatonStandingsTier.ts`). Tournaments have no tier.
- Team modes use the standing of the robot's team. A robot in two teams of the same mode shows the better one (higher tier, then LP).
- Only **played** standings count (W + L + D > 0, or any placement match). The Bronze row a subscription creates before a match shows as a dash.
- The chip shows the highest tier and, when several modes hold it, the count: "Champion ×3". It never names one mode: LP is not comparable across modes (Grand Melee runs to several hundred, 1v1 to about 130), so a tie-break by LP would almost always say Grand Melee.
- Each strip cell shows the tier initial, coloured with `getTierColor`. Its tooltip and accessible name carry the record and LP: "League 2v2: Diamond, Team Apes · 54–42–1 · 122 LP". KotH and Grand Melee show first places, not a win–loss record: "14 first places in 50 · 718 LP".
- Sorting: ELO (default, descending), name, highest tier (tier, then mode count; robots that have not played sort last), fame, kills. Ties fall back to ELO, then name.

### Trophy cabinet

- Up to 6 badges (`SHOWCASE_SIZE`, the pin limit): the owner's pins in their order, then the stable's rarest other unlocks.
- Rarity is the human-stable holder count from the achievement rarity cache (Automatons excluded, as on the achievements page). Ties: harder achievement tier, then most recent unlock. Until the cache has loaded, harder tiers come first and no holder count is shown.
- Hidden (secret) achievements are never auto-filled, so the cabinet cannot reveal one; a pinned one is shown.
- Owner: **Customise** opens the existing pinner modal (pin, unpin, save). There are no hover-only controls.
- Below the badges: the best Hall of Records placements over all completed seasons (rank first, then newest season), without tournament wins, whose `rank` is a list position rather than a placement.
- Visitors do not get the "All achievements" link, which only ever opens the viewer's own achievements.

### Recent results

- The stable's last 5 battles, newest first, grouped per battle with every robot of the stable that fought.
- Outcome rules match the stable W/L/D totals: 1v1 modes by winning robot, team modes by winning side, a null winner is a draw. A team battle with a winner but no recorded side (before Spec #39) shows "—". KotH and Grand Melee show the finishing position ("1st", "6th · 11th").
- Context line: mode, league tier (none for tournaments), tournament round.

### Season history

`SeasonHistoryBlock` (Spec #45 R14, restructured in v2.0):

- The season in progress first ("Season 1 · In progress · cycle 95 of 100 · archived at rollover"), from the season store.
- One row per completed season, newest first; the collapsed row shows prestige, titles and best tier. The **latest completed season opens on load**; older seasons load their detail on demand.
- Expanded detail (`SeasonRowDetail`), laid out like the live page:
  - Figures: prestige earned, **final credits**, record, win rate, highest ELO, titles, achievements.
  - Roster by final ELO: highest-tier chip and mode strip (same components as the live roster), and the robot's best finish (highest tier, then best instance rank: "Best finish: #1 Champion 1v1").
  - Teams with their members.
  - Hall of Records placements as chips, best rank first; four shown, the rest behind "+N more". Tournament wins listed separately.
  - Season 0 keeps the "career totals" label and its explanation.
- Archives keep no match count, so an archived robot standing counts as played when it has a result or LP, and an archived team standing when it has LP or a tier above Bronze.

---

## Error States

| State | Trigger | UI |
|---|---|---|
| Loading | API request in progress | "Loading stable..." |
| Not Found (404) | API returns 404 | "Stable not found" + back link |
| Network Error | Fetch fails / 5xx | "Failed to load stable. Please try again." + Retry |
| Empty Robots | `robots: []` | "This stable has no robots yet"; no "This season" section |
| No achievements | empty showcase | "No achievements unlocked yet." |
| No battles | `recentResults: []` | "No battles yet this season." |
| Season detail fails | detail request fails | "Could not load this season. Close and reopen it to try again." |

Saving pins refreshes the page data in the background; a failed refresh keeps the page on screen.

---

## Responsive Behavior

- Below `xl` the roster, trophy cabinet and recent results stack; from `xl` the roster takes two thirds.
- Below `lg` the roster is compact rows: thumbnail, name, ELO and tier chip, and the mode strip with mode labels. Rows after the fifth sit behind "Show all N robots"; sorting is a select.
- Below `lg` facilities collapse behind a Show/Hide toggle.
- Touch targets are at least 44px; no horizontal scrolling at 320px.

---

## Automaton Stables (Spec #55)

An Automaton_Stable's profile is the same page. The only addition is the Automaton_Badge (`AutomatonBadge`, `md`, `compact={false}`) after the stable name in the heading, kept on the line of the name's last word (`whitespace-nowrap`). Franchise, backstory and strategy are not shown (admin-only; backlog #61). Automatons earn achievements, so their cabinet fills like any other; their unlocks are not counted in rarity.

---

## API Endpoint

### `GET /api/stables/:userId`

**Authentication**: Required (`authenticateToken`). **Validation**: `userId` via Zod `positiveIntParam`. Owner and visitor get the same response.

```typescript
{
  user: {
    id; username; stableName | null; stableType;
    memberSince: string;              // v2.0: ISO account creation time
    prestige; prestigeRank;
    championshipTitles; championshipTitles1v1; championshipTitles2v2; championshipTitles3v3;
  };
  robots: Array<PublicRobot & {      // sanitized, ELO descending
    allModesBattleCount: number;     // #532
    standings: Array<{               // v2.0: played tiered modes, display order
      mode; tier; leaguePoints; wins; losses; draws;
      totalMatches: number | null;   // placement modes only; wins = first places
      teamName: string | null;       // team modes
    }>;
  }>;
  facilities: Array<{ type; name; level; maxLevel }>;
  stats: { totalBattles; totalWins; totalLosses; totalDraws; winRate; highestElo; activeRobots;
           totalTeamBattles; teamBattleWins; teamBattleWinRate };   // kept; no longer displayed
  achievements: {
    pinned: PinnedAchievement[];
    showcase: Array<PinnedAchievement & { pinned: boolean; holders: number | null }>;  // v2.0
    totalUnlocked; totalAvailable;
  };
  recentResults: Array<{             // v2.0: last 5 battles
    battleId; battleType; tier: string | null; tournamentRound: number | null; createdAt;
    entries: Array<{ robotId; robotName; outcome: 'win' | 'loss' | 'draw' | null; placement: number | null }>;
  }>;
  accolades: Array<{                 // v2.0: best 5 Hall of Records placements, all seasons
    seasonNumber; category; rank; subjectName; value; valueLabel; mode;
  }>;
}
```

All v2.0 fields are additions; no field was removed or changed.

**Errors**: `400` invalid userId, `401` unauthenticated, `404` user not found.

**Security**: robots go through `sanitizeRobotForPublic` (attributes, battle configuration, combat state, equipment and Automaton blueprint links stripped). The v2.0 additions are public competitive data already shown on league standings, battle pages and the season archive.

Season history uses `GET /api/seasons/stables/:userId` and `GET /api/seasons/stables/:userId/:seasonNumber` (Spec #45), unchanged.

---

## Navigation Integration

**My Stable**: the first item of the Stable menu (desktop dropdown and the mobile drawer's Stable section) opens the player's own page, `/stables/{own id}` (`stableNavItems` in `components/nav/types.ts`). It is only highlighted on the player's own stable, not on other stables.

`OwnerNameLink` links owner and stable names to `/stables/:userId` from League Standings, the Prestige, Fame and Losses leaderboards, Hall of Records and Tag Team Standings. Battle reports, the Season Archive, the season countdown notice (`#season-history`) and the admin player panel link here too.

---

## File Structure

### Backend
```
app/backend/src/routes/stables.ts                          # GET /api/stables/:userId
app/backend/src/services/common/stableViewService.ts       # profile, stats, composition
app/backend/src/services/common/stable-view-sections.ts    # per-robot standings, recent results, top accolades
app/backend/src/services/achievement/achievementQueries.ts # getStableAchievements, buildShowcase
```

### Frontend
```
app/frontend/src/pages/StableViewPage.tsx                  # composition only
app/frontend/src/components/stable-view/                   # StableHeader, SeasonOverview, RosterSection,
                                                           # TierChip, ModeStrip, TrophyCabinet, RecentResults,
                                                           # FacilitiesStrip, useStableProfile, types
app/frontend/src/components/season/SeasonHistoryBlock.tsx  # season list
app/frontend/src/components/season/SeasonRowDetail.tsx     # expanded season
app/frontend/src/utils/stableViewFormat.ts                 # pure derivations (tiers, sorting, labels)
```

### Tests
```
app/backend/tests/stables.test.ts                                     # integration: shape, standings, sanitization
app/backend/src/services/common/__tests__/stableViewSections.test.ts  # standings, outcomes, recent results
app/backend/src/services/common/__tests__/stableViewBattleCount.test.ts
app/backend/src/services/achievement/__tests__/stableShowcase.test.ts # cabinet order, hidden, limits
app/frontend/src/pages/__tests__/StableViewPage.test.tsx
app/frontend/src/pages/__tests__/AutomatonBadgePages.test.tsx
app/frontend/src/components/season/__tests__/SeasonHistoryBlock.test.tsx
app/frontend/src/utils/__tests__/stableViewFormat.test.ts             # incl. property test for highest tier
```
