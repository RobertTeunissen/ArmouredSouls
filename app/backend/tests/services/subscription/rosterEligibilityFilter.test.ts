/**
 * Unit tests for rosterEligibilityFilter.ts
 *
 * Tests that the roster eligibility filter correctly gates event subscription
 * based on the stable's robot count.
 *
 * _Requirements: R3.9_
 */

import {
  registerSubscribableEvent,
  _clearRegistryForTesting,
} from '../../../src/services/subscription/eventRegistry';
import { getEligibleEvents } from '../../../src/services/subscription/rosterEligibilityFilter';

// ── Setup ────────────────────────────────────────────────────────────

beforeEach(() => {
  _clearRegistryForTesting();

  // Register all events so the filter has something to work with
  registerSubscribableEvent({ type: 'league_1v1', label: '1v1 League', lockingPredicate: async () => false });
  registerSubscribableEvent({ type: 'tournament_1v1', label: '1v1 Tournament', lockingPredicate: async () => false });
  registerSubscribableEvent({ type: 'koth', label: 'King of the Hill', lockingPredicate: async () => false });
  registerSubscribableEvent({ type: 'tag_team', label: 'Tag Team', lockingPredicate: async () => false });
  registerSubscribableEvent({ type: 'league_2v2', label: '2v2 League', lockingPredicate: async () => false });
  registerSubscribableEvent({ type: 'league_3v3', label: '3v3 League', lockingPredicate: async () => false });
});

// ── Tests ────────────────────────────────────────────────────────────

describe('rosterEligibilityFilter', () => {
  describe('getEligibleEvents', () => {
    it('should mark league_2v2 as ineligible when stable has < 2 robots', () => {
      const events = getEligibleEvents(1);
      const league2v2 = events.find((e) => e.type === 'league_2v2');

      expect(league2v2).toBeDefined();
      expect(league2v2!.eligible).toBe(false);
      expect(league2v2!.reason).toContain('2v2 League requires 2');
    });

    it('should mark league_2v2 as eligible when stable has >= 2 robots', () => {
      const events = getEligibleEvents(2);
      const league2v2 = events.find((e) => e.type === 'league_2v2');

      expect(league2v2).toBeDefined();
      expect(league2v2!.eligible).toBe(true);
      expect(league2v2!.reason).toBeUndefined();
    });

    it('should mark league_3v3 as ineligible when stable has < 3 robots', () => {
      const events = getEligibleEvents(2);
      const league3v3 = events.find((e) => e.type === 'league_3v3');

      expect(league3v3).toBeDefined();
      expect(league3v3!.eligible).toBe(false);
      expect(league3v3!.reason).toContain('3v3 League requires 3');
    });

    it('should mark league_3v3 as eligible when stable has >= 3 robots', () => {
      const events = getEligibleEvents(3);
      const league3v3 = events.find((e) => e.type === 'league_3v3');

      expect(league3v3).toBeDefined();
      expect(league3v3!.eligible).toBe(true);
      expect(league3v3!.reason).toBeUndefined();
    });

    it('should mark league_1v1, tournament_1v1, and koth as always eligible', () => {
      const events = getEligibleEvents(1);

      const league1v1 = events.find((e) => e.type === 'league_1v1');
      const tournament = events.find((e) => e.type === 'tournament_1v1');
      const koth = events.find((e) => e.type === 'koth');

      expect(league1v1!.eligible).toBe(true);
      expect(tournament!.eligible).toBe(true);
      expect(koth!.eligible).toBe(true);
    });

    it('should mark tag_team as ineligible when stable has < 2 robots', () => {
      const events = getEligibleEvents(1);
      const tagTeam = events.find((e) => e.type === 'tag_team');

      expect(tagTeam).toBeDefined();
      expect(tagTeam!.eligible).toBe(false);
    });

    it('should mark all events as eligible when stable has >= 3 robots', () => {
      const events = getEligibleEvents(3);

      for (const event of events) {
        expect(event.eligible).toBe(true);
      }
    });
  });
});
