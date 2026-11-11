# Prestige battle bonus removed

**Season:** 2 (deployed in the Season 2 preparation window, before the first battles on 14 Nov 2026). **Issue:** #596 (catch-up instead of win-more).

## Problem

1v1 league wins paid `min(1.50, 1 + prestige / 50,000)` × the tier's win reward: up to 50% more, reached at 25,000 prestige. The same win in the same tier paid a leading stable more than anyone else, which breaks the product owner's rule that a win is a win and pays the stables already ahead for being ahead.

- Season 1 (25 active human stables): the top half by prestige earned averaged 49,400 prestige, so it collected the full +50% for much of the season; the bottom half ended at 9,400 (+19%).
- Example: a Diamond win paid ₡115,000 to a new stable and ₡172,500 to one past 25,000 prestige.
- It applied only to the 1v1 league win reward: not to participation, team leagues, Tag Team, tournaments, KotH or Grand Melee. The player guide described it wrongly (stepped +10% … +50% on all battle winnings).

## Change

- Battle rewards depend on mode, tier and result only. 1v1 league: win = tier win reward + participation; loss and draw = participation.
- Deleted `getPrestigeMultiplier`, `calculateBattleWinnings` and `getNextPrestigeTier` (`utils/economyFormulas.ts`), the "Prestige Bonus" line in the 1v1 battle log, and `prestigeMultiplier` from `GET /api/finances/summary` / `FinancialSummary` (no client read it).
- Unchanged: facility prestige gates and the merchandising multiplier (prestige per roster slot).

## Rejected / deferred (product owner, 11 Nov 2026)

- Upset bonus for beating a higher-rated robot: would also favour multi-robot stables adding a 7th or 8th low-rated robot.
- Larger start for late joiners: nobody would have used it in Season 1.
- Bounties on leaders: needs more design and must cover every league and tournament.
