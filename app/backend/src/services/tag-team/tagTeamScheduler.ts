import { StandingsMode, Prisma } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { RobotWithWeapons } from '../battle/combatSimulator';
import { TagTeamError, TagTeamErrorCode } from '../../errors/tagTeamErrors';
import { prepareRobotForCombat } from '../../utils/robotCalculations';
import { getTuningBonusesBatch } from '../tuning-pool';
import { TagTeamWithRobots, TagTeamBattleResult } from './tagTeamTypes';
import { simulateTagTeamBattle } from './tagTeamSimulation';
import { createTagTeamBattleRecord } from './tagTeamBattleRecord';
import { updateTagTeamBattleResults } from './tagTeamResultUpdater';
import { calculateTagTeamELOChanges, calculateTagTeamLeaguePoints } from './tagTeamRewards';
import { resolveByeEvent, BYE_BATTLE_DURATION_SECONDS } from '../battle/byeResolutionService';
import { resolveForfeitEvent } from '../battle/forfeitResolutionService';
import { applyLoadoutFallbacks, evaluateMatchEntry, type MatchEntryOutcome } from '../battle/combatReadiness';
import { BYE_MODE_SPECS } from '../../utils/byeRewards';
import { getCurrentCycleNumber } from '../battle/baseOrchestrator';
import { handleMatchFailure } from '../battle/matchFailurePolicy';
import { BattleError, BattleErrorCode } from '../../errors/battleErrors';

// ─── Scheduled Match Shape (mapped from unified table) ───────────────────────

/** Shape of a scheduled tag team match as mapped from the unified scheduling table. */
interface ScheduledTagTeamMatchData {
  id: number;
  team1Id: number;
  team2Id: number | null;
  teamSize: number;
  matchMode: string;
  teamBattleLeague: string;
  teamBattleLeagueId: string;
  scheduledFor: Date;
  status: string;
  cancelReason: string | null;
  createdAt: Date;
  team1: Prisma.TeamBattleGetPayload<{ include: { members: { include: { robot: true } } } }>;
  team2: Prisma.TeamBattleGetPayload<{ include: { members: { include: { robot: true } } } }> | null;
}

/**
 * Execute a tag team battle
 * Requirement 3.1: Initialize battle with both teams' active robots
 * Requirement 12.3: Execute normal battle against bye-team
 */
/**
 * Resolve a tag team bye through the Bye_Reward_Module (Spec #49).
 *
 * No Bye_Placeholder team is built, `simulateTagTeamBattle` is never called, and
 * `createTagTeamBattleRecord` is not reached — the `battles` row is born in the
 * writer, like every other mode. The team still gains ELO against the 2000
 * combined bye-team rating and LP +3, unchanged.
 */
async function resolveTagTeamBye(
  match: ScheduledTagTeamMatchData,
): Promise<TagTeamBattleResult> {
  const teamRaw = await prisma.teamBattle.findUnique({
    where: { id: match.team1Id },
    include: { members: { orderBy: { slotIndex: 'asc' } } },
  });

  if (!teamRaw || teamRaw.members.length < 2) {
    throw new TagTeamError(
      TagTeamErrorCode.INVALID_TEAM_COMPOSITION,
      `Real team not found or incomplete for tag team bye match ${match.id}`,
      404,
      { matchId: match.id, teamId: match.team1Id },
    );
  }

  // `members` is ordered by `slotIndex`, and everything below treats robots[0]
  // as Active and robots[1] as Reserve. `findMany` gives no ordering guarantee
  // for an `in` filter, so re-order to the slot order rather than trusting it —
  // an unordered result would silently swap Active and Reserve in the returned
  // HP fields and in the battle metadata.
  const memberRobotIds = teamRaw.members.map(m => m.robotId);
  const robotRows = await prisma.robot.findMany({
    where: { id: { in: memberRobotIds } },
    select: { id: true, name: true, userId: true, currentHP: true, maxHP: true, elo: true },
  });
  const robotsById = new Map(robotRows.map(r => [r.id, r]));
  const robots = memberRobotIds
    .map(id => robotsById.get(id))
    .filter((r): r is NonNullable<typeof r> => r !== undefined);

  if (robots.length < 2) {
    throw new TagTeamError(
      TagTeamErrorCode.INVALID_TEAM_COMPOSITION,
      `Team ${match.team1Id} has members without robot rows for tag team bye match ${match.id}`,
      404,
      { matchId: match.id, teamId: match.team1Id },
    );
  }

  // ELO against the notional combined bye-team rating (1000 per robot).
  const teamSumELO = robots.reduce((sum, r) => sum + r.elo, 0);
  const eloChanges = calculateTagTeamELOChanges(teamSumELO, 2000, true, false);
  const newEloByRobotId: Record<number, number> = {};
  for (const r of robots) {
    newEloByRobotId[r.id] = r.elo + eloChanges.team1Change;
  }

  const resolution = await resolveByeEvent({
    mode: 'tag_team',
    context: { mode: 'tag_team', tier: match.teamBattleLeague },
    claim: { source: 'scheduled_match', scheduledMatchId: match.id },
    participants: robots,
    stableUserId: teamRaw.stableId,
    battle: {
      battleType: 'tag_team',
      leagueType: match.teamBattleLeague,
      leagueInstanceId: match.teamBattleLeagueId,
      winnerId: robots[0]?.id ?? null,
      winningSide: 1,
      byeMessage: `${teamRaw.teamName ?? 'Team'} wins by walkover (bye)`,
    },
    standingEntity: { entityType: 'team', entityId: match.team1Id },
    newEloByRobotId,
    eloChange: eloChanges.team1Change,
    cycleNumber: await getCurrentCycleNumber(),
  });

  logger.info(
    `[TagTeamBattle] Bye: team ${match.team1Id} auto-win | ₡${resolution.creditsPaid} | no damage, no prestige, no fame`,
  );

  // Same reasoning as the league bye path: the writer supplies the winning
  // battle id on an already-claimed re-run, so null means nothing resolved.
  if (resolution.battleId === null) {
    throw new TagTeamError(
      TagTeamErrorCode.INVALID_TEAM_COMPOSITION,
      `Bye resolution produced no battle for tag team match ${match.id}`,
      500,
      { matchId: match.id, teamId: match.team1Id },
    );
  }

  return {
    battleId: resolution.battleId,
    winnerId: match.team1Id,
    isDraw: false,
    durationSeconds: BYE_BATTLE_DURATION_SECONDS,
    // Nothing was simulated, so every combat figure is zero and HP is untouched.
    team1ActiveFinalHP: robots[0]?.currentHP ?? 0,
    team1ReserveFinalHP: robots[1]?.currentHP ?? 0,
    team2ActiveFinalHP: 0,
    team2ReserveFinalHP: 0,
    team1ReserveUsed: false,
    team2ReserveUsed: false,
    team1ActiveDamageDealt: 0,
    team1ReserveDamageDealt: 0,
    team2ActiveDamageDealt: 0,
    team2ReserveDamageDealt: 0,
    team1ActiveSurvivalTime: 0,
    team1ReserveSurvivalTime: 0,
    team2ActiveSurvivalTime: 0,
    team2ReserveSurvivalTime: 0,
    battleLog: [],
    phases: [],
    team1Name: teamRaw.teamName ?? 'Team',
    team2Name: 'Bye',
    team1ReserveName: robots[1]?.name ?? '',
    team2ReserveName: '',
  };
}

/**
 * Resolve a tag team battle-time forfeit through the Forfeit_Resolution_Writer.
 *
 * Either robot (active or reserve) without a main weapon forfeits its team.
 * Nothing is simulated: the ready team wins with the bye-level reward and the
 * bye LP, the forfeiting team takes a normal loss with 0 credits, and both
 * teams unready is a draw with no credits.
 */
async function resolveTagTeamForfeit(
  match: ScheduledTagTeamMatchData,
  team1: TagTeamWithRobots,
  team2: TagTeamWithRobots,
  outcome: Exclude<MatchEntryOutcome, { kind: 'fight' }>,
): Promise<TagTeamBattleResult> {
  const isDraw = outcome.kind === 'double_forfeit';
  const side1Forfeits = isDraw || outcome.forfeitingSides[0] === 1;
  const side2Forfeits = isDraw || outcome.forfeitingSides[0] === 2;

  const team1Robots = [team1.activeRobot, team1.reserveRobot];
  const team2Robots = [team2.activeRobot, team2.reserveRobot];
  const combined1 = team1.activeRobot.elo + team1.reserveRobot.elo;
  const combined2 = team2.activeRobot.elo + team2.reserveRobot.elo;
  const eloChanges = calculateTagTeamELOChanges(combined1, combined2, !isDraw && side2Forfeits, isDraw);
  const newEloByRobotId: Record<number, number> = {};
  for (const r of team1Robots) newEloByRobotId[r.id] = r.elo + eloChanges.team1Change;
  for (const r of team2Robots) newEloByRobotId[r.id] = r.elo + eloChanges.team2Change;

  const readySide: 1 | 2 | null = isDraw ? null : side2Forfeits ? 1 : 2;
  const winnerTeamId = readySide === 1 ? team1.id : readySide === 2 ? team2.id : null;
  const roles = ['active', 'reserve'];
  const toParticipants = (robots: RobotWithWeapons[]) => robots.map((r, slot) => ({
    id: r.id,
    name: r.name,
    userId: r.userId,
    currentHP: r.currentHP,
    maxHP: r.maxHP,
    elo: r.elo,
    role: roles[slot],
  }));
  const forfeiterNames = [side1Forfeits ? team1.teamName : null, side2Forfeits ? team2.teamName : null]
    .filter((n): n is string => n !== null)
    .join(' and ');

  const resolution = await resolveForfeitEvent({
    mode: 'tag_team',
    context: { mode: 'tag_team', tier: match.teamBattleLeague },
    claim: { source: 'scheduled_match', scheduledMatchId: match.id },
    sides: [
      {
        side: 1,
        forfeited: side1Forfeits,
        stableUserId: team1.stableId,
        standingEntity: { entityType: 'team', entityId: team1.id },
        robots: toParticipants(team1Robots),
      },
      {
        side: 2,
        forfeited: side2Forfeits,
        stableUserId: team2.stableId,
        standingEntity: { entityType: 'team', entityId: team2.id },
        robots: toParticipants(team2Robots),
      },
    ],
    newEloByRobotId,
    eloChangeBySide: { 1: eloChanges.team1Change, 2: eloChanges.team2Change },
    lp: {
      win: BYE_MODE_SPECS.tag_team.lpDelta,
      loss: calculateTagTeamLeaguePoints(false, false),
      draw: calculateTagTeamLeaguePoints(false, true),
    },
    standingMode: 'tag_team',
    battle: {
      battleType: 'tag_team',
      leagueType: match.teamBattleLeague,
      leagueInstanceId: match.teamBattleLeagueId,
      winnerId: winnerTeamId,
      winningSide: readySide,
      message: `${forfeiterNames || 'Team'} forfeited: a robot had no main weapon equipped`,
    },
    cycleNumber: await getCurrentCycleNumber(),
  });

  logger.info(
    `[TagTeamBattle] Forfeit: match ${match.id} | ${team1.teamName} vs ${team2.teamName} | ` +
    `${isDraw ? 'double forfeit (draw)' : `Team ${winnerTeamId} wins by forfeit`} | ₡${resolution.creditsPaid}` +
    `${resolution.alreadyResolved ? ' | already resolved' : ''}`,
  );

  if (resolution.battleId === null) {
    throw new BattleError(
      BattleErrorCode.INVALID_BATTLE_STATE,
      `Forfeit resolution produced no battle for tag team match ${match.id}`,
      500,
      { matchId: match.id },
    );
  }

  return {
    battleId: resolution.battleId,
    winnerId: winnerTeamId,
    isDraw,
    isForfeit: true,
    durationSeconds: BYE_BATTLE_DURATION_SECONDS,
    // Nothing was simulated, so every combat figure is zero and HP is untouched.
    team1ActiveFinalHP: team1.activeRobot.currentHP,
    team1ReserveFinalHP: team1.reserveRobot.currentHP,
    team2ActiveFinalHP: team2.activeRobot.currentHP,
    team2ReserveFinalHP: team2.reserveRobot.currentHP,
    team1ReserveUsed: false,
    team2ReserveUsed: false,
    team1ActiveDamageDealt: 0,
    team1ReserveDamageDealt: 0,
    team2ActiveDamageDealt: 0,
    team2ReserveDamageDealt: 0,
    team1ActiveSurvivalTime: 0,
    team1ReserveSurvivalTime: 0,
    team2ActiveSurvivalTime: 0,
    team2ReserveSurvivalTime: 0,
    battleLog: [],
    phases: [],
    team1Name: team1.teamName,
    team2Name: team2.teamName,
    team1ReserveName: team1.reserveRobot.name,
    team2ReserveName: team2.reserveRobot.name,
  };
}

export async function executeTagTeamBattle(match: ScheduledTagTeamMatchData): Promise<TagTeamBattleResult> {
  // R1.8: Reject payloads with team battle league types
  if (match.matchMode !== 'tag_team') {
    throw new TagTeamError(
      TagTeamErrorCode.INVALID_TEAM_COMPOSITION,
      'Tag Team Orchestrator cannot process non-tag_team match modes',
      400,
    );
  }

  // A bye is detected and resolved before any opponent is fabricated and before
  // the simulator is reached (Spec #49 R12.1, R12.2). This path used to build a
  // Bye_Placeholder team, simulate a full tag team battle against it, correct a
  // drawn result to a win, and persist the simulated damage to the real robots —
  // so a walkover produced a repair bill. Nothing is simulated now, so there is
  // no result to override and a draw is structurally impossible.
  if (match.team2Id === null) {
    return resolveTagTeamBye(match);
  }

  // Spec #34: include refinements so prepareRobotForCombat can fold them
  // into the weapon's effective stats before the simulator reads them.
  // Load from TeamBattle with members (slotIndex 0 = active, slotIndex 1 = reserve)
  const team1Raw = await prisma.teamBattle.findUnique({
    where: { id: match.team1Id },
    include: {
      members: {
        include: {
          robot: {
            include: {
              mainWeapon: { include: { weapon: true, refinements: { orderBy: { slotIndex: 'asc' } } } },
              offhandWeapon: { include: { weapon: true, refinements: { orderBy: { slotIndex: 'asc' } } } },
            },
          },
        },
        orderBy: { slotIndex: 'asc' },
      },
    },
  });

  // Map TeamBattle members to TagTeamWithRobots interface
  let team1: TagTeamWithRobots | null = null;
  if (team1Raw && team1Raw.members.length >= 2) {
    // Read league data from standings (source of truth)
    const team1Standing = await prisma.standing.findFirst({
      where: { entityType: 'team', entityId: team1Raw.id, mode: StandingsMode.tag_team },
    });

    if (!team1Standing) {
      logger.warn(`[TagTeamBattle] No standing found for team ${team1Raw.id} in tag_team mode — skipping match`);
      throw new TagTeamError(
        TagTeamErrorCode.TAG_TEAM_NOT_FOUND,
        `No tag_team standing for team ${team1Raw.id}`,
        404,
        { teamId: team1Raw.id }
      );
    }

    team1 = {
      id: team1Raw.id,
      stableId: team1Raw.stableId,
      teamName: team1Raw.teamName,
      teamSize: team1Raw.teamSize,
      activeRobotId: team1Raw.members[0].robotId,
      reserveRobotId: team1Raw.members[1].robotId,
      activeRobot: team1Raw.members[0].robot as RobotWithWeapons,
      reserveRobot: team1Raw.members[1].robot as RobotWithWeapons,
      createdAt: team1Raw.createdAt,
      updatedAt: team1Raw.updatedAt,
    };
  }

  // Load team2. A bye returned above, so team2Id is non-null here.
  let team2: TagTeamWithRobots | null;
  {
    const team2Raw = await prisma.teamBattle.findUnique({
      where: { id: match.team2Id },
      include: {
        members: {
          include: {
            robot: {
              include: {
                mainWeapon: { include: { weapon: true, refinements: { orderBy: { slotIndex: 'asc' } } } },
                offhandWeapon: { include: { weapon: true, refinements: { orderBy: { slotIndex: 'asc' } } } },
              },
            },
          },
          orderBy: { slotIndex: 'asc' },
        },
      },
    });

    if (team2Raw && team2Raw.members.length >= 2) {
      // Read league data from standings (source of truth)
      const team2Standing = await prisma.standing.findFirst({
        where: { entityType: 'team', entityId: team2Raw.id, mode: StandingsMode.tag_team },
      });

      if (!team2Standing) {
        logger.warn(`[TagTeamBattle] No standing found for team ${team2Raw.id} in tag_team mode — treating as null`);
        team2 = null;
      } else {
        team2 = {
          id: team2Raw.id,
          stableId: team2Raw.stableId,
          teamName: team2Raw.teamName,
          teamSize: team2Raw.teamSize,
          activeRobotId: team2Raw.members[0].robotId,
          reserveRobotId: team2Raw.members[1].robotId,
          activeRobot: team2Raw.members[0].robot as RobotWithWeapons,
          reserveRobot: team2Raw.members[1].robot as RobotWithWeapons,
          createdAt: team2Raw.createdAt,
          updatedAt: team2Raw.updatedAt,
        };
      }
    } else {
      team2 = null;
    }
  }

  if (!team1 || !team2) {
    throw new TagTeamError(
      TagTeamErrorCode.TAG_TEAM_NOT_FOUND,
      `Teams not found for match ${match.id}`,
      404,
      { matchId: match.id, team1Id: match.team1Id, team2Id: match.team2Id }
    );
  }

  // Battle-time readiness (rule 1): either robot without a main weapon forfeits
  // its team (rule 2); an incomplete loadout fights as single (rule 6).
  const entry = evaluateMatchEntry(
    [team1.activeRobot, team1.reserveRobot],
    [team2.activeRobot, team2.reserveRobot],
  );
  if (entry.kind !== 'fight') {
    return resolveTagTeamForfeit(match, team1, team2, entry);
  }
  // In memory only, and before prepareRobotForCombat reads loadoutType.
  const allLoadedRobots = [team1.activeRobot, team1.reserveRobot, team2.activeRobot, team2.reserveRobot];
  const loadoutFallbackRobotIds = applyLoadoutFallbacks(allLoadedRobots, entry.decisions);
  for (const robotId of loadoutFallbackRobotIds) {
    const decision = entry.decisions.find(d => d.robotId === robotId);
    logger.warn('[Battle] Loadout fallback', {
      matchId: match.id,
      robotId,
      storedLoadout: decision?.loadoutFallback?.storedLoadout,
      battleLoadout: 'single',
    });
  }

  // Start battle with active robots at full HP
  // Fetch tuning bonuses in a single batch query and prepare all robots for combat
  const allRobotIds = [team1.activeRobot.id, team1.reserveRobot.id, team2.activeRobot.id, team2.reserveRobot.id];
  const tuningMap = await getTuningBonusesBatch(allRobotIds);
  prepareRobotForCombat(team1.activeRobot, tuningMap.get(team1.activeRobot.id) ?? {});
  prepareRobotForCombat(team1.reserveRobot, tuningMap.get(team1.reserveRobot.id) ?? {});
  prepareRobotForCombat(team2.activeRobot, tuningMap.get(team2.activeRobot.id) ?? {});
  prepareRobotForCombat(team2.reserveRobot, tuningMap.get(team2.reserveRobot.id) ?? {});

  // Simulate the tag team battle
  const result = await simulateTagTeamBattle(team1 as TagTeamWithRobots, team2 as TagTeamWithRobots);
  // The result updater reloads the robots with their stored loadout, so it
  // needs to know which ones fought as single (no dual-wield win for them).
  result.loadoutFallbackRobotIds = loadoutFallbackRobotIds;

  // The bye draw-override that used to sit here is gone (Spec #49 R12.7). It
  // existed only to correct a simulation that should not have run for a bye;
  // byes now return before this point, so there is nothing to correct.

  // Map robot winner ID to team winner ID if needed
  if (result.winnerId) {
    // Check which team the winning robot belongs to
    if (result.winnerId === team1.activeRobotId || result.winnerId === team1.reserveRobotId) {
      result.winnerId = team1.id;
    } else if (result.winnerId === team2.activeRobotId || result.winnerId === team2.reserveRobotId) {
      result.winnerId = team2.id;
    }
  }

  // Create battle record
  const battle = await createTagTeamBattleRecord(match, team1 as TagTeamWithRobots, team2 as TagTeamWithRobots, result);
  result.battleId = battle.id;

  // Claim the match before any reward is paid (payment happens later in
  // updateTagTeamBattleResults). Once the match is terminal, a crash or throw
  // during payment can never re-simulate and pay a second time.
  const { count } = await prisma.scheduledMatch.updateMany({
    where: { id: match.id, status: 'scheduled' },
    data: { status: 'completed', battleId: battle.id },
  });
  if (count !== 1) {
    // Another run already resolved this match. Drop our duplicate row
    // (participants and summary cascade) before any reward is paid.
    await prisma.battle.delete({ where: { id: battle.id } }).catch(() => {});
    throw new BattleError(
      BattleErrorCode.BATTLE_ALREADY_COMPLETED,
      `Tag team match ${match.id} already resolved`,
      409,
      { matchId: match.id },
    );
  }

  logger.info(
    `[TagTeamBattle] Completed: ${team1.teamName} vs ${team2.teamName} ` +
    `(Winner: ${result.winnerId ? `Team ${result.winnerId}` : 'Draw'})`
  );

  return result;
}

/**
 * Execute all scheduled tag team battles
 * Requirements 11.1, 11.2, 11.3, 11.4: Multi-match scheduling and execution
 *
 * Readiness is checked inside `executeTagTeamBattle` on the robots loaded for
 * the battle: a team with an unarmed robot forfeits (counted in `forfeits`).
 *
 * @param _scheduledFor - Optional date filter for matches to execute
 * @returns Summary of executed battles
 */
export async function executeScheduledTagTeamBattles(_scheduledFor?: Date): Promise<{
  totalBattles: number;
  wins: number;
  draws: number;
  losses: number;
  /** Matches resolved as a battle-time forfeit (single or double); not counted in totalBattles. */
  forfeits: number;
}> {
  // Query scheduled tag team matches from unified table (Spec #40)
  const unifiedMatches = await prisma.scheduledMatch.findMany({
    where: {
      status: 'scheduled',
      matchType: 'tag_team',
    },
    include: { participants: true },
    orderBy: { scheduledFor: 'asc' },
  });

  // Load team data with members+robots for each match
  const scheduledMatches = [];
  for (const um of unifiedMatches) {
    const p1 = um.participants.find(p => p.slot === 1);
    const p2 = um.participants.find(p => p.slot === 2);
    if (!p1) continue;

    const team1 = await prisma.teamBattle.findUnique({
      where: { id: p1.participantId },
      include: { members: { include: { robot: true }, orderBy: { slotIndex: 'asc' } } },
    });
    const team2 = p2 ? await prisma.teamBattle.findUnique({
      where: { id: p2.participantId },
      include: { members: { include: { robot: true }, orderBy: { slotIndex: 'asc' } } },
    }) : null;

    if (!team1) continue;

    scheduledMatches.push({
      id: um.id,
      team1Id: p1.participantId,
      team2Id: p2?.participantId ?? null,
      teamSize: 2,
      matchMode: 'tag_team',
      teamBattleLeague: um.leagueType ?? 'bronze',
      teamBattleLeagueId: um.leagueInstanceId ?? 'bronze_1',
      scheduledFor: um.scheduledFor,
      status: um.status,
      cancelReason: um.cancelReason ?? null,
      createdAt: um.createdAt,
      team1,
      team2,
    });
  }

  logger.info(`[TagTeamBattles] Found ${scheduledMatches.length} scheduled tag team matches`);

  let totalBattles = 0;
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let forfeits = 0;

  for (const match of scheduledMatches) {
    // A tag-team bye has no second team participant. Keep this outside `try`
    // because the catch must preserve a claimed bye rather than cancelling it.
    const isByeMatch = match.team2Id === null;

    try {
      // Execute the battle (readiness is checked on the loaded robots inside)
      const result = await executeTagTeamBattle(match);

      // A forfeit is fully persisted and paid by resolveForfeitEvent, like a bye.
      if (result.isForfeit) {
        forfeits++;
        continue;
      }

      totalBattles++;

      if (result.isDraw) {
        draws++;
      } else if (result.winnerId === match.team1Id) {
        wins++;
      } else {
        losses++;
      }

      // A Bye_Event is fully persisted and paid by resolveByeEvent. The
      // post-combat updater requires two real teams, so running it here would
      // turn an already-completed bye into a cancelled scheduled match.
      if (!isByeMatch) {
        await updateTagTeamBattleResults(match, result);
      }

    } catch (error) {
      if (isByeMatch) {
        // resolveByeEvent claims before payment. Preserve that completed claim
        // on a required-pair failure so reconciliation can find the linked
        // battle without participants and an operator can safely remediate it.
        // Cancelling it would hide an unpaid reward and prevent recovery.
        // (The policy's conditional cancel would leave it alone too; this
        // guard documents the intent.)
        logger.error(`[TagTeamBattles] Error executing bye match ${match.id}:`, error);
        continue;
      }

      // Rule 7: cancel a still-scheduled match; a match already claimed
      // `completed` (payment failed after the claim) is a logged no-op.
      await handleMatchFailure({
        mode: 'tag_team',
        ref: { source: 'scheduled_match', id: match.id },
        error,
        participants: [match.team1Id, match.team2Id].filter((id): id is number => id !== null),
      });
    }
  }

  logger.info(
    `[TagTeamBattles] Execution complete: ${totalBattles} battles, ` +
    `${wins} wins, ${draws} draws, ${losses} losses, ` +
    `${forfeits} forfeits`
  );

  return {
    totalBattles,
    wins,
    draws,
    losses,
    forfeits,
  };
}
