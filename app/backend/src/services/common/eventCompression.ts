/**
 * Event Compression Utilities
 * 
 * Reduces memory footprint of combat events by stripping debug-only data
 * before storage. The simulation runs identically - we just store less.
 * 
 * Memory savings per event:
 * - formulaBreakdown removal: ~500-2000 bytes per attack event
 * - Position snapshot optimization: ~100-200 bytes per event
 * - Redundant field removal: ~50-100 bytes per event
 */

import type { CombatEvent } from '../battle/combatSimulator';

/**
 * Fields that are only needed for admin debugging, not playback.
 * These can be stripped before storage to save memory/disk.
 */
const DEBUG_ONLY_FIELDS: (keyof CombatEvent)[] = [
  'formulaBreakdown',
  'rangePenalty',
  'attackAngle',
];

/**
 * Event types that don't need position snapshots for playback.
 * Movement and zone events need positions; attack events don't.
 */
const EVENTS_NEEDING_POSITIONS = new Set([
  'movement',
  'zone_defined',
  'zone_moving',
  'zone_active',
  'zone_enter',
  'zone_exit',
]);

/**
 * Strip debug-only fields from a combat event.
 * Returns a new object - does not mutate the original.
 */
function stripDebugFields(event: CombatEvent): CombatEvent {
  const stripped = { ...event };
  
  for (const field of DEBUG_ONLY_FIELDS) {
    delete (stripped as Record<string, unknown>)[field];
  }
  
  // Strip positions from events that don't need them for playback
  if (!EVENTS_NEEDING_POSITIONS.has(event.type) && stripped.positions) {
    delete stripped.positions;
    delete stripped.facingDirections;
  }
  
  return stripped;
}

/**
 * Compress an array of combat events for storage.
 * Strips debug fields and unnecessary position data.
 * 
 * @param events Full event array from simulation
 * @param keepDebugData If true, preserves formulaBreakdown for admin debugging
 * @returns Compressed event array
 */
export function compressEventsForStorage(
  events: CombatEvent[],
  keepDebugData: boolean = false,
): CombatEvent[] {
  if (keepDebugData) {
    return events;
  }
  
  return events.map(stripDebugFields);
}

/**
 * Estimate memory size of a combat event in bytes.
 * Useful for monitoring and debugging memory usage.
 */
export function estimateEventSize(event: CombatEvent): number {
  // Rough estimation based on JSON serialization
  return JSON.stringify(event).length * 2; // UTF-16 chars = 2 bytes each
}

/**
 * Estimate total memory for an event array.
 */
export function estimateEventsMemory(events: CombatEvent[]): number {
  return events.reduce((sum, e) => sum + estimateEventSize(e), 0);
}
