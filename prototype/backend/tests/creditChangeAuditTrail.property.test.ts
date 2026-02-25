import prisma from '../src/lib/prisma';
import { EventLogger } from '../src/services/eventLogger';
import fc from 'fast-check';

const eventLogger = new EventLogger();

/**
 * Property 3: Credit Change Audit Trail
 * 
 * For any user, the sum of all credit change events in the audit log for a given cycle
 * should equal the difference between the user's starting and ending balance for that cycle.
 * 
 * Validates: Requirements 9.4
 */
describe('Property 3: Credit Change Audit Trail', () => {
  beforeEach(async () => {
    // Clean up test data
    await prisma.auditLog.deleteMany({});
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  /**
   * Property 3.1: Sum of credit changes equals balance delta
   * 
   * For any sequence of credit changes, the sum should equal the difference
   * between starting and ending balance.
   */
  it('sum of credit changes equals balance delta', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 1000 }), // userId
        fc.integer({ min: 1, max: 100 }), // cycleNumber
        fc.integer({ min: 0, max: 100000 }), // startingBalance
        fc.array(
          fc.integer({ min: -10000, max: 10000 }), // credit changes
          { minLength: 1, maxLength: 20 }
        ),
        async (userId, cycleNumber, startingBalance, creditChanges) => {
          // Cleanup for this iteration
          await prisma.auditLog.deleteMany({
            where: { cycleNumber, userId },
          });

          // Setup: Log all credit changes
          let currentBalance = startingBalance;
          for (const change of creditChanges) {
            currentBalance += change;
            const source = change > 0 ? 'battle' : 'repair';
            await eventLogger.logCreditChange(
              cycleNumber,
              userId,
              change,
              currentBalance,
              source
            );
          }

          // Verify: Sum of changes equals balance delta
          const events = await prisma.auditLog.findMany({
            where: {
              cycleNumber,
              userId,
              eventType: 'credit_change',
            },
          });

          const sumOfChanges = events.reduce((sum, e) => {
            const payload = e.payload as any;
            return sum + payload.amount;
          }, 0);

          const expectedDelta = currentBalance - startingBalance;

          expect(sumOfChanges).toBe(expectedDelta);
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property 3.2: Credit changes are recorded in order
   * 
   * For any sequence of credit changes, they should be recorded in the order
   * they occurred (sequence numbers should be monotonically increasing).
   */
  it('credit changes are recorded in order', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 1000 }), // userId
        fc.integer({ min: 1, max: 100 }), // cycleNumber
        fc.integer({ min: 0, max: 100000 }), // startingBalance
        fc.array(
          fc.integer({ min: -5000, max: 5000 }),
          { minLength: 2, maxLength: 15 }
        ),
        async (userId, cycleNumber, startingBalance, creditChanges) => {
          // Cleanup for this iteration
          await prisma.auditLog.deleteMany({
            where: { cycleNumber, userId },
          });

          // Setup: Log credit changes
          let currentBalance = startingBalance;
          for (const change of creditChanges) {
            currentBalance += change;
            await eventLogger.logCreditChange(
              cycleNumber,
              userId,
              change,
              currentBalance,
              'battle'
            );
          }

          // Verify: Sequence numbers are monotonically increasing
          const events = await prisma.auditLog.findMany({
            where: {
              cycleNumber,
              userId,
              eventType: 'credit_change',
            },
            orderBy: { sequenceNumber: 'asc' },
          });

          for (let i = 1; i < events.length; i++) {
            expect(events[i].sequenceNumber).toBeGreaterThan(
              events[i - 1].sequenceNumber
            );
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property 3.3: Balance progression is continuous
   * 
   * For any sequence of credit changes, each event's newBalance should equal
   * the previous event's newBalance plus the current change amount.
   */
  it('balance progression is continuous', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 1000 }), // userId
        fc.integer({ min: 1, max: 100 }), // cycleNumber
        fc.integer({ min: 10000, max: 100000 }), // startingBalance (ensure positive)
        fc.array(
          fc.integer({ min: -1000, max: 1000 }),
          { minLength: 2, maxLength: 10 }
        ),
        async (userId, cycleNumber, startingBalance, creditChanges) => {
          // Cleanup for this iteration
          await prisma.auditLog.deleteMany({
            where: { cycleNumber, userId },
          });

          // Setup: Log credit changes
          let currentBalance = startingBalance;
          for (const change of creditChanges) {
            currentBalance += change;
            await eventLogger.logCreditChange(
              cycleNumber,
              userId,
              change,
              currentBalance,
              'battle'
            );
          }

          // Verify: Balance progression is continuous
          const events = await prisma.auditLog.findMany({
            where: {
              cycleNumber,
              userId,
              eventType: 'credit_change',
            },
            orderBy: { sequenceNumber: 'asc' },
          });

          for (let i = 1; i < events.length; i++) {
            const prevPayload = events[i - 1].payload as any;
            const currPayload = events[i].payload as any;

            const expectedBalance = prevPayload.newBalance + currPayload.amount;
            expect(currPayload.newBalance).toBe(expectedBalance);
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property 3.4: Multiple users tracked independently
   * 
   * For any set of users, credit changes for each user should be tracked
   * independently without interference.
   */
  it('multiple users tracked independently', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100 }), // cycleNumber
        fc.array(
          fc.record({
            userId: fc.integer({ min: 1, max: 100 }),
            startingBalance: fc.integer({ min: 0, max: 50000 }),
            changes: fc.array(
              fc.integer({ min: -1000, max: 1000 }),
              { minLength: 1, maxLength: 5 }
            ),
          }),
          { minLength: 2, maxLength: 5 }
        ),
        async (cycleNumber, users) => {
          // Cleanup for this iteration
          await prisma.auditLog.deleteMany({
            where: { cycleNumber },
          });

          // Setup: Log credit changes for all users
          const expectedDeltas = new Map<number, number>();

          for (const user of users) {
            let currentBalance = user.startingBalance;
            let totalChange = 0;

            for (const change of user.changes) {
              currentBalance += change;
              totalChange += change;
              await eventLogger.logCreditChange(
                cycleNumber,
                user.userId,
                change,
                currentBalance,
                'battle'
              );
            }

            // Accumulate changes for duplicate userIds
            const existing = expectedDeltas.get(user.userId) || 0;
            expectedDeltas.set(user.userId, existing + totalChange);
          }

          // Verify: Each user's credit changes sum correctly
          for (const [userId, expectedDelta] of expectedDeltas.entries()) {
            const events = await prisma.auditLog.findMany({
              where: {
                cycleNumber,
                userId,
                eventType: 'credit_change',
              },
            });

            const sumOfChanges = events.reduce((sum, e) => {
              const payload = e.payload as any;
              return sum + payload.amount;
            }, 0);

            expect(sumOfChanges).toBe(expectedDelta);
          }
        }
      ),
      { numRuns: 25 }
    );
  });

  /**
   * Property 3.5: Credit changes across multiple cycles
   * 
   * For any user across multiple cycles, credit changes in each cycle
   * should be tracked independently.
   */
  it('credit changes across multiple cycles', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100 }), // userId
        fc.array(
          fc.record({
            cycleNumber: fc.integer({ min: 1, max: 50 }),
            startingBalance: fc.integer({ min: 0, max: 50000 }),
            changes: fc.array(
              fc.integer({ min: -1000, max: 1000 }),
              { minLength: 1, maxLength: 5 }
            ),
          }),
          { minLength: 2, maxLength: 5 }
        ),
        async (userId, cycles) => {
          // Cleanup for this iteration
          await prisma.auditLog.deleteMany({
            where: { userId },
          });

          // Setup: Log credit changes for all cycles
          const expectedDeltas = new Map<number, number>();

          for (const cycle of cycles) {
            let currentBalance = cycle.startingBalance;
            let totalChange = 0;

            for (const change of cycle.changes) {
              currentBalance += change;
              totalChange += change;
              await eventLogger.logCreditChange(
                cycle.cycleNumber,
                userId,
                change,
                currentBalance,
                'battle'
              );
            }

            // Accumulate changes for duplicate cycleNumbers
            const existing = expectedDeltas.get(cycle.cycleNumber) || 0;
            expectedDeltas.set(cycle.cycleNumber, existing + totalChange);
          }

          // Verify: Each cycle's credit changes sum correctly
          for (const [cycleNumber, expectedDelta] of expectedDeltas.entries()) {
            const events = await prisma.auditLog.findMany({
              where: {
                cycleNumber,
                userId,
                eventType: 'credit_change',
              },
            });

            const sumOfChanges = events.reduce((sum, e) => {
              const payload = e.payload as any;
              return sum + payload.amount;
            }, 0);

            expect(sumOfChanges).toBe(expectedDelta);
          }
        }
      ),
      { numRuns: 25 }
    );
  });

  /**
   * Property 3.6: Credit source is preserved
   * 
   * For any credit change, the source should be correctly recorded and retrievable.
   */
  it('credit source is preserved', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 1000 }), // userId
        fc.integer({ min: 1, max: 100 }), // cycleNumber
        fc.integer({ min: 0, max: 100000 }), // startingBalance
        fc.array(
          fc.record({
            amount: fc.integer({ min: -5000, max: 5000 }),
            source: fc.constantFrom(
              'battle',
              'passive_income',
              'facility_purchase',
              'repair',
              'weapon_purchase',
              'other'
            ),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (userId, cycleNumber, startingBalance, changes) => {
          // Cleanup for this iteration
          await prisma.auditLog.deleteMany({
            where: { cycleNumber, userId },
          });

          // Setup: Log credit changes with different sources
          let currentBalance = startingBalance;
          for (const change of changes) {
            currentBalance += change.amount;
            await eventLogger.logCreditChange(
              cycleNumber,
              userId,
              change.amount,
              currentBalance,
              change.source as any
            );
          }

          // Verify: Sources are correctly recorded
          const events = await prisma.auditLog.findMany({
            where: {
              cycleNumber,
              userId,
              eventType: 'credit_change',
            },
            orderBy: { sequenceNumber: 'asc' },
          });

          expect(events.length).toBe(changes.length);

          for (let i = 0; i < events.length; i++) {
            const payload = events[i].payload as any;
            expect(payload.source).toBe(changes[i].source);
            expect(payload.amount).toBe(changes[i].amount);
          }
        }
      ),
      { numRuns: 25 }
    );
  });
});
