import {
  recordEvents,
  getEvents,
  getSummary,
  clearEvents,
  OnboardingAnalyticsEvent,
} from '../src/services/analytics/onboardingAnalyticsService';

// Silence logger output during tests
jest.mock('../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe('OnboardingAnalyticsService', () => {
  beforeEach(() => {
    clearEvents();
  });

  afterAll(() => {
    clearEvents();
  });

  describe('recordEvents', () => {
    it('should store events with userId and receivedAt', () => {
      const batch: OnboardingAnalyticsEvent[] = [
        { eventType: 'step_started', timestamp: new Date().toISOString(), step: 1 },
      ];

      recordEvents(42, batch);

      const stored = getEvents();
      expect(stored).toHaveLength(1);
      expect(stored[0].userId).toBe(42);
      expect(stored[0].eventType).toBe('step_started');
      expect(stored[0].step).toBe(1);
      expect(stored[0].receivedAt).toBeInstanceOf(Date);
    });

    it('should store multiple events in a single batch', () => {
      const batch: OnboardingAnalyticsEvent[] = [
        { eventType: 'step_started', timestamp: new Date().toISOString(), step: 1 },
        { eventType: 'step_completed', timestamp: new Date().toISOString(), step: 1, metadata: { durationMs: 5000 } },
        { eventType: 'step_started', timestamp: new Date().toISOString(), step: 2 },
      ];

      recordEvents(10, batch);

      expect(getEvents()).toHaveLength(3);
    });

    it('should preserve metadata', () => {
      recordEvents(1, [
        {
          eventType: 'strategy_selected',
          timestamp: new Date().toISOString(),
          step: 2,
          metadata: { strategy: '2_average' },
        },
      ]);

      const stored = getEvents();
      expect(stored[0].metadata).toEqual({ strategy: '2_average' });
    });

    it('should cap stored events at MAX_STORED_EVENTS', () => {
      // Record more than 10,000 events
      const largeBatch: OnboardingAnalyticsEvent[] = [];
      for (let i = 0; i < 10_050; i++) {
        largeBatch.push({ eventType: 'step_started', timestamp: new Date().toISOString(), step: 1 });
      }

      recordEvents(1, largeBatch);

      expect(getEvents().length).toBeLessThanOrEqual(10_000);
    });
  });

  describe('getEvents', () => {
    it('should return all events when no userId filter', () => {
      recordEvents(1, [{ eventType: 'step_started', timestamp: new Date().toISOString(), step: 1 }]);
      recordEvents(2, [{ eventType: 'step_started', timestamp: new Date().toISOString(), step: 1 }]);

      expect(getEvents()).toHaveLength(2);
    });

    it('should filter by userId when provided', () => {
      recordEvents(1, [{ eventType: 'step_started', timestamp: new Date().toISOString(), step: 1 }]);
      recordEvents(2, [{ eventType: 'step_started', timestamp: new Date().toISOString(), step: 1 }]);
      recordEvents(1, [{ eventType: 'step_completed', timestamp: new Date().toISOString(), step: 1 }]);

      expect(getEvents(1)).toHaveLength(2);
      expect(getEvents(2)).toHaveLength(1);
      expect(getEvents(999)).toHaveLength(0);
    });
  });

  describe('getSummary', () => {
    it('should return zeros for empty store', () => {
      const summary = getSummary();
      expect(summary.totalEvents).toBe(0);
      expect(summary.uniqueUsers).toBe(0);
      expect(summary.completions).toBe(0);
      expect(summary.skips).toBe(0);
      expect(summary.stepCompletionCounts).toEqual({});
    });

    it('should count unique users correctly', () => {
      recordEvents(1, [{ eventType: 'step_started', timestamp: new Date().toISOString() }]);
      recordEvents(2, [{ eventType: 'step_started', timestamp: new Date().toISOString() }]);
      recordEvents(1, [{ eventType: 'step_completed', timestamp: new Date().toISOString() }]);

      expect(getSummary().uniqueUsers).toBe(2);
    });

    it('should count completions and skips', () => {
      recordEvents(1, [{ eventType: 'tutorial_completed', timestamp: new Date().toISOString(), step: 9 }]);
      recordEvents(2, [{ eventType: 'tutorial_skipped', timestamp: new Date().toISOString(), step: 3 }]);
      recordEvents(3, [{ eventType: 'tutorial_completed', timestamp: new Date().toISOString(), step: 9 }]);

      const summary = getSummary();
      expect(summary.completions).toBe(2);
      expect(summary.skips).toBe(1);
    });

    it('should track step completion counts', () => {
      recordEvents(1, [
        { eventType: 'step_completed', timestamp: new Date().toISOString(), step: 1 },
        { eventType: 'step_completed', timestamp: new Date().toISOString(), step: 2 },
        { eventType: 'step_completed', timestamp: new Date().toISOString(), step: 3 },
      ]);
      recordEvents(2, [
        { eventType: 'step_completed', timestamp: new Date().toISOString(), step: 1 },
        { eventType: 'step_completed', timestamp: new Date().toISOString(), step: 2 },
      ]);

      const summary = getSummary();
      expect(summary.stepCompletionCounts).toEqual({ 1: 2, 2: 2, 3: 1 });
    });
  });

  describe('clearEvents', () => {
    it('should remove all stored events', () => {
      recordEvents(1, [{ eventType: 'step_started', timestamp: new Date().toISOString() }]);
      expect(getEvents()).toHaveLength(1);

      clearEvents();
      expect(getEvents()).toHaveLength(0);
    });
  });
});
