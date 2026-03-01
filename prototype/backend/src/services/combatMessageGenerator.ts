/**
 * Combat Message Generator
 * Generates human-readable narrative descriptions for battle events
 * 
 * v2.0 - Rewritten to convert real combat simulator events into narrative messages
 * instead of fabricating fake events. Now uses actual weapon names, damage values,
 * stances, and all combat data from the simulator.
 */

import { CombatEvent } from './combatSimulator';

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

export interface TagOutEvent {
  robotName: string;
  teamName: string;
  reason: 'yield' | 'destruction';
  finalHP: number;
}

export interface TagInEvent {
  robotName: string;
  teamName: string;
  hp: number;
}

/**
 * Combat Message Generator Service
 * Converts real combat simulator events into narrative player-facing messages
 */
export class CombatMessageGenerator {

  // ── Battle Start Messages ────────────────────────────────────────────
  // Generic (work for any battle type)
  private static battleStartMessagesGeneric = [
    '⚔️ Battle commences! {robot1Name} vs {robot2Name}',
    '💥 Arena match starting: {robot1Name} vs {robot2Name}',
    '⚔️ {robot1Name} and {robot2Name} take their positions in the arena!',
    '💫 Battle systems online: {robot1Name} vs {robot2Name} engaging now',
    '⚡ Arena secured. Combatants ready: {robot1Name} vs {robot2Name}',
  ];

  // League-specific
  private static battleStartMessagesLeague = [
    '⚔️ Battle commences! {robot1Name} (ELO {robot1ELO}) vs {robot2Name} (ELO {robot2ELO})',
    '🎯 {robot1Name} and {robot2Name} enter the arena for {leagueType} league combat!',
    '⚡ The arena lights up as {robot1Name} faces {robot2Name} in {leagueType} league!',
    '🏟️ {robot1Name} (ELO {robot1ELO}) challenges {robot2Name} (ELO {robot2ELO}) to battle!',
    '🔥 Combat initialized: {robot1Name} vs {robot2Name} - {leagueType} league match',
    '🎪 The crowd watches as {robot1Name} confronts {robot2Name} in {leagueType} league!',
  ];

  // Tournament-specific
  private static battleStartMessagesTournament = [
    '🏆 Tournament bout! {robot1Name} vs {robot2Name} - only one advances!',
    '⚔️ Tournament match: {robot1Name} faces {robot2Name} in elimination combat!',
    '🎯 The tournament bracket brings {robot1Name} against {robot2Name}!',
    '💥 Elimination round! {robot1Name} vs {robot2Name} - no draws allowed!',
    '🏟️ The crowd roars as {robot1Name} and {robot2Name} clash in the tournament!',
  ];

  // Tag team-specific
  private static battleStartMessagesTagTeam = [
    '🤝 Tag Team Battle! {team1Name} vs {team2Name}!',
    '⚔️ Tag team combat begins! {team1Name} sends {robot1Name} against {team2Name}\'s {robot2Name}!',
    '🏟️ The arena opens for tag team warfare: {team1Name} ({robot1Name} & {robot3Name}) vs {team2Name} ({robot2Name} & {robot4Name})!',
    '💥 Tag team showdown! {team1Name} vs {team2Name} - four robots, one victor!',
    '🤝 Teams ready! {team1Name} leads with {robot1Name}, {team2Name} leads with {robot2Name}!',
  ];

  // ── Stance Messages (3 variations per stance) ─────────────────────────
  private static stanceMessages: Record<string, string[]> = {
    offensive: [
      '⚔️ {robotName} takes an aggressive offensive stance, focusing on damage',
      '🔥 {robotName} powers up weapons systems - offensive mode engaged!',
      '💢 {robotName} locks targeting systems to maximum aggression!',
    ],
    defensive: [
      '🛡️ {robotName} adopts a defensive stance, prioritizing survival',
      '🛡️ {robotName} reinforces shields and activates damage dampeners!',
      '🛡️ {robotName} hunkers down behind reinforced plating - defense mode!',
    ],
    balanced: [
      '⚖️ {robotName} maintains a balanced stance, ready to adapt',
      '⚖️ {robotName} calibrates systems for balanced combat readiness',
      '⚖️ {robotName} holds steady - all systems at standard output',
    ],
  };

  // ── Damage Descriptors ─────────────────────────────────────────────────
  private static getDamageDescriptor(damage: number, maxHP: number = 100): string {
    const percentage = (damage / maxHP) * 100;
    if (percentage >= 25) return 'a devastating blow';
    if (percentage >= 15) return 'a heavy strike';
    if (percentage >= 10) return 'a solid hit';
    if (percentage >= 5) return 'a moderate impact';
    if (percentage >= 2) return 'a glancing blow';
    return 'a minor scratch';
  }

  /**
   * Describe remaining HP as a narrative descriptor (no numbers).
   */
  private static getHPDescriptor(currentHP: number, maxHP: number): string {
    const percent = (currentHP / maxHP) * 100;
    if (percent >= 90) return 'nearly full hull integrity';
    if (percent >= 70) return 'strong hull integrity';
    if (percent >= 50) return 'moderate hull integrity';
    if (percent >= 30) return 'weakened hull integrity';
    if (percent >= 15) return 'critical hull integrity';
    return 'minimal hull integrity';
  }

  // ── Attack Hit Messages (12 variations) ────────────────────────────────
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
    '🔪 {attackerName} executes a clean strike on {defenderName} with {weaponName}, inflicting {damageDescriptor}!',
  ];

  // ── Critical Hit Messages (12 variations) ──────────────────────────────
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

  // ── Miss Messages (12 variations) ──────────────────────────────────────
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

  // ── Shield Messages ────────────────────────────────────────────────────
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

  // ── Shield Regeneration Messages (5 variations) ────────────────────────
  private static shieldRegenMessages = [
    '🛡️⚡ {robotName}\'s power core recharges shields',
    '⚡✨ {robotName}\'s shields regenerate during the lull in combat',
    '🔋 {robotName}\'s energy shield restores capacity',
    '🛡️ {robotName}\'s defensive systems recover shield energy',
    '⚡ {robotName}\'s shield generator hums back to life',
  ];

  // ── Malfunction Messages (6 variations) ────────────────────────────────
  private static malfunctionMessages = [
    '⚙️ MALFUNCTION! {robotName}\'s {weaponName} jams and fails to fire!',
    '⚠️ SYSTEM ERROR! {robotName}\'s targeting systems glitch - attack aborted!',
    '🔧 TECHNICAL FAILURE! {robotName}\'s {weaponName} malfunctions mid-attack!',
    '⚡ POWER SURGE! {robotName}\'s weapon systems temporarily offline!',
    '💥 CRITICAL ERROR! {robotName}\'s {weaponName} overheats and shuts down!',
    '⚙️ MECHANICAL FAULT! {robotName}\'s attack systems fail at a critical moment!',
  ];

  // ── Counter-Attack Messages (8 variations for success) ─────────────────
  private static counterSuccessMessages = [
    '🔄 {defenderName} counters {attackerName}\'s attack with {weaponName} for {damageDescriptor}!',
    '⚔️ Counter-attack! {defenderName} retaliates with {weaponName}, dealing {damageDescriptor} to {attackerName}!',
    '💫 {defenderName} parries and counters with {weaponName}, striking {attackerName} for {damageDescriptor}!',
    '🔄 Quick reflexes! {defenderName} turns defense into offense with {weaponName}!',
    '⚔️ {defenderName} exploits an opening and counters with {weaponName} - {damageDescriptor}!',
    '💫 {defenderName}\'s counter protocols activate - {weaponName} strikes back at {attackerName}!',
    '🔄 Reversal! {defenderName} catches {attackerName} off-guard with a {weaponName} counter!',
    '⚔️ {defenderName} reads the attack and retaliates with {weaponName} for {damageDescriptor}!',
  ];

  // ── Victory Messages ───────────────────────────────────────────────────
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

  private static dominantVictoryMessages = [
    '🏆 DOMINANT VICTORY! {winnerName} crushes {loserName} with {hpDescriptor} remaining!',
    '👑 FLAWLESS! {winnerName} defeats {loserName} while taking minimal damage!',
    '⚔️ OVERWHELMING! {winnerName} destroys {loserName} with {hpDescriptor} to spare!',
    '💪 SUPERIOR! {winnerName} dominates {loserName} completely!',
    '🎯 PERFECT EXECUTION! {winnerName} defeats {loserName} with barely a scratch!',
    '🔥 UNSTOPPABLE! {winnerName} crushes {loserName} with overwhelming force!',
    '💥 TOTAL DOMINATION! {winnerName} obliterates {loserName} while remaining nearly undamaged!',
    '👑 MASTERFUL! {winnerName} outclasses {loserName} in every way!',
  ];

  private static closeVictoryMessages = [
    '🏆 NARROW VICTORY! {winnerName} defeats {loserName} by the slimmest margin!',
    '⚔️ Hard-fought victory! {winnerName} wins with {hpDescriptor} remaining!',
    '💪 {winnerName} barely survives to claim victory over {loserName}!',
    '🎯 {winnerName} edges out {loserName} in a close battle!',
    '🔥 CLUTCH! {winnerName} survives by a hair to defeat {loserName}!',
    '⚡ INTENSE! {winnerName} claims victory despite being pushed to the limit!',
    '💥 CLOSE CALL! {winnerName} emerges victorious but heavily damaged!',
    '🏆 NARROW ESCAPE! {winnerName} defeats {loserName} in a nail-biting finish!',
  ];

  // ── Yield Messages (5 variations) ──────────────────────────────────────
  private static yieldMessages = [
    '🏳️ {robotName} yields! Battle ends with {winnerName} victorious!',
    '✋ {robotName} surrenders! {winnerName} wins!',
    '🛑 {robotName} concedes defeat to {winnerName}!',
    '⚠️ {robotName} signals surrender - {winnerName} emerges victorious!',
    '🏳️ {robotName} surrenders to avoid complete destruction!',
  ];

  // ── Destruction Messages (5 variations) ────────────────────────────────
  private static destructionMessages = [
    '💀 {robotName} has been destroyed! Hull integrity at 0%!',
    '💥 {robotName}\'s systems fail - robot disabled!',
    '🔴 KNOCKOUT! {robotName} is down!',
    '💀 {robotName} crumbles under the assault - total system failure!',
    '💥 {robotName}\'s hull breaches catastrophically - destruction confirmed!',
  ];

  // ── Damage Status Messages ─────────────────────────────────────────────
  private static heavyDamageMessages = [
    '⚠️ {robotName} is heavily damaged - hull integrity critical!',
    '🔴 {robotName} at critical health - systems failing!',
    '💔 {robotName}\'s hull integrity severely compromised!',
  ];

  private static moderateDamageMessages = [
    '⚠️ {robotName} has taken significant damage!',
    '🟠 {robotName} showing signs of wear - systems strained!',
  ];

  private static lightDamageMessages = [
    '🟢 {robotName} sustains minor damage - still in fighting shape',
  ];

  // ── Draw Messages (3 variations) ───────────────────────────────────────
  private static drawMessages = [
    '⏱️ DRAW! Maximum battle time reached - both combatants survive!',
    '⏰ Time expires! Battle ends in a draw.',
    '🤝 Stalemate! Neither robot could secure victory before time ran out.',
  ];

  // ── ELO Messages ───────────────────────────────────────────────────────
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

  // ── Reward Messages ────────────────────────────────────────────────────
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

  // ── Tag Team Messages ──────────────────────────────────────────────────
  private static tagOutYieldMessages = [
    '🏳️ {robotName} reaches their yield threshold and tags out! {teamName} calls in their reserve!',
    '✋ {robotName} yields! {teamName}\'s reserve robot prepares to enter the arena!',
    '🛑 {robotName} signals for a tag-out - {teamName}\'s backup is ready!',
    '⚠️ {robotName} has taken enough damage and tags out! {teamName} switches fighters!',
    '🏳️ {robotName} retreats to avoid destruction - {teamName} brings in fresh reinforcements!',
    '✋ Tag-out! {robotName} yields the arena to their teammate!',
    '🛑 {robotName} concedes and tags out - {teamName}\'s reserve enters the fight!',
    '⚠️ {robotName} reaches critical damage and calls for backup!',
  ];

  private static tagOutDestructionMessages = [
    '💥 {robotName} is destroyed! {teamName}\'s reserve robot rushes to continue the fight!',
    '🔥 {robotName} falls in combat! {teamName} sends in their backup!',
    '💢 {robotName} has been eliminated! {teamName}\'s reserve takes over!',
    '⚡ {robotName} is taken down! {teamName}\'s second fighter enters the arena!',
    '💥 Destruction! {robotName} is out - {teamName}\'s reserve steps up!',
    '🔥 {robotName} is defeated! {teamName} calls in their remaining fighter!',
    '💢 {robotName} falls! {teamName}\'s backup robot charges into battle!',
    '⚡ {robotName} is eliminated from combat! {teamName}\'s reserve activates!',
  ];

  private static tagInMessages = [
    '🔄 {robotName} enters the arena for {teamName} at full strength!',
    '⚡ Fresh fighter! {robotName} tags in for {teamName} at peak condition!',
    '🎯 {robotName} joins the battle for {teamName} - weapons ready!',
    '💪 {robotName} charges into the arena to fight for {teamName}!',
    '🔄 Tag-in complete! {robotName} takes over for {teamName}!',
    '⚡ {robotName} enters combat for {teamName} with full energy!',
    '🎯 Reserve activated! {robotName} steps up for {teamName}!',
    '💪 {robotName} rushes in to continue the fight for {teamName}!',
    '🔄 {teamName}\'s {robotName} enters the arena at maximum combat readiness!',
    '⚡ {robotName} tags in - {teamName} brings fresh firepower to the battle!',
  ];

  // ── Utility Methods ────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static interpolate(template: string, values: Record<string, any>): string {
    return template.replace(/{(\w+)}/g, (match, key) => {
      const val = values[key];
      if (val === undefined) return match;
      // Round numeric values so raw floats never leak into player-facing messages
      if (typeof val === 'number') return String(Math.round(val));
      return String(val);
    });
  }

  private static selectRandom<T>(messages: T[]): T {
    return messages[Math.floor(Math.random() * messages.length)];
  }

  /**
   * Get a damage status message based on HP percentage thresholds:
   * - Heavy: ≤25% HP
   * - Moderate: ≤50% HP
   * - Light: ≤75% HP
   * Returns null if HP > 75% (no status message needed)
   */
  private static getDamageStatusMessage(robotName: string, currentHP: number, maxHP: number): string | null {
    const percentage = Math.round((currentHP / maxHP) * 100);
    if (percentage <= 25) {
      return this.interpolate(this.selectRandom(this.heavyDamageMessages), { robotName, percentage });
    }
    if (percentage <= 50) {
      return this.interpolate(this.selectRandom(this.moderateDamageMessages), { robotName, percentage });
    }
    if (percentage <= 75) {
      return this.interpolate(this.selectRandom(this.lightDamageMessages), { robotName, percentage });
    }
    return null;
  }

  // ── Individual Message Generators (kept for standalone use) ────────────

  static generateBattleStart(event: BattleStartEvent & {
    battleType?: 'league' | 'tournament' | 'tag_team';
    team1Name?: string;
    team2Name?: string;
    robot3Name?: string;
    robot4Name?: string;
  }): string {
    let messages: string[];
    switch (event.battleType) {
      case 'tournament':
        messages = this.battleStartMessagesTournament;
        break;
      case 'tag_team':
        messages = this.battleStartMessagesTagTeam;
        break;
      case 'league':
        messages = this.battleStartMessagesLeague;
        break;
      default:
        messages = this.battleStartMessagesGeneric;
        break;
    }
    const template = this.selectRandom(messages);
    return this.interpolate(template, event);
  }

  static generateStance(robotName: string, stance: string): string {
    const stanceKey = stance.toLowerCase();
    const messages = this.stanceMessages[stanceKey] || this.stanceMessages.balanced;
    return this.interpolate(this.selectRandom(messages), { robotName });
  }

  static generateAttack(event: AttackEvent): string {
    let template: string;

    if (event.malfunction) {
      template = this.selectRandom(this.malfunctionMessages);
      return this.interpolate(template, { robotName: event.attackerName, weaponName: event.weaponName });
    }

    if (!event.hit) {
      template = this.selectRandom(this.missMessages);
    } else if (event.critical) {
      template = this.selectRandom(this.criticalHitMessages);
    } else if (event.shieldDamage && event.shieldDamage > 0 && (!event.hpDamage || event.hpDamage === 0)) {
      template = this.selectRandom(this.shieldAbsorbMessages);
    } else {
      template = this.selectRandom(this.hitMessages);
    }

    const effectiveDamage = event.hpDamage || event.damage;
    const damageDescriptor = this.getDamageDescriptor(effectiveDamage);

    return this.interpolate(template, { ...event, damageDescriptor });
  }

  static generateCounter(defenderName: string, attackerName: string, weaponName: string, damage: number, maxHP: number): string {
    const damageDescriptor = this.getDamageDescriptor(damage, maxHP);
    const template = this.selectRandom(this.counterSuccessMessages);
    return this.interpolate(template, { defenderName, attackerName, weaponName, damageDescriptor });
  }

  static generateBattleEnd(event: BattleEndEvent): string {
    const hpPercent = Math.round((event.winnerHP / event.winnerMaxHP) * 100);
    const hpDescriptor = this.getHPDescriptor(event.winnerHP, event.winnerMaxHP);
    let template: string;
    if (hpPercent > 80) {
      template = this.selectRandom(this.dominantVictoryMessages);
    } else if (hpPercent < 30) {
      template = this.selectRandom(this.closeVictoryMessages);
    } else {
      template = this.selectRandom(this.victoryMessages);
    }
    return this.interpolate(template, { ...event, hpDescriptor });
  }

  static generateELOChange(event: ELOChangeEvent): string {
    const template = event.change > 0
      ? this.selectRandom(this.eloGainMessages)
      : this.selectRandom(this.eloLossMessages);
    return this.interpolate(template, { ...event, change: Math.abs(event.change) });
  }

  static generateShieldBreak(robotName: string): string {
    return this.interpolate(this.selectRandom(this.shieldBreakMessages), { robotName });
  }

  static generateShieldRegen(robotName: string): string {
    return this.interpolate(this.selectRandom(this.shieldRegenMessages), { robotName });
  }

  static generateYield(robotName: string, winnerName: string): string {
    return this.interpolate(this.selectRandom(this.yieldMessages), { robotName, winnerName });
  }

  static generateDestruction(robotName: string): string {
    return this.interpolate(this.selectRandom(this.destructionMessages), { robotName });
  }

  static generateDraw(): string {
    return this.selectRandom(this.drawMessages);
  }

  static generateReward(event: RewardEvent): string {
    return this.interpolate(this.selectRandom(this.rewardMessages), event);
  }

  static generatePrestige(robotName: string, prestige: number): string {
    return this.interpolate(this.selectRandom(this.prestigeMessages), { robotName, prestige });
  }

  static generateFame(robotName: string, fame: number): string {
    return this.interpolate(this.selectRandom(this.fameMessages), { robotName, fame });
  }

  static generateTagOutYield(event: TagOutEvent): string {
    return this.interpolate(this.selectRandom(this.tagOutYieldMessages), event);
  }

  static generateTagOutDestruction(event: TagOutEvent): string {
    return this.interpolate(this.selectRandom(this.tagOutDestructionMessages), event);
  }

  static generateTagOut(event: TagOutEvent): string {
    return event.reason === 'yield' ? this.generateTagOutYield(event) : this.generateTagOutDestruction(event);
  }

  static generateTagIn(event: TagInEvent): string {
    return this.interpolate(this.selectRandom(this.tagInMessages), event);
  }

  // ══════════════════════════════════════════════════════════════════════
  // CORE METHOD: Convert real simulator events into narrative messages
  // This replaces the old generateBattleLog which fabricated fake events
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Convert real combat simulator events into player-facing narrative events.
   * 
   * The simulator produces technical messages like:
   *   "💥 BattleBot hits for 45 damage with Laser Rifle (30 shield, 15 HP)"
   * 
   * This method converts them into narrative messages like:
   *   "⚡ BattleBot's Laser Rifle connects, dealing a heavy strike to Iron Crusher!"
   * 
   * It also injects additional narrative events:
   *   - Stance announcements at battle start
   *   - Shield break announcements
   *   - Shield regeneration notices (when significant)
   *   - Damage status updates (heavy/moderate/light thresholds)
   *   - Proper yield vs destruction distinction
   *   - Draw condition messages
   */
  static convertSimulatorEvents(
    simulatorEvents: CombatEvent[],
    context: {
      robot1Name: string;
      robot2Name: string;
      robot1Stance: string;
      robot2Stance: string;
      robot1MaxHP: number;
      robot2MaxHP: number;
      robot1ELO: number;
      robot2ELO: number;
      leagueType: string;
      battleType?: 'league' | 'tournament' | 'tag_team';
      // Tag team fields
      team1Name?: string;
      team2Name?: string;
      robot3Name?: string; // team1 reserve
      robot4Name?: string; // team2 reserve
    }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): any[] {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const narrativeEvents: any[] = [];

    // Track shield state to detect shield breaks
    let robot1PrevShield = -1; // -1 = not yet initialized
    let robot2PrevShield = -1;
    // Track HP thresholds crossed to emit damage status messages (only once per threshold)
    const robot1ThresholdsCrossed = new Set<number>();
    const robot2ThresholdsCrossed = new Set<number>();
    // Track if we've already emitted the battle start + stance intro
    let battleStartEmitted = false;

    for (const event of simulatorEvents) {
      // ── First event: emit battle start + stances ──
      if (!battleStartEmitted) {
        battleStartEmitted = true;

        // Battle start message
        narrativeEvents.push({
          timestamp: 0,
          type: 'battle_start',
          message: this.generateBattleStart({
            robot1Name: context.robot1Name,
            robot2Name: context.robot2Name,
            robot1ELO: context.robot1ELO,
            robot2ELO: context.robot2ELO,
            leagueType: context.leagueType,
            battleType: context.battleType,
            team1Name: context.team1Name,
            team2Name: context.team2Name,
            robot3Name: context.robot3Name,
            robot4Name: context.robot4Name,
          }),
        });

        // Stance announcements
        narrativeEvents.push({
          timestamp: 0.1,
          type: 'stance',
          message: this.generateStance(context.robot1Name, context.robot1Stance),
        });
        narrativeEvents.push({
          timestamp: 0.2,
          type: 'stance',
          message: this.generateStance(context.robot2Name, context.robot2Stance),
        });

        // Initialize shield tracking from first event
        if (event.robot1Shield !== undefined) robot1PrevShield = event.robot1Shield;
        if (event.robot2Shield !== undefined) robot2PrevShield = event.robot2Shield;
      }

      // ── Convert each simulator event type ──
      const ts = event.timestamp;

      if (event.type === 'malfunction') {
        narrativeEvents.push({
          timestamp: ts,
          type: 'malfunction',
          attacker: event.attacker,
          message: this.generateAttack({
            attackerName: event.attacker || '',
            defenderName: event.defender || '',
            weaponName: event.weapon || 'Fists',
            damage: 0,
            hit: false,
            critical: false,
            malfunction: true,
          }),
        });
      } else if (event.type === 'miss') {
        narrativeEvents.push({
          timestamp: ts,
          type: 'miss',
          attacker: event.attacker,
          defender: event.defender,
          message: this.generateAttack({
            attackerName: event.attacker || '',
            defenderName: event.defender || '',
            weaponName: event.weapon || 'Fists',
            damage: 0,
            hit: false,
            critical: false,
          }),
        });
      } else if (event.type === 'attack' || event.type === 'critical') {
        // Skip the simulator's battle-start event (timestamp 0, no weapon)
        if (ts === 0 && !event.weapon) continue;

        const _defenderMaxHP = event.defender === context.robot1Name
          ? context.robot1MaxHP : context.robot2MaxHP;

        narrativeEvents.push({
          timestamp: ts,
          type: event.type === 'critical' ? 'critical' : 'attack',
          attacker: event.attacker,
          defender: event.defender,
          weapon: event.weapon,
          message: this.generateAttack({
            attackerName: event.attacker || '',
            defenderName: event.defender || '',
            weaponName: event.weapon || 'Fists',
            damage: event.damage || 0,
            hit: true,
            critical: event.type === 'critical',
            shieldDamage: event.shieldDamage,
            hpDamage: event.hpDamage,
          }),
        });

        // ── Shield break detection ──
        this.checkShieldBreak(event, context, robot1PrevShield, robot2PrevShield, narrativeEvents, ts);

        // ── Damage status thresholds ──
        this.checkDamageStatus(event, context, robot1ThresholdsCrossed, robot2ThresholdsCrossed, narrativeEvents, ts);

      } else if (event.type === 'counter') {
        const counterWeapon = event.weapon || 'Fists';
        const attackerMaxHP = event.defender === context.robot1Name
          ? context.robot1MaxHP : context.robot2MaxHP;

        narrativeEvents.push({
          timestamp: ts,
          type: 'counter',
          attacker: event.attacker,
          defender: event.defender,
          message: this.generateCounter(
            event.attacker || '',
            event.defender || '',
            counterWeapon,
            event.damage || 0,
            attackerMaxHP
          ),
        });

        // Check shield break and damage status after counter too
        this.checkShieldBreak(event, context, robot1PrevShield, robot2PrevShield, narrativeEvents, ts);
        this.checkDamageStatus(event, context, robot1ThresholdsCrossed, robot2ThresholdsCrossed, narrativeEvents, ts);

      } else if (event.type === 'yield') {
        // Check if this is actually a draw (time limit)
        if (event.message.includes('Draw') || event.message.includes('Time limit reached')) {
          narrativeEvents.push({
            timestamp: ts,
            type: 'draw',
            message: this.generateDraw(),
          });
        } else if (event.message.includes('Time limit')) {
          // Tournament time limit with HP tiebreaker
          narrativeEvents.push({
            timestamp: ts,
            type: 'battle_end',
            message: event.message, // Keep the original since it has HP percentages
          });
        } else {
          // Determine who yielded using HP percentages (not message parsing, which is fragile
          // because both robot names appear in the yield message)
          const robot1HpPct = (event.robot1HP || 0) / context.robot1MaxHP;
          const robot2HpPct = (event.robot2HP || 0) / context.robot2MaxHP;
          const isRobot1Yielding = robot1HpPct <= robot2HpPct;
          const yieldingRobot = isRobot1Yielding ? context.robot1Name : context.robot2Name;
          const winnerRobot = isRobot1Yielding ? context.robot2Name : context.robot1Name;

          narrativeEvents.push({
            timestamp: ts,
            type: 'yield',
            message: this.generateYield(yieldingRobot, winnerRobot),
          });
        }

      } else if (event.type === 'destroyed') {
        const isRobot1Destroyed = event.robot1HP === 0;
        const destroyedRobot = isRobot1Destroyed ? context.robot1Name : context.robot2Name;
        const winnerRobot = isRobot1Destroyed ? context.robot2Name : context.robot1Name;
        const winnerHP = isRobot1Destroyed ? (event.robot2HP || 0) : (event.robot1HP || 0);
        const winnerMaxHP = isRobot1Destroyed ? context.robot2MaxHP : context.robot1MaxHP;

        // Destruction message
        narrativeEvents.push({
          timestamp: ts,
          type: 'destroyed',
          message: this.generateDestruction(destroyedRobot),
        });

        // Victory message
        narrativeEvents.push({
          timestamp: ts,
          type: 'battle_end',
          message: this.generateBattleEnd({
            winnerName: winnerRobot,
            loserName: destroyedRobot,
            winnerHP,
            winnerMaxHP,
            reason: 'destruction',
          }),
        });

      } else if (event.type === 'shield_break') {
        // Explicit shield break event from simulator (if any)
        const robotName = event.attacker || event.defender || '';
        narrativeEvents.push({
          timestamp: ts,
          type: 'shield_break',
          message: this.generateShieldBreak(robotName),
        });

      } else if (event.type === 'shield_regen') {
        const robotName = event.attacker || event.defender || '';
        narrativeEvents.push({
          timestamp: ts,
          type: 'shield_regen',
          message: this.generateShieldRegen(robotName),
        });
      }

      // Update shield tracking
      if (event.robot1Shield !== undefined) robot1PrevShield = event.robot1Shield;
      if (event.robot2Shield !== undefined) robot2PrevShield = event.robot2Shield;
    }

    // If the last simulator event was a yield, add a victory message
    const lastEvent = simulatorEvents[simulatorEvents.length - 1];
    const lastNarrative = narrativeEvents[narrativeEvents.length - 1];
    if (lastEvent && lastEvent.type === 'yield' && lastNarrative && lastNarrative.type === 'yield') {
      // Use HP percentages to determine who yielded (not message parsing)
      const robot1HpPct = (lastEvent.robot1HP || 0) / context.robot1MaxHP;
      const robot2HpPct = (lastEvent.robot2HP || 0) / context.robot2MaxHP;
      const isRobot1Yielding = robot1HpPct <= robot2HpPct;
      const winnerName = isRobot1Yielding ? context.robot2Name : context.robot1Name;
      const loserName = isRobot1Yielding ? context.robot1Name : context.robot2Name;
      const winnerHP = isRobot1Yielding ? (lastEvent.robot2HP || 0) : (lastEvent.robot1HP || 0);
      const winnerMaxHP = isRobot1Yielding ? context.robot2MaxHP : context.robot1MaxHP;

      narrativeEvents.push({
        timestamp: lastEvent.timestamp,
        type: 'battle_end',
        message: this.generateBattleEnd({
          winnerName,
          loserName,
          winnerHP,
          winnerMaxHP,
          reason: 'yield',
        }),
      });
    }

    return narrativeEvents;
  }

  /** Check if a shield just broke and emit a shield_break event */
  private static checkShieldBreak(
    event: CombatEvent,
    context: { robot1Name: string; robot2Name: string },
    robot1PrevShield: number,
    robot2PrevShield: number,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    narrativeEvents: any[],
    ts: number
  ): void {
    // Defender's shield went to 0
    if (event.defender === context.robot1Name && robot1PrevShield > 0 && event.robot1Shield === 0) {
      narrativeEvents.push({
        timestamp: ts,
        type: 'shield_break',
        message: this.generateShieldBreak(context.robot1Name),
      });
    }
    if (event.defender === context.robot2Name && robot2PrevShield > 0 && event.robot2Shield === 0) {
      narrativeEvents.push({
        timestamp: ts,
        type: 'shield_break',
        message: this.generateShieldBreak(context.robot2Name),
      });
    }
    // Also check attacker (for counter-attacks)
    if (event.defender === context.robot1Name && event.type === 'counter') {
      // In counter events, the "attacker" field is the counter-attacker (defender of original)
      // and "defender" is the one taking counter damage
    }
  }

  /** Check if HP crossed a damage threshold and emit a status message */
  private static checkDamageStatus(
    event: CombatEvent,
    context: { robot1Name: string; robot2Name: string; robot1MaxHP: number; robot2MaxHP: number },
    robot1Thresholds: Set<number>,
    robot2Thresholds: Set<number>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    narrativeEvents: any[],
    ts: number
  ): void {
    const thresholds = [75, 50, 25]; // Light, Moderate, Heavy

    // Check defender HP
    if (event.defender === context.robot1Name && event.robot1HP !== undefined) {
      const pct = (event.robot1HP / context.robot1MaxHP) * 100;
      for (const t of thresholds) {
        if (pct <= t && !robot1Thresholds.has(t)) {
          robot1Thresholds.add(t);
          const msg = this.getDamageStatusMessage(context.robot1Name, event.robot1HP, context.robot1MaxHP);
          if (msg) {
            narrativeEvents.push({ timestamp: ts, type: 'damage_status', message: msg });
          }
          break; // Only emit the most severe new threshold
        }
      }
    }
    if (event.defender === context.robot2Name && event.robot2HP !== undefined) {
      const pct = (event.robot2HP / context.robot2MaxHP) * 100;
      for (const t of thresholds) {
        if (pct <= t && !robot2Thresholds.has(t)) {
          robot2Thresholds.add(t);
          const msg = this.getDamageStatusMessage(context.robot2Name, event.robot2HP, context.robot2MaxHP);
          if (msg) {
            narrativeEvents.push({ timestamp: ts, type: 'damage_status', message: msg });
          }
          break;
        }
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // Convert tag team mixed event arrays (raw simulator + narrative tag events)
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Convert a tag team battle's mixed event array into fully narrative events.
   * 
   * Tag team battles have a mix of:
   * - Raw simulator CombatEvent[] from each combat phase (technical messages)
   * - Already-narrative tag_out/tag_in events (generated by CombatMessageGenerator)
   * 
   * This method processes each phase's simulator events through convertSimulatorEvents
   * while passing through tag_out/tag_in events unchanged.
   */
  static convertTagTeamEvents(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mixedEvents: any[],
    context: {
      team1Name: string;
      team2Name: string;
      battleType: 'tag_team';
      // Phase robot mappings - which robots fought in which phase
      phases: Array<{
        robot1Name: string;
        robot2Name: string;
        robot1Stance: string;
        robot2Stance: string;
        robot1MaxHP: number;
        robot2MaxHP: number;
      }>;
    }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): any[] {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const narrativeEvents: any[] = [];
    let currentPhase = 0;
    let phaseEvents: CombatEvent[] = [];
    let _phaseStarted = false;

    for (const event of mixedEvents) {
      // Tag events are already narrative - pass through
      if (event.type === 'tag_out' || event.type === 'tag_in') {
        // First, flush any accumulated phase events
        if (phaseEvents.length > 0 && currentPhase < context.phases.length) {
          const phase = context.phases[currentPhase];
          const converted = this.convertSimulatorEvents(phaseEvents, {
            robot1Name: phase.robot1Name,
            robot2Name: phase.robot2Name,
            robot1Stance: phase.robot1Stance,
            robot2Stance: phase.robot2Stance,
            robot1MaxHP: phase.robot1MaxHP,
            robot2MaxHP: phase.robot2MaxHP,
            robot1ELO: 0,
            robot2ELO: 0,
            leagueType: '',
            battleType: 'tag_team',
            team1Name: context.team1Name,
            team2Name: context.team2Name,
          });
          narrativeEvents.push(...converted);
          phaseEvents = [];
          currentPhase++;
        }
        narrativeEvents.push(event);
        _phaseStarted = false;
        continue;
      }

      // Raw simulator event - accumulate for phase conversion
      phaseEvents.push(event as CombatEvent);
      _phaseStarted = true;
    }

    // Flush remaining phase events
    if (phaseEvents.length > 0 && currentPhase < context.phases.length) {
      const phase = context.phases[currentPhase];
      const converted = this.convertSimulatorEvents(phaseEvents, {
        robot1Name: phase.robot1Name,
        robot2Name: phase.robot2Name,
        robot1Stance: phase.robot1Stance,
        robot2Stance: phase.robot2Stance,
        robot1MaxHP: phase.robot1MaxHP,
        robot2MaxHP: phase.robot2MaxHP,
        robot1ELO: 0,
        robot2ELO: 0,
        leagueType: '',
        battleType: 'tag_team',
        team1Name: context.team1Name,
        team2Name: context.team2Name,
      });
      narrativeEvents.push(...converted);
    }

    return narrativeEvents;
  }

  // ══════════════════════════════════════════════════════════════════════
  // LEGACY: generateBattleLog - kept for backward compatibility
  // Now delegates to convertSimulatorEvents when real events are provided
  // ══════════════════════════════════════════════════════════════════════

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
    // New fields for real event conversion
    simulatorEvents?: CombatEvent[];
    robot1Stance?: string;
    robot2Stance?: string;
    robot1MaxHP?: number;
    robot2MaxHP?: number;
    battleType?: 'league' | 'tournament' | 'tag_team';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }): any[] {
    // If real simulator events are provided, convert them
    if (battleData.simulatorEvents && battleData.simulatorEvents.length > 0) {
      return this.convertSimulatorEvents(battleData.simulatorEvents, {
        robot1Name: battleData.robot1Name,
        robot2Name: battleData.robot2Name,
        robot1Stance: battleData.robot1Stance || 'balanced',
        robot2Stance: battleData.robot2Stance || 'balanced',
        robot1MaxHP: battleData.robot1MaxHP || battleData.winnerMaxHP,
        robot2MaxHP: battleData.robot2MaxHP || battleData.winnerMaxHP,
        robot1ELO: battleData.robot1ELOBefore,
        robot2ELO: battleData.robot2ELOBefore,
        leagueType: battleData.leagueType,
        battleType: battleData.battleType,
      });
    }

    // Fallback: generate minimal log without real events (bye matches, etc.)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const log: any[] = [];
    log.push({
      timestamp: 0.0,
      type: 'battle_start',
      message: this.generateBattleStart({
        robot1Name: battleData.robot1Name,
        robot2Name: battleData.robot2Name,
        robot1ELO: battleData.robot1ELOBefore,
        robot2ELO: battleData.robot2ELOBefore,
        leagueType: battleData.leagueType,
        battleType: battleData.battleType,
      }),
    });

    log.push({
      timestamp: battleData.durationSeconds,
      type: 'battle_end',
      message: this.generateBattleEnd({
        winnerName: battleData.winnerName,
        loserName: battleData.loserName,
        winnerHP: battleData.winnerFinalHP,
        winnerMaxHP: battleData.winnerMaxHP,
        reason: 'destruction',
      }),
    });

    return log;
  }
}
