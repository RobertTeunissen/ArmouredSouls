/**
 * Team Battle API routes (player-facing)
 *
 * CRUD operations for 2v2 and 3v3 League teams:
 * - GET    /api/team-battles          — List user's teams (with member robot data)
 * - POST   /api/team-battles          — Register a new team
 * - PUT    /api/team-battles/:id/swap  — Swap a team member
 * - PUT    /api/team-battles/:id/rename — Rename a team
 * - DELETE /api/team-battles/:id       — Disband a team
 *
 * All routes use validateRequest with Zod schemas, authenticateToken,
 * and ownership verification inside transactions (R10.1, R10.2, R10.3, R10.6).
 *
 * @module routes/teamBattles
 */

import express, { Response } from 'express';
import { z } from 'zod';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/schemaValidator';
import { leagueInstanceId, positiveIntParam, safeName } from '../utils/securityValidation';
import prisma from '../lib/prisma';
import type { StandingsMode } from '../../generated/prisma';
import {
  registerTeam,
  swapTeamMember,
  swapPositions,
  renameTeam,
  disbandTeam,
} from '../services/team-battle/teamBattleService';
import { MAX_TEAMS_PER_INSTANCE } from '../services/team-battle/teamBattleAdapter';
import { getEntityHistory } from '../services/league/leagueHistoryService';
import { getTeamLeagueStandings } from '../services/league/leagueStandingsService';
import { HEAD_TO_HEAD_LEAGUE_RULES } from '../services/league/league-rules';

const router = express.Router();

// ── Zod Schemas ──────────────────────────────────────────────────────

const teamIdParamsSchema = z.object({
  id: positiveIntParam,
});

const registerTeamBodySchema = z.object({
  robotIds: z.array(z.number().int().positive()).min(2).max(3),
  teamName: safeName.pipe(z.string().min(3).max(32)),
  teamSize: z.union([z.literal(2), z.literal(3)]),
});

const swapMemberBodySchema = z.object({
  oldRobotId: z.number().int().positive(),
  newRobotId: z.number().int().positive(),
});

const renameTeamBodySchema = z.object({
  teamName: safeName.pipe(z.string().min(3).max(32)),
});

// ── Routes ───────────────────────────────────────────────────────────

/**
 * GET /api/team-battles
 * List all teams for the current user's stable, with member robot data.
 * Optionally filter by teamSize via query param.
 */
router.get(
  '/',
  authenticateToken,
  validateRequest({}),
  async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const teamSizeFilter = req.query.teamSize ? Number(req.query.teamSize) : undefined;

    const where: { stableId: number; teamSize?: number } = { stableId: userId };
    if (teamSizeFilter === 2 || teamSizeFilter === 3) {
      where.teamSize = teamSizeFilter;
    }

    const teams = await prisma.teamBattle.findMany({
      where,
      include: {
        members: {
          include: {
            robot: {
              select: {
                id: true,
                name: true,
                elo: true,
                currentHP: true,
                maxHP: true,
                currentShield: true,
                maxShield: true,
                loadoutType: true,
                mainWeaponId: true,
                offhandWeaponId: true,
                subscriptions: {
                  select: { eventType: true, status: true },
                },
              },
            },
          },
          orderBy: { slotIndex: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Check lock status for each team
    const teamsWithMetadata = await Promise.all(
      teams.map(async (team) => {
        // Check if team has pending matches in unified scheduling table
        const scheduledCount = await prisma.scheduledMatchParticipant.count({
          where: {
            participantType: 'team',
            participantId: team.id,
            scheduledMatch: { status: 'scheduled' },
          },
        });

        return {
          ...team,
          isLockedForBattle: scheduledCount > 0,
        };
      }),
    );

    // Enrich with standings data (Spec #40 — LP, wins/losses now live in standings table)
    const teamIds = teamsWithMetadata.map(t => t.id);
    const teamStandings = await prisma.standing.findMany({
      where: { entityType: 'team', entityId: { in: teamIds } },
      select: { entityId: true, mode: true, leaguePoints: true, wins: true, losses: true, draws: true, tier: true, leagueInstanceId: true, cyclesInTier: true },
    });

    const standingsByTeam = new Map<number, Map<string, typeof teamStandings[0]>>();
    for (const s of teamStandings) {
      if (!standingsByTeam.has(s.entityId)) standingsByTeam.set(s.entityId, new Map());
      standingsByTeam.get(s.entityId)!.set(s.mode, s);
    }

    const enrichedTeams = teamsWithMetadata.map(team => {
      const teamStandingsMap = standingsByTeam.get(team.id);
      const leagueMode = team.teamSize === 2 ? 'league_2v2' : 'league_3v3';
      const leagueStanding = teamStandingsMap?.get(leagueMode);
      const tagTeamStanding = teamStandingsMap?.get('tag_team');

      // A team has no row in a mode until it is complete and every member is
      // subscribed; tier, instance and LP are then null (shown as Unranked).
      return {
        ...team,
        // Override legacy columns with standings data (source of truth)
        teamLp: leagueStanding?.leaguePoints ?? null,
        teamLeague: leagueStanding?.tier ?? null,
        teamLeagueId: leagueStanding?.leagueInstanceId ?? null,
        cyclesInLeague: leagueStanding?.cyclesInTier ?? 0,
        totalLeagueWins: leagueStanding?.wins ?? 0,
        totalLeagueLosses: leagueStanding?.losses ?? 0,
        totalLeagueDraws: leagueStanding?.draws ?? 0,
        tagTeamLp: tagTeamStanding?.leaguePoints ?? null,
        tagTeamLeague: tagTeamStanding?.tier ?? null,
        tagTeamLeagueId: tagTeamStanding?.leagueInstanceId ?? null,
        cyclesInTagTeamLeague: tagTeamStanding?.cyclesInTier ?? 0,
        totalTagTeamWins: tagTeamStanding?.wins ?? 0,
        totalTagTeamLosses: tagTeamStanding?.losses ?? 0,
        totalTagTeamDraws: tagTeamStanding?.draws ?? 0,
      };
    });

    res.json({ teams: enrichedTeams });
  },
);

/**
 * POST /api/team-battles
 * Register a new team for 2v2 or 3v3 League.
 */
router.post(
  '/',
  authenticateToken,
  validateRequest({ body: registerTeamBodySchema }),
  async (req: AuthRequest, res: Response) => {
    const { robotIds, teamName, teamSize } = req.body;
    const userId = req.user!.userId;

    const team = await registerTeam(userId, robotIds, teamName, teamSize, userId);

    res.status(201).json({ team });
  },
);

/**
 * PUT /api/team-battles/:id/swap
 * Swap a team member with a new robot.
 */
router.put(
  '/:id/swap',
  authenticateToken,
  validateRequest({ params: teamIdParamsSchema, body: swapMemberBodySchema }),
  async (req: AuthRequest, res: Response) => {
    const teamId = Number(req.params.id);
    const { oldRobotId, newRobotId } = req.body;
    const userId = req.user!.userId;

    await swapTeamMember(teamId, oldRobotId, newRobotId, userId);

    res.json({ message: 'Team member swapped successfully' });
  },
);

/**
 * PUT /api/team-battles/:id/swap-positions
 * Swap Active ↔ Reserve positions on a 2v2 team.
 */
router.put(
  '/:id/swap-positions',
  authenticateToken,
  validateRequest({ params: teamIdParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const teamId = Number(req.params.id);
    const userId = req.user!.userId;

    await swapPositions(teamId, userId);

    res.json({ message: 'Positions swapped successfully' });
  },
);

/**
 * PUT /api/team-battles/:id/rename
 * Rename a team.
 */
router.put(
  '/:id/rename',
  authenticateToken,
  validateRequest({ params: teamIdParamsSchema, body: renameTeamBodySchema }),
  async (req: AuthRequest, res: Response) => {
    const teamId = Number(req.params.id);
    const { teamName } = req.body;
    const userId = req.user!.userId;

    await renameTeam(teamId, teamName, userId);

    res.json({ message: 'Team renamed successfully' });
  },
);

/**
 * DELETE /api/team-battles/:id
 * Disband a team.
 */
router.delete(
  '/:id',
  authenticateToken,
  validateRequest({ params: teamIdParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const teamId = Number(req.params.id);
    const userId = req.user!.userId;

    await disbandTeam(teamId, userId);

    res.json({ message: 'Team disbanded successfully' });
  },
);

// ── Standings ────────────────────────────────────────────────────────

const VALID_TIERS: readonly string[] = HEAD_TO_HEAD_LEAGUE_RULES.tiers;

const standingsParamsSchema = z.object({
  tier: z.string().refine((v) => VALID_TIERS.includes(v), { message: 'Invalid league tier' }),
  teamSize: z.string().refine((v) => v === '2' || v === '3', { message: 'teamSize must be 2 or 3' }),
});

const standingsQuerySchema = z.object({
  instance: leagueInstanceId.optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(50),
});
type StandingsQuery = z.infer<typeof standingsQuerySchema>;

/** Instances of one team-mode tier with their population, in instance-number order. */
async function listTeamInstances(mode: StandingsMode, tier: string) {
  const instances = await prisma.standing.groupBy({
    by: ['leagueInstanceId'],
    where: { mode, tier },
    _count: true,
  });
  const instanceNumber = (id: string): number => parseInt(id.split('_')[1] ?? '1', 10);
  return instances
    .sort((a, b) => instanceNumber(a.leagueInstanceId) - instanceNumber(b.leagueInstanceId))
    .map((inst) => ({
      leagueId: inst.leagueInstanceId,
      leagueTier: tier,
      currentTeams: inst._count,
      maxTeams: MAX_TEAMS_PER_INSTANCE,
    }));
}

/**
 * GET /api/team-battles/leagues/:teamSize/:tier/standings?instance=&page=&perPage=
 * One tier (or instance) of the 2v2 or 3v3 League, ranked by LP, with each
 * team's zone and status from the executor's tier plan.
 */
router.get(
  '/leagues/:teamSize/:tier/standings',
  authenticateToken,
  validateRequest({ params: standingsParamsSchema, query: standingsQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    const tier = String(req.params.tier);
    const teamSize = Number(req.params.teamSize) as 2 | 3;
    const { instance, page, perPage } = req.query as unknown as StandingsQuery;

    const result = await getTeamLeagueStandings(teamSize === 2 ? 'league_2v2' : 'league_3v3', { tier, instance, page, perPage });

    res.json({
      standings: result.rows.map((row) => ({
        rank: row.rank,
        teamId: row.teamId,
        teamName: row.teamName,
        stableId: row.stableId,
        stableName: row.stableName,
        stableType: row.stableType,
        teamSize,
        teamLp: row.leaguePoints,
        teamELO: row.combinedElo,
        teamLeague: row.tier,
        teamLeagueId: row.leagueInstanceId,
        wins: row.wins,
        losses: row.losses,
        draws: row.draws,
        totalMatches: row.wins + row.losses + row.draws,
        cyclesInLeague: row.cyclesInTier,
        isSubscribed: row.isSubscribed,
        zone: row.zone,
        eligible: row.eligible,
        status: row.status,
        members: row.members,
      })),
      pagination: result.pagination,
      tier,
      teamSize,
      zoneMeta: result.zoneMeta,
    });
  },
);

/**
 * GET /api/team-battles/leagues/:teamSize/:tier/instances
 * Get league instances for a specific tier and team size.
 */
router.get(
  '/leagues/:teamSize/:tier/instances',
  authenticateToken,
  validateRequest({ params: standingsParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const tier = String(req.params.tier);
    const teamSize = Number(req.params.teamSize) as 2 | 3;
    res.json(await listTeamInstances(teamSize === 2 ? 'league_2v2' : 'league_3v3', tier));
  },
);

// ── Tag Team Instances ───────────────────────────────────────────────

const tagTeamTierParamsSchema = z.object({
  tier: z.string().refine((v) => VALID_TIERS.includes(v), { message: 'Invalid league tier' }),
});

/**
 * GET /api/team-battles/leagues/2/:tier/tag-team-instances
 * Get tag team league instances for a specific tier (teamSize fixed at 2).
 */
router.get(
  '/leagues/2/:tier/tag-team-instances',
  authenticateToken,
  validateRequest({ params: tagTeamTierParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    res.json(await listTeamInstances('tag_team', String(req.params.tier)));
  },
);

// ── Tag Team Standings ────────────────────────────────────────────────

/**
 * GET /api/team-battles/leagues/2/:tier/tag-team-standings?instance=&page=&perPage=
 * One tier (or instance) of the Tag Team league, ranked by LP, with each
 * team's zone and status from the executor's tier plan.
 */
router.get(
  '/leagues/2/:tier/tag-team-standings',
  authenticateToken,
  validateRequest({ params: tagTeamTierParamsSchema, query: standingsQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    const tier = String(req.params.tier);
    const { instance, page, perPage } = req.query as unknown as StandingsQuery;

    const result = await getTeamLeagueStandings('tag_team', { tier, instance, page, perPage });

    res.json({
      standings: result.rows.map((row) => ({
        rank: row.rank,
        teamId: row.teamId,
        teamName: row.teamName,
        stableId: row.stableId,
        stableName: row.stableName,
        stableType: row.stableType,
        tagTeamLp: row.leaguePoints,
        tagTeamLeague: row.tier,
        tagTeamLeagueId: row.leagueInstanceId,
        totalTagTeamWins: row.wins,
        totalTagTeamLosses: row.losses,
        totalTagTeamDraws: row.draws,
        combinedELO: row.combinedElo,
        isSubscribed: row.isSubscribed,
        cyclesInTagTeamLeague: row.cyclesInTier,
        zone: row.zone,
        eligible: row.eligible,
        status: row.status,
        members: row.members.map((m) => ({ id: m.robotId, name: m.robotName, elo: m.robotElo, slotIndex: m.slotIndex })),
      })),
      pagination: result.pagination,
      tier,
      zoneMeta: result.zoneMeta,
    });
  },
);

// ── League History ───────────────────────────────────────────────────

/**
 * GET /api/team-battles/:id/league-history
 * Get league history for a specific team battle team.
 */
router.get(
  '/:id/league-history',
  authenticateToken,
  validateRequest({ params: teamIdParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const teamId = Number(req.params.id);

    const team = await prisma.teamBattle.findUnique({
      where: { id: teamId },
      select: { id: true },
    });

    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    const data = await getEntityHistory('team_battle', teamId);
    res.json({ data });
  },
);

/**
 * GET /api/team-battles/:id/tag-team-league-history
 * Get tag team league history for a specific team battle team.
 * Returns league history entries where entityType = 'tag_team'.
 */
router.get(
  '/:id/tag-team-league-history',
  authenticateToken,
  validateRequest({ params: teamIdParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const teamId = Number(req.params.id);

    const team = await prisma.teamBattle.findUnique({
      where: { id: teamId },
      select: { id: true },
    });

    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    const data = await getEntityHistory('tag_team', teamId);
    res.json({ data });
  },
);

/**
 * GET /api/team-battles/robot/:robotId/league-history
 * Get team battle league history for all teams a robot belongs to.
 * Returns league history grouped by team size (2v2 and 3v3), plus tag team history.
 */
router.get(
  '/robot/:robotId/league-history',
  authenticateToken,
  validateRequest({ params: z.object({ robotId: positiveIntParam }) }),
  async (req: AuthRequest, res: Response) => {
    const robotId = Number(req.params.robotId);

    // Find all teams this robot belongs to
    const memberships = await prisma.teamBattleMember.findMany({
      where: { robotId },
      include: {
        team: {
          select: {
            id: true,
            teamSize: true,
            teamName: true,
          },
        },
      },
    });

    // Fetch league history for each team (read current league data from standings)
    const result: {
      teamId: number;
      teamSize: number;
      teamName: string;
      // null when the team has no standing in the mode yet (Unranked)
      currentLeague: string | null;
      currentLeagueId: string | null;
      currentLp: number | null;
      history: Awaited<ReturnType<typeof getEntityHistory>>;
      tagTeamHistory: Awaited<ReturnType<typeof getEntityHistory>>;
      tagTeamCurrentLeague: string | null;
      tagTeamCurrentLp: number | null;
    }[] = [];

    for (const membership of memberships) {
      const history = await getEntityHistory('team_battle', membership.team.id);
      const mode = membership.team.teamSize === 2 ? 'league_2v2' : 'league_3v3';
      const standing = await prisma.standing.findFirst({
        where: { entityType: 'team', entityId: membership.team.id, mode: mode as StandingsMode },
      });

      // Also fetch tag team history and standing for 2v2 teams
      let tagTeamHistory: Awaited<ReturnType<typeof getEntityHistory>> = [];
      let tagTeamCurrentLeague: string | null = null;
      let tagTeamCurrentLp: number | null = null;

      if (membership.team.teamSize === 2) {
        tagTeamHistory = await getEntityHistory('tag_team', membership.team.id);
        const tagTeamStanding = await prisma.standing.findFirst({
          where: { entityType: 'team', entityId: membership.team.id, mode: 'tag_team' as StandingsMode },
        });
        if (tagTeamStanding) {
          tagTeamCurrentLeague = tagTeamStanding.tier;
          tagTeamCurrentLp = tagTeamStanding.leaguePoints;
        }
      }

      result.push({
        teamId: membership.team.id,
        teamSize: membership.team.teamSize,
        teamName: membership.team.teamName,
        currentLeague: standing?.tier ?? null,
        currentLeagueId: standing?.leagueInstanceId ?? null,
        currentLp: standing?.leaguePoints ?? null,
        history,
        tagTeamHistory,
        tagTeamCurrentLeague,
        tagTeamCurrentLp,
      });
    }

    res.json({ teams: result });
  },
);

export default router;
