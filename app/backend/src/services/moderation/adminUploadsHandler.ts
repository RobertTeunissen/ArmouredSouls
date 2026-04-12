/**
 * Admin Uploads Handler
 *
 * GET  /api/admin/uploads         — paginated list of uploaded images (from AuditLog)
 * POST /api/admin/uploads/cleanup — trigger on-demand orphan cleanup
 *
 * @module services/moderation/adminUploadsHandler
 */

import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { runOrphanCleanup } from './orphanCleanupJob';

interface AdminUploadEntry {
  userId: number;
  username: string;
  robotId: number;
  robotName: string;
  imageUrl: string;
  fileSize: number;
  uploadDate: string;
}

interface AdminUploadsResponse {
  uploads: AdminUploadEntry[];
  total: number;
  page: number;
  limit: number;
}

/**
 * GET /api/admin/uploads
 *
 * Query AuditLog for image_upload_success events with optional filtering
 * by userId, startDate, endDate. Paginated with page/limit.
 */
export async function handleAdminUploads(req: AuthRequest, res: Response): Promise<void> {
  const page = Math.max(1, parseInt(String(req.query.page)) || 1);
  const limit = Math.min(Math.max(1, parseInt(String(req.query.limit)) || 50), 200);
  const userId = req.query.userId ? parseInt(String(req.query.userId)) : undefined;
  const startDate = req.query.startDate ? new Date(String(req.query.startDate)) : undefined;
  const endDate = req.query.endDate ? new Date(String(req.query.endDate)) : undefined;

  // Build where clause
  const where: Record<string, unknown> = { eventType: 'image_upload_success' };
  if (userId !== undefined) {
    where.userId = userId;
  }
  if (startDate || endDate) {
    const dateFilter: Record<string, Date> = {};
    if (startDate) dateFilter.gte = startDate;
    if (endDate) dateFilter.lte = endDate;
    where.eventTimestamp = dateFilter;
  }

  // Query total count and page of results in a transaction
  const [total, logs] = await prisma.$transaction([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { eventTimestamp: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  // Resolve usernames and robot names via separate queries
  const userIds = [...new Set(logs.map((l) => l.userId).filter((id): id is number => id !== null))];
  const users = userIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, username: true },
      })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u.username]));

  const robotIds = [...new Set(
    logs.map((l) => (l.payload as Record<string, unknown>)?.robotId as number).filter((id): id is number => typeof id === 'number'),
  )];
  const robots = robotIds.length > 0
    ? await prisma.robot.findMany({
        where: { id: { in: robotIds } },
        select: { id: true, name: true },
      })
    : [];
  const robotMap = new Map(robots.map((r) => [r.id, r.name]));

  // Map to response format
  const uploads: AdminUploadEntry[] = logs.map((log) => {
    const payload = log.payload as Record<string, unknown>;
    return {
      userId: log.userId ?? 0,
      username: userMap.get(log.userId ?? 0) ?? '(unknown)',
      robotId: (payload.robotId as number) ?? 0,
      robotName: robotMap.get(payload.robotId as number) ?? '(deleted)',
      imageUrl: (payload.imageUrl as string) ?? '',
      fileSize: (payload.fileSize as number) ?? 0,
      uploadDate: log.eventTimestamp.toISOString(),
    };
  });

  const response: AdminUploadsResponse = { uploads, total, page, limit };
  res.status(200).json(response);
}

/**
 * POST /api/admin/uploads/cleanup
 *
 * Trigger on-demand orphan cleanup and return the result.
 */
export async function handleAdminCleanup(req: AuthRequest, res: Response): Promise<void> {
  logger.info('[Admin] Triggering on-demand orphan image cleanup...');
  const result = await runOrphanCleanup();
  res.status(200).json({ success: true, ...result });
}
