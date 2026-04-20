import type { BattleLogEvent } from './matchmakingApi';

// ─── Interfaces ──────────────────────────────────────────────────────────────

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
  // Aggregate attack stats (main + offhand combined)
  attacks: number;
  hits: number;
  misses: number;
  criticals: number;
  malfunctions: number;
  // Counter-attack stats (this robot as counter-attacker)
  counters: CounterStats;
  // Counter-attacks received (this robot was countered)
  countersReceived: number;
  // Shield stats
  shieldDamageAbsorbed: number;
  shieldRecharged: number;
  // Damage totals
  damageDealt: number;       // total damage dealt (shield + HP)
  damageReceived: number;    // total damage received (shield + HP)
  hpDamageDealt: number;     // damage that got through shields
  hpDamageReceived: number;  // HP damage taken (after shield absorption)
  // Rates (actual outcomes)
  hitRate: number;
  critRate: number;
  malfunctionRate: number;
  // Expected chances (average from formula breakdowns, excluding variance)
  expectedHitChance: number | null;
  expectedCritChance: number | null;
  expectedMalfunctionChance: number | null;
  expectedCounterChance: number | null;
  expectedCounterHitChance: number | null;
  expectedOffhandHitChance: number | null;
  expectedOffhandCritChance: number | null;
  expectedOffhandMalfunctionChance: number | null;
  // Hit severity breakdown
  hitGrades: HitGrades;
  // Active combat time — how long this robot was actually fighting
  activeDuration: number;    // seconds from first attack to destruction/yield/battle end
  firstAttackTime: number | null;  // timestamp of first attack event
  exitTime: number | null;         // timestamp of destruction/yield (null = survived)
  // Target tracking (KotH / multi-robot)
  targetSwitches: number;    // how many times this robot changed target
  uniqueTargets: number;     // how many distinct robots this robot attacked
  /** Time spent targeting each robot, in seconds. Key = defender name, value = seconds. */
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
    attacks: 0,
    hits: 0,
    misses: 0,
    criticals: 0,
    malfunctions: 0,
    counters: createCounterStats(),
    countersReceived: 0,
    shieldDamageAbsorbed: 0,
    shieldRecharged: 0,
    damageDealt: 0,
    damageReceived: 0,
    hpDamageDealt: 0,
    hpDamageReceived: 0,
    hitRate: 0,
    critRate: 0,
    malfunctionRate: 0,
    expectedHitChance: null,
    expectedCritChance: null,
    expectedMalfunctionChance: null,
    expectedCounterChance: null,
    expectedCounterHitChance: null,
    expectedOffhandHitChance: null,
    expectedOffhandCritChance: null,
    expectedOffhandMalfunctionChance: null,
    hitGrades: createHitGrades(),
    activeDuration: 0,
    firstAttackTime: null,
    exitTime: null,
    targetSwitches: 0,
    uniqueTargets: 0,
    targetDurations: {},
  };
}

function safeRate(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return (numerator / denominator) * 100;
}

function classifyHitGrade(
  damage: number,
  defenderName: string,
  robotMaxHP?: Record<string, number>,
): keyof HitGrades {
  if (!robotMaxHP || !(defenderName in robotMaxHP) || robotMaxHP[defenderName] <= 0) {
    return 'solid'; // safe default when maxHP unavailable
  }
  const maxHP = robotMaxHP[defenderName];
  const ratio = damage / maxHP;
  if (ratio < 0.05) return 'glancing';
  if (ratio <= 0.15) return 'solid';
  if (ratio <= 0.30) return 'heavy';
  return 'devastating';
}

function getOrCreateRobot(
  map: Map<string, RobotCombatStats>,
  name: string,
): RobotCombatStats {
  let stats = map.get(name);
  if (!stats) {
    stats = createRobotStats(name);
    map.set(name, stats);
  }
  return stats;
}

function getHandStats(robot: RobotCombatStats, hand: string | undefined): HandStats {
  if (hand === 'offhand') {
    if (!robot.offhand) {
      robot.offhand = createHandStats();
    }
    return robot.offhand;
  }
  return robot.mainHand;
}

/** Check if an event is an attack-type event that counts toward attack stats */
function isAttackTypeEvent(type: string): boolean {
  return type === 'attack' || type === 'critical' || type === 'miss' || type === 'malfunction';
}

// ─── Main Function ───────────────────────────────────────────────────────────

export function computeBattleStatistics(
  events: BattleLogEvent[],
  battleDuration: number,
  battleType?: string,
  tagTeamInfo?: { team1Robots: string[]; team2Robots: string[] },
  robotMaxHP?: Record<string, number>,
): BattleStatistics {
  const robotMap = new Map<string, RobotCombatStats>();
  const damageFlowMap = new Map<string, number>(); // "source→target" → total damage

  // Track expected chances per robot for averaging
  const chanceSums = new Map<string, { hitSum: number; critSum: number; malfSum: number; counterSum: number; counterCount: number; counterHitSum: number; counterHitCount: number; count: number }>();

  // Track shield values for computing shield regen from deltas
  let prevShieldValues: Record<string, number> | null = null;

  // Track target switching per robot: last target name and when it was acquired
  const lastTarget = new Map<string, string>();
  const lastTargetTime = new Map<string, number>();
  const targetSets = new Map<string, Set<string>>();
  /** Accumulated time per attacker→defender pair */
  const targetDurAccum = new Map<string, Map<string, number>>();

  /** Entry time per robot — 0 for robots in from the start, tag-in timestamp for reserves */
  const entryTimes = new Map<string, number>();
  /** Raw tag-in events to resolve after all robot names are known */
  const tagInEvents: { ts: number; msg: string }[] = [];

  let hasAttackEvents = false;

  for (const event of events) {
    const type = event.type as string;

    // Track shield regen from robotShield deltas
    if (event.robotShield && typeof event.robotShield === 'object') {
      const currentShields = event.robotShield as Record<string, number>;
      if (prevShieldValues) {
        for (const robotName of Object.keys(currentShields)) {
          const prev = prevShieldValues[robotName] ?? 0;
          const curr = currentShields[robotName] ?? 0;
          const delta = curr - prev;
          if (delta > 0) {
            const robot = getOrCreateRobot(robotMap, robotName);
            robot.shieldRecharged += delta;
          }
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

      hand.attacks++;
      attacker.attacks++;

      // Track first attack time for active duration calculation
      const ts = Number(event.timestamp) || 0;
      if (attacker.firstAttackTime === null) attacker.firstAttackTime = ts;

      // Track target switching and durations
      const prevTarget = lastTarget.get(attackerName);
      const prevTime = lastTargetTime.get(attackerName);
      if (prevTarget !== undefined && prevTarget !== defenderName) {
        attacker.targetSwitches++;
        // Close out duration for previous target
        if (prevTime !== undefined) {
          let durMap = targetDurAccum.get(attackerName);
          if (!durMap) { durMap = new Map(); targetDurAccum.set(attackerName, durMap); }
          durMap.set(prevTarget, (durMap.get(prevTarget) ?? 0) + (ts - prevTime));
        }
        lastTargetTime.set(attackerName, ts);
      } else if (prevTarget === undefined) {
        // First target acquired — count from battle start (time 0), not first attack
        lastTargetTime.set(attackerName, 0);
      }
      lastTarget.set(attackerName, defenderName);
      let tSet = targetSets.get(attackerName);
      if (!tSet) { tSet = new Set(); targetSets.set(attackerName, tSet); }
      tSet.add(defenderName);

      // Extract expected chances from formulaBreakdown if available
      // Use base values (without random variance, without spatial modifiers)
      // These are constant per robot pair per hand, so we only need one sample
      const components = event.formulaBreakdown?.components as Record<string, number> | undefined;
      const eventHand = event.hand as string | undefined;
      if (components) {
        const handKey = eventHand === 'offhand' ? `${attackerName}:offhand` : attackerName;
        let cs = chanceSums.get(handKey);
        if (!cs) {
          cs = { hitSum: 0, critSum: 0, malfSum: 0, counterSum: 0, counterCount: 0, counterHitSum: 0, counterHitCount: 0, count: 0 };
          chanceSums.set(handKey, cs);
        }
        // Prefer base values (without variance); fall back to final values for old battle data
        if (typeof components.hitChanceBase === 'number') cs.hitSum += components.hitChanceBase;
        else if (typeof components.hitChance === 'number') cs.hitSum += components.hitChance;
        if (typeof components.critChanceBase === 'number') cs.critSum += components.critChanceBase;
        else if (typeof components.critChance === 'number') cs.critSum += components.critChance;
        if (typeof components.malfunctionChance === 'number') cs.malfSum += components.malfunctionChance;
        cs.count++;
      }

      if (type === 'malfunction') {
        hand.malfunctions++;
        attacker.malfunctions++;
      } else if (type === 'critical') {
        // Critical always counts as a hit
        hand.criticals++;
        hand.hits++;
        attacker.criticals++;
        attacker.hits++;

        const damage = Number(event.damage) || 0;
        const hpDmg = Number(event.hpDamage) || 0;
        attacker.damageDealt += damage;
        attacker.hpDamageDealt += hpDmg;
        defender.damageReceived += damage;
        defender.hpDamageReceived += hpDmg;

        // Hit grade classification
        const grade = classifyHitGrade(damage, defenderName, robotMaxHP);
        attacker.hitGrades[grade]++;

        // Damage flow
        const flowKey = `${attackerName}→${defenderName}`;
        damageFlowMap.set(flowKey, (damageFlowMap.get(flowKey) ?? 0) + damage);

        // Shield damage absorbed
        if (event.shieldDamage && Number(event.shieldDamage) > 0) {
          defender.shieldDamageAbsorbed += Number(event.shieldDamage);
        }
      } else if (type === 'miss' || (type === 'attack' && event.hit === false)) {
        hand.misses++;
        attacker.misses++;
      } else if (type === 'attack' && event.hit === true) {
        hand.hits++;
        attacker.hits++;

        const damage = Number(event.damage) || 0;
        const hpDmg2 = Number(event.hpDamage) || 0;
        attacker.damageDealt += damage;
        attacker.hpDamageDealt += hpDmg2;
        defender.damageReceived += damage;
        defender.hpDamageReceived += hpDmg2;

        // Hit grade classification
        const grade = classifyHitGrade(damage, defenderName, robotMaxHP);
        attacker.hitGrades[grade]++;

        // Damage flow
        const flowKey = `${attackerName}→${defenderName}`;
        damageFlowMap.set(flowKey, (damageFlowMap.get(flowKey) ?? 0) + damage);

        // Shield damage absorbed
        if (event.shieldDamage && Number(event.shieldDamage) > 0) {
          defender.shieldDamageAbsorbed += Number(event.shieldDamage);
        }
      }
    }

    // Process counter events — role reversal: attacker is the counter-attacker (original defender)
    if (type === 'counter') {
      hasAttackEvents = true;
      const counterAttackerName = event.attacker as string;
      const counterDefenderName = event.defender as string;
      if (!counterAttackerName || !counterDefenderName) continue;

      const counterAttacker = getOrCreateRobot(robotMap, counterAttackerName);
      const counterDefender = getOrCreateRobot(robotMap, counterDefenderName);

      counterAttacker.counters.triggered++;
      counterDefender.countersReceived++;

      // Extract expected counter chance from formulaBreakdown
      const counterComponents = event.formulaBreakdown?.components as Record<string, number> | undefined;
      if (counterComponents && typeof counterComponents.counterChance === 'number') {
        let ccs = chanceSums.get(counterAttackerName);
        if (!ccs) { ccs = { hitSum: 0, critSum: 0, malfSum: 0, counterSum: 0, counterCount: 0, counterHitSum: 0, counterHitCount: 0, count: 0 }; chanceSums.set(counterAttackerName, ccs); }
        ccs.counterSum = (ccs.counterSum ?? 0) + counterComponents.counterChance;
        ccs.counterCount = (ccs.counterCount ?? 0) + 1;
        // Use base counter hit chance (without variance) if available
        const counterHitBase = counterComponents.counterHitChanceBase ?? counterComponents.counterHitChance;
        if (typeof counterHitBase === 'number') {
          ccs.counterHitSum = (ccs.counterHitSum ?? 0) + counterHitBase;
          ccs.counterHitCount = (ccs.counterHitCount ?? 0) + 1;
        }
      }

      if (event.hit === true || event.hit === undefined) {
        // Counter hit (default to hit if hit field is missing)
        counterAttacker.counters.hits++;

        const damage = Number(event.damage) || 0;
        const hpDmgCounter = Number(event.hpDamage) || 0;
        counterAttacker.counters.damageDealt += damage;
        counterAttacker.damageDealt += damage;
        counterAttacker.hpDamageDealt += hpDmgCounter;
        counterDefender.damageReceived += damage;
        counterDefender.hpDamageReceived += hpDmgCounter;

        // Hit grade classification for counter hits
        const grade = classifyHitGrade(damage, counterDefenderName, robotMaxHP);
        counterAttacker.hitGrades[grade]++;

        // Damage flow
        const flowKey = `${counterAttackerName}→${counterDefenderName}`;
        damageFlowMap.set(flowKey, (damageFlowMap.get(flowKey) ?? 0) + damage);

        // Shield damage absorbed
        if (event.shieldDamage && Number(event.shieldDamage) > 0) {
          counterDefender.shieldDamageAbsorbed += Number(event.shieldDamage);
        }
      } else {
        // Counter miss
        counterAttacker.counters.misses++;
      }
    }

    // Track destruction/yield events for active combat duration
    if (type === 'destroyed' || type === 'yield') {
      const ts = Number(event.timestamp) || 0;
      for (const [name, robot] of robotMap.entries()) {
        if (robot.exitTime === null && event.message && (event.message as string).includes(name)) {
          const msg = event.message as string;
          if (type === 'destroyed' && msg.includes(`${name} destroyed`)) {
            robot.exitTime = ts;
          } else if (type === 'yield' && msg.includes(`${name} yields`)) {
            robot.exitTime = ts;
          }
        }
      }
    }

    // Track tag-out events — the tagged-out robot stops fighting at this timestamp
    if (type === 'tag_out') {
      const ts = Number(event.timestamp) || 0;
      const msg = (event.message as string) || '';
      for (const [name, robot] of robotMap.entries()) {
        if (robot.exitTime === null && msg.includes(name)) {
          robot.exitTime = ts;
        }
      }
    }

    // Track tag-in events — the reserve robot enters the fight at this timestamp
    if (type === 'tag_in') {
      const ts = Number(event.timestamp) || 0;
      const msg = (event.message as string) || '';
      // Store raw tag-in events — resolved against robot names after all events processed
      tagInEvents.push({ ts, msg });
    }
  }

  // Compute rates for each robot
  // Resolve tag-in events against known robot names to set entry times
  for (const { ts, msg } of tagInEvents) {
    for (const name of robotMap.keys()) {
      if (msg.includes(name)) {
        entryTimes.set(name, ts);
      }
    }
  }

  // Compute rates and round accumulated floating-point values for each robot
  for (const robot of robotMap.values()) {
    robot.hitRate = safeRate(robot.hits, robot.attacks);
    robot.critRate = safeRate(robot.criticals, robot.hits);
    robot.malfunctionRate = safeRate(robot.malfunctions, robot.attacks);

    // Compute active combat duration:
    // - From entry time (0 for starters, tag-in time for reserves) to exit time (or battle end)
    const entry = entryTimes.get(robot.robotName) ?? 0;
    const exit = robot.exitTime ?? battleDuration;
    robot.activeDuration = Math.max(0, exit - entry);

    // Compute target tracking stats
    const tSet = targetSets.get(robot.robotName);
    robot.uniqueTargets = tSet?.size ?? 0;

    // Finalize target durations: close out the last target segment
    const lastTgt = lastTarget.get(robot.robotName);
    const lastTgtTime = lastTargetTime.get(robot.robotName);
    if (lastTgt !== undefined && lastTgtTime !== undefined) {
      const endTime = robot.exitTime ?? battleDuration;
      let durMap = targetDurAccum.get(robot.robotName);
      if (!durMap) { durMap = new Map(); targetDurAccum.set(robot.robotName, durMap); }
      durMap.set(lastTgt, (durMap.get(lastTgt) ?? 0) + Math.max(0, endTime - lastTgtTime));
    }
    // Copy to robot stats, rounded to 1 decimal.
    // Normalize so target durations sum to activeDuration.
    const durMap = targetDurAccum.get(robot.robotName);
    if (durMap) {
      const rawSum = [...durMap.values()].reduce((a, b) => a + b, 0);
      const scale = rawSum > 0 ? robot.activeDuration / rawSum : 0;
      for (const [target, secs] of durMap.entries()) {
        robot.targetDurations[target] = Math.max(0, Math.round(secs * scale * 10) / 10);
      }
    }

    // Compute average expected chances from formula breakdowns (main hand)
    const cs = chanceSums.get(robot.robotName);
    if (cs && cs.count > 0) {
      robot.expectedHitChance = Math.round((cs.hitSum / cs.count) * 10) / 10;
      robot.expectedCritChance = Math.round((cs.critSum / cs.count) * 10) / 10;
      robot.expectedMalfunctionChance = Math.round((cs.malfSum / cs.count) * 10) / 10;
    }
    // Offhand expected chances (separate key)
    const offCs = chanceSums.get(`${robot.robotName}:offhand`);
    if (offCs && offCs.count > 0) {
      robot.expectedOffhandHitChance = Math.round((offCs.hitSum / offCs.count) * 10) / 10;
      robot.expectedOffhandCritChance = Math.round((offCs.critSum / offCs.count) * 10) / 10;
      robot.expectedOffhandMalfunctionChance = Math.round((offCs.malfSum / offCs.count) * 10) / 10;
    }
    if (cs && cs.counterCount > 0) {
      robot.expectedCounterChance = Math.round((cs.counterSum / cs.counterCount) * 10) / 10;
    }
    if (cs && cs.counterHitCount > 0) {
      robot.expectedCounterHitChance = Math.round((cs.counterHitSum / cs.counterHitCount) * 10) / 10;
    }

    // Round accumulated damage/shield values to avoid floating-point display noise
    robot.damageDealt = Math.round(robot.damageDealt);
    robot.damageReceived = Math.round(robot.damageReceived);
    robot.hpDamageDealt = Math.round(robot.hpDamageDealt);
    robot.hpDamageReceived = Math.round(robot.hpDamageReceived);
    robot.shieldDamageAbsorbed = Math.round(robot.shieldDamageAbsorbed);
    robot.shieldRecharged = Math.round(robot.shieldRecharged);
    robot.counters.damageDealt = Math.round(robot.counters.damageDealt);
  }

  // Build damage flows array with rounded values
  const damageFlows: DamageFlow[] = [];
  for (const [key, value] of damageFlowMap.entries()) {
    if (value > 0) {
      const [source, target] = key.split('→');
      damageFlows.push({ source, target, value: Math.round(value) });
    }
  }

  const perRobot = Array.from(robotMap.values());

  // Build team aggregates for tag_team battles
  let perTeam: TeamCombatStats[] | null = null;
  if (battleType === 'tag_team' && tagTeamInfo) {
    const buildTeam = (teamName: string, robotNames: string[]): TeamCombatStats => {
      const robots = robotNames
        .map((name) => robotMap.get(name))
        .filter((r): r is RobotCombatStats => r !== undefined);
      return {
        teamName,
        robots,
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

  return {
    perRobot,
    perTeam,
    damageFlows,
    battleDuration,
    totalEvents: events.length,
    hasData: hasAttackEvents,
  };
}
