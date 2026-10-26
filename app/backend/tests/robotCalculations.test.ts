import { 
  calculateEffectiveStats, 
  calculateMaxHP, 
  calculateMaxShield,
  getLoadoutBonus,
  getLoadoutModifiedAttributes,
  prepareRobotForCombat,
  getCombatBuild,
  LOADOUT_BONUSES,
  BASE_HP,
  HP_MULTIPLIER,
  SHIELD_MULTIPLIER,
} from '../src/utils/robotCalculations';
import { ROBOT_ATTRIBUTES } from '../src/shared/utils/robotAttributes';
import { layerBuild, layeredValues, type RawBuild } from '../src/services/admin/analysis/attributeLayers';
import { Robot, WeaponInventory, Weapon, Prisma } from '../generated/prisma';

// Mock robot data
const createMockRobot = (overrides?: Partial<Robot>): Robot => ({
  id: 1,
  userId: 1,
  name: 'TestBot',
  frameId: 1,
  paintJob: null,
  combatPower: new Prisma.Decimal(10),
  targetingSystems: new Prisma.Decimal(10),
  criticalSystems: new Prisma.Decimal(10),
  penetration: new Prisma.Decimal(10),
  weaponControl: new Prisma.Decimal(10),
  attackSpeed: new Prisma.Decimal(10),
  armorPlating: new Prisma.Decimal(10),
  shieldCapacity: new Prisma.Decimal(10),
  evasionThrusters: new Prisma.Decimal(10),
  damageDampeners: new Prisma.Decimal(10),
  counterProtocols: new Prisma.Decimal(10),
  hullIntegrity: new Prisma.Decimal(10),
  servoMotors: new Prisma.Decimal(10),
  gyroStabilizers: new Prisma.Decimal(10),
  hydraulicSystems: new Prisma.Decimal(10),
  powerCore: new Prisma.Decimal(10),
  combatAlgorithms: new Prisma.Decimal(10),
  threatAnalysis: new Prisma.Decimal(10),
  adaptiveAI: new Prisma.Decimal(10),
  logicCores: new Prisma.Decimal(10),
  syncProtocols: new Prisma.Decimal(10),
  supportSystems: new Prisma.Decimal(10),
  formationTactics: new Prisma.Decimal(10),
  currentHP: 55, // Updated to match new formula: 50 + (1 * 5) = 55
  maxHP: 55,     // Updated to match new formula: 50 + (1 * 5) = 55
  currentShield: 20,
  maxShield: 20,
  damageTaken: 0,
  elo: 1200,
  totalBattles: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  damageDealtLifetime: 0,
  damageTakenLifetime: 0,
  kills: 0,
  fame: 0,
  titles: null,
  repairQuoteCredits: 0,
  battleReadiness: 100,
  lifetimeRepairCreditsPaid: 0,
  yieldThreshold: 10,
  loadoutType: 'single',
  stance: 'balanced',
  mainWeaponId: null,
  offhandWeaponId: null,
  imageUrl: null,
  automatonBlueprintId: null,
  automatonSlotIndex: null,
  offensiveWins: 0,
  defensiveWins: 0,
  balancedWins: 0,
  dualWieldWins: 0,
  grandMeleeWins: 0,
  grandMeleeTop3: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const createMockWeapon = (overrides?: Partial<Weapon>): Weapon => ({
  id: 1,
  name: 'Test Weapon',
  weaponType: 'energy',
  baseDamage: 20,
  cooldown: 3,
  cost: 50000,
  handsRequired: 'one',
  damageType: 'energy',
  loadoutType: 'any',
  rangeBand: 'mid',
  specialProperty: null,
  description: null,
  combatPowerBonus: 5,
  targetingSystemsBonus: 3,
  criticalSystemsBonus: 0,
  penetrationBonus: 0,
  weaponControlBonus: 0,
  attackSpeedBonus: 0,
  armorPlatingBonus: 0,
  shieldCapacityBonus: 0,
  evasionThrustersBonus: 0,
  damageDampenersBonus: 0,
  counterProtocolsBonus: 0,
  hullIntegrityBonus: 2,
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
  createdAt: new Date(),
  ...overrides,
});

describe('Robot Calculations', () => {
  afterAll(() => {
    // Pure unit test - no cleanup needed
  });

  describe('calculateEffectiveStats', () => {
    it('should calculate base stats without weapons or loadout bonuses', () => {
      const robot = createMockRobot({ loadoutType: 'single' });
      const stats = calculateEffectiveStats(robot);

      // With single loadout (Season 2): gyroStabilizers +15%, servoMotors +10%
      expect(stats.combatPower).toBe(10); // No bonus
      expect(stats.gyroStabilizers).toBe(11.5); // 10 * 1.15 = 11.5
      expect(stats.servoMotors).toBe(11); // 10 * 1.10 = 11
    });

    it('should apply weapon bonuses correctly', () => {
      const weapon = createMockWeapon({
        combatPowerBonus: 5,
        targetingSystemsBonus: 3,
        hullIntegrityBonus: 2,
      });

      const robot = createMockRobot({ 
        loadoutType: 'single',
        mainWeaponId: 1,
      });

      const robotWithWeapon = {
        ...robot,
        mainWeapon: {
          id: 1,
          userId: 1,
          weaponId: 1,
          customName: null,
          pricePaid: 50000,
          purchasedAt: new Date(),
          weapon,
        },
      };

      const stats = calculateEffectiveStats(robotWithWeapon);

      // Base 10 + weapon bonus 5 = 15, no loadout modifier
      expect(stats.combatPower).toBe(15);
      // Base 10 + weapon bonus 3 = 13, no loadout modifier
      expect(stats.targetingSystems).toBe(13);
      // Base 10 + weapon bonus 2 = 12, no loadout modifier
      expect(stats.hullIntegrity).toBe(12);
    });

    it('should apply loadout bonuses correctly for weapon_shield', () => {
      const robot = createMockRobot({ 
        loadoutType: 'weapon_shield',
        shieldCapacity: new Prisma.Decimal(10),
        armorPlating: new Prisma.Decimal(10),
        counterProtocols: new Prisma.Decimal(10),
        attackSpeed: new Prisma.Decimal(10),
      });

      const stats = calculateEffectiveStats(robot);

      // shieldCapacity: new Prisma.Decimal(10) * 1.15 = 11.5 (Season 2: was +20%)
      expect(stats.shieldCapacity).toBe(11.5);
      // armorPlating: new Prisma.Decimal(10) * 1.10 = 11 (Season 2: was +15%)
      expect(stats.armorPlating).toBe(11);
      // counterProtocols: new Prisma.Decimal(10) * 1.10 = 11
      expect(stats.counterProtocols).toBe(11);
      // attackSpeed: new Prisma.Decimal(10) * 0.85 = 8.5
      expect(stats.attackSpeed).toBe(8.5);
    });

    it('should apply loadout bonuses correctly for two_handed', () => {
      const robot = createMockRobot({ 
        loadoutType: 'two_handed',
        combatPower: new Prisma.Decimal(10),
        criticalSystems: new Prisma.Decimal(10),
        evasionThrusters: new Prisma.Decimal(10),
      });

      const stats = calculateEffectiveStats(robot);

      // combatPower: new Prisma.Decimal(10) * 1.10 = 11 (v1.2: bonus reduced from 25% to 10%)
      expect(stats.combatPower).toBe(11);
      // criticalSystems: new Prisma.Decimal(10) * 1.20 = 12
      expect(stats.criticalSystems).toBe(12);
      // evasionThrusters: new Prisma.Decimal(10) * 0.90 = 9
      expect(stats.evasionThrusters).toBe(9);
    });

    it('should apply both weapon and loadout bonuses', () => {
      const weapon = createMockWeapon({
        combatPowerBonus: 5,
      });

      const robot = createMockRobot({ 
        loadoutType: 'two_handed',
        combatPower: new Prisma.Decimal(10),
        mainWeaponId: 1,
      });

      const robotWithWeapon = {
        ...robot,
        mainWeapon: {
          id: 1,
          userId: 1,
          weaponId: 1,
          customName: null,
          pricePaid: 50000,
          purchasedAt: new Date(),
          weapon,
        },
      };

      const stats = calculateEffectiveStats(robotWithWeapon);

      // (Base 10 + weapon 5) * 1.10 = 16.5 (v1.2: bonus reduced from 25% to 10%)
      expect(stats.combatPower).toBe(16.5);
    });

    it('should combine main and offhand weapon bonuses', () => {
      const mainWeapon = createMockWeapon({
        combatPowerBonus: 5,
        targetingSystemsBonus: 2,
      });

      const offhandWeapon = createMockWeapon({
        combatPowerBonus: 3,
        targetingSystemsBonus: 4,
      });

      const robot = createMockRobot({ 
        loadoutType: 'dual_wield',
        combatPower: new Prisma.Decimal(10),
        targetingSystems: new Prisma.Decimal(10),
        mainWeaponId: 1,
        offhandWeaponId: 2,
      });

      const robotWithWeapons = {
        ...robot,
        mainWeapon: {
          id: 1,
          userId: 1,
          weaponId: 1,
          customName: null,
          pricePaid: 50000,
          purchasedAt: new Date(),
          weapon: mainWeapon,
        },
        offhandWeapon: {
          id: 2,
          userId: 1,
          weaponId: 2,
          customName: null,
          pricePaid: 50000,
          purchasedAt: new Date(),
          weapon: offhandWeapon,
        },
      };

      const stats = calculateEffectiveStats(robotWithWeapons);

      // Combat Power: (10 + 5 + 3) * 0.90 = 16.2 (dual_wield has -10% penalty, rounded to 2 decimals)
      expect(stats.combatPower).toBe(16.2);
      // Targeting: 10 + 2 + 4 = 16 (no loadout modifier)
      expect(stats.targetingSystems).toBe(16);
    });
  });

  describe('calculateMaxHP', () => {
    it('should calculate max HP based on effective hull integrity with base HP', () => {
      const robot = createMockRobot({ 
        loadoutType: 'single',
        hullIntegrity: new Prisma.Decimal(10),
      });

      const maxHP = calculateMaxHP(robot);

      // BASE_HP (50) + (Hull integrity 10 * HP_MULTIPLIER 5) = 50 + 50 = 100
      expect(maxHP).toBe(100);
    });

    it('should include weapon bonuses in HP calculation', () => {
      const weapon = createMockWeapon({
        hullIntegrityBonus: 5,
      });

      const robot = createMockRobot({ 
        loadoutType: 'single',
        hullIntegrity: new Prisma.Decimal(10),
        mainWeaponId: 1,
      });

      const robotWithWeapon = {
        ...robot,
        mainWeapon: {
          id: 1,
          userId: 1,
          weaponId: 1,
          customName: null,
          pricePaid: 50000,
          purchasedAt: new Date(),
          weapon,
        },
      };

      const maxHP = calculateMaxHP(robotWithWeapon);

      // BASE_HP (50) + ((Hull integrity 10 + weapon 5) * HP_MULTIPLIER 5) = 50 + 75 = 125
      expect(maxHP).toBe(125);
    });

    it('should calculate correct HP for starting robot with hull integrity 1', () => {
      const robot = createMockRobot({ 
        loadoutType: 'single',
        hullIntegrity: new Prisma.Decimal(1),
      });

      const maxHP = calculateMaxHP(robot);

      // BASE_HP (50) + (Hull integrity 1 * HP_MULTIPLIER 5) = 50 + 5 = 55
      expect(maxHP).toBe(55);
    });

    it('should calculate correct HP for max level robot with hull integrity 50', () => {
      const robot = createMockRobot({ 
        loadoutType: 'single',
        hullIntegrity: new Prisma.Decimal(50),
      });

      const maxHP = calculateMaxHP(robot);

      // BASE_HP (50) + (Hull integrity 50 * HP_MULTIPLIER 5) = 50 + 250 = 300
      expect(maxHP).toBe(300);
    });
  });

  describe('calculateMaxShield', () => {
    it('should calculate max shield based on effective shield capacity', () => {
      const robot = createMockRobot({ 
        loadoutType: 'single',
        shieldCapacity: new Prisma.Decimal(10),
      });

      const maxShield = calculateMaxShield(robot);

      // Shield capacity 10 * 4 = 40
      expect(maxShield).toBe(40);
    });

    it('should include weapon and loadout bonuses in shield calculation', () => {
      const weapon = createMockWeapon({
        shieldCapacityBonus: 5,
      });

      const robot = createMockRobot({ 
        loadoutType: 'weapon_shield', // +15% shield capacity
        shieldCapacity: new Prisma.Decimal(10),
        mainWeaponId: 1,
      });

      const robotWithWeapon = {
        ...robot,
        mainWeapon: {
          id: 1,
          userId: 1,
          weaponId: 1,
          customName: null,
          pricePaid: 50000,
          purchasedAt: new Date(),
          weapon,
        },
      };

      const maxShield = calculateMaxShield(robotWithWeapon);

      // (Shield capacity 10 + weapon 5) * 1.15 * 4 = 69
      expect(maxShield).toBe(69);
    });
  });

  describe('getLoadoutBonus', () => {
    it('should return correct bonus for existing attribute', () => {
      expect(getLoadoutBonus('weapon_shield', 'shieldCapacity')).toBe(0.15);
      expect(getLoadoutBonus('two_handed', 'combatPower')).toBe(0.10); // v1.2: reduced from 0.25 for balance
      expect(getLoadoutBonus('dual_wield', 'attackSpeed')).toBe(0.30);
      expect(getLoadoutBonus('single', 'gyroStabilizers')).toBe(0.15);
    });

    it('should return 0 for non-modified attributes', () => {
      expect(getLoadoutBonus('single', 'combatPower')).toBe(0);
      expect(getLoadoutBonus('weapon_shield', 'hullIntegrity')).toBe(0);
    });

    it('should return 0 for invalid loadout type', () => {
      expect(getLoadoutBonus('invalid', 'combatPower')).toBe(0);
    });
  });

  describe('getLoadoutModifiedAttributes', () => {
    it('should return all modified attributes for weapon_shield', () => {
      const attrs = getLoadoutModifiedAttributes('weapon_shield');
      expect(attrs).toContain('shieldCapacity');
      expect(attrs).toContain('armorPlating');
      expect(attrs).toContain('counterProtocols');
      expect(attrs).toContain('attackSpeed');
      expect(attrs.length).toBe(4);
    });

    it('should return empty array for invalid loadout', () => {
      const attrs = getLoadoutModifiedAttributes('invalid');
      expect(attrs).toEqual([]);
    });
  });

  // #517 — combat preparation must apply the same loadout modifiers as the
  // displayed/backend effective-stat calculation, exactly once.
  describe('prepareRobotForCombat — loadout parity (#517)', () => {
    type PreparableRobot = Parameters<typeof prepareRobotForCombat>[0];
    type InventoryRow = NonNullable<PreparableRobot['mainWeapon']>;
    type RefinementFixture = { tier: 'hone' | 'augment' | 'sharpen' | 'forge'; magnitude: number; targetAttribute: string | null };

    const round2 = (value: number): number => Math.round(value * 100) / 100;

    /** Wrap a catalog weapon in an inventory row, optionally with refinements. */
    const inventoryRow = (id: number, weapon: Weapon, refinements: RefinementFixture[] = []): InventoryRow => ({
      id,
      userId: 1,
      weaponId: weapon.id,
      customName: null,
      pricePaid: 50000,
      purchasedAt: new Date(),
      weapon,
      refinements: refinements.map((r, i) => ({
        id: i + 1,
        weaponInventoryId: id,
        tier: r.tier,
        magnitude: r.magnitude,
        targetAttribute: r.targetAttribute,
        costPaid: 10_000,
        slotIndex: i + 1,
        createdAt: new Date(),
      })),
    }) as unknown as InventoryRow;

    // Every attribute any loadout modifies, plus hull/shield, gets a weapon
    // bonus — including negative bonuses — so each loadout bonus AND penalty
    // is exercised against a non-trivial pre-multiplier sum.
    const MAIN_BONUSES: Partial<Weapon> = {
      combatPowerBonus: 5,
      targetingSystemsBonus: 3,
      criticalSystemsBonus: 4,
      penetrationBonus: -3,
      weaponControlBonus: 2,
      attackSpeedBonus: 3,
      armorPlatingBonus: 1,
      shieldCapacityBonus: 2,
      evasionThrustersBonus: -2,
      counterProtocolsBonus: 2,
      hullIntegrityBonus: 3,
      servoMotorsBonus: -1,
      gyroStabilizersBonus: 1,
    };
    const OFFHAND_BONUSES: Partial<Weapon> = {
      combatPowerBonus: 2,
      targetingSystemsBonus: 0,
      penetrationBonus: -1,
      weaponControlBonus: 1,
      attackSpeedBonus: -2,
      armorPlatingBonus: 3,
      shieldCapacityBonus: 5,
      counterProtocolsBonus: 1,
      hullIntegrityBonus: 0,
    };
    const TUNING: Record<string, number> = {
      attackSpeed: 2,
      penetration: 1.5,
      shieldCapacity: 1,
      combatPower: 0.5,
      evasionThrusters: 1,
      gyroStabilizers: 0.25,
    };
    // Hone on a loadout-modified attribute: refinements are folded into the
    // weapon bonus BEFORE the loadout multiplier.
    const MAIN_REFINEMENTS: RefinementFixture[] = [
      { tier: 'hone', magnitude: 2, targetAttribute: 'attackSpeed' },
    ];

    const OFFHAND_LOADOUTS = new Set(['dual_wield', 'weapon_shield']);

    /** Distinct base value per attribute so a swapped attribute cannot pass. */
    const distinctBases = (): Partial<Robot> => {
      const overrides: Record<string, Prisma.Decimal> = {};
      ROBOT_ATTRIBUTES.forEach((attr, i) => {
        overrides[attr] = new Prisma.Decimal(10 + i);
      });
      return overrides as Partial<Robot>;
    };

    const buildRobot = (loadoutType: string, withRefinements: boolean): PreparableRobot => {
      const robot = createMockRobot({ loadoutType, ...distinctBases() });
      const main = inventoryRow(
        1,
        createMockWeapon({ id: 1, ...MAIN_BONUSES }),
        withRefinements ? MAIN_REFINEMENTS : [],
      );
      const offhand = OFFHAND_LOADOUTS.has(loadoutType)
        ? inventoryRow(2, createMockWeapon({ id: 2, ...OFFHAND_BONUSES }))
        : null;
      return { ...robot, mainWeapon: main, offhandWeapon: offhand };
    };

    /** Independent reference: (base + main + offhand + hone + tuning) × (1 + loadout), 2 decimals. */
    const expectedAttribute = (loadoutType: string, attr: string, withRefinements: boolean): number => {
      const index = ROBOT_ATTRIBUTES.indexOf(attr as (typeof ROBOT_ATTRIBUTES)[number]);
      const base = 10 + index;
      const field = `${attr}Bonus` as keyof Weapon;
      const mainBonus = Number(MAIN_BONUSES[field] ?? createMockWeapon()[field] ?? 0);
      const offBonus = OFFHAND_LOADOUTS.has(loadoutType)
        ? Number(OFFHAND_BONUSES[field] ?? createMockWeapon()[field] ?? 0)
        : 0;
      const hone = withRefinements
        ? MAIN_REFINEMENTS.filter((r) => r.targetAttribute === attr).reduce((s, r) => s + r.magnitude, 0)
        : 0;
      const tuning = TUNING[attr] ?? 0;
      const loadout = LOADOUT_BONUSES[loadoutType]?.[attr] ?? 0;
      return round2((base + mainBonus + offBonus + hone + tuning) * (1 + loadout));
    };

    const LOADOUTS = [...Object.keys(LOADOUT_BONUSES), 'unknown_loadout'];

    describe.each(LOADOUTS)('%s', (loadoutType) => {
      it.each([false, true])('prepares every attribute canonically (refinements: %s)', (withRefinements) => {
        const robot = buildRobot(loadoutType, withRefinements);
        prepareRobotForCombat(robot, TUNING);

        // Displayed/backend calculation on a pristine copy whose weapons carry
        // the same folded refinement bonuses the prepared robot uses.
        const pristine = buildRobot(loadoutType, false);
        const displayed = calculateEffectiveStats(
          { ...pristine, mainWeapon: robot.mainWeapon, offhandWeapon: robot.offhandWeapon },
          TUNING,
        );

        for (const attr of ROBOT_ATTRIBUTES) {
          const prepared = Number(robot[attr as keyof Robot]);
          expect({ attr, value: prepared }).toEqual({ attr, value: expectedAttribute(loadoutType, attr, withRefinements) });
          expect({ attr, value: prepared }).toEqual({ attr, value: displayed[attr] });
        }

        expect(robot.maxHP).toBeCloseTo(BASE_HP + displayed.hullIntegrity * HP_MULTIPLIER, 10);
        expect(robot.maxShield).toBeCloseTo(displayed.shieldCapacity * SHIELD_MULTIPLIER, 10);
        expect(robot.currentHP).toBe(robot.maxHP);
        expect(robot.currentShield).toBe(robot.maxShield);
      });
    });

    describe('battle-time build capture (admin "what wins")', () => {
      it('records base levels, tuning, the effective values, weapons with refinements and the setup', () => {
        const robot = buildRobot('dual_wield', true);
        robot.stance = 'offensive';
        robot.yieldThreshold = 15;
        expect(getCombatBuild(robot)).toBeNull();
        prepareRobotForCombat(robot, TUNING);
        const build = getCombatBuild(robot)!;
        ROBOT_ATTRIBUTES.forEach((attr, i) => {
          expect({ attr, base: build.baseAttributes[attr] }).toEqual({ attr, base: 10 + i });
          expect({ attr, effective: build.effectiveAttributes[attr] }).toEqual({ attr, effective: Number(robot[attr as keyof Robot]) });
        });
        expect(build.tuning).toEqual(TUNING);
        expect(build.mainWeapon).toEqual({ weaponId: 1, refinements: [{ tier: 'hone', magnitude: 2, targetAttribute: 'attackSpeed' }] });
        expect(build.offhandWeapon).toEqual({ weaponId: 2, refinements: [] });
        expect(build).toMatchObject({ loadoutType: 'dual_wield', stance: 'offensive', yieldThreshold: 15 });
      });

      it('records no weapon for an empty hand, and nothing for a spread copy', () => {
        const robot = buildRobot('single', false);
        prepareRobotForCombat(robot);
        expect(getCombatBuild(robot)?.offhandWeapon).toBeNull();
        expect(getCombatBuild(robot)?.tuning).toEqual({});
        expect(getCombatBuild({ ...robot })).toBeNull();
      });

      it.each(['offensive', 'defensive', 'balanced'])(
        'parity with the simulator (%s): the analysis layers rebuild exactly the attributes combat reads',
        (stance) => {
          const robot = buildRobot('dual_wield', true);
          robot.stance = stance;
          prepareRobotForCombat(robot, TUNING);
          const layered = layerBuild(getCombatBuild(robot)! as unknown as RawBuild);
          const allOn = layeredValues(layered, { tuning: true, weapons: true, refinements: true, loadout: true, stance: true });
          const stanceOff = layeredValues(layered, { tuning: true, weapons: true, refinements: true, loadout: true, stance: false });
          ROBOT_ATTRIBUTES.forEach((attr, k) => {
            // The simulator reads the prepared attribute fields (e.g. calcCooldown uses robot.attackSpeed);
            // stance never changes them, so the analysis must not either.
            const combat = Number(robot[attr as keyof Robot]);
            expect({ attr, delta: Math.abs(allOn[k] - combat) <= 0.011 }).toEqual({ attr, delta: true });
            expect(stanceOff[k]).toBe(allOn[k]);
          });
          expect(layered.stance).toBe(stance);
        },
      );

      it('keeps the first capture when preparation runs again', () => {
        const robot = buildRobot('single', false);
        prepareRobotForCombat(robot, TUNING);
        const first = getCombatBuild(robot);
        prepareRobotForCombat(robot, {});
        expect(getCombatBuild(robot)).toBe(first);
      });
    });

    it('prepared Dual Wield robot receives its +30% attack speed', () => {
      const robot: PreparableRobot = {
        ...createMockRobot({ loadoutType: 'dual_wield' }),
        mainWeapon: inventoryRow(1, createMockWeapon({ id: 1, attackSpeedBonus: 3 })),
        offhandWeapon: inventoryRow(2, createMockWeapon({ id: 2, attackSpeedBonus: 3 })),
      };
      prepareRobotForCombat(robot);
      // (10 + 3 + 3) × 1.30 = 20.8
      expect(Number(robot.attackSpeed)).toBe(20.8);
    });

    it('prepared Weapon + Shield robot receives its +15% shield capacity in maxShield', () => {
      const robot: PreparableRobot = {
        ...createMockRobot({ loadoutType: 'weapon_shield' }),
        mainWeapon: inventoryRow(1, createMockWeapon({ id: 1, shieldCapacityBonus: 0 })),
        offhandWeapon: inventoryRow(2, createMockWeapon({ id: 2, shieldCapacityBonus: 5 })),
      };
      prepareRobotForCombat(robot);
      // (10 + 5) × 1.15 = 17.25 → maxShield 17.25 × 4 = 69
      expect(Number(robot.shieldCapacity)).toBe(17.25);
      expect(robot.maxShield).toBe(69);
      expect(robot.currentShield).toBe(69);
    });

    it('preparing the same robot twice does not compound and does not restore HP', () => {
      const robot = buildRobot('dual_wield', true);
      prepareRobotForCombat(robot, TUNING);

      const attributesAfterFirst = Object.fromEntries(
        ROBOT_ATTRIBUTES.map((attr) => [attr, Number(robot[attr as keyof Robot])]),
      );
      const maxHP = robot.maxHP;
      const maxShield = robot.maxShield;
      const mainAttackSpeedBonus = robot.mainWeapon!.weapon.attackSpeedBonus;

      // Simulate damage from a previous tag-team phase / retry.
      robot.currentHP = 10;
      robot.currentShield = 0;

      prepareRobotForCombat(robot, TUNING);

      const attributesAfterSecond = Object.fromEntries(
        ROBOT_ATTRIBUTES.map((attr) => [attr, Number(robot[attr as keyof Robot])]),
      );
      expect(attributesAfterSecond).toEqual(attributesAfterFirst);
      expect(robot.maxHP).toBe(maxHP);
      expect(robot.maxShield).toBe(maxShield);
      expect(robot.mainWeapon!.weapon.attackSpeedBonus).toBe(mainAttackSpeedBonus);
      expect(robot.currentHP).toBe(10);
      expect(robot.currentShield).toBe(0);
    });
  });
});
