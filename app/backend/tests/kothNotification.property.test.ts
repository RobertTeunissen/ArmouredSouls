import * as fc from 'fast-check';
import { buildSuccessMessage } from '../src/services/notifications/notification-service';
import { JobContext } from '../src/services/notifications/integration';

describe('Property 29: KotH notification dispatched only when matches were executed', () => {
  const APP_BASE_URL = 'https://example.com';

  it('should return a message when matchesCompleted > 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),
        (matchesCompleted) => {
          const context: JobContext = { jobName: 'koth', matchesCompleted };
          const message = buildSuccessMessage(context, APP_BASE_URL);

          expect(message).not.toBeNull();
          expect(message).toContain('King of the Hill');
          expect(message).toContain('👑');
          expect(message).toContain(`${matchesCompleted} matches completed`);
          expect(message).toContain(APP_BASE_URL);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should return null when matchesCompleted is 0', () => {
    const context: JobContext = { jobName: 'koth', matchesCompleted: 0 };
    const message = buildSuccessMessage(context, APP_BASE_URL);
    expect(message).toBeNull();
  });

  it('should return null when matchesCompleted is undefined', () => {
    const context: JobContext = { jobName: 'koth' };
    const message = buildSuccessMessage(context, APP_BASE_URL);
    expect(message).toBeNull();
  });

  it('existing job types still produce correct messages', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('league', 'settlement') as fc.Arbitrary<'league' | 'settlement'>,
        (jobName) => {
          const context: JobContext = { jobName };
          const message = buildSuccessMessage(context, APP_BASE_URL);
          expect(message).not.toBeNull();
          expect(message).toContain(APP_BASE_URL);
        },
      ),
      { numRuns: 100 },
    );
  });
});
