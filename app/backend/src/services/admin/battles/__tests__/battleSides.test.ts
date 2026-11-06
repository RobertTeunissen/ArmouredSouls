/**
 * #549 — winner labels on the admin Battles list, per battle type.
 *
 * Team modes store the winning TEAM id in `winner_id`; KotH and Grand Melee
 * write every robot as team 1. The list must mark the winner from
 * `winning_side` / the recorded winner robot, and show "Unknown" only when the
 * winner's own participant row is gone.
 */
jest.mock('../../../../lib/prisma', () => ({ __esModule: true, default: {} }));

import { outcomeOf, summariseSides, type BattleCoreRow, type BattleFacts, type ParticipantFact } from '../battleFacts';

const stable = { userId: 1, name: 'Stable', stableType: 'human' as const };

const part = (robotId: number, team: number, extra: Partial<ParticipantFact> = {}): ParticipantFact => ({
  robotId,
  robotName: `R${robotId}`,
  team,
  role: null,
  placement: null,
  destroyed: false,
  yielded: false,
  forfeited: false,
  eloBefore: 1200,
  eloAfter: 1200,
  credits: 0,
  streamingRevenue: 0,
  prestigeAwarded: 0,
  fameAwarded: 0,
  damageDealt: 0,
  finalHP: 10,
  maxHP: null,
  stable,
  ...extra,
});

const row = (battleType: string, winnerId: number | null, winningSide: number | null = null): BattleCoreRow => ({
  id: 1,
  battleType,
  leagueType: 'bronze',
  leagueInstanceId: null,
  tournamentId: null,
  tournamentRound: null,
  tournamentName: null,
  winnerId,
  winningSide,
  durationSeconds: 40,
  createdAt: new Date(0),
});

const facts = (participants: ParticipantFact[], teamNames: Array<[number, string]> = []): BattleFacts => ({
  participants,
  isBye: false,
  isForfeitTournamentBattle: false,
  scheduledMatchId: null,
  tournamentMatchId: null,
  teamNames: new Map(teamNames),
  kothPlacements: null,
  scoreThreshold: null,
  scheduledTimeLimit: null,
});

function sidesOf(r: BattleCoreRow, f: BattleFacts): Array<{ label: string; isWinner: boolean }> {
  return summariseSides(r, f, outcomeOf(r, f)).sides.map(s => ({ label: s.label, isWinner: s.isWinner }));
}

describe('admin battle sides — two-sided modes', () => {
  it('league_1v1: marks the winner robot', () => {
    const r = row('league_1v1', 2);
    expect(sidesOf(r, facts([part(1, 1), part(2, 2, { destroyed: false })]))).toEqual([
      { label: 'R1', isWinner: false },
      { label: 'R2', isWinner: true },
    ]);
  });

  it('league_1v1: a deleted winner leaves its side Unknown and no winner marked', () => {
    const r = row('league_1v1', 1);
    expect(sidesOf(r, facts([part(2, 2)]))).toEqual([
      { label: 'Unknown', isWinner: false },
      { label: 'R2', isWinner: false },
    ]);
  });

  it.each(['league_2v2', 'tournament_2v2'])('%s: marks the side from winning_side, not the team id in winner_id', (battleType) => {
    // winner_id 3 is team 1's TEAM id and collides with a robot on side 2.
    const r = row(battleType, 3, 1);
    const f = facts([part(1, 1), part(2, 1), part(3, 2), part(4, 2)], [[1, 'Alpha'], [2, 'Bravo']]);
    expect(sidesOf(r, f)).toEqual([
      { label: 'Alpha', isWinner: true },
      { label: 'Bravo', isWinner: false },
    ]);
  });

  it.each(['league_3v3', 'tournament_3v3'])('%s: names an unnamed side by its robots and keeps the winner when the other side is gone', (battleType) => {
    const r = row(battleType, 77, 2);
    const f = facts([part(4, 2), part(5, 2), part(6, 2)]);
    expect(sidesOf(r, f)).toEqual([
      { label: 'Unknown', isWinner: false },
      { label: 'R4 + R5 + R6', isWinner: true },
    ]);
  });

  it('tag_team: marks the side from winning_side', () => {
    const r = row('tag_team', 1, 2);
    const f = facts([
      part(1, 1, { role: 'active' }), part(2, 1, { role: 'reserve' }),
      part(3, 2, { role: 'active' }), part(4, 2, { role: 'reserve' }),
    ]);
    expect(sidesOf(r, f).map(s => s.isWinner)).toEqual([false, true]);
  });

  it('a draw marks no winner', () => {
    const r = row('league_2v2', null, null);
    expect(sidesOf(r, facts([part(1, 1), part(2, 2)])).some(s => s.isWinner)).toBe(false);
  });
});

describe('admin battle sides — placement modes (every robot is team 1)', () => {
  it.each(['koth', 'grand_melee'])('%s: shows the recorded winner robot', (battleType) => {
    const r = row(battleType, 2);
    const f = facts([part(1, 1, { placement: 2 }), part(2, 1, { placement: 1 }), part(3, 1, { placement: 3 })]);
    const summary = summariseSides(r, f, outcomeOf(r, f));
    expect(summary.sides.map(s => ({ label: s.label, isWinner: s.isWinner }))).toEqual([{ label: 'R2', isWinner: true }]);
    expect(summary.field?.others).toBe(2);
  });

  it.each(['koth', 'grand_melee'])('%s: a deleted winner is Unknown, never the runner-up', (battleType) => {
    const r = row(battleType, 9);
    const f = facts([part(1, 1, { placement: 2 }), part(3, 1, { placement: 3 })]);
    const summary = summariseSides(r, f, outcomeOf(r, f));
    expect(summary.sides).toEqual([{ team: 1, label: 'Unknown', robotCount: 1, stable: null, isWinner: true }]);
    expect(summary.field?.others).toBe(2);
  });

  it('a placement battle without a recorded winner shows the top placement, not as a winner', () => {
    const r = row('grand_melee', null);
    const f = facts([part(1, 1, { placement: 2 }), part(2, 1, { placement: 1 })]);
    expect(sidesOf(r, f)).toEqual([{ label: 'R2', isWinner: false }]);
  });
});
