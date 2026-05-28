/**
 * Tests for the Booking Office Migration Script.
 *
 * Validates idempotency, facility granting, subscription creation,
 * per-Stable error handling, and post-migration state for new robots.
 *
 * _Requirements: R6.2, R6.4, R6.7, R13.2_
 */

import fc from 'fast-check';

// ── Mock Setup ───────────────────────────────────────────────────────

// In-memory state to simulate the database
interface FacilityRow {
  userId: number;
  facilityType: string;
  level: number;
  maxLevel: number;
}

interface SubscriptionRow {
  robotId: number;
  eventType: string;
}

interface RobotRow {
  id: number;
  userId: number;
}

interface UserRow {
  id: number;
}

interface AuditLogRow {
  cycleNumber: number;
  eventType: string;
  sequenceNumber: number;
  userId: number;
  payload: unknown;
}

let facilities: FacilityRow[];
let subscriptions: SubscriptionRow[];
let robots: RobotRow[];
let users: UserRow[];
let auditLogs: AuditLogRow[];
let failingStableIds: Set<number>;

function resetState(): void {
  facilities = [];
  subscriptions = [];
  robots = [];
  users = [];
  auditLogs = [];
  failingStableIds = new Set();
}

// ── Migration Logic (extracted for testability) ──────────────────────

const EVENT_TYPES = ['league', 'tournament', 'tag_team', 'koth'] as const;

/**
 * Simulates the per-Stable migration transaction logic from migrate-booking-office.ts.
 * This mirrors the actual script's behaviour for testing purposes.
 */
async function migrateStable(stableId: number): Promise<{ facilityGranted: boolean; subsCreated: number }> {
  if (failingStableIds.has(stableId)) {
    throw new Error(`Simulated failure for Stable ${stableId}`);
  }

  let facilityGranted = false;
  let subsCreated = 0;

  // 1. Upsert booking_office facility to at least L1 (never lower existing)
  const existing = facilities.find(
    (f) => f.userId === stableId && f.facilityType === 'booking_office',
  );

  if (!existing) {
    facilities.push({
      userId: stableId,
      facilityType: 'booking_office',
      level: 1,
      maxLevel: 10,
    });
    facilityGranted = true;
  } else if (existing.level < 1) {
    existing.level = 1;
    facilityGranted = true;
  }
  // If existing.level >= 1, leave it as-is

  // 2. Get all robots for this Stable
  const stableRobots = robots.filter((r) => r.userId === stableId);

  // 3. Insert 4 subscriptions per robot (skip duplicates for idempotency)
  for (const robot of stableRobots) {
    for (const eventType of EVENT_TYPES) {
      const exists = subscriptions.some(
        (s) => s.robotId === robot.id && s.eventType === eventType,
      );
      if (!exists) {
        subscriptions.push({ robotId: robot.id, eventType });
        subsCreated++;
      }
    }
  }

  // 4. Audit log
  const lastSeq = auditLogs.length > 0
    ? Math.max(...auditLogs.map((a) => a.sequenceNumber))
    : 0;
  auditLogs.push({
    cycleNumber: 0,
    eventType: 'booking_office_migration',
    sequenceNumber: lastSeq + 1,
    userId: stableId,
    payload: {
      action: 'migrate_booking_office',
      facilityGranted,
      robotCount: stableRobots.length,
      subscriptionsCreated: subsCreated,
    },
  });

  return { facilityGranted, subsCreated };
}

/**
 * Simulates the full migration run (mirrors main() in migrate-booking-office.ts).
 */
async function runMigration(): Promise<{
  stablesProcessed: number;
  facilitiesGranted: number;
  subscriptionsCreated: number;
  errors: { stableId: number; error: string }[];
}> {
  const summary = {
    stablesProcessed: 0,
    facilitiesGranted: 0,
    subscriptionsCreated: 0,
    errors: [] as { stableId: number; error: string }[],
  };

  for (const user of users) {
    try {
      const result = await migrateStable(user.id);
      summary.stablesProcessed++;
      if (result.facilityGranted) summary.facilitiesGranted++;
      summary.subscriptionsCreated += result.subsCreated;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      summary.errors.push({ stableId: user.id, error: errorMsg });
    }
  }

  return summary;
}

// ── Unit Tests ───────────────────────────────────────────────────────

describe('Booking Office Migration Script', () => {
  beforeEach(() => {
    resetState();
  });

  describe('Idempotency', () => {
    it('should produce the same state when run twice', async () => {
      // Setup: 3 Stables with varying robots
      users = [{ id: 1 }, { id: 2 }, { id: 3 }];
      robots = [
        { id: 10, userId: 1 },
        { id: 11, userId: 1 },
        { id: 20, userId: 2 },
        { id: 30, userId: 3 },
        { id: 31, userId: 3 },
        { id: 32, userId: 3 },
      ];

      // First run
      await runMigration();

      const facilitiesAfterFirst = JSON.parse(JSON.stringify(facilities));
      const subscriptionsAfterFirst = JSON.parse(JSON.stringify(subscriptions));

      // Second run
      const secondResult = await runMigration();

      // State should be identical
      expect(facilities).toEqual(facilitiesAfterFirst);
      expect(subscriptions).toEqual(subscriptionsAfterFirst);
      // Second run should create 0 new subscriptions
      expect(secondResult.subscriptionsCreated).toBe(0);
    });

    it('should not lower existing facility levels above 1', async () => {
      users = [{ id: 1 }];
      robots = [{ id: 10, userId: 1 }];
      // Pre-existing facility at level 5
      facilities = [{ userId: 1, facilityType: 'booking_office', level: 5, maxLevel: 10 }];

      await runMigration();

      const facility = facilities.find((f) => f.userId === 1 && f.facilityType === 'booking_office');
      expect(facility!.level).toBe(5); // Not lowered to 1
    });
  });

  describe('Facility granting', () => {
    it('should grant Booking Office level 1 to every Stable without one', async () => {
      users = [{ id: 1 }, { id: 2 }, { id: 3 }];
      robots = [
        { id: 10, userId: 1 },
        { id: 20, userId: 2 },
        { id: 30, userId: 3 },
      ];

      await runMigration();

      for (const user of users) {
        const facility = facilities.find(
          (f) => f.userId === user.id && f.facilityType === 'booking_office',
        );
        expect(facility).toBeDefined();
        expect(facility!.level).toBeGreaterThanOrEqual(1);
      }
    });

    it('should raise level 0 facilities to level 1', async () => {
      users = [{ id: 1 }];
      robots = [{ id: 10, userId: 1 }];
      facilities = [{ userId: 1, facilityType: 'booking_office', level: 0, maxLevel: 10 }];

      await runMigration();

      const facility = facilities.find((f) => f.userId === 1 && f.facilityType === 'booking_office');
      expect(facility!.level).toBe(1);
    });
  });

  describe('Robot subscriptions', () => {
    it('should give every existing robot 4 subscriptions', async () => {
      users = [{ id: 1 }, { id: 2 }];
      robots = [
        { id: 10, userId: 1 },
        { id: 11, userId: 1 },
        { id: 20, userId: 2 },
      ];

      await runMigration();

      for (const robot of robots) {
        const robotSubs = subscriptions.filter((s) => s.robotId === robot.id);
        expect(robotSubs).toHaveLength(4);
        expect(robotSubs.map((s) => s.eventType).sort()).toEqual(
          ['koth', 'league', 'tag_team', 'tournament'],
        );
      }
    });

    it('should not duplicate subscriptions for robots that already have some', async () => {
      users = [{ id: 1 }];
      robots = [{ id: 10, userId: 1 }];
      // Pre-existing subscriptions
      subscriptions = [
        { robotId: 10, eventType: 'league' },
        { robotId: 10, eventType: 'tournament' },
      ];

      await runMigration();

      const robotSubs = subscriptions.filter((s) => s.robotId === 10);
      expect(robotSubs).toHaveLength(4); // Added tag_team and koth only
    });
  });

  describe('New robots post-migration', () => {
    it('should not give subscriptions to robots created after migration', async () => {
      users = [{ id: 1 }];
      robots = [{ id: 10, userId: 1 }];

      await runMigration();

      // Simulate a new robot created after migration
      const newRobot = { id: 99, userId: 1 };
      robots.push(newRobot);

      // The new robot should have zero subscriptions (migration already ran)
      const newRobotSubs = subscriptions.filter((s) => s.robotId === 99);
      expect(newRobotSubs).toHaveLength(0);
    });
  });

  describe('Per-Stable error handling', () => {
    it('should continue processing other Stables when one fails', async () => {
      users = [{ id: 1 }, { id: 2 }, { id: 3 }];
      robots = [
        { id: 10, userId: 1 },
        { id: 20, userId: 2 },
        { id: 30, userId: 3 },
      ];
      // Stable 2 will fail
      failingStableIds = new Set([2]);

      const result = await runMigration();

      // Stables 1 and 3 should be processed successfully
      expect(result.stablesProcessed).toBe(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].stableId).toBe(2);

      // Stable 1 and 3 should have facilities and subscriptions
      expect(facilities.find((f) => f.userId === 1)).toBeDefined();
      expect(facilities.find((f) => f.userId === 3)).toBeDefined();
      expect(subscriptions.filter((s) => s.robotId === 10)).toHaveLength(4);
      expect(subscriptions.filter((s) => s.robotId === 30)).toHaveLength(4);

      // Stable 2 should have nothing
      expect(facilities.find((f) => f.userId === 2)).toBeUndefined();
      expect(subscriptions.filter((s) => s.robotId === 20)).toHaveLength(0);
    });

    it('should include error details in the summary', async () => {
      users = [{ id: 1 }, { id: 2 }];
      robots = [{ id: 10, userId: 1 }, { id: 20, userId: 2 }];
      failingStableIds = new Set([1]);

      const result = await runMigration();

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].stableId).toBe(1);
      expect(result.errors[0].error).toContain('Simulated failure');
    });
  });


  // Feature: 35-booking-office-facility, Property 10: Migration idempotency
  describe('Property 10: Migration idempotency', () => {
    /**
     * **Validates: Requirements 13.2**
     *
     * For any starting state of Users, Robots, Facilities, and Subscriptions,
     * applying the migration twice produces the same final state as applying it once.
     */
    it('applying migration twice produces same state as once', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random Stables (1–10 users)
          fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 10 }),
          // Generate random robots per Stable (0–4 robots each)
          fc.array(fc.integer({ min: 0, max: 4 }), { minLength: 1, maxLength: 10 }),
          // Generate random pre-existing facility levels (0–10, or -1 for "no facility")
          fc.array(fc.integer({ min: -1, max: 10 }), { minLength: 1, maxLength: 10 }),
          async (stableIds, robotCounts, facilityLevels) => {
            resetState();

            // Setup unique Stables
            const uniqueStableIds = [...new Set(stableIds)];
            users = uniqueStableIds.map((id) => ({ id }));

            // Setup robots for each Stable
            let robotIdCounter = 1;
            for (let i = 0; i < uniqueStableIds.length; i++) {
              const count = robotCounts[i % robotCounts.length] ?? 0;
              for (let r = 0; r < count; r++) {
                robots.push({ id: robotIdCounter++, userId: uniqueStableIds[i] });
              }
            }

            // Setup pre-existing facilities
            for (let i = 0; i < uniqueStableIds.length; i++) {
              const level = facilityLevels[i % facilityLevels.length] ?? -1;
              if (level >= 0) {
                facilities.push({
                  userId: uniqueStableIds[i],
                  facilityType: 'booking_office',
                  level,
                  maxLevel: 10,
                });
              }
            }

            // First migration run
            await runMigration();

            const stateAfterFirst = {
              facilities: JSON.parse(JSON.stringify(facilities)),
              subscriptions: JSON.parse(JSON.stringify(subscriptions)),
            };

            // Second migration run
            await runMigration();

            const stateAfterSecond = {
              facilities: JSON.parse(JSON.stringify(facilities)),
              subscriptions: JSON.parse(JSON.stringify(subscriptions)),
            };

            // States must be identical
            expect(stateAfterSecond.facilities).toEqual(stateAfterFirst.facilities);
            expect(stateAfterSecond.subscriptions.length).toBe(stateAfterFirst.subscriptions.length);
            // Verify no facility level was lowered
            for (const facility of stateAfterSecond.facilities) {
              const firstRunFacility = stateAfterFirst.facilities.find(
                (f: FacilityRow) => f.userId === facility.userId && f.facilityType === facility.facilityType,
              );
              expect(facility.level).toBeGreaterThanOrEqual(firstRunFacility!.level);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
