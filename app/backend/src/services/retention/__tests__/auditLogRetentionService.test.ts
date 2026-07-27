import { getAuditLogRetentionDays, runAuditLogRetention } from '../auditLogRetentionService';

const mockExecuteRaw = jest.fn();

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    $executeRaw: (...args: unknown[]) => mockExecuteRaw(...args),
  },
}));

jest.mock('../../../config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('node-cron', () => ({ schedule: jest.fn() }));

const ORIGINAL_ENV = process.env.AUDIT_LOG_RETENTION_DAYS;

describe('getAuditLogRetentionDays', () => {
  afterEach(() => {
    process.env.AUDIT_LOG_RETENTION_DAYS = ORIGINAL_ENV;
    if (ORIGINAL_ENV === undefined) delete process.env.AUDIT_LOG_RETENTION_DAYS;
  });

  it('should return null when the env var is unset', () => {
    delete process.env.AUDIT_LOG_RETENTION_DAYS;
    expect(getAuditLogRetentionDays()).toBeNull();
  });

  it('should return null when the env var is blank', () => {
    process.env.AUDIT_LOG_RETENTION_DAYS = '   ';
    expect(getAuditLogRetentionDays()).toBeNull();
  });

  it('should return null when the value is not a positive integer', () => {
    process.env.AUDIT_LOG_RETENTION_DAYS = 'nonsense';
    expect(getAuditLogRetentionDays()).toBeNull();

    process.env.AUDIT_LOG_RETENTION_DAYS = '0';
    expect(getAuditLogRetentionDays()).toBeNull();

    process.env.AUDIT_LOG_RETENTION_DAYS = '-5';
    expect(getAuditLogRetentionDays()).toBeNull();
  });

  it('should return the parsed window when set to a positive integer', () => {
    process.env.AUDIT_LOG_RETENTION_DAYS = '30';
    expect(getAuditLogRetentionDays()).toBe(30);
  });
});

describe('runAuditLogRetention', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env.AUDIT_LOG_RETENTION_DAYS = ORIGINAL_ENV;
    if (ORIGINAL_ENV === undefined) delete process.env.AUDIT_LOG_RETENTION_DAYS;
  });

  it('should skip without touching the database when retention is disabled', async () => {
    delete process.env.AUDIT_LOG_RETENTION_DAYS;

    const result = await runAuditLogRetention();

    expect(result.skipped).toBe(true);
    expect(result.rowsDeleted).toBe(0);
    expect(mockExecuteRaw).not.toHaveBeenCalled();
  });

  it('should delete in batches until no rows remain when retention is enabled', async () => {
    process.env.AUDIT_LOG_RETENTION_DAYS = '30';
    mockExecuteRaw
      .mockResolvedValueOnce(5000)
      .mockResolvedValueOnce(1200)
      .mockResolvedValueOnce(0);

    const result = await runAuditLogRetention();

    expect(result.skipped).toBe(false);
    expect(result.rowsDeleted).toBe(6200);
    expect(mockExecuteRaw).toHaveBeenCalledTimes(3);
  });

  it('should report zero deletions when nothing is older than the window', async () => {
    process.env.AUDIT_LOG_RETENTION_DAYS = '90';
    mockExecuteRaw.mockResolvedValueOnce(0);

    const result = await runAuditLogRetention();

    expect(result.skipped).toBe(false);
    expect(result.rowsDeleted).toBe(0);
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
  });

  it('should propagate database errors so the cron wrapper can log them', async () => {
    process.env.AUDIT_LOG_RETENTION_DAYS = '30';
    mockExecuteRaw.mockRejectedValueOnce(new Error('connection lost'));

    await expect(runAuditLogRetention()).rejects.toThrow('connection lost');
  });
});
