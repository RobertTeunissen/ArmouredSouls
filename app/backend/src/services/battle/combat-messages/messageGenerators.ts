/**
 * Combat Message Generators
 * Pure functions that select a template and interpolate values.
 * No state, no event conversion logic.
 */

import {
  BattleStartEvent,
  AttackEvent,
  BattleEndEvent,
  ELOChangeEvent,
  RewardEvent,
  TagOutEvent,
  TagInEvent,
} from '../combatMessageGenerator';
import * as T from './messageTemplates';

// ── Utility Functions ────────────────────────────────────────────────────

export function interpolate(template: string, values: object): string {
  const record = values as Record<string, unknown>;
  return template.replace(/{(\w+)}/g, (match, key) => {
    const val = record[key];
    if (val === undefined) return match;
    if (typeof val === 'number') return Math.round(val).toLocaleString('en-US');
    return String(val);
  });
}

export function selectRandom<V>(messages: V[]): V {
  return messages[Math.floor(Math.random() * messages.length)];
}

export function getDamageDescriptor(damage: number, maxHP: number = 100): string {
  const percentage = (damage / maxHP) * 100;
  if (percentage >= 25) return 'a devastating blow';
  if (percentage >= 15) return 'a heavy strike';
  if (percentage >= 10) return 'a solid hit';
  if (percentage >= 5) return 'a moderate impact';
  if (percentage >= 2) return 'a glancing blow';
  return 'a minor scratch';
}

export function getHPDescriptor(currentHP: number, maxHP: number): string {
  const percent = (currentHP / maxHP) * 100;
  if (percent >= 90) return 'nearly full hull integrity';
  if (percent >= 70) return 'strong hull integrity';
  if (percent >= 50) return 'moderate hull integrity';
  if (percent >= 30) return 'weakened hull integrity';
  if (percent >= 15) return 'critical hull integrity';
  return 'minimal hull integrity';
}

/**
 * Get a damage status message based on HP percentage thresholds.
 * Returns null if HP > 75% (no status message needed).
 */
export function getDamageStatusMessage(robotName: string, currentHP: number, maxHP: number): string | null {
  const percentage = Math.round((currentHP / maxHP) * 100);
  if (percentage <= 25) {
    return interpolate(selectRandom(T.heavyDamageMessages), { robotName, percentage });
  }
  if (percentage <= 50) {
    return interpolate(selectRandom(T.moderateDamageMessages), { robotName, percentage });
  }
  if (percentage <= 75) {
    return interpolate(selectRandom(T.lightDamageMessages), { robotName, percentage });
  }
  return null;
}

// ── Individual Message Generators ────────────────────────────────────────

export function generateBattleStart(event: BattleStartEvent & {
  battleType?: 'league_1v1' | 'tournament_1v1' | 'tag_team' | 'koth';
  team1Name?: string;
  team2Name?: string;
  robot3Name?: string;
  robot4Name?: string;
}): string {
  let messages: string[];
  switch (event.battleType) {
    case 'tournament_1v1':
      messages = T.battleStartMessagesTournament;
      break;
    case 'tag_team':
      messages = T.battleStartMessagesTagTeam;
      break;
    case 'league_1v1':
      messages = T.battleStartMessagesLeague;
      break;
    default:
      messages = T.battleStartMessagesGeneric;
      break;
  }
  const template = selectRandom(messages);
  return interpolate(template, event);
}

export function generateStance(robotName: string, stance: string): string {
  const stanceKey = stance.toLowerCase();
  const messages = T.stanceMessages[stanceKey] || T.stanceMessages.balanced;
  return interpolate(selectRandom(messages), { robotName });
}

export function generateAttack(event: AttackEvent): string {
  let template: string;

  if (event.malfunction) {
    template = selectRandom(T.malfunctionMessages);
    return interpolate(template, { robotName: event.attackerName, weaponName: event.weaponName });
  }

  if (!event.hit) {
    template = selectRandom(T.missMessages);
  } else if (event.critical) {
    template = selectRandom(T.criticalHitMessages);
  } else if (event.shieldDamage && event.shieldDamage > 0 && (!event.hpDamage || event.hpDamage === 0)) {
    template = selectRandom(T.shieldAbsorbMessages);
  } else {
    template = selectRandom(T.hitMessages);
  }

  const effectiveDamage = event.hpDamage || event.damage;
  const damageDescriptor = getDamageDescriptor(effectiveDamage);

  return interpolate(template, { ...event, damageDescriptor });
}

export function generateCounter(defenderName: string, attackerName: string, weaponName: string, damage: number, maxHP: number): string {
  const damageDescriptor = getDamageDescriptor(damage, maxHP);
  const template = selectRandom(T.counterSuccessMessages);
  return interpolate(template, { defenderName, attackerName, weaponName, damageDescriptor });
}

export function generateCounterMiss(defenderName: string, attackerName: string, weaponName: string): string {
  const template = selectRandom(T.counterMissMessages);
  return interpolate(template, { defenderName, attackerName, weaponName });
}

export function generateBattleEnd(event: BattleEndEvent): string {
  const hpPercent = Math.round((event.winnerHP / event.winnerMaxHP) * 100);
  const hpDescriptor = getHPDescriptor(event.winnerHP, event.winnerMaxHP);
  let template: string;
  if (hpPercent > 80) {
    template = selectRandom(T.dominantVictoryMessages);
  } else if (hpPercent < 30) {
    template = selectRandom(T.closeVictoryMessages);
  } else {
    template = selectRandom(T.victoryMessages);
  }
  return interpolate(template, { ...event, hpDescriptor });
}

export function generateELOChange(event: ELOChangeEvent): string {
  const template = event.change > 0
    ? selectRandom(T.eloGainMessages)
    : selectRandom(T.eloLossMessages);
  return interpolate(template, { ...event, change: Math.abs(event.change) });
}

export function generateShieldBreak(robotName: string): string {
  return interpolate(selectRandom(T.shieldBreakMessages), { robotName });
}

export function generateShieldRegen(robotName: string): string {
  return interpolate(selectRandom(T.shieldRegenMessages), { robotName });
}

export function generateYield(robotName: string, winnerName: string): string {
  return interpolate(selectRandom(T.yieldMessages), { robotName, winnerName });
}

export function generateDestruction(robotName: string): string {
  return interpolate(selectRandom(T.destructionMessages), { robotName });
}

export function generateDraw(): string {
  return selectRandom(T.drawMessages);
}

export function generateReward(event: RewardEvent): string {
  return interpolate(selectRandom(T.rewardMessages), event);
}

export function generatePrestige(robotName: string, prestige: number): string {
  return interpolate(selectRandom(T.prestigeMessages), { robotName, prestige });
}

export function generateFame(robotName: string, fame: number): string {
  return interpolate(selectRandom(T.fameMessages), { robotName, fame });
}

export function generateTagOutYield(event: TagOutEvent): string {
  return interpolate(selectRandom(T.tagOutYieldMessages), event);
}

export function generateTagOutDestruction(event: TagOutEvent): string {
  return interpolate(selectRandom(T.tagOutDestructionMessages), event);
}

export function generateTagOut(event: TagOutEvent): string {
  return event.reason === 'yield' ? generateTagOutYield(event) : generateTagOutDestruction(event);
}

export function generateTagIn(event: TagInEvent): string {
  return interpolate(selectRandom(T.tagInMessages), event);
}

// ── Spatial Event Generators ─────────────────────────────────────────

export function generateMovement(robotName: string, targetName: string, distance: number): string {
  const template = selectRandom(T.movementMessages);
  return interpolate(template, { robotName, targetName, distance });
}

export function generateRangeTransition(robotName: string, targetName: string, rangeBand: string): string {
  const template = selectRandom(T.rangeTransitionMessages);
  return interpolate(template, { robotName, targetName, rangeBand });
}

export function generateOutOfRange(robotName: string, weaponName: string, targetName: string, distance: number): string {
  const template = selectRandom(T.outOfRangeMessages);
  return interpolate(template, { robotName, weaponName, targetName, distance });
}

export function generateCounterOutOfRange(robotName: string, weaponName: string, targetName: string): string {
  const template = selectRandom(T.counterOutOfRangeMessages);
  return interpolate(template, { robotName, weaponName, targetName });
}

export function generateBackstab(attackerName: string, defenderName: string): string {
  const template = selectRandom(T.backstabMessages);
  return interpolate(template, { attackerName, defenderName });
}

export function generateFlanking(attackerName: string, defenderName: string): string {
  const template = selectRandom(T.flankingMessages);
  return interpolate(template, { attackerName, defenderName });
}

// ── KotH Event Generators ────────────────────────────────────────────

export function generateKothZoneEnter(robotName: string, zoneState?: string): string {
  if (zoneState === 'contested') {
    return interpolate(selectRandom(T.kothZoneEnterContestedMessages), { robotName });
  }
  if (zoneState === 'uncontested') {
    return interpolate(selectRandom(T.kothZoneEnterUncontestedMessages), { robotName });
  }
  return interpolate(selectRandom(T.kothZoneEnterMessages), { robotName });
}

export function generateKothZoneExit(robotName: string, forced = false): string {
  const messages = forced ? T.kothZoneExitForcedMessages : T.kothZoneExitMessages;
  return interpolate(selectRandom(messages), { robotName });
}

export function generateKothScoreTick(robotName: string, score: number, contested: boolean): string {
  if (contested) {
    return selectRandom(T.kothScoreTickContestedMessages);
  }
  return interpolate(selectRandom(T.kothScoreTickUncontestedMessages), { robotName, score });
}

export function generateKothKillBonus(killerName: string, victimName: string, bonus: number): string {
  return interpolate(selectRandom(T.kothKillBonusMessages), { killerName, victimName, bonus });
}

export function generateKothEliminated(robotName: string, reason: 'destroyed' | 'yielded', score: number, placement?: number): string {
  const messages = reason === 'destroyed' ? T.kothEliminatedDestroyedMessages : T.kothEliminatedYieldedMessages;
  return interpolate(selectRandom(messages), { robotName, score, placement: placement ?? '?' });
}

export function generateKothPassiveWarning(robotName: string): string {
  return interpolate(selectRandom(T.kothPassiveWarningMessages), { robotName });
}

export function generateKothPassivePenalty(robotName: string, damageReduction: number, accuracyPenalty: number): string {
  if (accuracyPenalty > 0) {
    return interpolate(selectRandom(T.kothPassivePenaltyAccuracyMessages), { robotName });
  }
  const penalty = Math.round(damageReduction * 100);
  return interpolate(selectRandom(T.kothPassivePenaltyDamageMessages), { robotName, penalty });
}

export function generateKothZoneMoving(countdown: number): string {
  return interpolate(selectRandom(T.kothZoneMovingMessages), { countdown });
}

export function generateKothZoneActive(): string {
  return selectRandom(T.kothZoneActiveMessages);
}

export function generateKothLastStanding(robotName: string): string {
  return interpolate(selectRandom(T.kothLastStandingMessages), { robotName });
}

export function generateKothMatchEnd(winnerName: string, score: number, reason: string): string {
  let messages: string[];
  switch (reason) {
    case 'score_threshold':
      messages = T.kothMatchEndScoreMessages;
      break;
    case 'last_standing':
      messages = T.kothMatchEndLastStandingMessages;
      break;
    case 'time_limit':
    default:
      messages = T.kothMatchEndTimeMessages;
      break;
  }
  return interpolate(selectRandom(messages), { winnerName, score });
}
