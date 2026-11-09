import express, { Request, Response } from 'express';
import { z } from 'zod';
import { getInstancesForTier, LeagueTier, LEAGUE_TIERS } from '../services/league/leagueInstanceService';
import { getRobotLeagueStandings, ROBOT_LEAGUE_MODES } from '../services/league/leagueStandingsService';
import { getMyStandings } from '../services/league/myStandingsService';
import { getRecentTierChanges } from '../services/league/tierChangeFeedService';
import { LeagueError, LeagueErrorCode } from '../errors';
import { validateRequest, validated } from '../middleware/schemaValidator';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { leagueInstanceId } from '../utils/securityValidation';

const router = express.Router();

// Every league endpoint is for signed-in players only.
router.use(authenticateToken);

// --- Zod schemas for league routes ---

const leagueTierParamsSchema = z.object({
  tier: z.string().min(1).max(30),
});

const robotModeSchema = z.enum(ROBOT_LEAGUE_MODES).default('league_1v1');

const standingsQuerySchema = z.object({
  mode: robotModeSchema,
  instance: leagueInstanceId.optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(50),
});

const instancesQuerySchema = z.object({ mode: robotModeSchema });

function assertTier(tier: string): asserts tier is LeagueTier {
  if (!(LEAGUE_TIERS as readonly string[]).includes(tier)) {
    throw new LeagueError(LeagueErrorCode.INVALID_LEAGUE_TIER, 'Invalid tier', 400, { validTiers: LEAGUE_TIERS });
  }
}

/**
 * GET /api/leagues/my-standings
 * The signed-in player's robots and teams in every tiered league, with their
 * instance place and status at the next rebalance (the league cards).
 */
router.get('/my-standings', validateRequest({}), async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user!.userId;
  res.set('Cache-Control', 'private, no-store');
  res.json(await getMyStandings(userId));
});

/**
 * GET /api/leagues/:tier/standings?mode=league_1v1|koth|grand_melee&instance=&page=&perPage=
 * One tier (or one instance of it) of a robot league, ranked by LP, with each
 * row's zone and status from the executor's tier plan.
 */
router.get(
  '/:tier/standings',
  ...validated({ params: leagueTierParamsSchema, query: standingsQuerySchema }, async (req: Request, res: Response, { params, query }) => {
    const tier = params.tier;
    assertTier(tier);
    const { mode, instance, page, perPage } = query;

    const result = await getRobotLeagueStandings(mode, { tier, instance, page, perPage });
    res.set('Cache-Control', 'private, max-age=60');
    res.json({ data: result.rows, pagination: result.pagination, zoneMeta: result.zoneMeta });
  }),
);

/**
 * GET /api/leagues/:tier/instances?mode=league_1v1|koth|grand_melee
 * Every instance of a tier with its population, in instance-number order.
 */
router.get(
  '/:tier/instances',
  ...validated({ params: leagueTierParamsSchema, query: instancesQuerySchema }, async (req: Request, res: Response, { params, query }) => {
    const tier = params.tier;
    assertTier(tier);
    const { mode } = query;

    const instances = await getInstancesForTier(tier, { mode, maxPerInstance: 100 });
    res.json(instances.map((instance) => ({
      leagueId: instance.leagueId,
      leagueTier: tier,
      currentRobots: instance.currentRobots,
      maxRobots: instance.maxRobots,
    })));
  }),
);

/**
 * GET /api/leagues/tier-changes/unseen
 * Returns league tier changes (promotions/demotions) for the current user's robots
 * that occurred since their previous login. Used for dashboard notifications.
 */
router.get('/tier-changes/unseen', authenticateToken, validateRequest({}), async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const userId = authReq.user!.userId;

  res.json({ changes: await getRecentTierChanges(userId) });
});

export default router;
