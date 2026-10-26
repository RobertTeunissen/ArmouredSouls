/**
 * KotH Event Converter
 * Converts KotH combat simulator events into narrative events and
 * builds the full KotH battle log for storage.
 */

import { CombatEvent } from '../combatSimulator';
import { NarrativeEvent, KothBattleLogData, KothLogStorage } from '../../../types/battleLogTypes';
import { compressEventsForStorage } from '../../common/eventCompression';
import {
  generateAttack,
  generateCounter,
  generateCounterMiss,
  generateShieldBreak,
  generateShieldRegen,
  generateDestruction,
} from './messageGenerators';
import { sampleEventsForStorage } from './eventSampling';

/**
 * How KotH and Grand Melee logs are stored: every event with its formula
 * breakdown, like the other modes, so calculations and movement can be debugged.
 * This measured ×4–5 the size of the old sampled, formula-less log (≈ +5.5 GB
 * for the 7-day window on ACC). If disk runs short, `sampled: true` thins
 * movement / range / shield-regen events again (≈ +0.9 GB with formulas kept).
 */
export const KOTH_LOG_STORAGE: KothLogStorage = { formulas: true, sampled: false };

/**
 * Convert KotH simulator events into narrative events.
 * Combat events (attack, counter, etc.) get narrative messages while
 * KotH-specific events (zone_enter, score_tick, etc.) pass through
 * with their original messages.
 */
export function convertKothSimulatorEvents(
  simulatorEvents: CombatEvent[],
): NarrativeEvent[] {
  const narrativeEvents: NarrativeEvent[] = [];

  for (const event of simulatorEvents) {
    const ts = event.timestamp;

    if (event.type === 'malfunction') {
      narrativeEvents.push({
        ...event,
        message: generateAttack({
          attackerName: event.attacker || '',
          defenderName: event.defender || '',
          weaponName: event.weapon || 'weapon',
          damage: 0, hit: false, critical: false, malfunction: true,
        }),
      });
    } else if (event.type === 'miss') {
      narrativeEvents.push({
        ...event,
        message: generateAttack({
          attackerName: event.attacker || '',
          defenderName: event.defender || '',
          weaponName: event.weapon || 'weapon',
          damage: 0, hit: false, critical: false,
        }),
      });
    } else if (event.type === 'attack' || event.type === 'critical') {
      // Skip the simulator's battle-start event (timestamp 0, no weapon)
      if (ts === 0 && !event.weapon) continue;
      narrativeEvents.push({
        ...event,
        message: generateAttack({
          attackerName: event.attacker || '',
          defenderName: event.defender || '',
          weaponName: event.weapon || 'weapon',
          damage: event.damage || 0,
          hit: true,
          critical: event.type === 'critical',
          shieldDamage: event.shieldDamage,
          hpDamage: event.hpDamage,
        }),
      });
    } else if (event.type === 'counter') {
      if (event.hit === false) {
        narrativeEvents.push({
          ...event,
          message: generateCounterMiss(
            event.attacker || '', event.defender || '', event.weapon || 'weapon',
          ),
        });
      } else {
        narrativeEvents.push({
          ...event,
          message: generateCounter(
            event.attacker || '', event.defender || '', event.weapon || 'weapon',
            event.damage || 0, 100,
          ),
        });
      }
    } else if (event.type === 'destroyed') {
      // Skip "X wins!" summary events — KotH has its own end logic
      if (event.message?.includes('wins')) continue;
      const robotName = event.attacker || event.defender || '';
      // Generate narrative even for empty-name edge cases (fallback message)
      narrativeEvents.push({
        ...event,
        message: robotName ? generateDestruction(robotName) : (event.message ?? 'A robot has been destroyed'),
      });
    } else if (event.type === 'yield') {
      narrativeEvents.push({ ...event } as NarrativeEvent);
    } else if (event.type === 'shield_break') {
      narrativeEvents.push({
        ...event,
        message: generateShieldBreak(event.attacker || event.defender || ''),
      });
    } else if (event.type === 'shield_regen') {
      narrativeEvents.push({
        ...event,
        message: generateShieldRegen(event.attacker || event.defender || ''),
      });
    } else {
      // KotH-specific events (zone_enter, zone_exit, score_tick, etc.)
      // and movement events — pass through with original message
      narrativeEvents.push({ ...event } as NarrativeEvent);
    }
  }

  return narrativeEvents;
}

/**
 * Build the full KotH battle log for database storage.
 * Samples events, compresses them, converts to narrative, and assembles
 * the final KothBattleLogData structure.
 */
export function buildKothBattleLog(data: {
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
}, storage: KothLogStorage = KOTH_LOG_STORAGE): KothBattleLogData {
  // 1. Thin out high-frequency events (movement, range, shield regen) unless storing everything
  const storedEvents = storage.sampled ? sampleEventsForStorage(data.events) : data.events;

  // 2. Detailed events keep their formula breakdowns for admin calculation checks;
  //    without formulas, strip the debug-only fields as before.
  const detailedEvents = compressEventsForStorage(storedEvents, storage.formulas);

  // Narrative events never carry formulas (they'd be stored twice).
  const narrativeEvents = convertKothSimulatorEvents(
    compressEventsForStorage(storedEvents, false).filter(e => e.type !== 'movement' && e.type !== 'out_of_range')
  );

  return {
    events: narrativeEvents,
    detailedCombatEvents: detailedEvents,
    storage,
    isKothMatch: true,
    participantCount: data.participantCount,
    arenaRadius: data.arenaRadius,
    startingPositions: data.startingPositions,
    endingPositions: data.endingPositions,
    kothData: {
      isKoth: true,
      participantCount: data.participantCount,
      scoreThreshold: data.scoreThreshold,
      zoneRadius: data.zoneRadius,
      colorPalette: ['#3B82F6', '#EF4444', '#22C55E', '#F97316', '#A855F7', '#06B6D4'],
    },
    placements: data.placements,
  };
}
