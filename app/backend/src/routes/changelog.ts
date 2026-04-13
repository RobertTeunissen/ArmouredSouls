import express, { Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { validateRequest } from '../middleware/schemaValidator';
import { positiveIntParam } from '../utils/securityValidation';
import { changelogService, processAndStore } from '../services/changelog';

const router = express.Router();

// --- Zod schemas for changelog routes ---

const createEntrySchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
  category: z.enum(['balance', 'feature', 'bugfix', 'economy']),
  status: z.enum(['draft', 'published']).default('draft'),
  imageUrl: z.string().max(500).nullable().optional(),
  sourceType: z.enum(['spec', 'commit', 'manual']).optional(),
  sourceRef: z.string().max(200).optional(),
});

const updateEntrySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().min(1).max(5000).optional(),
  category: z.enum(['balance', 'feature', 'bugfix', 'economy']).optional(),
  status: z.enum(['draft', 'published']).optional(),
  imageUrl: z.string().max(500).nullable().optional(),
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

/** Translate MulterError into structured JSON responses. */
function handleMulterError(err: unknown, _req: express.Request, res: Response, next: express.NextFunction): void {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: 'File too large. Maximum size is 2 MB.', code: 'FILE_TOO_LARGE' });
      return;
    }
    res.status(400).json({ error: err.message, code: 'INVALID_IMAGE' });
    return;
  }
  next(err);
}

// --- Player endpoints ---

// GET /api/changelog — list published entries (paginated, filterable by category)
router.get('/', authenticateToken, validateRequest({ query: listQuerySchema }), async (req: AuthRequest, res: Response) => {
  const { page, perPage, category } = req.query as unknown as { page: number; perPage: number; category?: string };
  const result = await changelogService.listPublished(page, perPage, category);
  res.json(result);
});

// GET /api/changelog/unread — get unread entries for current user
router.get('/unread', authenticateToken, validateRequest({}), async (req: AuthRequest, res: Response) => {
  const entries = await changelogService.getUnread(req.user!.userId);
  res.json(entries);
});

// GET /api/changelog/unread/count — get count of unread entries
router.get('/unread/count', authenticateToken, validateRequest({}), async (req: AuthRequest, res: Response) => {
  const count = await changelogService.getUnreadCount(req.user!.userId);
  res.json({ count });
});

// POST /api/changelog/dismiss — update lastSeenChangelog to now
router.post('/dismiss', authenticateToken, validateRequest({}), async (req: AuthRequest, res: Response) => {
  await changelogService.dismiss(req.user!.userId);
  res.json({ success: true });
});

// --- Admin endpoints ---

// GET /api/changelog/admin — list all entries (drafts + published)
router.get('/admin', authenticateToken, requireAdmin, validateRequest({}), async (req: AuthRequest, res: Response) => {
  const page = Number(req.query.page) || 1;
  const perPage = Number(req.query.perPage) || 20;
  const result = await changelogService.listAll(page, perPage);
  res.json(result);
});

// POST /api/changelog/admin — create new entry
router.post('/admin', authenticateToken, requireAdmin, validateRequest({ body: createEntrySchema }), async (req: AuthRequest, res: Response) => {
  const entry = await changelogService.create({
    ...req.body,
    createdBy: req.user!.userId,
  });
  res.status(201).json(entry);
});

// PUT /api/changelog/admin/:id — update entry
router.put('/admin/:id', authenticateToken, requireAdmin, validateRequest({ params: entryIdParamsSchema, body: updateEntrySchema }), async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const entry = await changelogService.update(id, req.body);
  res.json(entry);
});

// DELETE /api/changelog/admin/:id — delete entry
router.delete('/admin/:id', authenticateToken, requireAdmin, validateRequest({ params: entryIdParamsSchema }), async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  await changelogService.delete(id);
  res.status(204).send();
});

// POST /api/changelog/admin/:id/publish — publish a draft entry
router.post('/admin/:id/publish', authenticateToken, requireAdmin, validateRequest({ params: entryIdParamsSchema }), async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const entry = await changelogService.publish(id);
  res.json(entry);
});

// POST /api/changelog/admin/upload-image — upload and process changelog image
router.post(
  '/admin/upload-image',
  authenticateToken,
  requireAdmin,
  multerUpload.single('image'),
  handleMulterError,
  async (req: AuthRequest, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: 'No image file provided', code: 'INVALID_IMAGE' });
      return;
    }
    const imageUrl = await processAndStore(req.file.buffer);
    res.json({ imageUrl });
  },
);

export default router;
