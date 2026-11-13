/**
 * Unit tests of the Admin actions page: plain descriptions and areas of the
 * recorded operations (the real summaries stored on ACC), and the area /
 * result filters and counts of the query.
 */
const mockPrisma = {
  adminAuditLog: { groupBy: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  user: { findMany: jest.fn() },
};
jest.mock('../../../lib/prisma', () => ({ __esModule: true, default: mockPrisma }));

import { ADMIN_ACTION_AREAS, getAdminActions } from '../admin-actions';
import { areaOf, describeAdminAction } from '../admin-actions/adminActionCatalogue';

describe('areaOf', () => {
  it.each([
    ['scheduler_trigger', 'cycles'],
    ['cycles_bulk', 'cycles'],
    ['matchmaking_run', 'cycles'],
    ['season_rollover', 'season'],
    ['season_preparation_cycles', 'season'],
    ['automaton.activate_all', 'automatons'],
    ['automaton.something_new', 'automatons'],
    ['image_removed', 'moderation'],
    ['password_reset', 'players'],
    ['changelog_publish', 'changelog'],
    ['made_up', 'other'],
  ])('%s → %s', (op, area) => {
    expect(areaOf(op)).toBe(area);
  });
});

describe('describeAdminAction', () => {
  it('names manual job runs with the Cycle Controls labels', () => {
    expect(describeAdminAction('scheduler_trigger', 'success', { jobName: 'tournament' })).toEqual({
      area: 'cycles', title: 'Ran Tournament manually', details: '', link: '/admin/cycles',
    });
    expect(describeAdminAction('scheduler_trigger', 'failure', { jobName: 'team2v2League', error: 'lock held' })).toMatchObject({
      title: 'Manual run of 2v2 League failed', details: 'lock held',
    });
  });

  it('describes rollovers and their failures from the stored summary', () => {
    const ok = describeAdminAction('season_rollover', 'success', {
      seasonNumber: 0, durations: { postMs: 473, purgeMs: 1303, totalMs: 2289, archiveMs: 68 }, accoladeRows: 304, snapshotRows: 3650,
    });
    expect(ok).toEqual({ area: 'season', title: 'Rolled over season 0 → 1', details: '2.3 s · 3,650 snapshot rows · 304 accolades', link: '/admin/seasons' });
    expect(describeAdminAction('season_rollover', 'failure', { error: 'prisma is not defined', seasonNumber: 0 })).toMatchObject({
      title: 'Rollover of season 0 failed', details: 'prisma is not defined',
    });
    expect(describeAdminAction('season_extend', 'success', { additionalCycles: 1 }).title).toBe('Extended the season by 1 cycle');
  });

  it('lists activated Automatons and reads rejections', () => {
    expect(describeAdminAction('automaton.activate_all', 'success', { outcome: 'completed', activated: ['a', 'b', 'c', 'd'], catalogueKey: 'all' }))
      .toMatchObject({ area: 'automatons', title: 'Activated all Automaton drafts', details: '4: a, b, c, …', link: '/admin/automatons' });
    expect(describeAdminAction('automaton.activate_all', 'success', { activated: [] }).details).toBe('nothing left to activate');
    expect(describeAdminAction('automaton.update_profile', 'failure', { catalogueKey: 'dalek-empire', code: 'VALIDATION_ERROR' }))
      .toMatchObject({ title: 'Edited an Automaton profile: rejected', details: 'dalek-empire · VALIDATION_ERROR' });
  });

  it('links a password reset to the stable and never mentions a password', () => {
    const described = describeAdminAction('password_reset', 'success', { targetUserId: 12, username: 'player_b', stableName: 'Stable B' });
    expect(described).toEqual({ area: 'players', title: 'Reset a player\'s password', details: 'Stable B · @player_b', link: '/admin/players?user=12' });
  });

  it('describes moderation and changelog actions', () => {
    expect(describeAdminAction('image_removed', 'success', { reason: 'NSFW', robotsCleared: 2 }).details).toBe('NSFW · 2 robots reset');
    expect(describeAdminAction('image_cleanup', 'success', { filesDeleted: 1, referencesCleared: { robots: 0, archived: 30 } }).details)
      .toBe('1 file deleted · 30 archived references cleared');
    expect(describeAdminAction('changelog_publish', 'success', { entryId: 17, title: 'Season 2 notes' })).toEqual({
      area: 'changelog', title: 'Published a changelog entry', details: 'Season 2 notes', link: '/admin/changelog',
    });
    expect(describeAdminAction('changelog_delete', 'success', { entryId: 9 }).details).toBe('#9');
  });

  it('humanizes unknown operations and survives odd summaries', () => {
    expect(describeAdminAction('made_up_thing', 'success', null)).toEqual({ area: 'other', title: 'Made up thing', details: '', link: null });
    expect(describeAdminAction('cycles_bulk', 'success', ['not', 'an', 'object']).title).toBe('Ran bulk cycles');
  });

  it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty'])('treats the Object property name %s as an unknown operation', (op) => {
    expect(areaOf(op)).toBe('other');
    expect(describeAdminAction(op, 'success', {})).toMatchObject({ area: 'other', link: null });
    const job = describeAdminAction('scheduler_trigger', 'success', { jobName: op }).title;
    expect(job).toMatch(/^Ran .+ manually$/);
    expect(job).not.toMatch(/function|\[native code\]|\[object/);
    expect(describeAdminAction(`automaton.${op}`, 'success', {}).area).toBe('automatons');
  });

  it('says a background start was queued, not that it ran', () => {
    expect(describeAdminAction('scheduler_trigger', 'success', { jobName: 'league', runId: 41, background: true })).toMatchObject({
      title: 'Started 1v1 League manually', details: 'queued; the outcome is in Run history',
    });
    expect(describeAdminAction('cycles_bulk', 'success', { cyclesRequested: 3, runId: 42, background: true })).toMatchObject({
      title: 'Started 3 bulk cycles', details: 'queued; the outcome is in Run history',
    });
    expect(describeAdminAction('cycles_bulk', 'success', { cyclesRequested: 3, cyclesCompleted: 3 })).toMatchObject({ title: 'Ran 3 bulk cycles', details: '3 completed' });
  });

  it('does not claim every draft was activated when some were rejected', () => {
    const partial = describeAdminAction('automaton.activate_all', 'success', {
      activated: ['autobots-ark'],
      rejected: [{ catalogueKey: 'dalek-empire', code: 'VALIDATION_ERROR' }, { catalogueKey: 'clone-legion', code: 'VALIDATION_ERROR' }],
    });
    expect(partial).toMatchObject({ title: 'Activated 1 of 3 Automaton drafts', details: '1 activated · rejected 2: dalek-empire, clone-legion' });
    const none = describeAdminAction('automaton.activate_all', 'success', { activated: [], rejected: [{ catalogueKey: 'dalek-empire', code: 'X' }] });
    expect(none.title).toBe('Activated 0 of 1 Automaton drafts');
    expect(none.details).not.toContain('nothing left');
  });
});

describe('getAdminActions', () => {
  const row = (id: number, operationType: string, operationResult = 'success') => ({
    id, adminUserId: 2, operationType, operationResult, resultSummary: { jobName: 'league' }, createdAt: new Date(`2026-10-0${id}T10:00:00Z`),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.adminAuditLog.groupBy.mockResolvedValue([
      { operationType: 'scheduler_trigger', operationResult: 'success', _count: { _all: 8 } },
      { operationType: 'season_rollover', operationResult: 'failure', _count: { _all: 9 } },
      { operationType: 'season_rollover', operationResult: 'success', _count: { _all: 1 } },
      { operationType: 'automaton.activate_all', operationResult: 'success', _count: { _all: 4 } },
    ]);
    mockPrisma.adminAuditLog.findFirst.mockResolvedValue({ createdAt: new Date('2026-05-16T08:19:39Z') });
    mockPrisma.adminAuditLog.findMany.mockResolvedValue([row(2, 'scheduler_trigger'), row(1, 'season_rollover', 'failure')]);
    mockPrisma.adminAuditLog.count.mockResolvedValue(2);
    mockPrisma.user.findMany.mockResolvedValue([{ id: 2, username: 'admin', stableName: 'Administrator' }]);
  });

  it('counts every area and the failures, newest first, with the admin\'s name', async () => {
    const page = await getAdminActions();

    expect(page.counts).toEqual({
      all: 22,
      failures: 9,
      byArea: { ...Object.fromEntries(ADMIN_ACTION_AREAS.map((a) => [a, 0])), cycles: 8, season: 10, automatons: 4 },
    });
    expect(page.since).toBe('2026-05-16T08:19:39.000Z');
    expect(page.entries.map((e) => [e.title, e.result, e.admin.name])).toEqual([
      ['Ran 1v1 League manually', 'success', 'Administrator'],
      ['Rollover failed', 'failure', 'Administrator'],
    ]);
    expect(mockPrisma.adminAuditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {}, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: 0, take: 50 }));
  });

  it('filters by area through the recorded operation names, and by failures', async () => {
    await getAdminActions({ area: 'season', result: 'failure', page: 2, pageSize: 10 });

    expect(mockPrisma.adminAuditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { operationType: { in: ['season_rollover'] }, operationResult: 'failure' },
      skip: 10,
      take: 10,
    }));
    expect(mockPrisma.adminAuditLog.count).toHaveBeenCalledWith({ where: { operationType: { in: ['season_rollover'] }, operationResult: 'failure' } });
  });

  it('names a deleted admin and copes with no entries', async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    expect((await getAdminActions()).entries[0].admin.name).toBe('Deleted user #2');

    mockPrisma.adminAuditLog.groupBy.mockResolvedValue([]);
    mockPrisma.adminAuditLog.findFirst.mockResolvedValue(null);
    mockPrisma.adminAuditLog.findMany.mockResolvedValue([]);
    mockPrisma.adminAuditLog.count.mockResolvedValue(0);
    const empty = await getAdminActions({ area: 'players' });
    expect(empty).toMatchObject({ total: 0, totalPages: 1, since: null, counts: { all: 0, failures: 0 } });
    expect(mockPrisma.adminAuditLog.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { operationType: { in: [] } } }));
  });
});
