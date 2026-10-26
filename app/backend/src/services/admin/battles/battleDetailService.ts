/**
 * Admin battle detail (`GET /api/admin/battles/:id`): context, sides,
 * participants, the payout check and the combat-log status. The log itself is
 * served separately (`/:id/log`) so a large Grand Melee log never slows this down.
 */
import prisma from '../../../lib/prisma';
import { Prisma } from '../../../../generated/prisma';
import { BattleError, BattleErrorCode } from '../../../errors';
import type { RobotCombatStats } from '../../../shared/utils/battleStatistics';
import { maxHPFromHullIntegrity } from '../../../shared/utils/robotStats';
import { modeShape, timeLimitFor } from './battleModes';
import { loadBattleFacts, outcomeOf, sideLabel, type BattleCoreRow, type BattleFacts } from './battleFacts';
import { queryBattleRows } from './battleListService';
import { comparePayouts, cycleFromEntries, loadBattleLedgerEntries, type LedgerEntry } from './battlePayoutCheck';
import { loadCombatLogStatus } from './battleLogAccess';
import type { BattleDetailResponse, BattleParticipantDetail, BattleSideDetail } from './battleTypes';

interface SummaryFacts {
  perRobot: Map<string, RobotCombatStats>;
  survival: Map<number, number>;
  koth: Map<number, { zoneScore: number; kills: number }>;
}

/**
 * Battle-time max HP per robot, from the battle-time build record (effective
 * hull integrity, same formula as combat). Battles fought before recording
 * started, or robots without a record, are absent: the robot row only holds
 * today's max HP, which changes with every hull upgrade.
 */
async function loadBattleTimeMaxHP(battleId: number): Promise<Map<number, number>> {
  const builds = await prisma.battleParticipantBuild.findMany({
    where: { battleId },
    select: { robotId: true, effectiveAttributes: true },
  });
  const maxHP = new Map<number, number>();
  for (const b of builds) {
    const hull = (b.effectiveAttributes as unknown as Record<string, unknown> | null)?.hullIntegrity;
    if (typeof hull === 'number' && Number.isFinite(hull)) maxHP.set(b.robotId, Math.round(maxHPFromHullIntegrity(hull)));
  }
  return maxHP;
}

async function loadSummaryFacts(battleId: number): Promise<SummaryFacts> {
  const summary = await prisma.battleSummary.findUnique({
    where: { battleId },
    select: { perRobot: true, participants: true, kothPlacements: true },
  });
  const perRobot = new Map<string, RobotCombatStats>();
  const survival = new Map<number, number>();
  const koth = new Map<number, { zoneScore: number; kills: number }>();
  if (!summary) return { perRobot, survival, koth };
  for (const r of (summary.perRobot as unknown as RobotCombatStats[] | null) ?? []) perRobot.set(r.robotName, r);
  for (const p of (summary.participants as unknown as Array<{ robotId: number; survivalSeconds: number }> | null) ?? []) {
    survival.set(p.robotId, p.survivalSeconds);
  }
  for (const k of (summary.kothPlacements as unknown as Array<{ robotId: number; zoneScore: number; kills: number }> | null) ?? []) {
    koth.set(k.robotId, { zoneScore: k.zoneScore, kills: k.kills });
  }
  return { perRobot, survival, koth };
}

export async function loadBattleCore(battleId: number): Promise<BattleCoreRow> {
  const [row] = await queryBattleRows(Prisma.sql`b.id = ${battleId}`, 1, 0);
  if (!row) throw new BattleError(BattleErrorCode.BATTLE_NOT_FOUND, 'Battle not found', 404, { battleId });
  return row;
}

export interface BattleDetailBundle {
  detail: BattleDetailResponse;
  ledgerEntries: LedgerEntry[];
}

function participantsOf(f: BattleFacts, s: SummaryFacts, maxHP: ReadonlyMap<number, number>): BattleParticipantDetail[] {
  return f.participants.map((p) => {
    const stats = s.perRobot.get(p.robotName);
    const koth = s.koth.get(p.robotId);
    return {
      robotId: p.robotId,
      robotName: p.robotName,
      stable: p.stable,
      team: p.team,
      role: p.role,
      placement: p.placement,
      finalHP: p.finalHP,
      maxHP: maxHP.get(p.robotId) ?? null,
      damageDealt: p.damageDealt,
      damageReceived: stats ? Math.round(stats.damageReceived) : null,
      criticalHits: stats ? stats.criticals : null,
      eloBefore: p.eloBefore,
      eloAfter: p.eloAfter,
      credits: p.credits,
      streamingRevenue: p.streamingRevenue,
      prestigeAwarded: p.prestigeAwarded,
      fameAwarded: p.fameAwarded,
      destroyed: p.destroyed,
      yielded: p.yielded,
      forfeited: p.forfeited,
      survivalSeconds: s.survival.get(p.robotId) ?? null,
      exitSeconds: stats?.exitTime ?? null,
      zoneScore: koth?.zoneScore ?? null,
      kills: koth?.kills ?? null,
    };
  });
}

/** Detail plus the raw ledger entries it was checked against (the export needs both). */
export async function loadBattleDetailBundle(battleId: number): Promise<BattleDetailBundle> {
  const row = await loadBattleCore(battleId);
  const facts = (await loadBattleFacts([row])).get(row.id)!;
  const userIds = [...new Set(facts.participants.map(p => p.stable.userId))];
  const [summary, ledgerEntries, combatLog, maxHP] = await Promise.all([
    loadSummaryFacts(row.id),
    loadBattleLedgerEntries(row.id, row.createdAt, userIds),
    loadCombatLogStatus(row.id, row.battleType, row.createdAt),
    loadBattleTimeMaxHP(row.id),
  ]);
  const outcome = outcomeOf(row, facts);

  const sides: BattleSideDetail[] = [];
  if (modeShape(row.battleType) !== 'placement') {
    for (const team of [...new Set(facts.participants.map(p => p.team))].sort((a, b) => a - b)) {
      const members = facts.participants.filter(p => p.team === team);
      sides.push({
        team,
        label: sideLabel(row.battleType, team, members, facts),
        stable: members[0]?.stable ?? null,
        isWinner: outcome.result !== 'draw' && outcome.winningSide === team,
      });
    }
  }

  const detail: BattleDetailResponse = {
    id: row.id,
    battleType: row.battleType,
    leagueType: row.leagueType,
    leagueInstanceId: row.leagueInstanceId,
    tournament: row.tournamentId !== null
      ? { id: row.tournamentId, name: row.tournamentName ?? `Tournament #${row.tournamentId}`, round: row.tournamentRound }
      : null,
    scheduledMatchId: facts.scheduledMatchId,
    tournamentMatchId: facts.tournamentMatchId,
    cycleNumber: cycleFromEntries(ledgerEntries),
    createdAt: row.createdAt.toISOString(),
    durationSeconds: row.durationSeconds,
    timeLimitSeconds: timeLimitFor(row.battleType, facts.scheduledTimeLimit),
    result: outcome.result,
    endedBy: outcome.endedBy,
    winningSide: outcome.winningSide,
    winnerRobotId: outcome.winnerRobotId,
    sides,
    participants: participantsOf(facts, summary, maxHP),
    payout: comparePayouts(facts.participants, ledgerEntries),
    combatLog,
  };
  return { detail, ledgerEntries };
}

export async function getAdminBattleDetail(battleId: number): Promise<BattleDetailResponse> {
  return (await loadBattleDetailBundle(battleId)).detail;
}
