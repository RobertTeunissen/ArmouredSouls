/**
 * Batch loader for the permanent facts the Battles page needs per battle:
 * participants with their stables, bye / forfeit markers, team names and the
 * KotH summary fields. Never reads `battle_log`.
 */
import prisma from '../../../lib/prisma';
import type { KothPlacement } from '../../../types';
import { classifyBattleOutcome, eloSwing, type BattleOutcome } from './battleOutcome';
import { modeShape } from './battleModes';
import type { BattleSideSummary, PlacementFieldSummary, StableKind, StableRef } from './battleTypes';

export interface BattleCoreRow {
  id: number;
  battleType: string;
  leagueType: string;
  leagueInstanceId: string | null;
  tournamentId: number | null;
  tournamentRound: number | null;
  tournamentName: string | null;
  winnerId: number | null;
  winningSide: number | null;
  durationSeconds: number;
  createdAt: Date;
}

export interface ParticipantFact {
  robotId: number;
  robotName: string;
  team: number;
  role: string | null;
  placement: number | null;
  destroyed: boolean;
  yielded: boolean;
  forfeited: boolean;
  eloBefore: number;
  eloAfter: number;
  credits: number;
  streamingRevenue: number;
  prestigeAwarded: number;
  fameAwarded: number;
  damageDealt: number;
  finalHP: number;
  maxHP: number;
  stable: StableRef;
}

export interface BattleFacts {
  participants: ParticipantFact[];
  isBye: boolean;
  isForfeitTournamentBattle: boolean;
  scheduledMatchId: number | null;
  tournamentMatchId: number | null;
  /** Team name per side (1, 2), when the battle was scheduled between teams that still exist. */
  teamNames: Map<number, string>;
  kothPlacements: KothPlacement[] | null;
  scoreThreshold: number | null;
}

const NO_FACTS = (): BattleFacts => ({
  participants: [],
  isBye: false,
  isForfeitTournamentBattle: false,
  scheduledMatchId: null,
  tournamentMatchId: null,
  teamNames: new Map(),
  kothPlacements: null,
  scoreThreshold: null,
});

const UNKNOWN = 'Unknown';

function stableRef(user: { id: number; username: string; stableName: string | null; stableType: StableKind }): StableRef {
  return { userId: user.id, name: user.stableName || user.username, stableType: user.stableType };
}

/** Load the facts for a set of battles (one page of the list, or one battle). */
export async function loadBattleFacts(rows: readonly BattleCoreRow[]): Promise<Map<number, BattleFacts>> {
  const facts = new Map<number, BattleFacts>(rows.map(r => [r.id, NO_FACTS()]));
  if (rows.length === 0) return facts;
  const ids = rows.map(r => r.id);
  const placementIds = rows.filter(r => modeShape(r.battleType) === 'placement').map(r => r.id);

  const [participants, scheduled, bracket, summaries] = await Promise.all([
    prisma.battleParticipant.findMany({
      where: { battleId: { in: ids } },
      select: {
        battleId: true, robotId: true, team: true, role: true, placement: true,
        destroyed: true, yielded: true, forfeited: true, eloBefore: true, eloAfter: true,
        credits: true, streamingRevenue: true, prestigeAwarded: true, fameAwarded: true,
        damageDealt: true, finalHP: true,
        robot: {
          select: {
            name: true,
            maxHP: true,
            user: { select: { id: true, username: true, stableName: true, stableType: true } },
          },
        },
      },
      orderBy: [{ team: 'asc' }, { robotId: 'asc' }],
    }),
    prisma.scheduledMatch.findMany({
      where: { battleId: { in: ids } },
      select: {
        id: true, battleId: true, isByeMatch: true, scoreThreshold: true,
        participants: { select: { slot: true, participantType: true, participantId: true } },
      },
    }),
    prisma.scheduledTournamentMatch.findMany({
      where: { battleId: { in: ids } },
      select: { id: true, battleId: true, isByeMatch: true, status: true, participantType: true, participant1Id: true, participant2Id: true },
    }),
    placementIds.length === 0
      ? Promise.resolve([])
      : prisma.battleSummary.findMany({
          where: { battleId: { in: placementIds } },
          select: { battleId: true, kothPlacements: true, kothData: true },
        }),
  ]);

  // Team ids per battle and side, from the schedule (league modes) or the bracket (team tournaments).
  const teamIdBySide = new Map<number, Map<number, number>>();
  for (const sm of scheduled) {
    if (sm.battleId === null) continue;
    const f = facts.get(sm.battleId);
    if (!f) continue;
    f.scheduledMatchId = sm.id;
    if (sm.isByeMatch === true) f.isBye = true;
    if (sm.scoreThreshold !== null) f.scoreThreshold = sm.scoreThreshold;
    for (const p of sm.participants) {
      if (p.participantType !== 'team') continue;
      const sides = teamIdBySide.get(sm.battleId) ?? new Map<number, number>();
      sides.set(p.slot, p.participantId);
      teamIdBySide.set(sm.battleId, sides);
    }
  }
  for (const tm of bracket) {
    if (tm.battleId === null) continue;
    const f = facts.get(tm.battleId);
    if (!f) continue;
    f.tournamentMatchId = tm.id;
    if (tm.isByeMatch) f.isBye = true;
    if (tm.status === 'forfeit') f.isForfeitTournamentBattle = true;
    if (tm.participantType !== 'robot') {
      const sides = new Map<number, number>();
      if (tm.participant1Id !== null) sides.set(1, tm.participant1Id);
      if (tm.participant2Id !== null) sides.set(2, tm.participant2Id);
      teamIdBySide.set(tm.battleId, sides);
    }
  }

  const teamIds = [...new Set([...teamIdBySide.values()].flatMap(m => [...m.values()]))];
  const teams = teamIds.length === 0
    ? []
    : await prisma.teamBattle.findMany({ where: { id: { in: teamIds } }, select: { id: true, teamName: true } });
  const teamNameById = new Map(teams.map(t => [t.id, t.teamName]));
  for (const [battleId, sides] of teamIdBySide) {
    const f = facts.get(battleId);
    if (!f) continue;
    for (const [side, teamId] of sides) {
      const name = teamNameById.get(teamId);
      if (name) f.teamNames.set(side, name);
    }
  }

  for (const p of participants) {
    const f = facts.get(p.battleId);
    if (!f) continue;
    f.participants.push({
      robotId: p.robotId,
      robotName: p.robot.name,
      team: p.team,
      role: p.role,
      placement: p.placement,
      destroyed: p.destroyed,
      yielded: p.yielded,
      forfeited: p.forfeited,
      eloBefore: p.eloBefore,
      eloAfter: p.eloAfter,
      credits: p.credits,
      streamingRevenue: p.streamingRevenue,
      prestigeAwarded: p.prestigeAwarded,
      fameAwarded: p.fameAwarded,
      damageDealt: p.damageDealt,
      finalHP: p.finalHP,
      maxHP: p.robot.maxHP,
      stable: stableRef(p.robot.user),
    });
  }

  for (const s of summaries) {
    const f = facts.get(s.battleId);
    if (!f) continue;
    f.kothPlacements = (s.kothPlacements as unknown as KothPlacement[] | null) ?? null;
    const kothData = s.kothData as unknown as { scoreThreshold?: number } | null;
    if (typeof kothData?.scoreThreshold === 'number') f.scoreThreshold = kothData.scoreThreshold;
  }

  return facts;
}

/** Outcome of one battle from its row and facts. */
export function outcomeOf(row: BattleCoreRow, f: BattleFacts): BattleOutcome {
  const winnerPlacement = row.winnerId === null
    ? undefined
    : f.kothPlacements?.find(p => p.robotId === row.winnerId);
  return classifyBattleOutcome({
    battleType: row.battleType,
    winnerId: row.winnerId,
    winningSide: row.winningSide,
    durationSeconds: row.durationSeconds,
    participants: f.participants,
    isBye: f.isBye,
    isForfeitTournamentBattle: f.isForfeitTournamentBattle,
    koth: row.battleType === 'koth'
      ? { winnerZoneScore: winnerPlacement?.zoneScore ?? null, scoreThreshold: f.scoreThreshold }
      : null,
  });
}

/** The stable shared by every robot on a side, or the first one's when they differ. */
function sideStable(members: readonly ParticipantFact[]): StableRef | null {
  return members[0]?.stable ?? null;
}

/** Display label for one side of a two-sided battle. */
export function sideLabel(battleType: string, side: number, members: readonly ParticipantFact[], f: BattleFacts): string {
  if (modeShape(battleType) === 'duel') {
    return members.find(m => m.role === null || m.role === 'solo' || m.role === 'active')?.robotName
      ?? members[0]?.robotName
      ?? UNKNOWN;
  }
  const teamName = f.teamNames.get(side);
  if (teamName) return teamName;
  if (members.length === 0) return UNKNOWN;
  return members.map(m => m.robotName).join(' + ');
}

/** List-row sides and placement field for a battle. */
export function summariseSides(
  row: BattleCoreRow,
  f: BattleFacts,
  outcome: BattleOutcome,
): { sides: BattleSideSummary[]; field: PlacementFieldSummary | null } {
  if (modeShape(row.battleType) === 'placement') {
    const winner = f.participants.find(p => p.robotId === outcome.winnerRobotId)
      ?? [...f.participants].sort((a, b) => (a.placement ?? 99) - (b.placement ?? 99))[0];
    const others = f.participants.filter(p => p !== winner);
    const byType: Record<StableKind, number> = { human: 0, generated: 0, automaton: 0 };
    for (const p of others) byType[p.stable.stableType] += 1;
    return {
      sides: winner
        ? [{ team: winner.team, label: winner.robotName, robotCount: 1, stable: winner.stable, isWinner: outcome.result === 'win' }]
        : [],
      field: { others: others.length, othersByStableType: byType },
    };
  }

  const teams = [...new Set([1, 2, ...f.participants.map(p => p.team)])].sort((a, b) => a - b);
  const sides: BattleSideSummary[] = [];
  for (const team of teams) {
    const members = f.participants.filter(p => p.team === team);
    // A bye has one real side; don't invent the empty one.
    if (members.length === 0 && (outcome.result === 'bye' || team > 2)) continue;
    sides.push({
      team,
      label: sideLabel(row.battleType, team, members, f),
      robotCount: members.length,
      stable: sideStable(members),
      isWinner: outcome.result !== 'draw' && outcome.winningSide === team,
    });
  }
  return { sides, field: null };
}

export function swingOf(row: BattleCoreRow, f: BattleFacts, outcome: BattleOutcome): number | null {
  return eloSwing(row.battleType, outcome.result, f.participants);
}
