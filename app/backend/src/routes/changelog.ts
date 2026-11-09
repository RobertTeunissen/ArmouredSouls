import express, { Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { validateRequest, validated } from '../middleware/schemaValidator';
import { positiveIntParam } from '../utils/securityValidation';
import { changelogService, processAndStore } from '../services/changelog';
import { ChangelogError, ChangelogErrorCode } from '../errors/changelogErrors';
import { fileValidationService } from '../services/moderation/fileValidationService';
import { handleMulterError } from '../middleware/handleMulterError';
import { recordAction as recordAdminAction } from '../services/admin/adminAuditLogService';

const router = express.Router();

// --- Zod schemas for changelog routes ---

// Safe imageUrl pattern: only allow /uploads/changelog/{uuid}.webp or null
const safeChangelogImageUrl = z.string().max(500).regex(
  /^\/uploads\/changelog\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/,
  'imageUrl must match /uploads/changelog/{uuid}.webp pattern',
).nullable().optional();

const createEntrySchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
  category: z.enum(['balance', 'feature', 'bugfix', 'economy']),
  status: z.enum(['draft', 'published']).default('draft'),
  imageUrl: safeChangelogImageUrl,
});

const updateEntrySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().min(1).max(5000).optional(),
  category: z.enum(['balance', 'feature', 'bugfix', 'economy']).optional(),
  status: z.enum(['draft', 'published']).optional(),
  imageUrl: safeChangelogImageUrl,
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
  category: z.enum(['balance', 'feature', 'bugfix', 'economy']).optional(),
});

const entryIdParamsSchema = z.object({
  id: positiveIntParam,
});

// --- Multer config for image uploads (memory storage, 2 MB limit) ---
const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

// --- Player endpoints ---

// GET /api/changelog — list published entries (paginated, filterable by category)
router.get('/', authenticateToken, ...validated({ query: listQuerySchema }, async (req: AuthRequest, res: Response, { query }) => {
  const { page, perPage, category } = query as unknown as { page: number; perPage: number; category?: string };
  const result = await changelogService.listPublished(page, perPage, category);
  res.json(result);
}));

// GET /api/changelog/unread — get unread entries for current user
router.get('/unread', authenticateToken, validateRequest({}), async (req: AuthRequest, res: Response) => {
  const entries = await changelogService.getUnread(req.user!.userId);
  res.json(entries);
});

// POST /api/changelog/dismiss — update lastSeenChangelog to now
router.post('/dismiss', authenticateToken, validateRequest({}), async (req: AuthRequest, res: Response) => {
  await changelogService.dismiss(req.user!.userId);
  res.json({ success: true });
});

// --- Admin endpoints ---

// Lenient on purpose (unchanged behaviour): a missing or malformed value falls back to page 1 / 20 per page.
const adminListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().catch(undefined),
  perPage: z.coerce.number().int().positive().max(100).optional().catch(undefined),
});

// GET /api/changelog/admin — list all entries (drafts + published)
router.get('/admin', authenticateToken, requireAdmin, ...validated({ query: adminListQuerySchema }, async (_req: AuthRequest, res: Response, { query }) => {
  const result = await changelogService.listAll(query.page ?? 1, query.perPage ?? 20);
  res.json(result);
}));

// POST /api/changelog/admin — create new entry
router.post('/admin', authenticateToken, requireAdmin, ...validated({ body: createEntrySchema }, async (req: AuthRequest, res: Response, { body }) => {
  const entry = await changelogService.create({
    ...body,
    createdBy: req.user!.userId,
  });
  recordAdminAction(req.user!.userId, 'changelog_create', 'success', { entryId: entry.id, title: entry.title, status: entry.status });
  res.status(201).json(entry);
}));

// PUT /api/changelog/admin/:id — update entry
router.put('/admin/:id', authenticateToken, requireAdmin, ...validated({ params: entryIdParamsSchema, body: updateEntrySchema }, async (req: AuthRequest, res: Response, { params, body }) => {
  const id = params.id;
  const entry = await changelogService.update(id, body);
  // Field names only, never the body text.
  recordAdminAction(req.user!.userId, 'changelog_update', 'success', { entryId: entry.id, title: entry.title, fields: Object.keys(body) });
  res.json(entry);
}));

// DELETE /api/changelog/admin/:id — delete entry
router.delete('/admin/:id', authenticateToken, requireAdmin, ...validated({ params: entryIdParamsSchema }, async (req: AuthRequest, res: Response, { params }) => {
  const id = params.id;
  await changelogService.delete(id);
  recordAdminAction(req.user!.userId, 'changelog_delete', 'success', { entryId: id });
  res.status(204).send();
}));

// POST /api/changelog/admin/:id/publish — publish a draft entry
router.post('/admin/:id/publish', authenticateToken, requireAdmin, ...validated({ params: entryIdParamsSchema }, async (req: AuthRequest, res: Response, { params }) => {
  const id = params.id;
  const entry = await changelogService.publish(id);
  recordAdminAction(req.user!.userId, 'changelog_publish', 'success', { entryId: entry.id, title: entry.title });
  res.json(entry);
}));

// POST /api/changelog/admin/upload-image — upload and process changelog image
router.post(
  '/admin/upload-image',
  authenticateToken,
  requireAdmin,
  multerUpload.single('image'),
  handleMulterError,
  validateRequest({}),
  async (req: AuthRequest, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: 'No image file provided', code: 'INVALID_IMAGE' });
      return;
    }

    // Validate magic bytes and dimensions (reuses robot upload validation)
    const validation = await fileValidationService.validateImage(req.file.buffer, req.file.mimetype);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error, code: 'INVALID_IMAGE' });
      return;
    }

    try {
      const imageUrl = await processAndStore(req.file.buffer);
      res.json({ imageUrl });
    } catch {
      throw new ChangelogError(
        ChangelogErrorCode.CHANGELOG_IMAGE_ERROR,
        'Failed to process image',
        500,
      );
    }
  },
);

export default router;
