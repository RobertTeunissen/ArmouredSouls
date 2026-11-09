import express, { Request, Response } from 'express';
import { z } from 'zod';
import { getInstancesForTier, LeagueTier, LEAGUE_TIERS } from '../services/league/leagueInstanceService';
import { getRobotLeagueStandings, ROBOT_LEAGUE_MODES } from '../services/league/leagueStandingsService';
import { getMyStandings } from '../services/league/myStandingsService';
import prisma from '../lib/prisma';
import { LeagueError, LeagueErrorCode } from '../errors';
import { validateRequest } from '../middleware/schemaValidator';
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
type StandingsQuery = z.infer<typeof standingsQuerySchema>;

const instancesQuerySchema = z.object({ mode: robotModeSchema });
type InstancesQuery = z.infer<typeof instancesQuerySchema>;

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
  validateRequest({ params: leagueTierParamsSchema, query: standingsQuerySchema }),
  async (req: Request, res: Response) => {
    const tier = String(req.params.tier);
    assertTier(tier);
    const { mode, instance, page, perPage } = req.query as unknown as StandingsQuery;

    const result = await getRobotLeagueStandings(mode, { tier, instance, page, perPage });
    res.set('Cache-Control', 'private, max-age=60');
    res.json({ data: result.rows, pagination: result.pagination, zoneMeta: result.zoneMeta });
  },
);

/**
 * GET /api/leagues/:tier/instances?mode=league_1v1|koth|grand_melee
 * Every instance of a tier with its population, in instance-number order.
 */
router.get(
  '/:tier/instances',
  validateRequest({ params: leagueTierParamsSchema, query: instancesQuerySchema }),
  async (req: Request, res: Response) => {
    const tier = String(req.params.tier);
    assertTier(tier);
    const { mode } = req.query as unknown as InstancesQuery;

    const instances = await getInstancesForTier(tier, { mode, maxPerInstance: 100 });
    res.json(instances.map((instance) => ({
      leagueId: instance.leagueId,
      leagueTier: tier,
      currentRobots: instance.currentRobots,
      maxRobots: instance.maxRobots,
    })));
  },
);

/**
 * GET /api/leagues/tier-changes/unseen
 * Returns league tier changes (promotions/demotions) for the current user's robots
 * that occurred since their previous login. Used for dashboard notifications.
 */
router.get('/tier-changes/unseen', authenticateToken, validateRequest({}), async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const userId = authReq.user!.userId;

  // Show tier changes from the last 24 hours. Using a fixed window avoids the
  // race where lastLoginAt is updated at login time (before the dashboard loads),
  // which would cause the endpoint to return no results on the current session.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const changes = await prisma.leagueHistory.findMany({
    where: {
      userId,
      createdAt: { gt: since },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  // Enrich with robot/team names and mode
  const robotIds = changes.filter(c => c.entityType === 'robot').map(c => c.entityId);
  const tagTeamIds = changes.filter(c => c.entityType === 'tag_team').map(c => c.entityId);
  const teamBattleIds = changes.filter(c => c.entityType === 'team_battle').map(c => c.entityId);

  // Look up standings to determine which mode each tier change belongs to
  const allEntityIds = changes.map(c => c.entityId);
  const standings = allEntityIds.length > 0
    ? await prisma.standing.findMany({
        where: { entityId: { in: allEntityIds } },
        select: { entityId: true, entityType: true, mode: true, tier: true, leagueInstanceId: true },
      })
    : [];

  const [robots, tagTeams, teamBattles] = await Promise.all([
    robotIds.length > 0
      ? prisma.robot.findMany({ where: { id: { in: robotIds } }, select: { id: true, name: true } })
      : [],
    tagTeamIds.length > 0
      ? prisma.teamBattle.findMany({
          where: { id: { in: tagTeamIds } },
          select: { id: true, teamName: true },
        })
      : [],
    teamBattleIds.length > 0
      ? prisma.teamBattle.findMany({ where: { id: { in: teamBattleIds } }, select: { id: true, teamName: true, teamSize: true } })
      : [],
  ]);

  const robotMap = new Map(robots.map(r => [r.id, r.name]));
  const tagTeamMap = new Map(tagTeams.map(t => [t.id, t.teamName]));
  const teamBattleMap = new Map(teamBattles.map(t => [t.id, { name: t.teamName, size: t.teamSize }]));

  function getEntityName(c: { entityType: string; entityId: number }): string {
    if (c.entityType === 'robot') return robotMap.get(c.entityId) ?? `Robot #${c.entityId}`;
    if (c.entityType === 'tag_team') return tagTeamMap.get(c.entityId) ?? `Tag Team #${c.entityId}`;
    const tb = teamBattleMap.get(c.entityId);
    if (tb) return `${tb.name} (${tb.size}v${tb.size})`;
    return `Team #${c.entityId}`;
  }

  const result = changes.map(c => {
    // Use mode from the history record (populated since Spec #44).
    // Falls back to cross-reference for legacy records without mode.
    let mode = (c as unknown as { mode?: string }).mode;
    if (!mode) {
      const entityStandings = standings.filter(s => s.entityId === c.entityId && s.entityType === c.entityType);
      const freshlyChanged = entityStandings.filter(s => s.tier === c.destinationTier);
      const exactMatch = freshlyChanged.find(s => s.leagueInstanceId === c.destinationLeagueId);
      const matchingStanding = exactMatch ?? freshlyChanged[0];
      mode = matchingStanding?.mode ?? (c.entityType === 'tag_team' ? 'tag_team' : 'league_1v1');
    }

    return {
      id: c.id,
      entityType: c.entityType,
      entityId: c.entityId,
      entityName: getEntityName(c),
      changeType: c.changeType,
      sourceTier: c.sourceTier,
      destinationTier: c.destinationTier,
      leaguePoints: c.leaguePoints,
      mode,
      createdAt: c.createdAt.toISOString(),
    };
  });

  // Deduplicate: same entity + same tier change + same mode = show only once
  const seen = new Set<string>();
  const deduped = result.filter(r => {
    const key = `${r.entityType}-${r.entityId}-${r.changeType}-${r.sourceTier}-${r.destinationTier}-${r.mode}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  res.json({ changes: deduped });
});

export default router;
