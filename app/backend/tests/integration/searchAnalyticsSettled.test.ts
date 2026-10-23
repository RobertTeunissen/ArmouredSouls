/**
 * Search Analytics against PostgreSQL: the settled-search rule, privacy-light
 * selection tracking, the phrase table (filter escaping, tabs, returned /
 * chosen categories) and the CSV export.
 *
 * Every phrase carries this file's unique token, and phrase-table queries
 * filter on it, so other rows in the shared database never affect the counts.
 */
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import http from 'http';
import type { AddressInfo } from 'net';

import prisma from '../../src/lib/prisma';
import { authenticateToken } from '../../src/middleware/auth';
import { errorHandler } from '../../src/middleware/errorHandler';
import adminAnalyticsRoutes from '../../src/routes/adminAnalytics';
import searchRoutes from '../../src/routes/search';
import { getCurrentSeason, invalidateSeasonCache } from '../../src/services/season/seasonService';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
/** Unique token every phrase of this file starts with. */
const T = `zz${suffix}`;
const SECOND = 1000;

interface Fixture { userId: number; token: string }

const app = express();
app.use(express.json());
app.use('/api/search', searchRoutes);
app.use('/api/admin', adminAnalyticsRoutes);
app.use(errorHandler);

async function createUser(tag: string, role: 'user' | 'admin'): Promise<Fixture> {
  const user = await prisma.user.create({
    data: { username: `search_settled_${tag}_${suffix}`, passwordHash: 'x', role, stableName: `S${tag}${suffix}` },
    select: { id: true, username: true },
  });
  return {
    userId: user.id,
    token: jwt.sign({ userId: user.id, username: user.username, role, tokenVersion: 0 }, JWT_SECRET),
  };
}

describe('Search Analytics settled searches, selection tracking and phrases (database)', () => {
  let server: http.Server;
  let baseUrl: string;
  let playerA: Fixture;
  let playerB: Fixture;
  let playerC: Fixture;
  let admin: Fixture;
  let seasonNumber: number;
  let cycleNumber: number;
  const base = new Date(Date.now() - 60 * 60 * SECOND);

  async function insert(
    user: Fixture,
    phrase: string,
    offsetSeconds: number,
    counts: { robots?: number; stables?: number; guide?: number } = { robots: 1 },
    extra: { selectionTracked?: boolean; selectedCategory?: string | null; at?: Date } = {},
  ): Promise<number> {
    const robots = counts.robots ?? 0;
    const stables = counts.stables ?? 0;
    const guide = counts.guide ?? 0;
    const row = await prisma.searchAnalyticsEvent.create({
      data: {
        seasonNumber,
        cycleNumber,
        userId: user.userId,
        eventTimestamp: extra.at ?? new Date(base.getTime() + offsetSeconds * SECOND),
        normalizedPhrase: phrase,
        robotResultCount: robots,
        stableResultCount: stables,
        guideResultCount: guide,
        totalResultCount: robots + stables + guide,
        noResult: robots + stables + guide === 0,
        selectionTracked: extra.selectionTracked ?? true,
        selectedCategory: extra.selectedCategory ?? null,
      },
      select: { id: true },
    });
    return Number(row.id);
  }

  async function phrases(query: Record<string, string | number>): Promise<request.Response> {
    return request(baseUrl)
      .get('/api/admin/search-analytics/phrases')
      .query({ q: T, cycleFrom: cycleNumber, cycleTo: cycleNumber, limit: 100, ...query })
      .set('Authorization', `Bearer ${admin.token}`);
  }

  beforeAll(async () => {
    server = http.createServer(app).listen(0);
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    invalidateSeasonCache();
    const season = await getCurrentSeason();
    seasonNumber = season.seasonNumber;
    cycleNumber = season.seasonCycle;
    playerA = await createUser('a', 'user');
    playerB = await createUser('b', 'user');
    playerC = await createUser('c', 'user');
    admin = await createUser('admin', 'admin');

    // A typing chain within 5 s of each step: only the last phrase is settled.
    await insert(playerA, `${T} la`, 0);
    await insert(playerA, `${T} laser`, 2);
    await insert(playerA, `${T} laser c`, 4);
    await insert(playerA, `${T} laser cannon`, 6, { robots: 2, guide: 1 });
    // A 6 s pause: both are searches.
    await insert(playerA, `${T} plasma`, 60);
    await insert(playerA, `${T} plasma shield`, 66);
    // A non-prefix correction: both are searches.
    await insert(playerA, `${T} lasr`, 120, {});
    await insert(playerA, `${T} laser`, 122);
    // The same phrase twice: two searches.
    await insert(playerA, `${T} koth`, 200, { guide: 1 });
    await insert(playerA, `${T} koth`, 202, { guide: 1 });
    // Another player in between does not break player A's chain.
    await insert(playerA, `${T} ab`, 300);
    await insert(playerB, `${T} zzz`, 301);
    await insert(playerA, `${T} abc`, 302);
  });

  afterAll(async () => {
    const ids = [playerA, playerB, playerC, admin].map((fixture) => fixture.userId);
    await prisma.searchAnalyticsEvent.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  describe('settled-search rule', () => {
    it('drops half-typed prefixes within 5 s and keeps pauses, corrections and repeats', async () => {
      const res = await phrases({ mode: 'settled' });
      expect(res.status).toBe(200);
      const counts = Object.fromEntries(res.body.rows.map((row: { phrase: string; searches: number }) => [row.phrase.slice(T.length + 1), row.searches]));

      expect(counts).toEqual({
        'laser cannon': 1,
        plasma: 1,
        'plasma shield': 1,
        lasr: 1,
        laser: 1,
        koth: 2,
        abc: 1,
        zzz: 1,
      });
      expect(res.body.total).toBe(8);
    });

    it('counts every request in all mode', async () => {
      const res = await phrases({ mode: 'all' });
      const counts = Object.fromEntries(res.body.rows.map((row: { phrase: string; searches: number }) => [row.phrase.slice(T.length + 1), row.searches]));

      expect(counts).toEqual({
        la: 1, laser: 2, 'laser c': 1, 'laser cannon': 1, plasma: 1, 'plasma shield': 1,
        lasr: 1, koth: 2, ab: 1, abc: 1, zzz: 1,
      });
    });

    it('reports more raw requests than settled searches', async () => {
      const res = await request(baseUrl)
        .get('/api/admin/search-analytics/report')
        .query({ cycleFrom: cycleNumber, cycleTo: cycleNumber })
        .set('Authorization', `Bearer ${admin.token}`);

      expect(res.status).toBe(200);
      expect(res.body.period.mode).toBe('settled');
      // This file alone drops four prefixes: "la", "laser" (at 2 s), "laser c" and "ab".
      expect(res.body.overview.rawRequests - res.body.overview.totalSearches).toBeGreaterThanOrEqual(4);
    });
  });

  describe('phrase table', () => {
    it('shows which categories returned results and the no-result tab', async () => {
      const all = await phrases({});
      const cannon = all.body.rows.find((row: { phrase: string }) => row.phrase === `${T} laser cannon`);
      expect(cannon.returned).toEqual({ robots: true, stables: false, guide: true });

      const noResult = await phrases({ tab: 'noResult' });
      expect(noResult.body.rows.map((row: { phrase: string }) => row.phrase)).toEqual([`${T} lasr`]);
      expect(noResult.body.rows[0].noResultRate).toBe(100);
    });

    it('matches % and _ in the filter literally', async () => {
      await insert(playerB, `${T}50%off`, 500);
      await insert(playerB, `${T}50xoff`, 560);

      const res = await phrases({ q: `${T}50%` });
      expect(res.body.rows.map((row: { phrase: string }) => row.phrase)).toEqual([`${T}50%off`]);
    });

    it('rejects an unknown query parameter', async () => {
      const res = await phrases({ resultId: 1 });
      expect(res.status).toBe(400);
    });
  });

  describe('privacy-light selection tracking', () => {
    it('attaches only the category to the newest recent search, and nothing else', async () => {
      const now = Date.now();
      const old = await insert(playerC, `${T} old`, 0, { robots: 1 }, { at: new Date(now - 120 * SECOND) });
      const untracked = await insert(playerC, `${T} untracked`, 0, { robots: 1 }, { at: new Date(now - 20 * SECOND), selectionTracked: false });
      const recent = await insert(playerC, `${T} recent`, 0, { guide: 1 }, { at: new Date(now - 10 * SECOND) });

      const first = await request(baseUrl)
        .post('/api/search/selection')
        .set('Authorization', `Bearer ${playerC.token}`)
        .send({ category: 'guide' });
      const second = await request(baseUrl)
        .post('/api/search/selection')
        .set('Authorization', `Bearer ${playerC.token}`)
        .send({ category: 'robots' });

      expect(first.status).toBe(204);
      expect(second.status).toBe(204);
      const rows = await prisma.searchAnalyticsEvent.findMany({
        where: { id: { in: [old, untracked, recent].map(BigInt) } },
        select: { id: true, selectedCategory: true, selectedAt: true },
      });
      const byId = new Map(rows.map((row) => [Number(row.id), row]));
      expect(byId.get(recent)?.selectedCategory).toBe('guide');
      expect(byId.get(recent)?.selectedAt).not.toBeNull();
      // The second selection found no other recent, unselected, tracked search.
      expect(byId.get(untracked)?.selectedCategory).toBeNull();
      expect(byId.get(old)?.selectedCategory).toBeNull();
    });

    it('rejects anything but a known category and requires authentication', async () => {
      const unknown = await request(baseUrl)
        .post('/api/search/selection')
        .set('Authorization', `Bearer ${playerC.token}`)
        .send({ category: 'weapons' });
      const withLabel = await request(baseUrl)
        .post('/api/search/selection')
        .set('Authorization', `Bearer ${playerC.token}`)
        .send({ category: 'robots', label: 'Iron Fist' });
      const anonymous = await request(baseUrl).post('/api/search/selection').send({ category: 'robots' });

      expect(unknown.status).toBe(400);
      expect(withLabel.status).toBe(400);
      expect(anonymous.status).toBe(401);
    });

    it('reports the most chosen category per phrase', async () => {
      await insert(playerB, `${T} chosen`, 700, { robots: 1, guide: 1 }, { selectedCategory: 'robots' });
      await insert(playerB, `${T} chosen`, 760, { robots: 1, guide: 1 }, { selectedCategory: 'robots' });
      await insert(playerB, `${T} chosen`, 820, { robots: 1, guide: 1 }, { selectedCategory: null });

      const res = await phrases({ q: `${T} chosen` });
      expect(res.body.rows[0].mostChosen).toEqual({ category: 'robots', share: 66.7 });
    });
  });

  describe('CSV export', () => {
    it('exports the filtered phrases as an attachment with formulas neutralised', async () => {
      await insert(playerB, `=${T}`, 900);

      const res = await request(baseUrl)
        .get('/api/admin/search-analytics/phrases/export')
        .query({ q: T, cycleFrom: cycleNumber, cycleTo: cycleNumber })
        .set('Authorization', `Bearer ${admin.token}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.text.split('\r\n')[0]).toBe('"Phrase","Searches","Share %","No-result %","Returned","Mostly chosen","Chosen %"');
      expect(res.text).toContain(`"'=${T}"`);
    });

    it('is admin only', async () => {
      const res = await request(baseUrl)
        .get('/api/admin/search-analytics/phrases/export')
        .set('Authorization', `Bearer ${playerA.token}`);
      expect(res.status).toBe(403);
    });
  });
});
