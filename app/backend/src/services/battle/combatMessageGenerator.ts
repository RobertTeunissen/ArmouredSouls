/**
 * Combat Message Generator — Public API Façade
 *
 * This class preserves the original static-method interface used by all
 * orchestrators and services. The implementation is split into focused modules
 * under ./combat-messages/ for maintainability and testability.
 *
 * Consumers continue to import { CombatMessageGenerator } from this file —
 * no external changes needed.
 */

import { CombatEvent } from './combatSimulator';
import { NarrativeEvent, KothBattleLogData } from '../../types/battleLogTypes';

import {
  // Message generators (pure functions)
  generateBattleStart as _generateBattleStart,
  generateStance as _generateStance,
  generateAttack as _generateAttack,
  generateCounter as _generateCounter,
  generateCounterMiss as _generateCounterMiss,
  generateBattleEnd as _generateBattleEnd,
  generateELOChange as _generateELOChange,
  generateShieldBreak as _generateShieldBreak,
  generateShieldRegen as _generateShieldRegen,
  generateYield as _generateYield,
  generateDestruction as _generateDestruction,
  generateDraw as _generateDraw,
  generateReward as _generateReward,
  generatePrestige as _generatePrestige,
  generateFame as _generateFame,
  generateTagOutYield as _generateTagOutYield,
  generateTagOutDestruction as _generateTagOutDestruction,
  generateTagOut as _generateTagOut,
  generateTagIn as _generateTagIn,
  generateMovement as _generateMovement,
  generateRangeTransition as _generateRangeTransition,
  generateOutOfRange as _generateOutOfRange,
  generateCounterOutOfRange as _generateCounterOutOfRange,
  generateBackstab as _generateBackstab,
  generateFlanking as _generateFlanking,
  generateKothZoneEnter as _generateKothZoneEnter,
  generateKothZoneExit as _generateKothZoneExit,
  generateKothScoreTick as _generateKothScoreTick,
  generateKothKillBonus as _generateKothKillBonus,
  generateKothEliminated as _generateKothEliminated,
  generateKothPassiveWarning as _generateKothPassiveWarning,
  generateKothPassivePenalty as _generateKothPassivePenalty,
  generateKothZoneMoving as _generateKothZoneMoving,
  generateKothZoneActive as _generateKothZoneActive,
  generateKothLastStanding as _generateKothLastStanding,
  generateKothMatchEnd as _generateKothMatchEnd,

  // Event converters
  convertSimulatorEvents as _convertSimulatorEvents,
  convertKothSimulatorEvents as _convertKothSimulatorEvents,
  convertTagTeamEvents as _convertTagTeamEvents,
  convertBattleEvents as _convertBattleEvents,
  buildKothBattleLog as _buildKothBattleLog,

  // Event sampling
  sampleEventsForStorage as _sampleEventsForStorage,

  // Types re-exported from sub-modules
  type SimulatorEventContext,
  type TagTeamContext,
  type BattleEventData,
} from './combat-messages';

// ── Public interface types (preserved for barrel exports) ────────────────

export interface BattleStartEvent {
  robot1Name: string;
  robot2Name: string;
  robot1ELO: number;
  robot2ELO: number;
  leagueType: string;
}

export interface AttackEvent {
  attackerName: string;
  defenderName: string;
  weaponName: string;
  damage: number;
  hit: boolean;
  critical: boolean;
  shieldDamage?: number;
  hpDamage?: number;
  malfunction?: boolean;
}

export interface BattleEndEvent {
  winnerName: string;
  loserName: string;
  winnerHP: number;
  winnerMaxHP: number;
  reason: 'destruction' | 'yield' | 'time';
}

export interface ELOChangeEvent {
  robotName: string;
  oldELO: number;
  newELO: number;
  change: number;
}

export interface RewardEvent {
  robotName: string;
  credits: number;
  prestige?: number;
  fame?: number;
}

export interface TagOutEvent {
  robotName: string;
  teamName: string;
  reason: 'yield' | 'destruction';
  finalHP: number;
}

export interface TagInEvent {
  robotName: string;
  teamName: string;
  hp: number;
}

/**
 * Combat Message Generator Service
 * Thin façade preserving the static-method API.
 * All logic lives in ./combat-messages/ sub-modules.
 */
export class CombatMessageGenerator {

  // ── Individual Message Generators ──────────────────────────────────────

  static generateBattleStart(event: BattleStartEvent & {
    battleType?: 'league_1v1' | 'tournament_1v1' | 'tag_team' | 'koth';
    team1Name?: string;
    team2Name?: string;
    robot3Name?: string;
    robot4Name?: string;
  }): string {
    return _generateBattleStart(event);
  }

  static generateStance(robotName: string, stance: string): string {
    return _generateStance(robotName, stance);
  }

  static generateAttack(event: AttackEvent): string {
    return _generateAttack(event);
  }

  static generateCounter(defenderName: string, attackerName: string, weaponName: string, damage: number, maxHP: number): string {
    return _generateCounter(defenderName, attackerName, weaponName, damage, maxHP);
  }

  static generateCounterMiss(defenderName: string, attackerName: string, weaponName: string): string {
    return _generateCounterMiss(defenderName, attackerName, weaponName);
  }

  static generateBattleEnd(event: BattleEndEvent): string {
    return _generateBattleEnd(event);
  }

  static generateELOChange(event: ELOChangeEvent): string {
    return _generateELOChange(event);
  }

  static generateShieldBreak(robotName: string): string {
    return _generateShieldBreak(robotName);
  }

  static generateShieldRegen(robotName: string): string {
    return _generateShieldRegen(robotName);
  }

  static generateYield(robotName: string, winnerName: string): string {
    return _generateYield(robotName, winnerName);
  }

  static generateDestruction(robotName: string): string {
    return _generateDestruction(robotName);
  }

  static generateDraw(): string {
    return _generateDraw();
  }

  static generateReward(event: RewardEvent): string {
    return _generateReward(event);
  }

  static generatePrestige(robotName: string, prestige: number): string {
    return _generatePrestige(robotName, prestige);
  }

  static generateFame(robotName: string, fame: number): string {
    return _generateFame(robotName, fame);
  }

  static generateTagOutYield(event: TagOutEvent): string {
    return _generateTagOutYield(event);
  }

  static generateTagOutDestruction(event: TagOutEvent): string {
    return _generateTagOutDestruction(event);
  }

  static generateTagOut(event: TagOutEvent): string {
    return _generateTagOut(event);
  }

  static generateTagIn(event: TagInEvent): string {
    return _generateTagIn(event);
  }

  // ── Spatial Event Generators ─────────────────────────────────────────

  static generateMovement(robotName: string, targetName: string, distance: number): string {
    return _generateMovement(robotName, targetName, distance);
  }

  static generateRangeTransition(robotName: string, targetName: string, rangeBand: string): string {
    return _generateRangeTransition(robotName, targetName, rangeBand);
  }

  static generateOutOfRange(robotName: string, weaponName: string, targetName: string, distance: number): string {
    return _generateOutOfRange(robotName, weaponName, targetName, distance);
  }

  static generateCounterOutOfRange(robotName: string, weaponName: string, targetName: string): string {
    return _generateCounterOutOfRange(robotName, weaponName, targetName);
  }

  static generateBackstab(attackerName: string, defenderName: string): string {
    return _generateBackstab(attackerName, defenderName);
  }

  static generateFlanking(attackerName: string, defenderName: string): string {
    return _generateFlanking(attackerName, defenderName);
  }

  // ── KotH Event Generators ────────────────────────────────────────────

  static generateKothZoneEnter(robotName: string, zoneState?: string): string {
    return _generateKothZoneEnter(robotName, zoneState);
  }

  static generateKothZoneExit(robotName: string, forced = false): string {
    return _generateKothZoneExit(robotName, forced);
  }

  static generateKothScoreTick(robotName: string, score: number, contested: boolean): string {
    return _generateKothScoreTick(robotName, score, contested);
  }

  static generateKothKillBonus(killerName: string, victimName: string, bonus: number): string {
    return _generateKothKillBonus(killerName, victimName, bonus);
  }

  static generateKothEliminated(robotName: string, reason: 'destroyed' | 'yielded', score: number, placement?: number): string {
    return _generateKothEliminated(robotName, reason, score, placement);
  }

  static generateKothPassiveWarning(robotName: string): string {
    return _generateKothPassiveWarning(robotName);
  }

  static generateKothPassivePenalty(robotName: string, damageReduction: number, accuracyPenalty: number): string {
    return _generateKothPassivePenalty(robotName, damageReduction, accuracyPenalty);
  }

  static generateKothZoneMoving(countdown: number): string {
    return _generateKothZoneMoving(countdown);
  }

  static generateKothZoneActive(): string {
    return _generateKothZoneActive();
  }

  static generateKothLastStanding(robotName: string): string {
    return _generateKothLastStanding(robotName);
  }

  static generateKothMatchEnd(winnerName: string, score: number, reason: string): string {
    return _generateKothMatchEnd(winnerName, score, reason);
  }

  // ── Event Converters ─────────────────────────────────────────────────

  static convertSimulatorEvents(
    simulatorEvents: CombatEvent[],
    context: SimulatorEventContext
  ): NarrativeEvent[] {
    return _convertSimulatorEvents(simulatorEvents, context);
  }

  static convertTagTeamEvents(
    mixedEvents: Array<{ timestamp: number; type: string; [key: string]: unknown }>,
    context: TagTeamContext
  ): NarrativeEvent[] {
    return _convertTagTeamEvents(mixedEvents, context);
  }

  static convertBattleEvents(battleData: BattleEventData): NarrativeEvent[] {
    return _convertBattleEvents(battleData);
  }

  static convertKothSimulatorEvents(simulatorEvents: CombatEvent[]): NarrativeEvent[] {
    return _convertKothSimulatorEvents(simulatorEvents);
  }

  // ── Storage Helpers ──────────────────────────────────────────────────

  static sampleEventsForStorage(events: CombatEvent[], sampleInterval: number = 5): CombatEvent[] {
    return _sampleEventsForStorage(events, sampleInterval);
  }

  static buildKothBattleLog(data: {
    events: CombatEvent[];
    participantCount: number;
    arenaRadius: number;
    startingPositions: Record<string, { x: number; y: number }>;
    endingPositions: Record<string, { x: number; y: number }>;
    scoreThreshold: number;
    zoneRadius: number;
    placements: Array<{
      robotId: number;
      robotName: string;
      placement: number;
      zoneScore: number;
      zoneTime: number;
      kills: number;
      destroyed: boolean;
    }>;
  }): KothBattleLogData {
    return _buildKothBattleLog(data);
  }
}
