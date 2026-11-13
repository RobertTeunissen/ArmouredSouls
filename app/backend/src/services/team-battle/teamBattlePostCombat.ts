/**
 * Post-combat steps shared by the two team-battle modes that run the Team
 * Battle Engine: team leagues (2v2/3v3) and team tournaments (2v2/3v3).
 *
 * Mode rules (rewards, standings, brackets) stay in each orchestrator; this
 * module holds only the steps both modes perform identically on a
 * `TeamBattleResult`.
 *
 * @module services/team-battle/teamBattlePostCombat
 */

import { countKillsByRobot } from '../../shared/utils/battleStatistics';
import type { RobotWithWeapons } from '../battle/combatSimulator';
import { updateRobotCombatStats } from '../battle/battlePostCombat';
import { buildSummaryRobotMaps, writeBattleSummary } from '../battle/battleSummaryWriter';
import type { TeamBattleLog, TeamBattleResult } from '../../types/teamBattleLogTypes';

/** Build the TeamBattleLog JSON structure stored in Battle.battleLog. */
export function buildTeamBattleLog(result: TeamBattleResult, teamSize: 2 | 3): TeamBattleLog {
  return {
    teamBattle: true,
    teamSize,
    winningSide: result.winningSide,
    isDraw: result.isDraw,
    isByeMatch: result.isByeMatch,
    durationSeconds: result.durationSeconds,
    participants: result.participants,
    events: result.battleLog,
    detailedCombatEvents: result.detailedCombatEvents,
    focusFireEvents: result.focusFireEvents,
    focusFireMetrics: result.focusFireMetrics,
    allySupportMetrics: result.allySupportMetrics,
    formationDefenceMetrics: result.formationDefenceMetrics,
    arenaRadius: result.arenaRadius,
    startingPositions: result.startingPositions,
    endingPositions: result.endingPositions,
  };
}

/** Write the battle summary for a fought team battle (Spec #39, non-blocking). */
export async function writeTeamBattleSummary(
  battleId: number,
  battleType: string,
  result: TeamBattleResult,
  team1Robots: RobotWithWeapons[],
  team2Robots: RobotWithWeapons[],
  logTag: string,
): Promise<void> {
  const realRobots = [...team1Robots, ...team2Robots].filter(robot => robot.id > 0);
  await writeBattleSummary(battleId, {
    events: result.detailedCombatEvents,
    duration: Math.round(result.durationSeconds),
    battleType,
    ...buildSummaryRobotMaps(
      realRobots,
      robot => result.participants.find(p => p.robotId === robot.id)?.team ?? 1,
    ),
    tagTeamInfo: {
      team1Robots: team1Robots.filter(robot => robot.id > 0).map(robot => robot.name),
      team2Robots: team2Robots.filter(robot => robot.id > 0).map(robot => robot.name),
    },
    startingPositions: result.startingPositions as Record<string, { x: number; y: number }> | undefined,
    endingPositions: result.endingPositions as Record<string, { x: number; y: number }> | undefined,
    arenaRadius: result.arenaRadius,
  }, logTag);
}

/** One side of a fought team battle, for the robot combat stat update. */
export interface TeamSideStatUpdate {
  team: 1 | 2;
  robots: RobotWithWeapons[];
  eloChange: number;
  isWinner: boolean;
  /** Fame added to each robot of this side (0 for a side that did not win). */
  fameIncrement: number;
}

/**
 * Update every robot's combat stats through the shared `updateRobotCombatStats`
 * (HP, ELO, counters, lifetime damage, kills, fame).
 *
 * Damage taken is the opposing side's total damage split evenly over
 * `teamSize`. Kills are credited per robot from the combat events, so a robot
 * that wrecked two opponents counts two and a teammate that wrecked none
 * counts zero.
 */
export async function updateTeamBattleCombatStats(opts: {
  result: TeamBattleResult;
  sides: [TeamSideStatUpdate, TeamSideStatUpdate];
  teamSize: 2 | 3;
  isDraw: boolean;
  battleType: string;
}): Promise<void> {
  const { result, sides, teamSize, isDraw, battleType } = opts;
  const killsByRobot = countKillsByRobot(
    (result.detailedCombatEvents || []) as unknown as Parameters<typeof countKillsByRobot>[0],
  );
  const damageDealtBySide = (team: 1 | 2): number => result.participants
    .filter(p => p.team === team)
    .reduce((sum, p) => sum + (p.damageDealt ?? 0), 0);

  for (const side of sides) {
    const opponentDamage = damageDealtBySide(side.team === 1 ? 2 : 1);
    for (const robot of side.robots) {
      if (robot.id < 0) continue; // Bye placeholders are not robots
      const participant = result.participants.find(p => p.robotId === robot.id);
      await updateRobotCombatStats({
        robotId: robot.id,
        finalHP: Math.round(participant?.finalHP ?? robot.currentHP),
        combatMaxHP: robot.maxHP,
        newELO: robot.elo + side.eloChange,
        isWinner: side.isWinner,
        isDraw,
        damageDealt: Math.round(participant?.damageDealt ?? 0),
        damageTakenByOpponent: Math.round(opponentDamage / teamSize),
        opponentsDestroyed: killsByRobot[robot.name] ?? 0,
        fameIncrement: side.fameIncrement,
        battleType,
        stance: robot.stance,
        loadoutType: robot.loadoutType,
      });
    }
  }
}
