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
 * subscriptions or weapons, or change a balance (R2.4, R11.5). Tasks
 * 9.6–9.10 add the Status_Bar, Strategy_Comparison, Strategy_Library,
 * Strategy_Draft and upgrade endpoints (R6.6, R6.9–R6.14, R11.11–R11.14).
 * A Strategy_Draft mutation is audited with Catalogue_Key `none` (it concerns
 * no stable); a confirmed upgrade records one entry per profile, a dry-run
 * none.
 */
import express, { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { validateRequest } from '../middleware/schemaValidator';
import { handleMulterError } from '../middleware/handleMulterError';
import { AppError } from '../errors/AppError';
import { AutomatonError, AutomatonErrorCode } from '../errors/automatonErrors';
import { paginationQuery, positiveIntParam, safeEnum, stableName } from '../utils/securityValidation';
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
import { getAutomatonStatus } from '../services/automaton/automatonStatus';
import { getStrategyComparison } from '../services/automaton/strategyComparisonService';
import { getStrategyLibrary } from '../services/automaton/strategies/strategyLibrary';
import {
  BASED_ON_PATTERN,
  createDraft as createStrategyDraft,
  deleteDraft as deleteStrategyDraft,
  draftBuildOrderSchema,
  draftDescriptionSchema,
  draftDisplayNameSchema,
  exportDraft,
  getDraft,
  listDrafts,
  previewDraft,
  updateDraft,
} from '../services/automaton/strategies/strategyDraftService';
import { confirmUpgrade, dryRunUpgrade } from '../services/automaton/strategies/strategyUpgradeService';

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

/**
 * Mark a mutation route: names the audit operation and where its Catalogue_Key
 * comes from. Strategy_Draft mutations concern no stable (`none`).
 */
function audited(operation: string, key: 'param' | 'body' | 'all' | 'none') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const body = req.body as Record<string, unknown> | undefined;
    const catalogueKey = key === 'all' || key === 'none' ? key : auditKey(key === 'param' ? req.params.key : body?.catalogueKey);
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

/**
 * A Strategy_Version upgrade is audited only when it is confirmed: a dry-run
 * writes nothing (R6.6). The handler records one entry per profile (task
 * 9.9); a request rejected as a whole records one entry here.
 */
function auditedUpgrade(req: Request, res: Response, next: NextFunction): void {
  const body = req.body as { confirm?: unknown; catalogueKeys?: unknown } | undefined;
  if (body?.confirm === true) {
    const keys = Array.isArray(body.catalogueKeys) ? body.catalogueKeys : null;
    const catalogueKey = keys && keys.length === 1 ? auditKey(keys[0]) : 'all';
    const state: AuditState = { operation: `${AUDIT_PREFIX}.upgrade_strategy`, catalogueKey, recorded: false };
    res.locals.automatonAudit = state;
  }
  next();
}

/** One audit entry per profile of a confirmed upgrade (R11.3, task 9.9). */
function recordProfileOutcomes(
  req: AuthRequest,
  res: Response,
  outcomes: { catalogueKey: string; result: 'success' | 'failure'; summary: Record<string, unknown> }[],
): void {
  const state = auditState(res);
  if (!state || state.recorded || !req.user) return;
  state.recorded = true;
  if (outcomes.length === 0) {
    // A confirmed upgrade that selected no profile is still one mutation request.
    recordAction(req.user.userId, state.operation, 'success', { catalogueKey: state.catalogueKey, outcome: 'completed', upgraded: 0, rejected: 0 });
    return;
  }
  for (const outcome of outcomes) {
    recordAction(req.user.userId, state.operation, outcome.result, {
      catalogueKey: outcome.catalogueKey,
      outcome: outcome.result === 'success' ? 'completed' : 'rejected',
      ...outcome.summary,
    });
  }
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
  attention: safeEnum(['true', 'false']).transform((value) => value === 'true').optional(),
});

// ── Strategy_Library, Strategy_Draft and upgrade schemas (tasks 9.8–9.10) ──

const strategyKeyParams = z.object({ key: strategyKeySchema }).strict();
const draftParams = z.object({ id: positiveIntParam }).strict();

const createDraftBody = z.union([
  z.object({ basedOn: z.string().max(60).regex(BASED_ON_PATTERN, 'basedOn must be key.vN of a strategy version') }).strict(),
  z.object({
    key: strategyKeySchema,
    displayName: draftDisplayNameSchema.optional(),
    description: draftDescriptionSchema.optional(),
  }).strict(),
]);

const updateDraftBody = z.object({
  key: strategyKeySchema.optional(),
  displayName: draftDisplayNameSchema.optional(),
  description: draftDescriptionSchema.optional(),
  buildOrder: draftBuildOrderSchema.optional(),
}).strict().refine((body) => Object.keys(body).length > 0, 'Send at least one field to change');

const previewDraftBody = z.object({ catalogueKey: catalogueKeySchema }).strict();

const upgradeBody = z.object({
  toVersion: z.number().int().min(1),
  catalogueKeys: z.array(catalogueKeySchema).min(1).max(500).optional(),
  confirm: z.boolean().optional(),
  teamNames: teamNamesSchema.optional(),
}).strict().refine(
  (body) => body.teamNames === undefined || body.catalogueKeys?.length === 1,
  { message: 'teamNames is accepted for a single-stable upgrade only', path: ['teamNames'] },
);

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

// `teamNames` because a slot move can change the buildable blueprint count and so the Team_Names count (R3.6).
const updateBlueprintBody = blueprintFieldsSchema.partial().extend({ slot: blueprintSlot.optional(), teamNames: teamNamesSchema.optional() }).strict()
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

router.get('/status', validateRequest({}), async (_req: AuthRequest, res: Response) => {
  res.json(await getAutomatonStatus());
});

router.get('/strategies/comparison', validateRequest({}), async (_req: AuthRequest, res: Response) => {
  res.json(await getStrategyComparison());
});

router.get('/strategies', validateRequest({}), async (_req: AuthRequest, res: Response) => {
  res.json(await getStrategyLibrary());
});

router.post(
  '/strategies/:key/upgrade',
  auditedUpgrade,
  validateRequest({ params: strategyKeyParams, body: upgradeBody }),
  async (req: AuthRequest, res: Response) => {
    const strategyKey = String(req.params.key);
    const body = req.body as z.infer<typeof upgradeBody>;
    if (body.confirm !== true) {
      res.json(await dryRunUpgrade(strategyKey, body));
      return;
    }
    const result = await confirmUpgrade(strategyKey, body);
    recordProfileOutcomes(req, res, [
      ...result.upgraded.map((p) => ({
        catalogueKey: p.catalogueKey,
        result: 'success' as const,
        summary: { strategyKey, fromVersion: p.fromVersion, toVersion: p.toVersion, changedFields: p.changedFields },
      })),
      ...result.rejected.map((p) => ({
        catalogueKey: p.catalogueKey,
        result: 'failure' as const,
        summary: { strategyKey, fromVersion: p.fromVersion, toVersion: result.toVersion, code: p.code },
      })),
    ]);
    res.json(result);
  },
);

router.get('/strategy-drafts', validateRequest({}), async (_req: AuthRequest, res: Response) => {
  res.json({ drafts: await listDrafts() });
});

router.post('/strategy-drafts', audited('strategy_draft_create', 'none'), validateRequest({ body: createDraftBody }), async (req: AuthRequest, res: Response) => {
  const draft = await createStrategyDraft(req.body as z.infer<typeof createDraftBody>, req.user!.userId);
  recordSuccess(req, res, { draftId: draft.id, strategyKey: draft.definition.key, version: draft.definition.version, changedFields: Object.keys(req.body as object) });
  res.status(201).json(draft);
});

router.get('/strategy-drafts/:id', validateRequest({ params: draftParams }), async (req: AuthRequest, res: Response) => {
  res.json(await getDraft(Number(req.params.id)));
});

router.put(
  '/strategy-drafts/:id',
  audited('strategy_draft_update', 'none'),
  validateRequest({ params: draftParams, body: updateDraftBody }),
  async (req: AuthRequest, res: Response) => {
    const draft = await updateDraft(Number(req.params.id), req.body as z.infer<typeof updateDraftBody>);
    recordSuccess(req, res, { draftId: draft.id, strategyKey: draft.definition.key, version: draft.definition.version, changedFields: fieldNames(req) });
    res.json(draft);
  },
);

router.delete('/strategy-drafts/:id', audited('strategy_draft_delete', 'none'), validateRequest({ params: draftParams }), async (req: AuthRequest, res: Response) => {
  const deleted = await deleteStrategyDraft(Number(req.params.id));
  recordSuccess(req, res, { draftId: deleted.id, strategyKey: deleted.key, version: deleted.version, changedFields: ['deleted'] });
  res.status(204).send();
});

router.post(
  '/strategy-drafts/:id/preview',
  validateRequest({ params: draftParams, body: previewDraftBody }),
  async (req: AuthRequest, res: Response) => {
    res.json(await previewDraft(Number(req.params.id), (req.body as z.infer<typeof previewDraftBody>).catalogueKey));
  },
);

router.get('/strategy-drafts/:id/export', validateRequest({ params: draftParams }), async (req: AuthRequest, res: Response) => {
  const exported = await exportDraft(Number(req.params.id));
  res.setHeader('Content-Disposition', `attachment; filename="${exported.fileName}"`);
  res.json(exported);
});

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
  res.json(await listProfiles({ status: query.status, strategy: query.strategy, attention: query.attention, page: query.page, limit: query.limit }));
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
