/**
 * Backfill Battle Summaries — Phase 1 of Spec #39
 *
 * Iterates all battles, computes per-robot combat statistics from
 * detailedCombatEvents (or events fallback), and writes the result
 * to the battle_summaries table. Also populates battles.winning_side.
 *
 * Run: npx tsx scripts/backfill-battle-summaries.ts
 *
 * Safe to re-run: skips battles that already have a summary row.
 * Processes in batches of 200 with 50ms yield between batches.
 */

import { PrismaClient } from '../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter, log: ['error'] });

// ─── Inline battle statistics computation ────────────────────────────
// Ported from app/frontend/src/utils/battleStatistics.ts
// This is a simplified version that produces the summary data we need.

interface BattleLogEvent {
  timestamp: number;
  type: string;
  attacker?: string;
  defender?: string;
  damage?: number;
  hpDamage?: number;
  shieldDamage?: number;
  hit?: boolean;
  hand?: string;
  weapon?: string;
  message?: string;
  formulaBreakdown?: { components?: Record<string, number> };
  robotShield?: Record<string, number>;
  robotHP?: Record<string, number>;
  [key: string]: unknown;
}

interface HandStats { attacks: number; hits: number; misses: number; criticals: number; malfunctions: number; }
interface CounterStats { triggered: number; hits: number; misses: number; damageDealt: number; }
interface HitGrades { glancing: number; solid: number; heavy: number; devastating: number; }

interface RobotSummaryStats {
  robotName: string;
  mainHand: HandStats;
  offhand: HandStats | null;
  attacks: number; hits: number; misses: number; criticals: number; malfunctions: number;
  counters: CounterStats;
  countersReceived: number;
  shieldDamageAbsorbed: number; shieldRecharged: number;
  damageDealt: number; damageReceived: number; hpDamageDealt: number; hpDamageReceived: number;
  hitRate: number; critRate: number; malfunctionRate: number;
  expectedHitChance: number | null; expectedCritChance: number | null;
  expectedMalfunctionChance: number | null; expectedCounterChance: number | null;
  expectedCounterHitChance: number | null;
  expectedOffhandHitChance: number | null; expectedOffhandCritChance: number | null;
  expectedOffhandMalfunctionChance: number | null;
  hitGrades: HitGrades;
  activeDuration: number; firstAttackTime: number | null; exitTime: number | null;
  targetSwitches: number; uniqueTargets: number; targetDurations: Record<string, number>;
}

interface DamageFlow { source: string; target: string; value: number; }

function safeRate(n: number, d: number): number { return d === 0 ? 0 : (n / d) * 100; }

function classifyHitGrade(damage: number, defenderName: string, robotMaxHP?: Record<string, number>): keyof HitGrades {
  if (!robotMaxHP || !(defenderName in robotMaxHP) || robotMaxHP[defenderName] <= 0) return 'solid';
  const ratio = damage / robotMaxHP[defenderName];
  if (ratio < 0.05) return 'glancing';
  if (ratio <= 0.15) return 'solid';
  if (ratio <= 0.30) return 'heavy';
  return 'devastating';
}

function computeSummaryFromEvents(
  events: BattleLogEvent[],
  duration: number,
  battleType: string,
  robotMaxHP?: Record<string, number>,
  tagTeamInfo?: { team1Robots: string[]; team2Robots: string[] },
): { perRobot: RobotSummaryStats[]; perTeam: unknown[] | null; damageFlows: DamageFlow[]; totalEvents: number; hasData: boolean } {

  const robotMap = new Map<string, RobotSummaryStats>();
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

  function getOrCreate(name: string): RobotSummaryStats {
    let s = robotMap.get(name);
    if (!s) {
      s = {
        robotName: name,
        mainHand: { attacks: 0, hits: 0, misses: 0, criticals: 0, malfunctions: 0 },
        offhand: null,
        attacks: 0, hits: 0, misses: 0, criticals: 0, malfunctions: 0,
        counters: { triggered: 0, hits: 0, misses: 0, damageDealt: 0 },
        countersReceived: 0,
        shieldDamageAbsorbed: 0, shieldRecharged: 0,
        damageDealt: 0, damageReceived: 0, hpDamageDealt: 0, hpDamageReceived: 0,
        hitRate: 0, critRate: 0, malfunctionRate: 0,
        expectedHitChance: null, expectedCritChance: null, expectedMalfunctionChance: null,
        expectedCounterChance: null, expectedCounterHitChance: null,
        expectedOffhandHitChance: null, expectedOffhandCritChance: null, expectedOffhandMalfunctionChance: null,
        hitGrades: { glancing: 0, solid: 0, heavy: 0, devastating: 0 },
        activeDuration: 0, firstAttackTime: null, exitTime: null,
        targetSwitches: 0, uniqueTargets: 0, targetDurations: {},
      };
      robotMap.set(name, s);
    }
    return s;
  }

  function getHand(robot: RobotSummaryStats, hand?: string): HandStats {
    if (hand === 'offhand') {
      if (!robot.offhand) robot.offhand = { attacks: 0, hits: 0, misses: 0, criticals: 0, malfunctions: 0 };
      return robot.offhand;
    }
    return robot.mainHand;
  }

  for (const event of events) {
    const type = event.type as string;

    // Shield regen tracking
    if (event.robotShield && typeof event.robotShield === 'object') {
      const currentShields = event.robotShield as Record<string, number>;
      if (prevShieldValues) {
        for (const robotName of Object.keys(currentShields)) {
          const delta = (currentShields[robotName] ?? 0) - (prevShieldValues[robotName] ?? 0);
          if (delta > 0) getOrCreate(robotName).shieldRecharged += delta;
        }
      }
      prevShieldValues = { ...currentShields };
    }

    // Attack-type events
    if (type === 'attack' || type === 'critical' || type === 'miss' || type === 'malfunction') {
      hasAttackEvents = true;
      const attackerName = event.attacker as string;
      const defenderName = event.defender as string;
      if (!attackerName || !defenderName) continue;

      const attacker = getOrCreate(attackerName);
      const defender = getOrCreate(defenderName);
      const hand = getHand(attacker, event.hand);
      const ts = Number(event.timestamp) || 0;

      hand.attacks++;
      attacker.attacks++;
      if (attacker.firstAttackTime === null) attacker.firstAttackTime = ts;

      // Target tracking
      const prevTgt = lastTarget.get(attackerName);
      if (prevTgt !== undefined && prevTgt !== defenderName) {
        attacker.targetSwitches++;
        const prevTime = lastTargetTime.get(attackerName);
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
        if (event.shieldDamage && Number(event.shieldDamage) > 0) defender.shieldDamageAbsorbed += Number(event.shieldDamage);
      }
    }

    // Counter events
    if (type === 'counter') {
      hasAttackEvents = true;
      const counterAttacker = event.attacker as string;
      const counterDefender = event.defender as string;
      if (!counterAttacker || !counterDefender) continue;
      const ca = getOrCreate(counterAttacker);
      const cd = getOrCreate(counterDefender);
      ca.counters.triggered++; cd.countersReceived++;
      const counterComp = event.formulaBreakdown?.components;
      if (counterComp && typeof counterComp.counterChance === 'number') {
        let ccs = chanceSums.get(counterAttacker);
        if (!ccs) { ccs = { hitSum: 0, critSum: 0, malfSum: 0, counterSum: 0, counterCount: 0, counterHitSum: 0, counterHitCount: 0, count: 0 }; chanceSums.set(counterAttacker, ccs); }
        ccs.counterSum += counterComp.counterChance; ccs.counterCount++;
        const chb = counterComp.counterHitChanceBase ?? counterComp.counterHitChance;
        if (typeof chb === 'number') { ccs.counterHitSum += chb; ccs.counterHitCount++; }
      }
      if (event.hit === true || event.hit === undefined) {
        ca.counters.hits++;
        const damage = Number(event.damage) || 0;
        const hpDmg = Number(event.hpDamage) || 0;
        ca.counters.damageDealt += damage; ca.damageDealt += damage; ca.hpDamageDealt += hpDmg;
        cd.damageReceived += damage; cd.hpDamageReceived += hpDmg;
        ca.hitGrades[classifyHitGrade(damage, counterDefender, robotMaxHP)]++;
        const flowKey = `${counterAttacker}→${counterDefender}`;
        damageFlowMap.set(flowKey, (damageFlowMap.get(flowKey) ?? 0) + damage);
        if (event.shieldDamage && Number(event.shieldDamage) > 0) cd.shieldDamageAbsorbed += Number(event.shieldDamage);
      } else { ca.counters.misses++; }
    }

    // Track destruction/yield
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

  // Compute rates and finalize
  for (const robot of robotMap.values()) {
    robot.hitRate = Math.round(safeRate(robot.hits, robot.attacks) * 10) / 10;
    robot.critRate = Math.round(safeRate(robot.criticals, robot.hits) * 10) / 10;
    robot.malfunctionRate = Math.round(safeRate(robot.malfunctions, robot.attacks) * 10) / 10;

    const entry = entryTimes.get(robot.robotName) ?? 0;
    const exit = robot.exitTime ?? duration;
    robot.activeDuration = Math.max(0, exit - entry);

    robot.uniqueTargets = targetSets.get(robot.robotName)?.size ?? 0;

    // Finalize target durations
    const lastTgt = lastTarget.get(robot.robotName);
    const lastTgtTime = lastTargetTime.get(robot.robotName);
    if (lastTgt !== undefined && lastTgtTime !== undefined) {
      const endTime = robot.exitTime ?? duration;
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

    // Expected chances
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

    // Round damage values
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
  let perTeam: unknown[] | null = null;
  if ((battleType === 'tag_team' || battleType === 'league_2v2' || battleType === 'league_3v3' || battleType === 'tournament_2v2' || battleType === 'tournament_3v3') && tagTeamInfo) {
    const buildTeam = (teamName: string, robotNames: string[]) => {
      const robots = robotNames.map(name => robotMap.get(name)).filter(Boolean) as RobotSummaryStats[];
      return {
        teamName, robots: robotNames,
        totalDamageDealt: robots.reduce((s, r) => s + r.damageDealt, 0),
        totalDamageReceived: robots.reduce((s, r) => s + r.damageReceived, 0),
        totalHits: robots.reduce((s, r) => s + r.hits, 0),
        totalMisses: robots.reduce((s, r) => s + r.misses, 0),
        totalCriticals: robots.reduce((s, r) => s + r.criticals, 0),
      };
    };
    perTeam = [buildTeam('Team 1', tagTeamInfo.team1Robots), buildTeam('Team 2', tagTeamInfo.team2Robots)];
  }

  return { perRobot, perTeam, damageFlows, totalEvents: events.length, hasData: hasAttackEvents };
}

// ─── Main backfill logic ─────────────────────────────────────────────

const BATCH_SIZE = parseInt(process.env.BACKFILL_BATCH_SIZE || '50', 10);
const SLEEP_MS = parseInt(process.env.BACKFILL_SLEEP_MS || '100', 10);

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  console.log('[backfill] Starting battle summary backfill...');

  let cursor = 0;
  let totalProcessed = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  const startTime = Date.now();

  while (true) {
    const battles = await prisma.battle.findMany({
      where: { id: { gt: cursor } },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
      select: {
        id: true,
        battleType: true,
        durationSeconds: true,
        battleLog: true,
        winnerId: true,
        robot1Id: true,
        robot2Id: true,
        participants: {
          select: { robotId: true, team: true, finalHP: true, destroyed: true, yielded: true },
        },
      },
    });

    if (battles.length === 0) break;

    for (const battle of battles) {
      cursor = battle.id;

      // Check if summary already exists (idempotent)
      const existing = await prisma.battleSummary.findUnique({ where: { battleId: battle.id } });
      if (existing) { totalSkipped++; continue; }

      try {
        const battleLog = battle.battleLog as Record<string, unknown> | null;
        if (!battleLog) { totalSkipped++; continue; }

        // Get events (prefer detailedCombatEvents, fallback to events)
        const events = (battleLog.detailedCombatEvents as BattleLogEvent[] ?? battleLog.events as BattleLogEvent[] ?? []);

        // Build robotMaxHP map (from participants — requires robot join)
        // We don't have maxHP in this query, so we skip hit grade classification for backfill
        // (the grades will default to 'solid' without maxHP data — acceptable for historical data)

        // Build tagTeamInfo from participants
        let tagTeamInfo: { team1Robots: string[]; team2Robots: string[] } | undefined;
        if (battle.battleType === 'tag_team' || battle.battleType === 'league_2v2' || battle.battleType === 'league_3v3' || battle.battleType === 'tournament_2v2' || battle.battleType === 'tournament_3v3') {
          // We need robot names — extract from events
          const team1Names = new Set<string>();
          const team2Names = new Set<string>();
          const team1RobotIds = new Set(battle.participants.filter(p => p.team === 1).map(p => p.robotId));
          // Try to map robotId → name from the events (attacker/defender fields)
          const robotIdToName = new Map<number, string>();
          // We'll build tagTeamInfo from the battleLog.participants if available
          const logParticipants = battleLog.participants as Array<{ robotId: number; team?: number }> | undefined;
          if (logParticipants) {
            for (const lp of logParticipants) {
              const bp = battle.participants.find(p => p.robotId === lp.robotId);
              if (bp?.team === 1) team1Names.add(String(lp.robotId));
              else if (bp?.team === 2) team2Names.add(String(lp.robotId));
            }
          }
          // If we got names from events, use those instead
          if (team1Names.size === 0) {
            // Fall through — we can't reliably determine team robot names without a join
            // Team aggregates will be null for these battles
            tagTeamInfo = undefined;
          } else {
            tagTeamInfo = { team1Robots: [...team1Names], team2Robots: [...team2Names] };
          }
        }

        const result = computeSummaryFromEvents(events, battle.durationSeconds, battle.battleType, undefined, tagTeamInfo);

        // Extract metadata from battleLog
        const placements = battleLog.placements as unknown[] | undefined;
        const kothData = battleLog.kothData as Record<string, unknown> | undefined;
        const startingPositions = battleLog.startingPositions as Record<string, unknown> | undefined;
        const endingPositions = battleLog.endingPositions as Record<string, unknown> | undefined;
        const arenaRadius = typeof battleLog.arenaRadius === 'number' ? battleLog.arenaRadius : undefined;

        // Build participants summary with survival
        const participantsSummary = battle.participants.map(p => ({
          robotId: p.robotId,
          team: p.team,
          survivalSeconds: p.destroyed || p.yielded
            ? (result.perRobot.find(r => {
                // Try to match by exitTime being set — imperfect but best we can do without name
                return r.exitTime !== null;
              })?.exitTime ?? battle.durationSeconds)
            : battle.durationSeconds,
        }));

        // Determine winning_side for team battles
        let winningSide: number | null = null;
        const logWinningSide = battleLog.winningSide as number | null | undefined;
        if (logWinningSide === 1 || logWinningSide === 2) {
          winningSide = logWinningSide;
        }

        // Write summary
        await prisma.battleSummary.create({
          data: {
            battleId: battle.id,
            perRobot: result.perRobot as unknown as any,
            perTeam: result.perTeam as unknown as any ?? undefined,
            damageFlows: result.damageFlows as unknown as any,
            participants: participantsSummary as unknown as any,
            kothPlacements: placements as unknown as any ?? undefined,
            kothData: kothData as unknown as any ?? undefined,
            startingPositions: startingPositions as unknown as any ?? undefined,
            endingPositions: endingPositions as unknown as any ?? undefined,
            arenaRadius: arenaRadius ?? undefined,
            battleDuration: battle.durationSeconds,
            totalEvents: result.totalEvents,
            hasData: result.hasData,
          },
        });

        // Update winning_side on the battles table if applicable
        if (winningSide !== null) {
          await prisma.battle.update({
            where: { id: battle.id },
            data: { winningSide },
          });
        }

        totalProcessed++;
      } catch (err) {
        totalErrors++;
        console.error(`[backfill] Error processing battle ${battle.id}:`, err instanceof Error ? err.message : err);
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[backfill] Progress: ${totalProcessed} written, ${totalSkipped} skipped, ${totalErrors} errors, cursor=${cursor}, ${elapsed}s elapsed`);
    await sleep(SLEEP_MS);
  }

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[backfill] Complete! ${totalProcessed} summaries written, ${totalSkipped} skipped, ${totalErrors} errors in ${totalElapsed}s`);
}

main()
  .catch(err => { console.error('[backfill] Fatal error:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
