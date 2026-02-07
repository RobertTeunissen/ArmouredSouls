/**
 * Combat Message Generator
 * Generates human-readable text descriptions for battle events
 * Enhanced version with damage descriptors and expanded message variations
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
  shieldDamage?: number;
  hpDamage?: number;
  malfunction?: boolean;
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

export interface RewardEvent {
  robotName: string;
  credits: number;
  prestige?: number;
  fame?: number;
}

/**
 * Combat Message Generator Service
 */
export class CombatMessageGenerator {
  // Battle Start Messages (expanded)
  private static battleStartMessages = [
    '⚔️ Battle commences! {robot1Name} (ELO {robot1ELO}) vs {robot2Name} (ELO {robot2ELO})',
    '🎯 {robot1Name} and {robot2Name} enter the arena for {leagueType} league combat!',
    '💥 Arena match starting: {robot1Name} vs {robot2Name}',
    '⚡ The arena lights up as {robot1Name} faces {robot2Name} in {leagueType} league!',
    '🏟️ {robot1Name} (ELO {robot1ELO}) challenges {robot2Name} (ELO {robot2ELO}) to battle!',
    '🔥 Combat initialized: {robot1Name} vs {robot2Name} - {leagueType} league match',
    '⚔️ {robot1Name} and {robot2Name} take their positions in the arena!',
    '💫 Battle systems online: {robot1Name} vs {robot2Name} engaging now',
    '🎪 The crowd watches as {robot1Name} confronts {robot2Name} in {leagueType} league!',
    '⚡ Arena secured. Combatants ready: {robot1Name} vs {robot2Name}',
  ];

  // Damage intensity descriptors (replace specific damage numbers)
  private static getDamageDescriptor(damage: number, maxHP: number = 100): string {
    const percentage = (damage / maxHP) * 100;
    
    if (percentage >= 25) return 'a devastating blow';
    if (percentage >= 15) return 'a heavy strike';
    if (percentage >= 10) return 'a solid hit';
    if (percentage >= 5) return 'a moderate impact';
    if (percentage >= 2) return 'a glancing blow';
    return 'a minor scratch';
  }

  // Attack Hit Messages with damage descriptors (no numbers)
  private static hitMessages = [
    '💥 {attackerName} strikes {defenderName} with {weaponName}, landing {damageDescriptor}!',
    '⚡ {attackerName}\'s {weaponName} connects, dealing {damageDescriptor} to {defenderName}!',
    '🔪 {attackerName} slashes {defenderName} with {weaponName}, inflicting {damageDescriptor}!',
    '🎯 {attackerName} lands {damageDescriptor} on {defenderName} with {weaponName}!',
    '💢 {attackerName}\'s {weaponName} finds its mark - {damageDescriptor} to {defenderName}!',
    '⚔️ {attackerName} drives {weaponName} into {defenderName} for {damageDescriptor}!',
    '🔥 {weaponName} tears into {defenderName} - {attackerName} delivers {damageDescriptor}!',
    '💪 {attackerName} successfully hits {defenderName} with {weaponName}, causing {damageDescriptor}!',
    '⚡ Direct hit! {attackerName}\'s {weaponName} deals {damageDescriptor} to {defenderName}!',
    '🎯 {attackerName} scores {damageDescriptor} against {defenderName} using {weaponName}!',
    '💥 {weaponName} impacts {defenderName}\'s hull - {damageDescriptor} from {attackerName}!',
    '🔪 {attackerName} executes a clean strike with {weaponName}, inflicting {damageDescriptor}!',
  ];

  // Critical Hit Messages (enhanced, no damage numbers)
  private static criticalHitMessages = [
    '💢 CRITICAL HIT! {attackerName}\'s {weaponName} finds a weak point - catastrophic damage to {defenderName}!',
    '🎯 Perfect strike! {attackerName} lands a critical hit with {weaponName} - devastating impact!',
    '💥 DEVASTATING! {attackerName}\'s critical strike with {weaponName} overwhelms {defenderName}!',
    '⚡ CRITICAL! {attackerName} exploits a vulnerability in {defenderName}\'s defenses!',
    '🔥 MASSIVE DAMAGE! {attackerName}\'s {weaponName} scores a critical hit on {defenderName}!',
    '💢 CRITICAL STRIKE! {attackerName}\'s {weaponName} tears through {defenderName}\'s armor!',
    '🎯 Precision attack! {attackerName} targets a critical system on {defenderName} with {weaponName}!',
    '💥 EXCEPTIONAL! {attackerName} delivers a punishing critical blow with {weaponName}!',
    '⚡ DEVASTATING CRITICAL! {weaponName} finds the perfect angle - {defenderName} reels from the impact!',
    '🔥 CRITICAL DAMAGE! {attackerName}\'s {weaponName} strikes a vulnerable point on {defenderName}!',
    '💢 CRUSHING BLOW! {attackerName} lands a critical strike that staggers {defenderName}!',
    '🎯 PINPOINT ACCURACY! {attackerName}\'s {weaponName} exploits a weak spot perfectly!',
  ];

  // Miss Messages (expanded)
  private static missMessages = [
    '❌ {attackerName} swings {weaponName} but misses {defenderName} completely!',
    '⚠️ {attackerName}\'s {weaponName} attack goes wide - no damage!',
    '🎯 {attackerName} aims {weaponName} but the shot misses {defenderName}!',
    '💨 {defenderName} dodges {attackerName}\'s {weaponName} attack effortlessly!',
    '🏃 {defenderName} evades {attackerName}\'s {weaponName} with quick reflexes!',
    '⚡ {defenderName} weaves out of range as {attackerName}\'s {weaponName} strikes empty air!',
    '❌ {attackerName}\'s {weaponName} fails to connect - {defenderName} too quick!',
    '💨 Evasion successful! {defenderName} sidesteps {attackerName}\'s {weaponName}!',
    '🏃 {defenderName}\'s thrusters engage - {attackerName}\'s attack misses!',
    '⚠️ {attackerName} miscalculates - {weaponName} hits nothing but air!',
    '❌ {defenderName} anticipates the attack and dodges {attackerName}\'s {weaponName}!',
    '💨 Clean evasion! {defenderName} avoids {attackerName}\'s {weaponName} entirely!',
  ];

  // Shield Messages
  private static shieldAbsorbMessages = [
    '🛡️ {defenderName}\'s energy shield absorbs the impact from {attackerName}\'s {weaponName}!',
    '⚡ {defenderName}\'s shields hold strong against {attackerName}\'s {weaponName}!',
    '🛡️ Energy shield flares as {defenderName} deflects {attackerName}\'s attack!',
    '⚡ {defenderName}\'s shield takes the hit - hull integrity maintained!',
    '🛡️ Defensive systems engaged! {defenderName}\'s shield blocks {attackerName}\'s {weaponName}!',
  ];

  private static shieldBreakMessages = [
    '🛡️💥 {robotName}\'s energy shield has been depleted!',
    '⚡❌ {robotName}\'s shields are down - hull is exposed!',
    '🔴 WARNING: {robotName}\'s energy shield has failed!',
    '💥 Shield generator offline! {robotName} is vulnerable!',
    '⚠️ Critical: {robotName}\'s protective shields have collapsed!',
  ];

  // Malfunction Messages (NEW)
  private static malfunctionMessages = [
    '⚙️ MALFUNCTION! {robotName}\'s {weaponName} jams and fails to fire!',
    '⚠️ SYSTEM ERROR! {robotName}\'s targeting systems glitch - attack aborted!',
    '🔧 TECHNICAL FAILURE! {robotName}\'s {weaponName} malfunctions mid-attack!',
    '⚡ POWER SURGE! {robotName}\'s weapon systems temporarily offline!',
    '💥 CRITICAL ERROR! {robotName}\'s {weaponName} overheats and shuts down!',
    '⚙️ MECHANICAL FAULT! {robotName}\'s attack systems fail at a critical moment!',
  ];

  // Victory Messages (expanded)
  private static victoryMessages = [
    '🏆 VICTORY! {winnerName} defeats {loserName}!',
    '👑 {winnerName} emerges victorious over {loserName}!',
    '⚔️ {winnerName} wins the battle against {loserName}!',
    '🎉 {winnerName} triumphs over {loserName}!',
    '💪 {winnerName} claims victory against {loserName}!',
    '🏆 Battle concluded: {winnerName} defeats {loserName}!',
    '👑 {winnerName} stands triumphant over the fallen {loserName}!',
    '⚔️ {loserName} falls before {winnerName}\'s superior combat prowess!',
  ];

  // Dominant Victory Messages (>80% HP remaining - expanded)
  private static dominantVictoryMessages = [
    '🏆 DOMINANT VICTORY! {winnerName} crushes {loserName} with {hpPercent}% HP remaining!',
    '👑 FLAWLESS! {winnerName} defeats {loserName} while taking minimal damage!',
    '⚔️ OVERWHELMING! {winnerName} destroys {loserName} at {hpPercent}% health!',
    '💪 SUPERIOR! {winnerName} dominates {loserName} completely!',
    '🎯 PERFECT EXECUTION! {winnerName} defeats {loserName} with barely a scratch!',
    '🔥 UNSTOPPABLE! {winnerName} crushes {loserName} with overwhelming force!',
    '💥 TOTAL DOMINATION! {winnerName} obliterates {loserName} while remaining nearly undamaged!',
    '👑 MASTERFUL! {winnerName} outclasses {loserName} in every way!',
  ];

  // Close Victory Messages (<30% HP remaining - expanded)
  private static closeVictoryMessages = [
    '🏆 NARROW VICTORY! {winnerName} defeats {loserName} by the slimmest margin!',
    '⚔️ Hard-fought victory! {winnerName} wins with only {hp} HP remaining!',
    '💪 {winnerName} barely survives to claim victory over {loserName}!',
    '🎯 {winnerName} edges out {loserName} in a close battle!',
    '🔥 CLUTCH! {winnerName} survives by a hair to defeat {loserName}!',
    '⚡ INTENSE! {winnerName} claims victory despite being pushed to the limit!',
    '💥 CLOSE CALL! {winnerName} emerges victorious but heavily damaged!',
    '🏆 NARROW ESCAPE! {winnerName} defeats {loserName} in a nail-biting finish!',
  ];

  // Yield Messages (NEW)
  private static yieldMessages = [
    '🏳️ {robotName} yields! Battle ends with {winnerName} victorious!',
    '✋ {robotName} surrenders! {winnerName} wins!',
    '🛑 {robotName} concedes defeat to {winnerName}!',
    '⚠️ {robotName} signals surrender - {winnerName} emerges victorious!',
    '🏳️ {robotName} surrenders to avoid complete destruction!',
  ];

  // ELO Change Messages (expanded)
  private static eloGainMessages = [
    '📈 {robotName}: {oldELO} → {newELO} (+{change} ELO)',
    '⬆️ {robotName} gains {change} ELO rating ({oldELO} → {newELO})',
    '📊 {robotName}\'s rating increases by {change} ELO points',
    '🎯 {robotName} earns +{change} ELO (now {newELO})',
    '📈 Rating boost for {robotName}: +{change} ELO',
  ];

  private static eloLossMessages = [
    '📉 {robotName}: {oldELO} → {newELO} ({change} ELO)',
    '⬇️ {robotName} loses {change} ELO rating ({oldELO} → {newELO})',
    '📊 {robotName}\'s rating decreases by {change} ELO points',
    '📉 Rating penalty for {robotName}: {change} ELO',
    '⬇️ {robotName} drops {change} ELO points (now {newELO})',
  ];

  // Reward Messages (NEW)
  private static rewardMessages = [
    '💰 {robotName} receives ₡{credits}',
    '💵 {robotName} earns ₡{credits} in battle rewards',
    '🏆 Battle earnings: ₡{credits} awarded to {robotName}',
    '💰 {robotName} collects ₡{credits} for combat participation',
  ];

  private static prestigeMessages = [
    '⭐ {robotName} gains {prestige} prestige!',
    '✨ Prestige awarded: +{prestige} for {robotName}',
    '🌟 {robotName} earns {prestige} prestige points',
    '⭐ {robotName}\'s reputation increases by {prestige} prestige',
  ];

  private static fameMessages = [
    '🎖️ {robotName} gains {fame} fame!',
    '📣 Fame earned: +{fame} for {robotName}',
    '🏅 {robotName} receives {fame} fame points',
    '🎖️ {robotName}\'s renown increases by {fame} fame',
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
   * Generate attack message (with damage descriptor instead of numbers)
   */
  static generateAttack(event: AttackEvent): string {
    let template: string;

    if (event.malfunction) {
      template = this.selectRandom(this.malfunctionMessages);
      return this.interpolate(template, {
        robotName: event.attackerName,
        weaponName: event.weaponName,
      });
    }

    if (!event.hit) {
      template = this.selectRandom(this.missMessages);
    } else if (event.critical) {
      template = this.selectRandom(this.criticalHitMessages);
    } else if (event.shieldDamage && event.shieldDamage > 0 && (!event.hpDamage || event.hpDamage === 0)) {
      // Shield absorbed all damage
      template = this.selectRandom(this.shieldAbsorbMessages);
    } else {
      template = this.selectRandom(this.hitMessages);
    }

    // Calculate damage descriptor (use total damage or hp damage if shield was involved)
    const effectiveDamage = event.hpDamage || event.damage;
    const damageDescriptor = this.getDamageDescriptor(effectiveDamage);

    return this.interpolate(template, {
      ...event,
      damageDescriptor,
    });
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
   * Generate shield break message
   */
  static generateShieldBreak(robotName: string): string {
    const template = this.selectRandom(this.shieldBreakMessages);
    return this.interpolate(template, { robotName });
  }

  /**
   * Generate yield message
   */
  static generateYield(robotName: string, winnerName: string): string {
    const template = this.selectRandom(this.yieldMessages);
    return this.interpolate(template, { robotName, winnerName });
  }

  /**
   * Generate reward message
   */
  static generateReward(event: RewardEvent): string {
    const template = this.selectRandom(this.rewardMessages);
    return this.interpolate(template, event);
  }

  /**
   * Generate prestige message
   */
  static generatePrestige(robotName: string, prestige: number): string {
    const template = this.selectRandom(this.prestigeMessages);
    return this.interpolate(template, { robotName, prestige });
  }

  /**
   * Generate fame message
   */
  static generateFame(robotName: string, fame: number): string {
    const template = this.selectRandom(this.fameMessages);
    return this.interpolate(template, { robotName, fame });
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
    robot1Reward?: number;
    robot2Reward?: number;
    robot1Prestige?: number;
    robot2Prestige?: number;
    robot1Fame?: number;
    robot2Fame?: number;
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
    
    // Generate attack events with damage descriptors (no actual numbers)
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

    // Note: ELO changes, rewards, fame, and prestige are now displayed in the
    // battle summary section at the top of the page, not in the combat log.
    // This keeps the combat log focused on the action and moves the "results"
    // to a more prominent position as requested.

    return log;
  }
}
