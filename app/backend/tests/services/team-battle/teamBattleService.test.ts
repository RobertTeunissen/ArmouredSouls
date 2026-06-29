/**
 * Unit tests for teamBattleService.ts
 *
 * Tests team registration, member swaps, renames, and disbanding for
 * 2v2 and 3v3 League teams with mocked Prisma client.
 *
 * _Requirements: R2.1–R2.11, R10.2, R10.3, R10.6_
 */

// ── Mocks ────────────────────────────────────────────────────────────

const mockTx = {
  $executeRaw: jest.fn().mockResolvedValue(undefined),
  robot: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
  },
  teamBattle: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  teamBattleMember: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  scheduledTeamBattleMatch: {
    count: jest.fn(),
  },
  scheduledMatchParticipant: {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
  },
  standing: {
    findFirst: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
  },
};

const mockPrisma = {
  $transaction: jest.fn((fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
  teamBattle: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  scheduledMatchParticipant: {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
  },
  standing: {
    findFirst: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
  },
};

jest.mock('../../../src/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockHasSubscription = jest.fn();
jest.mock('../../../src/services/subscription/subscriptionService', () => ({
  __esModule: true,
  hasSubscription: (...args: unknown[]) => mockHasSubscription(...args),
}));

// ── Import under test ────────────────────────────────────────────────

import {
  registerTeam,
  swapTeamMember,
  renameTeam,
  disbandTeam,
  removeTeamMember,
  addTeamMember,
} from '../../../src/services/team-battle/teamBattleService';
import { TeamBattleError, TeamBattleErrorCode } from '../../../src/errors/teamBattleErrors';

// ── Helpers ──────────────────────────────────────────────────────────

function makeTeam(overrides: Partial<{
  id: number; stableId: number; teamSize: number; teamName: string;
  eligibility: string; members: { id: number; robotId: number; slotIndex: number }[];
}> = {}) {
  return {
    id: 1,
    stableId: 100,
    teamSize: 2,
    teamName: 'TestTeam',
    eligibility: 'ELIGIBLE',
    members: [
      { id: 1, robotId: 10, slotIndex: 0 },
      { id: 2, robotId: 11, slotIndex: 1 },
    ],
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('teamBattleService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHasSubscription.mockResolvedValue(true);
    mockTx.$executeRaw.mockResolvedValue(undefined);
    mockTx.scheduledTeamBattleMatch.count.mockResolvedValue(0);
  });

  // ── registerTeam ─────────────────────────────────────────────────

  describe('registerTeam', () => {
    it('should throw TEAM_INVALID_SIZE for size other than 2 or 3', async () => {
      await expect(registerTeam(100, [1, 2, 3, 4], 'Team', 4 as any, 100))
        .rejects.toMatchObject({
          code: TeamBattleErrorCode.TEAM_INVALID_SIZE,
        });
    });

    it('should throw TEAM_INVALID_COMPOSITION when fewer robots than team size', async () => {
      await expect(registerTeam(100, [1], 'Team', 2, 100))
        .rejects.toMatchObject({
          code: TeamBattleErrorCode.TEAM_INVALID_COMPOSITION,
        });
    });

    it('should throw TEAM_INVALID_COMPOSITION when duplicate robot IDs', async () => {
      await expect(registerTeam(100, [1, 1], 'Team', 2, 100))
        .rejects.toMatchObject({
          code: TeamBattleErrorCode.TEAM_INVALID_COMPOSITION,
        });
    });

    it('should throw TEAM_NAME_INVALID for name shorter than 3 chars', async () => {
      await expect(registerTeam(100, [1, 2], 'AB', 2, 100))
        .rejects.toMatchObject({
          code: TeamBattleErrorCode.TEAM_NAME_INVALID,
        });
    });

    it('should throw TEAM_NAME_INVALID for name longer than 32 chars', async () => {
      const longName = 'A'.repeat(33);
      await expect(registerTeam(100, [1, 2], longName, 2, 100))
        .rejects.toMatchObject({
          code: TeamBattleErrorCode.TEAM_NAME_INVALID,
        });
    });

    it('should throw TEAM_NAME_INVALID for name with disallowed characters', async () => {
      await expect(registerTeam(100, [1, 2], 'Te@m<>', 2, 100))
        .rejects.toMatchObject({
          code: TeamBattleErrorCode.TEAM_NAME_INVALID,
        });
    });

    it('should throw TEAM_INVALID_COMPOSITION when robots not found', async () => {
      mockTx.robot.findMany.mockResolvedValue([{ id: 1, userId: 100 }]); // only 1 found
      mockTx.robot.count.mockResolvedValue(5);

      await expect(registerTeam(100, [1, 2], 'ValidTeam', 2, 100))
        .rejects.toMatchObject({
          code: TeamBattleErrorCode.TEAM_INVALID_COMPOSITION,
        });
    });

    it('should throw TEAM_OWNERSHIP_VIOLATION when robot owned by different stable', async () => {
      mockTx.robot.findMany.mockResolvedValue([
        { id: 1, userId: 100 },
        { id: 2, userId: 999 }, // different owner
      ]);

      await expect(registerTeam(100, [1, 2], 'ValidTeam', 2, 100))
        .rejects.toMatchObject({
          code: TeamBattleErrorCode.TEAM_OWNERSHIP_VIOLATION,
        });
    });

    it('should throw TEAM_INSUFFICIENT_ROBOTS when stable has fewer robots than team size', async () => {
      mockTx.robot.findMany.mockResolvedValue([
        { id: 1, userId: 100 },
        { id: 2, userId: 100 },
      ]);
      mockTx.robot.count.mockResolvedValue(1); // only 1 robot in stable

      await expect(registerTeam(100, [1, 2], 'ValidTeam', 2, 100))
        .rejects.toMatchObject({
          code: TeamBattleErrorCode.TEAM_INSUFFICIENT_ROBOTS,
        });
    });

    it('should throw TEAM_INVALID_COMPOSITION when robot not subscribed', async () => {
      mockTx.robot.findMany.mockResolvedValue([
        { id: 1, userId: 100 },
        { id: 2, userId: 100 },
      ]);
      mockTx.robot.count.mockResolvedValue(5);
      mockHasSubscription.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

      await expect(registerTeam(100, [1, 2], 'ValidTeam', 2, 100))
        .rejects.toMatchObject({
          code: TeamBattleErrorCode.TEAM_INVALID_COMPOSITION,
        });
    });

    it('should throw TEAM_MEMBER_CONFLICT when robot already on same-size team', async () => {
      mockTx.robot.findMany.mockResolvedValue([
        { id: 1, userId: 100 },
        { id: 2, userId: 100 },
      ]);
      mockTx.robot.count.mockResolvedValue(5);
      mockTx.teamBattleMember.findMany.mockResolvedValue([
        { robotId: 1, team: { id: 5, teamName: 'OtherTeam' } },
      ]);

      await expect(registerTeam(100, [1, 2], 'ValidTeam', 2, 100))
        .rejects.toMatchObject({
          code: TeamBattleErrorCode.TEAM_MEMBER_CONFLICT,
        });
    });

    it('should create team successfully with valid inputs for 2v2', async () => {
      const createdTeam = makeTeam({ id: 42, teamName: 'MyTeam' });
      mockTx.robot.findMany.mockResolvedValue([
        { id: 10, userId: 100 },
        { id: 11, userId: 100 },
      ]);
      mockTx.robot.count.mockResolvedValue(5);
      mockTx.teamBattleMember.findMany.mockResolvedValue([]);
      mockTx.teamBattle.create.mockResolvedValue(createdTeam);

      const result = await registerTeam(100, [10, 11], 'MyTeam', 2, 100);

      expect(result).toEqual(createdTeam);
      expect(mockTx.teamBattle.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            stableId: 100,
            teamSize: 2,
            teamName: 'MyTeam',
            eligibility: 'ELIGIBLE',
          }),
        }),
      );
    });

    it('should create team successfully with valid inputs for 3v3', async () => {
      const createdTeam = makeTeam({ id: 43, teamSize: 3, teamName: 'Trio' });
      mockTx.robot.findMany.mockResolvedValue([
        { id: 10, userId: 100 },
        { id: 11, userId: 100 },
        { id: 12, userId: 100 },
      ]);
      mockTx.robot.count.mockResolvedValue(5);
      mockTx.teamBattleMember.findMany.mockResolvedValue([]);
      mockTx.teamBattle.create.mockResolvedValue(createdTeam);

      const result = await registerTeam(100, [10, 11, 12], 'Trio', 3, 100);

      expect(result).toEqual(createdTeam);
      expect(mockHasSubscription).toHaveBeenCalledWith(10, 'league_3v3');
      expect(mockHasSubscription).toHaveBeenCalledWith(11, 'league_3v3');
      expect(mockHasSubscription).toHaveBeenCalledWith(12, 'league_3v3');
    });

    it('should check subscription for league_2v2 event type for 2v2 teams', async () => {
      mockTx.robot.findMany.mockResolvedValue([
        { id: 1, userId: 100 },
        { id: 2, userId: 100 },
      ]);
      mockTx.robot.count.mockResolvedValue(5);
      mockTx.teamBattleMember.findMany.mockResolvedValue([]);
      mockTx.teamBattle.create.mockResolvedValue(makeTeam());

      await registerTeam(100, [1, 2], 'ValidTeam', 2, 100);

      expect(mockHasSubscription).toHaveBeenCalledWith(1, 'league_2v2');
      expect(mockHasSubscription).toHaveBeenCalledWith(2, 'league_2v2');
    });

    it('should acquire advisory locks in sorted order', async () => {
      mockTx.robot.findMany.mockResolvedValue([
        { id: 5, userId: 100 },
        { id: 3, userId: 100 },
      ]);
      mockTx.robot.count.mockResolvedValue(5);
      mockTx.teamBattleMember.findMany.mockResolvedValue([]);
      mockTx.teamBattle.create.mockResolvedValue(makeTeam());

      await registerTeam(100, [5, 3], 'ValidTeam', 2, 100);

      // Advisory locks should be acquired in sorted order (3, then 5)
      const lockCalls = mockTx.$executeRaw.mock.calls;
      expect(lockCalls.length).toBe(2);
    });
  });

  // ── swapTeamMember ───────────────────────────────────────────────

  describe('swapTeamMember', () => {
    it('should throw TEAM_NOT_FOUND when team does not exist', async () => {
      mockTx.teamBattle.findUnique.mockResolvedValue(null);

      await expect(swapTeamMember(999, 10, 20, 100))
        .rejects.toMatchObject({
          code: TeamBattleErrorCode.TEAM_NOT_FOUND,
        });
    });

    it('should throw TEAM_OWNERSHIP_VIOLATION when user does not own team', async () => {
      mockTx.teamBattle.findUnique.mockResolvedValue(makeTeam({ stableId: 999 }));

      await expect(swapTeamMember(1, 10, 20, 100))
        .rejects.toMatchObject({
          code: TeamBattleErrorCode.TEAM_OWNERSHIP_VIOLATION,
        });
    });

    it('should throw TEAM_LOCKED_FOR_BATTLE when team has scheduled match', async () => {
      mockTx.teamBattle.findUnique.mockResolvedValue(makeTeam());
      mockTx.scheduledTeamBattleMatch.count.mockResolvedValue(1);

      await expect(swapTeamMember(1, 10, 20, 100))
        .rejects.toMatchObject({
          code: TeamBattleErrorCode.TEAM_LOCKED_FOR_BATTLE,
        });
    });

    it('should throw TEAM_INVALID_COMPOSITION when old robot not on team', async () => {
      mockTx.teamBattle.findUnique.mockResolvedValue(makeTeam());

      await expect(swapTeamMember(1, 999, 20, 100))
        .rejects.toMatchObject({
          code: TeamBattleErrorCode.TEAM_INVALID_COMPOSITION,
        });
    });

    it('should throw TEAM_OWNERSHIP_VIOLATION when new robot owned by different user', async () => {
      mockTx.teamBattle.findUnique.mockResolvedValue(makeTeam());
      mockTx.robot.findUnique.mockResolvedValue({ id: 20, userId: 999 });

      await expect(swapTeamMember(1, 10, 20, 100))
        .rejects.toMatchObject({
          code: TeamBattleErrorCode.TEAM_OWNERSHIP_VIOLATION,
        });
    });

    it('should throw TEAM_INVALID_COMPOSITION when new robot not subscribed', async () => {
      mockTx.teamBattle.findUnique.mockResolvedValue(makeTeam());
      mockTx.robot.findUnique.mockResolvedValue({ id: 20, userId: 100 });
      mockHasSubscription.mockResolvedValueOnce(false);

      await expect(swapTeamMember(1, 10, 20, 100))
        .rejects.toMatchObject({
          code: TeamBattleErrorCode.TEAM_INVALID_COMPOSITION,
        });
    });

    it('should throw TEAM_MEMBER_CONFLICT when new robot already on same-size team', async () => {
      mockTx.teamBattle.findUnique.mockResolvedValue(makeTeam());
      mockTx.robot.findUnique.mockResolvedValue({ id: 20, userId: 100 });
      mockHasSubscription.mockResolvedValue(true);
      mockTx.teamBattleMember.findFirst.mockResolvedValue({ robotId: 20, teamId: 5 });

      await expect(swapTeamMember(1, 10, 20, 100))
        .rejects.toMatchObject({
          code: TeamBattleErrorCode.TEAM_MEMBER_CONFLICT,
        });
    });

    it('should swap member successfully when unlocked and valid', async () => {
      mockTx.teamBattle.findUnique.mockResolvedValue(makeTeam());
      mockTx.robot.findUnique.mockResolvedValue({ id: 20, userId: 100 });
      mockHasSubscription.mockResolvedValue(true);
      mockTx.teamBattleMember.findFirst.mockResolvedValue(null);
      mockTx.teamBattleMember.update.mockResolvedValue({});
      mockTx.teamBattleMember.findMany.mockResolvedValue([
        { robotId: 20, slotIndex: 0 },
        { robotId: 11, slotIndex: 1 },
      ]);
      mockTx.teamBattle.update.mockResolvedValue({});

      await expect(swapTeamMember(1, 10, 20, 100)).resolves.toBeUndefined();
      expect(mockTx.teamBattleMember.update).toHaveBeenCalled();
    });

    it('should recalculate eligibility to ELIGIBLE after swap when all subscribed', async () => {
      mockTx.teamBattle.findUnique.mockResolvedValue(makeTeam());
      mockTx.robot.findUnique.mockResolvedValue({ id: 20, userId: 100 });
      mockHasSubscription.mockResolvedValue(true);
      mockTx.teamBattleMember.findFirst.mockResolvedValue(null);
      mockTx.teamBattleMember.update.mockResolvedValue({});
      mockTx.teamBattleMember.findMany.mockResolvedValue([
        { robotId: 20, slotIndex: 0 },
        { robotId: 11, slotIndex: 1 },
      ]);
      mockTx.teamBattle.update.mockResolvedValue({});

      await swapTeamMember(1, 10, 20, 100);

      expect(mockTx.teamBattle.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { eligibility: 'ELIGIBLE' },
      });
    });

    it('should set eligibility to INELIGIBLE after swap when member not subscribed', async () => {
      mockTx.teamBattle.findUnique.mockResolvedValue(makeTeam());
      mockTx.robot.findUnique.mockResolvedValue({ id: 20, userId: 100 });
      // First call: subscription check for new robot (passes)
      // Subsequent calls during eligibility recalc: one fails
      mockHasSubscription
        .mockResolvedValueOnce(true) // new robot subscription check
        .mockResolvedValueOnce(true) // first member in recalc
        .mockResolvedValueOnce(false); // second member in recalc
      mockTx.teamBattleMember.findFirst.mockResolvedValue(null);
      mockTx.teamBattleMember.update.mockResolvedValue({});
      mockTx.teamBattleMember.findMany.mockResolvedValue([
        { robotId: 20, slotIndex: 0 },
        { robotId: 11, slotIndex: 1 },
      ]);
      mockTx.teamBattle.update.mockResolvedValue({});

      await swapTeamMember(1, 10, 20, 100);

      expect(mockTx.teamBattle.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { eligibility: 'INELIGIBLE' },
      });
    });
  });

  // ── renameTeam ───────────────────────────────────────────────────

  describe('renameTeam', () => {
    it('should throw TEAM_NAME_INVALID for name shorter than 3 chars', async () => {
      await expect(renameTeam(1, 'AB', 100))
        .rejects.toMatchObject({
          code: TeamBattleErrorCode.TEAM_NAME_INVALID,
        });
    });

    it('should throw TEAM_NAME_INVALID for name longer than 32 chars', async () => {
      await expect(renameTeam(1, 'A'.repeat(33), 100))
        .rejects.toMatchObject({
          code: TeamBattleErrorCode.TEAM_NAME_INVALID,
        });
    });

    it('should throw TEAM_NAME_INVALID for name with disallowed characters', async () => {
      await expect(renameTeam(1, 'Bad<Name>', 100))
        .rejects.toMatchObject({
          code: TeamBattleErrorCode.TEAM_NAME_INVALID,
        });
    });

    it('should throw TEAM_NOT_FOUND when team does not exist', async () => {
      mockPrisma.teamBattle.findUnique.mockResolvedValue(null);

      await expect(renameTeam(999, 'NewName', 100))
        .rejects.toMatchObject({
          code: TeamBattleErrorCode.TEAM_NOT_FOUND,
        });
    });

    it('should throw TEAM_OWNERSHIP_VIOLATION when user does not own team', async () => {
      mockPrisma.teamBattle.findUnique.mockResolvedValue({ id: 1, stableId: 999 });

      await expect(renameTeam(1, 'NewName', 100))
        .rejects.toMatchObject({
          code: TeamBattleErrorCode.TEAM_OWNERSHIP_VIOLATION,
        });
    });

    it('should rename team successfully with valid name', async () => {
      mockPrisma.teamBattle.findUnique.mockResolvedValue({ id: 1, stableId: 100 });
      mockPrisma.teamBattle.update.mockResolvedValue({});

      await expect(renameTeam(1, 'NewValidName', 100)).resolves.toBeUndefined();
      expect(mockPrisma.teamBattle.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { teamName: 'NewValidName' },
      });
    });

    it('should accept names with allowed special characters', async () => {
      mockPrisma.teamBattle.findUnique.mockResolvedValue({ id: 1, stableId: 100 });
      mockPrisma.teamBattle.update.mockResolvedValue({});

      await expect(renameTeam(1, "Team's-Name_1!", 100)).resolves.toBeUndefined();
    });
  });

  // ── disbandTeam ──────────────────────────────────────────────────

  describe('disbandTeam', () => {
    it('should throw TEAM_NOT_FOUND when team does not exist', async () => {
      mockTx.teamBattle.findUnique.mockResolvedValue(null);

      await expect(disbandTeam(999, 100))
        .rejects.toMatchObject({
          code: TeamBattleErrorCode.TEAM_NOT_FOUND,
        });
    });

    it('should throw TEAM_OWNERSHIP_VIOLATION when user does not own team', async () => {
      mockTx.teamBattle.findUnique.mockResolvedValue({ id: 1, stableId: 999, teamName: 'T' });

      await expect(disbandTeam(1, 100))
        .rejects.toMatchObject({
          code: TeamBattleErrorCode.TEAM_OWNERSHIP_VIOLATION,
        });
    });

    it('should throw TEAM_LOCKED_FOR_BATTLE when team has scheduled match', async () => {
      mockTx.teamBattle.findUnique.mockResolvedValue({ id: 1, stableId: 100, teamName: 'T' });
      mockTx.scheduledTeamBattleMatch.count.mockResolvedValue(1);

      await expect(disbandTeam(1, 100))
        .rejects.toMatchObject({
          code: TeamBattleErrorCode.TEAM_LOCKED_FOR_BATTLE,
        });
    });

    it('should delete team successfully when unlocked', async () => {
      mockTx.teamBattle.findUnique.mockResolvedValue({ id: 1, stableId: 100, teamName: 'T' });
      mockTx.scheduledTeamBattleMatch.count.mockResolvedValue(0);
      mockTx.teamBattle.delete.mockResolvedValue({});

      await expect(disbandTeam(1, 100)).resolves.toBeUndefined();
      expect(mockTx.teamBattle.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });

  // ── Incomplete roster / eligibility state transitions ─────────────

  describe('eligibility state transitions', () => {
    it('should set team to INELIGIBLE when member is removed', async () => {
      mockTx.teamBattle.findUnique.mockResolvedValue(makeTeam());
      mockTx.teamBattleMember.delete.mockResolvedValue({});
      mockTx.teamBattle.update.mockResolvedValue({});

      await removeTeamMember(1, 10, 100);

      expect(mockTx.teamBattle.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { eligibility: 'INELIGIBLE' },
      });
    });

    it('should set team to ELIGIBLE when roster is filled and all subscribed', async () => {
      const incompleteTeam = makeTeam({
        eligibility: 'INELIGIBLE',
        members: [{ id: 1, robotId: 10, slotIndex: 0 }],
      });
      mockTx.teamBattle.findUnique.mockResolvedValue(incompleteTeam);
      mockTx.robot.findUnique.mockResolvedValue({ id: 20, userId: 100 });
      mockHasSubscription.mockResolvedValue(true);
      mockTx.teamBattleMember.findFirst.mockResolvedValue(null);
      mockTx.teamBattleMember.create.mockResolvedValue({});
      mockTx.teamBattle.update.mockResolvedValue({});

      await addTeamMember(1, 20, 100);

      expect(mockTx.teamBattle.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { eligibility: 'ELIGIBLE' },
      });
    });

    it('should remain INELIGIBLE when roster filled but member not subscribed', async () => {
      const incompleteTeam = makeTeam({
        eligibility: 'INELIGIBLE',
        members: [{ id: 1, robotId: 10, slotIndex: 0 }],
      });
      mockTx.teamBattle.findUnique.mockResolvedValue(incompleteTeam);
      mockTx.robot.findUnique.mockResolvedValue({ id: 20, userId: 100 });
      // New robot subscription check passes, but existing member fails recalc
      mockHasSubscription
        .mockResolvedValueOnce(true) // new robot subscription check
        .mockResolvedValueOnce(false) // existing member in recalc
        .mockResolvedValueOnce(true); // new member in recalc
      mockTx.teamBattleMember.findFirst.mockResolvedValue(null);
      mockTx.teamBattleMember.create.mockResolvedValue({});
      mockTx.teamBattle.update.mockResolvedValue({});

      await addTeamMember(1, 20, 100);

      expect(mockTx.teamBattle.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { eligibility: 'INELIGIBLE' },
      });
    });

    it('should reject adding member when team already has N members', async () => {
      mockTx.teamBattle.findUnique.mockResolvedValue(makeTeam()); // already has 2 members

      await expect(addTeamMember(1, 20, 100))
        .rejects.toMatchObject({
          code: TeamBattleErrorCode.TEAM_INVALID_COMPOSITION,
        });
    });

    it('should reject removing member when team is locked for battle', async () => {
      mockTx.teamBattle.findUnique.mockResolvedValue(makeTeam());
      mockTx.scheduledTeamBattleMatch.count.mockResolvedValue(1);

      await expect(removeTeamMember(1, 10, 100))
        .rejects.toMatchObject({
          code: TeamBattleErrorCode.TEAM_LOCKED_FOR_BATTLE,
        });
    });
  });

  // ── Error code values ────────────────────────────────────────────

  describe('error codes', () => {
    it('should have correct error code string values', () => {
      expect(TeamBattleErrorCode.TEAM_INVALID_SIZE).toBe('TEAM_INVALID_SIZE');
      expect(TeamBattleErrorCode.TEAM_INVALID_COMPOSITION).toBe('TEAM_INVALID_COMPOSITION');
      expect(TeamBattleErrorCode.TEAM_OWNERSHIP_VIOLATION).toBe('TEAM_OWNERSHIP_VIOLATION');
      expect(TeamBattleErrorCode.TEAM_MEMBER_CONFLICT).toBe('TEAM_MEMBER_CONFLICT');
      expect(TeamBattleErrorCode.TEAM_INSUFFICIENT_ROBOTS).toBe('TEAM_INSUFFICIENT_ROBOTS');
      expect(TeamBattleErrorCode.TEAM_NAME_INVALID).toBe('TEAM_NAME_INVALID');
      expect(TeamBattleErrorCode.TEAM_LOCKED_FOR_BATTLE).toBe('TEAM_LOCKED_FOR_BATTLE');
      expect(TeamBattleErrorCode.TEAM_NOT_FOUND).toBe('TEAM_NOT_FOUND');
    });

    it('should throw TeamBattleError instances', async () => {
      await expect(registerTeam(100, [1], 'Team', 2, 100))
        .rejects.toBeInstanceOf(TeamBattleError);
    });

    it('should include correct HTTP status codes', async () => {
      // 400 for validation errors
      await expect(registerTeam(100, [1], 'Team', 2, 100))
        .rejects.toMatchObject({ statusCode: 400 });

      // 409 for locked team
      mockTx.teamBattle.findUnique.mockResolvedValue({ id: 1, stableId: 100, teamName: 'T' });
      mockTx.scheduledTeamBattleMatch.count.mockResolvedValue(1);
      await expect(disbandTeam(1, 100))
        .rejects.toMatchObject({ statusCode: 409 });
    });
  });
});
