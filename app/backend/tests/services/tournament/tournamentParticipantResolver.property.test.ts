/**
 * Tournament Participant Resolver - Property-Based Tests
 * Feature: team-battle-tournaments, Property 3: For any valid participant, resolver returns ID, non-empty displayName, and leagueTier
 *
 * **Validates: Requirements 1.8**
 *
 * Tests the correctness properties of the participant resolver using fast-check.
 */

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockRobotFindUnique = jest.fn();
const mockTeamBattleFindUnique = jest.fn();

jest.mock('../../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    robot: { findUnique: (...args: unknown[]) => mockRobotFindUnique(...args) },
    teamBattle: { findUnique: (...args: unknown[]) => mockTeamBattleFindUnique(...args) },
  },
}));

jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import * as fc from 'fast-check';
import { resolveParticipant, ParticipantType } from '../../../src/services/tournament/tournamentParticipantResolver';

// ── Test ─────────────────────────────────────────────────────────────────────

describe('Feature: team-battle-tournaments, Property 3: For any valid participant, resolver returns ID, non-empty displayName, and leagueTier', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * **Validates: Requirements 1.8**
   *
   * For any valid (participantId, participantType) pair where the referenced entity exists,
   * the participant resolver SHALL return an object containing at minimum the participant's ID,
   * a non-empty display name, and a league tier string. When participantType is 'robot', the
   * display name SHALL be the robot's name. When participantType is 'team_2v2' or 'team_3v3',
   * the display name SHALL be the team's teamName.
   */
  it('should return ID, non-empty displayName, and leagueTier for any valid participant', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom<ParticipantType>('robot', 'team_2v2', 'team_3v3'),
        fc.integer({ min: 1, max: 10000 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 3, maxLength: 32 }),
        fc.integer({ min: 800, max: 2000 }),
        fc.constantFrom('bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'),
        async (participantType, id, robotName, teamName, elo, leagueTier) => {
          // Setup mocks based on participant type
          if (participantType === 'robot') {
            mockRobotFindUnique.mockResolvedValue({
              id,
              name: robotName,
              currentLeague: leagueTier,
              elo,
              userId: 1,
              user: { id: 1, stableName: 'TestStable', username: 'testuser' },
            });
          } else {
            mockTeamBattleFindUnique.mockResolvedValue({
              id,
              teamName,
              teamLeague: leagueTier,
              stableId: 1,
              members: [
                { robot: { id: 100, name: 'Member1', elo }, slotIndex: 0 },
                { robot: { id: 101, name: 'Member2', elo }, slotIndex: 1 },
              ],
              stable: { id: 1, stableName: 'TestStable', username: 'testuser' },
            });
          }

          // Call the resolver
          const result = await resolveParticipant(id, participantType);

          // Assert: result is not null
          expect(result).not.toBeNull();

          // Assert: result.id equals input id
          expect(result!.id).toBe(id);

          // Assert: result.displayName is a non-empty string
          expect(typeof result!.displayName).toBe('string');
          expect(result!.displayName.length).toBeGreaterThan(0);

          // Assert: result.leagueTier is a string
          expect(typeof result!.leagueTier).toBe('string');
          expect(result!.leagueTier.length).toBeGreaterThan(0);

          // For robot type: displayName equals the mocked robot name
          if (participantType === 'robot') {
            expect(result!.displayName).toBe(robotName);
          }

          // For team types: displayName equals the mocked team name, members array exists
          if (participantType === 'team_2v2' || participantType === 'team_3v3') {
            expect(result!.displayName).toBe(teamName);
            expect(result!.members).toBeDefined();
            expect(Array.isArray(result!.members)).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
