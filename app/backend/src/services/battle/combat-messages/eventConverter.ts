/**
 * Event Converter — 1v1 Battle Events
 * Converts raw combat simulator events into player-facing narrative events.
 * Contains convertSimulatorEvents and its helper functions.
 */

import { CombatEvent } from '../combatSimulator';
import { NarrativeEvent } from '../../../types/battleLogTypes';
import {
  generateBattleStart,
  generateStance,
  generateAttack,
  generateCounter,
  generateCounterMiss,
  generateBattleEnd,
  generateShieldBreak,
  generateShieldRegen,
  generateYield,
  generateDestruction,
  generateDraw,
  generateMovement,
  generateRangeTransition,
  generateCounterOutOfRange,
  generateBackstab,
  generateFlanking,
  getDamageStatusMessage,
} from './messageGenerators';

// ── HP/Shield Extraction Helper ─────────────────────────────────────────

/**
 * Extract HP and Shield values for a robot from a combat event.
 * Prefers the robotHP/robotShield maps (correct, keyed by name) over
 * the legacy robot1HP/robot2HP fields (which swap based on attacker/defender).
 */
export function getHPFromEvent(
  event: CombatEvent,
  robotName: string,
  context: { robot1Name: string; robot2Name: string }
): { hp: number | undefined; shield: number | undefined } {
  // Prefer robotHP/robotShield maps (correct source of truth, keyed by robot name)
  if (event.robotHP && Object.prototype.hasOwnProperty.call(event.robotHP, robotName)) {
    return {
      hp: event.robotHP[robotName],
      shield: event.robotShield?.[robotName],
    };
  }

  // Legacy fallback for old battle data stored before this fix
  if (robotName === context.robot1Name) {
    return { hp: event.robot1HP, shield: event.robot1Shield };
  }
  if (robotName === context.robot2Name) {
    return { hp: event.robot2HP, shield: event.robot2Shield };
  }

  return { hp: undefined, shield: undefined };
}

// ── Shield Break Detection ──────────────────────────────────────────────

function checkShieldBreak(
  event: CombatEvent,
  context: { robot1Name: string; robot2Name: string },
  prevShields: Map<string, number>,
  narrativeEvents: NarrativeEvent[],
  ts: number
): void {
  if (!event.defender) return;

  const defenderName = event.defender;
  const prevShield = prevShields.get(defenderName) ?? -1;
  const { shield: currentShield } = getHPFromEvent(event, defenderName, context);

  // Shield broke if it was > 0 and is now 0
  if (prevShield > 0 && currentShield === 0) {
    narrativeEvents.push({
      timestamp: ts,
      type: 'shield_break',
      message: generateShieldBreak(defenderName),
    });
  }
}

// ── Damage Status Threshold Detection ───────────────────────────────────

function checkDamageStatus(
  event: CombatEvent,
  context: { robot1Name: string; robot2Name: string; robot1MaxHP: number; robot2MaxHP: number },
  thresholds: Map<string, Set<number>>,
  narrativeEvents: NarrativeEvent[],
  ts: number
): void {
  const damageThresholds = [75, 50, 25]; // Light, Moderate, Heavy

  if (!event.defender) return;

  const defenderName = event.defender;
  const { hp: currentHP } = getHPFromEvent(event, defenderName, context);

  // Skip if HP is undefined or 0 (destruction message handles HP=0)
  if (currentHP === undefined || currentHP <= 0) return;

  const maxHP = defenderName === context.robot1Name
    ? context.robot1MaxHP
    : context.robot2MaxHP;

  const robotThresholds = thresholds.get(defenderName) ?? new Set<number>();
  const pct = (currentHP / maxHP) * 100;

  for (const t of damageThresholds) {
    if (pct <= t && !robotThresholds.has(t)) {
      robotThresholds.add(t);
      thresholds.set(defenderName, robotThresholds);
      const msg = getDamageStatusMessage(defenderName, currentHP, maxHP);
      if (msg) {
        narrativeEvents.push({ timestamp: ts, type: 'damage_status', message: msg });
      }
      break; // Only emit the most severe new threshold
    }
  }
}

// ── Context type for convertSimulatorEvents ─────────────────────────────

export interface SimulatorEventContext {
  robot1Name: string;
  robot2Name: string;
  robot1Stance: string;
  robot2Stance: string;
  robot1MaxHP: number;
  robot2MaxHP: number;
  robot1ELO: number;
  robot2ELO: number;
  leagueType: string;
  battleType?: 'league_1v1' | 'tournament_1v1' | 'tag_team' | 'koth';
  // Tag team fields
  team1Name?: string;
  team2Name?: string;
  robot3Name?: string; // team1 reserve
  robot4Name?: string; // team2 reserve
  // Phase 2+ flag - skip battle_start emission for subsequent phases
  skipBattleStart?: boolean;
}

// ══════════════════════════════════════════════════════════════════════
// CORE: Convert real simulator events into narrative messages
// ══════════════════════════════════════════════════════════════════════

/**
 * Convert real combat simulator events into player-facing narrative events.
 *
 * The simulator produces technical messages; this method converts them into
 * narrative messages and injects additional narrative events (stances, shield
 * breaks, damage status updates, etc.).
 */
export function convertSimulatorEvents(
  simulatorEvents: CombatEvent[],
  context: SimulatorEventContext
): NarrativeEvent[] {
  const narrativeEvents: NarrativeEvent[] = [];

  // Track shield state to detect shield breaks (Map keyed by robot name)
  const prevShields = new Map<string, number>();
  prevShields.set(context.robot1Name, -1); // -1 = not yet initialized
  prevShields.set(context.robot2Name, -1);

  // Track HP thresholds crossed to emit damage status messages (only once per threshold)
  const thresholds = new Map<string, Set<number>>();
  thresholds.set(context.robot1Name, new Set<number>());
  thresholds.set(context.robot2Name, new Set<number>());

  // Track if we've already emitted the battle start + stance intro
  let battleStartEmitted = false;
  // Track if we've already emitted a destruction/battle_end to avoid duplicates
  let battleEndEmitted = false;

  for (const event of simulatorEvents) {
    // ── First event: emit battle start + stances ──
    if (!battleStartEmitted) {
      battleStartEmitted = true;

      if (!context.skipBattleStart) {
        narrativeEvents.push({
          timestamp: 0,
          type: 'battle_start',
          message: generateBattleStart({
            robot1Name: context.robot1Name,
            robot2Name: context.robot2Name,
            robot1ELO: context.robot1ELO,
            robot2ELO: context.robot2ELO,
            leagueType: context.leagueType,
            battleType: context.battleType,
            team1Name: context.team1Name,
            team2Name: context.team2Name,
            robot3Name: context.robot3Name,
            robot4Name: context.robot4Name,
          }),
        });

        narrativeEvents.push({
          timestamp: 0.1,
          type: 'stance',
          message: generateStance(context.robot1Name, context.robot1Stance),
        });
        narrativeEvents.push({
          timestamp: 0.2,
          type: 'stance',
          message: generateStance(context.robot2Name, context.robot2Stance),
        });
      }

      // Initialize shield tracking from first event
      const r1Shield = getHPFromEvent(event, context.robot1Name, context);
      const r2Shield = getHPFromEvent(event, context.robot2Name, context);
      if (r1Shield.shield !== undefined) prevShields.set(context.robot1Name, r1Shield.shield);
      if (r2Shield.shield !== undefined) prevShields.set(context.robot2Name, r2Shield.shield);
    }

    // ── Convert each simulator event type ──
    const ts = event.timestamp;

    const getAttackerName = () => event.attacker || context.robot1Name;
    const getDefenderName = () => event.defender || context.robot2Name;

    if (event.type === 'malfunction') {
      const attackerName = getAttackerName();
      const defenderName = getDefenderName();
      narrativeEvents.push({
        timestamp: ts,
        type: 'malfunction',
        attacker: attackerName,
        message: generateAttack({
          attackerName,
          defenderName,
          weaponName: event.weapon || 'Fists',
          damage: 0,
          hit: false,
          critical: false,
          malfunction: true,
        }),
      });
    } else if (event.type === 'miss') {
      const attackerName = getAttackerName();
      const defenderName = getDefenderName();
      narrativeEvents.push({
        timestamp: ts,
        type: 'miss',
        attacker: attackerName,
        defender: defenderName,
        message: generateAttack({
          attackerName,
          defenderName,
          weaponName: event.weapon || 'Fists',
          damage: 0,
          hit: false,
          critical: false,
        }),
      });
    } else if (event.type === 'attack' || event.type === 'critical') {
      // Skip the simulator's battle-start event (timestamp 0, no weapon)
      if (ts === 0 && !event.weapon) continue;

      const attackerName = getAttackerName();
      const defenderName = getDefenderName();

      narrativeEvents.push({
        timestamp: ts,
        type: event.type === 'critical' ? 'critical' : 'attack',
        attacker: attackerName,
        defender: defenderName,
        weapon: event.weapon,
        message: generateAttack({
          attackerName,
          defenderName,
          weaponName: event.weapon || 'Fists',
          damage: event.damage || 0,
          hit: true,
          critical: event.type === 'critical',
          shieldDamage: event.shieldDamage,
          hpDamage: event.hpDamage,
        }),
      });

      // Shield break detection
      checkShieldBreak(event, context, prevShields, narrativeEvents, ts);
      // Damage status thresholds
      checkDamageStatus(event, context, thresholds, narrativeEvents, ts);

    } else if (event.type === 'counter') {
      const counterWeapon = event.weapon || 'Fists';
      const attackerName = getAttackerName();
      const defenderName = getDefenderName();

      if (event.hit === false) {
        narrativeEvents.push({
          timestamp: ts,
          type: 'counter',
          attacker: attackerName,
          defender: defenderName,
          message: generateCounterMiss(attackerName, defenderName, counterWeapon),
        });
      } else {
        const attackerMaxHP = defenderName === context.robot1Name
          ? context.robot1MaxHP : context.robot2MaxHP;

        narrativeEvents.push({
          timestamp: ts,
          type: 'counter',
          attacker: attackerName,
          defender: defenderName,
          message: generateCounter(
            attackerName, defenderName, counterWeapon,
            event.damage || 0, attackerMaxHP
          ),
        });

        checkShieldBreak(event, context, prevShields, narrativeEvents, ts);
        checkDamageStatus(event, context, thresholds, narrativeEvents, ts);
      }

    } else if (event.type === 'yield') {
      if (battleEndEmitted) continue;

      // Check if this is actually a draw (time limit)
      if (event.message.includes('Draw') || event.message.includes('Time limit reached')) {
        battleEndEmitted = true;
        narrativeEvents.push({
          timestamp: ts,
          type: 'draw',
          message: generateDraw(),
        });
      } else if (event.message.includes('Time limit')) {
        battleEndEmitted = true;
        narrativeEvents.push({
          timestamp: ts,
          type: 'battle_end',
          message: event.message,
        });
      } else {
        battleEndEmitted = true;

        const r1HP = getHPFromEvent(event, context.robot1Name, context);
        const r2HP = getHPFromEvent(event, context.robot2Name, context);
        const robot1HpPct = (r1HP.hp || 0) / context.robot1MaxHP;
        const robot2HpPct = (r2HP.hp || 0) / context.robot2MaxHP;
        const isRobot1Yielding = robot1HpPct <= robot2HpPct;
        const yieldingRobot = isRobot1Yielding ? context.robot1Name : context.robot2Name;
        const winnerRobot = isRobot1Yielding ? context.robot2Name : context.robot1Name;
        const winnerHP = isRobot1Yielding ? (r2HP.hp || 0) : (r1HP.hp || 0);
        const winnerMaxHP = isRobot1Yielding ? context.robot2MaxHP : context.robot1MaxHP;

        narrativeEvents.push({
          timestamp: ts,
          type: 'yield',
          message: generateYield(yieldingRobot, winnerRobot),
        });

        narrativeEvents.push({
          timestamp: ts,
          type: 'battle_end',
          message: generateBattleEnd({
            winnerName: winnerRobot,
            loserName: yieldingRobot,
            winnerHP,
            winnerMaxHP,
            reason: 'yield',
          }),
        });
      }

    } else if (event.type === 'destroyed') {
      if (battleEndEmitted) continue;
      battleEndEmitted = true;

      const r1HP = getHPFromEvent(event, context.robot1Name, context);
      const r2HP = getHPFromEvent(event, context.robot2Name, context);
      const isRobot1Destroyed = (r1HP.hp || 0) === 0;
      const isRobot2Destroyed = (r2HP.hp || 0) === 0;

      // Mutual destruction: both at 0 HP → draw
      if (isRobot1Destroyed && isRobot2Destroyed) {
        narrativeEvents.push({
          timestamp: ts,
          type: 'destroyed',
          message: generateDestruction(context.robot1Name),
        });
        narrativeEvents.push({
          timestamp: ts,
          type: 'destroyed',
          message: generateDestruction(context.robot2Name),
        });
        narrativeEvents.push({
          timestamp: ts,
          type: 'draw',
          message: generateDraw(),
        });
      } else {
        const destroyedRobot = isRobot1Destroyed ? context.robot1Name : context.robot2Name;
        const winnerRobot = isRobot1Destroyed ? context.robot2Name : context.robot1Name;
        const winnerHP = isRobot1Destroyed ? (r2HP.hp || 0) : (r1HP.hp || 0);
        const winnerMaxHP = isRobot1Destroyed ? context.robot2MaxHP : context.robot1MaxHP;

        narrativeEvents.push({
          timestamp: ts,
          type: 'destroyed',
          message: generateDestruction(destroyedRobot),
        });

        narrativeEvents.push({
          timestamp: ts,
          type: 'battle_end',
          message: generateBattleEnd({
            winnerName: winnerRobot,
            loserName: destroyedRobot,
            winnerHP,
            winnerMaxHP,
            reason: 'destruction',
          }),
        });
      }

    } else if (event.type === 'shield_break') {
      const robotName = event.attacker || event.defender || '';
      narrativeEvents.push({
        timestamp: ts,
        type: 'shield_break',
        message: generateShieldBreak(robotName),
      });

    } else if (event.type === 'shield_regen') {
      const robotName = event.attacker || event.defender || '';
      narrativeEvents.push({
        timestamp: ts,
        type: 'shield_regen',
        message: generateShieldRegen(robotName),
      });

    } else if (event.type === 'movement') {
      narrativeEvents.push({
        timestamp: ts,
        type: 'movement',
        message: generateMovement(
          event.attacker || '',
          event.defender || '',
          event.distance || 0,
        ),
      });

    } else if (event.type === 'range_transition') {
      narrativeEvents.push({
        timestamp: ts,
        type: 'range_transition',
        message: generateRangeTransition(
          event.attacker || '',
          event.defender || '',
          event.rangeBand || 'unknown',
        ),
      });

    } else if (event.type === 'out_of_range') {
      // Filtered out — spatial playback viewer shows range visually instead.
      continue;

    } else if (event.type === 'counter_out_of_range') {
      narrativeEvents.push({
        timestamp: ts,
        type: 'counter_out_of_range',
        message: generateCounterOutOfRange(
          event.attacker || '',
          event.weapon || 'Fists',
          event.defender || '',
        ),
      });

    } else if (event.type === 'backstab') {
      narrativeEvents.push({
        timestamp: ts,
        type: 'backstab',
        message: generateBackstab(event.attacker || '', event.defender || ''),
      });

    } else if (event.type === 'flanking') {
      narrativeEvents.push({
        timestamp: ts,
        type: 'flanking',
        message: generateFlanking(event.attacker || '', event.defender || ''),
      });
    }

    // Update shield tracking
    const r1Shield = getHPFromEvent(event, context.robot1Name, context);
    const r2Shield = getHPFromEvent(event, context.robot2Name, context);
    if (r1Shield.shield !== undefined) prevShields.set(context.robot1Name, r1Shield.shield);
    if (r2Shield.shield !== undefined) prevShields.set(context.robot2Name, r2Shield.shield);
  }

  return narrativeEvents;
}
