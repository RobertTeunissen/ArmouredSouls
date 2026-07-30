/**
 * Unit tests for eventRegistry.ts
 *
 * Tests the runtime singleton registry for subscribable battle events.
 * Covers registration, lookup and duplicate rejection.
 *
 * A registration is an identifier plus a display label — nothing more. The
 * per-event `lockingPredicate` hook was removed when all nine events adopted one
 * shared subscription rule, so there is no behaviour left to register.
 *
 * _Requirements: R5.1, R5.2, R5.4_
 */

import {
  registerSubscribableEvent,
  getRegisteredEvents,
  getEventDefinition,
  isRegisteredEvent,
  SUBSCRIBABLE_EVENT_TYPES,
  _clearRegistryForTesting,
} from '../../../src/services/subscription/eventRegistry';

describe('eventRegistry', () => {
  beforeEach(() => {
    _clearRegistryForTesting();
  });

  describe('registerSubscribableEvent', () => {
    it('should register a new event type successfully', () => {
      expect(() =>
        registerSubscribableEvent({ type: 'league_1v1', label: '1v1 League' }),
      ).not.toThrow();
    });

    it('should throw on duplicate registration', () => {
      registerSubscribableEvent({ type: 'league_1v1', label: '1v1 League' });

      expect(() =>
        registerSubscribableEvent({ type: 'league_1v1', label: '1v1 League Duplicate' }),
      ).toThrow(/Duplicate registration/);
    });
  });

  describe('getRegisteredEvents', () => {
    it('should return all registered events', () => {
      registerSubscribableEvent({ type: 'league_1v1', label: '1v1 League' });
      registerSubscribableEvent({ type: 'tournament_1v1', label: '1v1 Tournament' });
      registerSubscribableEvent({ type: 'koth', label: 'King of the Hill' });

      const events = getRegisteredEvents();

      expect(events).toHaveLength(3);
      expect(events.map((e) => e.type)).toEqual(
        expect.arrayContaining(['league_1v1', 'tournament_1v1', 'koth']),
      );
    });

    it('should return empty array when no events registered', () => {
      expect(getRegisteredEvents()).toHaveLength(0);
    });
  });

  describe('getEventDefinition', () => {
    it('should return correct definition for registered event', () => {
      registerSubscribableEvent({ type: 'tournament_1v1', label: '1v1 Tournament' });

      const def = getEventDefinition('tournament_1v1');

      expect(def).toBeDefined();
      expect(def!.type).toBe('tournament_1v1');
      expect(def!.label).toBe('1v1 Tournament');
    });

    it('should return undefined for unregistered event', () => {
      expect(getEventDefinition('nonexistent')).toBeUndefined();
    });
  });

  describe('isRegisteredEvent', () => {
    it('should return true for registered event', () => {
      registerSubscribableEvent({ type: 'koth', label: 'KotH' });

      expect(isRegisteredEvent('koth')).toBe(true);
    });

    it('should return false for unregistered event', () => {
      expect(isRegisteredEvent('nonexistent')).toBe(false);
    });
  });

  describe('SUBSCRIBABLE_EVENT_TYPES', () => {
    it('should be accepted in full by the registry', () => {
      // The tuple is the source of truth the Zod schemas validate against, so
      // every entry must be a type the registry will actually take.
      for (const type of SUBSCRIBABLE_EVENT_TYPES) {
        expect(() => registerSubscribableEvent({ type, label: type })).not.toThrow();
      }

      expect(getRegisteredEvents()).toHaveLength(SUBSCRIBABLE_EVENT_TYPES.length);
    });

    it('should contain no duplicates', () => {
      expect(new Set(SUBSCRIBABLE_EVENT_TYPES).size).toBe(SUBSCRIBABLE_EVENT_TYPES.length);
    });
  });
});
