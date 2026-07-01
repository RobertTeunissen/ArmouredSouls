/**
 * Property-based tests for BattleService participant creation (Property 9).
 *
 * **Property 9: Tag-Team Participant Creation**
 * For any tag-team battle, exactly 4 BattleParticipant rows:
 * 2 active (one per team) + 2 reserve (one per team), each with valid team,
 * non-negative damageDealt/fameAwarded.
 *
 * Uses fast-check with minimum 100 iterations.
 *
 * **Validates: Requirement 8.3**
 */

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    battle: {
      create: jest.fn(),
    },
    battleParticipant: {
      createMany: jest.fn(),
    },
  },
}));
jest.mock('../../../config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import * as fc from 'fast-check';
import prisma from '../../../lib/prisma';
import { createTagTeamBattleRecord } from '../../tag-team/tagTeamBattleRecord';
import { TagTeamWithRobots, TagTeamBattleResult } from '../../tag-team/tagTeamTypes';
import { ScheduledTeamBattleMatch } from '../../../../generated/prisma';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// ─── Generators ──────────────────────────────────────────────────────────────

/** Generate a valid Robot-like object with the minimal fields needed. */
function arbRobotLike() {
  return fc.record({
    id: fc.integer({ min: 1, max: 100_000 }),
    elo: fc.integer({ min: 400, max: 2500 }),
    name: fc.string({ minLength: 1, maxLength: 20 }),
  });
}

/** Generate a valid TagTeamWithRobots input. */
function arbTeam(teamSuffix: string) {
  return fc
    .tuple(arbRobotLike(), arbRobotLike(), fc.integer({ min: 1, max: 10_000 }))
    .map(([activeRobot, reserveRobot, teamId]) => ({
      id: teamId,
      stableId: teamId + 100,
      teamName: `Team ${teamSuffix}`,
      teamSize: 2,
      activeRobotId: activeRobot.id,
      reserveRobotId: reserveRobot.id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      activeRobot: activeRobot as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      reserveRobot: reserveRobot as any,
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as fc.Arbitrary<TagTeamWithRobots>;
}

/** Generate a valid TagTeamBattleResult. */
function arbBattleResult(team1: TagTeamWithRobots, team2: TagTeamWithRobots) {
  return fc
    .record({
      durationSeconds: fc.integer({ min: 10, max: 300 }),
      isDraw: fc.boolean(),
      team1TagOutTime: fc.option(fc.float({ min: 1, max: 299, noNaN: true })),
      team2TagOutTime: fc.option(fc.float({ min: 1, max: 299, noNaN: true })),
      team1ActiveFinalHP: fc.integer({ min: 0, max: 100 }),
      team1ReserveFinalHP: fc.integer({ min: 0, max: 100 }),
      team2ActiveFinalHP: fc.integer({ min: 0, max: 100 }),
      team2ReserveFinalHP: fc.integer({ min: 0, max: 100 }),
      team1ActiveSurvivalTime: fc.integer({ min: 0, max: 300 }),
      team1ReserveSurvivalTime: fc.integer({ min: 0, max: 300 }),
      team2ActiveSurvivalTime: fc.integer({ min: 0, max: 300 }),
      team2ReserveSurvivalTime: fc.integer({ min: 0, max: 300 }),
    })
    .map((fields) => ({
      battleId: 0, // Placeholder, will be set by battle.create mock
      winnerId: fields.isDraw ? null : team1.activeRobotId,
      isDraw: fields.isDraw,
      durationSeconds: fields.durationSeconds,
      team1TagOutTime: fields.team1TagOutTime ?? undefined,
      team2TagOutTime: fields.team2TagOutTime ?? undefined,
      team1ActiveFinalHP: fields.team1ActiveFinalHP,
      team1ReserveFinalHP: fields.team1ReserveFinalHP,
      team2ActiveFinalHP: fields.team2ActiveFinalHP,
      team2ReserveFinalHP: fields.team2ReserveFinalHP,
      team1ReserveUsed: fields.team1TagOutTime !== null,
      team2ReserveUsed: fields.team2TagOutTime !== null,
      team1ActiveSurvivalTime: fields.team1ActiveSurvivalTime,
      team1ReserveSurvivalTime: fields.team1ReserveSurvivalTime,
      team2ActiveSurvivalTime: fields.team2ActiveSurvivalTime,
      team2ReserveSurvivalTime: fields.team2ReserveSurvivalTime,
      battleLog: [],
      arenaRadius: 50,
      startingPositions: {},
      endingPositions: {},
      phases: [
        {
          robot1Name: 'R1',
          robot2Name: 'R2',
          robot1Stance: 'balanced',
          robot2Stance: 'balanced',
          robot1MaxHP: 100,
          robot2MaxHP: 100,
        },
      ],
      team1Name: team1.teamName,
      team2Name: team2.teamName,
      team1ReserveName: 'Reserve1',
      team2ReserveName: 'Reserve2',
    })) as fc.Arbitrary<TagTeamBattleResult>;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Property 9: Tag-Team Participant Creation', () => {
  let capturedParticipants: Array<Record<string, unknown>>;

  beforeEach(() => {
    jest.clearAllMocks();
    capturedParticipants = [];

    // Mock battle.create to return a battle with an id
    (mockPrisma.battle.create as jest.Mock).mockImplementation(() =>
      Promise.resolve({ id: Math.floor(Math.random() * 100_000) + 1 }),
    );

    // Mock battleParticipant.createMany to capture participant data
    (mockPrisma.battleParticipant.createMany as jest.Mock).mockImplementation(
      (args: { data: Array<Record<string, unknown>> }) => {
        capturedParticipants = args.data;
        return Promise.resolve({ count: args.data.length });
      },
    );
  });

  it('creates exactly 4 BattleParticipant rows for any tag-team battle', async () => {
    await fc.assert(
      fc.asyncProperty(arbTeam('Alpha'), arbTeam('Bravo'), async (team1, team2) => {
        // Ensure distinct robot IDs across teams
        fc.pre(
          team1.activeRobotId !== team1.reserveRobotId &&
            team2.activeRobotId !== team2.reserveRobotId &&
            team1.activeRobotId !== team2.activeRobotId &&
            team1.activeRobotId !== team2.reserveRobotId &&
            team1.reserveRobotId !== team2.activeRobotId &&
            team1.reserveRobotId !== team2.reserveRobotId,
        );

        const result = await fc.sample(arbBattleResult(team1, team2), 1)[0];

        const match = {
          id: 1,
          teamBattleId1: team1.id,
          teamBattleId2: team2.id,
          teamBattleLeague: 'bronze',
          scheduledFor: new Date(),
          status: 'scheduled',
          matchMode: 'tag_team',
          teamBattleLeagueId: 'bronze_1',
          createdAt: new Date(),
        } as unknown as ScheduledTeamBattleMatch;

        capturedParticipants = [];
        await createTagTeamBattleRecord(match, team1, team2, result);

        // PROPERTY: Exactly 4 participant rows created
        expect(capturedParticipants).toHaveLength(4);
      }),
      { numRuns: 100 },
    );
  });

  it('creates exactly 2 active participants (one per team) and 2 reserve participants (one per team)', async () => {
    await fc.assert(
      fc.asyncProperty(arbTeam('Alpha'), arbTeam('Bravo'), async (team1, team2) => {
        fc.pre(
          team1.activeRobotId !== team1.reserveRobotId &&
            team2.activeRobotId !== team2.reserveRobotId &&
            team1.activeRobotId !== team2.activeRobotId &&
            team1.activeRobotId !== team2.reserveRobotId &&
            team1.reserveRobotId !== team2.activeRobotId &&
            team1.reserveRobotId !== team2.reserveRobotId,
        );

        const result = await fc.sample(arbBattleResult(team1, team2), 1)[0];

        const match = {
          id: 1,
          teamBattleId1: team1.id,
          teamBattleId2: team2.id,
          teamBattleLeague: 'bronze',
          scheduledFor: new Date(),
          status: 'scheduled',
          matchMode: 'tag_team',
          teamBattleLeagueId: 'bronze_1',
          createdAt: new Date(),
        } as unknown as ScheduledTeamBattleMatch;

        capturedParticipants = [];
        await createTagTeamBattleRecord(match, team1, team2, result);

        // PROPERTY: 2 active + 2 reserve
        const activeParticipants = capturedParticipants.filter((p) => p.role === 'active');
        const reserveParticipants = capturedParticipants.filter((p) => p.role === 'reserve');

        expect(activeParticipants).toHaveLength(2);
        expect(reserveParticipants).toHaveLength(2);

        // PROPERTY: Each team has exactly one active and one reserve
        const team1Active = activeParticipants.filter((p) => p.team === 1);
        const team2Active = activeParticipants.filter((p) => p.team === 2);
        const team1Reserve = reserveParticipants.filter((p) => p.team === 1);
        const team2Reserve = reserveParticipants.filter((p) => p.team === 2);

        expect(team1Active).toHaveLength(1);
        expect(team2Active).toHaveLength(1);
        expect(team1Reserve).toHaveLength(1);
        expect(team2Reserve).toHaveLength(1);
      }),
      { numRuns: 100 },
    );
  });

  it('all participants have valid team values (1 or 2)', async () => {
    await fc.assert(
      fc.asyncProperty(arbTeam('Alpha'), arbTeam('Bravo'), async (team1, team2) => {
        fc.pre(
          team1.activeRobotId !== team1.reserveRobotId &&
            team2.activeRobotId !== team2.reserveRobotId &&
            team1.activeRobotId !== team2.activeRobotId &&
            team1.activeRobotId !== team2.reserveRobotId &&
            team1.reserveRobotId !== team2.activeRobotId &&
            team1.reserveRobotId !== team2.reserveRobotId,
        );

        const result = await fc.sample(arbBattleResult(team1, team2), 1)[0];

        const match = {
          id: 1,
          teamBattleId1: team1.id,
          teamBattleId2: team2.id,
          teamBattleLeague: 'bronze',
          scheduledFor: new Date(),
          status: 'scheduled',
          matchMode: 'tag_team',
          teamBattleLeagueId: 'bronze_1',
          createdAt: new Date(),
        } as unknown as ScheduledTeamBattleMatch;

        capturedParticipants = [];
        await createTagTeamBattleRecord(match, team1, team2, result);

        // PROPERTY: All team values are 1 or 2
        for (const participant of capturedParticipants) {
          expect([1, 2]).toContain(participant.team);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('all participants have non-negative damageDealt and fameAwarded', async () => {
    await fc.assert(
      fc.asyncProperty(arbTeam('Alpha'), arbTeam('Bravo'), async (team1, team2) => {
        fc.pre(
          team1.activeRobotId !== team1.reserveRobotId &&
            team2.activeRobotId !== team2.reserveRobotId &&
            team1.activeRobotId !== team2.activeRobotId &&
            team1.activeRobotId !== team2.reserveRobotId &&
            team1.reserveRobotId !== team2.activeRobotId &&
            team1.reserveRobotId !== team2.reserveRobotId,
        );

        const result = await fc.sample(arbBattleResult(team1, team2), 1)[0];

        const match = {
          id: 1,
          teamBattleId1: team1.id,
          teamBattleId2: team2.id,
          teamBattleLeague: 'bronze',
          scheduledFor: new Date(),
          status: 'scheduled',
          matchMode: 'tag_team',
          teamBattleLeagueId: 'bronze_1',
          createdAt: new Date(),
        } as unknown as ScheduledTeamBattleMatch;

        capturedParticipants = [];
        await createTagTeamBattleRecord(match, team1, team2, result);

        // PROPERTY: Non-negative damageDealt and fameAwarded for all participants
        for (const participant of capturedParticipants) {
          expect(participant.damageDealt).toBeGreaterThanOrEqual(0);
          expect(participant.fameAwarded).toBeGreaterThanOrEqual(0);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('participant robotIds match the team active/reserve robot IDs', async () => {
    await fc.assert(
      fc.asyncProperty(arbTeam('Alpha'), arbTeam('Bravo'), async (team1, team2) => {
        fc.pre(
          team1.activeRobotId !== team1.reserveRobotId &&
            team2.activeRobotId !== team2.reserveRobotId &&
            team1.activeRobotId !== team2.activeRobotId &&
            team1.activeRobotId !== team2.reserveRobotId &&
            team1.reserveRobotId !== team2.activeRobotId &&
            team1.reserveRobotId !== team2.reserveRobotId,
        );

        const result = await fc.sample(arbBattleResult(team1, team2), 1)[0];

        const match = {
          id: 1,
          teamBattleId1: team1.id,
          teamBattleId2: team2.id,
          teamBattleLeague: 'bronze',
          scheduledFor: new Date(),
          status: 'scheduled',
          matchMode: 'tag_team',
          teamBattleLeagueId: 'bronze_1',
          createdAt: new Date(),
        } as unknown as ScheduledTeamBattleMatch;

        capturedParticipants = [];
        await createTagTeamBattleRecord(match, team1, team2, result);

        // PROPERTY: robotIds match the correct team members
        const team1Active = capturedParticipants.find(
          (p) => p.team === 1 && p.role === 'active',
        )!;
        const team1Reserve = capturedParticipants.find(
          (p) => p.team === 1 && p.role === 'reserve',
        )!;
        const team2Active = capturedParticipants.find(
          (p) => p.team === 2 && p.role === 'active',
        )!;
        const team2Reserve = capturedParticipants.find(
          (p) => p.team === 2 && p.role === 'reserve',
        )!;

        expect(team1Active.robotId).toBe(team1.activeRobotId);
        expect(team1Reserve.robotId).toBe(team1.reserveRobotId);
        expect(team2Active.robotId).toBe(team2.activeRobotId);
        expect(team2Reserve.robotId).toBe(team2.reserveRobotId);
      }),
      { numRuns: 100 },
    );
  });

  it('all participants reference the same battleId', async () => {
    await fc.assert(
      fc.asyncProperty(arbTeam('Alpha'), arbTeam('Bravo'), async (team1, team2) => {
        fc.pre(
          team1.activeRobotId !== team1.reserveRobotId &&
            team2.activeRobotId !== team2.reserveRobotId &&
            team1.activeRobotId !== team2.activeRobotId &&
            team1.activeRobotId !== team2.reserveRobotId &&
            team1.reserveRobotId !== team2.activeRobotId &&
            team1.reserveRobotId !== team2.reserveRobotId,
        );

        const result = await fc.sample(arbBattleResult(team1, team2), 1)[0];

        const match = {
          id: 1,
          teamBattleId1: team1.id,
          teamBattleId2: team2.id,
          teamBattleLeague: 'bronze',
          scheduledFor: new Date(),
          status: 'scheduled',
          matchMode: 'tag_team',
          teamBattleLeagueId: 'bronze_1',
          createdAt: new Date(),
        } as unknown as ScheduledTeamBattleMatch;

        capturedParticipants = [];
        await createTagTeamBattleRecord(match, team1, team2, result);

        // PROPERTY: All participants share the same battleId
        const battleIds = new Set(capturedParticipants.map((p) => p.battleId));
        expect(battleIds.size).toBe(1);
      }),
      { numRuns: 100 },
    );
  });
});
