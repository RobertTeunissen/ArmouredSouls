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
 * All routes use validated() (validateRequest + typed handler input), authenticateToken,
 * and ownership verification inside transactions (R10.1, R10.2, R10.3, R10.6).
 *
 * @module routes/teamBattles
 */

import express, { Response } from 'express';
import { z } from 'zod';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { validated } from '../middleware/schemaValidator';
import { leagueInstanceId, positiveIntParam, safeName } from '../utils/securityValidation';
import {
  registerTeam,
  swapTeamMember,
  swapPositions,
  renameTeam,
  disbandTeam,
} from '../services/team-battle/teamBattleService';
import {
  getRobotTeamLeagueHistory,
  listStableTeams,
  listTeamInstances,
} from '../services/team-battle/teamBattleQueryService';
import { getTeamLeagueStandings } from '../services/league/leagueStandingsService';
import { STABLE_FILTERS } from '../services/standings/playerStables';
import { HEAD_TO_HEAD_LEAGUE_RULES } from '../services/league/league-rules';

const router = express.Router();

// ── Zod Schemas ──────────────────────────────────────────────────────

const teamIdParamsSchema = z.object({
  id: positiveIntParam,
});

// Lenient on purpose (unchanged behaviour): anything but 2 or 3 lists every team.
const teamListQuerySchema = z.object({
  teamSize: z.coerce.number().int().optional().catch(undefined),
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
  ...validated({ query: teamListQuerySchema }, async (req: AuthRequest, res: Response, { query }) => {
    res.json({ teams: await listStableTeams(req.user!.userId, query.teamSize) });
  }),
);

/**
 * POST /api/team-battles
 * Register a new team for 2v2 or 3v3 League.
 */
router.post(
  '/',
  authenticateToken,
  ...validated({ body: registerTeamBodySchema }, async (req: AuthRequest, res: Response, { body }) => {
    const { robotIds, teamName, teamSize } = body;
    const userId = req.user!.userId;

    const team = await registerTeam(userId, robotIds, teamName, teamSize, userId);

    res.status(201).json({ team });
  }),
);

/**
 * PUT /api/team-battles/:id/swap
 * Swap a team member with a new robot.
 */
router.put(
  '/:id/swap',
  authenticateToken,
  ...validated({ params: teamIdParamsSchema, body: swapMemberBodySchema }, async (req: AuthRequest, res: Response, { params, body }) => {
    const teamId = params.id;
    const { oldRobotId, newRobotId } = body;
    const userId = req.user!.userId;

    await swapTeamMember(teamId, oldRobotId, newRobotId, userId);

    res.json({ message: 'Team member swapped successfully' });
  }),
);

/**
 * PUT /api/team-battles/:id/swap-positions
 * Swap Active ↔ Reserve positions on a 2v2 team.
 */
router.put(
  '/:id/swap-positions',
  authenticateToken,
  ...validated({ params: teamIdParamsSchema }, async (req: AuthRequest, res: Response, { params }) => {
    const teamId = params.id;
    const userId = req.user!.userId;

    await swapPositions(teamId, userId);

    res.json({ message: 'Positions swapped successfully' });
  }),
);

/**
 * PUT /api/team-battles/:id/rename
 * Rename a team.
 */
router.put(
  '/:id/rename',
  authenticateToken,
  ...validated({ params: teamIdParamsSchema, body: renameTeamBodySchema }, async (req: AuthRequest, res: Response, { params, body }) => {
    const teamId = params.id;
    const { teamName } = body;
    const userId = req.user!.userId;

    await renameTeam(teamId, teamName, userId);

    res.json({ message: 'Team renamed successfully' });
  }),
);

/**
 * DELETE /api/team-battles/:id
 * Disband a team.
 */
router.delete(
  '/:id',
  authenticateToken,
  ...validated({ params: teamIdParamsSchema }, async (req: AuthRequest, res: Response, { params }) => {
    const teamId = params.id;
    const userId = req.user!.userId;

    await disbandTeam(teamId, userId);

    res.json({ message: 'Team disbanded successfully' });
  }),
);

// ── Standings ────────────────────────────────────────────────────────

const VALID_TIERS: readonly string[] = HEAD_TO_HEAD_LEAGUE_RULES.tiers;

const standingsParamsSchema = z.object({
  tier: z.string().refine((v) => VALID_TIERS.includes(v), { message: 'Invalid league tier' }),
  teamSize: z.enum(['2', '3'], { message: 'teamSize must be 2 or 3' }).transform((v) => (v === '2' ? 2 : 3) as 2 | 3),
});

const standingsQuerySchema = z.object({
  instance: leagueInstanceId.optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(50),
  /** 'players': human players' teams only, each with its place among all teams (#595). */
  stables: z.enum(STABLE_FILTERS).default('all'),
});

/**
 * GET /api/team-battles/leagues/:teamSize/:tier/standings?instance=&page=&perPage=
 * One tier (or instance) of the 2v2 or 3v3 League, ranked by LP, with each
 * team's zone and status from the executor's tier plan.
 */
router.get(
  '/leagues/:teamSize/:tier/standings',
  authenticateToken,
  ...validated({ params: standingsParamsSchema, query: standingsQuerySchema }, async (req: AuthRequest, res: Response, { params, query }) => {
    const tier = params.tier;
    const teamSize = params.teamSize;
    const { instance, page, perPage, stables } = query;

    const result = await getTeamLeagueStandings(teamSize === 2 ? 'league_2v2' : 'league_3v3', { tier, instance, page, perPage, stables });

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
  }),
);

/**
 * GET /api/team-battles/leagues/:teamSize/:tier/instances
 * Get league instances for a specific tier and team size.
 */
router.get(
  '/leagues/:teamSize/:tier/instances',
  authenticateToken,
  ...validated({ params: standingsParamsSchema }, async (req: AuthRequest, res: Response, { params }) => {
    const tier = params.tier;
    const teamSize = params.teamSize;
    res.json(await listTeamInstances(teamSize === 2 ? 'league_2v2' : 'league_3v3', tier));
  }),
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
  ...validated({ params: tagTeamTierParamsSchema }, async (req: AuthRequest, res: Response, { params }) => {
    res.json(await listTeamInstances('tag_team', params.tier));
  }),
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
  ...validated({ params: tagTeamTierParamsSchema, query: standingsQuerySchema }, async (req: AuthRequest, res: Response, { params, query }) => {
    const tier = params.tier;
    const { instance, page, perPage, stables } = query;

    const result = await getTeamLeagueStandings('tag_team', { tier, instance, page, perPage, stables });

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
  }),
);

// ── League History ───────────────────────────────────────────────────

/**
 * GET /api/team-battles/robot/:robotId/league-history
 * Get team battle league history for all teams a robot belongs to.
 * Returns league history grouped by team size (2v2 and 3v3), plus tag team history.
 */
router.get(
  '/robot/:robotId/league-history',
  authenticateToken,
  ...validated({ params: z.object({ robotId: positiveIntParam }) }, async (_req: AuthRequest, res: Response, { params }) => {
    res.json({ teams: await getRobotTeamLeagueHistory(params.robotId) });
  }),
);

export default router;
