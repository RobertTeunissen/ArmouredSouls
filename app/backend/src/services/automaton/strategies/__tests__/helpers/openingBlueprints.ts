/**
 * Starter robots the approved opening tables of `review/STRATEGIES.md`
 * §5–§10 were computed with ("Computed with … blueprints"), copied from
 * `review/CATALOGUE.md`: the robots an opening buys, with their loadout,
 * stance, yield, Build_Focus, Weapon_Path and Refinement_Plan. Not a test
 * file. The full catalogue files arrive with task group 8.
 */
import type { BlueprintFacts } from '../../../stableFacts';
import { augment, catalogueBlueprint, dpsSteps, hone, interleavedDpsSteps } from './strategyFixtureSupport';

/** Kamino Clone Legion (`clone-legion`, Swarm), slots 1–3. */
export const CLONE_LEGION_OPENING: BlueprintFacts[] = [
  catalogueBlueprint({
    slot: 1, name: 'CT-7567 Rex', loadout: 'dual_wield', stance: 'offensive', yieldThreshold: 10, buildFocus: 'versatile',
    path: [['Laser Pistol', 'Laser Pistol'], ['Volt Sabre', 'Volt Sabre']],
    plan: [...interleavedDpsSteps(), hone('main', 'targetingSystems', 4), hone('offhand', 'targetingSystems', 4)],
  }),
  catalogueBlueprint({
    slot: 2, name: 'CC-2224 Cody', loadout: 'single', stance: 'balanced', yieldThreshold: 15, buildFocus: 'deadeye',
    path: [['Bolt Carbine'], ['Nova Caster']],
    plan: [...dpsSteps('main'), hone('main', 'targetingSystems', 4)],
  }),
  catalogueBlueprint({
    slot: 3, name: 'CT-5555 Fives', loadout: 'weapon_shield', stance: 'defensive', yieldThreshold: 20, buildFocus: 'warden',
    path: [['Laser Pistol', 'Light Shield'], ['Volt Sabre', 'Aegis Bulwark']],
    plan: [
      ...dpsSteps('main'),
      augment('main', 'armorPlating', 1),
      ...Array.from({ length: 5 }, () => hone('offhand', 'evasionThrusters', 1)),
    ],
  }),
];

/** Old Detroit Precinct (`robocop-precinct`, Paragon), slot 1. */
export const ROBOCOP_PRECINCT_OPENING: BlueprintFacts[] = [
  catalogueBlueprint({
    slot: 1, name: 'RoboCop', loadout: 'single', stance: 'balanced', yieldThreshold: 15, buildFocus: 'deadeye',
    path: [['Gauss Pistol'], ['Particle Lance']],
    plan: dpsSteps('main'),
  }),
];

/** Pan Pacific Defense Corps (`jaeger-corps`, Duo), slots 1–2. */
export const JAEGER_CORPS_OPENING: BlueprintFacts[] = [
  catalogueBlueprint({
    slot: 1, name: 'Gipsy Danger', loadout: 'two_handed', stance: 'balanced', yieldThreshold: 10, buildFocus: 'bruiser',
    path: [['Shock Maul'], ['Heavy Hammer']],
    plan: [...dpsSteps('main'), hone('main', 'combatPower', 1)],
  }),
  catalogueBlueprint({
    slot: 2, name: 'Striker Eureka', loadout: 'single', stance: 'offensive', yieldThreshold: 10, buildFocus: 'sprinter',
    path: [['Burst Rifle'], ['Volt Sabre']],
    plan: [...dpsSteps('main'), hone('main', 'powerCore', 1)],
  }),
];

/** Decepticon Armada (`decepticon-armada`, Trio), slots 1–3. */
export const DECEPTICON_ARMADA_OPENING: BlueprintFacts[] = [
  catalogueBlueprint({
    slot: 1, name: 'Megatron', loadout: 'two_handed', stance: 'offensive', yieldThreshold: 5, buildFocus: 'deadeye',
    path: [['Siege Cannon'], ['Ion Beam']],
    plan: [...dpsSteps('main'), hone('main', 'combatPower', 1)],
  }),
  catalogueBlueprint({
    slot: 2, name: 'Starscream', loadout: 'dual_wield', stance: 'offensive', yieldThreshold: 25, buildFocus: 'sprinter',
    path: [['Laser Pistol', 'Laser Pistol'], ['Volt Sabre', 'Volt Sabre']],
    plan: [...interleavedDpsSteps(), hone('main', 'powerCore', 1), hone('offhand', 'powerCore', 1)],
  }),
  catalogueBlueprint({
    slot: 3, name: 'Soundwave', loadout: 'single', stance: 'defensive', yieldThreshold: 15, buildFocus: 'tactician',
    path: [['Bolt Carbine'], ['Nova Caster']],
    plan: [...dpsSteps('main'), hone('main', 'combatPower', 1)],
  }),
];

/** Planet Express Crew (`planet-express`, Tycoon), slots 1–2. */
export const PLANET_EXPRESS_OPENING: BlueprintFacts[] = [
  catalogueBlueprint({
    slot: 1, name: 'Bender', loadout: 'two_handed', stance: 'offensive', yieldThreshold: 30, buildFocus: 'bruiser',
    path: [['War Club'], ['Heavy Hammer']],
    plan: [...dpsSteps('main'), hone('main', 'combatPower', 2)],
  }),
  catalogueBlueprint({
    slot: 2, name: 'Calculon', loadout: 'single', stance: 'balanced', yieldThreshold: 20, buildFocus: 'deadeye',
    path: [['Beam Pistol'], ['Particle Lance']],
    plan: [...dpsSteps('main'), hone('main', 'combatPower', 2)],
  }),
];

/** Autobots of the Ark (`autobots-ark`, Generalist), slots 1–2. */
export const AUTOBOTS_ARK_OPENING: BlueprintFacts[] = [
  catalogueBlueprint({
    slot: 1, name: 'Optimus Prime', loadout: 'single', stance: 'balanced', yieldThreshold: 10, buildFocus: 'versatile',
    path: [['Laser Pistol'], ['Volt Sabre']],
    plan: [...dpsSteps('main'), hone('main', 'combatPower', 2)],
  }),
  catalogueBlueprint({
    slot: 2, name: 'Bumblebee', loadout: 'dual_wield', stance: 'offensive', yieldThreshold: 20, buildFocus: 'sprinter',
    path: [['Laser Pistol', 'Laser Pistol'], ['Volt Sabre', 'Volt Sabre']],
    plan: [...interleavedDpsSteps(), hone('main', 'powerCore', 2), hone('offhand', 'powerCore', 2)],
  }),
];
