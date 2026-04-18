/**
 * Changelog service — business logic for CRUD operations and player-facing queries.
 *
 * Handles entry creation, updates, deletion, publishing, pagination,
 * and unread detection based on per-user lastSeenChangelog timestamps.
 *
 * @module services/changelog/changelogService
 */

import type { ChangelogEntry } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import { ChangelogError, ChangelogErrorCode } from '../../errors/changelogErrors';
import { deleteImage } from './changelogImageService';

export interface CreateChangelogInput {
  title: string;
  body: string;
  category: string;
  status?: string;
  imageUrl?: string | null;
  sourceType?: string | null;
  sourceRef?: string | null;
  createdBy?: number | null;
}

export interface UpdateChangelogInput {
  title?: string;
  body?: string;
  category?: string;
  status?: string;
  imageUrl?: string | null;
}

export interface PaginatedResult<T> {
  entries: T[];
  total: number;
  page: number;
  perPage: number;
}

class ChangelogService {
  /**
   * List published entries for players, ordered by publishDate desc.
   * Supports optional category filtering and pagination.
   */
  async listPublished(
    page: number,
    perPage: number,
    category?: string,
  ): Promise<PaginatedResult<ChangelogEntry>> {
    const take = Math.min(Math.max(perPage, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;

    const where = {
      status: 'published' as const,
      ...(category ? { category } : {}),
    };

    const [entries, total] = await Promise.all([
      prisma.changelogEntry.findMany({
        where,
        orderBy: { publishDate: 'desc' },
        skip,
        take,
      }),
      prisma.changelogEntry.count({ where }),
    ]);

    return { entries, total, page: Math.max(page, 1), perPage: take };
  }

  /**
   * Get unread published entries for a player.
   * Returns entries with publishDate after the user's lastSeenChangelog, max 10.
   */
  async getUnread(userId: number, limit = 10): Promise<ChangelogEntry[]> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { lastSeenChangelog: true },
    });

    if (!user) {
      return [];
    }

    return prisma.changelogEntry.findMany({
      where: {
        status: 'published',
        publishDate: { gt: user.lastSeenChangelog },
      },
      orderBy: { publishDate: 'desc' },
      take: Math.min(Math.max(limit, 1), 10),
    });
  }

  /**
   * Get count of unread published entries for a player.
   */
  async getUnreadCount(userId: number): Promise<number> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { lastSeenChangelog: true },
    });

    if (!user) {
      return 0;
    }

    return prisma.changelogEntry.count({
      where: {
        status: 'published',
        publishDate: { gt: user.lastSeenChangelog },
      },
    });
  }

  /**
   * Dismiss changelog — updates the user's lastSeenChangelog to now.
   */
  async dismiss(userId: number): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { lastSeenChangelog: new Date() },
    });
  }

  /**
   * List all non-null sourceRefs across all entries.
   * Used by the deploy endpoint for idempotency checks.
   */
  async listAllSourceRefs(): Promise<string[]> {
    const entries = await prisma.changelogEntry.findMany({
      where: { sourceRef: { not: null } },
      select: { sourceRef: true },
    });
    return entries
      .map((e) => e.sourceRef)
      .filter((ref): ref is string => ref != null);
  }

  /**
   * List all entries (drafts + published) for admin, ordered by createdAt desc.
   */
  async listAll(
    page: number,
    perPage: number,
  ): Promise<PaginatedResult<ChangelogEntry>> {
    const take = Math.min(Math.max(perPage, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;

    const [entries, total] = await Promise.all([
      prisma.changelogEntry.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.changelogEntry.count(),
    ]);

    return { entries, total, page: Math.max(page, 1), perPage: take };
  }

  /**
   * Create a new changelog entry. Sets publishDate if status is "published".
   */
  async create(data: CreateChangelogInput): Promise<ChangelogEntry> {
    return prisma.changelogEntry.create({
      data: {
        title: data.title,
        body: data.body,
        category: data.category,
        status: data.status ?? 'draft',
        imageUrl: data.imageUrl ?? null,
        publishDate: data.status === 'published' ? new Date() : null,
        sourceType: data.sourceType ?? null,
        sourceRef: data.sourceRef ?? null,
        createdBy: data.createdBy ?? null,
      },
    });
  }

  /**
   * Partial update of a changelog entry. Throws CHANGELOG_NOT_FOUND if missing.
   */
  async update(id: number, data: UpdateChangelogInput): Promise<ChangelogEntry> {
    const existing = await prisma.changelogEntry.findUnique({ where: { id } });
    if (!existing) {
      throw new ChangelogError(
        ChangelogErrorCode.CHANGELOG_NOT_FOUND,
        `Changelog entry ${id} not found`,
        404,
      );
    }

    const updateData: Record<string, unknown> = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.body !== undefined) updateData.body = data.body;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
    if (data.status !== undefined) {
      updateData.status = data.status;
      // Set publishDate when transitioning to published
      if (data.status === 'published' && existing.status !== 'published') {
        updateData.publishDate = new Date();
      }
    }

    return prisma.changelogEntry.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Delete a changelog entry. Cleans up associated image if present.
   * Throws CHANGELOG_NOT_FOUND if missing.
   */
  async delete(id: number): Promise<void> {
    const existing = await prisma.changelogEntry.findUnique({ where: { id } });
    if (!existing) {
      throw new ChangelogError(
        ChangelogErrorCode.CHANGELOG_NOT_FOUND,
        `Changelog entry ${id} not found`,
        404,
      );
    }

    if (existing.imageUrl) {
      await deleteImage(existing.imageUrl);
    }

    await prisma.changelogEntry.delete({ where: { id } });
  }

  /**
   * Publish a draft entry — sets status to "published" and publishDate to now.
   * Throws CHANGELOG_NOT_FOUND if missing.
   */
  async publish(id: number): Promise<ChangelogEntry> {
    const existing = await prisma.changelogEntry.findUnique({ where: { id } });
    if (!existing) {
      throw new ChangelogError(
        ChangelogErrorCode.CHANGELOG_NOT_FOUND,
        `Changelog entry ${id} not found`,
        404,
      );
    }

    // Only allow draft → published transition
    if (existing.status === 'published') {
      return existing;
    }

    return prisma.changelogEntry.update({
      where: { id },
      data: {
        status: 'published',
        publishDate: new Date(),
      },
    });
  }
}

export const changelogService = new ChangelogService();
