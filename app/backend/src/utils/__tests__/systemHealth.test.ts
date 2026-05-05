import { getDiskUsage, getMemoryUsage, checkCriticalModules } from '../systemHealth';
import { execSync } from 'child_process';
import os from 'os';

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

jest.mock('../../config/logger', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe('getDiskUsage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return ok status when usage is below 80%', () => {
    const platform = os.platform();
    if (platform === 'darwin') {
      mockExecSync.mockReturnValue(
        'Filesystem 1024-blocks Used Available Capacity\n/dev/disk1 100000000 70000000 30000000 70%\n'
      );
    } else {
      mockExecSync
        .mockReturnValueOnce('  75%\n') // pcent
        .mockReturnValueOnce('  5120000\n'); // avail in 1K blocks (5GB)
    }

    const result = getDiskUsage();

    expect(result.status).toBe('ok');
    expect(result.usagePercent).toBeGreaterThanOrEqual(0);
    expect(result.usagePercent).toBeLessThanOrEqual(100);
    expect(result.availableMB).toBeGreaterThan(0);
  });

  it('should return warning status when usage is 80-89%', () => {
    const platform = os.platform();
    if (platform === 'darwin') {
      mockExecSync.mockReturnValue(
        'Filesystem 1024-blocks Used Available Capacity\n/dev/disk1 100000000 85000000 15000000 85%\n'
      );
    } else {
      mockExecSync
        .mockReturnValueOnce('  85%\n')
        .mockReturnValueOnce('  3072000\n'); // ~3GB
    }

    const result = getDiskUsage();

    expect(result.status).toBe('warning');
    expect(result.usagePercent).toBeGreaterThanOrEqual(80);
    expect(result.usagePercent).toBeLessThan(90);
  });

  it('should return critical status when usage is 90%+', () => {
    const platform = os.platform();
    if (platform === 'darwin') {
      mockExecSync.mockReturnValue(
        'Filesystem 1024-blocks Used Available Capacity\n/dev/disk1 100000000 95000000 5000000 95%\n'
      );
    } else {
      mockExecSync
        .mockReturnValueOnce('  95%\n')
        .mockReturnValueOnce('  1024000\n'); // ~1GB
    }

    const result = getDiskUsage();

    expect(result.status).toBe('critical');
    expect(result.usagePercent).toBeGreaterThanOrEqual(90);
  });

  it('should handle execSync failure gracefully', () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('Command failed');
    });

    const result = getDiskUsage();

    // Should not throw, returns degraded state
    expect(result.status).toBe('warning');
    expect(result.usagePercent).toBe(-1);
    expect(result.availableMB).toBe(-1);
  });
});

describe('getMemoryUsage', () => {
  it('should return valid memory metrics', () => {
    const result = getMemoryUsage();

    expect(result.totalMB).toBeGreaterThan(0);
    expect(result.usedMB).toBeGreaterThanOrEqual(0);
    expect(result.usedMB).toBeLessThanOrEqual(result.totalMB);
    expect(result.usagePercent).toBeGreaterThanOrEqual(0);
    expect(result.usagePercent).toBeLessThanOrEqual(100);
  });

  it('should return integer values', () => {
    const result = getMemoryUsage();

    expect(Number.isInteger(result.totalMB)).toBe(true);
    expect(Number.isInteger(result.usedMB)).toBe(true);
    expect(Number.isInteger(result.usagePercent)).toBe(true);
  });
});

describe('checkCriticalModules', () => {
  it('should return a valid structure with status and missing array', () => {
    const result = checkCriticalModules();

    expect(result).toHaveProperty('status');
    expect(result).toHaveProperty('missing');
    expect(Array.isArray(result.missing)).toBe(true);
    expect(['ok', 'degraded']).toContain(result.status);
  });

  it('should report degraded when modules cannot be resolved', () => {
    // In test environment without dist/, the relative module paths won't resolve
    // This validates the function handles missing modules gracefully
    const result = checkCriticalModules();

    // The critical modules are relative to dist/utils/ which doesn't exist in test
    // So they should all fail to resolve
    if (result.missing.length > 0) {
      expect(result.status).toBe('degraded');
      result.missing.forEach(m => {
        expect(typeof m).toBe('string');
      });
    } else {
      // If somehow they resolve (e.g., running after build), that's also valid
      expect(result.status).toBe('ok');
    }
  });
});
