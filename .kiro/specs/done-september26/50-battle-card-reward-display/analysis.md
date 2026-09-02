# Spec 50 — Battle Card Reward Display: Investigation Notes

> **Status: investigation complete, requirements not started.**
> Captured code audit. Unlike Spec 49 this one carries no balance decision — every item is a wrong
> or missing number on a page that exists today.
>
> Audited August 2026 against the working tree. Read-only audit: no build or test run was performed.

## The component picture — already unified, and that is the good news

One card renders every *resolved* battle across three surfaces:

```
DashboardPage                 → RecentBattles          ─┐
RobotDetailPage ?tab=matches  → RecentBattles          ─┼→ CompactBattleCard
BattleHistoryPage             → CompactBattleCard      ─┘
```

`app/frontend/src/components/RecentBattles.tsx` is the same component in both of the first two
places — `RobotDetailPage.tsx` renders `<RecentBattles battles={recentBattles} robotId={robot.id} />`
with the battles passed in, while the Dashboard lets it fetch its own. `BattleHistoryPage.tsx` skips
`RecentBattles` and renders `CompactBattleCard` directly.

`getBattleReward` in `app/frontend/src/utils/matchmakingApi.ts` is the single function that produces
the reward figure for that card.

**Consequence: the stable-total fix is one function plus one card, and all three surfaces inherit
it.** Wide blast radius, narrow change. No unification work is needed on the resolved-battle side —
it is already unified.

## Where the fragmentation actually is

The *scheduled* side, not the resolved side. `app/frontend/src/components/UpcomingMatches.tsx` fans
out to four separate card components in `app/frontend/src/components/match-cards/`:

| Component | Handles |
|---|---|
| `StandardMatchCard.tsx` | 1v1 league and 1v1 tournament |
| `TeamBattleMatchCard.tsx` | `league_2v2`, `league_3v3`, `tag_team`, `tournament_2v2`, `tournament_3v3` |
| `KothMatchCard.tsx` | `koth` |
| `ByeMatchCard.tsx` | byes |

`UpcomingMatches` is Dashboard-only. So the shared-bye-card work belongs here, against four card
components, not against `CompactBattleCard`.

## Defect 1 — rewards are shown as one robot's share, not the stable's

`getBattleReward` returns a single participant's `credits`. For a 3v3 the card therefore shows roughly
**one third** of what the stable actually earned, and the participant it picks is arbitrary — the
first one matching the user id. `streamingRevenue`, `prestigeAwarded` and `fameAwarded` on the card are
the same single-robot slice.

**No API change is needed.** `participants[]` already carries all four fields plus `robot.userId`, so
the sum is computable client-side. Two constraints:

- `participants` is typed optional, so a `winnerReward` / `loserReward` fallback is required for any
  payload that omits it.
- **Prestige does not sum cleanly.** Team orchestrators award prestige once to the stable and store a
  per-participant display split, so summing a tag-team bye's participants gives `2 × floor(p/2)` —
  up to 1 short of what was actually credited. Credits sum exactly; prestige needs either the
  battle-level figure or an explicit rounding rule. This must be decided in requirements, not left to
  the implementation.

## Defect 2 — byes are invisible, and mislabelled where they are visible

Frontend gaps only; the backend-side gaps belong to Spec 49.

- **`tournament_1v1` byes** are queried and formatted by the backend, then dropped by the Frontend.
  `formatByeMatches` in `app/backend/src/services/match/matchHistoryService.ts` sets `robot1: null`
  with the comment "Participant details resolved separately" — and nothing resolves them. `UpcomingMatches`
  requires `match.isByeMatch && match.robot1`, so the card never renders.
- **`tournament_2v2` / `tournament_3v3` byes** are invisible through two independent gaps: the bye
  query filters `participantType: 'robot'`, and the team-tournament query filters
  `status: pending/scheduled` while byes are already `completed`.
- **No tournament bye appears in Recent Battles at all**, because bracket advancement creates no
  `battles` row and both tournament orchestrators actively throw if handed a bye.
- **`league_1v1` bye history entries never get `isByeMatch` set** — only team battles do — so
  `CompactBattleCard` cannot label a 1v1 walkover even though the `battles` row exists.
- **`ByeMatchCard` mislabels everything.** It labels every bye 🏆 "Tournament" with "Top seed — no
  opponent in this round", which is wrong for a league walkover, and it shows **no reward** at all.

## Defect 3 — match versus battle terminology

The convention in the data model is real and consistent: a **match** is scheduled and unfought, a
**battle** is resolved. It is documented nowhere, and the leaky seam is
`/api/matches/history` returning a `BattleHistory` type. The section headings ("Recent Battles" versus
"Upcoming Matches") are correct under that convention and should stay — they just need to be applied
consistently in types, endpoints and copy.

Any `Pascal_Snake` term this introduces needs a Glossary entry when requirements are written.

## Confirmed with the product owner

- The `RecentBattles` component itself needs no structural change.
- Last-20 is the right window; a 24-hour window is impractical for a 50-plus-battle stable.
- The naming pair is fine as-is, but should be *aligned* rather than renamed.

## Dependency on Spec 49

Only partial, and worth stating precisely so this does not get queued behind a balance decision:

- **Independent of 49:** the stable-total reward fix, the `isByeMatch` flag on `league_1v1` history,
  the `ByeMatchCard` mislabelling, and the terminology alignment. All are wrong today regardless of
  what a bye pays.
- **Depends on 49:** rendering a reward on a bye card requires 49 to have decided what a bye pays;
  showing KotH and Grand Melee byes requires 49 to create the rows.

A sensible split is to ship the independent half first.
