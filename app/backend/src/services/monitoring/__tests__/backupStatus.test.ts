/**
 * Unit tests for the newest-backup reader shared by the daily health report
 * and the admin System page.
 */
const mockReaddirSync = jest.fn();
const mockStatSync = jest.fn();
const mockGetConfig = jest.fn();

jest.mock('fs', () => ({
  __esModule: true,
  default: {
    readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
    statSync: (...args: unknown[]) => mockStatSync(...args),
  },
}));
jest.mock('../../../config/env', () => ({ getConfig: () => mockGetConfig() }));
jest.mock('../../../config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { BACKUP_STALE_AFTER_MS, getLatestBackup, isBackupFile } from '../backupStatus';

const NOW = new Date('2026-11-02T18:00:00.000Z');
const DIR = '/backups';

function files(entries: Record<string, { at: Date; size: number }>): void {
  mockReaddirSync.mockReturnValue(Object.keys(entries));
  mockStatSync.mockImplementation((path: string) => {
    const entry = entries[path.slice(DIR.length + 1)];
    return { mtime: entry.at, size: entry.size };
  });
}

function enoent(): Error {
  return Object.assign(new Error('ENOENT: no such file or directory'), { code: 'ENOENT' });
}

describe('isBackupFile', () => {
  it('recognises zstd, gzip and pg_dump backups and nothing else', () => {
    expect(isBackupFile('armouredsouls_acc_daily_20261102_020002.sql.zst')).toBe(true);
    expect(isBackupFile('old.sql.gz')).toBe(true);
    expect(isBackupFile('old.dump')).toBe(true);
    expect(isBackupFile('backup.log')).toBe(false);
    expect(isBackupFile('partial.sql.zst.tmp')).toBe(false);
  });
});

describe('getLatestBackup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetConfig.mockReturnValue({ nodeEnv: 'acceptance' });
  });

  it('returns the newest backup, including the current .sql.zst format', () => {
    const newest = new Date('2026-11-02T02:10:00.000Z');
    files({
      'armouredsouls_acc_daily_20261101_020001.sql.zst': { at: new Date('2026-11-01T02:09:00.000Z'), size: 4_300 },
      'armouredsouls_acc_daily_20261102_020002.sql.zst': { at: newest, size: 4_400 },
      'backup.log': { at: NOW, size: 10 },
    });

    expect(getLatestBackup(NOW, DIR)).toEqual({
      status: 'ok', file: 'armouredsouls_acc_daily_20261102_020002.sql.zst', at: newest, sizeBytes: 4_400, note: null,
    });
  });

  it('is stale once the newest backup is older than the threshold', () => {
    files({ 'a.sql.zst': { at: new Date(NOW.getTime() - BACKUP_STALE_AFTER_MS - 1), size: 1 } });
    expect(getLatestBackup(NOW, DIR).status).toBe('stale');

    files({ 'a.sql.zst': { at: new Date(NOW.getTime() - BACKUP_STALE_AFTER_MS), size: 1 } });
    expect(getLatestBackup(NOW, DIR).status).toBe('ok');
  });

  it('is missing when the directory holds no backup', () => {
    files({ 'backup.log': { at: NOW, size: 10 } });

    expect(getLatestBackup(NOW, DIR)).toEqual({ status: 'missing', file: null, at: null, sizeBytes: null, note: 'none found' });
  });

  it('is missing on a deployed host without a backup directory', () => {
    mockReaddirSync.mockImplementation(() => { throw enoent(); });

    expect(getLatestBackup(NOW, DIR)).toMatchObject({ status: 'missing', note: 'backup directory not found' });
  });

  it('does not apply on a local machine without a backup directory', () => {
    mockGetConfig.mockReturnValue({ nodeEnv: 'development' });
    mockReaddirSync.mockImplementation(() => { throw enoent(); });

    expect(getLatestBackup(NOW, DIR)).toMatchObject({ status: 'not_applicable', note: 'no backups on this machine' });
  });

  it('is missing, without throwing, when the directory cannot be read', () => {
    mockReaddirSync.mockImplementation(() => { throw Object.assign(new Error('EACCES'), { code: 'EACCES' }); });

    expect(getLatestBackup(NOW, DIR)).toMatchObject({ status: 'missing', note: 'error checking backups' });
  });
});
