/**
 * #595 — the "Players" rule behind the Stables filter (human stables, not
 * generated) and the per-instance player counts on League Standings.
 */
const mockRobotFindMany = jest.fn();
const mockTeamFindMany = jest.fn();
const mockStandingFindMany = jest.fn();

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    robot: { findMany: (...args: unknown[]) => mockRobotFindMany(...args) },
    teamBattle: { findMany: (...args: unknown[]) => mockTeamFindMany(...args) },
    standing: { findMany: (...args: unknown[]) => mockStandingFindMany(...args) },
  },
}));

import { countPlayersPerInstance, isPlayerStable, PLAYER_STABLE, playerOwnedEntityIds } from '../playerStables';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('isPlayerStable', () => {
  it('is true only for a human stable that is not generated', () => {
    expect(isPlayerStable({ stableType: 'human', isGenerated: false })).toBe(true);
    expect(isPlayerStable({ stableType: 'automaton', isGenerated: false })).toBe(false);
    expect(isPlayerStable({ stableType: 'generated', isGenerated: true })).toBe(false);
    expect(isPlayerStable({ stableType: 'human', isGenerated: true })).toBe(false);
  });
});

describe('playerOwnedEntityIds', () => {
  it('asks for robots owned by a player stable, once per id', async () => {
    mockRobotFindMany.mockResolvedValue([{ id: 2 }]);

    await expect(playerOwnedEntityIds('robot', [1, 2, 2])).resolves.toEqual(new Set([2]));
    expect(mockRobotFindMany).toHaveBeenCalledWith({ where: { id: { in: [1, 2] }, user: PLAYER_STABLE }, select: { id: true } });
    expect(mockTeamFindMany).not.toHaveBeenCalled();
  });

  it('asks for teams by their stable for team standings', async () => {
    mockTeamFindMany.mockResolvedValue([{ id: 7 }]);

    await expect(playerOwnedEntityIds('team', [7, 8])).resolves.toEqual(new Set([7]));
    expect(mockTeamFindMany).toHaveBeenCalledWith({ where: { id: { in: [7, 8] }, stable: PLAYER_STABLE }, select: { id: true } });
  });

  it('does not query for no ids', async () => {
    await expect(playerOwnedEntityIds('robot', [])).resolves.toEqual(new Set());
    expect(mockRobotFindMany).not.toHaveBeenCalled();
  });
});

describe('countPlayersPerInstance', () => {
  it('counts player entries per instance and leaves out instances without players', async () => {
    mockStandingFindMany.mockResolvedValue([
      { entityType: 'robot', entityId: 1, leagueInstanceId: 'diamond_1' },
      { entityType: 'robot', entityId: 2, leagueInstanceId: 'diamond_1' },
      { entityType: 'robot', entityId: 3, leagueInstanceId: 'diamond_1' },
      { entityType: 'robot', entityId: 4, leagueInstanceId: 'diamond_2' },
    ]);
    mockRobotFindMany.mockResolvedValue([{ id: 1 }, { id: 3 }]);

    const counts = await countPlayersPerInstance('league_1v1', 'diamond');

    expect(counts).toEqual(new Map([['diamond_1', 2]]));
    expect(mockStandingFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { mode: 'league_1v1', tier: 'diamond' } }));
  });

  it('returns no counts for an empty tier', async () => {
    mockStandingFindMany.mockResolvedValue([]);
    await expect(countPlayersPerInstance('tag_team', 'gold')).resolves.toEqual(new Map());
    expect(mockTeamFindMany).not.toHaveBeenCalled();
  });
});
