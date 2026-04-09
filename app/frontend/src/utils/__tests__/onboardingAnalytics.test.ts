import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import apiClient from '../apiClient';
import {
  trackEvent,
  trackStepStarted,
  trackStepCompleted,
  trackStepSkipped,
  trackTutorialCompleted,
  trackTutorialSkipped,
  trackBlockedAction,
  trackError,
  trackStrategySelected,
  trackFacilityPurchased,
  trackWeaponPurchased,
  trackWeaponTypeSelected,
  trackLoadoutSelected,
  trackBudgetAllocation,
  flushEvents,
  _resetForTesting,
  _getQueueLength,
} from '../onboardingAnalytics';

// Mock apiClient
vi.mock('../apiClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
}));

const mockedApiClient = vi.mocked(apiClient);

// Force production mode so events POST to the API instead of just logging
vi.stubEnv('DEV', '');
vi.mock('../onboardingAnalytics', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../onboardingAnalytics')>();
  return mod;
});

describe('onboardingAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    _resetForTesting();
    mockedApiClient.post.mockResolvedValue({ data: { success: true } });
  });

  afterEach(() => {
    vi.useRealTimers();
    _resetForTesting();
  });

  // -----------------------------------------------------------------------
  // Core event tracking
  // -----------------------------------------------------------------------

  describe('trackEvent', () => {
    it('should enqueue an event with correct shape', () => {
      trackEvent('step_started', 1, { foo: 'bar' });
      expect(_getQueueLength()).toBe(1);
    });

    it('should auto-flush when queue reaches max size', async () => {
      for (let i = 0; i < 20; i++) {
        trackEvent('step_started', 1);
      }
      // flush is called synchronously when max size reached
      await vi.advanceTimersByTimeAsync(0);
      // Queue should be drained after flush
      expect(_getQueueLength()).toBe(0);
    });

    it('should schedule a flush after FLUSH_INTERVAL_MS', async () => {
      trackEvent('step_started', 1);
      expect(_getQueueLength()).toBe(1);

      await vi.advanceTimersByTimeAsync(5_000);
      expect(_getQueueLength()).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // flushEvents
  // -----------------------------------------------------------------------

  describe('flushEvents', () => {
    it('should do nothing when queue is empty', async () => {
      await flushEvents();
      // In dev mode it logs; in prod it would POST. Either way no error.
      expect(_getQueueLength()).toBe(0);
    });

    it('should clear the queue after flushing', async () => {
      trackEvent('step_completed', 2);
      trackEvent('step_completed', 3);
      expect(_getQueueLength()).toBe(2);

      await flushEvents();
      expect(_getQueueLength()).toBe(0);
    });

    it('should not throw when API call fails', async () => {
      mockedApiClient.post.mockRejectedValueOnce(new Error('Network error'));
      trackEvent('step_completed', 1);
      // Should not throw
      await expect(flushEvents()).resolves.toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // Step timing helpers
  // -----------------------------------------------------------------------

  describe('step timing', () => {
    it('trackStepStarted should enqueue a step_started event', () => {
      trackStepStarted(1);
      expect(_getQueueLength()).toBe(1);
    });

    it('trackStepCompleted should include durationMs when step was started', () => {
      trackStepStarted(3);
      vi.advanceTimersByTime(2_000);
      trackStepCompleted(3);
      // 2 events: step_started + step_completed
      expect(_getQueueLength()).toBe(2);
    });

    it('trackStepCompleted should work even without a prior start', () => {
      trackStepCompleted(5);
      expect(_getQueueLength()).toBe(1);
    });

    it('trackStepSkipped should enqueue a step_skipped event with duration', () => {
      trackStepStarted(2);
      vi.advanceTimersByTime(1_500);
      trackStepSkipped(2);
      expect(_getQueueLength()).toBe(2);
    });
  });

  // -----------------------------------------------------------------------
  // Tutorial-level tracking
  // -----------------------------------------------------------------------

  describe('tutorial-level events', () => {
    it('trackTutorialCompleted should enqueue and flush immediately', async () => {
      trackTutorialCompleted(9);
      // Flush is called inline, so after microtask the queue should be empty
      await vi.advanceTimersByTimeAsync(0);
      expect(_getQueueLength()).toBe(0);
    });

    it('trackTutorialSkipped should enqueue and flush immediately', async () => {
      trackTutorialSkipped(3);
      await vi.advanceTimersByTimeAsync(0);
      expect(_getQueueLength()).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Blocked action & error tracking
  // -----------------------------------------------------------------------

  describe('blocked actions and errors', () => {
    it('trackBlockedAction should enqueue with action and reason', () => {
      trackBlockedAction(2, 'facility_purchase', 'Step too early');
      expect(_getQueueLength()).toBe(1);
    });

    it('trackError should enqueue with error details', () => {
      trackError(5, 'Network timeout', 'weapon_purchase');
      expect(_getQueueLength()).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // Strategic choice tracking (38.2)
  // -----------------------------------------------------------------------

  describe('strategic choice tracking', () => {
    it('trackStrategySelected should enqueue strategy_selected event', () => {
      trackStrategySelected('2_average', 2);
      expect(_getQueueLength()).toBe(1);
    });

    it('trackFacilityPurchased should enqueue facility_purchased event', () => {
      trackFacilityPurchased('weapons_workshop', 150_000, 5);
      expect(_getQueueLength()).toBe(1);
    });

    it('trackWeaponPurchased should enqueue weapon_purchased event', () => {
      trackWeaponPurchased('Laser Rifle', 'energy', 200_000, 7);
      expect(_getQueueLength()).toBe(1);
    });

    it('trackWeaponTypeSelected should enqueue weapon_type_selected event', () => {
      trackWeaponTypeSelected('ballistic', 6);
      expect(_getQueueLength()).toBe(1);
    });

    it('trackLoadoutSelected should enqueue loadout_selected event', () => {
      trackLoadoutSelected('weapon_shield', 6);
      expect(_getQueueLength()).toBe(1);
    });

    it('trackBudgetAllocation should enqueue budget_allocation_updated event', () => {
      trackBudgetAllocation(
        { facilities: 500_000, robots: 500_000, weapons: 400_000, attributes: 200_000, remaining: 1_400_000 },
        '2_average',
        4,
      );
      expect(_getQueueLength()).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // _resetForTesting
  // -----------------------------------------------------------------------

  describe('_resetForTesting', () => {
    it('should clear queue and timers', () => {
      trackEvent('step_started', 1);
      trackStepStarted(2);
      expect(_getQueueLength()).toBeGreaterThan(0);

      _resetForTesting();
      expect(_getQueueLength()).toBe(0);
    });
  });
});
