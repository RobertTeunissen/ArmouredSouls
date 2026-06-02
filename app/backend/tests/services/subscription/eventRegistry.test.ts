/**
 * Unit tests for eventRegistry.ts
 *
 * Tests the runtime singleton registry for subscribable battle events.
 * Covers registration, lookup, duplicate rejection, and predicate retrieval.
 *
 * _Requirements: R5.1, R5.2, R5.4_
 */

import {
  registerSubscribableEvent,
  getRegisteredEvents,
  getEventDefinition,
  isRegisteredEvent,
  getLockingPredicate,
  _clearRegistryForTesting,
} from '../../../src/services/subscription/eventRegistry';

describe('eventRegistry', () => {
  beforeEach(() => {
    _clearRegistryForTesting();
  });

  describe('registerSubscribableEvent', () => {
    it('should register a new event type successfully', () => {
      const predicate = jest.fn().mockResolvedValue(false);

      expect(() =>
        registerSubscribableEvent({
          type: 'league_1v1',
          label: '1v1 League',
          lockingPredicate: predicate,
        }),
      ).not.toThrow();
    });

    it('should throw on duplicate registration', () => {
      const predicate = jest.fn().mockResolvedValue(false);

      registerSubscribableEvent({
        type: 'league_1v1',
        label: '1v1 League',
        lockingPredicate: predicate,
      });

      expect(() =>
        registerSubscribableEvent({
          type: 'league_1v1',
          label: '1v1 League Duplicate',
          lockingPredicate: predicate,
        }),
      ).toThrow(/Duplicate registration/);
    });
  });

  describe('getRegisteredEvents', () => {
    it('should return all registered events', () => {
      const predicate = jest.fn().mockResolvedValue(false);

      registerSubscribableEvent({ type: 'league_1v1', label: '1v1 League', lockingPredicate: predicate });
      registerSubscribableEvent({ type: 'tournament_1v1', label: '1v1 Tournament', lockingPredicate: predicate });
      registerSubscribableEvent({ type: 'koth', label: 'King of the Hill', lockingPredicate: predicate });

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
      const predicate = jest.fn().mockResolvedValue(true);

      registerSubscribableEvent({
        type: 'tournament_1v1',
        label: '1v1 Tournament',
        lockingPredicate: predicate,
      });

      const def = getEventDefinition('tournament_1v1');

      expect(def).toBeDefined();
      expect(def!.type).toBe('tournament_1v1');
      expect(def!.label).toBe('1v1 Tournament');
      expect(def!.lockingPredicate).toBe(predicate);
    });

    it('should return undefined for unregistered event', () => {
      expect(getEventDefinition('nonexistent')).toBeUndefined();
    });
  });

  describe('isRegisteredEvent', () => {
    it('should return true for registered event', () => {
      const predicate = jest.fn().mockResolvedValue(false);
      registerSubscribableEvent({ type: 'koth', label: 'KotH', lockingPredicate: predicate });

      expect(isRegisteredEvent('koth')).toBe(true);
    });

    it('should return false for unregistered event', () => {
      expect(isRegisteredEvent('nonexistent')).toBe(false);
    });
  });

  describe('getLockingPredicate', () => {
    it('should return the predicate function for a registered event', () => {
      const predicate = jest.fn().mockResolvedValue(true);
      registerSubscribableEvent({ type: 'tag_team', label: 'Tag Team', lockingPredicate: predicate });

      const result = getLockingPredicate('tag_team');

      expect(result).toBe(predicate);
    });

    it('should throw for unregistered event type', () => {
      expect(() => getLockingPredicate('nonexistent' as any)).toThrow(/Unknown event type/);
    });
  });
});
