/**
 * Admin Battles routes (`/admin/battles`): find any battle, check it, export it.
 * Mounted at /api/admin/battles from the main admin router. Every route is
 * admin-only and read-only.
 */
import express, { Request, Response } from 'express';
import { z } from 'zod';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { validated } from '../middleware/schemaValidator';
import { positiveIntParam } from '../utils/securityValidation';
import {
  BATTLE_MODES,
  BATTLE_OUTCOME_FILTERS,
  BATTLE_RANGE_FILTERS,
  BATTLE_STABLE_FILTERS,
  exportBattleJson,
  exportBattleText,
  getAdminBattleDetail,
  getAdminBattleList,
  getAdminBattleLog,
} from '../services/admin/battles';

const router = express.Router();
router.use(authenticateToken);
router.use(requireAdmin);

const battleIdParamsSchema = z.object({ id: positiveIntParam });

const battleListQuerySchema = z.object({
  page: z.coerce.number().int().positive().max(100_000).default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  mode: z.enum(['all', ...BATTLE_MODES]).default('all'),
  stable: z.enum(BATTLE_STABLE_FILTERS).default('all'),
  outcome: z.enum(BATTLE_OUTCOME_FILTERS).default('all'),
  range: z.enum(BATTLE_RANGE_FILTERS).default('7d'),
  q: z.string().trim().max(100).optional(),
});

const exportQuerySchema = z.object({ format: z.enum(['text', 'json']).default('text') });

/** Battles matching the filters, newest first. */
router.get('/', ...validated({ query: battleListQuerySchema }, async (req: Request, res: Response, { query }) => {
  res.json(await getAdminBattleList({ ...query, q: query.q || undefined }));
}));

/** Context, participants and payout check for one battle (without the combat log). */
router.get('/:id', ...validated({ params: battleIdParamsSchema }, async (req: Request, res: Response, { params }) => {
  res.json(await getAdminBattleDetail(params.id));
}));

/** The stored combat log with formula breakdowns, or an empty list after retention. */
router.get('/:id/log', ...validated({ params: battleIdParamsSchema }, async (req: Request, res: Response, { params }) => {
  res.json(await getAdminBattleLog(params.id));
}));

/** The whole battle as text ("Copy for analysis") or JSON ("Download JSON"). */
router.get(
  '/:id/export',
  ...validated({ params: battleIdParamsSchema, query: exportQuerySchema }, async (req: Request, res: Response, { params, query }) => {
    const battleId = params.id;
    const { format } = exportQuerySchema.parse(query);
    if (format === 'json') {
      const body = await exportBattleJson(battleId);
      res.setHeader('Content-Disposition', `attachment; filename="battle-${battleId}.json"`);
      res.json(body);
      return;
    }
    res.type('text/plain; charset=utf-8').send(await exportBattleText(battleId));
  }),
);

export default router;
