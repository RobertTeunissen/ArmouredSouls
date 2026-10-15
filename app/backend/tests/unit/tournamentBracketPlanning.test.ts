/**
 * T14 — knockout bracket planning (design §7, rule 5 and product-owner R1).
 *
 * - `planNextRoundSlots` is positional: the winner of match 2i+1 takes slot 1 and
 *   the winner of match 2i+2 takes slot 2 of next match i+1. A match without a
 *   winner leaves its slot empty instead of shifting every later pairing.
 * - `seedForParticipant` maps a participant id back to its seed from the plain
 *   round-1 rows (no robot objects), so team ids work too.
 * - `resolveHigherSeed` returns the better seed, or p1 when neither resolves.
 * - `advanceWinnersToNextRound` treats `completed`, `forfeit` and `cancelled` as
 *   terminal, pairs positionally and never throws for a round without winners.
 */
import * as fc from 'fast-check';
import prisma from '../../src/lib/prisma';
import {
  advanceWinnersToNextRound,
  generateStandardSeedOrder,
  planNextRoundSlots,
  resolveHigherSeed,
  seedForParticipant,
} from '../../src/services/tournament/tournamentService';

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    tournament: { findUnique: jest.fn(), update: jest.fn() },
    scheduledTournamentMatch: { findMany: jest.fn(), update: jest.fn() },
    robot: { findUnique: jest.fn() },
    teamBattle: { findUnique: jest.fn() },
    user: { update: jest.fn() },
  },
}));

const mockedPrisma = prisma as unknown as {
  tournament: { findUnique: jest.Mock; update: jest.Mock };
  scheduledTournamentMatch: { findMany: jest.Mock; update: jest.Mock };
  robot: { findUnique: jest.Mock };
  teamBattle: { findUnique: jest.Mock };
  user: { update: jest.Mock };
};

interface PlainRound1 {
  matchNumber: number;
  participant1Id: number | null;
  participant2Id: number | null;
}

/** Round-1 rows exactly as bracket generation builds them (byes normalised to slot 1). */
function buildRound1(participantCount: number, bracketSize: number): PlainRound1[] {
  const seedOrder = generateStandardSeedOrder(bracketSize);
  const slots: Array<number | null> = new Array(bracketSize).fill(null);
  // Participant id = 1000 + seed, so the expected seed is recoverable from the id.
  for (let seed = 1; seed <= participantCount; seed++) slots[seedOrder[seed - 1] - 1] = 1000 + seed;
  const rows: PlainRound1[] = [];
  let matchNumber = 1;
  for (let i = 0; i < bracketSize; i += 2) {
    let p1 = slots[i];
    let p2 = slots[i + 1];
    if (p1 === null && p2 === null) continue;
    if (p1 === null) {
      p1 = p2;
      p2 = null;
    }
    rows.push({ matchNumber: matchNumber++, participant1Id: p1, participant2Id: p2 });
  }
  return rows;
}

const bracketArb = fc
  .integer({ min: 1, max: 6 })
  .chain((rounds) => {
    const bracketSize = 2 ** rounds;
    return fc.tuple(fc.constant(bracketSize), fc.integer({ min: Math.max(2, bracketSize / 2 + 1), max: bracketSize }));
  });

describe('planNextRoundSlots (positional)', () => {
  it('places the winner of match 2i+1 in slot 1 and 2i+2 in slot 2 of match i+1', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 6 }).chain((rounds) => {
          const matches = 2 ** rounds / 2;
          return fc.tuple(
            fc.constant(matches),
            fc.array(fc.option(fc.integer({ min: 1, max: 100_000 }), { nil: null }), {
              minLength: matches,
              maxLength: matches,
            }),
          );
        }),
        ([matches, winners]) => {
          const current = winners.map((winnerId, i) => ({ matchNumber: i + 1, winnerId }));
          const nextCount = Math.max(1, matches / 2);
          const plan = planNextRoundSlots(current, nextCount);
          expect(plan).toHaveLength(nextCount);
          for (let i = 0; i < nextCount; i++) {
            expect(plan[i].participant1Id).toBe(winners[2 * i] ?? null);
            expect(plan[i].participant2Id).toBe(winners[2 * i + 1] ?? null);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('does not shift match 2 when match 1 has no winner', () => {
    const plan = planNextRoundSlots(
      [
        { matchNumber: 1, winnerId: null },
        { matchNumber: 2, winnerId: 22 },
        { matchNumber: 3, winnerId: 33 },
        { matchNumber: 4, winnerId: 44 },
      ],
      2,
    );
    expect(plan).toEqual([
      { participant1Id: null, participant2Id: 22 },
      { participant1Id: 33, participant2Id: 44 },
    ]);
  });

  it('uses matchNumber, not input order', () => {
    const plan = planNextRoundSlots(
      [
        { matchNumber: 2, winnerId: 22 },
        { matchNumber: 1, winnerId: 11 },
      ],
      1,
    );
    expect(plan).toEqual([{ participant1Id: 11, participant2Id: 22 }]);
  });
});

describe('seedForParticipant', () => {
  it('recovers every participant seed from plain round-1 rows (sizes 2-64)', () => {
    fc.assert(
      fc.property(bracketArb, ([bracketSize, n]) => {
        const round1 = buildRound1(n, bracketSize);
        for (let seed = 1; seed <= n; seed++) {
          expect(seedForParticipant(round1, bracketSize, 1000 + seed)).toBe(seed);
        }
        expect(seedForParticipant(round1, bracketSize, 1)).toBeNull();
      }),
      { numRuns: 200 },
    );
  });

  it('does not depend on the input order of the rows', () => {
    const round1 = buildRound1(6, 8).reverse();
    expect(seedForParticipant(round1, 8, 1001)).toBe(1);
    expect(seedForParticipant(round1, 8, 1006)).toBe(6);
  });
});

describe('resolveHigherSeed', () => {
  beforeEach(() => jest.clearAllMocks());

  function mockBracket(n: number, bracketSize: number): void {
    mockedPrisma.tournament.findUnique.mockResolvedValue({ id: 5, maxRounds: Math.log2(bracketSize) });
    mockedPrisma.scheduledTournamentMatch.findMany.mockResolvedValue(buildRound1(n, bracketSize));
  }

  it('returns the participant with the better (lower) seed regardless of argument order', async () => {
    mockBracket(8, 8);
    await expect(resolveHigherSeed(5, 1004, 1001)).resolves.toBe(1001);
    await expect(resolveHigherSeed(5, 1001, 1004)).resolves.toBe(1001);
  });

  it('returns the seeded participant when only one resolves', async () => {
    mockBracket(8, 8);
    await expect(resolveHigherSeed(5, 77, 1003)).resolves.toBe(1003);
  });

  it('returns p1 when neither participant resolves', async () => {
    mockBracket(8, 8);
    await expect(resolveHigherSeed(5, 77, 88)).resolves.toBe(77);
  });
});

describe('advanceWinnersToNextRound', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.scheduledTournamentMatch.update.mockResolvedValue({});
    mockedPrisma.tournament.update.mockResolvedValue({});
  });

  function row(matchNumber: number, status: string, p1: number | null, p2: number | null, winnerId: number | null) {
    return { id: 100 + matchNumber, tournamentId: 9, round: 1, matchNumber, participant1Id: p1, participant2Id: p2, winnerId, status, isByeMatch: false, battleId: null };
  }

  function next(matchNumber: number) {
    return { id: 200 + matchNumber, tournamentId: 9, round: 2, matchNumber, participant1Id: null, participant2Id: null, winnerId: null, status: 'pending', isByeMatch: false, battleId: null };
  }

  it('advances forfeit and cancelled winners positionally', async () => {
    const current = [
      row(1, 'cancelled', 1, 8, 1),
      row(2, 'forfeit', 4, 5, 5),
      row(3, 'completed', 2, 7, 7),
      row(4, 'cancelled', 3, 6, 3),
    ];
    mockedPrisma.tournament.findUnique.mockResolvedValue({ id: 9, currentRound: 1, maxRounds: 3 });
    mockedPrisma.scheduledTournamentMatch.findMany
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce([next(1), next(2)]);

    await advanceWinnersToNextRound(9);

    const updates = mockedPrisma.scheduledTournamentMatch.update.mock.calls.map((c) => c[0]);
    expect(updates[0]).toEqual(expect.objectContaining({ where: { id: 201 }, data: expect.objectContaining({ participant1Id: 1, participant2Id: 5, status: 'pending', isByeMatch: false }) }));
    expect(updates[1]).toEqual(expect.objectContaining({ where: { id: 202 }, data: expect.objectContaining({ participant1Id: 7, participant2Id: 3, status: 'pending', isByeMatch: false }) }));
    expect(mockedPrisma.tournament.update).toHaveBeenCalledWith({ where: { id: 9 }, data: { currentRound: 2 } });
  });

  it('keeps later pairings in place when match 1 has no winner', async () => {
    const current = [
      row(1, 'completed', null, null, null),
      row(2, 'completed', 4, 5, 4),
      row(3, 'completed', 2, 7, 2),
      row(4, 'completed', 3, 6, 6),
    ];
    mockedPrisma.tournament.findUnique.mockResolvedValue({ id: 9, currentRound: 1, maxRounds: 3 });
    mockedPrisma.scheduledTournamentMatch.findMany
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce([next(1), next(2)]);

    await advanceWinnersToNextRound(9);

    const updates = mockedPrisma.scheduledTournamentMatch.update.mock.calls.map((c) => c[0]);
    expect(updates[0].data).toEqual(expect.objectContaining({ participant1Id: null, participant2Id: 4, isByeMatch: true, status: 'pending' }));
    expect(updates[1].data).toEqual(expect.objectContaining({ participant1Id: 2, participant2Id: 6, isByeMatch: false }));
  });

  it('waits while any match of the round is still queued', async () => {
    const current = [row(1, 'completed', 1, 2, 1), row(2, 'pending', 3, 4, null)];
    mockedPrisma.tournament.findUnique.mockResolvedValue({ id: 9, currentRound: 1, maxRounds: 2 });
    mockedPrisma.scheduledTournamentMatch.findMany
      .mockResolvedValueOnce([current[0]])
      .mockResolvedValueOnce(current);

    await advanceWinnersToNextRound(9);

    expect(mockedPrisma.scheduledTournamentMatch.update).not.toHaveBeenCalled();
    expect(mockedPrisma.tournament.update).not.toHaveBeenCalled();
  });

  it('crowns the higher seed of a cancelled final', async () => {
    const final = [{ ...row(1, 'cancelled', 1, 2, 1), round: 2 }];
    mockedPrisma.tournament.findUnique.mockResolvedValue({ id: 9, currentRound: 2, maxRounds: 2, participantType: 'robot' });
    mockedPrisma.scheduledTournamentMatch.findMany.mockResolvedValueOnce(final).mockResolvedValueOnce(final);
    mockedPrisma.robot.findUnique.mockResolvedValue(null);

    await advanceWinnersToNextRound(9);

    expect(mockedPrisma.tournament.update).toHaveBeenCalledWith({
      where: { id: 9 },
      data: { status: 'completed', winnerId: 1, completedAt: expect.any(Date) },
    });
  });

  it('completes without a champion instead of throwing when no match has a winner', async () => {
    const final = [{ ...row(1, 'cancelled', null, null, null), round: 2 }];
    mockedPrisma.tournament.findUnique.mockResolvedValue({ id: 9, currentRound: 2, maxRounds: 2, participantType: 'robot' });
    mockedPrisma.scheduledTournamentMatch.findMany.mockResolvedValueOnce(final).mockResolvedValueOnce(final);

    await expect(advanceWinnersToNextRound(9)).resolves.toBeUndefined();

    expect(mockedPrisma.tournament.update).toHaveBeenCalledWith({
      where: { id: 9 },
      data: { status: 'completed', winnerId: null, completedAt: expect.any(Date) },
    });
    expect(mockedPrisma.user.update).not.toHaveBeenCalled();
  });

  it('completes without a champion when a non-final round has no winner', async () => {
    const current = [row(1, 'completed', null, null, null), row(2, 'cancelled', null, null, null)];
    mockedPrisma.tournament.findUnique.mockResolvedValue({ id: 9, currentRound: 1, maxRounds: 2, participantType: 'robot' });
    mockedPrisma.scheduledTournamentMatch.findMany.mockResolvedValueOnce(current).mockResolvedValueOnce(current);

    await expect(advanceWinnersToNextRound(9)).resolves.toBeUndefined();

    expect(mockedPrisma.tournament.update).toHaveBeenCalledWith({
      where: { id: 9 },
      data: { status: 'completed', winnerId: null, completedAt: expect.any(Date) },
    });
    expect(mockedPrisma.scheduledTournamentMatch.update).not.toHaveBeenCalled();
  });

  it('advances a lone survivor of a non-final round instead of crowning it', async () => {
    const current = [row(1, 'completed', 1, 4, 1), row(2, 'completed', null, null, null)];
    mockedPrisma.tournament.findUnique.mockResolvedValue({ id: 9, currentRound: 1, maxRounds: 2, participantType: 'robot' });
    mockedPrisma.scheduledTournamentMatch.findMany
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce([next(1)]);

    await advanceWinnersToNextRound(9);

    expect(mockedPrisma.scheduledTournamentMatch.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 201 }, data: expect.objectContaining({ participant1Id: 1, participant2Id: null, isByeMatch: true }) }),
    );
    expect(mockedPrisma.tournament.update).toHaveBeenCalledWith({ where: { id: 9 }, data: { currentRound: 2 } });
  });
});
