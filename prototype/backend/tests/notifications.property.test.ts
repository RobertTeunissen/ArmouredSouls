import * as fc from 'fast-check';
import { buildSuccessMessage, buildErrorMessage, dispatchNotification } from '../src/services/notifications/notification-service';
import { Integration, NotificationResult, JobContext, JobName } from '../src/services/notifications/integration';

// Mock logger to avoid side effects
jest.mock('../src/config/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

const EMOJI_MAP: Record<string, string> = {
  league: '🏆',
  tournament: '⚔️',
  'tag-team': '🤝',
  settlement: '💰',
};

const NUM_RUNS = 100;

describe('Notification Service Property Tests', () => {
  // =========================================================================
  // Property 1: Success message contains job-specific emoji and base URL
  // =========================================================================
  describe('Property 1: Success message contains job-specific emoji and base URL', () => {
    /**
     * **Validates: Requirements 1.1, 1.3, 1.5, 1.6**
     *
     * For any job type in {league, tournament, tag-team (odd cycle), settlement}
     * and for any non-empty base URL string, buildSuccessMessage should return
     * a non-null string that contains both the job's designated emoji and the base URL.
     */

    const leagueContextArb: fc.Arbitrary<JobContext> = fc.constant({
      jobName: 'league' as JobName,
    });

    const tournamentContextArb: fc.Arbitrary<JobContext> = fc.record({
      jobName: fc.constant('tournament' as JobName),
      tournamentName: fc.string({ minLength: 1, maxLength: 50 }),
      tournamentRound: fc.integer({ min: 1, max: 20 }),
      tournamentMaxRounds: fc.integer({ min: 1, max: 20 }),
    }).chain((ctx) =>
      fc.constant({
        ...ctx,
        tournamentRound: Math.min(ctx.tournamentRound, ctx.tournamentMaxRounds),
      })
    );

    const tagTeamOddCycleContextArb: fc.Arbitrary<JobContext> = fc.constant({
      jobName: 'tag-team' as JobName,
      isEvenCycle: false,
    });

    const settlementContextArb: fc.Arbitrary<JobContext> = fc.constant({
      jobName: 'settlement' as JobName,
    });

    const jobContextArb: fc.Arbitrary<JobContext> = fc.oneof(
      leagueContextArb,
      tournamentContextArb,
      tagTeamOddCycleContextArb,
      settlementContextArb
    );

    const baseUrlArb: fc.Arbitrary<string> = fc.webUrl();

    test('should return non-null string containing the correct emoji for the job type', () => {
      fc.assert(
        fc.property(jobContextArb, baseUrlArb, (context, baseUrl) => {
          const result = buildSuccessMessage(context, baseUrl);

          expect(result).not.toBeNull();

          const expectedEmoji = EMOJI_MAP[context.jobName];
          expect(result).toContain(expectedEmoji);
        }),
        { numRuns: NUM_RUNS }
      );
    });

    test('should return non-null string containing the base URL', () => {
      fc.assert(
        fc.property(jobContextArb, baseUrlArb, (context, baseUrl) => {
          const result = buildSuccessMessage(context, baseUrl);

          expect(result).not.toBeNull();
          expect(result).toContain(baseUrl);
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  // =========================================================================
  // Property 2: Tournament message contains name and round info
  // =========================================================================
  describe('Property 2: Tournament message contains name and round info', () => {
    /**
     * **Validates: Requirements 1.2**
     *
     * For any tournament name string, for any round number (1 ≤ round ≤ maxRounds),
     * and for any non-empty base URL, buildSuccessMessage with a tournament job context
     * should return a string containing the tournament name, the round number,
     * the max rounds number, and the ⚔️ emoji.
     */

    const tournamentContextArb = fc
      .record({
        tournamentName: fc.string({ minLength: 1, maxLength: 100 }),
        tournamentMaxRounds: fc.integer({ min: 1, max: 20 }),
      })
      .chain(({ tournamentName, tournamentMaxRounds }) =>
        fc.record({
          jobName: fc.constant('tournament' as JobName),
          tournamentName: fc.constant(tournamentName),
          tournamentRound: fc.integer({ min: 1, max: tournamentMaxRounds }),
          tournamentMaxRounds: fc.constant(tournamentMaxRounds),
        })
      );

    const baseUrlArb = fc.webUrl();

    test('should return non-null string containing tournament name, round, maxRounds, and ⚔️ emoji', () => {
      fc.assert(
        fc.property(tournamentContextArb, baseUrlArb, (context, baseUrl) => {
          const result = buildSuccessMessage(context, baseUrl);

          expect(result).not.toBeNull();
          expect(result).toContain(context.tournamentName);
          expect(result).toContain(String(context.tournamentRound));
          expect(result).toContain(String(context.tournamentMaxRounds));
          expect(result).toContain('⚔️');
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  // =========================================================================
  // Property 3: Tag team even cycle produces no message
  // =========================================================================
  describe('Property 3: Tag team even cycle produces no message', () => {
    /**
     * **Validates: Requirements 1.4**
     *
     * For any job context where jobName is 'tag-team' and isEvenCycle is true,
     * and for any base URL, buildSuccessMessage should return null.
     */

    const tagTeamEvenCycleContext: JobContext = {
      jobName: 'tag-team' as JobName,
      isEvenCycle: true,
    };

    const baseUrlArb = fc.webUrl();

    test('should return null for tag-team job on even cycle', () => {
      fc.assert(
        fc.property(baseUrlArb, (baseUrl) => {
          const result = buildSuccessMessage(tagTeamEvenCycleContext, baseUrl);

          expect(result).toBeNull();
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  // =========================================================================
  // Property 4: Error message contains job name and base URL
  // =========================================================================
  describe('Property 4: Error message contains job name and base URL', () => {
    /**
     * **Validates: Requirements 2.1**
     *
     * For any job name string and for any non-empty base URL,
     * buildErrorMessage should return a string containing the job name,
     * the ⚠️ emoji, and the base URL.
     */

    const jobNameArb = fc.string({ minLength: 1, maxLength: 50 });
    const baseUrlArb = fc.webUrl();

    test('should return string containing the job name, ⚠️ emoji, and base URL', () => {
      fc.assert(
        fc.property(jobNameArb, baseUrlArb, (jobName, baseUrl) => {
          const result = buildErrorMessage(jobName, baseUrl);

          expect(result).toContain(jobName);
          expect(result).toContain('⚠️');
          expect(result).toContain(baseUrl);
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  // =========================================================================
  // Property 5: Notification dispatch is failure-isolated
  // =========================================================================
  describe('Property 5: Notification dispatch is failure-isolated', () => {
    /**
     * **Validates: Requirements 2.2, 4.3**
     *
     * For any message string and for any list of integrations (where zero or more
     * may throw errors), dispatchNotification should never throw and should return
     * a NotificationResult array with length equal to the number of integrations.
     */

    const messageArb = fc.string({ minLength: 0, maxLength: 200 });

    const shouldFailArrayArb = fc.array(fc.boolean(), { minLength: 0, maxLength: 10 });

    function buildMockIntegrations(shouldFailFlags: boolean[]): Integration[] {
      return shouldFailFlags.map((shouldFail, index) => ({
        name: `mock-${index}`,
        send: async (_message: string): Promise<NotificationResult> => {
          if (shouldFail) {
            throw new Error(`mock-${index} failed`);
          }
          return { success: true, integrationName: `mock-${index}` };
        },
      }));
    }

    test('should never throw and return results array with length equal to number of integrations', async () => {
      await fc.assert(
        fc.asyncProperty(messageArb, shouldFailArrayArb, async (message, shouldFailFlags) => {
          const integrations = buildMockIntegrations(shouldFailFlags);

          const results = await dispatchNotification(message, integrations);

          expect(results).toHaveLength(integrations.length);
          results.forEach((result) => {
            expect(result).toHaveProperty('success');
            expect(result).toHaveProperty('integrationName');
          });
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });

  // =========================================================================
  // Property 6: Dispatch calls every registered integration
  // =========================================================================
  describe('Property 6: Dispatch calls every registered integration', () => {
    /**
     * **Validates: Requirements 4.2, 4.3**
     *
     * For any message string and for any list of N integrations (where some may fail),
     * dispatchNotification should invoke send() on all N integrations and return
     * exactly N results, regardless of individual failures.
     */

    const messageArb = fc.string({ minLength: 0, maxLength: 200 });

    const shouldFailArrayArb = fc.array(fc.boolean(), { minLength: 1, maxLength: 10 });

    test('should call send() on every integration and return exactly N results', async () => {
      await fc.assert(
        fc.asyncProperty(messageArb, shouldFailArrayArb, async (message, shouldFailFlags) => {
          const spies: jest.Mock[] = [];

          const integrations: Integration[] = shouldFailFlags.map((shouldFail, index) => {
            const spy = jest.fn<Promise<NotificationResult>, [string]>().mockImplementation(
              async (_msg: string): Promise<NotificationResult> => {
                if (shouldFail) {
                  throw new Error(`mock-${index} failed`);
                }
                return { success: true, integrationName: `mock-${index}` };
              }
            );
            spies.push(spy);
            return { name: `mock-${index}`, send: spy };
          });

          const results = await dispatchNotification(message, integrations);

          // Every integration's send() must have been called exactly once
          spies.forEach((spy, index) => {
            expect(spy).toHaveBeenCalledTimes(1);
            expect(spy).toHaveBeenCalledWith(message);
          });

          // Exactly N results returned
          expect(results).toHaveLength(shouldFailFlags.length);
        }),
        { numRuns: NUM_RUNS }
      );
    });
  });
});
