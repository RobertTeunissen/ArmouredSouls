/**
 * Event Sampling
 * Reduces combat event density for storage by sampling high-frequency
 * event types while always keeping combat-relevant events.
 */

import { CombatEvent } from '../combatSimulator';

/**
 * Sample events for storage — keeps all combat-relevant events and
 * thins out high-frequency positional/status events.
 */
export function sampleEventsForStorage(
  events: CombatEvent[],
  sampleInterval: number = 5,
): CombatEvent[] {
  // Event types that should always be kept (combat-relevant)
  const alwaysKeep = new Set([
    'attack', 'miss', 'critical', 'counter', 'shield_break', 'yield', 'destroyed',
    'malfunction', 'backstab', 'flanking', 'zone_enter', 'zone_exit', 'kill_bonus',
    'robot_eliminated', 'passive_warning', 'passive_penalty', 'last_standing', 'match_end',
    'zone_defined', 'zone_moving', 'zone_active',
  ]);

  // Track last emitted time for sampled event types
  const lastEmittedTime: Record<string, number> = {};

  return events.filter(event => {
    // Always keep combat-relevant events
    if (alwaysKeep.has(event.type)) {
      return true;
    }

    // Sample score_tick events (every sampleInterval seconds)
    if (event.type === 'score_tick') {
      const lastTime = lastEmittedTime['score_tick'] ?? -sampleInterval;
      if (event.timestamp - lastTime >= sampleInterval) {
        lastEmittedTime['score_tick'] = event.timestamp;
        return true;
      }
      return false;
    }

    // Sample movement events (every 2 seconds)
    if (event.type === 'movement') {
      const key = `movement_${event.attacker}`;
      const lastTime = lastEmittedTime[key] ?? -2;
      if (event.timestamp - lastTime >= 2) {
        lastEmittedTime[key] = event.timestamp;
        return true;
      }
      return false;
    }

    // Sample range_transition events (every 3 seconds per robot pair)
    if (event.type === 'range_transition') {
      const key = `range_${event.attacker}_${event.defender}`;
      const lastTime = lastEmittedTime[key] ?? -3;
      if (event.timestamp - lastTime >= 3) {
        lastEmittedTime[key] = event.timestamp;
        return true;
      }
      return false;
    }

    // Sample shield_regen events (every 5 seconds per robot)
    if (event.type === 'shield_regen') {
      const key = `shield_${event.attacker}`;
      const lastTime = lastEmittedTime[key] ?? -5;
      if (event.timestamp - lastTime >= 5) {
        lastEmittedTime[key] = event.timestamp;
        return true;
      }
      return false;
    }

    // Filter out out_of_range events entirely (noise)
    if (event.type === 'out_of_range' || event.type === 'counter_out_of_range') {
      return false;
    }

    // Keep any other event types
    return true;
  });
}
