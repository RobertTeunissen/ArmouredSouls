/**
 * Steps shared by the two placement modes: King of the Hill and Grand Melee.
 *
 * Both modes load a field of robots, place the unready ones last without
 * fighting (rule 4), simulate the ready ones, and pay rewards per placement.
 * Their scoring and reward formulas differ and stay in each mode; this module
 * holds the steps both perform identically:
 *
 * - loading and partitioning the field
 * - the BattleParticipant rows (fighters and forfeiters)
 * - the one atomic financial transaction for stable income, prestige, fame
 *   and per-robot streaming (placement modes must not combine these deltas)
 * - the previous-battle-lost lookup for achievements
 * - the per-robot audit events, forfeiters included
 *
 * @module services/battle/placementBattleSteps
 */

import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import type { RobotWithWeapons } from './combatSimulator';
import type { CombatEntryDecision } from './combatReadiness';
import { partitionPlacementField } from './combatReadiness';
import { loadCombatRobots } from './battlePreparation';
import {
  awardBattleStreamingRevenue,
  awardCreditsWithLedger,
  awardPrestigeToUser,
  logBattleAuditEvent,
} from './battlePostCombat';
import {
  calculateStreamingRevenueBatch,
  type StreamingRevenueCalculation,
} from '../economy/streamingRevenueService';
import { runFinancialWriteTransaction } from '../cycle/financialWriteTransaction';
import type { PlacementRewardComponent } from '../../types/financialTypes';

export type PlacementMode = 'koth' | 'grand_melee';

/** A robot without a main weapon, placed last without fighting (rule 4). */
export interface ForfeitedPlacement {
  robot: RobotWithWeapons;
  placement: number;
}

/** The fields every placement mode records for a robot that fought. */
export interface PlacementBattleParticipant {
  robot: RobotWithWeapons;
  placement: number;
  kills: number;
  damageDealt: number;
  finalHP: number;
  destroyed: boolean;
  /** Left the match by yielding (HP above 0). */
  yielded: boolean;
  isWinner: boolean;
  tier: string;
  rewards: { credits: number; prestige: number; fame: number };
}

/** The loaded and partitioned field of a placement match. */
export interface PlacementField {
  ready: RobotWithWeapons[];
  unready: RobotWithWeapons[];
  decisions: CombatEntryDecision[];
  /** Unready robots in id order, placed after the fighters (ready.length+1..N). */
  forfeited: ForfeitedPlacement[];
  totalParticipants: number;
}

/**
 * Load the scheduled field and partition it by battle-time readiness (rule 4).
 *
 * Robots that no longer exist are dropped with a warning. The partition comes
 * BEFORE tuning and preparation, so a forfeiter keeps its real currentHP
 * (prepareRobotForCombat sets full HP).
 */
export async function loadPlacementField(
  robotIds: number[],
  matchId: number,
  logTag: string,
): Promise<PlacementField> {
  const loaded: RobotWithWeapons[] = await loadCombatRobots(robotIds);
  const loadedIds = new Set(loaded.map(r => r.id));
  const missing = robotIds.filter(id => !loadedIds.has(id));
  if (missing.length > 0) {
    logger.warn(`${logTag} Match #${matchId}: robot(s) ${missing.join(', ')} no longer exist, dropped from the field`);
  }

  const { ready, forfeited: unready, decisions } = partitionPlacementField(loaded);
  const forfeited: ForfeitedPlacement[] = [...unready]
    .sort((a, b) => a.id - b.id)
    .map((robot, i) => ({ robot, placement: ready.length + 1 + i }));
  return { ready, unready, decisions, forfeited, totalParticipants: ready.length + unready.length };
}

/**
 * Create every BattleParticipant row in one operation. Forfeiters take the
 * last places with nothing paid and their HP untouched (they were never
 * prepared).
 */
export async function createPlacementParticipantRows(
  battleId: number,
  participants: PlacementBattleParticipant[],
  forfeited: ForfeitedPlacement[],
): Promise<void> {
  await prisma.battleParticipant.createMany({
    data: [
      ...participants.map(p => ({
        battleId,
        robotId: p.robot.id,
        team: 1,
        placement: p.placement,
        role: null,
        credits: p.rewards.credits,
        streamingRevenue: 0, // Updated by awardPlacementBattleRewards
        eloBefore: p.robot.elo,
        eloAfter: p.robot.elo,
        prestigeAwarded: p.rewards.prestige,
        fameAwarded: p.rewards.fame,
        damageDealt: p.damageDealt,
        finalHP: p.finalHP,
        yielded: p.yielded,
        destroyed: p.destroyed,
      })),
      ...forfeited.map(f => ({
        battleId,
        robotId: f.robot.id,
        team: 1,
        placement: f.placement,
        role: null,
        credits: 0,
        streamingRevenue: 0,
        eloBefore: f.robot.elo,
        eloAfter: f.robot.elo,
        prestigeAwarded: 0,
        fameAwarded: 0,
        damageDealt: 0,
        finalHP: f.robot.currentHP,
        yielded: false,
        destroyed: false,
        forfeited: true,
      })),
    ],
  });
}

/**
 * Pay a placement battle in one atomic financial transaction: one stable
 * battle income per owner (with the per-robot placement components as
 * provenance), stable prestige, robot fame, and per-robot streaming.
 *
 * @returns The streaming calculation per robot, for the audit events
 */
export async function awardPlacementBattleRewards<P extends PlacementBattleParticipant>(opts: {
  battleId: number;
  mode: PlacementMode;
  /** Ledger description, e.g. 'KotH battle reward'. */
  description: string;
  participants: P[];
  placementComponent: (participant: P) => PlacementRewardComponent;
}): Promise<Map<number, StreamingRevenueCalculation | null>> {
  const { battleId, mode, description, participants, placementComponent } = opts;
  const streamingCalcMap = await calculateStreamingRevenueBatch(
    participants.map(p => ({ robotId: p.robot.id, userId: p.robot.userId })),
  );

  const creditsByUser = new Map<number, number>();
  const placementRewardsByUser = new Map<number, PlacementRewardComponent[]>();
  const prestigeByUser = new Map<number, number>();
  const fameByRobot = new Map<number, number>();

  for (const p of participants) {
    if (p.rewards.credits > 0) {
      creditsByUser.set(p.robot.userId, (creditsByUser.get(p.robot.userId) ?? 0) + p.rewards.credits);
      const placementRewards = placementRewardsByUser.get(p.robot.userId) ?? [];
      placementRewards.push(placementComponent(p));
      placementRewardsByUser.set(p.robot.userId, placementRewards);
    }
    if (p.rewards.prestige > 0) {
      prestigeByUser.set(p.robot.userId, (prestigeByUser.get(p.robot.userId) ?? 0) + p.rewards.prestige);
    }
    if (p.rewards.fame > 0) {
      fameByRobot.set(p.robot.id, (fameByRobot.get(p.robot.id) ?? 0) + p.rewards.fame);
    }
  }

  await runFinancialWriteTransaction(async (tx, financialCycleNumber) => {
    for (const [userId, credits] of creditsByUser) {
      await awardCreditsWithLedger(
        userId,
        credits,
        'battle_income',
        financialCycleNumber,
        description,
        undefined,
        { battleId, placementMode: mode },
        {
          battleId,
          mode,
          tier: 'placement_aggregate',
          outcome: 'placement',
          placement: null,
          participationFloor: 0,
          winComponent: 0,
          teamSize: 1,
          isBye: false,
          placementRewardComponents: placementRewardsByUser.get(userId),
          tx,
        },
      );
    }

    for (const [userId, prestige] of prestigeByUser) {
      await awardPrestigeToUser(userId, prestige, financialCycleNumber, {
        source: 'battle',
        mode,
        battleId,
        tx,
      });
    }

    for (const [robotId, fame] of fameByRobot) {
      await tx.robot.update({
        where: { id: robotId },
        data: { fame: { increment: fame } },
      });
    }

    for (const participant of participants) {
      const streamingCalc = streamingCalcMap.get(participant.robot.id);
      if (!streamingCalc) continue;
      await awardBattleStreamingRevenue(
        participant.robot.userId,
        streamingCalc,
        financialCycleNumber,
        battleId,
        mode,
        tx,
      );
      await tx.battleParticipant.update({
        where: {
          battleId_robotId: { battleId, robotId: participant.robot.id },
        },
        data: { streamingRevenue: streamingCalc.totalRevenue },
      });
    }
  }, { timeout: 30_000 });

  return streamingCalcMap;
}

/**
 * Whether each robot lost its previous battle (for C15 "I Didn't Hear No
 * Bell"), in one query for the whole field.
 */
export async function loadPreviousBattleLossMap(
  robotIds: number[],
  currentBattleId: number,
): Promise<Map<number, boolean>> {
  const prevBattleResults = await prisma.battleParticipant.findMany({
    where: {
      robotId: { in: robotIds },
      battleId: { not: currentBattleId },
    },
    orderBy: { battle: { createdAt: 'desc' } },
    distinct: ['robotId'],
    select: { robotId: true, battle: { select: { winnerId: true } } },
  });
  return new Map<number, boolean>(
    prevBattleResults.map(r => [r.robotId, r.battle.winnerId !== null && r.battle.winnerId !== r.robotId]),
  );
}

/**
 * Write one audit event per robot: the fighters with their rewards and
 * streaming, then the forfeiters, whose last-place loss is on the record too.
 */
export async function logPlacementBattleAuditEvents<P extends PlacementBattleParticipant>(opts: {
  battleId: number;
  mode: PlacementMode;
  durationSeconds: number;
  participants: P[];
  forfeited: ForfeitedPlacement[];
  streamingCalcMap: Map<number, StreamingRevenueCalculation | null>;
  extras: (participant: P) => Record<string, unknown>;
}): Promise<void> {
  const { battleId, mode, durationSeconds, participants, forfeited, streamingCalcMap, extras } = opts;
  const battle = { id: battleId, battleType: mode, leagueType: mode, durationSeconds, eloChange: 0 };
  for (const p of participants) {
    const streamingCalc = streamingCalcMap.get(p.robot.id);
    await logBattleAuditEvent(
      {
        robotId: p.robot.id,
        userId: p.robot.userId,
        isWinner: p.isWinner,
        isDraw: false,
        damageDealt: p.damageDealt,
        finalHP: p.finalHP,
        yielded: p.yielded,
        destroyed: p.destroyed,
        credits: p.rewards.credits,
        prestige: p.rewards.prestige,
        fame: p.rewards.fame,
        eloBefore: p.robot.elo,
        eloAfter: p.robot.elo,
      },
      battle,
      null,
      streamingCalc?.totalRevenue || 0,
      false,
      extras(p),
    );
  }
  for (const f of forfeited) {
    await logBattleAuditEvent(
      {
        robotId: f.robot.id,
        userId: f.robot.userId,
        isWinner: false,
        isDraw: false,
        damageDealt: 0,
        finalHP: f.robot.currentHP,
        yielded: false,
        destroyed: false,
        credits: 0,
        prestige: 0,
        fame: 0,
        eloBefore: f.robot.elo,
        eloAfter: f.robot.elo,
      },
      battle,
      null,
      0,
      false,
      { kothPlacement: f.placement, forfeit: true },
    );
  }
}
