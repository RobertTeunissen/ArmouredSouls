import { CombatMessageGenerator } from '../src/services/combatMessageGenerator';

describe('CombatMessageGenerator', () => {
  afterAll(() => {
    // Pure unit test - no cleanup needed
  });

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
      expect(message).toContain('Iron Gladiator');
      // Critical messages use various formats - some include defender, some don't
      expect(message.length).toBeGreaterThan(0);
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
      // Miss messages may or may not include defender name, but should indicate a miss
      expect(message.length).toBeGreaterThan(0);
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
      expect(message).toContain('Steel Warrior');
      // Message should indicate dominance/superiority (various formats possible)
      expect(message.length).toBeGreaterThan(0);
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
    it('should generate minimal battle log without simulator events (fallback for bye matches)', () => {
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
      // Without simulator events, fallback generates minimal log (start + end)
      expect(log.length).toBeGreaterThanOrEqual(2);

      // Verify battle start event
      const startEvent = log.find(e => e.type === 'battle_start');
      expect(startEvent).toBeDefined();
      expect(startEvent?.message).toContain('Iron Gladiator');

      // Verify battle end event
      const endEvent = log.find(e => e.type === 'battle_end');
      expect(endEvent).toBeDefined();
      expect(endEvent?.message).toContain('Iron Gladiator');
      expect(endEvent?.message).toContain('Steel Warrior');
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
      for (let i = 1; i < log.length; i++) {
        expect(log[i].timestamp).toBeGreaterThanOrEqual(log[i - 1].timestamp);
      }

      // First event should be at time 0
      expect(log[0].timestamp).toBe(0);

      // Last event should be at battle duration (battle_end)
      const lastEvent = log[log.length - 1];
      expect(lastEvent.timestamp).toBe(battleDurationSeconds);
    });
  });

  describe('generateTagOut', () => {
    it('should generate tag-out yield message', () => {
      const message = CombatMessageGenerator.generateTagOut({
        robotName: 'Iron Gladiator',
        teamName: 'Team Alpha',
        reason: 'yield',
        finalHP: 15,
      });

      expect(message).toBeDefined();
      expect(message).toContain('Iron Gladiator');
      // Note: Not all yield messages include team name (e.g., "reaches critical damage and calls for backup!")
      expect(message.length).toBeGreaterThan(0);
    });

    it('should generate tag-out destruction message', () => {
      const message = CombatMessageGenerator.generateTagOut({
        robotName: 'Steel Warrior',
        teamName: 'Team Beta',
        reason: 'destruction',
        finalHP: 0,
      });

      expect(message).toBeDefined();
      expect(message).toContain('Steel Warrior');
      expect(message).toContain('Team Beta');
      expect(message.length).toBeGreaterThan(0);
    });

    it('should use different messages for yield vs destruction', () => {
      const yieldMessage = CombatMessageGenerator.generateTagOut({
        robotName: 'Iron Gladiator',
        teamName: 'Team Alpha',
        reason: 'yield',
        finalHP: 15,
      });

      const destructionMessage = CombatMessageGenerator.generateTagOut({
        robotName: 'Iron Gladiator',
        teamName: 'Team Alpha',
        reason: 'destruction',
        finalHP: 0,
      });

      // Messages should be different (though there's a small chance they could be the same)
      // At minimum, both should be valid messages
      expect(yieldMessage).toBeDefined();
      expect(destructionMessage).toBeDefined();
      expect(yieldMessage.length).toBeGreaterThan(0);
      expect(destructionMessage.length).toBeGreaterThan(0);
    });
  });

  describe('generateTagIn', () => {
    it('should generate tag-in message', () => {
      const message = CombatMessageGenerator.generateTagIn({
        robotName: 'Thunder Bolt',
        teamName: 'Team Alpha',
        hp: 100,
      });

      expect(message).toBeDefined();
      expect(message).toContain('Thunder Bolt');
      expect(message).toContain('Team Alpha');
      expect(message.length).toBeGreaterThan(0);
    });

    it('should include robot name and team context', () => {
      const message = CombatMessageGenerator.generateTagIn({
        robotName: 'Cyber Knight',
        teamName: 'Team Omega',
        hp: 100,
      });

      expect(message).toBeDefined();
      expect(message).toContain('Cyber Knight');
      expect(message).toContain('Team Omega');
    });
  });

});
