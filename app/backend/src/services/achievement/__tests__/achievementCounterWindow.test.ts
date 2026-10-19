/**
 * Unit tests for the achievement counter window (issue #342).
 */
const mockFindFirst = jest.fn();

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    resetLog: { findFirst: (...args: unknown[]) => mockFindFirst(...args) },
  },
}));

import { Prisma } from '../../../../generated/prisma';
import {
  auditCounterSinceSql,
  buildAuditCounterWhere,
  getAchievementCounterStart,
} from '../achievementCounterWindow';

describe('achievementCounterWindow', () => {
  beforeEach(() => {
    mockFindFirst.mockReset();
  });

  describe('buildAuditCounterWhere', () => {
    it('counts all history when the user never reset', () => {
      expect(buildAuditCounterWhere(7, 'weapon_sale', null)).toEqual({ userId: 7, eventType: 'weapon_sale' });
    });

    it('counts only events after the latest reset', () => {
      const since = new Date('2026-10-19T12:00:00Z');
      expect(buildAuditCounterWhere(7, 'weapon_refinement', since)).toEqual({
        userId: 7,
        eventType: 'weapon_refinement',
        eventTimestamp: { gt: since },
      });
    });
  });

  describe('auditCounterSinceSql', () => {
    it('is empty without a reset', () => {
      expect(auditCounterSinceSql(null)).toBe(Prisma.empty);
    });

    it('filters on event_timestamp after the reset', () => {
      const since = new Date('2026-10-19T12:00:00Z');
      const fragment = auditCounterSinceSql(since);
      expect(fragment.sql).toBe('AND event_timestamp > ?');
      expect(fragment.values).toEqual([since]);
    });
  });

  describe('getAchievementCounterStart', () => {
    it('returns the newest reset time', async () => {
      const resetAt = new Date('2026-10-19T12:00:00Z');
      mockFindFirst.mockResolvedValue({ resetAt });

      await expect(getAchievementCounterStart(7)).resolves.toBe(resetAt);
      expect(mockFindFirst).toHaveBeenCalledWith({
        where: { userId: 7 },
        orderBy: { resetAt: 'desc' },
        select: { resetAt: true },
      });
    });

    it('returns null when the user never reset', async () => {
      mockFindFirst.mockResolvedValue(null);
      await expect(getAchievementCounterStart(7)).resolves.toBeNull();
    });
  });
});
