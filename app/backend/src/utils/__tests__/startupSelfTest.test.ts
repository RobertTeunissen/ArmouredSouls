/* eslint-disable @typescript-eslint/no-require-imports */
import { runStartupSelfTest } from '../startupSelfTest';

jest.mock('../../config/logger', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock('../monitoringWebhook', () => ({
  sendMonitoringAlert: jest.fn().mockResolvedValue(true),
}));

jest.mock('../systemHealth', () => ({
  CRITICAL_MODULES: [
    './fake-module-that-exists',
    './fake-module-that-does-not-exist',
  ],
}));

describe('runStartupSelfTest', () => {
  let mockSendAlert: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSendAlert = require('../monitoringWebhook').sendMonitoringAlert;
  });

  it('should return passed=false with failed module details when a module is missing', async () => {
    // The mocked CRITICAL_MODULES includes a non-existent module
    const result = await runStartupSelfTest();

    // At least one module won't resolve
    expect(result.passed).toBe(false);
    expect(result.failedModules.length).toBeGreaterThan(0);
    expect(result.failedModules[0]).toHaveProperty('path');
    expect(result.failedModules[0]).toHaveProperty('error');
  });

  it('should call sendMonitoringAlert with failure message when modules are missing', async () => {
    await runStartupSelfTest();

    expect(mockSendAlert).toHaveBeenCalledTimes(1);
    expect(mockSendAlert).toHaveBeenCalledWith(
      expect.stringContaining('STARTUP FAILED')
    );
  });

  it('should complete within 5 seconds', async () => {
    const start = Date.now();
    await runStartupSelfTest();
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(5000);
  });
});

describe('runStartupSelfTest — all modules pass', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('should return passed=true when all modules resolve', async () => {
    // Re-mock with modules that actually exist
    jest.doMock('../systemHealth', () => ({
      CRITICAL_MODULES: [
        // Use a module we know exists in the test environment
        '../config/logger',
      ],
    }));
    jest.doMock('../../config/logger', () => ({
      __esModule: true,
      default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
    }));
    jest.doMock('../monitoringWebhook', () => ({
      sendMonitoringAlert: jest.fn().mockResolvedValue(true),
    }));

    const { runStartupSelfTest: freshTest } = require('../startupSelfTest');
    const result = await freshTest();

    expect(result.passed).toBe(true);
    expect(result.failedModules).toHaveLength(0);
    expect(result.resolvedModules.length).toBeGreaterThan(0);
  });

  it('should not call sendMonitoringAlert when all modules pass', async () => {
    jest.doMock('../systemHealth', () => ({
      CRITICAL_MODULES: ['../config/logger'],
    }));
    jest.doMock('../../config/logger', () => ({
      __esModule: true,
      default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
    }));
    const mockAlert = jest.fn().mockResolvedValue(true);
    jest.doMock('../monitoringWebhook', () => ({
      sendMonitoringAlert: mockAlert,
    }));

    const { runStartupSelfTest: freshTest } = require('../startupSelfTest');
    await freshTest();

    expect(mockAlert).not.toHaveBeenCalled();
  });
});
