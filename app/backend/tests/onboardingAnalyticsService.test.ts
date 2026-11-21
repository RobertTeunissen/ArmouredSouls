import logger from '../src/config/logger';
import { recordEvents, OnboardingEventRecord } from '../src/services/analytics/onboardingAnalyticsService';

jest.mock('../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

describe('OnboardingAnalyticsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should log one line per event with the user id, step and metadata', () => {
    const batch: OnboardingEventRecord[] = [
      { eventType: 'step_started', timestamp: new Date().toISOString(), step: 1 },
      { eventType: 'strategy_selected', timestamp: new Date().toISOString(), step: 2, metadata: { strategy: '2_average' } },
    ];

    recordEvents(42, batch);

    expect(logger.info).toHaveBeenCalledTimes(2);
    expect(logger.info).toHaveBeenNthCalledWith(1, 'Onboarding analytics event', {
      userId: 42, eventType: 'step_started', step: 1, metadata: undefined,
    });
    expect(logger.info).toHaveBeenNthCalledWith(2, 'Onboarding analytics event', {
      userId: 42, eventType: 'strategy_selected', step: 2, metadata: { strategy: '2_average' },
    });
  });
});
