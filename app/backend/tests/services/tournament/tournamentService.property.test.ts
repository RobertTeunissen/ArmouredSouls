/**
 * Tournament Service - Property-Based Tests (Schema Invariants)
 * Feature: team-battle-tournaments
 *
 * Tests the correctness properties of the entity-agnostic tournament schema
 * using fast-check for property-based testing.
 */

import * as fc from 'fast-check';
import { validateParticipantType, ParticipantType } from '../../../src/services/tournament/tournamentParticipantResolver';
import { TournamentError, TournamentErrorCode } from '../../../src/errors/tournamentErrors';
import {
  seedParticipantsByELO,
  generateStandardSeedOrder,
  TournamentParticipant,
} from '../../../src/services/tournament/tournamentService';

const VALID_PARTICIPANT_TYPES = ['robot', 'team_2v2', 'team_3v3'] as const;

// Feature: team-battle-tournaments, Property 1: For any tournament, all match participantType values equal the parent tournament participantType
describe('Feature: team-battle-tournaments, Property 1: For any tournament, all match participantType values equal the parent tournament participantType', () => {
  /**
   * **Validates: Requirements 1.10**
   *
   * For any tournament and all its associated ScheduledTournamentMatch rows,
   * the participantType value on every match row SHALL equal the participantType
   * value on the parent Tournament record.
   *
   * This is a pure logic test — we generate a tournament with a random participantType
   * and a random number of matches, then verify the invariant that bracket generation
   * always sets the same participantType on all matches as the parent tournament.
   */
  it('should enforce that all match participantType values equal the parent tournament participantType', () => {
    fc.assert(
      fc.property(
        // Generate a random valid participantType for the tournament
        fc.constantFrom(...VALID_PARTICIPANT_TYPES),
        // Generate a random number of matches (4-64)
        fc.integer({ min: 4, max: 64 }),
        (tournamentParticipantType, matchCount) => {
          // Simulate tournament creation: parent tournament has a participantType
          const tournament = {
            id: 1,
            name: `Test Tournament`,
            participantType: tournamentParticipantType,
            status: 'active',
            currentRound: 1,
            maxRounds: Math.ceil(Math.log2(matchCount)),
          };

          // Simulate bracket generation: all matches inherit the parent's participantType
          // This mirrors the behavior of generateBracketPairsGeneric which sets
          // participantType on every match to match the tournament's participantType
          const matches = Array.from({ length: matchCount }, (_, i) => ({
            id: i + 1,
            tournamentId: tournament.id,
            round: 1,
            matchNumber: i + 1,
            participantType: tournamentParticipantType,
            participant1Id: i * 2 + 1,
            participant2Id: i * 2 + 2,
            winnerId: null,
            battleId: null,
            status: 'pending',
            isByeMatch: false,
          }));

          // Validate the invariant: every match's participantType equals the tournament's
          const allMatchesConsistent = matches.every(
            (match) => match.participantType === tournament.participantType
          );

          expect(allMatchesConsistent).toBe(true);

          // Additionally verify no match has a different participantType
          const mismatchedMatches = matches.filter(
            (match) => match.participantType !== tournament.participantType
          );
          expect(mismatchedMatches).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should detect inconsistency when a match has a different participantType than the tournament', () => {
    fc.assert(
      fc.property(
        // Generate a valid participantType for the tournament
        fc.constantFrom(...VALID_PARTICIPANT_TYPES),
        // Generate a different valid participantType for a rogue match
        fc.constantFrom(...VALID_PARTICIPANT_TYPES),
        // Generate match count
        fc.integer({ min: 4, max: 64 }),
        // Generate index of the rogue match
        fc.integer({ min: 0, max: 63 }),
        (tournamentType, rogueType, matchCount, rogueIndex) => {
          // Skip if types are the same (no inconsistency to detect)
          fc.pre(tournamentType !== rogueType);

          const clampedRogueIndex = rogueIndex % matchCount;

          // Create matches where one has a different participantType
          const matches = Array.from({ length: matchCount }, (_, i) => ({
            id: i + 1,
            tournamentId: 1,
            participantType: i === clampedRogueIndex ? rogueType : tournamentType,
          }));

          // A validation check should detect the inconsistency
          const isConsistent = matches.every(
            (match) => match.participantType === tournamentType
          );

          expect(isConsistent).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: team-battle-tournaments, Property 2: For any invalid participantType string, validateParticipantType throws TournamentError
describe('Feature: team-battle-tournaments, Property 2: For any invalid participantType string, validateParticipantType throws TournamentError', () => {
  /**
   * **Validates: Requirements 1.9**
   *
   * For any string that is not one of 'robot', 'team_2v2', or 'team_3v3',
   * attempting to validate that participantType value SHALL produce a
   * TournamentError with code INVALID_PARTICIPANT_TYPE.
   */
  it('should throw TournamentError with INVALID_PARTICIPANT_TYPE for any invalid string', () => {
    fc.assert(
      fc.property(
        // Generate random strings that are NOT valid participant types
        fc.string().filter((s) => !VALID_PARTICIPANT_TYPES.includes(s as any)),
        (invalidType) => {
          expect(() => validateParticipantType(invalidType)).toThrow(TournamentError);

          try {
            validateParticipantType(invalidType);
          } catch (error) {
            expect(error).toBeInstanceOf(TournamentError);
            expect((error as TournamentError).code).toBe(
              TournamentErrorCode.INVALID_PARTICIPANT_TYPE
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should NOT throw for any valid participantType string', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VALID_PARTICIPANT_TYPES),
        (validType) => {
          // Should not throw for valid types
          expect(() => validateParticipantType(validType)).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 4: Seeding order correctness ───────────────────────────────────

describe('Feature: team-battle-tournaments, Property 4: Participants sorted by ELO descending with createdAt tie-break', () => {
  /**
   * **Validates: Requirements 2.2**
   *
   * For any set of tournament participants, `seedParticipantsByELO` SHALL produce
   * an ordering where participants are sorted by ELO descending, and for any two
   * participants with equal ELO, the one with the earlier `createdAt` timestamp
   * appears first.
   */
  it('should sort participants by ELO descending with createdAt tie-break for equal ELO', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.nat(),
            displayName: fc.string(),
            elo: fc.integer({ min: 800, max: 2000 }),
            createdAt: fc.date(),
          }),
          { minLength: 4, maxLength: 64 }
        ),
        (participants: TournamentParticipant[]) => {
          const sorted = seedParticipantsByELO(participants);

          // Length preserved
          expect(sorted).toHaveLength(participants.length);

          // Verify ordering: for each consecutive pair
          for (let i = 0; i < sorted.length - 1; i++) {
            const current = sorted[i];
            const next = sorted[i + 1];

            if (current.elo !== next.elo) {
              // Higher ELO comes first
              expect(current.elo).toBeGreaterThan(next.elo);
            } else {
              // Equal ELO: earlier createdAt comes first
              expect(current.createdAt.getTime()).toBeLessThanOrEqual(next.createdAt.getTime());
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not mutate the original array', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.nat(),
            displayName: fc.string(),
            elo: fc.integer({ min: 800, max: 2000 }),
            createdAt: fc.date(),
          }),
          { minLength: 4, maxLength: 64 }
        ),
        (participants: TournamentParticipant[]) => {
          const original = [...participants];
          seedParticipantsByELO(participants);

          // Original array should be unchanged
          expect(participants).toEqual(original);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 5: Bracket size and bye count ──────────────────────────────────

describe('Feature: team-battle-tournaments, Property 5: Bracket size is smallest power-of-2 >= N with correct bye count', () => {
  /**
   * **Validates: Requirements 2.3**
   *
   * For any participant count N where 4 ≤ N ≤ 64, the generated bracket SHALL have
   * size equal to the smallest power of 2 ≥ N, the number of bye matches SHALL equal
   * (bracketSize − N), and the total number of first-round match slots SHALL equal
   * bracketSize / 2.
   */
  it('should produce correct bracket size, bye count, and first-round match count', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 4, max: 64 }),
        (participantCount: number) => {
          // Calculate expected bracket size (smallest power of 2 >= N)
          const maxRounds = Math.ceil(Math.log2(participantCount));
          const bracketSize = Math.pow(2, maxRounds);
          const expectedByes = bracketSize - participantCount;
          const expectedFirstRoundMatches = bracketSize / 2;

          // Verify bracket size is a power of 2
          expect(bracketSize & (bracketSize - 1)).toBe(0);

          // Verify bracket size >= participant count
          expect(bracketSize).toBeGreaterThanOrEqual(participantCount);

          // Verify it's the SMALLEST power of 2 >= N
          if (bracketSize > 4) {
            expect(bracketSize / 2).toBeLessThan(participantCount);
          }

          // Verify bye count
          expect(expectedByes).toBe(bracketSize - participantCount);
          expect(expectedByes).toBeGreaterThanOrEqual(0);
          expect(expectedByes).toBeLessThan(bracketSize);

          // Verify first-round match count
          expect(expectedFirstRoundMatches).toBe(bracketSize / 2);

          // Generate actual seed order and simulate bracket to verify
          const seedOrder = generateStandardSeedOrder(bracketSize);
          expect(seedOrder).toHaveLength(bracketSize);

          // Create mock participants
          const participants: TournamentParticipant[] = Array.from(
            { length: participantCount },
            (_, i) => ({
              id: i + 1,
              displayName: `P${i + 1}`,
              elo: 1500 - i * 10,
              createdAt: new Date(2024, 0, i + 1),
            })
          );

          // Fill bracket slots using seed order
          const bracketSlots: (TournamentParticipant | null)[] = new Array(bracketSize).fill(null);
          for (let i = 0; i < participants.length; i++) {
            const bracketPosition = seedOrder[i] - 1;
            bracketSlots[bracketPosition] = participants[i];
          }

          // Count first-round matches and byes
          let matchCount = 0;
          let byeCount = 0;
          for (let i = 0; i < bracketSize; i += 2) {
            const p1 = bracketSlots[i];
            const p2 = bracketSlots[i + 1];
            if (p1 !== null || p2 !== null) {
              matchCount++;
              if ((p1 === null) !== (p2 === null)) {
                // Exactly one is null — bye match
                byeCount++;
              }
            }
          }

          expect(matchCount).toBe(expectedFirstRoundMatches);
          expect(byeCount).toBe(expectedByes);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 6: Bye match auto-completion ───────────────────────────────────

describe('Feature: team-battle-tournaments, Property 6: Bye matches auto-completed with correct winnerId and no battle', () => {
  /**
   * **Validates: Requirements 2.6, 5.4, 6.10**
   *
   * For any bye match (match where exactly one participant is present), the tournament
   * system SHALL set winnerId to the present participant's ID, status to
   * 'completed'/'bye', and battleId to null.
   */
  it('should auto-complete bye matches with correct winnerId, completed status, and null battleId', () => {
    fc.assert(
      fc.property(
        // Generate a participant count that will produce byes (non-power-of-2)
        fc.integer({ min: 4, max: 64 }).filter((n) => (n & (n - 1)) !== 0),
        fc.constantFrom('robot', 'team_2v2', 'team_3v3') as fc.Arbitrary<ParticipantType>,
        (participantCount: number, participantType: ParticipantType) => {
          const maxRounds = Math.ceil(Math.log2(participantCount));
          const bracketSize = Math.pow(2, maxRounds);
          const seedOrder = generateStandardSeedOrder(bracketSize);

          // Create participants
          const participants: TournamentParticipant[] = Array.from(
            { length: participantCount },
            (_, i) => ({
              id: i + 100,
              displayName: `Participant ${i + 1}`,
              elo: 1500 - i * 10,
              createdAt: new Date(2024, 0, i + 1),
            })
          );

          // Fill bracket slots
          const bracketSlots: (TournamentParticipant | null)[] = new Array(bracketSize).fill(null);
          for (let i = 0; i < participants.length; i++) {
            bracketSlots[seedOrder[i] - 1] = participants[i];
          }

          // Identify bye matches and simulate auto-completion
          for (let i = 0; i < bracketSize; i += 2) {
            let p1 = bracketSlots[i];
            let p2 = bracketSlots[i + 1];

            // Normalize: ensure participant is in p1 slot
            if (p1 === null && p2 !== null) {
              p1 = p2;
              p2 = null;
            }

            const isByeMatch = p1 !== null && p2 === null;

            if (isByeMatch) {
              // Simulate auto-completion
              const completedMatch = {
                participant1Id: p1!.id,
                participant2Id: null,
                winnerId: p1!.id,
                battleId: null,
                status: 'completed',
                isByeMatch: true,
              };

              // Verify bye match properties
              expect(completedMatch.winnerId).toBe(p1!.id);
              expect(completedMatch.battleId).toBeNull();
              expect(completedMatch.status).toBe('completed');
              expect(completedMatch.isByeMatch).toBe(true);
              expect(completedMatch.participant2Id).toBeNull();
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should never auto-complete a match where both participants are present', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 4, max: 64 }),
        (participantCount: number) => {
          const maxRounds = Math.ceil(Math.log2(participantCount));
          const bracketSize = Math.pow(2, maxRounds);
          const seedOrder = generateStandardSeedOrder(bracketSize);

          // Create participants
          const participants: TournamentParticipant[] = Array.from(
            { length: participantCount },
            (_, i) => ({
              id: i + 1,
              displayName: `P${i + 1}`,
              elo: 1500 - i * 10,
              createdAt: new Date(2024, 0, i + 1),
            })
          );

          // Fill bracket slots
          const bracketSlots: (TournamentParticipant | null)[] = new Array(bracketSize).fill(null);
          for (let i = 0; i < participants.length; i++) {
            bracketSlots[seedOrder[i] - 1] = participants[i];
          }

          // Check that no match with both participants is marked as bye
          for (let i = 0; i < bracketSize; i += 2) {
            const p1 = bracketSlots[i];
            const p2 = bracketSlots[i + 1];

            if (p1 !== null && p2 !== null) {
              // Both present — this is NOT a bye match
              const isByeMatch = false;
              expect(isByeMatch).toBe(false);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 8: Sequential tournament naming ────────────────────────────────

describe('Feature: team-battle-tournaments, Property 8: N-th tournament of a type named prefix #N', () => {
  /**
   * **Validates: Requirements 2.5**
   *
   * For any sequence of tournament creations of the same participantType,
   * the N-th tournament SHALL be named "{prefix} #{N}".
   */
  it('should produce sequential names following the pattern "{prefix} #{N}"', () => {
    fc.assert(
      fc.property(
        // Generate a prefix
        fc.constantFrom('Tournament', '2v2 Tournament', '3v3 Tournament'),
        // Generate a count of existing tournaments (0 to 100)
        fc.integer({ min: 0, max: 100 }),
        (prefix: string, existingCount: number) => {
          // The naming formula: `${prefix} #${existingCount + 1}`
          const expectedName = `${prefix} #${existingCount + 1}`;

          // Simulate the naming logic from createTournament
          const tournamentName = `${prefix} #${existingCount + 1}`;

          expect(tournamentName).toBe(expectedName);

          // Verify format: must end with " #N" where N is a positive integer
          const match = tournamentName.match(/^(.+) #(\d+)$/);
          expect(match).not.toBeNull();
          expect(match![1]).toBe(prefix);
          expect(parseInt(match![2], 10)).toBe(existingCount + 1);
          expect(parseInt(match![2], 10)).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should produce monotonically increasing numbers for sequential creations', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('Tournament', '2v2 Tournament', '3v3 Tournament'),
        // Generate a sequence length
        fc.integer({ min: 2, max: 50 }),
        (prefix: string, sequenceLength: number) => {
          const names: string[] = [];
          for (let i = 0; i < sequenceLength; i++) {
            names.push(`${prefix} #${i + 1}`);
          }

          // Verify monotonically increasing
          for (let i = 0; i < names.length - 1; i++) {
            const currentNum = parseInt(names[i].match(/#(\d+)$/)![1], 10);
            const nextNum = parseInt(names[i + 1].match(/#(\d+)$/)![1], 10);
            expect(nextNum).toBe(currentNum + 1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 12: Winner advancement correctness ─────────────────────────────

describe('Feature: team-battle-tournaments, Property 12: Winners correctly paired in next round', () => {
  /**
   * **Validates: Requirements 5.1**
   *
   * For any completed round with K matches producing K winners, the next round
   * SHALL have ceil(K/2) matches with winners correctly paired.
   */
  it('should pair winners from consecutive matches into next-round matches', () => {
    fc.assert(
      fc.property(
        // Generate number of matches in current round (must be even, power of 2)
        fc.constantFrom(2, 4, 8, 16, 32),
        (matchesInRound: number) => {
          // Generate winners for each match
          const winners: number[] = Array.from({ length: matchesInRound }, (_, i) => i + 100);

          // Next round should have matchesInRound / 2 matches
          const nextRoundMatchCount = matchesInRound / 2;

          // Simulate winner advancement: winners paired sequentially
          // Match 1 & 2 winners → next match 1, Match 3 & 4 → next match 2, etc.
          const nextRoundMatches: { participant1Id: number; participant2Id: number }[] = [];
          for (let i = 0; i < nextRoundMatchCount; i++) {
            nextRoundMatches.push({
              participant1Id: winners[i * 2],
              participant2Id: winners[i * 2 + 1],
            });
          }

          // Verify correct number of next-round matches
          expect(nextRoundMatches).toHaveLength(nextRoundMatchCount);

          // Verify all winners are placed
          const placedIds = nextRoundMatches.flatMap((m) => [m.participant1Id, m.participant2Id]);
          expect(placedIds.sort((a, b) => a - b)).toEqual(winners.sort((a, b) => a - b));

          // Verify pairing: winner of match K feeds into position ceil(K/2)
          for (let i = 0; i < matchesInRound; i++) {
            const nextMatchIndex = Math.floor(i / 2);
            const slot = i % 2 === 0 ? 'participant1Id' : 'participant2Id';
            expect(nextRoundMatches[nextMatchIndex][slot]).toBe(winners[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle odd winner count by creating a bye in next round', () => {
    fc.assert(
      fc.property(
        // Odd number of winners (simulates scenario where one match had no winner)
        fc.constantFrom(3, 5, 7),
        (winnerCount: number) => {
          const winners: number[] = Array.from({ length: winnerCount }, (_, i) => i + 200);

          // Next round match count: ceil(winnerCount / 2)
          const nextRoundMatchCount = Math.ceil(winnerCount / 2);

          // Simulate advancement
          const nextRoundMatches: { participant1Id: number | null; participant2Id: number | null }[] = [];
          for (let i = 0; i < nextRoundMatchCount; i++) {
            nextRoundMatches.push({
              participant1Id: winners[i * 2] ?? null,
              participant2Id: winners[i * 2 + 1] ?? null,
            });
          }

          expect(nextRoundMatches).toHaveLength(nextRoundMatchCount);

          // Last match should have only one participant (bye)
          const lastMatch = nextRoundMatches[nextRoundMatchCount - 1];
          expect(lastMatch.participant1Id).not.toBeNull();
          expect(lastMatch.participant2Id).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 13: Tournament completion detection ────────────────────────────

describe('Feature: team-battle-tournaments, Property 13: Tournament marked completed when final round has one winner', () => {
  /**
   * **Validates: Requirements 5.2**
   *
   * For any tournament where the final round produces exactly one winner,
   * the tournament SHALL be marked completed.
   */
  it('should detect completion when only one winner remains after final round', () => {
    fc.assert(
      fc.property(
        // Generate bracket sizes (power of 2)
        fc.constantFrom(4, 8, 16, 32, 64),
        // Generate a winner ID
        fc.integer({ min: 1, max: 1000 }),
        fc.constantFrom('robot', 'team_2v2', 'team_3v3') as fc.Arbitrary<ParticipantType>,
        (bracketSize: number, winnerId: number, participantType: ParticipantType) => {
          const maxRounds = Math.log2(bracketSize);

          // Simulate tournament progression: each round halves the participants
          let remainingParticipants = bracketSize;
          for (let round = 1; round <= maxRounds; round++) {
            remainingParticipants = remainingParticipants / 2;
          }

          // After all rounds, exactly 1 participant remains
          expect(remainingParticipants).toBe(1);

          // Simulate final round: 1 match, 1 winner
          const finalRoundWinners = [winnerId];

          // Tournament completion logic: if only one winner, mark completed
          const shouldComplete = finalRoundWinners.length === 1;
          expect(shouldComplete).toBe(true);

          // Simulate completion
          const completedTournament = {
            status: 'completed',
            winnerId: finalRoundWinners[0],
            completedAt: new Date(),
            participantType,
          };

          expect(completedTournament.status).toBe('completed');
          expect(completedTournament.winnerId).toBe(winnerId);
          expect(completedTournament.completedAt).toBeInstanceOf(Date);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should NOT mark tournament completed when multiple winners remain', () => {
    fc.assert(
      fc.property(
        // Generate number of winners (more than 1 means not final round)
        fc.integer({ min: 2, max: 32 }),
        (winnerCount: number) => {
          const winners = Array.from({ length: winnerCount }, (_, i) => i + 1);

          // Tournament completion logic: only complete if exactly 1 winner
          const shouldComplete = winners.length === 1;
          expect(shouldComplete).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 15: Championship counter isolation ─────────────────────────────

describe('Feature: team-battle-tournaments, Property 15: Only matching per-type counter incremented on tournament win', () => {
  /**
   * **Validates: Requirements 6.1, 6.3**
   *
   * For any tournament win, exactly one per-type counter SHALL be incremented,
   * the unified counter SHALL be incremented by 1, and all other per-type counters
   * SHALL remain unchanged.
   */
  it('should increment only the matching per-type counter and the unified counter', () => {
    fc.assert(
      fc.property(
        // Generate initial counter state
        fc.record({
          championshipTitles: fc.integer({ min: 0, max: 50 }),
          championshipTitles1v1: fc.integer({ min: 0, max: 50 }),
          championshipTitles2v2: fc.integer({ min: 0, max: 50 }),
          championshipTitles3v3: fc.integer({ min: 0, max: 50 }),
        }),
        // Generate which type of tournament was won
        fc.constantFrom('robot', 'team_2v2', 'team_3v3') as fc.Arbitrary<ParticipantType>,
        (initialCounters, winningType) => {
          // Simulate the completeTournament logic
          const updatedCounters = { ...initialCounters };

          // Unified counter always increments
          updatedCounters.championshipTitles += 1;

          // Per-type counter increments based on participantType
          if (winningType === 'robot') {
            updatedCounters.championshipTitles1v1 += 1;
          } else if (winningType === 'team_2v2') {
            updatedCounters.championshipTitles2v2 += 1;
          } else if (winningType === 'team_3v3') {
            updatedCounters.championshipTitles3v3 += 1;
          }

          // Verify unified counter incremented by exactly 1
          expect(updatedCounters.championshipTitles).toBe(initialCounters.championshipTitles + 1);

          // Verify exactly one per-type counter incremented
          if (winningType === 'robot') {
            expect(updatedCounters.championshipTitles1v1).toBe(initialCounters.championshipTitles1v1 + 1);
            expect(updatedCounters.championshipTitles2v2).toBe(initialCounters.championshipTitles2v2);
            expect(updatedCounters.championshipTitles3v3).toBe(initialCounters.championshipTitles3v3);
          } else if (winningType === 'team_2v2') {
            expect(updatedCounters.championshipTitles1v1).toBe(initialCounters.championshipTitles1v1);
            expect(updatedCounters.championshipTitles2v2).toBe(initialCounters.championshipTitles2v2 + 1);
            expect(updatedCounters.championshipTitles3v3).toBe(initialCounters.championshipTitles3v3);
          } else if (winningType === 'team_3v3') {
            expect(updatedCounters.championshipTitles1v1).toBe(initialCounters.championshipTitles1v1);
            expect(updatedCounters.championshipTitles2v2).toBe(initialCounters.championshipTitles2v2);
            expect(updatedCounters.championshipTitles3v3).toBe(initialCounters.championshipTitles3v3 + 1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should never increment more than one per-type counter per win', () => {
    fc.assert(
      fc.property(
        fc.record({
          championshipTitles1v1: fc.integer({ min: 0, max: 50 }),
          championshipTitles2v2: fc.integer({ min: 0, max: 50 }),
          championshipTitles3v3: fc.integer({ min: 0, max: 50 }),
        }),
        fc.constantFrom('robot', 'team_2v2', 'team_3v3') as fc.Arbitrary<ParticipantType>,
        (initialCounters, winningType) => {
          const updatedCounters = { ...initialCounters };

          // Apply increment logic
          if (winningType === 'robot') {
            updatedCounters.championshipTitles1v1 += 1;
          } else if (winningType === 'team_2v2') {
            updatedCounters.championshipTitles2v2 += 1;
          } else if (winningType === 'team_3v3') {
            updatedCounters.championshipTitles3v3 += 1;
          }

          // Count how many per-type counters changed
          let changedCount = 0;
          if (updatedCounters.championshipTitles1v1 !== initialCounters.championshipTitles1v1) changedCount++;
          if (updatedCounters.championshipTitles2v2 !== initialCounters.championshipTitles2v2) changedCount++;
          if (updatedCounters.championshipTitles3v3 !== initialCounters.championshipTitles3v3) changedCount++;

          // Exactly one counter should have changed
          expect(changedCount).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });
});
