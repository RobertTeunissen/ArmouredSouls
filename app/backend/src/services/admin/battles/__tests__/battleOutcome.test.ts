jest.mock('../../../../lib/prisma', () => ({ __esModule: true, default: {} }));

import { classifyBattleOutcome, eloSwing, type OutcomeInput, type OutcomeParticipant } from '../battleOutcome';

const p = (robotId: number, team: number, extra: Partial<OutcomeParticipant> = {}): OutcomeParticipant => ({
  robotId, team, destroyed: false, yielded: false, forfeited: false, ...extra,
});

const base = (overrides: Partial<OutcomeInput>): OutcomeInput => ({
  battleType: 'league_1v1',
  winnerId: null,
  winningSide: null,
  durationSeconds: 40,
  participants: [p(1, 1), p(2, 2)],
  isBye: false,
  isForfeitTournamentBattle: false,
  ...overrides,
});

describe('classifyBattleOutcome — 1v1', () => {
  it('resolves the winner robot to its side and reports a destroyed loser', () => {
    const out = classifyBattleOutcome(base({ winnerId: 2, participants: [p(1, 1, { destroyed: true }), p(2, 2)] }));
    expect(out).toMatchObject({ result: 'win', winningSide: 2, winnerRobotId: 2, endedBy: 'destroyed' });
  });

  it('reports a yield', () => {
    const out = classifyBattleOutcome(base({ winnerId: 1, participants: [p(1, 1), p(2, 2, { yielded: true })] }));
    expect(out.endedBy).toBe('yield');
  });

  it('is a draw when neither winner column is set, ended by the time limit at 120 s', () => {
    const out = classifyBattleOutcome(base({ durationSeconds: 120 }));
    expect(out).toMatchObject({ result: 'draw', winningSide: null, winnerRobotId: null, endedBy: 'time_limit' });
  });

  it('keeps a win whose winner robot was deleted as a win with no side', () => {
    const out = classifyBattleOutcome(base({ winnerId: 99, participants: [p(2, 2)] }));
    expect(out).toMatchObject({ result: 'win', winningSide: null, winnerRobotId: null });
  });
});

describe('classifyBattleOutcome — team modes', () => {
  const team = [p(10, 1), p(11, 1), p(20, 2, { destroyed: true }), p(21, 2, { yielded: true })];

  it('uses winning_side, never treating winner_id (a team id) as a robot', () => {
    // winner_id 20 is the TEAM id and collides with a robot on the losing side.
    const out = classifyBattleOutcome(base({ battleType: 'league_2v2', winnerId: 20, winningSide: 1, participants: team }));
    expect(out).toMatchObject({ result: 'win', winningSide: 1, winnerRobotId: null, endedBy: 'team_eliminated' });
  });

  it('reports the time limit when the losers are still standing at 300 s', () => {
    const standing = [p(10, 1), p(11, 1), p(20, 2), p(21, 2)];
    const out = classifyBattleOutcome(base({ battleType: 'tag_team', winnerId: 5, winningSide: 2, durationSeconds: 300, participants: standing }));
    expect(out).toMatchObject({ result: 'win', winningSide: 2, endedBy: 'time_limit' });
  });

  it('is a draw at the team time limit', () => {
    const out = classifyBattleOutcome(base({ battleType: 'league_3v3', durationSeconds: 300, participants: [p(1, 1), p(2, 2)] }));
    expect(out).toMatchObject({ result: 'draw', endedBy: 'time_limit' });
  });
});

describe('classifyBattleOutcome — byes and forfeits', () => {
  it('a bye has no "ended by"', () => {
    const out = classifyBattleOutcome(base({ isBye: true, winnerId: 1, participants: [p(1, 1)], durationSeconds: 15 }));
    expect(out).toMatchObject({ result: 'bye', winningSide: 1, endedBy: null });
  });

  it('a two-sided battle with a forfeiter is a forfeit', () => {
    const out = classifyBattleOutcome(base({ winnerId: 1, participants: [p(1, 1), p(2, 2, { forfeited: true })] }));
    expect(out).toMatchObject({ result: 'forfeit', forfeitedRobotIds: [2], endedBy: null });
  });

  it('a forfeit bracket row is a forfeit even without forfeited participants', () => {
    const out = classifyBattleOutcome(base({ battleType: 'tournament_2v2', winningSide: 1, isForfeitTournamentBattle: true }));
    expect(out.result).toBe('forfeit');
  });

  it('a fought placement battle with some forfeiters is not a forfeit', () => {
    const field = [p(1, 1), p(2, 1, { destroyed: true }), p(3, 1, { forfeited: true })];
    const out = classifyBattleOutcome(base({ battleType: 'grand_melee', winnerId: 1, participants: field }));
    expect(out).toMatchObject({ result: 'win', winnerRobotId: 1, endedBy: 'last_standing', forfeitedRobotIds: [3] });
  });
});

describe('classifyBattleOutcome — placement modes', () => {
  const field = [p(1, 1), p(2, 1), p(3, 1, { destroyed: true })];

  it('KotH: score reached when the winner hit the threshold', () => {
    const out = classifyBattleOutcome(base({
      battleType: 'koth', winnerId: 1, participants: field,
      koth: { winnerZoneScore: 30, scoreThreshold: 30 },
    }));
    expect(out).toMatchObject({ result: 'win', winningSide: null, winnerRobotId: 1, endedBy: 'score_reached' });
  });

  it('KotH: time limit when below the threshold with several survivors', () => {
    const out = classifyBattleOutcome(base({
      battleType: 'koth', winnerId: 1, participants: field, durationSeconds: 150,
      koth: { winnerZoneScore: 22, scoreThreshold: 30 },
    }));
    expect(out.endedBy).toBe('time_limit');
  });

  it('Grand Melee: last standing when one robot is left', () => {
    const out = classifyBattleOutcome(base({
      battleType: 'grand_melee', winnerId: 1,
      participants: [p(1, 1), p(2, 1, { destroyed: true }), p(3, 1, { yielded: true })],
    }));
    expect(out.endedBy).toBe('last_standing');
  });
});

describe('eloSwing', () => {
  const elo = [{ eloBefore: 1200, eloAfter: 1212 }, { eloBefore: 1300, eloAfter: 1288 }];

  it('is the largest absolute change in a fought two-sided battle', () => {
    expect(eloSwing('league_1v1', 'win', elo)).toBe(12);
    expect(eloSwing('league_1v1', 'draw', [{ eloBefore: 1200, eloAfter: 1200 }])).toBe(0);
  });

  it('is null for placement modes, byes and forfeits', () => {
    expect(eloSwing('koth', 'win', elo)).toBeNull();
    expect(eloSwing('league_1v1', 'bye', elo)).toBeNull();
    expect(eloSwing('league_1v1', 'forfeit', elo)).toBeNull();
  });
});
