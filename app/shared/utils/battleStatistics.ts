/**
 * Battle Statistics Computation — Shared Module
 *
 * Computes per-robot combat statistics from battle events. Used by:
 * - Frontend: BattleDetailPage (live computation for recent battles)
 * - Backend: BattleSummaryComputer (pre-computation at battle creation)
 *
 * This is the single source of truth for statistics computation.
 * No duplicate implementations should exist elsewhere in the codebase.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

/** Minimal event shape — works with both detailed simulator events and narrative events */
export interface BattleLogEvent {
  timestamp: number;
  type: string;
  message?: string;
  attacker?: string;
  defender?: string;
  weapon?: string;
  damage?: number;
  hpDamage?: number;
  shieldDamage?: number;
  hit?: boolean;
  hand?: string;
  formulaBreakdown?: { components?: Record<string, number> };
  robotShield?: Record<string, number>;
  [key: string]: unknown;
}

export interface HandStats {
  attacks: number;
  hits: number;
  misses: number;
  criticals: number;
  malfunctions: number;
}

export interface CounterStats {
  triggered: number;
  hits: number;
  misses: number;
  damageDealt: number;
}

export interface HitGrades {
  glancing: number;  // < 5% of defender maxHP
  solid: number;     // 5–15% of defender maxHP
  heavy: number;     // 15–30% of defender maxHP
  devastating: number; // > 30% of defender maxHP
}

export interface RobotCombatStats {
  robotName: string;
  mainHand: HandStats;
  offhand: HandStats | null;
  attacks: number;
  hits: number;
  misses: number;
  criticals: number;
  malfunctions: number;
  counters: CounterStats;
  countersReceived: number;
  shieldDamageAbsorbed: number;
  shieldRecharged: number;
  damageDealt: number;
  damageReceived: number;
  hpDamageDealt: number;
  hpDamageReceived: number;
  hitRate: number;
  critRate: number;
  malfunctionRate: number;
  expectedHitChance: number | null;
  expectedCritChance: number | null;
  expectedMalfunctionChance: number | null;
  expectedCounterChance: number | null;
  expectedCounterHitChance: number | null;
  expectedOffhandHitChance: number | null;
  expectedOffhandCritChance: number | null;
  expectedOffhandMalfunctionChance: number | null;
  hitGrades: HitGrades;
  activeDuration: number;
  firstAttackTime: number | null;
  exitTime: number | null;
  targetSwitches: number;
  uniqueTargets: number;
  targetDurations: Record<string, number>;
}

export interface TeamCombatStats {
  teamName: string;
  robots: RobotCombatStats[];
  totalDamageDealt: number;
  totalDamageReceived: number;
  totalHits: number;
  totalMisses: number;
  totalCriticals: number;
}

export interface DamageFlow {
  source: string;
  target: string;
  value: number;
}

export interface BattleStatistics {
  perRobot: RobotCombatStats[];
  perTeam: TeamCombatStats[] | null;
  damageFlows: DamageFlow[];
  battleDuration: number;
  totalEvents: number;
  hasData: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createHandStats(): HandStats {
  return { attacks: 0, hits: 0, misses: 0, criticals: 0, malfunctions: 0 };
}

function createCounterStats(): CounterStats {
  return { triggered: 0, hits: 0, misses: 0, damageDealt: 0 };
}

function createHitGrades(): HitGrades {
  return { glancing: 0, solid: 0, heavy: 0, devastating: 0 };
}

export function createRobotStats(robotName: string): RobotCombatStats {
  return {
    robotName,
    mainHand: createHandStats(),
    offhand: null,
    attacks: 0, hits: 0, misses: 0, criticals: 0, malfunctions: 0,
    counters: createCounterStats(),
    countersReceived: 0,
    shieldDamageAbsorbed: 0, shieldRecharged: 0,
    damageDealt: 0, damageReceived: 0, hpDamageDealt: 0, hpDamageReceived: 0,
    hitRate: 0, critRate: 0, malfunctionRate: 0,
    expectedHitChance: null, expectedCritChance: null, expectedMalfunctionChance: null,
    expectedCounterChance: null, expectedCounterHitChance: null,
    expectedOffhandHitChance: null, expectedOffhandCritChance: null, expectedOffhandMalfunctionChance: null,
    hitGrades: createHitGrades(),
    activeDuration: 0, firstAttackTime: null, exitTime: null,
    targetSwitches: 0, uniqueTargets: 0, targetDurations: {},
  };
}

function safeRate(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return (numerator / denominator) * 100;
}

function classifyHitGrade(
  damage: number, defenderName: string, robotMaxHP?: Record<string, number>,
): keyof HitGrades {
  if (!robotMaxHP || !(defenderName in robotMaxHP) || robotMaxHP[defenderName] <= 0) return 'solid';
  const ratio = damage / robotMaxHP[defenderName];
  if (ratio < 0.05) return 'glancing';
  if (ratio <= 0.15) return 'solid';
  if (ratio <= 0.30) return 'heavy';
  return 'devastating';
}

function getOrCreateRobot(map: Map<string, RobotCombatStats>, name: string): RobotCombatStats {
  let stats = map.get(name);
  if (!stats) { stats = createRobotStats(name); map.set(name, stats); }
  return stats;
}

function getHandStats(robot: RobotCombatStats, hand: string | undefined): HandStats {
  if (hand === 'offhand') {
    if (!robot.offhand) robot.offhand = createHandStats();
    return robot.offhand;
  }
  return robot.mainHand;
}

function isAttackTypeEvent(type: string): boolean {
  return type === 'attack' || type === 'critical' || type === 'miss' || type === 'malfunction';
}

// ─── Main Function ───────────────────────────────────────────────────────────

export function computeBattleStatistics(
  events: BattleLogEvent[],
  battleDuration: number,
  _battleType?: string,
  tagTeamInfo?: { team1Robots: string[]; team2Robots: string[] },
  robotMaxHP?: Record<string, number>,
): BattleStatistics {
  const robotMap = new Map<string, RobotCombatStats>();
  const damageFlowMap = new Map<string, number>();
  const chanceSums = new Map<string, { hitSum: number; critSum: number; malfSum: number; counterSum: number; counterCount: number; counterHitSum: number; counterHitCount: number; count: number }>();
  let prevShieldValues: Record<string, number> | null = null;
  const lastTarget = new Map<string, string>();
  const lastTargetTime = new Map<string, number>();
  const targetSets = new Map<string, Set<string>>();
  const targetDurAccum = new Map<string, Map<string, number>>();
  const entryTimes = new Map<string, number>();
  const tagInEvents: { ts: number; msg: string }[] = [];
  let hasAttackEvents = false;

  for (const event of events) {
    const type = event.type as string;

    // Track shield regen from robotShield deltas
    if (event.robotShield && typeof event.robotShield === 'object') {
      const currentShields = event.robotShield as Record<string, number>;
      if (prevShieldValues) {
        for (const robotName of Object.keys(currentShields)) {
          const delta = (currentShields[robotName] ?? 0) - (prevShieldValues[robotName] ?? 0);
          if (delta > 0) getOrCreateRobot(robotMap, robotName).shieldRecharged += delta;
        }
      }
      prevShieldValues = { ...currentShields };
    }

    // Process attack-type events
    if (isAttackTypeEvent(type)) {
      hasAttackEvents = true;
      const attackerName = event.attacker as string;
      const defenderName = event.defender as string;
      if (!attackerName || !defenderName) continue;

      const attacker = getOrCreateRobot(robotMap, attackerName);
      const defender = getOrCreateRobot(robotMap, defenderName);
      const hand = getHandStats(attacker, event.hand as string | undefined);
      const ts = Number(event.timestamp) || 0;

      hand.attacks++;
      attacker.attacks++;
      if (attacker.firstAttackTime === null) attacker.firstAttackTime = ts;

      // Target tracking
      const prevTgt = lastTarget.get(attackerName);
      const prevTime = lastTargetTime.get(attackerName);
      if (prevTgt !== undefined && prevTgt !== defenderName) {
        attacker.targetSwitches++;
        if (prevTime !== undefined) {
          let durMap = targetDurAccum.get(attackerName);
          if (!durMap) { durMap = new Map(); targetDurAccum.set(attackerName, durMap); }
          durMap.set(prevTgt, (durMap.get(prevTgt) ?? 0) + (ts - prevTime));
        }
        lastTargetTime.set(attackerName, ts);
      } else if (prevTgt === undefined) {
        lastTargetTime.set(attackerName, 0);
      }
      lastTarget.set(attackerName, defenderName);
      let tSet = targetSets.get(attackerName);
      if (!tSet) { tSet = new Set(); targetSets.set(attackerName, tSet); }
      tSet.add(defenderName);

      // Expected chances from formulaBreakdown
      const components = event.formulaBreakdown?.components;
      if (components) {
        const handKey = event.hand === 'offhand' ? `${attackerName}:offhand` : attackerName;
        let cs = chanceSums.get(handKey);
        if (!cs) { cs = { hitSum: 0, critSum: 0, malfSum: 0, counterSum: 0, counterCount: 0, counterHitSum: 0, counterHitCount: 0, count: 0 }; chanceSums.set(handKey, cs); }
        if (typeof components.hitChanceBase === 'number') cs.hitSum += components.hitChanceBase;
        else if (typeof components.hitChance === 'number') cs.hitSum += components.hitChance;
        if (typeof components.critChanceBase === 'number') cs.critSum += components.critChanceBase;
        else if (typeof components.critChance === 'number') cs.critSum += components.critChance;
        if (typeof components.malfunctionChance === 'number') cs.malfSum += components.malfunctionChance;
        cs.count++;
      }

      if (type === 'malfunction') { hand.malfunctions++; attacker.malfunctions++; }
      else if (type === 'miss' || (type === 'attack' && event.hit === false)) { hand.misses++; attacker.misses++; }
      else if (type === 'critical' || (type === 'attack' && event.hit === true)) {
        if (type === 'critical') { hand.criticals++; attacker.criticals++; }
        hand.hits++; attacker.hits++;
        const damage = Number(event.damage) || 0;
        const hpDmg = Number(event.hpDamage) || 0;
        attacker.damageDealt += damage; attacker.hpDamageDealt += hpDmg;
        defender.damageReceived += damage; defender.hpDamageReceived += hpDmg;
        attacker.hitGrades[classifyHitGrade(damage, defenderName, robotMaxHP)]++;
        const flowKey = `${attackerName}→${defenderName}`;
        damageFlowMap.set(flowKey, (damageFlowMap.get(flowKey) ?? 0) + damage);
        if (event.shieldDamage && Number(event.shieldDamage) > 0) {
          defender.shieldDamageAbsorbed += Number(event.shieldDamage);
        }
      }
    }

    // Process counter events
    if (type === 'counter') {
      hasAttackEvents = true;
      const counterAttackerName = event.attacker as string;
      const counterDefenderName = event.defender as string;
      if (!counterAttackerName || !counterDefenderName) continue;
      const counterAttacker = getOrCreateRobot(robotMap, counterAttackerName);
      const counterDefender = getOrCreateRobot(robotMap, counterDefenderName);
      counterAttacker.counters.triggered++;
      counterDefender.countersReceived++;

      const counterComponents = event.formulaBreakdown?.components;
      if (counterComponents && typeof counterComponents.counterChance === 'number') {
        let ccs = chanceSums.get(counterAttackerName);
        if (!ccs) { ccs = { hitSum: 0, critSum: 0, malfSum: 0, counterSum: 0, counterCount: 0, counterHitSum: 0, counterHitCount: 0, count: 0 }; chanceSums.set(counterAttackerName, ccs); }
        ccs.counterSum += counterComponents.counterChance; ccs.counterCount++;
        const chb = counterComponents.counterHitChanceBase ?? counterComponents.counterHitChance;
        if (typeof chb === 'number') { ccs.counterHitSum += chb; ccs.counterHitCount++; }
      }

      if (event.hit === true || event.hit === undefined) {
        counterAttacker.counters.hits++;
        const damage = Number(event.damage) || 0;
        const hpDmg = Number(event.hpDamage) || 0;
        counterAttacker.counters.damageDealt += damage;
        counterAttacker.damageDealt += damage; counterAttacker.hpDamageDealt += hpDmg;
        counterDefender.damageReceived += damage; counterDefender.hpDamageReceived += hpDmg;
        counterAttacker.hitGrades[classifyHitGrade(damage, counterDefenderName, robotMaxHP)]++;
        const flowKey = `${counterAttackerName}→${counterDefenderName}`;
        damageFlowMap.set(flowKey, (damageFlowMap.get(flowKey) ?? 0) + damage);
        if (event.shieldDamage && Number(event.shieldDamage) > 0) {
          counterDefender.shieldDamageAbsorbed += Number(event.shieldDamage);
        }
      } else { counterAttacker.counters.misses++; }
    }

    // Track destruction/yield/tag events
    if (type === 'destroyed' || type === 'yield') {
      const ts = Number(event.timestamp) || 0;
      const msg = (event.message as string) || '';
      for (const [name, robot] of robotMap.entries()) {
        if (robot.exitTime === null && msg.includes(name)) robot.exitTime = ts;
      }
    }
    if (type === 'tag_out') {
      const ts = Number(event.timestamp) || 0;
      const msg = (event.message as string) || '';
      for (const [name, robot] of robotMap.entries()) {
        if (robot.exitTime === null && msg.includes(name)) robot.exitTime = ts;
      }
    }
    if (type === 'tag_in') {
      tagInEvents.push({ ts: Number(event.timestamp) || 0, msg: (event.message as string) || '' });
    }
  }

  // Resolve tag-in entry times
  for (const { ts, msg } of tagInEvents) {
    for (const name of robotMap.keys()) {
      if (msg.includes(name)) entryTimes.set(name, ts);
    }
  }

  // Compute rates and finalize per-robot stats
  for (const robot of robotMap.values()) {
    robot.hitRate = Math.round(safeRate(robot.hits, robot.attacks) * 10) / 10;
    robot.critRate = Math.round(safeRate(robot.criticals, robot.hits) * 10) / 10;
    robot.malfunctionRate = Math.round(safeRate(robot.malfunctions, robot.attacks) * 10) / 10;

    const entry = entryTimes.get(robot.robotName) ?? 0;
    const exit = robot.exitTime ?? battleDuration;
    robot.activeDuration = Math.max(0, exit - entry);

    robot.uniqueTargets = targetSets.get(robot.robotName)?.size ?? 0;

    // Finalize target durations
    const lastTgt = lastTarget.get(robot.robotName);
    const lastTgtTime = lastTargetTime.get(robot.robotName);
    if (lastTgt !== undefined && lastTgtTime !== undefined) {
      const endTime = robot.exitTime ?? battleDuration;
      let durMap = targetDurAccum.get(robot.robotName);
      if (!durMap) { durMap = new Map(); targetDurAccum.set(robot.robotName, durMap); }
      durMap.set(lastTgt, (durMap.get(lastTgt) ?? 0) + Math.max(0, endTime - lastTgtTime));
    }
    const durMap = targetDurAccum.get(robot.robotName);
    if (durMap) {
      const rawSum = [...durMap.values()].reduce((a, b) => a + b, 0);
      const scale = rawSum > 0 ? robot.activeDuration / rawSum : 0;
      for (const [target, secs] of durMap.entries()) {
        robot.targetDurations[target] = Math.max(0, Math.round(secs * scale * 10) / 10);
      }
    }

    // Expected chances from formula breakdowns
    const cs = chanceSums.get(robot.robotName);
    if (cs && cs.count > 0) {
      robot.expectedHitChance = Math.round((cs.hitSum / cs.count) * 10) / 10;
      robot.expectedCritChance = Math.round((cs.critSum / cs.count) * 10) / 10;
      robot.expectedMalfunctionChance = Math.round((cs.malfSum / cs.count) * 10) / 10;
    }
    const offCs = chanceSums.get(`${robot.robotName}:offhand`);
    if (offCs && offCs.count > 0) {
      robot.expectedOffhandHitChance = Math.round((offCs.hitSum / offCs.count) * 10) / 10;
      robot.expectedOffhandCritChance = Math.round((offCs.critSum / offCs.count) * 10) / 10;
      robot.expectedOffhandMalfunctionChance = Math.round((offCs.malfSum / offCs.count) * 10) / 10;
    }
    if (cs && cs.counterCount > 0) robot.expectedCounterChance = Math.round((cs.counterSum / cs.counterCount) * 10) / 10;
    if (cs && cs.counterHitCount > 0) robot.expectedCounterHitChance = Math.round((cs.counterHitSum / cs.counterHitCount) * 10) / 10;

    // Round accumulated values
    robot.damageDealt = Math.round(robot.damageDealt);
    robot.damageReceived = Math.round(robot.damageReceived);
    robot.hpDamageDealt = Math.round(robot.hpDamageDealt);
    robot.hpDamageReceived = Math.round(robot.hpDamageReceived);
    robot.shieldDamageAbsorbed = Math.round(robot.shieldDamageAbsorbed);
    robot.shieldRecharged = Math.round(robot.shieldRecharged);
    robot.counters.damageDealt = Math.round(robot.counters.damageDealt);
  }

  // Build damage flows
  const damageFlows: DamageFlow[] = [];
  for (const [key, value] of damageFlowMap.entries()) {
    if (value > 0) {
      const [source, target] = key.split('→');
      damageFlows.push({ source, target, value: Math.round(value) });
    }
  }

  const perRobot = Array.from(robotMap.values());

  // Build team aggregates
  let perTeam: TeamCombatStats[] | null = null;
  if (tagTeamInfo) {
    const buildTeam = (teamName: string, robotNames: string[]): TeamCombatStats => {
      const robots = robotNames
        .map(name => robotMap.get(name))
        .filter((r): r is RobotCombatStats => r !== undefined);
      return {
        teamName, robots,
        totalDamageDealt: robots.reduce((sum, r) => sum + r.damageDealt, 0),
        totalDamageReceived: robots.reduce((sum, r) => sum + r.damageReceived, 0),
        totalHits: robots.reduce((sum, r) => sum + r.hits, 0),
        totalMisses: robots.reduce((sum, r) => sum + r.misses, 0),
        totalCriticals: robots.reduce((sum, r) => sum + r.criticals, 0),
      };
    };
    perTeam = [
      buildTeam('Team 1', tagTeamInfo.team1Robots),
      buildTeam('Team 2', tagTeamInfo.team2Robots),
    ];
  }

  return { perRobot, perTeam, damageFlows, battleDuration, totalEvents: events.length, hasData: hasAttackEvents };
}
