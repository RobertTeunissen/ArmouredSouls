/**
 * Property-based tests for SchedulingService.
 *
 * Uses fast-check to verify invariants that must hold across all possible inputs:
 * 1. Single row insertion per match (any MatchType → exactly 1 create call)
 * 2. Entity query completeness (N participant records → N match results)
 * 3. KotH sequential slot assignment (P participants → slots [1..P], no gaps/duplicates)
 *
 * _Requirements: 2.4_
 */

import * as fc from 'fast-check';
import { MatchType } from '../../../../generated/prisma';

// Mock prisma
jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn(),
    scheduledMatch: {
      create: jest.fn(),
      update: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    scheduledMatchParticipant: {
      createMany: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

// Mock logger
jest.mock('../../../config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import schedulingService from '../schedulingService';

const mockPrisma = jest.requireMock('../../../lib/prisma').default;

const allMatchTypes: MatchType[] = [
  MatchType.league_1v1,
  MatchType.league_2v2,
  MatchType.league_3v3,
  MatchType.tag_team,
  MatchType.koth,
  MatchType.tournament_1v1,
  MatchType.tournament_2v2,
  MatchType.tournament_3v3,
];

describe('SchedulingService – Property-Based Tests', () => {
  let uniqueId: number;

  beforeEach(() => {
    jest.clearAllMocks();
    uniqueId = 1;

    // $transaction passes mockPrisma as the tx argument
    mockPrisma.$transaction.mockImplementation(async (fn: Function) => fn(mockPrisma));

    // scheduledMatch.create returns a unique id each call
    mockPrisma.scheduledMatch.create.mockImplementation(async (args: any) => ({
      id: uniqueId++,
      matchType: args.data.matchType,
      status: 'scheduled',
      scheduledFor: args.data.scheduledFor,
      battleId: null,
      tournamentId: args.data.tournamentId ?? null,
      round: args.data.round ?? null,
      matchNumber: args.data.matchNumber ?? null,
      isByeMatch: args.data.isByeMatch ?? null,
      leagueType: args.data.leagueType ?? null,
      leagueInstanceId: args.data.leagueInstanceId ?? null,
      rotatingZone: args.data.rotatingZone ?? null,
      scoreThreshold: args.data.scoreThreshold ?? null,
      timeLimit: args.data.timeLimit ?? null,
      zoneRadius: args.data.zoneRadius ?? null,
      cancelReason: null,
    }));

    // createMany succeeds
    mockPrisma.scheduledMatchParticipant.createMany.mockResolvedValue({ count: 0 });

    // findUniqueOrThrow returns the match with participants
    mockPrisma.scheduledMatch.findUniqueOrThrow.mockImplementation(async () => ({
      id: uniqueId - 1,
      participants: [],
    }));
  });

  describe('Property 1: Single Row Insertion Per Match', () => {
    it('creates exactly one scheduledMatch row for any MatchType with any participant count', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...allMatchTypes),
          fc.integer({ min: 1, max: 6 }),
          async (matchType, participantCount) => {
            // Reset mocks for each iteration
            mockPrisma.scheduledMatch.create.mockClear();
            mockPrisma.scheduledMatchParticipant.createMany.mockClear();
            mockPrisma.scheduledMatch.findUniqueOrThrow.mockClear();

            const participants = Array.from({ length: participantCount }, (_, i) => ({
              participantType: 'robot' as const,
              participantId: 100 + i,
              slot: i + 1,
            }));

            await schedulingService.createMatch({
              matchType,
              scheduledFor: new Date('2025-06-01T12:00:00Z'),
              participants,
            });

            // Invariant: exactly 1 scheduledMatch.create call per createMatch() invocation
            expect(mockPrisma.scheduledMatch.create).toHaveBeenCalledTimes(1);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Property 2: Entity Query Completeness', () => {
    it('returns exactly N matches for a robot with N scheduled match participations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 20 }),
          fc.constantFrom(...allMatchTypes),
          async (n, matchType) => {
            mockPrisma.scheduledMatchParticipant.findMany.mockClear();

            // Generate N participant records, each linked to a different scheduledMatch
            const participantRecords = Array.from({ length: n }, (_, i) => ({
              id: i + 1,
              scheduledMatchId: 1000 + i,
              participantType: 'robot',
              participantId: 42,
              slot: 1,
              scheduledMatch: {
                id: 1000 + i,
                matchType,
                status: 'scheduled',
                scheduledFor: new Date(`2025-06-${String(i + 1).padStart(2, '0')}T08:00:00Z`),
                participants: [
                  { id: i + 1, scheduledMatchId: 1000 + i, participantType: 'robot', participantId: 42, slot: 1 },
                  { id: i + 100, scheduledMatchId: 1000 + i, participantType: 'robot', participantId: 99, slot: 2 },
                ],
              },
            }));

            mockPrisma.scheduledMatchParticipant.findMany.mockResolvedValue(participantRecords);

            const result = await schedulingService.getUpcomingForRobot(42);

            // Invariant: result count equals N regardless of match type distribution
            expect(result).toHaveLength(n);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Property 3: KotH Sequential Slot Assignment', () => {
    it('creates participant rows with sequential slots [1..P] for any KotH match with P participants', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 6 }),
          async (participantCount) => {
            // Reset mocks for each iteration
            mockPrisma.scheduledMatch.create.mockClear();
            mockPrisma.scheduledMatchParticipant.createMany.mockClear();
            mockPrisma.scheduledMatch.findUniqueOrThrow.mockClear();

            const participants = Array.from({ length: participantCount }, (_, i) => ({
              participantType: 'robot' as const,
              participantId: 200 + i,
              slot: i + 1,
            }));

            await schedulingService.createMatch({
              matchType: MatchType.koth,
              scheduledFor: new Date('2025-06-01T13:00:00Z'),
              participants,
              rotatingZone: true,
              scoreThreshold: 100,
              timeLimit: 120,
              zoneRadius: 50,
            });

            // Invariant: createMany receives exactly P participant rows
            expect(mockPrisma.scheduledMatchParticipant.createMany).toHaveBeenCalledTimes(1);

            const createManyCall = mockPrisma.scheduledMatchParticipant.createMany.mock.calls[0][0];
            const data = createManyCall.data;

            // Exactly P rows
            expect(data).toHaveLength(participantCount);

            // Slots form sequential sequence [1, 2, ..., P]
            const slots = data.map((row: any) => row.slot).sort((a: number, b: number) => a - b);
            const expectedSlots = Array.from({ length: participantCount }, (_, i) => i + 1);
            expect(slots).toEqual(expectedSlots);

            // No duplicates
            const uniqueSlots = new Set(slots);
            expect(uniqueSlots.size).toBe(participantCount);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
