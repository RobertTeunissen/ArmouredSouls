/**
 * Combat regression test for refined weapons (Spec #34, R11).
 *
 * Verifies that `prepareRobotForCombat` folds refinements into the weapon's
 * effective stats and that the simulator subsequently reads the refined
 * values. Two robots are created with identical attributes; one's weapon is
 * refined (+1 Forge, +2 Hone Combat Power), the other's is stock. We assert:
 *   1. The refined-weapon robot wins the deterministic battle.
 *   2. The refined weapon's `baseDamage` is increased by exactly 1.0 after
 *      `prepareRobotForCombat` runs (the integration's contract).
 *   3. The refined weapon's `combatPowerBonus` is increased by exactly 2.
 *   4. Battle log events use the refined display name (rank prefix when
 *      refinement count > 0) and pass `customName` through.
 *
 * Uses in-memory robot/weapon fixtures — no database connection required.
 */

import { describe, it, expect } from '@jest/globals';
import { Prisma } from '../generated/prisma';
import {
  simulateBattle,
  type RobotWithWeapons,
  type CombatEvent,
} from '../src/services/battle/combatSimulator';
import { prepareRobotForCombat } from '../src/utils/robotCalculations';
import { ROBOT_ATTRIBUTES } from '../src/shared/utils/robotAttributes';
import { simulateTagTeamBattle } from '../src/services/tag-team/tagTeamSimulation';
import type { TagTeamWithRobots } from '../src/services/tag-team/tagTeamTypes';

// ─── Fixtures ───────────────────────────────────────────────────────

function makeWeapon(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: 'Volt Sabre',
    weaponType: 'energy',
    loadoutType: 'single',
    handsRequired: 'one',
    description: '',
    rangeBand: 'short',
    baseDamage: 12,
    cost: 425_000,
    cooldown: 3,
    damageType: 'energy',
    specialProperty: null,
    combatPowerBonus: 5,
    targetingSystemsBonus: 0,
    criticalSystemsBonus: 0,
    penetrationBonus: 0,
    weaponControlBonus: 0,
    attackSpeedBonus: 3,
    armorPlatingBonus: 0,
    shieldCapacityBonus: 0,
    evasionThrustersBonus: 0,
    damageDampenersBonus: 0,
    counterProtocolsBonus: 0,
    hullIntegrityBonus: 0,
    servoMotorsBonus: 0,
    gyroStabilizersBonus: 0,
    hydraulicSystemsBonus: 0,
    powerCoreBonus: 0,
    combatAlgorithmsBonus: 0,
    threatAnalysisBonus: 0,
    adaptiveAIBonus: 0,
    logicCoresBonus: 0,
    syncProtocolsBonus: 0,
    supportSystemsBonus: 0,
    formationTacticsBonus: 0,
    createdAt: new Date('2025-01-01'),
    ...overrides,
  };
}

function makeWeaponInventory(weaponId: number, refinements: Array<{ tier: 'hone' | 'augment' | 'sharpen' | 'forge'; magnitude: number; targetAttribute: string | null; slotIndex: number; costPaid?: number }> = [], customName: string | null = null) {
  return {
    id: weaponId * 10,
    userId: 1,
    weaponId,
    customName,
    pricePaid: 100_000,
    purchasedAt: new Date('2025-01-01'),
    weapon: makeWeapon({ id: weaponId }),
    refinements: refinements.map((r, i) => ({
      id: i + 1,
      weaponInventoryId: weaponId * 10,
      tier: r.tier,
      magnitude: r.magnitude,
      targetAttribute: r.targetAttribute,
      costPaid: r.costPaid ?? 10_000,
      slotIndex: r.slotIndex,
      createdAt: new Date('2025-01-02'),
    })),
  };
}

function makeMockRobot(overrides: Partial<RobotWithWeapons> = {}): RobotWithWeapons {
  return {
    id: 1,
    userId: 1,
    name: 'TestBot',
    frameId: 1,
    paintJob: null,
    combatPower: new Prisma.Decimal(20),
    targetingSystems: new Prisma.Decimal(20),
    criticalSystems: new Prisma.Decimal(15),
    penetration: new Prisma.Decimal(15),
    weaponControl: new Prisma.Decimal(20),
    attackSpeed: new Prisma.Decimal(15),
    armorPlating: new Prisma.Decimal(15),
    shieldCapacity: new Prisma.Decimal(10),
    evasionThrusters: new Prisma.Decimal(10),
    damageDampeners: new Prisma.Decimal(10),
    counterProtocols: new Prisma.Decimal(10),
    hullIntegrity: new Prisma.Decimal(20),
    servoMotors: new Prisma.Decimal(15),
    gyroStabilizers: new Prisma.Decimal(15),
    hydraulicSystems: new Prisma.Decimal(15),
    powerCore: new Prisma.Decimal(15),
    combatAlgorithms: new Prisma.Decimal(15),
    threatAnalysis: new Prisma.Decimal(15),
    adaptiveAI: new Prisma.Decimal(10),
    logicCores: new Prisma.Decimal(15),
    syncProtocols: new Prisma.Decimal(10),
    supportSystems: new Prisma.Decimal(10),
    formationTactics: new Prisma.Decimal(10),
    currentHP: 200,
    maxHP: 200,
    currentShield: 40,
    maxShield: 40,
    damageTaken: 0,
    elo: 1200,
    totalBattles: 0,
    wins: 0, draws: 0, losses: 0,
    damageDealtLifetime: 0, damageTakenLifetime: 0,
    kills: 0,
    fame: 0, titles: null,
    repairQuoteCredits: 0, battleReadiness: 100, lifetimeRepairCreditsPaid: 0,
    yieldThreshold: 10,
    loadoutType: 'single',
    stance: 'balanced',
    mainWeaponId: null, offhandWeaponId: null,
    imageUrl: null,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    mainWeapon: null,
    offhandWeapon: null,
    ...overrides,
  } as unknown as RobotWithWeapons;
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('Combat simulator — refinement integration', () => {
  it('prepareRobotForCombat folds Forge into baseDamage', () => {
    const robot = makeMockRobot({
      mainWeapon: makeWeaponInventory(1, [
        { tier: 'forge', magnitude: 1, targetAttribute: null, slotIndex: 1 },
      ]) as unknown as RobotWithWeapons['mainWeapon'],
    });

    prepareRobotForCombat(robot);

    // Forge is +8% of base damage per instance, not a flat +1.0 — see the tier table
    // in app/shared/utils/weaponRefinement.ts. Catalog baseDamage 12 → 12 × 1.08 = 12.96.
    expect(robot.mainWeapon!.weapon.baseDamage).toBeCloseTo(12.96, 5);
  });

  it('prepareRobotForCombat folds Sharpen into cooldown', () => {
    const robot = makeMockRobot({
      mainWeapon: makeWeaponInventory(1, [
        { tier: 'sharpen', magnitude: 1, targetAttribute: null, slotIndex: 1 },
      ]) as unknown as RobotWithWeapons['mainWeapon'],
    });

    prepareRobotForCombat(robot);

    // Sharpen is -10% of base cooldown per instance, not a flat -0.25 — see the tier
    // table in app/shared/utils/weaponRefinement.ts. Catalog cooldown 3.0 → 2.7.
    expect(robot.mainWeapon!.weapon.cooldown).toBeCloseTo(2.7, 5);
  });

  it('prepareRobotForCombat folds Hone into the catalog attribute bonus', () => {
    const robot = makeMockRobot({
      mainWeapon: makeWeaponInventory(1, [
        { tier: 'hone', magnitude: 2, targetAttribute: 'combatPower', slotIndex: 1 },
      ]) as unknown as RobotWithWeapons['mainWeapon'],
    });

    prepareRobotForCombat(robot);

    // Catalog combatPowerBonus was 5; Hone adds 2 → 7
    expect((robot.mainWeapon!.weapon as unknown as Record<string, number>).combatPowerBonus).toBe(7);
  });

  it('attaches __refinementCount and __customName markers for the simulator', () => {
    const robot = makeMockRobot({
      mainWeapon: makeWeaponInventory(
        1,
        [
          { tier: 'hone', magnitude: 1, targetAttribute: 'combatPower', slotIndex: 1 },
          { tier: 'forge', magnitude: 1, targetAttribute: null, slotIndex: 2 },
        ],
        'Old Faithful',
      ) as unknown as RobotWithWeapons['mainWeapon'],
    });

    prepareRobotForCombat(robot);

    const weapon = robot.mainWeapon!.weapon as unknown as Record<string, unknown>;
    expect(weapon.__refinementCount).toBe(2);
    expect(weapon.__customName).toBe('Old Faithful');
  });

  it('battle log events carry the rank-prefixed weapon name and customName', () => {
    // Robot 1: refined Volt Sabre (4 slots → "Mastercrafted")
    const robot1 = makeMockRobot({
      id: 1, name: 'Refiner',
      mainWeapon: makeWeaponInventory(
        1,
        [
          { tier: 'hone', magnitude: 1, targetAttribute: 'combatPower', slotIndex: 1 },
          { tier: 'hone', magnitude: 1, targetAttribute: 'attackSpeed', slotIndex: 2 },
          { tier: 'sharpen', magnitude: 1, targetAttribute: null, slotIndex: 3 },
          { tier: 'forge', magnitude: 1, targetAttribute: null, slotIndex: 4 },
        ],
        'Old Faithful',
      ) as unknown as RobotWithWeapons['mainWeapon'],
      mainWeaponId: 10,
    });

    // Robot 2: stock weapon
    const robot2 = makeMockRobot({
      id: 2, name: 'Stocker',
      mainWeapon: makeWeaponInventory(2) as unknown as RobotWithWeapons['mainWeapon'],
      mainWeaponId: 20,
    });

    prepareRobotForCombat(robot1);
    prepareRobotForCombat(robot2);

    const result = simulateBattle(robot1, robot2);

    // Find at least one attack event from robot1
    const robot1AttackEvents = result.events.filter(
      (e: CombatEvent) => e.attacker === 'Refiner' && (e.type === 'attack' || e.type === 'critical'),
    );
    expect(robot1AttackEvents.length).toBeGreaterThan(0);

    // The weapon field should carry the rank prefix
    const sampleEvent = robot1AttackEvents[0];
    expect(sampleEvent.weapon).toMatch(/Mastercrafted Volt Sabre/);
    expect(sampleEvent.customName).toBe('Old Faithful');
  });

  it('refined-weapon robot wins against an identical-stats robot with stock weapon', () => {
    // Both robots have identical attributes; only the weapon differs.
    // Robot 1's weapon has +2 Forge + +5 Hone Combat Power; Robot 2's is stock.
    const robot1 = makeMockRobot({
      id: 1, name: 'Refiner',
      mainWeapon: makeWeaponInventory(1, [
        { tier: 'forge', magnitude: 1, targetAttribute: null, slotIndex: 1 },
        { tier: 'forge', magnitude: 1, targetAttribute: null, slotIndex: 2 },
        { tier: 'hone', magnitude: 5, targetAttribute: 'combatPower', slotIndex: 3 },
      ]) as unknown as RobotWithWeapons['mainWeapon'],
      mainWeaponId: 10,
    });

    const robot2 = makeMockRobot({
      id: 2, name: 'Stocker',
      mainWeapon: makeWeaponInventory(2) as unknown as RobotWithWeapons['mainWeapon'],
      mainWeaponId: 20,
    });

    prepareRobotForCombat(robot1);
    prepareRobotForCombat(robot2);

    const result = simulateBattle(robot1, robot2);

    // The refined robot should win in this deterministic-enough setup.
    // Combat has RNG (hits, crits, malfunctions) so we can't assert the exact
    // winner with certainty, but Robot 1 should win or draw the *vast* majority
    // of the time. We run a series and assert >= 60% wins.
    let robot1Wins = 0;
    // 400 trials, not 30.
    //
    // The threshold below is unchanged; the sample backing it is not. The refined robot's
    // true win rate here is around 0.70, and at 30 trials the standard error is 0.084, so
    // a 0.60 bound sat only ~1.2 standard errors below the mean — roughly a one-in-nine
    // failure per run, which is what made this the flakiest suite in the tier (observed
    // 17/30 = 0.567). At 400 trials the standard error is 0.023 and the same bound is over
    // 4 standard errors out, which is a statement about refinements rather than about luck.
    //
    // `simulateBattle` is pure in-memory computation, so the extra trials cost little. Do
    // not reduce this count to speed the suite up, and do not lower the bound instead —
    // lowering it would weaken the claim that refinements produce a combat advantage.
    const trials = 400;
    for (let i = 0; i < trials; i++) {
      const r1 = makeMockRobot({
        id: 1, name: 'Refiner',
        mainWeapon: makeWeaponInventory(1, [
          { tier: 'forge', magnitude: 1, targetAttribute: null, slotIndex: 1 },
          { tier: 'forge', magnitude: 1, targetAttribute: null, slotIndex: 2 },
          { tier: 'hone', magnitude: 5, targetAttribute: 'combatPower', slotIndex: 3 },
        ]) as unknown as RobotWithWeapons['mainWeapon'],
        mainWeaponId: 10,
      });
      const r2 = makeMockRobot({
        id: 2, name: 'Stocker',
        mainWeapon: makeWeaponInventory(2) as unknown as RobotWithWeapons['mainWeapon'],
        mainWeaponId: 20,
      });
      prepareRobotForCombat(r1);
      prepareRobotForCombat(r2);
      const r = simulateBattle(r1, r2);
      if (r.winnerId === 1) robot1Wins++;
    }

    // With +2 baseDamage and +5 Combat Power, the refined robot has a substantial
    // edge. We want to confirm refinements actually translate into combat advantage.
    expect(robot1Wins / trials).toBeGreaterThanOrEqual(0.6);

    // Also confirm at least one trial completed without errors.
    expect(result.winnerId).toBeDefined();
  });

  // ─── #517: refinements + loadout modifiers, applied exactly once ──────

  it('folds Hone into a loadout-modified attribute before the loadout multiplier (#517)', () => {
    const robot = makeMockRobot({
      loadoutType: 'dual_wield',
      mainWeapon: makeWeaponInventory(1, [
        { tier: 'hone', magnitude: 2, targetAttribute: 'attackSpeed', slotIndex: 1 },
      ]) as unknown as RobotWithWeapons['mainWeapon'],
      offhandWeapon: makeWeaponInventory(2) as unknown as RobotWithWeapons['offhandWeapon'],
    });

    prepareRobotForCombat(robot);

    // attackSpeed: (base 15 + main 3 + Hone 2 + offhand 3) × 1.30 (Dual Wield) = 29.9
    expect(Number(robot.attackSpeed)).toBe(29.9);
    // combatPower: (base 20 + main 5 + offhand 5) × 0.90 (Dual Wield penalty) = 27
    expect(Number(robot.combatPower)).toBe(27);
  });

  it('preparing twice does not fold Forge or Hone a second time (#517)', () => {
    const robot = makeMockRobot({
      mainWeapon: makeWeaponInventory(1, [
        { tier: 'forge', magnitude: 1, targetAttribute: null, slotIndex: 1 },
        { tier: 'hone', magnitude: 2, targetAttribute: 'combatPower', slotIndex: 2 },
      ]) as unknown as RobotWithWeapons['mainWeapon'],
    });

    prepareRobotForCombat(robot);
    prepareRobotForCombat(robot);

    const weapon = robot.mainWeapon!.weapon as unknown as Record<string, number>;
    expect(weapon.baseDamage).toBeCloseTo(12.96, 5);
    expect(weapon.combatPowerBonus).toBe(7);
    // (20 + 7) × 1 (single has no combatPower modifier) = 27
    expect(Number(robot.combatPower)).toBe(27);
  });

  it('tag-team phases neither compound prepared attributes nor restore a damaged robot (#517)', async () => {
    const makeTeamRobot = (id: number, loadoutType: string) => makeMockRobot({
      id,
      name: `Tagger-${id}`,
      loadoutType,
      yieldThreshold: 0,
      mainWeapon: makeWeaponInventory(id * 2 - 1) as unknown as RobotWithWeapons['mainWeapon'],
      offhandWeapon: loadoutType === 'single'
        ? null
        : makeWeaponInventory(id * 2) as unknown as RobotWithWeapons['offhandWeapon'],
      mainWeaponId: id * 2 - 1,
    });
    const robots = [
      makeTeamRobot(1, 'dual_wield'),
      makeTeamRobot(2, 'weapon_shield'),
      makeTeamRobot(3, 'weapon_shield'),
      makeTeamRobot(4, 'dual_wield'),
    ];
    for (const robot of robots) prepareRobotForCombat(robot);

    const snapshot = (robot: RobotWithWeapons) => ({
      attributes: Object.fromEntries(ROBOT_ATTRIBUTES.map((attr) => [attr, Number(robot[attr as keyof RobotWithWeapons])])),
      maxHP: robot.maxHP,
      maxShield: robot.maxShield,
    });
    const before = robots.map(snapshot);

    const team = (id: number, active: RobotWithWeapons, reserve: RobotWithWeapons): TagTeamWithRobots => ({
      id,
      stableId: id,
      teamName: `Team-${id}`,
      teamSize: 2,
      activeRobotId: active.id,
      reserveRobotId: reserve.id,
      activeRobot: active,
      reserveRobot: reserve,
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01'),
    });

    await simulateTagTeamBattle(team(1, robots[0], robots[1]), team(2, robots[2], robots[3]));

    // The simulator reads prepared attributes; it must never re-derive or compound them.
    expect(robots.map(snapshot)).toEqual(before);

    // A robot damaged in an earlier phase keeps its HP if preparation is called again.
    const damaged = robots.find((r) => r.currentHP < r.maxHP);
    expect(damaged).toBeDefined();
    const hpBefore = damaged!.currentHP;
    const shieldBefore = damaged!.currentShield;
    prepareRobotForCombat(damaged!);
    expect(damaged!.currentHP).toBe(hpBefore);
    expect(damaged!.currentShield).toBe(shieldBefore);
    expect(snapshot(damaged!)).toEqual(before[robots.indexOf(damaged!)]);
  });
});
