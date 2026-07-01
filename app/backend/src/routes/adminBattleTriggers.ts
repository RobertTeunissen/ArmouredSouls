/**
 * Admin Battle Trigger Routes
 *
 * Manual trigger endpoints for team battles, team tournaments, and grand melee.
 * Mounted at /api/admin/ from the main admin router.
 */

import express, { Request, Response } from 'express';
import { z } from 'zod';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { validateRequest } from '../middleware/schemaValidator';
import logger from '../config/logger';
import { repairAllRobots } from '../services/economy/repairService';
import { recordAction as recordAuditAction } from '../services/admin/adminAuditLogService';
import prisma from '../lib/prisma';

const router = express.Router();

// --- Zod schemas ---

const teamBattleMatchmakingBodySchema = z.object({
  teamSize: z.union([z.literal(2), z.literal(3)]),
  scheduledFor: z.string().optional(),
});

const teamBattleBattlesBodySchema = z.object({
  teamSize: z.union([z.literal(2), z.literal(3)]),
});

// --- Team Battle manual-trigger endpoints (Spec 37) ---

/**
 * POST /api/admin/team-battles/matchmaking
 * Manually trigger Team Battle matchmaking for a given team size (2v2 or 3v3).
 */
router.post('/team-battles/matchmaking', authenticateToken, requireAdmin, validateRequest({ body: teamBattleMatchmakingBodySchema }), async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const { teamSize, scheduledFor } = req.body;
    const targetTime = scheduledFor ? new Date(scheduledFor) : new Date(Date.now() + 24 * 60 * 60 * 1000);

    logger.info(`[Admin] Triggering ${teamSize}v${teamSize} team battle matchmaking...`);
    const { runTeamBattleMatchmaking } = await import('../services/team-battle/teamBattleMatchmakingService');
    const totalMatches = await runTeamBattleMatchmaking(teamSize, targetTime);

    recordAuditAction(authReq.user!.userId, 'team_battle', 'success', { action: 'matchmaking', teamSize, matchesCreated: totalMatches, scheduledFor: targetTime.toISOString() });

    res.json({
      success: true,
      teamSize,
      matchesCreated: totalMatches,
      scheduledFor: targetTime.toISOString(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    recordAuditAction(authReq.user!.userId, 'team_battle', 'failure', { action: 'matchmaking', teamSize: req.body.teamSize, error: error instanceof Error ? error.message : String(error) });
    logger.error('[Admin] Team battle matchmaking error:', error);
    res.status(500).json({
      error: 'Failed to run team battle matchmaking',
    });
  }
});

/**
 * POST /api/admin/team-battles/battles
 * Manually execute scheduled Team Battle matches for a given team size (2v2 or 3v3).
 */
router.post('/team-battles/battles', authenticateToken, requireAdmin, validateRequest({ body: teamBattleBattlesBodySchema }), async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const { teamSize } = req.body;

    logger.info(`[Admin] Executing ${teamSize}v${teamSize} team battles...`);
    const { executeScheduledTeamBattles } = await import('../services/team-battle/teamBattleOrchestrator');
    const summary = await executeScheduledTeamBattles(teamSize);

    recordAuditAction(authReq.user!.userId, 'team_battle', 'success', { action: 'battles_run', teamSize, matchesCompleted: summary.matchesCompleted, matchesCancelled: summary.matchesCancelled });

    res.json({
      success: true,
      teamSize,
      summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    recordAuditAction(authReq.user!.userId, 'team_battle', 'failure', { action: 'battles_run', teamSize: req.body.teamSize, error: error instanceof Error ? error.message : String(error) });
    logger.error('[Admin] Team battle execution error:', error);
    res.status(500).json({
      error: 'Failed to execute team battles',
    });
  }
});

/**
 * POST /api/admin/team-battles/rebalance
 * Manually trigger Team Battle league rebalancing for all tiers.
 */
router.post('/team-battles/rebalance', authenticateToken, requireAdmin, validateRequest({}), async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    logger.info('[Admin] Triggering team battle league rebalancing...');
    const { rebalanceTeamBattleLeagues } = await import('../services/team-battle/teamBattleAdapter');
    const summary2v2 = await rebalanceTeamBattleLeagues(2);
    const summary3v3 = await rebalanceTeamBattleLeagues(3);
    const summary = { '2v2': summary2v2, '3v3': summary3v3 };

    recordAuditAction(authReq.user!.userId, 'team_battle', 'success', { action: 'rebalance', summary });

    res.json({
      success: true,
      summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    recordAuditAction(authReq.user!.userId, 'team_battle', 'failure', { action: 'rebalance', error: error instanceof Error ? error.message : String(error) });
    logger.error('[Admin] Team battle rebalancing error:', error);
    res.status(500).json({
      error: 'Failed to rebalance team battle leagues',
    });
  }
});

// --- Reserved slot trigger endpoints (Spec 36) ---

/**
 * POST /api/admin/team-2v2-league/trigger
 * Trigger Team 2v2 League cycle: execute battles → rebalance → matchmaking.
 */
router.post('/team-2v2-league/trigger', authenticateToken, requireAdmin, validateRequest({}), async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    logger.info('[Admin] Triggering Team 2v2 League cycle...');
    const { executeScheduledTeamBattles } = await import('../services/team-battle/teamBattleOrchestrator');
    const { rebalanceTeamBattleLeagues } = await import('../services/team-battle/teamBattleAdapter');
    const { runTeamBattleMatchmaking } = await import('../services/team-battle/teamBattleMatchmakingService');

    await repairAllRobots(true);
    const execResult = await executeScheduledTeamBattles(2);
    const rebalanceSummary = await rebalanceTeamBattleLeagues(2);
    const matchesCreated = await runTeamBattleMatchmaking(2);

    recordAuditAction(authReq.user!.userId, 'team_battle', 'success', { action: 'trigger_cycle', teamSize: 2, matchesCompleted: execResult.matchesCompleted, matchesCreated });

    res.json({
      success: true,
      event: 'team_2v2_league',
      execution: { matchesCompleted: execResult.matchesCompleted, matchesCancelled: execResult.matchesCancelled },
      rebalance: rebalanceSummary,
      matchmaking: { matchesCreated },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    recordAuditAction(authReq.user!.userId, 'team_battle', 'failure', { action: 'trigger_cycle', teamSize: 2, error: error instanceof Error ? error.message : String(error) });
    logger.error('[Admin] Team 2v2 League trigger error:', error);
    res.status(500).json({
      error: 'Failed to trigger Team 2v2 League cycle',
    });
  }
});

/**
 * POST /api/admin/team-3v3-league/trigger
 * Trigger Team 3v3 League cycle: execute battles → rebalance → matchmaking.
 */
router.post('/team-3v3-league/trigger', authenticateToken, requireAdmin, validateRequest({}), async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    logger.info('[Admin] Triggering Team 3v3 League cycle...');
    const { executeScheduledTeamBattles } = await import('../services/team-battle/teamBattleOrchestrator');
    const { rebalanceTeamBattleLeagues } = await import('../services/team-battle/teamBattleAdapter');
    const { runTeamBattleMatchmaking } = await import('../services/team-battle/teamBattleMatchmakingService');

    await repairAllRobots(true);
    const execResult = await executeScheduledTeamBattles(3);
    const rebalanceSummary = await rebalanceTeamBattleLeagues(3);
    const matchesCreated = await runTeamBattleMatchmaking(3);

    recordAuditAction(authReq.user!.userId, 'team_battle', 'success', { action: 'trigger_cycle', teamSize: 3, matchesCompleted: execResult.matchesCompleted, matchesCreated });

    res.json({
      success: true,
      event: 'team_3v3_league',
      execution: { matchesCompleted: execResult.matchesCompleted, matchesCancelled: execResult.matchesCancelled },
      rebalance: rebalanceSummary,
      matchmaking: { matchesCreated },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    recordAuditAction(authReq.user!.userId, 'team_battle', 'failure', { action: 'trigger_cycle', teamSize: 3, error: error instanceof Error ? error.message : String(error) });
    logger.error('[Admin] Team 3v3 League trigger error:', error);
    res.status(500).json({
      error: 'Failed to trigger Team 3v3 League cycle',
    });
  }
});

/**
 * POST /api/admin/team-2v2-tournament/trigger
 * Execute pending matches in the active 2v2 team tournament's current round.
 */
router.post('/team-2v2-tournament/trigger', authenticateToken, requireAdmin, validateRequest({}), async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const { executeTeamTournamentRound } = await import('../services/tournament/teamTournamentBattleOrchestrator');
    const { advanceWinnersToNextRound } = await import('../services/tournament/tournamentService');

    const activeTournament = await prisma.tournament.findFirst({
      where: { participantType: 'team_2v2', status: 'active' },
    });

    if (!activeTournament) {
      return res.status(404).json({ error: 'No active 2v2 tournament available' });
    }

    await repairAllRobots(true);
    const roundResult = await executeTeamTournamentRound(activeTournament.id, 2);
    await advanceWinnersToNextRound(activeTournament.id);

    const updatedTournament = await prisma.tournament.findUnique({ where: { id: activeTournament.id } });
    const tournamentComplete = updatedTournament?.status === 'completed';
    const championTeamId = tournamentComplete ? (updatedTournament?.winnerId ?? null) : null;

    recordAuditAction(authReq.user!.userId, 'team_tournament_trigger', 'success', {
      tournamentType: '2v2',
      tournamentId: activeTournament.id,
      tournamentName: activeTournament.name,
      matchesExecuted: roundResult.matchesExecuted,
      matchesFailed: roundResult.matchesFailed,
      tournamentComplete,
      championTeamId,
    });

    res.json({
      matchesExecuted: roundResult.matchesExecuted,
      matchesFailed: roundResult.matchesFailed,
      tournamentComplete,
      championTeamId,
    });
  } catch (error) {
    recordAuditAction(authReq.user!.userId, 'team_tournament_trigger', 'failure', { tournamentType: '2v2', error: error instanceof Error ? error.message : String(error) });
    logger.error('[Admin] Team 2v2 Tournament trigger error:', error);
    res.status(500).json({
      error: 'Failed to trigger Team 2v2 Tournament round',
    });
  }
});

/**
 * POST /api/admin/team-3v3-tournament/trigger
 * Execute pending matches in the active 3v3 team tournament's current round.
 */
router.post('/team-3v3-tournament/trigger', authenticateToken, requireAdmin, validateRequest({}), async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const { executeTeamTournamentRound } = await import('../services/tournament/teamTournamentBattleOrchestrator');
    const { advanceWinnersToNextRound } = await import('../services/tournament/tournamentService');

    const activeTournament = await prisma.tournament.findFirst({
      where: { participantType: 'team_3v3', status: 'active' },
    });

    if (!activeTournament) {
      return res.status(404).json({ error: 'No active 3v3 tournament available' });
    }

    await repairAllRobots(true);
    const roundResult = await executeTeamTournamentRound(activeTournament.id, 3);
    await advanceWinnersToNextRound(activeTournament.id);

    const updatedTournament = await prisma.tournament.findUnique({ where: { id: activeTournament.id } });
    const tournamentComplete = updatedTournament?.status === 'completed';
    const championTeamId = tournamentComplete ? (updatedTournament?.winnerId ?? null) : null;

    recordAuditAction(authReq.user!.userId, 'team_tournament_trigger', 'success', {
      tournamentType: '3v3',
      tournamentId: activeTournament.id,
      tournamentName: activeTournament.name,
      matchesExecuted: roundResult.matchesExecuted,
      matchesFailed: roundResult.matchesFailed,
      tournamentComplete,
      championTeamId,
    });

    res.json({
      matchesExecuted: roundResult.matchesExecuted,
      matchesFailed: roundResult.matchesFailed,
      tournamentComplete,
      championTeamId,
    });
  } catch (error) {
    recordAuditAction(authReq.user!.userId, 'team_tournament_trigger', 'failure', { tournamentType: '3v3', error: error instanceof Error ? error.message : String(error) });
    logger.error('[Admin] Team 3v3 Tournament trigger error:', error);
    res.status(500).json({
      error: 'Failed to trigger Team 3v3 Tournament round',
    });
  }
});

/**
 * POST /api/admin/grand-melee/trigger
 * @deprecated Use POST /api/admin/scheduler/trigger/grandMelee instead.
 */
router.post('/grand-melee/trigger', authenticateToken, requireAdmin, validateRequest({}), async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const { triggerJob } = await import('../services/cycle/cycleScheduler');

    logger.info('[Admin] Grand Melee trigger (deprecated endpoint) — delegating to triggerJob("grandMelee")');
    await triggerJob('grandMelee');

    recordAuditAction(authReq.user!.userId, 'grand_melee_trigger', 'success', { message: 'Grand Melee cycle triggered (deprecated endpoint)' });

    res.json({
      success: true,
      deprecated: true,
      deprecationWarning: 'Use POST /api/admin/scheduler/trigger/grandMelee instead. This endpoint will be removed in a future release.',
      message: 'Grand Melee cycle triggered successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    recordAuditAction(authReq.user!.userId, 'grand_melee_trigger', 'failure', { error: error instanceof Error ? error.message : String(error) });
    logger.error('[Admin] Grand Melee trigger error:', error);
    res.status(500).json({
      error: 'Failed to trigger Grand Melee cycle',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
