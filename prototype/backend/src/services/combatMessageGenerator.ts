/**
 * Combat Message Generator
 * Generates human-readable text descriptions for battle events
 */

export interface BattleStartEvent {
  robot1Name: string;
  robot2Name: string;
  robot1ELO: number;
  robot2ELO: number;
  leagueType: string;
}

export interface AttackEvent {
  attackerName: string;
  defenderName: string;
  weaponName: string;
  damage: number;
  hit: boolean;
  critical: boolean;
}

export interface BattleEndEvent {
  winnerName: string;
  loserName: string;
  winnerHP: number;
  winnerMaxHP: number;
  reason: 'destruction' | 'yield' | 'time';
}

export interface ELOChangeEvent {
  robotName: string;
  oldELO: number;
  newELO: number;
  change: number;
}

/**
 * Combat Message Generator Service
 */
export class CombatMessageGenerator {
  // Battle Start Messages
  private static battleStartMessages = [
    '⚔️ Battle commences! {robot1Name} (ELO {robot1ELO}) vs {robot2Name} (ELO {robot2ELO})',
    '🎯 {robot1Name} and {robot2Name} enter the arena for {leagueType} league combat!',
    '💥 Arena match starting: {robot1Name} vs {robot2Name}',
  ];

  // Attack Hit Messages
  private static hitMessages = [
    '💥 {attackerName} strikes {defenderName} with {weaponName} for {damage} damage!',
    '⚡ {attackerName}\'s {weaponName} connects, dealing {damage} damage to {defenderName}!',
    '🔪 {attackerName} slashes {defenderName} with {weaponName} for {damage} damage!',
    '🎯 {attackerName} lands a solid hit with {weaponName} - {damage} damage to {defenderName}!',
    '💢 {attackerName}\'s {weaponName} finds its mark, dealing {damage} damage!',
  ];

  // Critical Hit Messages
  private static criticalHitMessages = [
    '💢 CRITICAL HIT! {attackerName}\'s {weaponName} finds a weak point, dealing {damage} damage to {defenderName}!',
    '🎯 Perfect strike! {attackerName} lands a critical hit with {weaponName} for {damage} damage!',
    '💥 DEVASTATING! {attackerName}\'s critical strike with {weaponName} inflicts {damage} damage!',
    '⚡ CRITICAL! {attackerName} exploits a vulnerability in {defenderName}\'s defenses - {damage} damage!',
    '🔥 MASSIVE DAMAGE! {attackerName}\'s {weaponName} scores a critical hit for {damage} damage!',
  ];

  // Miss Messages
  private static missMessages = [
    '❌ {attackerName} swings {weaponName} but misses {defenderName} completely!',
    '⚠️ {attackerName}\'s {weaponName} attack goes wide - no damage!',
    '🎯 {attackerName} aims {weaponName} but the shot misses {defenderName}!',
    '💨 {defenderName} dodges {attackerName}\'s {weaponName} attack!',
    '🏃 {defenderName} evades {attackerName}\'s {weaponName} with quick reflexes!',
  ];

  // Victory Messages
  private static victoryMessages = [
    '🏆 VICTORY! {winnerName} defeats {loserName}!',
    '👑 {winnerName} emerges victorious over {loserName}!',
    '⚔️ {winnerName} wins the battle against {loserName}!',
    '🎉 {winnerName} triumphs over {loserName}!',
  ];

  // Dominant Victory Messages (>80% HP remaining)
  private static dominantVictoryMessages = [
    '🏆 DOMINANT VICTORY! {winnerName} crushes {loserName} with {hpPercent}% HP remaining!',
    '👑 FLAWLESS! {winnerName} defeats {loserName} while taking minimal damage!',
    '⚔️ OVERWHELMING! {winnerName} destroys {loserName} at {hpPercent}% health!',
    '💪 SUPERIOR! {winnerName} dominates {loserName} completely!',
  ];

  // Close Victory Messages (<30% HP remaining)
  private static closeVictoryMessages = [
    '🏆 NARROW VICTORY! {winnerName} defeats {loserName} by the slimmest margin!',
    '⚔️ Hard-fought victory! {winnerName} wins with only {hp} HP remaining!',
    '💪 {winnerName} barely survives to claim victory over {loserName}!',
    '🎯 {winnerName} edges out {loserName} in a close battle!',
  ];

  // ELO Change Messages
  private static eloGainMessages = [
    '📈 {robotName}: {oldELO} → {newELO} (+{change} ELO)',
    '⬆️ {robotName} gains {change} ELO rating ({oldELO} → {newELO})',
    '📊 {robotName}\'s rating increases by {change} ELO points',
  ];

  private static eloLossMessages = [
    '📉 {robotName}: {oldELO} → {newELO} ({change} ELO)',
    '⬇️ {robotName} loses {change} ELO rating ({oldELO} → {newELO})',
    '📊 {robotName}\'s rating decreases by {change} ELO points',
  ];

  /**
   * Replace placeholders in message template
   */
  private static interpolate(template: string, values: Record<string, any>): string {
    return template.replace(/{(\w+)}/g, (match, key) => {
      return values[key] !== undefined ? String(values[key]) : match;
    });
  }

  /**
   * Select random message from array
   */
  private static selectRandom<T>(messages: T[]): T {
    return messages[Math.floor(Math.random() * messages.length)];
  }

  /**
   * Generate battle start message
   */
  static generateBattleStart(event: BattleStartEvent): string {
    const template = this.selectRandom(this.battleStartMessages);
    return this.interpolate(template, event);
  }

  /**
   * Generate attack message
   */
  static generateAttack(event: AttackEvent): string {
    let template: string;

    if (!event.hit) {
      template = this.selectRandom(this.missMessages);
    } else if (event.critical) {
      template = this.selectRandom(this.criticalHitMessages);
    } else {
      template = this.selectRandom(this.hitMessages);
    }

    return this.interpolate(template, event);
  }

  /**
   * Generate battle end message
   */
  static generateBattleEnd(event: BattleEndEvent): string {
    const hpPercent = Math.round((event.winnerHP / event.winnerMaxHP) * 100);
    
    let template: string;
    if (hpPercent > 80) {
      template = this.selectRandom(this.dominantVictoryMessages);
    } else if (hpPercent < 30) {
      template = this.selectRandom(this.closeVictoryMessages);
    } else {
      template = this.selectRandom(this.victoryMessages);
    }

    return this.interpolate(template, {
      ...event,
      hpPercent,
      hp: event.winnerHP,
    });
  }

  /**
   * Generate ELO change message
   */
  static generateELOChange(event: ELOChangeEvent): string {
    const template = event.change > 0
      ? this.selectRandom(this.eloGainMessages)
      : this.selectRandom(this.eloLossMessages);

    return this.interpolate(template, {
      ...event,
      change: Math.abs(event.change),
    });
  }

  /**
   * Generate complete battle log
   */
  static generateBattleLog(battleData: {
    robot1Name: string;
    robot2Name: string;
    robot1ELOBefore: number;
    robot2ELOBefore: number;
    robot1ELOAfter: number;
    robot2ELOAfter: number;
    winnerName: string;
    loserName: string;
    winnerFinalHP: number;
    winnerMaxHP: number;
    loserFinalHP: number;
    robot1DamageDealt: number;
    robot2DamageDealt: number;
    leagueType: string;
    durationSeconds: number;
  }): any[] {
    const log: any[] = [];

    // Battle start
    log.push({
      timestamp: 0.0,
      type: 'battle_start',
      message: this.generateBattleStart({
        robot1Name: battleData.robot1Name,
        robot2Name: battleData.robot2Name,
        robot1ELO: battleData.robot1ELOBefore,
        robot2ELO: battleData.robot2ELOBefore,
        leagueType: battleData.leagueType,
      }),
    });

    // Simulate some combat events based on damage dealt
    const robot1Attacks = Math.ceil(battleData.robot1DamageDealt / 15);
    const robot2Attacks = Math.ceil(battleData.robot2DamageDealt / 15);
    const totalAttacks = robot1Attacks + robot2Attacks;
    
    // Generate attack events
    for (let i = 0; i < Math.min(totalAttacks, 10); i++) {
      const timestamp = (i + 1) * (battleData.durationSeconds / (totalAttacks + 1));
      const isRobot1 = i % 2 === 0;
      const attackerName = isRobot1 ? battleData.robot1Name : battleData.robot2Name;
      const defenderName = isRobot1 ? battleData.robot2Name : battleData.robot1Name;
      const damage = Math.floor(Math.random() * 20) + 10;
      const isCritical = Math.random() < 0.15;
      const hits = Math.random() < 0.85;

      log.push({
        timestamp: Number(timestamp.toFixed(1)),
        type: hits ? 'attack' : 'miss',
        attacker: isRobot1 ? 'robot1' : 'robot2',
        defender: isRobot1 ? 'robot2' : 'robot1',
        message: this.generateAttack({
          attackerName,
          defenderName,
          weaponName: 'Practice Sword',
          damage: hits ? damage : 0,
          hit: hits,
          critical: hits && isCritical,
        }),
      });
    }

    // Battle end
    log.push({
      timestamp: battleData.durationSeconds,
      type: 'battle_end',
      winner: battleData.winnerName === battleData.robot1Name ? 'robot1' : 'robot2',
      loser: battleData.loserName === battleData.robot1Name ? 'robot1' : 'robot2',
      message: this.generateBattleEnd({
        winnerName: battleData.winnerName,
        loserName: battleData.loserName,
        winnerHP: battleData.winnerFinalHP,
        winnerMaxHP: battleData.winnerMaxHP,
        reason: 'destruction',
      }),
    });

    // ELO changes
    const robot1ELOChange = battleData.robot1ELOAfter - battleData.robot1ELOBefore;
    const robot2ELOChange = battleData.robot2ELOAfter - battleData.robot2ELOBefore;

    log.push({
      timestamp: battleData.durationSeconds,
      type: 'elo_change',
      robot: 'robot1',
      message: this.generateELOChange({
        robotName: battleData.robot1Name,
        oldELO: battleData.robot1ELOBefore,
        newELO: battleData.robot1ELOAfter,
        change: robot1ELOChange,
      }),
    });

    log.push({
      timestamp: battleData.durationSeconds,
      type: 'elo_change',
      robot: 'robot2',
      message: this.generateELOChange({
        robotName: battleData.robot2Name,
        oldELO: battleData.robot2ELOBefore,
        newELO: battleData.robot2ELOAfter,
        change: robot2ELOChange,
      }),
    });

    return log;
  }
}
