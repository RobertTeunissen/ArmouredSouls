/**
 * Battle Strategy Interface & BattleProcessor
 *
 * Implements the Strategy Pattern for battle orchestration.
 * New match types implement BattleStrategy (~100-150 lines of unique logic)
 * and plug into BattleProcessor which handles the shared 9-step pipeline.
 *
 * Existing orchestrators (league, tournament, tag team, KotH) have been
 * refactored to use the shared helpers from battlePostCombat.ts but keep
 * their own processBattle() flows for backward compatibility.
 *
 * New match types should use BattleProcessor.process() instead of writing
 * a full orchestrator from scratch.
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │                  BattleProcessor (shared)                    │
 * │                                                             │
 * │  1. loadParticipants()          ← strategy provides this    │
 * │  2. runSimulation()             ← strategy provides this    │
 * │  3. calculateELO()              ← shared, with opt-out      │
 * │  4. calculateRewards()          ← strategy provides this    │
 * │  5. createBattleRecord()        ← shared structure          │
 * │  6. createParticipants()        ← shared structure          │
 * │  7. updateRobotStats()          ← shared, with extensions   │
 * │  8. awardStreamingRevenue()     ← shared                    │
 * │  9. logAuditEvents()            ← shared structure          │
 * │ 10. updateScheduleRecord()      ← strategy provides this    │
 * │ 11. postProcess()               ← strategy hook (optional)  │
 * └─────────────────────────────────────────────────────────────┘
 */

import { Robot, Battle } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { calculateELOChange } from '../../utils/battleMath';
import {
  awardStreamingRevenueForParticipant,
  logBattleAuditEvent,
  updateRobotCombatStats,
  awardCreditsToUser,
  awardPrestigeToUser,
  AuditEventExtras,
} from './battlePostCombat';

// ─── Types ───────────────────────────────────────────────────────────

/** Loaded participant with robot data and weapons */
export interface LoadedParticipant {
  robot: Robot;
  userId: number;
  team: number;
  role: string | null;
}

/** Result from the simulation step */
export interface SimulationResult {
  winnerId: number | null;
  isDraw: boolean;
  durationSeconds: number;
  /** Per-participant combat outcomes keyed by robotId */
  participants: Map<number, {
    damageDealt: number;
    finalHP: number;
    yielded: boolean;
    destroyed: boolean;
  }>;
  /** Raw combat events for battle log */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  events: any[];
  /** 2D arena spatial metadata */
  arenaRadius?: number;
  startingPositions?: Record<string, { x: number; y: number }>;
  endingPositions?: Record<string, { x: number; y: number }>;
}

/** Reward calculation for a single participant */
export interface ParticipantReward {
  robotId: number;
  userId: number;
  credits: number;
  prestige: number;
  fame: number;
}

/** Extra fields to add to the Battle record (type-specific) */
export interface ExtraBattleFields {
  tournamentId?: number;
  tournamentRound?: number;
  team1ActiveRobotId?: number;
  team1ReserveRobotId?: number;
  team2ActiveRobotId?: number;
  team2ReserveRobotId?: number;
  team1TagOutTime?: bigint | null;
  team2TagOutTime?: bigint | null;
  [key: string]: unknown;
}

/** Extra fields to add to a BattleParticipant record */
export interface ExtraParticipantFields {
  placement?: number;
  [key: string]: unknown;
}

// ─── Strategy Interface ──────────────────────────────────────────────

/**
 * Each match type implements this interface.
 * The BattleProcessor calls these methods in order during process().
 */
export interface BattleStrategy<TMatch = unknown> {
  /** Unique battle type identifier (e.g., 'league', 'tournament', 'koth') */
  readonly battleType: string;

  /** League type for the battle record (e.g., 'bronze', 'tournament', 'koth') */
  readonly leagueType: string;

  // ── Config flags ──

  /** Whether this battle type affects ELO ratings */
  readonly affectsELO: boolean;

  /** Whether this battle type affects league points */
  readonly affectsLeaguePoints: boolean;

  /** Whether draws are possible */
  readonly allowsDraws: boolean;

  /** Whether streaming revenue is awarded */
  readonly hasStreamingRevenue: boolean;

  /** Whether bye matches are possible */
  readonly hasByeMatches: boolean;

  // ── Pipeline methods ──

  /**
   * Load participant robots with weapons from the match record.
   * Called first — provides the robots for simulation.
   */
  loadParticipants(match: TMatch): Promise<LoadedParticipant[]>;

  /**
   * Run the combat simulation.
   * Can call simulateBattle(), simulateBattleMulti(), or custom logic.
   */
  simulate(participants: LoadedParticipant[], match: TMatch): SimulationResult;

  /**
   * Calculate rewards for each participant based on the simulation result.
   * Returns one ParticipantReward per robot.
   */
  calculateRewards(
    result: SimulationResult,
    participants: LoadedParticipant[],
    match: TMatch,
  ): Promise<ParticipantReward[]>;

  /**
   * Build the battle log JSON for the Battle record.
   * Each match type has its own log format (narrative messages, KotH placements, etc.)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildBattleLog(result: SimulationResult, participants: LoadedParticipant[], match: TMatch): any;

  /**
   * Return any type-specific fields for the Battle record.
   * E.g., tournamentId, tournamentRound, tag team robot IDs.
   */
  getExtraBattleFields(result: SimulationResult, match: TMatch): ExtraBattleFields;

  /**
   * Return any type-specific fields for a BattleParticipant record.
   * E.g., KotH placement.
   */
  getExtraParticipantFields(
    robotId: number,
    result: SimulationResult,
    match: TMatch,
  ): ExtraParticipantFields;

  /**
   * Return extra fields for the audit log event for a specific robot.
   * E.g., KotH zone score, tag team role.
   */
  getAuditExtras(robotId: number, result: SimulationResult, match: TMatch): AuditEventExtras;

  /**
   * Update the schedule record (e.g., ScheduledLeagueMatch, ScheduledTournamentMatch) after battle.
   */
  updateScheduleRecord(match: TMatch, battleId: number): Promise<void>;

  /**
   * Optional post-processing hook.
   * E.g., tournament bracket advancement, KotH robot stat updates.
   */
  postProcess?(result: SimulationResult, battle: Battle, match: TMatch): Promise<void>;

  /**
   * Check if a specific match is a bye match.
   */
  isByeMatch?(match: TMatch, participants: LoadedParticipant[]): boolean;
}

// ─── BattleProcessor ─────────────────────────────────────────────────

/**
 * Generic battle processor that executes the shared post-combat pipeline.
 * Delegates type-specific decisions to the provided BattleStrategy.
 *
 * Usage for a new match type:
 *   const strategy = new MyNewBattleStrategy();
 *   const processor = new BattleProcessor(strategy);
 *   const result = await processor.process(matchRecord);
 */
export class BattleProcessor<TMatch = unknown> {
  constructor(private strategy: BattleStrategy<TMatch>) {}

  async process(match: TMatch): Promise<{
    battleId: number;
    winnerId: number | null;
    isDraw: boolean;
    durationSeconds: number;
  }> {
    const { strategy } = this;

    // 1. Load participants
    const participants = await strategy.loadParticipants(match);

    // Prepare robots: full HP/shield for battle
    for (const p of participants) {
      p.robot.currentHP = p.robot.maxHP;
      p.robot.currentShield = p.robot.maxShield;
    }

    const isBye = strategy.isByeMatch?.(match, participants) ?? false;

    // 2. Simulate
    const simResult = strategy.simulate(participants, match);

    // 3. Calculate ELO (if applicable)
    const eloChanges = new Map<number, { before: number; after: number }>();
    if (strategy.affectsELO && participants.length === 2 && !isBye) {
      const [p1, p2] = participants;
      const isP1Winner = simResult.winnerId === p1.robot.id;
      const winnerELO = isP1Winner ? p1.robot.elo : p2.robot.elo;
      const loserELO = isP1Winner ? p2.robot.elo : p1.robot.elo;
      const elo = calculateELOChange(winnerELO, loserELO, simResult.isDraw);

      const p1Change = isP1Winner ? elo.winnerChange : elo.loserChange;
      const p2Change = isP1Winner ? elo.loserChange : elo.winnerChange;

      eloChanges.set(p1.robot.id, { before: p1.robot.elo, after: p1.robot.elo + p1Change });
      eloChanges.set(p2.robot.id, { before: p2.robot.elo, after: p2.robot.elo + p2Change });
    } else {
      // No ELO changes — keep current values
      for (const p of participants) {
        eloChanges.set(p.robot.id, { before: p.robot.elo, after: p.robot.elo });
      }
    }

    // 4. Calculate rewards
    const rewards = await strategy.calculateRewards(simResult, participants, match);
    const rewardMap = new Map(rewards.map(r => [r.robotId, r]));

    // 5. Create Battle record
    const firstRobot = participants[0]?.robot;
    const secondRobot = participants[1]?.robot;
    const firstElo = eloChanges.get(firstRobot.id)!;
    const secondElo = eloChanges.get(secondRobot.id)!;

    const winnerReward = rewards.find(r => r.robotId === simResult.winnerId)?.credits ?? 0;
    const loserRewards = rewards.filter(r => r.robotId !== simResult.winnerId);
    const loserReward = loserRewards.length > 0 ? loserRewards[0].credits : 0;

    const extraBattleFields = strategy.getExtraBattleFields(simResult, match);
    const battleLog = strategy.buildBattleLog(simResult, participants, match);

    const battle = await prisma.battle.create({
      data: {
        robot1Id: firstRobot.id,
        robot2Id: secondRobot.id,
        winnerId: simResult.winnerId,
        battleType: strategy.battleType,
        leagueType: strategy.leagueType,
        battleLog,
        durationSeconds: simResult.durationSeconds,
        winnerReward,
        loserReward,
        robot1ELOBefore: firstElo.before,
        robot2ELOBefore: secondElo.before,
        robot1ELOAfter: firstElo.after,
        robot2ELOAfter: secondElo.after,
        eloChange: Math.abs(firstElo.after - firstElo.before),
        ...extraBattleFields,
      },
    });

    // 6. Create BattleParticipant records
    const participantData = participants.map((p, _idx) => {
      const elo = eloChanges.get(p.robot.id)!;
      const reward = rewardMap.get(p.robot.id);
      const combat = simResult.participants.get(p.robot.id);
      const extras = strategy.getExtraParticipantFields(p.robot.id, simResult, match);

      return {
        battleId: battle.id,
        robotId: p.robot.id,
        team: p.team,
        role: p.role,
        credits: reward?.credits ?? 0,
        streamingRevenue: 0, // Updated later
        eloBefore: elo.before,
        eloAfter: elo.after,
        prestigeAwarded: reward?.prestige ?? 0,
        fameAwarded: reward?.fame ?? 0,
        damageDealt: combat?.damageDealt ?? 0,
        finalHP: combat?.finalHP ?? 0,
        yielded: combat?.yielded ?? false,
        destroyed: combat?.destroyed ?? false,
        ...extras,
      };
    });

    await prisma.battleParticipant.createMany({ data: participantData });

    // 7. Update robot stats + award credits/prestige/fame
    for (const p of participants) {
      const elo = eloChanges.get(p.robot.id)!;
      const reward = rewardMap.get(p.robot.id);
      const combat = simResult.participants.get(p.robot.id);
      const isWinner = simResult.winnerId === p.robot.id;

      // Find opponent damage for damageTaken calculation
      const opponents = participants.filter(op => op.robot.id !== p.robot.id);
      const damageTakenByOpponent = opponents.reduce((sum, op) => {
        const opCombat = simResult.participants.get(op.robot.id);
        return sum + (opCombat?.damageDealt ?? 0);
      }, 0);

      // Check if any opponent was destroyed
      const opponentDestroyed = opponents.some(op => {
        const opCombat = simResult.participants.get(op.robot.id);
        return opCombat?.destroyed ?? false;
      });

      await updateRobotCombatStats({
        robotId: p.robot.id,
        finalHP: combat?.finalHP ?? 0,
        newELO: elo.after,
        isWinner,
        isDraw: simResult.isDraw,
        damageDealt: combat?.damageDealt ?? 0,
        damageTakenByOpponent,
        opponentDestroyed,
        fameIncrement: reward?.fame ?? 0,
      });

      // Award credits and prestige to user
      await awardCreditsToUser(p.userId, reward?.credits ?? 0);
      await awardPrestigeToUser(p.userId, reward?.prestige ?? 0);
    }

    // 8. Streaming revenue
    if (strategy.hasStreamingRevenue && !isBye) {
      for (const p of participants) {
        const calc = await awardStreamingRevenueForParticipant(
          p.robot.id, p.userId, battle.id, isBye,
        );
        if (calc) {
          logger.info(
            `[Streaming] ${p.robot.name} earned ₡${calc.totalRevenue.toLocaleString()} from ${strategy.battleType} Battle #${battle.id}`,
          );
        }
      }
    }

    // 9. Audit events
    for (const p of participants) {
      const reward = rewardMap.get(p.robot.id);
      const combat = simResult.participants.get(p.robot.id);
      const elo = eloChanges.get(p.robot.id)!;
      const isWinner = simResult.winnerId === p.robot.id;

      // Find opponent for 1v1-style audit events
      const opponent = participants.find(op => op.robot.id !== p.robot.id);

      const streamingParticipant = await prisma.battleParticipant.findUnique({
        where: { battleId_robotId: { battleId: battle.id, robotId: p.robot.id } },
        select: { streamingRevenue: true },
      });

      await logBattleAuditEvent(
        {
          robotId: p.robot.id,
          userId: p.userId,
          isWinner,
          isDraw: simResult.isDraw,
          damageDealt: combat?.damageDealt ?? 0,
          finalHP: combat?.finalHP ?? 0,
          yielded: combat?.yielded ?? false,
          destroyed: combat?.destroyed ?? false,
          credits: reward?.credits ?? 0,
          prestige: reward?.prestige ?? 0,
          fame: reward?.fame ?? 0,
          eloBefore: elo.before,
          eloAfter: elo.after,
        },
        {
          id: battle.id,
          battleType: strategy.battleType,
          leagueType: strategy.leagueType,
          durationSeconds: simResult.durationSeconds,
          eloChange: Math.abs(elo.after - elo.before),
        },
        opponent?.robot.id ?? null,
        streamingParticipant?.streamingRevenue ?? 0,
        isBye,
        strategy.getAuditExtras(p.robot.id, simResult, match),
      );
    }

    // 10. Update schedule record
    await strategy.updateScheduleRecord(match, battle.id);

    // 11. Post-processing hook
    if (strategy.postProcess) {
      await strategy.postProcess(simResult, battle, match);
    }

    logger.info(
      `[BattleProcessor] ${strategy.battleType} Battle #${battle.id} complete: ` +
      `Winner=${simResult.winnerId ?? 'Draw'}, Duration=${simResult.durationSeconds}s`,
    );

    return {
      battleId: battle.id,
      winnerId: simResult.winnerId,
      isDraw: simResult.isDraw,
      durationSeconds: simResult.durationSeconds,
    };
  }
}
