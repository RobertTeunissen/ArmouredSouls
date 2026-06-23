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
import { positiveIntParam, safeName } from '../utils/securityValidation';
import prisma from '../lib/prisma';
import {
  registerTeam,
  swapTeamMember,
  swapPositions,
  renameTeam,
  disbandTeam,
} from '../services/team-battle/teamBattleService';
import { MAX_TEAMS_PER_INSTANCE } from '../services/team-battle/teamBattleAdapter';
import { getEntityHistory } from '../services/league/leagueHistoryService';
import { hasSubscription } from '../services/subscription/subscriptionService';
import { getMinLPForPromotion } from '../services/league/leaguePromotionThresholds';

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

    // Check lock status and compute ineligibility reason for each team
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

        // Compute ineligibility reason when team is INELIGIBLE
        let ineligibilityReason: string | null = null;
        let ineligibilityDetail: string | null = null;

        if (team.eligibility === 'INELIGIBLE') {
          if (team.members.length < team.teamSize) {
            ineligibilityReason = 'incomplete_roster';
            ineligibilityDetail = `${team.members.length}/${team.teamSize}`;
          } else {
            // Check subscriptions for each member
            const eventType = team.teamSize === 2 ? 'league_2v2' : 'league_3v3';
            for (const member of team.members) {
              const subscribed = await hasSubscription(member.robotId, eventType);
              if (!subscribed) {
                ineligibilityReason = 'missing_subscription';
                ineligibilityDetail = member.robot.name;
                break;
              }
            }

            // Defensive: check for destroyed member (0 HP)
            if (!ineligibilityReason) {
              for (const member of team.members) {
                if (member.robot.currentHP <= 0) {
                  ineligibilityReason = 'member_destroyed';
                  ineligibilityDetail = member.robot.name;
                  break;
                }
              }
            }
          }
        }

        return {
          ...team,
          isLockedForBattle: scheduledCount > 0,
          ineligibilityReason,
          ineligibilityDetail,
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

      return {
        ...team,
        // Override legacy columns with standings data (source of truth)
        teamLp: leagueStanding?.leaguePoints ?? 0,
        teamLeague: leagueStanding?.tier ?? 'bronze',
        teamLeagueId: leagueStanding?.leagueInstanceId ?? 'bronze_1',
        cyclesInLeague: leagueStanding?.cyclesInTier ?? 0,
        totalLeagueWins: leagueStanding?.wins ?? 0,
        totalLeagueLosses: leagueStanding?.losses ?? 0,
        totalLeagueDraws: leagueStanding?.draws ?? 0,
        tagTeamLp: tagTeamStanding?.leaguePoints ?? 0,
        tagTeamLeague: tagTeamStanding?.tier ?? 'bronze',
        tagTeamLeagueId: tagTeamStanding?.leagueInstanceId ?? 'bronze_1',
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

    // Always create league standings on team creation (matchmaking handles eligibility separately)
    const leagueMode = teamSize === 2 ? 'league_2v2' : 'league_3v3';
    await prisma.standing.upsert({
      where: { entityType_entityId_mode: { entityType: 'team', entityId: team.id, mode: leagueMode as any } },
      update: {},
      create: {
        entityType: 'team',
        entityId: team.id,
        mode: leagueMode as any,
        tier: 'bronze',
        leagueInstanceId: team.teamLeagueId,
        leaguePoints: 0,
        cyclesInTier: 0,
        wins: 0, losses: 0, draws: 0,
        currentWinStreak: 0, bestWinStreak: 0, currentLoseStreak: 0,
      },
    });

    // For 2v2 teams, also create tag_team standing
    if (teamSize === 2) {
      const { assignTagTeamLeagueInstanceOnTeamBattle } = await import('../services/team-battle/teamBattleAdapter');
      const tagTeamLeagueId = await assignTagTeamLeagueInstanceOnTeamBattle('bronze');
      await prisma.standing.upsert({
        where: { entityType_entityId_mode: { entityType: 'team', entityId: team.id, mode: 'tag_team' as any } },
        update: {},
        create: {
          entityType: 'team',
          entityId: team.id,
          mode: 'tag_team' as any,
          tier: 'bronze',
          leagueInstanceId: tagTeamLeagueId,
          leaguePoints: 0,
          cyclesInTier: 0,
          wins: 0, losses: 0, draws: 0,
          currentWinStreak: 0, bestWinStreak: 0, currentLoseStreak: 0,
        },
      });
    }

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

const VALID_TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'];

// Zone computation constants (matching 1v1 league logic)
const PROMOTION_PERCENTAGE = 0.10;
const DEMOTION_PERCENTAGE = 0.10;
const MIN_CYCLES_IN_LEAGUE = 5;
const MIN_TEAMS_FOR_REBALANCING_2V2_3V3 = 4;
const MIN_TEAMS_FOR_REBALANCING_TAG_TEAM = 4;

const standingsParamsSchema = z.object({
  tier: z.string().refine((v) => VALID_TIERS.includes(v), { message: 'Invalid league tier' }),
  teamSize: z.string().refine((v) => v === '2' || v === '3', { message: 'teamSize must be 2 or 3' }),
});

/**
 * GET /api/team-battles/leagues/:teamSize/:tier/standings
 * Get team battle league standings for a specific tier and team size.
 * Query params: page (default 1), perPage (default 50), instance (optional league instance ID)
 */
router.get(
  '/leagues/:teamSize/:tier/standings',
  authenticateToken,
  validateRequest({ params: standingsParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const tier = String(req.params.tier);
    const teamSize = Number(req.params.teamSize) as 2 | 3;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(req.query.perPage as string) || 50));
    const instance = req.query.instance as string | undefined;

    // Read from unified standings table (Spec #40)
    const mode = teamSize === 2 ? 'league_2v2' : 'league_3v3';
    const standingsWhere = {
      mode: mode as any,
      tier,
      ...(instance && { leagueInstanceId: instance }),
    };

    const total = await prisma.standing.count({ where: standingsWhere });
    const totalPages = Math.ceil(total / perPage);

    const standingRows = await prisma.standing.findMany({
      where: standingsWhere,
      orderBy: [{ leaguePoints: 'desc' }],
      skip: (page - 1) * perPage,
      take: perPage,
    });

    // Batch-fetch team data with members
    const teamIds = standingRows.map(s => s.entityId);
    const teams = await prisma.teamBattle.findMany({
      where: { id: { in: teamIds } },
      include: {
        stable: { select: { stableName: true, username: true } },
        members: {
          include: { robot: { select: { id: true, name: true, elo: true } } },
          orderBy: { slotIndex: 'asc' },
        },
      },
    });
    const teamMap = new Map(teams.map(t => [t.id, t]));

    // Zone computation
    const minLP = getMinLPForPromotion(tier);
    const isChampion = tier === 'champion';
    const isBronze = tier === 'bronze';
    const minEntities = MIN_TEAMS_FOR_REBALANCING_2V2_3V3;

    let eligibleCount = 0;
    let hasEnoughRobots = false;
    let promotionCount = 0;
    let demotionCount = 0;
    const promotionTeamIds = new Set<number>();
    const demotionTeamIds = new Set<number>();

    if (instance) {
      eligibleCount = await prisma.standing.count({
        where: { mode: mode as any, leagueInstanceId: instance, cyclesInTier: { gte: MIN_CYCLES_IN_LEAGUE } },
      });

      hasEnoughRobots = eligibleCount >= minEntities;
      promotionCount = hasEnoughRobots ? Math.floor(eligibleCount * PROMOTION_PERCENTAGE) : 0;
      demotionCount = hasEnoughRobots ? Math.floor(eligibleCount * DEMOTION_PERCENTAGE) : 0;

      if (hasEnoughRobots && demotionCount > 0 && !isBronze) {
        const demotionStandings = await prisma.standing.findMany({
          where: { mode: mode as any, leagueInstanceId: instance, cyclesInTier: { gte: MIN_CYCLES_IN_LEAGUE } },
          orderBy: [{ leaguePoints: 'asc' }],
          select: { entityId: true },
          take: demotionCount,
        });
        for (const s of demotionStandings) demotionTeamIds.add(s.entityId);
      }

      if (hasEnoughRobots && promotionCount > 0 && !isChampion) {
        const promotionStandings = await prisma.standing.findMany({
          where: { mode: mode as any, leagueInstanceId: instance, cyclesInTier: { gte: MIN_CYCLES_IN_LEAGUE }, leaguePoints: { gte: minLP } },
          orderBy: [{ leaguePoints: 'desc' }],
          select: { entityId: true },
          take: promotionCount,
        });
        for (const s of promotionStandings) promotionTeamIds.add(s.entityId);
      }
    } else {
      eligibleCount = await prisma.standing.count({
        where: { mode: mode as any, tier, cyclesInTier: { gte: MIN_CYCLES_IN_LEAGUE } },
      });
      hasEnoughRobots = eligibleCount >= minEntities;
    }

    // Batch-check subscription status
    const eventType = teamSize === 2 ? 'league_2v2' : 'league_3v3';
    const allMemberRobotIds = teams.flatMap(t => t.members.map(m => m.robot.id));
    const activeTeamSubs = await prisma.subscription.findMany({
      where: { robotId: { in: allMemberRobotIds }, eventType, status: 'active' },
      select: { robotId: true },
    });
    const subscribedMemberIds = new Set(activeTeamSubs.map(s => s.robotId));

    const standings = standingRows.map((s, index) => {
      const team = teamMap.get(s.entityId);
      const teamELO = team ? team.members.reduce((sum, m) => sum + m.robot.elo, 0) : 0;
      const rank = (page - 1) * perPage + index + 1;
      const isSubscribed = team ? team.members.every(m => subscribedMemberIds.has(m.robot.id)) : false;
      const eligible = s.cyclesInTier >= MIN_CYCLES_IN_LEAGUE;
      const zone = promotionTeamIds.has(s.entityId)
        ? 'promotion' as const
        : demotionTeamIds.has(s.entityId)
          ? 'demotion' as const
          : null;
      return {
        rank,
        teamId: s.entityId,
        teamName: team?.teamName ?? `Team #${s.entityId}`,
        stableId: team?.stableId ?? 0,
        stableName: team?.stable?.stableName || team?.stable?.username || 'Unknown',
        teamSize,
        teamLp: s.leaguePoints,
        teamELO,
        teamLeague: s.tier,
        teamLeagueId: s.leagueInstanceId,
        wins: s.wins,
        losses: s.losses,
        draws: s.draws,
        totalMatches: s.wins + s.losses + s.draws,
        eligibility: team?.eligibility ?? 'ELIGIBLE',
        cyclesInLeague: s.cyclesInTier,
        isSubscribed,
        zone,
        eligible,
        members: team?.members.map((m) => ({
          robotId: m.robot.id,
          robotName: m.robot.name,
          robotElo: m.robot.elo,
          slotIndex: m.slotIndex,
        })) ?? [],
      };
    });

    res.json({
      standings,
      pagination: { page, pageSize: perPage, total, totalPages },
      tier,
      teamSize,
      zoneMeta: {
        minLP,
        minCycles: MIN_CYCLES_IN_LEAGUE,
        hasEnoughRobots,
        minRobotsRequired: minEntities,
        eligibleCount,
        isChampion,
        isBronze,
        promotionSlots: promotionCount,
        demotionSlots: demotionCount,
      },
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
    const mode = teamSize === 2 ? 'league_2v2' : 'league_3v3';

    // Read from unified standings table (Spec #40)
    const instances = await prisma.standing.groupBy({
      by: ['leagueInstanceId'],
      where: {
        mode: mode as any,
        tier,
      },
      _count: true,
    });

    const formatted = instances.map((inst) => ({
      leagueId: inst.leagueInstanceId,
      leagueTier: tier,
      currentTeams: inst._count,
      maxTeams: MAX_TEAMS_PER_INSTANCE,
    }));

    res.json(formatted);
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
    const tier = String(req.params.tier);

    // Read from unified standings table (Spec #40)
    const instances = await prisma.standing.groupBy({
      by: ['leagueInstanceId'],
      where: {
        mode: 'tag_team' as any,
        tier,
      },
      _count: true,
    });

    const formatted = instances.map((inst) => ({
      leagueId: inst.leagueInstanceId,
      leagueTier: tier,
      currentTeams: inst._count,
      maxTeams: MAX_TEAMS_PER_INSTANCE,
    }));

    res.json(formatted);
  },
);

// ── Tag Team Standings ────────────────────────────────────────────────

/**
 * GET /api/team-battles/leagues/2/:tier/tag-team-standings
 * Get tag team league standings for 2v2 teams in a specific tier.
 * Query params: page (default 1), perPage (default 50, max 100), instance (optional tagTeamLeagueId)
 */
router.get(
  '/leagues/2/:tier/tag-team-standings',
  authenticateToken,
  validateRequest({ params: tagTeamTierParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const tier = String(req.params.tier);
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(req.query.perPage as string) || 50));
    const instance = req.query.instance as string | undefined;

    // Read from unified standings table (Spec #40)
    const standingsWhere = {
      mode: 'tag_team' as any,
      tier,
      ...(instance && { leagueInstanceId: instance }),
    };

    const total = await prisma.standing.count({ where: standingsWhere });
    const totalPages = Math.ceil(total / perPage);

    const standingRows = await prisma.standing.findMany({
      where: standingsWhere,
      orderBy: [{ leaguePoints: 'desc' }],
      skip: (page - 1) * perPage,
      take: perPage,
    });

    // Batch-fetch team data
    const teamIds = standingRows.map(s => s.entityId);
    const teams = await prisma.teamBattle.findMany({
      where: { id: { in: teamIds } },
      include: {
        stable: { select: { stableName: true, username: true } },
        members: {
          include: { robot: { select: { id: true, name: true, elo: true } } },
          orderBy: { slotIndex: 'asc' },
        },
      },
    });
    const teamMap = new Map(teams.map(t => [t.id, t]));

    // Zone computation
    const minLP = getMinLPForPromotion(tier);
    const isChampion = tier === 'champion';
    const isBronze = tier === 'bronze';
    const minEntities = MIN_TEAMS_FOR_REBALANCING_TAG_TEAM;

    let eligibleCount = 0;
    let hasEnoughRobots = false;
    let promotionCount = 0;
    let demotionCount = 0;
    const promotionTeamIds = new Set<number>();
    const demotionTeamIds = new Set<number>();

    if (instance) {
      eligibleCount = await prisma.standing.count({
        where: { mode: 'tag_team' as any, leagueInstanceId: instance, cyclesInTier: { gte: MIN_CYCLES_IN_LEAGUE } },
      });

      hasEnoughRobots = eligibleCount >= minEntities;
      promotionCount = hasEnoughRobots ? Math.floor(eligibleCount * PROMOTION_PERCENTAGE) : 0;
      demotionCount = hasEnoughRobots ? Math.floor(eligibleCount * DEMOTION_PERCENTAGE) : 0;

      if (hasEnoughRobots && demotionCount > 0 && !isBronze) {
        const demotionStandings = await prisma.standing.findMany({
          where: { mode: 'tag_team' as any, leagueInstanceId: instance, cyclesInTier: { gte: MIN_CYCLES_IN_LEAGUE } },
          orderBy: [{ leaguePoints: 'asc' }],
          select: { entityId: true },
          take: demotionCount,
        });
        for (const s of demotionStandings) demotionTeamIds.add(s.entityId);
      }

      if (hasEnoughRobots && promotionCount > 0 && !isChampion) {
        const promotionStandings = await prisma.standing.findMany({
          where: { mode: 'tag_team' as any, leagueInstanceId: instance, cyclesInTier: { gte: MIN_CYCLES_IN_LEAGUE }, leaguePoints: { gte: minLP } },
          orderBy: [{ leaguePoints: 'desc' }],
          select: { entityId: true },
          take: promotionCount,
        });
        for (const s of promotionStandings) promotionTeamIds.add(s.entityId);
      }
    } else {
      eligibleCount = await prisma.standing.count({
        where: { mode: 'tag_team' as any, tier, cyclesInTier: { gte: MIN_CYCLES_IN_LEAGUE } },
      });
      hasEnoughRobots = eligibleCount >= minEntities;
    }

    // Batch-check tag_team subscription status
    const allMemberRobotIds = teams.flatMap(t => t.members.map(m => m.robot.id));
    const activeTagTeamSubs = await prisma.subscription.findMany({
      where: { robotId: { in: allMemberRobotIds }, eventType: 'tag_team', status: 'active' },
      select: { robotId: true },
    });
    const subscribedMemberIds = new Set(activeTagTeamSubs.map(s => s.robotId));

    const standings = standingRows.map((s, index) => {
      const team = teamMap.get(s.entityId);
      const combinedELO = team ? team.members.reduce((sum, m) => sum + m.robot.elo, 0) : 0;
      const rank = (page - 1) * perPage + index + 1;
      const isSubscribed = team ? team.members.every(m => subscribedMemberIds.has(m.robot.id)) : false;
      const eligible = s.cyclesInTier >= MIN_CYCLES_IN_LEAGUE;
      const zone = promotionTeamIds.has(s.entityId)
        ? 'promotion' as const
        : demotionTeamIds.has(s.entityId)
          ? 'demotion' as const
          : null;
      return {
        rank,
        teamId: s.entityId,
        teamName: team?.teamName ?? `Team #${s.entityId}`,
        stableId: team?.stableId ?? 0,
        stableName: team?.stable?.stableName || team?.stable?.username || 'Unknown',
        tagTeamLp: s.leaguePoints,
        tagTeamLeague: s.tier,
        tagTeamLeagueId: s.leagueInstanceId,
        totalTagTeamWins: s.wins,
        totalTagTeamLosses: s.losses,
        totalTagTeamDraws: s.draws,
        combinedELO,
        isSubscribed,
        cyclesInTagTeamLeague: s.cyclesInTier,
        zone,
        eligible,
        members: team?.members.map((m) => ({
          id: m.robot.id,
          name: m.robot.name,
          elo: m.robot.elo,
          slotIndex: m.slotIndex,
        })) ?? [],
      };
    });

    res.json({
      standings,
      pagination: { page, pageSize: perPage, total, totalPages },
      tier,
      zoneMeta: {
        minLP,
        minCycles: MIN_CYCLES_IN_LEAGUE,
        hasEnoughRobots,
        minRobotsRequired: minEntities,
        eligibleCount,
        isChampion,
        isBronze,
        promotionSlots: promotionCount,
        demotionSlots: demotionCount,
      },
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
            teamLeague: true,
            teamLeagueId: true,
            teamLp: true,
          },
        },
      },
    });

    // Fetch league history for each team (read current league data from standings)
    const result: {
      teamId: number;
      teamSize: number;
      teamName: string;
      currentLeague: string;
      currentLeagueId: string;
      currentLp: number;
      history: Awaited<ReturnType<typeof getEntityHistory>>;
      tagTeamHistory: Awaited<ReturnType<typeof getEntityHistory>>;
      tagTeamCurrentLeague: string;
      tagTeamCurrentLp: number;
    }[] = [];

    for (const membership of memberships) {
      const history = await getEntityHistory('team_battle', membership.team.id);
      const mode = membership.team.teamSize === 2 ? 'league_2v2' : 'league_3v3';
      const standing = await prisma.standing.findFirst({
        where: { entityType: 'team', entityId: membership.team.id, mode: mode as any },
      });

      // Also fetch tag team history and standing for 2v2 teams
      let tagTeamHistory: Awaited<ReturnType<typeof getEntityHistory>> = [];
      let tagTeamCurrentLeague = 'bronze';
      let tagTeamCurrentLp = 0;

      if (membership.team.teamSize === 2) {
        tagTeamHistory = await getEntityHistory('tag_team', membership.team.id);
        const tagTeamStanding = await prisma.standing.findFirst({
          where: { entityType: 'team', entityId: membership.team.id, mode: 'tag_team' as any },
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
        currentLeague: standing?.tier ?? membership.team.teamLeague,
        currentLeagueId: standing?.leagueInstanceId ?? membership.team.teamLeagueId,
        currentLp: standing?.leaguePoints ?? membership.team.teamLp,
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
