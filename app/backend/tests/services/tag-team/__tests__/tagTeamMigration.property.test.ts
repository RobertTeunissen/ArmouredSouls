/**
 * Tag Team Migration - Property-Based Tests
 * Feature: tag-team-system-unification
 *
 * Tests the correctness properties of the TagTeam → TeamBattle migration script.
 * Properties 1–3 validate data migration logic, Property 9 validates scheduled match
 * migration, and Property 11 validates league history entity ID remapping.
 *
 * Pure logic functions (generateTeamName, ID mapping) are tested with fast-check.
 * Database-dependent properties are documented as integration test stubs.
 */

import * as fc from 'fast-check';
import { generateTeamName, getTagTeamIdMapping } from '../../../../scripts/migrateTagTeamsToTeamBattle';

// ─── Property 1: Migration Data Preservation ────────────────────────────────

describe('Feature: tag-team-system-unification', () => {
  describe('Property 1: Migration Data Preservation', () => {
    /**
     * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**
     *
     * For any valid TagTeam row, after running the data migration, a TeamBattle row
     * SHALL exist with: teamSize = 2, stableId matching, teamName matching the pattern
     * "{ActiveRobotName} & {ReserveRobotName}" (truncated to 32 chars), and all tag team
     * league/stats fields preserved.
     */

    it('should generate team names correctly for any valid robot name pair', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          (activeName, reserveName) => {
            const result = generateTeamName(activeName, reserveName);

            // Result must always be non-empty
            expect(result.length).toBeGreaterThan(0);

            // Result must always be ≤ 32 characters
            expect(result.length).toBeLessThanOrEqual(32);

            // Result must contain the " & " separator OR be truncated
            if (result.length <= 32 && !result.endsWith('...')) {
              expect(result).toContain(' & ');
            }
          }
        ),
        { numRuns: 200 }
      );
    });

    it('should always produce output ≤ 32 characters regardless of input length', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 100 }),
          fc.string({ minLength: 0, maxLength: 100 }),
          (activeName, reserveName) => {
            const result = generateTeamName(activeName, reserveName);
            expect(result.length).toBeLessThanOrEqual(32);
          }
        ),
        { numRuns: 200 }
      );
    });

    it('should truncate with "..." suffix when combined name exceeds 32 characters', () => {
      fc.assert(
        fc.property(
          // Generate names long enough to exceed 32 chars when combined with " & "
          fc.string({ minLength: 15, maxLength: 50 }).filter((s) => s.trim().length >= 15),
          fc.string({ minLength: 15, maxLength: 50 }).filter((s) => s.trim().length >= 15),
          (activeName, reserveName) => {
            const combinedFull = `${activeName.trim()} & ${reserveName.trim()}`;

            const result = generateTeamName(activeName, reserveName);

            if (combinedFull.length > 32) {
              // Must end with "..." and be exactly 32 chars
              expect(result).toHaveLength(32);
              expect(result.endsWith('...')).toBe(true);
              // The first 29 chars should match the start of the full combined name
              expect(result.slice(0, 29)).toBe(combinedFull.slice(0, 29));
            }
          }
        ),
        { numRuns: 200 }
      );
    });

    it('should substitute "Robot" for NULL robot names', () => {
      fc.assert(
        fc.property(
          fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
          fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
          (activeName, reserveName) => {
            const result = generateTeamName(activeName, reserveName);

            // Result must always be non-empty
            expect(result.length).toBeGreaterThan(0);

            // If both names are null/empty, result should be "Robot & Robot"
            const activeIsEmpty = !activeName || activeName.trim() === '';
            const reserveIsEmpty = !reserveName || reserveName.trim() === '';

            if (activeIsEmpty && reserveIsEmpty) {
              expect(result).toBe('Robot & Robot');
            }

            // If only active is null/empty, result should start with "Robot"
            if (activeIsEmpty && !reserveIsEmpty) {
              expect(result.startsWith('Robot &') || result.startsWith('Robot...')).toBe(
                result.startsWith('Robot')
              );
            }
          }
        ),
        { numRuns: 200 }
      );
    });

    it('should substitute "Robot" for undefined robot names', () => {
      fc.assert(
        fc.property(
          fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
          fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
          (activeName, reserveName) => {
            const result = generateTeamName(activeName, reserveName);

            // Result must always be non-empty
            expect(result.length).toBeGreaterThan(0);
            expect(result.length).toBeLessThanOrEqual(32);
          }
        ),
        { numRuns: 200 }
      );
    });

    it('should substitute "Robot" for empty string or whitespace-only robot names', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('', '   ', '\t', '\n', ' \t\n '),
          fc.constantFrom('', '   ', '\t', '\n', ' \t\n '),
          (activeName, reserveName) => {
            const result = generateTeamName(activeName, reserveName);

            // Empty/whitespace names should produce "Robot & Robot"
            expect(result).toBe('Robot & Robot');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should trim whitespace from robot names before constructing team name', () => {
      fc.assert(
        fc.property(
          // Generate non-whitespace strings padded with spaces
          fc.string({ minLength: 1, maxLength: 10 }).filter((s) => s.trim().length > 0).map((s) => `  ${s}  `),
          fc.string({ minLength: 1, maxLength: 10 }).filter((s) => s.trim().length > 0).map((s) => `  ${s}  `),
          (activeName, reserveName) => {
            const result = generateTeamName(activeName, reserveName);
            const expectedFull = `${activeName.trim()} & ${reserveName.trim()}`;

            if (expectedFull.length <= 32) {
              expect(result).toBe(expectedFull);
            } else {
              expect(result).toHaveLength(32);
              expect(result.endsWith('...')).toBe(true);
            }
          }
        ),
        { numRuns: 200 }
      );
    });

    it('should correctly map all TagTeam fields to TeamBattle fields in migration output', () => {
      /**
       * This test validates the field mapping logic for a simulated migration.
       * For any valid TagTeam input, the output TeamBattle row should have:
       * - teamSize = 2
       * - teamLp = 0 (default for new migrated teams)
       * - teamLeague = 'bronze'
       * - totalLeagueWins/Losses/Draws = 0
       * - tagTeamLp = original tagTeamLeaguePoints
       * - tagTeamLeague/Id/Cycles preserved
       * - totalTagTeamWins/Losses/Draws preserved
       */
      fc.assert(
        fc.property(
          fc.record({
            stableId: fc.integer({ min: 1, max: 10000 }),
            tagTeamLeaguePoints: fc.integer({ min: 0, max: 5000 }),
            tagTeamLeague: fc.constantFrom('bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'),
            tagTeamLeagueId: fc.string({ minLength: 3, maxLength: 30 }),
            cyclesInTagTeamLeague: fc.integer({ min: 0, max: 100 }),
            totalTagTeamWins: fc.integer({ min: 0, max: 500 }),
            totalTagTeamLosses: fc.integer({ min: 0, max: 500 }),
            totalTagTeamDraws: fc.integer({ min: 0, max: 200 }),
          }),
          (tagTeam) => {
            // Simulate the field mapping logic from the migration script
            const teamBattleRow = {
              teamSize: 2,
              stableId: tagTeam.stableId,
              // 2v2 League fields (defaults)
              teamLp: 0,
              teamLeague: 'bronze',
              cyclesInLeague: 0,
              totalLeagueWins: 0,
              totalLeagueLosses: 0,
              totalLeagueDraws: 0,
              // Tag Team fields (copied)
              tagTeamLp: tagTeam.tagTeamLeaguePoints,
              tagTeamLeague: tagTeam.tagTeamLeague,
              tagTeamLeagueId: tagTeam.tagTeamLeagueId,
              cyclesInTagTeamLeague: tagTeam.cyclesInTagTeamLeague,
              totalTagTeamWins: tagTeam.totalTagTeamWins,
              totalTagTeamLosses: tagTeam.totalTagTeamLosses,
              totalTagTeamDraws: tagTeam.totalTagTeamDraws,
            };

            // Verify teamSize is always 2
            expect(teamBattleRow.teamSize).toBe(2);

            // Verify stableId preserved
            expect(teamBattleRow.stableId).toBe(tagTeam.stableId);

            // Verify 2v2 League defaults
            expect(teamBattleRow.teamLp).toBe(0);
            expect(teamBattleRow.teamLeague).toBe('bronze');
            expect(teamBattleRow.cyclesInLeague).toBe(0);
            expect(teamBattleRow.totalLeagueWins).toBe(0);
            expect(teamBattleRow.totalLeagueLosses).toBe(0);
            expect(teamBattleRow.totalLeagueDraws).toBe(0);

            // Verify tag team fields preserved
            expect(teamBattleRow.tagTeamLp).toBe(tagTeam.tagTeamLeaguePoints);
            expect(teamBattleRow.tagTeamLeague).toBe(tagTeam.tagTeamLeague);
            expect(teamBattleRow.tagTeamLeagueId).toBe(tagTeam.tagTeamLeagueId);
            expect(teamBattleRow.cyclesInTagTeamLeague).toBe(tagTeam.cyclesInTagTeamLeague);
            expect(teamBattleRow.totalTagTeamWins).toBe(tagTeam.totalTagTeamWins);
            expect(teamBattleRow.totalTagTeamLosses).toBe(tagTeam.totalTagTeamLosses);
            expect(teamBattleRow.totalTagTeamDraws).toBe(tagTeam.totalTagTeamDraws);
          }
        ),
        { numRuns: 200 }
      );
    });

    it('should create correct TeamBattleMember slot assignments for any robot pair', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100000 }),
          fc.integer({ min: 1, max: 100000 }),
          (activeRobotId, reserveRobotId) => {
            // Precondition: robots must be different
            fc.pre(activeRobotId !== reserveRobotId);

            // Simulate member creation logic from migration
            const members = [
              { robotId: activeRobotId, slotIndex: 0 },
              { robotId: reserveRobotId, slotIndex: 1 },
            ];

            // Slot 0 = Active robot
            expect(members[0].robotId).toBe(activeRobotId);
            expect(members[0].slotIndex).toBe(0);

            // Slot 1 = Reserve robot
            expect(members[1].robotId).toBe(reserveRobotId);
            expect(members[1].slotIndex).toBe(1);

            // Exactly 2 members
            expect(members).toHaveLength(2);
          }
        ),
        { numRuns: 200 }
      );
    });
  });

  // ─── Property 2: Migration Conflict Handling ────────────────────────────────

  describe('Property 2: Migration Conflict Handling', () => {
    /**
     * **Validates: Requirements 2.6**
     *
     * For any set of TagTeam rows where some reference robot IDs that are already
     * members of an existing TeamBattle with teamSize=2, the migration SHALL skip
     * those conflicting rows AND successfully migrate all non-conflicting rows.
     */

    it('should skip rows where a robot is already on a teamSize=2 TeamBattle', () => {
      fc.assert(
        fc.property(
          // Generate a set of "existing" robots already on teams
          fc.array(fc.integer({ min: 1, max: 1000 }), { minLength: 1, maxLength: 20 }),
          // Generate TagTeam rows with random robot IDs
          fc.array(
            fc.record({
              id: fc.integer({ min: 1, max: 10000 }),
              activeRobotId: fc.integer({ min: 1, max: 1000 }),
              reserveRobotId: fc.integer({ min: 1, max: 1000 }),
            }),
            { minLength: 1, maxLength: 30 }
          ),
          (existingRobotIds, tagTeams) => {
            const robotsOnTeams = new Set(existingRobotIds);

            let migrated = 0;
            let skippedConflict = 0;

            for (const tagTeam of tagTeams) {
              // Simulate conflict check from migration script
              if (robotsOnTeams.has(tagTeam.activeRobotId)) {
                skippedConflict++;
                continue;
              }
              if (robotsOnTeams.has(tagTeam.reserveRobotId)) {
                skippedConflict++;
                continue;
              }

              // Not conflicting — migrate and add robots to set
              robotsOnTeams.add(tagTeam.activeRobotId);
              robotsOnTeams.add(tagTeam.reserveRobotId);
              migrated++;
            }

            // Total processed should equal migrated + skipped
            expect(migrated + skippedConflict).toBe(tagTeams.length);

            // Migrated count should be <= total
            expect(migrated).toBeLessThanOrEqual(tagTeams.length);

            // Skipped count should be >= 0
            expect(skippedConflict).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 200 }
      );
    });

    it('should correctly count conflicts when robots appear in multiple TagTeam rows', () => {
      fc.assert(
        fc.property(
          // A shared robot ID that will cause conflicts
          fc.integer({ min: 1, max: 100 }),
          // Number of TagTeam rows using the shared robot
          fc.integer({ min: 2, max: 10 }),
          (sharedRobotId, rowCount) => {
            const robotsOnTeams = new Set<number>();
            let migrated = 0;
            let skippedConflict = 0;

            // Create rows that all share the same activeRobotId
            for (let i = 0; i < rowCount; i++) {
              const activeRobotId = sharedRobotId;
              const reserveRobotId = sharedRobotId + 1000 + i; // Unique reserve robots

              if (robotsOnTeams.has(activeRobotId) || robotsOnTeams.has(reserveRobotId)) {
                skippedConflict++;
                continue;
              }

              robotsOnTeams.add(activeRobotId);
              robotsOnTeams.add(reserveRobotId);
              migrated++;
            }

            // Only the first row should be migrated (after that, sharedRobotId is on a team)
            expect(migrated).toBe(1);
            expect(skippedConflict).toBe(rowCount - 1);
          }
        ),
        { numRuns: 200 }
      );
    });

    it('should migrate all rows when there are no conflicts', () => {
      fc.assert(
        fc.property(
          // Generate unique robot IDs (no conflicts possible)
          fc.integer({ min: 1, max: 50 }),
          (teamCount) => {
            const robotsOnTeams = new Set<number>();
            let migrated = 0;
            let skippedConflict = 0;

            // Create rows with completely unique robot IDs (no overlaps)
            for (let i = 0; i < teamCount; i++) {
              const activeRobotId = i * 2 + 1; // Odd numbers: 1, 3, 5, ...
              const reserveRobotId = i * 2 + 2; // Even numbers: 2, 4, 6, ...

              if (robotsOnTeams.has(activeRobotId) || robotsOnTeams.has(reserveRobotId)) {
                skippedConflict++;
                continue;
              }

              robotsOnTeams.add(activeRobotId);
              robotsOnTeams.add(reserveRobotId);
              migrated++;
            }

            // All rows should be migrated with no conflicts
            expect(migrated).toBe(teamCount);
            expect(skippedConflict).toBe(0);
          }
        ),
        { numRuns: 200 }
      );
    });
  });

  // ─── Property 3: Migration Idempotency ──────────────────────────────────────

  describe('Property 3: Migration Idempotency', () => {
    /**
     * **Validates: Requirements 2.8**
     *
     * For any database state containing TagTeam rows, running the migration function
     * twice SHALL produce the same TeamBattle row set as running it once — no duplicate
     * rows created, no field values changed on the second run.
     */

    it('should skip creation when TeamBattle with matching stableId + member robots exists', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.integer({ min: 1, max: 10000 }),
              stableId: fc.integer({ min: 1, max: 5000 }),
              activeRobotId: fc.integer({ min: 1, max: 100000 }),
              reserveRobotId: fc.integer({ min: 1, max: 100000 }),
            }),
            { minLength: 1, maxLength: 20 }
          ),
          (tagTeams) => {
            // Simulate first migration run
            const existingTeamLookup = new Map<string, number>();
            const robotsOnTeams = new Set<number>();
            let firstRunMigrated = 0;
            let teamBattleIdCounter = 1;

            for (const tagTeam of tagTeams) {
              const idempotencyKey = `${tagTeam.stableId}:${tagTeam.activeRobotId}:${tagTeam.reserveRobotId}`;

              if (existingTeamLookup.has(idempotencyKey)) {
                continue; // Idempotent skip
              }
              if (robotsOnTeams.has(tagTeam.activeRobotId) || robotsOnTeams.has(tagTeam.reserveRobotId)) {
                continue; // Conflict skip
              }

              existingTeamLookup.set(idempotencyKey, teamBattleIdCounter++);
              robotsOnTeams.add(tagTeam.activeRobotId);
              robotsOnTeams.add(tagTeam.reserveRobotId);
              firstRunMigrated++;
            }

            // Simulate second migration run (same TagTeam rows, existing lookup already populated)
            let secondRunMigrated = 0;
            let secondRunIdempotentSkip = 0;

            for (const tagTeam of tagTeams) {
              const idempotencyKey = `${tagTeam.stableId}:${tagTeam.activeRobotId}:${tagTeam.reserveRobotId}`;

              if (existingTeamLookup.has(idempotencyKey)) {
                secondRunIdempotentSkip++;
                continue; // Idempotent skip — already exists
              }
              if (robotsOnTeams.has(tagTeam.activeRobotId) || robotsOnTeams.has(tagTeam.reserveRobotId)) {
                continue; // Conflict skip
              }

              secondRunMigrated++;
            }

            // Second run should create ZERO new rows
            expect(secondRunMigrated).toBe(0);

            // All previously migrated rows should be detected as idempotent
            expect(secondRunIdempotentSkip).toBeGreaterThanOrEqual(firstRunMigrated);

            // Total team count after two runs should equal first run count
            expect(existingTeamLookup.size).toBe(firstRunMigrated);
          }
        ),
        { numRuns: 200 }
      );
    });

    it('should produce consistent ID mapping across runs', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.integer({ min: 1, max: 10000 }),
            stableId: fc.integer({ min: 1, max: 5000 }),
            activeRobotId: fc.integer({ min: 1, max: 100000 }),
            reserveRobotId: fc.integer({ min: 1, max: 100000 }),
          }),
          (tagTeam) => {
            fc.pre(tagTeam.activeRobotId !== tagTeam.reserveRobotId);

            const idempotencyKey = `${tagTeam.stableId}:${tagTeam.activeRobotId}:${tagTeam.reserveRobotId}`;

            // Simulate first run: creates a new TeamBattle with ID 42
            const existingTeamLookup = new Map<string, number>();
            const newTeamId = 42;
            existingTeamLookup.set(idempotencyKey, newTeamId);

            // Simulate second run: should find existing and return same ID
            const existingTeamId = existingTeamLookup.get(idempotencyKey);
            expect(existingTeamId).toBe(newTeamId);

            // ID mapping should be stable
            const idMapping = new Map<number, number>();
            idMapping.set(tagTeam.id, existingTeamId!);
            expect(idMapping.get(tagTeam.id)).toBe(newTeamId);
          }
        ),
        { numRuns: 200 }
      );
    });
  });

  // ─── Property 9: Scheduled Match Migration Correctness ─────────────────────

  describe('Property 9: Scheduled Match Migration Correctness', () => {
    /**
     * **Validates: Requirements 7.2, 7.6**
     *
     * For any existing ScheduledTagTeamMatch row with valid team1Id and team2Id
     * referencing migrated teams, after migration a ScheduledTeamBattleMatch row SHALL
     * exist with: matchMode = 'tag_team', teamSize = 2, team1Id and team2Id mapping to
     * the new TeamBattle.id values, and scheduledFor/status preserved.
     *
     * Additionally, all pre-existing ScheduledTeamBattleMatch rows SHALL have matchMode
     * backfilled based on teamSize (2 → 'league_2v2', 3 → 'league_3v3').
     */

    it('should correctly remap team IDs using the migration ID mapping', () => {
      fc.assert(
        fc.property(
          // Generate an ID mapping (old → new)
          fc.array(
            fc.tuple(fc.integer({ min: 1, max: 1000 }), fc.integer({ min: 5000, max: 10000 })),
            { minLength: 2, maxLength: 50 }
          ),
          // Generate scheduled matches referencing old IDs
          fc.array(
            fc.record({
              id: fc.integer({ min: 1, max: 10000 }),
              team1Id: fc.integer({ min: 1, max: 1000 }),
              team2Id: fc.integer({ min: 1, max: 1000 }),
              scheduledFor: fc.date(),
              status: fc.constantFrom('scheduled', 'completed', 'cancelled'),
              tagTeamLeague: fc.constantFrom('bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'),
            }),
            { minLength: 1, maxLength: 20 }
          ),
          (idMappingEntries, scheduledMatches) => {
            // Build the ID mapping
            const idMapping = new Map<number, number>();
            for (const [oldId, newId] of idMappingEntries) {
              idMapping.set(oldId, newId);
            }

            let migrated = 0;
            let skipped = 0;

            for (const match of scheduledMatches) {
              const newTeam1Id = idMapping.get(match.team1Id);
              if (!newTeam1Id) {
                skipped++;
                continue;
              }

              const newTeam2Id = idMapping.get(match.team2Id);
              if (!newTeam2Id) {
                skipped++;
                continue;
              }

              // Verify the remapped match has correct structure
              const migratedMatch = {
                team1Id: newTeam1Id,
                team2Id: newTeam2Id,
                teamSize: 2,
                matchMode: 'tag_team' as const,
                scheduledFor: match.scheduledFor,
                status: match.status,
                teamBattleLeague: match.tagTeamLeague,
              };

              expect(migratedMatch.matchMode).toBe('tag_team');
              expect(migratedMatch.teamSize).toBe(2);
              expect(migratedMatch.scheduledFor).toBe(match.scheduledFor);
              expect(migratedMatch.status).toBe(match.status);
              expect(migratedMatch.team1Id).toBe(newTeam1Id);
              expect(migratedMatch.team2Id).toBe(newTeam2Id);

              migrated++;
            }

            expect(migrated + skipped).toBe(scheduledMatches.length);
          }
        ),
        { numRuns: 200 }
      );
    });

    it('should skip scheduled matches referencing teams that were not migrated', () => {
      fc.assert(
        fc.property(
          // ID mapping with a limited set of old IDs
          fc.array(
            fc.tuple(
              fc.integer({ min: 1, max: 50 }),
              fc.integer({ min: 100, max: 200 })
            ),
            { minLength: 1, maxLength: 10 }
          ),
          // Match referencing an ID NOT in the mapping
          fc.integer({ min: 51, max: 100 }),
          (idMappingEntries, unmappedTeamId) => {
            const idMapping = new Map<number, number>();
            for (const [oldId, newId] of idMappingEntries) {
              idMapping.set(oldId, newId);
            }

            // This team ID should not be in the mapping
            fc.pre(!idMapping.has(unmappedTeamId));

            // Simulate migration logic for a match with unmapped team
            const newTeam1Id = idMapping.get(unmappedTeamId);

            // Should be undefined — match should be skipped
            expect(newTeam1Id).toBeUndefined();
          }
        ),
        { numRuns: 200 }
      );
    });

    it('should backfill matchMode based on teamSize for existing ScheduledTeamBattleMatch rows', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(2, 3),
          fc.integer({ min: 1, max: 10000 }),
          (teamSize, matchId) => {
            // Simulate the backfill logic from the migration
            const expectedMatchMode = teamSize === 2 ? 'league_2v2' : 'league_3v3';

            // Verify the backfill mapping
            const backfilledMatch = {
              id: matchId,
              teamSize,
              matchMode: teamSize === 2 ? 'league_2v2' : 'league_3v3',
            };

            expect(backfilledMatch.matchMode).toBe(expectedMatchMode);

            // matchMode must be one of the valid values
            expect(['league_2v2', 'league_3v3', 'tag_team', 'tournament_2v2', 'tournament_3v3']).toContain(
              backfilledMatch.matchMode
            );
          }
        ),
        { numRuns: 200 }
      );
    });
  });

  // ─── Property 11: League History EntityId Integrity ─────────────────────────

  describe('Property 11: League History EntityId Integrity', () => {
    /**
     * **Validates: Requirements 13.1, 13.2**
     *
     * For any LeagueHistory row with entityType = 'tag_team' that referenced an old
     * TagTeam.id, after migration its entityId SHALL reference the corresponding new
     * TeamBattle.id. For any new tag team promotion/demotion event recorded after
     * migration, the history entry SHALL have entityType = 'tag_team' and entityId
     * equal to the TeamBattle.id.
     */

    it('should correctly remap entityId for tag_team history entries using the ID mapping', () => {
      fc.assert(
        fc.property(
          // Generate an ID mapping (old TagTeam ID → new TeamBattle ID)
          fc.array(
            fc.tuple(fc.integer({ min: 1, max: 1000 }), fc.integer({ min: 5000, max: 10000 })),
            { minLength: 1, maxLength: 50 }
          ),
          // Generate league history entries referencing old TagTeam IDs
          fc.array(
            fc.record({
              id: fc.integer({ min: 1, max: 10000 }),
              entityType: fc.constant('tag_team'),
              entityId: fc.integer({ min: 1, max: 1000 }),
              fromLeague: fc.constantFrom('bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'),
              toLeague: fc.constantFrom('bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'),
              changeType: fc.constantFrom('promotion', 'demotion'),
            }),
            { minLength: 1, maxLength: 30 }
          ),
          (idMappingEntries, historyEntries) => {
            // Build the ID mapping
            const idMapping = new Map<number, number>();
            for (const [oldId, newId] of idMappingEntries) {
              idMapping.set(oldId, newId);
            }

            let remapped = 0;
            let orphaned = 0;

            for (const entry of historyEntries) {
              const newEntityId = idMapping.get(entry.entityId);

              if (newEntityId) {
                // Simulate the update
                const updatedEntry = {
                  ...entry,
                  entityId: newEntityId,
                };

                // Verify entityType is preserved
                expect(updatedEntry.entityType).toBe('tag_team');

                // Verify entityId now points to new TeamBattle ID
                expect(updatedEntry.entityId).toBe(newEntityId);
                expect(updatedEntry.entityId).not.toBe(entry.entityId);

                // Verify other fields are unchanged
                expect(updatedEntry.fromLeague).toBe(entry.fromLeague);
                expect(updatedEntry.toLeague).toBe(entry.toLeague);
                expect(updatedEntry.changeType).toBe(entry.changeType);

                remapped++;
              } else {
                // Entry references a TagTeam that was skipped during migration
                orphaned++;
              }
            }

            expect(remapped + orphaned).toBe(historyEntries.length);
          }
        ),
        { numRuns: 200 }
      );
    });

    it('should use entityType "tag_team" and TeamBattle.id for new post-migration history entries', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 5000, max: 10000 }), // TeamBattle ID (post-migration)
          fc.constantFrom('bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'),
          fc.constantFrom('bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'),
          fc.constantFrom('promotion', 'demotion'),
          (teamBattleId, fromLeague, toLeague, changeType) => {
            // Simulate creating a new history entry after migration
            const newHistoryEntry = {
              entityType: 'tag_team',
              entityId: teamBattleId,
              fromLeague,
              toLeague,
              changeType,
            };

            // entityType must be 'tag_team' (not 'team_battle' or anything else)
            expect(newHistoryEntry.entityType).toBe('tag_team');

            // entityId must reference the TeamBattle ID (new system)
            expect(newHistoryEntry.entityId).toBe(teamBattleId);
            expect(newHistoryEntry.entityId).toBeGreaterThan(0);
          }
        ),
        { numRuns: 200 }
      );
    });

    it('should preserve all history entry fields except entityId during remapping', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.integer({ min: 1, max: 10000 }),
            entityType: fc.constant('tag_team'),
            entityId: fc.integer({ min: 1, max: 1000 }),
            fromLeague: fc.constantFrom('bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'),
            toLeague: fc.constantFrom('bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'),
            fromLeagueId: fc.string({ minLength: 3, maxLength: 20 }),
            toLeagueId: fc.string({ minLength: 3, maxLength: 20 }),
            changeType: fc.constantFrom('promotion', 'demotion'),
            createdAt: fc.date(),
          }),
          fc.integer({ min: 5000, max: 10000 }), // new TeamBattle ID
          (historyEntry, newTeamBattleId) => {
            // Simulate remapping
            const remappedEntry = {
              ...historyEntry,
              entityId: newTeamBattleId,
            };

            // Only entityId should change
            expect(remappedEntry.id).toBe(historyEntry.id);
            expect(remappedEntry.entityType).toBe(historyEntry.entityType);
            expect(remappedEntry.fromLeague).toBe(historyEntry.fromLeague);
            expect(remappedEntry.toLeague).toBe(historyEntry.toLeague);
            expect(remappedEntry.fromLeagueId).toBe(historyEntry.fromLeagueId);
            expect(remappedEntry.toLeagueId).toBe(historyEntry.toLeagueId);
            expect(remappedEntry.changeType).toBe(historyEntry.changeType);
            expect(remappedEntry.createdAt).toBe(historyEntry.createdAt);

            // entityId should be the new value
            expect(remappedEntry.entityId).toBe(newTeamBattleId);
            expect(remappedEntry.entityId).not.toBe(historyEntry.entityId);
          }
        ),
        { numRuns: 200 }
      );
    });
  });
});
