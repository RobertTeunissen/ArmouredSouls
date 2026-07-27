/**
 * resolveTeamModeWins — Spec #46 Requirement 8 Cause A
 *
 * **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**
 */

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    teamBattleMember: { findMany: jest.fn() },
    standing: { findMany: jest.fn() },
  },
}));

import prisma from '../../../lib/prisma';
import { resolveTeamModeWins, resolveTeamModeWinsForRobot, emptyTeamModeWins } from '../teamModeWins';

const mockPrisma = prisma as unknown as {
  teamBattleMember: { findMany: jest.Mock };
  standing: { findMany: jest.Mock };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.teamBattleMember.findMany.mockResolvedValue([]);
  mockPrisma.standing.findMany.mockResolvedValue([]);
});

describe('resolveTeamModeWins', () => {
  it('resolves a size-2 membership to both league_2v2 and tag_team', async () => {
    // One TeamBattle, two competitive tracks — Tag Team is a combat mode on the
    // same row, not a separate entity.
    mockPrisma.teamBattleMember.findMany.mockResolvedValue([
      { robotId: 7, teamId: 100, team: { teamSize: 2 } },
    ]);
    mockPrisma.standing.findMany.mockResolvedValue([
      { entityId: 100, mode: 'league_2v2', wins: 25 },
      { entityId: 100, mode: 'tag_team', wins: 40 },
    ]);

    const result = await resolveTeamModeWins([7]);

    expect(result.get(7)).toEqual({ league_2v2: 25, league_3v3: 0, tag_team: 40 });
  });

  it('resolves a size-3 membership to league_3v3 only', async () => {
    mockPrisma.teamBattleMember.findMany.mockResolvedValue([
      { robotId: 8, teamId: 200, team: { teamSize: 3 } },
    ]);
    mockPrisma.standing.findMany.mockResolvedValue([
      { entityId: 200, mode: 'league_3v3', wins: 25 },
    ]);

    const result = await resolveTeamModeWins([8]);

    expect(result.get(8)).toEqual({ league_2v2: 0, league_3v3: 25, tag_team: 0 });
  });

  it('resolves a robot on both a 2v2 and a 3v3 team', async () => {
    // A robot may belong to one team per size, so both are legitimate.
    mockPrisma.teamBattleMember.findMany.mockResolvedValue([
      { robotId: 9, teamId: 100, team: { teamSize: 2 } },
      { robotId: 9, teamId: 200, team: { teamSize: 3 } },
    ]);
    mockPrisma.standing.findMany.mockResolvedValue([
      { entityId: 100, mode: 'league_2v2', wins: 12 },
      { entityId: 100, mode: 'tag_team', wins: 7 },
      { entityId: 200, mode: 'league_3v3', wins: 30 },
    ]);

    const result = await resolveTeamModeWins([9]);

    expect(result.get(9)).toEqual({ league_2v2: 12, league_3v3: 30, tag_team: 7 });
  });

  it('resolves a robot with no membership to explicit zeros rather than undefined', async () => {
    // The evaluator runs for every participant of every battle, so an absent
    // membership has to resolve rather than raise or return undefined.
    const result = await resolveTeamModeWins([42]);
    expect(result.get(42)).toEqual({ league_2v2: 0, league_3v3: 0, tag_team: 0 });
  });

  it('resolves a mode with a membership but no standing row to zero', async () => {
    mockPrisma.teamBattleMember.findMany.mockResolvedValue([
      { robotId: 10, teamId: 300, team: { teamSize: 2 } },
    ]);
    mockPrisma.standing.findMany.mockResolvedValue([]);

    const result = await resolveTeamModeWins([10]);
    expect(result.get(10)).toEqual({ league_2v2: 0, league_3v3: 0, tag_team: 0 });
  });

  it('returns an entry for every requested robot', async () => {
    mockPrisma.teamBattleMember.findMany.mockResolvedValue([
      { robotId: 1, teamId: 100, team: { teamSize: 2 } },
    ]);
    mockPrisma.standing.findMany.mockResolvedValue([
      { entityId: 100, mode: 'league_2v2', wins: 5 },
    ]);

    const result = await resolveTeamModeWins([1, 2, 3]);

    expect([...result.keys()].sort()).toEqual([1, 2, 3]);
    expect(result.get(2)).toEqual(emptyTeamModeWins());
  });

  it('queries the standings table with entityType team, not robot', async () => {
    // The whole defect was reading these modes from robot-scoped standings.
    mockPrisma.teamBattleMember.findMany.mockResolvedValue([
      { robotId: 1, teamId: 100, team: { teamSize: 2 } },
    ]);

    await resolveTeamModeWins([1]);

    expect(mockPrisma.standing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ entityType: 'team' }),
      }),
    );
  });

  it('batches into exactly two queries regardless of robot count', async () => {
    mockPrisma.teamBattleMember.findMany.mockResolvedValue([
      { robotId: 1, teamId: 100, team: { teamSize: 2 } },
      { robotId: 2, teamId: 101, team: { teamSize: 2 } },
      { robotId: 3, teamId: 102, team: { teamSize: 3 } },
    ]);
    mockPrisma.standing.findMany.mockResolvedValue([]);

    await resolveTeamModeWins([1, 2, 3, 4, 5]);

    expect(mockPrisma.teamBattleMember.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.standing.findMany).toHaveBeenCalledTimes(1);
  });

  it('issues no queries for an empty robot list', async () => {
    const result = await resolveTeamModeWins([]);
    expect(result.size).toBe(0);
    expect(mockPrisma.teamBattleMember.findMany).not.toHaveBeenCalled();
  });

  it('deduplicates repeated robot ids', async () => {
    await resolveTeamModeWins([5, 5, 5]);
    expect(mockPrisma.teamBattleMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { robotId: { in: [5] } } }),
    );
  });

  it('takes the highest count if the one-team-per-size invariant is ever broken', async () => {
    // TeamBattleMember's unique indexes are team-scoped, so nothing at the schema
    // level prevents two size-2 memberships. Taking the max means a duplicate row
    // cannot cause the achievement to be under-awarded.
    mockPrisma.teamBattleMember.findMany.mockResolvedValue([
      { robotId: 11, teamId: 100, team: { teamSize: 2 } },
      { robotId: 11, teamId: 101, team: { teamSize: 2 } },
    ]);
    mockPrisma.standing.findMany.mockResolvedValue([
      { entityId: 100, mode: 'league_2v2', wins: 3 },
      { entityId: 101, mode: 'league_2v2', wins: 30 },
    ]);

    const result = await resolveTeamModeWins([11]);
    expect(result.get(11)!.league_2v2).toBe(30);
  });
});

describe('resolveTeamModeWinsForRobot', () => {
  it('returns the single robot entry', async () => {
    mockPrisma.teamBattleMember.findMany.mockResolvedValue([
      { robotId: 3, teamId: 100, team: { teamSize: 3 } },
    ]);
    mockPrisma.standing.findMany.mockResolvedValue([
      { entityId: 100, mode: 'league_3v3', wins: 26 },
    ]);

    await expect(resolveTeamModeWinsForRobot(3)).resolves.toEqual({
      league_2v2: 0,
      league_3v3: 26,
      tag_team: 0,
    });
  });

  it('returns zeros for a robot on no team', async () => {
    await expect(resolveTeamModeWinsForRobot(99)).resolves.toEqual(emptyTeamModeWins());
  });
});

describe('emptyTeamModeWins', () => {
  it('returns a fresh mutable object each call, not a shared reference', async () => {
    const a = emptyTeamModeWins();
    const b = emptyTeamModeWins();
    a.tag_team = 5;
    expect(b.tag_team).toBe(0);
  });
});
