# Prestige by battle mode: Tag Team, Grand Melee and tournament alignment

**Season:** 2 (deploy during the season 2 preparation window; prestige resets at each Season_Rollover). **Issue:** #576 (prestige gating vs multi-robot strategies).

## Problem

At the end of season 1, stables with many robots reached the prestige gates far earlier than one- and two-robot stables. Measured on ACC (6 Nov 2026, cycle 95, human stables): average prestige was 6.7k for one robot, 13.5k for two, 23k for three and 59k for six or more. Per robot, prestige from the solo modes was about the same at every roster size (47–73 per robot per cycle); the difference came from the team modes, which a single robot cannot enter.

## Design intent (product owner)

- A win is a win. The prestige for a win depends on the mode and tier, never on how many robots the stable owns.
- One- and two-robot stables should win more single-robot events (stronger concentrated robots, higher tiers) and so earn more there. Multi-robot stables are compensated by the 2v2/3v3 modes, and should lose more 1v1 events or sit in lower tiers.
- A team-mode win should not pay less than a 1v1 League win in the same tier.

## Rejected

- Scaling the facility prestige gates by roster size.
- Normalising each prestige award by the stable's robot count.
- More achievement prestige (36 achievements were just added).
- Removing the prestige gate from the training academies.

## Changes

| Mode | Before | After |
|---|---|---|
| Tag Team win | league table × 1.6 (8 / 16 / 32 / 48 / 80 / 120) | league table, as 2v2 League (5 / 10 / 20 / 30 / 50 / 75) |
| Grand Melee | top 3: 20 / 10 / 5 base | top 10: 20 / 10 / 5 / 4 / 3 / 3 / 2 / 2 / 1 / 1 base |
| 1v1 tournament round | 15 × (round / rounds) × bracket-size factor, +500 in the final | one table for every format, by rounds remaining (below) |
| 2v2 / 3v3 tournament round | stepped 20 / 30 / 40 / 50 / 60, +150 in the final, × team size | the same table, once per winning stable |

Grand Melee keeps the tier factor (1.0 / 1.5 / 2.0 / 3.0 / 4.5 / 7.0) and the ×1.5 for a winner above 50% HP.

**Tag Team.** The 1.6× came from the original Tag Team spec (Feb 2026) with no recorded rationale; 2v2/3v3 League (Spec #37, May 2026) reused the flat table and the two were never reconciled. Two robots now earn the same for a Tag Team win as for a 2v2 League win.

**Grand Melee.** Fields averaged ~18 robots in season 1 (16–20 in Bronze/Silver, ~14 in Champion), so the top-3 band paid about one robot in six, against half the field in KotH (top 3 of ~6). Credits, fame and LP already paid the top 10. Expected prestige per robot entered at the Bronze base goes from 1.9 to 2.8, close to 1v1 League (2.5); KotH is 4.3. The bump goes mostly to strong robots, which the design expects in one- and two-robot stables.

**Tournaments.** Product owner: every tournament format pays the same prestige for the same round, a team win pays its stable once, and the 1v1 jump from the semi-final (~20) to the final (~523) was too large. Tournaments should still pay more prestige than leagues, but not so much that 3v3 tournaments (won by 3+ robot stables) dominate, and early rounds will be filled by Automatons in season 2. Rejected: a final of 100–150 (too low next to a Champion league win of 75) and finals of 500/750 with ×0.6 steps (too high).

| Round won | Final | Semi | Quarter | R16 | R32 | R64 | R128 | Earlier |
|---|---|---|---|---|---|---|---|---|
| Prestige (any format, once per stable) | 250 | 150 | 90 | 55 | 35 | 20 | 10 | 5 |

A 128-entrant winning run pays 610 (1v1 was 593, 2v2 940, 3v3 1,410); a 3,160-entrant 1v1 run pays 635 (was ~1,000). Expected prestige per entry at 128 entrants and a 50% win rate per round: 25 (1v1 was 10, 2v2 60, 3v3 90). Credits are unchanged: every format uses ₡20,000 × bracket-size factor × round / rounds, and team tournaments pay that × team size × 0.75 split across the robots, the same per-robot rule as the team leagues (#527).

## Not changed

1v1, 2v2 and 3v3 League, KotH, tournament credits and fame, achievements, the facility prestige gates, the battle-winnings multiplier and merchandising.

## References

- Player guide: `team-battles/tag-team.md`, `team-battles/overview.md`, `grand-melee/rewards.md`, `prestige-fame/prestige-system.md`.
- [PRD_PRESTIGE_AND_FAME.md](../game-systems/PRD_PRESTIGE_AND_FAME.md) v2.3.
