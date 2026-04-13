/**
 * Unit tests for ChangelogService.
 *
 * Tests CRUD operations, player-facing queries, unread detection,
 * dismiss, publish, and error handling.
 *
 * _Requirements: 1.1, 1.4, 1.5, 1.6, 2.3, 2.4, 2.5, 6.5, 7.5_
 */

// --- Mocks (before imports) ---

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    changelogEntry: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
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

import prisma from '../../../lib/prisma';
import { changelogService } from '../changelogService';
import { ChangelogError, ChangelogErrorCode } from '../../../errors/changelogErrors';
import { deleteImage } from '../changelogImageService';

// --- Helpers ---

function makeEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    title: 'Test Entry',
    body: 'Test body content',
    category: 'feature',
    status: 'published',
    imageUrl: null,
    publishDate: new Date('2025-06-01T12:00:00Z'),
    sourceType: null,
    sourceRef: null,
    createdBy: null,
    createdAt: new Date('2025-06-01T10:00:00Z'),
    updatedAt: new Date('2025-06-01T10:00:00Z'),
    ...overrides,
  };
}

// --- Tests ---

describe('ChangelogService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── listPublished ──────────────────────────────────────────────────

  describe('listPublished', () => {
    it('should return only published entries in publishDate desc order', async () => {
      const published1 = makeEntry({ id: 1, publishDate: new Date('2025-06-01') });
      const published2 = makeEntry({ id: 2, publishDate: new Date('2025-06-02') });

      (prisma.changelogEntry.findMany as jest.Mock).mockResolvedValue([published2, published1]);
      (prisma.changelogEntry.count as jest.Mock).mockResolvedValue(2);

      const result = await changelogService.listPublished(1, 20);

      expect(prisma.changelogEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'published' },
          orderBy: { publishDate: 'desc' },
          skip: 0,
          take: 20,
        }),
      );
      expect(result.entries).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.perPage).toBe(20);
    });

    it('should filter by category when provided', async () => {
      (prisma.changelogEntry.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.changelogEntry.count as jest.Mock).mockResolvedValue(0);

      await changelogService.listPublished(1, 20, 'bugfix');

      expect(prisma.changelogEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'published', category: 'bugfix' },
        }),
      );
    });

    it('should clamp perPage to max 100', async () => {
      (prisma.changelogEntry.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.changelogEntry.count as jest.Mock).mockResolvedValue(0);

      await changelogService.listPublished(1, 200);

      expect(prisma.changelogEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });

    it('should clamp page to minimum 1', async () => {
      (prisma.changelogEntry.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.changelogEntry.count as jest.Mock).mockResolvedValue(0);

      const result = await changelogService.listPublished(0, 20);

      expect(prisma.changelogEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0 }),
      );
      expect(result.page).toBe(1);
    });
  });

  // ── getUnread ─────────────────────────────────────────────────────

  describe('getUnread', () => {
    it('should return only entries after lastSeenChangelog', async () => {
      const lastSeen = new Date('2025-06-01T00:00:00Z');
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ lastSeenChangelog: lastSeen });

      const unreadEntry = makeEntry({ id: 1, publishDate: new Date('2025-06-02') });
      (prisma.changelogEntry.findMany as jest.Mock).mockResolvedValue([unreadEntry]);

      const result = await changelogService.getUnread(42);

      expect(prisma.changelogEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: 'published',
            publishDate: { gt: lastSeen },
          },
          orderBy: { publishDate: 'desc' },
          take: 10,
        }),
      );
      expect(result).toHaveLength(1);
    });

    it('should return empty array if user not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await changelogService.getUnread(999);

      expect(result).toEqual([]);
      expect(prisma.changelogEntry.findMany).not.toHaveBeenCalled();
    });

    it('should clamp limit to max 10', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        lastSeenChangelog: new Date(),
      });
      (prisma.changelogEntry.findMany as jest.Mock).mockResolvedValue([]);

      await changelogService.getUnread(1, 50);

      expect(prisma.changelogEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 }),
      );
    });
  });

  // ── getUnreadCount ────────────────────────────────────────────────

  describe('getUnreadCount', () => {
    it('should return correct count of unread entries', async () => {
      const lastSeen = new Date('2025-06-01T00:00:00Z');
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ lastSeenChangelog: lastSeen });
      (prisma.changelogEntry.count as jest.Mock).mockResolvedValue(5);

      const count = await changelogService.getUnreadCount(42);

      expect(prisma.changelogEntry.count).toHaveBeenCalledWith({
        where: {
          status: 'published',
          publishDate: { gt: lastSeen },
        },
      });
      expect(count).toBe(5);
    });

    it('should return 0 if user not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const count = await changelogService.getUnreadCount(999);

      expect(count).toBe(0);
    });
  });

  // ── dismiss ───────────────────────────────────────────────────────

  describe('dismiss', () => {
    it('should update lastSeenChangelog to current time', async () => {
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      const before = new Date();
      await changelogService.dismiss(42);
      const after = new Date();

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 42 },
        data: { lastSeenChangelog: expect.any(Date) },
      });

      const calledDate = (prisma.user.update as jest.Mock).mock.calls[0][0].data.lastSeenChangelog as Date;
      expect(calledDate.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(calledDate.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  // ── create ──────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create an entry with valid data', async () => {
      const input = {
        title: 'New Feature',
        body: 'Description of the feature',
        category: 'feature',
      };
      const created = makeEntry({ ...input, status: 'draft', publishDate: null });
      (prisma.changelogEntry.create as jest.Mock).mockResolvedValue(created);

      const result = await changelogService.create(input);

      expect(prisma.changelogEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'New Feature',
          body: 'Description of the feature',
          category: 'feature',
          status: 'draft',
          publishDate: null,
        }),
      });
      expect(result).toEqual(created);
    });

    it('should set publishDate when status is published', async () => {
      const input = {
        title: 'Published Entry',
        body: 'Body text',
        category: 'balance',
        status: 'published',
      };
      const created = makeEntry({ ...input, publishDate: new Date() });
      (prisma.changelogEntry.create as jest.Mock).mockResolvedValue(created);

      await changelogService.create(input);

      expect(prisma.changelogEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'published',
          publishDate: expect.any(Date),
        }),
      });
    });
  });

  // ── update ────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update with partial data', async () => {
      const existing = makeEntry({ id: 1, status: 'draft' });
      (prisma.changelogEntry.findUnique as jest.Mock).mockResolvedValue(existing);
      const updated = makeEntry({ id: 1, title: 'Updated Title' });
      (prisma.changelogEntry.update as jest.Mock).mockResolvedValue(updated);

      const result = await changelogService.update(1, { title: 'Updated Title' });

      expect(prisma.changelogEntry.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { title: 'Updated Title' },
      });
      expect(result).toEqual(updated);
    });

    it('should set publishDate when transitioning to published', async () => {
      const existing = makeEntry({ id: 1, status: 'draft' });
      (prisma.changelogEntry.findUnique as jest.Mock).mockResolvedValue(existing);
      (prisma.changelogEntry.update as jest.Mock).mockResolvedValue(
        makeEntry({ id: 1, status: 'published' }),
      );

      await changelogService.update(1, { status: 'published' });

      expect(prisma.changelogEntry.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          status: 'published',
          publishDate: expect.any(Date),
        }),
      });
    });

    it('should throw CHANGELOG_NOT_FOUND for missing entry', async () => {
      (prisma.changelogEntry.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(changelogService.update(999, { title: 'X' })).rejects.toThrow(ChangelogError);
      await expect(changelogService.update(999, { title: 'X' })).rejects.toMatchObject({
        code: ChangelogErrorCode.CHANGELOG_NOT_FOUND,
      });
    });
  });

  // ── delete ────────────────────────────────────────────────────────

  describe('delete', () => {
    it('should delete entry and clean up image if present', async () => {
      const existing = makeEntry({ id: 1, imageUrl: '/uploads/changelog/abc.webp' });
      (prisma.changelogEntry.findUnique as jest.Mock).mockResolvedValue(existing);
      (prisma.changelogEntry.delete as jest.Mock).mockResolvedValue(existing);
      (deleteImage as jest.Mock).mockResolvedValue(undefined);

      await changelogService.delete(1);

      expect(deleteImage).toHaveBeenCalledWith('/uploads/changelog/abc.webp');
      expect(prisma.changelogEntry.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('should delete entry without image cleanup when no imageUrl', async () => {
      const existing = makeEntry({ id: 1, imageUrl: null });
      (prisma.changelogEntry.findUnique as jest.Mock).mockResolvedValue(existing);
      (prisma.changelogEntry.delete as jest.Mock).mockResolvedValue(existing);

      await changelogService.delete(1);

      expect(deleteImage).not.toHaveBeenCalled();
      expect(prisma.changelogEntry.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('should throw CHANGELOG_NOT_FOUND for missing entry', async () => {
      (prisma.changelogEntry.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(changelogService.delete(999)).rejects.toThrow(ChangelogError);
      await expect(changelogService.delete(999)).rejects.toMatchObject({
        code: ChangelogErrorCode.CHANGELOG_NOT_FOUND,
      });
    });
  });

  // ── publish ───────────────────────────────────────────────────────

  describe('publish', () => {
    it('should set status to published and publishDate to now', async () => {
      const existing = makeEntry({ id: 1, status: 'draft', publishDate: null });
      (prisma.changelogEntry.findUnique as jest.Mock).mockResolvedValue(existing);
      const published = makeEntry({ id: 1, status: 'published', publishDate: new Date() });
      (prisma.changelogEntry.update as jest.Mock).mockResolvedValue(published);

      const before = new Date();
      const result = await changelogService.publish(1);
      const after = new Date();

      expect(prisma.changelogEntry.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          status: 'published',
          publishDate: expect.any(Date),
        },
      });

      const calledDate = (prisma.changelogEntry.update as jest.Mock).mock.calls[0][0].data.publishDate as Date;
      expect(calledDate.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(calledDate.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(result.status).toBe('published');
    });

    it('should throw CHANGELOG_NOT_FOUND for missing entry', async () => {
      (prisma.changelogEntry.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(changelogService.publish(999)).rejects.toThrow(ChangelogError);
      await expect(changelogService.publish(999)).rejects.toMatchObject({
        code: ChangelogErrorCode.CHANGELOG_NOT_FOUND,
      });
    });
  });
});
