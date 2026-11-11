/**
 * Public robot profile (#504): standings with rank in the league instance,
 * form, robot achievements (rarest first, hidden left out) and accolades.
 */
const mockRobotFindUnique = jest.fn();
const mockStandingCount = jest.fn();
const mockAchievementFindMany = jest.fn();
const mockAccoladeFindMany = jest.fn();
const mockGetRobotStandings = jest.fn();
const mockGetRecentResults = jest.fn();
const mockRarity = { counts: new Map<string, number>(), totalActivePlayers: 80, refreshedAt: new Date('2026-10-05') };

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    robot: { findUnique: (...a: unknown[]) => mockRobotFindUnique(...a) },
    standing: { count: (...a: unknown[]) => mockStandingCount(...a) },
    userAchievement: { findMany: (...a: unknown[]) => mockAchievementFindMany(...a) },
    seasonAccolade: { findMany: (...a: unknown[]) => mockAccoladeFindMany(...a) },
  },
}));
jest.mock('../../achievement', () => ({
  achievementService: { getRarityData: () => mockRarity },
}));
jest.mock('../../common/stable-view-sections', () => ({
  getRobotStandings: (...a: unknown[]) => mockGetRobotStandings(...a),
  getRecentResults: (...a: unknown[]) => mockGetRecentResults(...a),
}));

import { getRobotProfile, PROFILE_FORM_LIMIT } from '../robot-profile-service';
import { ACHIEVEMENTS } from '../../../config/achievements';

const visible = ACHIEVEMENTS.filter((a) => !a.hidden);
const hidden = ACHIEVEMENTS.find((a) => a.hidden);

const standing = (overrides: Record<string, unknown>) => ({
  mode: 'league_1v1', tier: 'champion', leaguePoints: 142, wins: 57, losses: 35, draws: 3,
  totalMatches: null, teamName: null, teamId: null, leagueInstanceId: 'champion_1', ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockRarity.counts = new Map();
  mockRobotFindUnique.mockResolvedValue({ id: 14684, name: 'Gobbelientje', userId: 203 });
  mockGetRobotStandings.mockResolvedValue(new Map([[14684, []]]));
  mockGetRecentResults.mockResolvedValue([]);
  mockAchievementFindMany.mockResolvedValue([]);
  mockAccoladeFindMany.mockResolvedValue([]);
  mockStandingCount.mockResolvedValue(0);
});

describe('getRobotProfile', () => {
  it('returns null for an unknown robot', async () => {
    mockRobotFindUnique.mockResolvedValue(null);
    expect(await getRobotProfile(1)).toBeNull();
  });

  it('ranks each standing within its league instance and entity type', async () => {
    mockGetRobotStandings.mockResolvedValue(new Map([[14684, [
      standing({}),
      standing({ mode: 'league_3v3', tier: 'diamond', leaguePoints: 212, teamId: 9, teamName: 'LortGob 3v3', leagueInstanceId: 'diamond_1' }),
    ]]]));
    mockStandingCount.mockImplementation(async ({ where }: { where: { leaguePoints?: unknown; entityType: string } }) => {
      if (where.entityType === 'team') return where.leaguePoints ? 2 : 40;
      return where.leaguePoints ? 4 : 30;
    });

    const profile = await getRobotProfile(14684);

    expect(profile?.standings.map((s) => [s.mode, s.rank, s.instanceSize])).toEqual([
      ['league_1v1', 5, 30],
      ['league_3v3', 3, 40],
    ]);
    expect(mockStandingCount).toHaveBeenCalledWith({
      where: { mode: 'league_1v1', leagueInstanceId: 'champion_1', entityType: 'robot', leaguePoints: { gt: 142 } },
    });
  });

  it('asks for the last 10 battles', async () => {
    await getRobotProfile(14684);
    expect(mockGetRecentResults).toHaveBeenCalledWith([{ id: 14684, name: 'Gobbelientje', userId: 203 }], PROFILE_FORM_LIMIT);
  });

  it('lists robot achievements rarest first and leaves hidden ones out', async () => {
    const [a, b] = visible;
    mockRarity.counts = new Map([[a.id, 30], [b.id, 2]]);
    mockAchievementFindMany.mockResolvedValue([
      { achievementId: a.id, unlockedAt: new Date('2026-10-01') },
      { achievementId: b.id, unlockedAt: new Date('2026-10-02') },
      ...(hidden ? [{ achievementId: hidden.id, unlockedAt: new Date('2026-10-03') }] : []),
    ]);

    const profile = await getRobotProfile(14684);

    expect(profile?.achievements.map((x) => [x.id, x.holders])).toEqual([[b.id, 2], [a.id, 30]]);
    expect(mockAchievementFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { robotId: 14684 } }));
  });

  it('matches accolades by owner and robot name, without tournament wins', async () => {
    await getRobotProfile(14684);
    expect(mockAccoladeFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 203, subjectType: 'robot', subjectName: 'Gobbelientje', category: { not: 'tournamentChampion' } },
    }));
  });
});
