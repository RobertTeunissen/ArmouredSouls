import express, { Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { authenticateDeployToken, DeployRequest } from '../middleware/deployToken';
import { validateRequest } from '../middleware/schemaValidator';
import { positiveIntParam } from '../utils/securityValidation';
import { changelogService, processAndStore } from '../services/changelog';
import { ChangelogError, ChangelogErrorCode } from '../errors/changelogErrors';
import { fileValidationService } from '../services/moderation/fileValidationService';
import { handleMulterError } from '../middleware/handleMulterError';

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
  sourceType: z.enum(['spec', 'commit', 'manual']).optional(),
  sourceRef: z.string().max(200).optional(),
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

// --- Deploy endpoint (CI/CD service token auth) ---

// POST /api/changelog/deploy — create draft entry via deploy token (used by GitHub Actions)
router.post('/deploy', authenticateDeployToken, validateRequest({ body: createEntrySchema }), async (req: DeployRequest, res: Response) => {
  const entry = await changelogService.create({
    ...req.body,
    status: 'draft', // deploy endpoint always creates drafts, never published
    createdBy: null, // deploy script has no user context
  });
  res.status(201).json(entry);
});

// GET /api/changelog/deploy/sources — list existing sourceRefs for idempotency checks
router.get('/deploy/sources', authenticateDeployToken, validateRequest({}), async (_req: DeployRequest, res: Response) => {
  const sourceRefs = await changelogService.listAllSourceRefs();
  res.json({ sourceRefs });
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
