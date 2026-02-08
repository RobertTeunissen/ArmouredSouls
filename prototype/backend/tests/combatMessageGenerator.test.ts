import { CombatMessageGenerator } from '../src/services/combatMessageGenerator';

describe('CombatMessageGenerator', () => {
  describe('generateBattleStart', () => {
    it('should generate battle start message', () => {
      const message = CombatMessageGenerator.generateBattleStart({
        robot1Name: 'Iron Gladiator',
        robot2Name: 'Steel Warrior',
        robot1ELO: 1200,
        robot2ELO: 1250,
        leagueType: 'bronze',
      });

      expect(message).toBeDefined();
      expect(message).toContain('Iron Gladiator');
      expect(message).toContain('Steel Warrior');
    });
  });

  describe('generateAttack', () => {
    it('should generate hit message', () => {
      const message = CombatMessageGenerator.generateAttack({
        attackerName: 'Iron Gladiator',
        defenderName: 'Steel Warrior',
        weaponName: 'Practice Sword',
        damage: 25,
        hit: true,
        critical: false,
      });

      expect(message).toBeDefined();
      expect(message).toContain('Iron Gladiator');
      expect(message).toContain('Steel Warrior');
      // Message uses descriptive text, not numeric damage
    });

    it('should generate critical hit message', () => {
      const message = CombatMessageGenerator.generateAttack({
        attackerName: 'Iron Gladiator',
        defenderName: 'Steel Warrior',
        weaponName: 'Practice Sword',
        damage: 40,
        hit: true,
        critical: true,
      });

      expect(message).toBeDefined();
      expect(message.toLowerCase()).toContain('critical');
      // Message uses descriptive text, not numeric damage
    });

    it('should generate miss message', () => {
      const message = CombatMessageGenerator.generateAttack({
        attackerName: 'Iron Gladiator',
        defenderName: 'Steel Warrior',
        weaponName: 'Practice Sword',
        damage: 0,
        hit: false,
        critical: false,
      });

      expect(message).toBeDefined();
      expect(message).toContain('Iron Gladiator');
      expect(message).toContain('Steel Warrior');
    });
  });

  describe('generateBattleEnd', () => {
    it('should generate dominant victory message', () => {
      const message = CombatMessageGenerator.generateBattleEnd({
        winnerName: 'Iron Gladiator',
        loserName: 'Steel Warrior',
        winnerHP: 9,
        winnerMaxHP: 10,
        reason: 'destruction',
      });

      expect(message).toBeDefined();
      expect(message).toContain('Iron Gladiator');
      expect(message.toLowerCase()).toContain('victory');
    });

    it('should generate close victory message', () => {
      const message = CombatMessageGenerator.generateBattleEnd({
        winnerName: 'Iron Gladiator',
        loserName: 'Steel Warrior',
        winnerHP: 2,
        winnerMaxHP: 10,
        reason: 'destruction',
      });

      expect(message).toBeDefined();
      expect(message).toContain('Iron Gladiator');
    });
  });

  describe('generateELOChange', () => {
    it('should generate ELO gain message', () => {
      const message = CombatMessageGenerator.generateELOChange({
        robotName: 'Iron Gladiator',
        oldELO: 1200,
        newELO: 1216,
        change: 16,
      });

      expect(message).toBeDefined();
      expect(message).toContain('Iron Gladiator');
      expect(message).toContain('16'); // Change value is always included
      // Old/new ELO may or may not be included depending on template
    });
    });

    it('should generate ELO loss message', () => {
      const message = CombatMessageGenerator.generateELOChange({
        robotName: 'Steel Warrior',
        oldELO: 1250,
        newELO: 1234,
        change: -16,
      });

      expect(message).toBeDefined();
      expect(message).toContain('Steel Warrior');
      expect(message).toContain('16'); // The absolute change value
      // Message may or may not include old/new ELO depending on template
    });
  });

  describe('generateBattleLog', () => {
    it('should generate complete battle log', () => {
      const log = CombatMessageGenerator.generateBattleLog({
        robot1Name: 'Iron Gladiator',
        robot2Name: 'Steel Warrior',
        robot1ELOBefore: 1200,
        robot2ELOBefore: 1200,
        robot1ELOAfter: 1216,
        robot2ELOAfter: 1184,
        winnerName: 'Iron Gladiator',
        loserName: 'Steel Warrior',
        winnerFinalHP: 9,
        winnerMaxHP: 10,
        loserFinalHP: 6,
        robot1DamageDealt: 40,
        robot2DamageDealt: 10,
        leagueType: 'bronze',
        durationSeconds: 35,
      });

      expect(log).toBeDefined();
      expect(Array.isArray(log)).toBe(true);
      expect(log.length).toBeGreaterThan(3); // Start, attacks, end, ELO changes

      // Verify battle start event
      const startEvent = log.find(e => e.type === 'battle_start');
      expect(startEvent).toBeDefined();
      expect(startEvent?.message).toContain('Iron Gladiator');

      // Verify battle end event
      const endEvent = log.find(e => e.type === 'battle_end');
      expect(endEvent).toBeDefined();
      expect(endEvent?.message).toContain('Iron Gladiator');
      expect(endEvent?.message).toContain('Steel Warrior');

      // ELO changes are no longer included in the battle log
      // They're shown in the battle summary instead
    });

    it('should include timestamps in correct order', () => {
      const battleDurationSeconds = 45;
      const log = CombatMessageGenerator.generateBattleLog({
        robot1Name: 'Iron Gladiator',
        robot2Name: 'Steel Warrior',
        robot1ELOBefore: 1200,
        robot2ELOBefore: 1200,
        robot1ELOAfter: 1216,
        robot2ELOAfter: 1184,
        winnerName: 'Iron Gladiator',
        loserName: 'Steel Warrior',
        winnerFinalHP: 9,
        winnerMaxHP: 10,
        loserFinalHP: 6,
        robot1DamageDealt: 40,
        robot2DamageDealt: 10,
        leagueType: 'bronze',
        durationSeconds: battleDurationSeconds,
      });

      // Verify timestamps are in ascending order
      for (let i = 1; i < log.length - 1; i++) {
        expect(log[i].timestamp).toBeGreaterThanOrEqual(log[i - 1].timestamp);
      }

      // First event should be at time 0
      expect(log[0].timestamp).toBe(0);

      // Last events should be at or near end of battle (within tolerance due to rounding)
      const lastEvents = log.slice(-3);
      lastEvents.forEach(event => {
        expect(event.timestamp).toBeGreaterThanOrEqual(battleDurationSeconds * 0.8); // At least 80% through
        expect(event.timestamp).toBeLessThanOrEqual(battleDurationSeconds);
      });
    });
  });
});
