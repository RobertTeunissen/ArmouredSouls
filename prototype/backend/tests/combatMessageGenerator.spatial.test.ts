import { CombatMessageGenerator } from '../src/services/combatMessageGenerator';
import { CombatEvent } from '../src/services/combatSimulator';

/**
 * Spatial message generation tests for CombatMessageGenerator.
 * Validates Requirements 14.4 (spatial narrative messages) and 14.5 (graceful fallback).
 */

/** Minimal context object for convertSimulatorEvents */
const defaultContext = {
  robot1Name: 'IronBot',
  robot2Name: 'SteelCrusher',
  robot1Stance: 'offensive',
  robot2Stance: 'defensive',
  robot1MaxHP: 100,
  robot2MaxHP: 100,
  robot1ELO: 1200,
  robot2ELO: 1250,
  leagueType: 'bronze',
};

/** Helper to create a minimal CombatEvent with required fields */
function makeEvent(overrides: Partial<CombatEvent>): CombatEvent {
  return {
    timestamp: 1.0,
    type: 'attack',
    message: '',
    robot1HP: 80,
    robot2HP: 90,
    robot1Shield: 10,
    robot2Shield: 10,
    ...overrides,
  } as CombatEvent;
}

describe('CombatMessageGenerator — Spatial Messages', () => {

  // ── 1. Spatial messages via convertSimulatorEvents ──────────────────

  describe('convertSimulatorEvents with spatial events', () => {
    const spatialTypes = [
      { type: 'movement' as const, attacker: 'IronBot', defender: 'SteelCrusher', distance: 5 },
      { type: 'range_transition' as const, attacker: 'IronBot', defender: 'SteelCrusher', rangeBand: 'short' as const },
      { type: 'out_of_range' as const, attacker: 'IronBot', defender: 'SteelCrusher', weapon: 'Power Fist', distance: 12 },
      { type: 'counter_out_of_range' as const, attacker: 'IronBot', defender: 'SteelCrusher', weapon: 'Power Fist' },
      { type: 'backstab' as const, attacker: 'IronBot', defender: 'SteelCrusher' },
      { type: 'flanking' as const, attacker: 'IronBot', defender: 'SteelCrusher' },
    ];

    it.each(spatialTypes)(
      'should produce a narrative event for $type',
      (eventData) => {
        const events = [makeEvent(eventData)];
        const result = CombatMessageGenerator.convertSimulatorEvents(events, defaultContext);

        // First events are battle_start + stances, then the spatial event
        const spatialNarrative = result.find((e: { type: string }) => e.type === eventData.type);
        expect(spatialNarrative).toBeDefined();
        expect(spatialNarrative.message).toBeTruthy();
        expect(spatialNarrative.message.length).toBeGreaterThan(0);
      },
    );
  });

  // ── 2. Fallback to non-spatial messages when no position data ──────

  describe('convertSimulatorEvents fallback (no spatial data)', () => {
    it('should produce correct narrative for a standard attack event', () => {
      const events = [
        makeEvent({
          type: 'attack',
          attacker: 'IronBot',
          defender: 'SteelCrusher',
          weapon: 'Laser Rifle',
          damage: 20,
          hit: true,
          critical: false,
          hpDamage: 15,
          shieldDamage: 5,
        }),
      ];
      const result = CombatMessageGenerator.convertSimulatorEvents(events, defaultContext);
      const attackNarrative = result.find((e: { type: string }) => e.type === 'attack');
      expect(attackNarrative).toBeDefined();
      expect(attackNarrative.message.length).toBeGreaterThan(0);
    });

    it('should produce correct narrative for a miss event', () => {
      const events = [
        makeEvent({
          type: 'miss',
          attacker: 'IronBot',
          defender: 'SteelCrusher',
          weapon: 'Laser Rifle',
          hit: false,
        }),
      ];
      const result = CombatMessageGenerator.convertSimulatorEvents(events, defaultContext);
      const missNarrative = result.find((e: { type: string }) => e.type === 'miss');
      expect(missNarrative).toBeDefined();
      expect(missNarrative.message.length).toBeGreaterThan(0);
    });

    it('should produce correct narrative for a critical hit event', () => {
      const events = [
        makeEvent({
          timestamp: 2.0,
          type: 'critical',
          attacker: 'SteelCrusher',
          defender: 'IronBot',
          weapon: 'Plasma Cannon',
          damage: 40,
          hit: true,
          critical: true,
          hpDamage: 40,
        }),
      ];
      const result = CombatMessageGenerator.convertSimulatorEvents(events, defaultContext);
      const critNarrative = result.find((e: { type: string }) => e.type === 'critical');
      expect(critNarrative).toBeDefined();
      expect(critNarrative.message.length).toBeGreaterThan(0);
    });
  });

  // ── 3. Backstab and flanking message templates ─────────────────────

  describe('generateBackstab and generateFlanking', () => {
    it('should return a non-empty string containing both robot names for backstab', () => {
      const msg = CombatMessageGenerator.generateBackstab('IronBot', 'SteelCrusher');
      expect(msg.length).toBeGreaterThan(0);
      expect(msg).toContain('IronBot');
      expect(msg).toContain('SteelCrusher');
    });

    it('should return a non-empty string containing both robot names for flanking', () => {
      const msg = CombatMessageGenerator.generateFlanking('IronBot', 'SteelCrusher');
      expect(msg.length).toBeGreaterThan(0);
      expect(msg).toContain('IronBot');
      expect(msg).toContain('SteelCrusher');
    });
  });

  // ── 4. Individual spatial generator methods ────────────────────────

  describe('individual spatial generators', () => {
    it('should generate movement message containing robotName', () => {
      const msg = CombatMessageGenerator.generateMovement('IronBot', 'SteelCrusher', 8);
      expect(msg.length).toBeGreaterThan(0);
      expect(msg).toContain('IronBot');
    });

    it('should generate range transition message containing rangeBand', () => {
      const msg = CombatMessageGenerator.generateRangeTransition('IronBot', 'SteelCrusher', 'melee');
      expect(msg.length).toBeGreaterThan(0);
      expect(msg).toContain('melee');
    });

    it('should generate out-of-range message containing weaponName', () => {
      const msg = CombatMessageGenerator.generateOutOfRange('IronBot', 'Power Fist', 'SteelCrusher', 15);
      expect(msg.length).toBeGreaterThan(0);
      expect(msg).toContain('Power Fist');
    });

    it('should generate counter-out-of-range message containing weaponName', () => {
      const msg = CombatMessageGenerator.generateCounterOutOfRange('IronBot', 'Power Fist', 'SteelCrusher');
      expect(msg.length).toBeGreaterThan(0);
      expect(msg).toContain('Power Fist');
    });

    it('should generate backstab message containing both names', () => {
      const msg = CombatMessageGenerator.generateBackstab('IronBot', 'SteelCrusher');
      expect(msg.length).toBeGreaterThan(0);
      expect(msg).toContain('IronBot');
      expect(msg).toContain('SteelCrusher');
    });

    it('should generate flanking message containing both names', () => {
      const msg = CombatMessageGenerator.generateFlanking('IronBot', 'SteelCrusher');
      expect(msg.length).toBeGreaterThan(0);
      expect(msg).toContain('IronBot');
      expect(msg).toContain('SteelCrusher');
    });
  });
});
