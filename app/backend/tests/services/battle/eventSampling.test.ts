/**
 * Unit tests for eventSampling — combat event density reduction.
 *
 * Validates: battle log storage efficiency without losing combat-relevant data.
 */

import { sampleEventsForStorage } from '../../../src/services/battle/combat-messages/eventSampling';

function makeEvent(type: string, timestamp: number, attacker?: string, defender?: string) {
  return { type, timestamp, attacker, defender } as any;
}

describe('sampleEventsForStorage', () => {
  describe('always-keep events', () => {
    it('should keep all combat-relevant events regardless of density', () => {
      const events = [
        makeEvent('attack', 0),
        makeEvent('attack', 0.1),
        makeEvent('critical', 0.2),
        makeEvent('miss', 0.3),
        makeEvent('counter', 0.4),
        makeEvent('shield_break', 0.5),
        makeEvent('yield', 0.6),
        makeEvent('destroyed', 0.7),
      ];

      const sampled = sampleEventsForStorage(events);
      expect(sampled).toHaveLength(events.length);
    });

    it('should keep KotH-specific combat events', () => {
      const events = [
        makeEvent('zone_defined', 0),
        makeEvent('zone_enter', 1),
        makeEvent('zone_exit', 2),
        makeEvent('kill_bonus', 3),
        makeEvent('robot_eliminated', 4),
        makeEvent('last_standing', 5),
        makeEvent('match_end', 6),
      ];

      const sampled = sampleEventsForStorage(events);
      expect(sampled).toHaveLength(events.length);
    });
  });

  describe('movement sampling', () => {
    it('should sample movement events every 2 seconds per robot', () => {
      const events = [
        makeEvent('movement', 0, 'Robot1'),
        makeEvent('movement', 0.5, 'Robot1'),
        makeEvent('movement', 1.0, 'Robot1'),
        makeEvent('movement', 1.5, 'Robot1'),
        makeEvent('movement', 2.0, 'Robot1'),
        makeEvent('movement', 2.5, 'Robot1'),
      ];

      const sampled = sampleEventsForStorage(events);
      // Should keep t=0 and t=2 (every 2 seconds)
      expect(sampled).toHaveLength(2);
      expect(sampled[0].timestamp).toBe(0);
      expect(sampled[1].timestamp).toBe(2.0);
    });

    it('should sample independently per robot', () => {
      const events = [
        makeEvent('movement', 0, 'Robot1'),
        makeEvent('movement', 0, 'Robot2'),
        makeEvent('movement', 1.0, 'Robot1'),
        makeEvent('movement', 1.0, 'Robot2'),
      ];

      const sampled = sampleEventsForStorage(events);
      // Each robot gets t=0 (first appearance)
      expect(sampled).toHaveLength(2);
    });
  });

  describe('score_tick sampling', () => {
    it('should sample score_tick events at the configured interval', () => {
      const events = [
        makeEvent('score_tick', 0),
        makeEvent('score_tick', 1),
        makeEvent('score_tick', 2),
        makeEvent('score_tick', 3),
        makeEvent('score_tick', 4),
        makeEvent('score_tick', 5),
        makeEvent('score_tick', 6),
        makeEvent('score_tick', 7),
        makeEvent('score_tick', 8),
        makeEvent('score_tick', 9),
        makeEvent('score_tick', 10),
      ];

      const sampled = sampleEventsForStorage(events, 5);
      // Should keep t=0, t=5, t=10
      expect(sampled).toHaveLength(3);
    });
  });

  describe('filtered events', () => {
    it('should completely remove out_of_range events', () => {
      const events = [
        makeEvent('out_of_range', 0),
        makeEvent('out_of_range', 1),
        makeEvent('counter_out_of_range', 2),
      ];

      const sampled = sampleEventsForStorage(events);
      expect(sampled).toHaveLength(0);
    });
  });

  describe('range_transition sampling', () => {
    it('should sample range_transition every 3 seconds per robot pair', () => {
      const events = [
        makeEvent('range_transition', 0, 'Robot1', 'Robot2'),
        makeEvent('range_transition', 1, 'Robot1', 'Robot2'),
        makeEvent('range_transition', 2, 'Robot1', 'Robot2'),
        makeEvent('range_transition', 3, 'Robot1', 'Robot2'),
        makeEvent('range_transition', 4, 'Robot1', 'Robot2'),
      ];

      const sampled = sampleEventsForStorage(events);
      // Should keep t=0, t=3
      expect(sampled).toHaveLength(2);
    });
  });

  describe('shield_regen sampling', () => {
    it('should sample shield_regen every 5 seconds per robot', () => {
      const events = [
        makeEvent('shield_regen', 0, 'Robot1'),
        makeEvent('shield_regen', 2, 'Robot1'),
        makeEvent('shield_regen', 4, 'Robot1'),
        makeEvent('shield_regen', 5, 'Robot1'),
        makeEvent('shield_regen', 9, 'Robot1'),
        makeEvent('shield_regen', 10, 'Robot1'),
      ];

      const sampled = sampleEventsForStorage(events);
      // Should keep t=0, t=5, t=10
      expect(sampled).toHaveLength(3);
    });
  });

  describe('mixed events', () => {
    it('should keep combat events interspersed with sampled events', () => {
      const events = [
        makeEvent('movement', 0, 'Robot1'),
        makeEvent('attack', 0.5),
        makeEvent('movement', 0.6, 'Robot1'),
        makeEvent('critical', 1.0),
        makeEvent('movement', 1.5, 'Robot1'),
        makeEvent('destroyed', 2.0),
      ];

      const sampled = sampleEventsForStorage(events);
      // movement: t=0, t=2.0 (skips 0.6, 1.5)... but destroyed is at t=2 so movement at 2.0 is within < 2s of movement at 0
      // Actually: movement at t=0 is kept. Next movement at t=0.6 is < 2s, skip. t=1.5 < 2s, skip.
      // No movement ≥ t=2 exists, so only 1 movement kept
      // Combat events: attack, critical, destroyed all kept
      expect(sampled.filter(e => e.type === 'attack' || e.type === 'critical' || e.type === 'destroyed')).toHaveLength(3);
      expect(sampled.filter(e => e.type === 'movement')).toHaveLength(1);
    });
  });
});
