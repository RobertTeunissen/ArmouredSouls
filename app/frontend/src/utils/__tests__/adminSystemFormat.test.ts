/**
 * Unit tests for the admin System page helpers: sizes, error-code labels,
 * status cards, slow-run highlighting and the lock summary.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  barShares,
  deriveSystemCards,
  errorCodeLabel,
  formatMegabytes,
  formatRequestMs,
  formatRows,
  formatSize,
  isSlowOutlier,
  jobNote,
  summarizeLock,
} from '../adminSystemFormat';
import type { SystemJob, SystemOverview } from '@shared/types';

const NOW = new Date('2026-11-02T18:08:12.000Z');
const GB = 1024 ** 3;

function systemOverview(partial: Partial<SystemOverview> = {}): SystemOverview {
  return {
    generatedAt: NOW.toISOString(),
    disk: { usagePercent: 66, usedMB: 29 * 1024, totalMB: 45 * 1024, availableMB: 16 * 1024, status: 'ok' },
    memory: { totalMB: 1961, availableMB: 940, swapTotalMB: 2048, swapUsedMB: 188 },
    database: { sizeBytes: 15 * GB, tables: [{ name: 'audit_logs', sizeBytes: 5.4 * GB, rows: 3_500_000 }] },
    backup: { status: 'ok', file: 'armouredsouls_acc_daily_20261102_020002.sql.zst', at: '2026-11-02T02:10:00.000Z', sizeBytes: 4.4 * GB, note: null },
    backend: { startedAt: '2026-11-02T15:50:00.000Z', uptimeSeconds: 2 * 3600 + 18 * 60, deployTag: 'deploy-acc-20261102-154800', nodeVersion: 'v24.1.0' },
    starts: [],
    requests: { windowDays: 7, days: [], failures24h: 0, errors: [], slow: [], recordingSince: '2026-11-02T16:00:00.000Z' },
    jobs: { windowDays: 8, rows: [], lockPerDay: [] },
    ...partial,
  };
}

const card = (overview: SystemOverview, key: string) => deriveSystemCards(overview, NOW).find((c) => c.key === key);

describe('sizes and counts', () => {
  it('formats bytes, megabytes and row counts', () => {
    expect(formatSize(15.2 * GB)).toBe('15 GB');
    expect(formatSize(5.4 * GB)).toBe('5.4 GB');
    expect(formatSize(534 * 1024 * 1024)).toBe('534 MB');
    expect(formatSize(12 * 1024)).toBe('12 kB');
    expect(formatSize(800)).toBe('800 B');
    expect(formatMegabytes(940)).toBe('940 MB');
    expect(formatMegabytes(1961)).toBe('1.9 GB');
    expect(formatRows(3_500_000)).toBe('3.5M');
    expect(formatRows(214_321)).toBe('214k');
    expect(formatRows(857)).toBe('857');
  });

  it('formats request durations', () => {
    expect(formatRequestMs(2_140)).toBe('2.1 s');
    expect(formatRequestMs(30_010)).toBe('30 s');
    expect(formatRequestMs(125_000)).toBe('2m 05s');
  });
});

describe('errorCodeLabel', () => {
  it('names known codes, HTTP fallbacks and other AppError codes', () => {
    expect(errorCodeLabel('STATEMENT_TIMEOUT')).toBe('statement timeout');
    expect(errorCodeLabel('INTERNAL_ERROR')).toBe('internal error');
    expect(errorCodeLabel('HTTP_502')).toBe('HTTP 502');
    expect(errorCodeLabel('SERVICE_UNAVAILABLE')).toBe('service unavailable');
  });
});

describe('deriveSystemCards', () => {
  it('describes a healthy server', () => {
    expect(deriveSystemCards(systemOverview(), NOW)).toEqual([
      { key: 'disk', label: 'Disk', value: '66%', caption: '29 GB of 45 GB used', tone: 'ok' },
      { key: 'database', label: 'Database', value: '15 GB', caption: 'largest: audit_logs 5.4 GB', tone: 'info' },
      { key: 'memory', label: 'Memory', value: '940 MB free', caption: 'of 1.9 GB · swap 188 MB in use', tone: 'ok' },
      { key: 'backup', label: 'Last backup', value: 'Today 02:10', caption: '4.4 GB · 15h 58m ago', tone: 'ok' },
      { key: 'backend', label: 'Backend', value: 'up 2h 18m', caption: 'since Today 15:50 UTC', tone: 'info' },
      { key: 'requests', label: 'Failing requests', value: '0', caption: 'none in the last 24 h', tone: 'ok' },
    ]);
  });

  it('says "just started" for a backend up less than a minute', () => {
    const backend = { ...systemOverview().backend, uptimeSeconds: 42 };
    expect(card(systemOverview({ backend }), 'backend')).toMatchObject({ value: 'just started' });
  });

  it('follows the disk monitor thresholds', () => {
    const disk = (status: 'warning' | 'critical') => card(systemOverview({ disk: { usagePercent: 85, usedMB: null, totalMB: null, availableMB: 6000, status } }), 'disk');
    expect(disk('warning')).toMatchObject({ tone: 'warning', caption: '5.9 GB free' });
    expect(disk('critical')).toMatchObject({ tone: 'error' });
    expect(card(systemOverview({ disk: null }), 'disk')).toMatchObject({ value: '—', tone: 'muted' });
  });

  it('turns memory amber below 15% available', () => {
    expect(card(systemOverview({ memory: { totalMB: 2000, availableMB: 200, swapTotalMB: null, swapUsedMB: null } }), 'memory'))
      .toMatchObject({ tone: 'warning', caption: 'of 2.0 GB' });
  });

  it('flags a stale or missing backup and stays neutral on a local machine', () => {
    const base = systemOverview().backup;
    expect(card(systemOverview({ backup: { ...base, status: 'stale' } }), 'backup')).toMatchObject({ tone: 'warning', caption: expect.stringContaining('older than a day') });
    expect(card(systemOverview({ backup: { status: 'missing', file: null, at: null, sizeBytes: null, note: 'none found' } }), 'backup'))
      .toMatchObject({ value: 'None', caption: 'none found', tone: 'error' });
    expect(card(systemOverview({ backup: { status: 'not_applicable', file: null, at: null, sizeBytes: null, note: 'no backups on this machine' } }), 'backup'))
      .toMatchObject({ value: '—', tone: 'muted' });
  });

  it('names the route with the most errors and says when nothing was recorded yet', () => {
    const requests = {
      ...systemOverview().requests,
      failures24h: 2,
      errors: [{ method: 'GET', route: '/api/admin/economy/overview', page: 'Economy', code: 'STATEMENT_TIMEOUT', count: 7, lastAt: NOW.toISOString(), perDay: [] }],
    };
    expect(card(systemOverview({ requests }), 'requests')).toMatchObject({ value: '2', caption: 'in 24 h · Economy (statement timeout)', tone: 'error' });
    expect(card(systemOverview({ requests: { ...requests, failures24h: 0, errors: [], recordingSince: null } }), 'requests'))
      .toMatchObject({ caption: 'Nothing recorded yet', tone: 'muted' });
  });
});

function job(partial: Partial<SystemJob>): SystemJob {
  return { jobName: 'koth', runs: [], last: null, medianMs: 1_000, slowest: null, interrupted: 0, failed: 0, ...partial };
}

describe('scheduler job helpers', () => {
  it('highlights a slowest run over 1.5× the median', () => {
    const slowest = (durationMs: number) => ({ startedAt: '2026-10-31T13:00:00.000Z', durationMs, status: 'success' });
    expect(isSlowOutlier(job({ slowest: slowest(1_501) }))).toBe(true);
    expect(isSlowOutlier(job({ slowest: slowest(1_500) }))).toBe(false);
    expect(isSlowOutlier(job({ medianMs: null, slowest: slowest(9_000) }))).toBe(false);
  });

  it('notes the slowest day and interrupted or failed runs', () => {
    const slowest = { startedAt: '2026-10-31T13:00:00.000Z', durationMs: 2_000, status: 'interrupted' };
    expect(jobNote(job({ slowest, interrupted: 1, failed: 2 }))).toBe('31 Oct · 1 interrupted · 2 failed');
    expect(jobNote(job({}))).toBe('');
  });

  it('summarizes the lock time per day', () => {
    expect(summarizeLock([])).toBeNull();
    expect(summarizeLock([
      { day: '2026-10-26', ms: 3 }, { day: '2026-10-27', ms: 1 }, { day: '2026-10-28', ms: 4 }, { day: '2026-11-02', ms: 2 },
    ])).toEqual({ minMs: 1, maxMs: 4, medianMs: 3, range: '26 Oct – 2 Nov' });
  });

  it('scales bars to the largest value, between 0 and 1 (property)', () => {
    fc.assert(fc.property(fc.array(fc.nat({ max: 1_000_000 }), { maxLength: 12 }), (values) => {
      const shares = barShares(values);
      expect(shares).toHaveLength(values.length);
      for (const share of shares) expect(share >= 0 && share <= 1).toBe(true);
      if (values.some((v) => v > 0)) expect(Math.max(...shares)).toBe(1);
    }));
  });
});
