/**
 * Admin_Automaton_Control routes (Spec #55, R2.2–R2.8, R3.5–R3.12, R6.4,
 * R6.5, R11.1–R11.6, design §17.1, task 9.3).
 *
 * Mounted at `/api/admin/automatons`. Every route is admin-only
 * (`authenticateToken` + `requireAdmin`), validates params, query and body
 * with `validateRequest` + Zod (bodies are strict, so an `imageUrl` cannot be
 * set outside the upload endpoint, R3.2/R3.10) and leaves errors to the
 * shared `errorHandler`. Every mutation, completed or rejected, records
 * exactly one admin audit entry (R11.3): a handler records its success; the
 * router's error middleware records the rejection, including a validation
 * failure, which happens before the handler runs.
 *
 * Static paths are registered before `/:key`. There are deliberately no
 * routes that run a turn, delete an active stable, edit live robots, teams,
 * subscriptions or weapons, or change a balance (R2.4, R11.5). The
 * Strategy_Library, Strategy_Comparison, Strategy_Draft, upgrade and status
 * endpoints are added to this router by tasks 9.6–9.10.
 */
import express, { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { validateRequest } from '../middleware/schemaValidator';
import { handleMulterError } from '../middleware/handleMulterError';
import { AppError } from '../errors/AppError';
import { AutomatonError, AutomatonErrorCode } from '../errors/automatonErrors';
import { paginationQuery, positiveIntParam, stableName } from '../utils/securityValidation';
import { recordAction } from '../services/admin/adminAuditLogService';
import {
  backstorySchema,
  blueprintFieldsSchema,
  CATALOGUE_KEY_PATTERN,
  catalogueKeySchema,
  eventOrderSchema,
  franchiseSchema,
  MAX_BLUEPRINTS,
  teamNamesSchema,
} from '../services/automaton/automatonCatalogueService';
import { strategyKeySchema } from '../services/automaton/strategies/strategyDefinitionSchema';
import {
  activateAllDrafts,
  activateProfile,
  addBlueprint,
  createDraft,
  deleteBlueprint,
  deleteDraft,
  getProfileDetail,
  listProfiles,
  listTurnRecords,
  updateBlueprint,
  updateProfile,
  updateStrategy,
} from '../services/automaton/automatonProfileService';
import { storeBlueprintImage } from '../services/automaton/automatonImageService';
import { previewProfileTurn } from '../services/automaton/turnPreview';
import { getProgramSwitch, setProgramSwitch } from '../services/automaton/programSwitch';
import { getLastCatalogueSyncSummary } from '../services/automaton/catalogueSync';
import { exportCatalogue } from '../services/automaton/catalogueExport';

const router = express.Router();
router.use(authenticateToken);
router.use(requireAdmin);

// ── Audit (R11.3) ────────────────────────────────────────────────────

interface AuditState {
  operation: string;
  catalogueKey: string;
  recorded: boolean;
}

const AUDIT_PREFIX = 'automaton';

/** A Catalogue_Key fit for the audit summary: the submitted key only when it has the key shape. */
function auditKey(value: unknown): string {
  return typeof value === 'string' && CATALOGUE_KEY_PATTERN.test(value) ? value : 'invalid';
}

/** Mark a mutation route: names the audit operation and where its Catalogue_Key comes from. */
function audited(operation: string, key: 'param' | 'body' | 'all') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const body = req.body as Record<string, unknown> | undefined;
    const catalogueKey = key === 'all' ? 'all' : auditKey(key === 'param' ? req.params.key : body?.catalogueKey);
    const state: AuditState = { operation: `${AUDIT_PREFIX}.${operation}`, catalogueKey, recorded: false };
    res.locals.automatonAudit = state;
    next();
  };
}

function auditState(res: Response): AuditState | undefined {
  return res.locals.automatonAudit as AuditState | undefined;
}

/** Field names of the request body (never the values). */
function fieldNames(req: Request): string[] {
  const body = req.body as unknown;
  return body !== null && typeof body === 'object' && !Array.isArray(body) ? Object.keys(body as object) : [];
}

function recordSuccess(req: AuthRequest, res: Response, summary: Record<string, unknown>): void {
  const state = auditState(res);
  if (!state || state.recorded || !req.user) return;
  state.recorded = true;
  recordAction(req.user.userId, state.operation, 'success', { catalogueKey: state.catalogueKey, outcome: 'completed', ...summary });
}

function recordRejection(req: AuthRequest, res: Response, error: unknown): void {
  const state = auditState(res);
  if (!state || state.recorded || !req.user || req.user.role !== 'admin') return;
  state.recorded = true;
  const code = error instanceof AppError ? error.code : error instanceof multer.MulterError ? error.code : 'UNEXPECTED_ERROR';
  recordAction(req.user.userId, state.operation, 'failure', {
    catalogueKey: state.catalogueKey,
    outcome: 'rejected',
    code,
    fields: fieldNames(req),
  });
}

// ── Schemas ──────────────────────────────────────────────────────────

const keyParams = z.object({ key: catalogueKeySchema }).strict();
const slotParam = positiveIntParam.pipe(z.number().int().max(MAX_BLUEPRINTS, `Blueprint slot must be 1–${MAX_BLUEPRINTS}`));
const slotParams = z.object({ key: catalogueKeySchema, slot: slotParam }).strict();
const blueprintSlot = z.number().int().min(1).max(MAX_BLUEPRINTS);

const listQuery = paginationQuery.extend({
  status: z.enum(['draft', 'active']).optional(),
  strategy: strategyKeySchema.optional(),
});

const exportQuery = z.object({
  keys: z.string().max(2_000).optional()
    .transform((value) => (value ? value.split(',').map((k) => k.trim()).filter((k) => k.length > 0) : []))
    .pipe(z.array(catalogueKeySchema).max(500)),
}).strict();

const programBody = z.object({ turnsEnabled: z.boolean() }).strict();

const createBody = z.object({
  catalogueKey: catalogueKeySchema,
  stableName,
  franchise: franchiseSchema,
  backstory: backstorySchema,
  strategyKey: strategyKeySchema,
  eventOrder: eventOrderSchema.optional(),
  teamNames: teamNamesSchema.optional(),
}).strict();

const updateBody = z.object({
  stableName: stableName.optional(),
  franchise: franchiseSchema.optional(),
  backstory: backstorySchema.optional(),
  teamNames: teamNamesSchema.optional(),
  eventOrder: eventOrderSchema.optional(),
}).strict().refine((body) => Object.keys(body).length > 0, 'Send at least one field to change');

const goalIdSchema = z.string().min(1).max(80);
const strategyBody = z.object({
  strategyKey: strategyKeySchema,
  targets: z.record(goalIdSchema, z.number().int()).optional(),
  teamNames: teamNamesSchema.optional(),
}).strict();

const addBlueprintBody = blueprintFieldsSchema.extend({
  slot: blueprintSlot.optional(),
  teamNames: teamNamesSchema.optional(),
}).strict();

const updateBlueprintBody = blueprintFieldsSchema.partial().extend({ slot: blueprintSlot.optional() }).strict()
  .refine((body) => Object.keys(body).length > 0, 'Send at least one field to change');

const deleteBlueprintBody = z.object({ teamNames: teamNamesSchema.optional() }).strict().optional();

// --- Multer config for blueprint images (memory storage, 2 MB limit, as the robot upload) ---
const multerUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

/** Multer rejections are answered by `handleMulterError`; audit them first. */
function auditMulterError(err: unknown, req: Request, res: Response, next: NextFunction): void {
  if (err instanceof multer.MulterError) recordRejection(req as AuthRequest, res, err);
  handleMulterError(err, req, res, next);
}

// ── Static paths ─────────────────────────────────────────────────────

router.get('/program', validateRequest({}), async (_req: AuthRequest, res: Response) => {
  res.json(await getProgramSwitch());
});

router.put(
  '/program',
  audited('program_switch', 'all'),
  validateRequest({ body: programBody }),
  async (req: AuthRequest, res: Response) => {
    const change = await setProgramSwitch(req.body.turnsEnabled, req.user!.userId);
    recordSuccess(req, res, { changedFields: ['turnsEnabled'], previous: change.previous, current: change.current });
    res.json(change);
  },
);

router.get('/export', validateRequest({ query: exportQuery }), async (req: AuthRequest, res: Response) => {
  const { keys } = req.query as unknown as { keys: string[] };
  const document = await exportCatalogue({ keys });
  res.setHeader('Content-Disposition', 'attachment; filename="automaton-catalogue-export.json"');
  res.json(document);
});

router.get('/catalogue/sync-status', validateRequest({}), async (_req: AuthRequest, res: Response) => {
  res.json({ summary: await getLastCatalogueSyncSummary() });
});

router.post('/activate-drafts', audited('activate_all', 'all'), validateRequest({}), async (req: AuthRequest, res: Response) => {
  const outcomes = await activateAllDrafts();
  recordSuccess(req, res, {
    activated: outcomes.filter((o) => o.outcome === 'activated').map((o) => o.catalogueKey),
    rejected: outcomes.flatMap((o) => (o.outcome === 'rejected' ? [{ catalogueKey: o.catalogueKey, code: o.code }] : [])),
  });
  res.json({ outcomes });
});

router.get('/', validateRequest({ query: listQuery }), async (req: AuthRequest, res: Response) => {
  const query = req.query as unknown as z.infer<typeof listQuery>;
  res.json(await listProfiles({ status: query.status, strategy: query.strategy, page: query.page, limit: query.limit }));
});

router.post('/', audited('create_draft', 'body'), validateRequest({ body: createBody }), async (req: AuthRequest, res: Response) => {
  const { result, changedFields } = await createDraft(req.body);
  recordSuccess(req, res, { changedFields });
  res.status(201).json(result);
});

// ── One profile ──────────────────────────────────────────────────────

router.get('/:key', validateRequest({ params: keyParams }), async (req: AuthRequest, res: Response) => {
  res.json(await getProfileDetail(String(req.params.key)));
});

router.patch(
  '/:key',
  audited('update_profile', 'param'),
  validateRequest({ params: keyParams, body: updateBody }),
  async (req: AuthRequest, res: Response) => {
    const { result, changedFields } = await updateProfile(String(req.params.key), req.body);
    recordSuccess(req, res, { changedFields });
    res.json(result);
  },
);

router.delete('/:key', audited('delete_draft', 'param'), validateRequest({ params: keyParams }), async (req: AuthRequest, res: Response) => {
  const { changedFields } = await deleteDraft(String(req.params.key));
  recordSuccess(req, res, { changedFields });
  res.status(204).send();
});

router.put(
  '/:key/strategy',
  audited('update_strategy', 'param'),
  validateRequest({ params: keyParams, body: strategyBody }),
  async (req: AuthRequest, res: Response) => {
    const { result, changedFields } = await updateStrategy(String(req.params.key), req.body);
    recordSuccess(req, res, { changedFields, strategyKey: result.strategy.key, strategyVersion: result.strategy.version });
    res.json(result);
  },
);

router.post(
  '/:key/blueprints',
  audited('add_blueprint', 'param'),
  validateRequest({ params: keyParams, body: addBlueprintBody }),
  async (req: AuthRequest, res: Response) => {
    const { result, changedFields } = await addBlueprint(String(req.params.key), req.body);
    recordSuccess(req, res, { changedFields });
    res.status(201).json(result);
  },
);

router.patch(
  '/:key/blueprints/:slot',
  audited('update_blueprint', 'param'),
  validateRequest({ params: slotParams, body: updateBlueprintBody }),
  async (req: AuthRequest, res: Response) => {
    const slot = Number(req.params.slot);
    const { result, changedFields } = await updateBlueprint(String(req.params.key), slot, req.body);
    recordSuccess(req, res, { slot, changedFields });
    res.json(result);
  },
);

router.delete(
  '/:key/blueprints/:slot',
  audited('delete_blueprint', 'param'),
  validateRequest({ params: slotParams, body: deleteBlueprintBody }),
  async (req: AuthRequest, res: Response) => {
    const slot = Number(req.params.slot);
    const { result, changedFields } = await deleteBlueprint(String(req.params.key), slot, req.body ?? {});
    recordSuccess(req, res, { slot, changedFields });
    res.json(result);
  },
);

router.post(
  '/:key/blueprints/:slot/image',
  audited('upload_image', 'param'),
  multerUpload.single('image'),
  auditMulterError,
  validateRequest({ params: slotParams }),
  async (req: AuthRequest, res: Response) => {
    if (!req.file) throw new AutomatonError(AutomatonErrorCode.AUTOMATON_IMAGE_INVALID, 'No image file provided', 400);
    const slot = Number(req.params.slot);
    const stored = await storeBlueprintImage(String(req.params.key), slot, req.file.buffer, req.file.mimetype);
    recordSuccess(req, res, { slot, changedFields: ['imageUrl'], robotsUpdated: stored.robotsUpdated });
    res.json(stored);
  },
);

router.post('/:key/activate', audited('activate', 'param'), validateRequest({ params: keyParams }), async (req: AuthRequest, res: Response) => {
  const { result, changedFields } = await activateProfile(String(req.params.key));
  recordSuccess(req, res, { changedFields, userId: result.userId });
  res.json(result);
});

router.get('/:key/preview', validateRequest({ params: keyParams }), async (req: AuthRequest, res: Response) => {
  res.json(await previewProfileTurn(String(req.params.key)));
});

router.get('/:key/turns', validateRequest({ params: keyParams, query: paginationQuery }), async (req: AuthRequest, res: Response) => {
  const query = req.query as unknown as z.infer<typeof paginationQuery>;
  res.json(await listTurnRecords(String(req.params.key), query.page, query.limit));
});

// ── Rejections ───────────────────────────────────────────────────────

/** Records the audit entry of a rejected mutation, then hands the error to `errorHandler`. */
router.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  recordRejection(req as AuthRequest, res, err);
  next(err);
});

export default router;
