/* eslint-disable @typescript-eslint/no-require-imports */
import { generateHealthReport } from '../dailyHealthReport';

jest.mock('../../../config/logger', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock('../../../utils/monitoringWebhook', () => ({
  sendMonitoringAlert: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    cycleMetadata: {
      findUnique: jest.fn().mockResolvedValue({
        totalCycles: 164,
        lastCycleAt: new Date('2026-05-03T23:00:00Z'),
      }),
    },
  },
}));

jest.mock('../../cycle/cycleScheduler', () => ({
  getSchedulerState: jest.fn().mockReturnValue({
    active: true,
    runningJob: null,
    queue: [],
    jobs: [
      {
        name: 'settlement',
        lastRunAt: new Date('2026-05-03T23:00:00Z'),
        lastRunStatus: 'success',
        lastRunDurationMs: 5000,
        lastError: null,
      },
    ],
  }),
}));

const mockGetDiskUsage = jest.fn();
const mockGetMemoryUsage = jest.fn();
const mockCheckCriticalModules = jest.fn();

jest.mock('../../../utils/systemHealth', () => ({
  getDiskUsage: (...args: unknown[]) => mockGetDiskUsage(...args),
  getMemoryUsage: (...args: unknown[]) => mockGetMemoryUsage(...args),
  checkCriticalModules: (...args: unknown[]) => mockCheckCriticalModules(...args),
  CRITICAL_MODULES: [],
}));

jest.mock('fs', () => ({
  statSync: jest.fn().mockReturnValue({
    mtime: new Date(Date.now() - 2 * 60 * 1000), // 2 minutes ago
  }),
}));

describe('generateHealthReport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDiskUsage.mockReturnValue({ usagePercent: 62, availableMB: 7782, status: 'ok' });
    mockGetMemoryUsage.mockReturnValue({ usedMB: 1420, totalMB: 2000, usagePercent: 71 });
    mockCheckCriticalModules.mockReturnValue({ status: 'ok', missing: [] });
  });

  it('should format healthy message correctly when all checks pass', async () => {
    const message = await generateHealthReport();

    expect(message).toContain('Daily Health Report');
    expect(message).toContain('All systems operational');
    expect(message).toContain('Uptime:');
    expect(message).toContain('62% used');
    expect(message).toContain('OK');
    expect(message).toContain('Database: Connected');
    expect(message).toContain('Modules: All verified');
    expect(message).toContain('Logging: Active');
  });

  it('should format degraded message when disk is warning', async () => {
    mockGetDiskUsage.mockReturnValue({ usagePercent: 84, availableMB: 3200, status: 'warning' });

    const message = await generateHealthReport();

    expect(message).toContain('Daily Health Report');
    expect(message).toContain('Degraded');
    expect(message).toContain('84% used');
    expect(message).toContain('WARNING');
  });

  it('should format degraded message when DB is disconnected', async () => {
    const prisma = require('../../../lib/prisma').default;
    prisma.$queryRaw.mockRejectedValueOnce(new Error('Connection refused'));

    const message = await generateHealthReport();

    expect(message).toContain('Degraded');
    expect(message).toContain('DISCONNECTED');
  });

  it('should format degraded message when logging is stale', async () => {
    const fs = require('fs');
    fs.statSync.mockReturnValueOnce({
      mtime: new Date(Date.now() - 26 * 60 * 60 * 1000), // 26 hours ago
    });

    const message = await generateHealthReport();

    expect(message).toContain('Degraded');
    expect(message).toContain('STALE');
  });

  it('should include uptime, disk, memory, DB, modules, logging, and cycle info', async () => {
    const message = await generateHealthReport();

    expect(message).toContain('Uptime:');
    expect(message).toContain('Disk:');
    expect(message).toContain('Memory:');
    expect(message).toContain('Database:');
    expect(message).toContain('Modules:');
    expect(message).toContain('Logging:');
    expect(message).toContain('cycle');
  });

  it('should handle missing log file gracefully (dev environment)', async () => {
    const fs = require('fs');
    fs.statSync.mockImplementationOnce(() => {
      throw new Error('ENOENT: no such file or directory');
    });

    const message = await generateHealthReport();

    // Should not throw, should still produce a report
    expect(message).toContain('Daily Health Report');
    expect(message).toContain('N/A (dev)');
  });

  it('should include modules degraded info when modules are missing', async () => {
    mockCheckCriticalModules.mockReturnValue({
      status: 'degraded',
      missing: ['../services/cycle/cycleScheduler'],
    });

    const message = await generateHealthReport();

    expect(message).toContain('⚠️ Daily Health Report — Degraded');
    expect(message).toContain('DEGRADED');
    expect(message).toContain('cycleScheduler');
  });
});
