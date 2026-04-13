/**
 * Property-based tests for ChangelogService.
 *
 * Uses fast-check to verify correctness properties across random inputs.
 * Each test tagged: Feature: in-game-changelog, Property {N}: {title}
 * Minimum 100 iterations per property.
 *
 * Properties:
 *   1: Entry data round-trip
 *   2: Player-facing query returns only published entries in publishDate desc order
 *   3: Pagination returns correct slices
 *   4: Unread detection by timestamp
 */

// --- Mocks (before imports) ---

/** In-memory store that the mock Prisma delegates use. */
let entryStore: Record<string, unknown>[] = [];
let nextId = 1;
let mockUser: { lastSeenChangelog: Date } | null = null;

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    changelogEntry: {
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        const entry = {
          id: nextId++,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        entryStore.push(entry);
        return Promise.resolve(entry);
      }),
      findMany: jest.fn(
        ({
          where,
          orderBy,
          skip,
          take,
        }: {
          where?: Record<string, unknown>;
          orderBy?: Record<string, string>;
          skip?: number;
          take?: number;
        }) => {
          let results = entryStore.filter((e) => {
            if (where?.status && e.status !== where.status) return false;
            if (where?.category && e.category !== where.category) return false;
            if (where?.publishDate) {
              const cond = where.publishDate as { gt?: Date };
              if (cond.gt && (e.publishDate as Date) <= cond.gt) return false;
            }
            return true;
          });

          // Sort
          if (orderBy?.publishDate === 'desc') {
            results.sort(
              (a, b) =>
                (b.publishDate as Date).getTime() - (a.publishDate as Date).getTime(),
            );
          } else if (orderBy?.createdAt === 'desc') {
            results.sort(
              (a, b) =>
                (b.createdAt as Date).getTime() - (a.createdAt as Date).getTime(),
            );
          }

          // Paginate
          if (skip !== undefined) results = results.slice(skip);
          if (take !== undefined) results = results.slice(0, take);

          return Promise.resolve(results);
        },
      ),
      count: jest.fn(({ where }: { where?: Record<string, unknown> } = {}) => {
        const results = entryStore.filter((e) => {
          if (where?.status && e.status !== where.status) return false;
          if (where?.category && e.category !== where.category) return false;
          if (where?.publishDate) {
            const cond = where.publishDate as { gt?: Date };
            if (cond.gt && (e.publishDate as Date) <= cond.gt) return false;
          }
          return true;
        });
        return Promise.resolve(results.length);
      }),
      findUnique: jest.fn(({ where }: { where: { id: number } }) => {
        const found = entryStore.find((e) => e.id === where.id) ?? null;
        return Promise.resolve(found);
      }),
      update: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findUnique: jest.fn(() => Promise.resolve(mockUser)),
      update: jest.fn(),
    },
  },
}));

jest.mock('../changelogImageService', () => ({
  deleteImage: jest.fn(),
}));

jest.mock('../../../config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// --- Imports ---

import fc from 'fast-check';
import { changelogService } from '../changelogService';

// --- Helpers ---

const CATEGORIES = ['balance', 'feature', 'bugfix', 'economy'] as const;

/** Arbitrary for valid titles (1-200 chars, non-empty after trim). */
const arbTitle = fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0);

/** Arbitrary for valid bodies (1-5000 chars, non-empty after trim). */
const arbBody = fc.string({ minLength: 1, maxLength: 5000 }).filter((s) => s.trim().length > 0);

/** Arbitrary for valid categories. */
const arbCategory = fc.constantFrom(...CATEGORIES);

/** Arbitrary for valid statuses. */
const arbStatus = fc.constantFrom('draft', 'published');

/** Arbitrary for a date within a reasonable range (no NaN/invalid dates). */
const arbDate = fc
  .date({ min: new Date('2024-01-01'), max: new Date('2026-12-31'), noInvalidDate: true });

// --- Property Tests ---

describe('ChangelogService property tests', () => {
  beforeEach(() => {
    entryStore = [];
    nextId = 1;
    mockUser = null;
    jest.clearAllMocks();
  });

  // ── Property 1: Entry data round-trip ─────────────────────────────

  describe('Feature: in-game-changelog, Property 1: Entry data round-trip', () => {
    /**
     * **Validates: Requirements 1.1**
     *
     * For any valid changelog entry data, creating via the service and
     * reading back returns matching fields.
     */
    it('should round-trip entry data through create', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbTitle,
          arbBody,
          arbCategory,
          arbStatus,
          async (title, body, category, status) => {
            // Reset store for each iteration
            entryStore = [];
            nextId = 1;

            const result = await changelogService.create({
              title,
              body,
              category,
              status,
            });

            expect(result.title).toBe(title);
            expect(result.body).toBe(body);
            expect(result.category).toBe(category);
            expect(result.status).toBe(status);

            if (status === 'published') {
              expect(result.publishDate).toBeInstanceOf(Date);
            } else {
              expect(result.publishDate).toBeNull();
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ── Property 2: Player-facing query returns only published entries ─

  describe('Feature: in-game-changelog, Property 2: Player-facing query returns only published entries in publishDate desc order', () => {
    /**
     * **Validates: Requirements 1.4, 1.5**
     *
     * For any mixed set of draft/published entries, listPublished returns
     * only published, sorted by publishDate desc.
     */
    it('should return only published entries sorted by publishDate desc', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              title: arbTitle,
              body: arbBody,
              category: arbCategory,
              status: arbStatus,
              publishDate: arbDate,
            }),
            { minLength: 0, maxLength: 20 },
          ),
          async (entries) => {
            // Seed the in-memory store
            entryStore = [];
            nextId = 1;

            for (const e of entries) {
              entryStore.push({
                id: nextId++,
                title: e.title,
                body: e.body,
                category: e.category,
                status: e.status,
                imageUrl: null,
                publishDate: e.status === 'published' ? e.publishDate : null,
                sourceType: null,
                sourceRef: null,
                createdBy: null,
                createdAt: new Date(),
                updatedAt: new Date(),
              });
            }

            const result = await changelogService.listPublished(1, 100);

            // All returned entries must be published
            for (const entry of result.entries) {
              expect(entry.status).toBe('published');
            }

            // Count must match
            const expectedPublished = entries.filter((e) => e.status === 'published').length;
            expect(result.total).toBe(expectedPublished);

            // Must be sorted by publishDate desc
            for (let i = 1; i < result.entries.length; i++) {
              const prev = (result.entries[i - 1].publishDate as Date).getTime();
              const curr = (result.entries[i].publishDate as Date).getTime();
              expect(prev).toBeGreaterThanOrEqual(curr);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ── Property 3: Pagination returns correct slices ──────────────────

  describe('Feature: in-game-changelog, Property 3: Pagination returns correct slices', () => {
    /**
     * **Validates: Requirements 1.6**
     *
     * For any valid page/perPage, returned entries are the correct slice
     * of the full sorted set.
     */
    it('should return the correct slice for any page/perPage', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              title: arbTitle,
              body: arbBody,
              category: arbCategory,
              publishDate: arbDate,
            }),
            { minLength: 1, maxLength: 30 },
          ),
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 1, max: 100 }),
          async (entries, page, perPage) => {
            // Seed store with all-published entries
            entryStore = [];
            nextId = 1;

            for (const e of entries) {
              entryStore.push({
                id: nextId++,
                title: e.title,
                body: e.body,
                category: e.category,
                status: 'published',
                imageUrl: null,
                publishDate: e.publishDate,
                sourceType: null,
                sourceRef: null,
                createdBy: null,
                createdAt: new Date(),
                updatedAt: new Date(),
              });
            }

            const result = await changelogService.listPublished(page, perPage);

            // Total should be all entries
            expect(result.total).toBe(entries.length);

            // Clamp perPage
            const clampedPerPage = Math.min(Math.max(perPage, 1), 100);
            const clampedPage = Math.max(page, 1);
            const skip = (clampedPage - 1) * clampedPerPage;

            // Sort all entries by publishDate desc to get expected slice
            const sorted = [...entryStore].sort(
              (a, b) =>
                (b.publishDate as Date).getTime() - (a.publishDate as Date).getTime(),
            );
            const expectedSlice = sorted.slice(skip, skip + clampedPerPage);

            expect(result.entries.length).toBe(expectedSlice.length);
            expect(result.page).toBe(clampedPage);
            expect(result.perPage).toBe(clampedPerPage);

            // Verify IDs match the expected slice
            for (let i = 0; i < result.entries.length; i++) {
              expect(result.entries[i].id).toBe(expectedSlice[i].id);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ── Property 4: Unread detection by timestamp ─────────────────────

  describe('Feature: in-game-changelog, Property 4: Unread detection by timestamp', () => {
    /**
     * **Validates: Requirements 2.2, 2.3, 2.5**
     *
     * For any set of published entries and any lastSeenChangelog, unread
     * entries are exactly those with publishDate after lastSeenChangelog.
     */
    it('should return exactly entries with publishDate after lastSeenChangelog', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              title: arbTitle,
              body: arbBody,
              category: arbCategory,
              publishDate: arbDate,
            }),
            { minLength: 0, maxLength: 20 },
          ),
          arbDate,
          async (entries, lastSeen) => {
            // Seed store with all-published entries
            entryStore = [];
            nextId = 1;

            for (const e of entries) {
              entryStore.push({
                id: nextId++,
                title: e.title,
                body: e.body,
                category: e.category,
                status: 'published',
                imageUrl: null,
                publishDate: e.publishDate,
                sourceType: null,
                sourceRef: null,
                createdBy: null,
                createdAt: new Date(),
                updatedAt: new Date(),
              });
            }

            // Set mock user
            mockUser = { lastSeenChangelog: lastSeen };

            const unread = await changelogService.getUnread(1, 10);
            const unreadCount = await changelogService.getUnreadCount(1);

            // All returned entries must have publishDate > lastSeen
            for (const entry of unread) {
              expect((entry.publishDate as Date).getTime()).toBeGreaterThan(
                lastSeen.getTime(),
              );
            }

            // Expected unread: published entries with publishDate > lastSeen
            const expectedUnread = entries.filter(
              (e) => e.publishDate.getTime() > lastSeen.getTime(),
            );

            // Count should match (up to limit of 10)
            expect(unreadCount).toBe(expectedUnread.length);
            expect(unread.length).toBe(Math.min(expectedUnread.length, 10));

            // Unread should be sorted by publishDate desc
            for (let i = 1; i < unread.length; i++) {
              const prev = (unread[i - 1].publishDate as Date).getTime();
              const curr = (unread[i].publishDate as Date).getTime();
              expect(prev).toBeGreaterThanOrEqual(curr);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
