/**
 * Queued matches per battle mode, system-wide, for the admin dashboard.
 *
 * Two schedule sources, as on the player dashboard (`cycleProgressService`):
 * - `scheduled_matches_v2` rows still `scheduled` (league, tag team, KotH,
 *   Grand Melee and team leagues);
 * - tournament bracket rows (`scheduled_tournament_matches`) of an active
 *   tournament that are outstanding and already have a participant. Empty
 *   placeholder rows of later rounds are not queued yet.
 */
import prisma from '../../lib/prisma';
import { MatchType } from '../../../generated/prisma';

/** Battle modes in display order: one dashboard row each. */
export const DASHBOARD_BATTLE_MODES: readonly MatchType[] = [
  MatchType.league_1v1,
  MatchType.league_2v2,
  MatchType.league_3v3,
  MatchType.tag_team,
  MatchType.koth,
  MatchType.grand_melee,
  MatchType.tournament_1v1,
  MatchType.tournament_2v2,
  MatchType.tournament_3v3,
];

/** Bracket participant type → battle mode. */
const TOURNAMENT_MODE_BY_PARTICIPANT_TYPE: Readonly<Record<string, MatchType>> = {
  robot: MatchType.tournament_1v1,
  team_2v2: MatchType.tournament_2v2,
  team_3v3: MatchType.tournament_3v3,
};

/** Count of queued matches per mode; modes with none are absent. */
export async function countQueuedMatchesByMode(): Promise<Map<string, number>> {
  const [scheduled, bracket] = await Promise.all([
    prisma.scheduledMatch.groupBy({
      by: ['matchType'],
      where: { status: 'scheduled' },
      _count: { _all: true },
    }),
    prisma.scheduledTournamentMatch.groupBy({
      by: ['participantType'],
      where: {
        status: { in: ['pending', 'scheduled'] },
        winnerId: null,
        tournament: { status: 'active' },
        OR: [{ participant1Id: { not: null } }, { participant2Id: { not: null } }],
      },
      _count: { _all: true },
    }),
  ]);

  const counts = new Map<string, number>();
  const add = (mode: string, count: number): void => {
    counts.set(mode, (counts.get(mode) ?? 0) + count);
  };
  for (const row of scheduled) add(row.matchType, row._count._all);
  for (const row of bracket) {
    const mode = TOURNAMENT_MODE_BY_PARTICIPANT_TYPE[row.participantType];
    if (mode) add(mode, row._count._all);
  }
  return counts;
}

/** Total of `countQueuedMatchesByMode`. */
export function totalQueued(counts: ReadonlyMap<string, number>): number {
  let total = 0;
  for (const value of counts.values()) total += value;
  return total;
}
