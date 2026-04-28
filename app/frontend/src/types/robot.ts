/**
 * Shared robot attribute types used across components that need
 * dynamic attribute access (upgrades, stats, tuning, battle config).
 *
 * These 23 attributes map to the Prisma Robot model's Decimal fields.
 * Values are serialized as numbers in API responses.
 */

/** All 23 robot attribute keys */
export type RobotAttributeKey =
  // Combat Systems
  | 'combatPower'
  | 'targetingSystems'
  | 'criticalSystems'
  | 'penetration'
  | 'weaponControl'
  | 'attackSpeed'
  // Defensive Systems
  | 'armorPlating'
  | 'shieldCapacity'
  | 'evasionThrusters'
  | 'damageDampeners'
  | 'counterProtocols'
  // Chassis & Mobility
  | 'hullIntegrity'
  | 'servoMotors'
  | 'gyroStabilizers'
  | 'hydraulicSystems'
  | 'powerCore'
  // AI Processing
  | 'combatAlgorithms'
  | 'threatAnalysis'
  | 'adaptiveAI'
  | 'logicCores'
  // Team Coordination
  | 'syncProtocols'
  | 'supportSystems'
  | 'formationTactics';

/** Robot attributes as a record (for dynamic access) */
export type RobotAttributes = Record<RobotAttributeKey, number>;

/** Weapon inventory item with equipped weapon details */
export interface WeaponInventoryItem {
  id: number;
  weapon: {
    id: number;
    name: string;
    weaponType: string;
    baseDamage: number;
    cooldown: number;
    cost: number;
    handsRequired: string;
    rangeBand: string;
    loadoutType: string;
    description: string | null;
    // Weapon attribute bonuses
    combatPowerBonus: number;
    targetingSystemsBonus: number;
    criticalSystemsBonus: number;
    penetrationBonus: number;
    weaponControlBonus: number;
    attackSpeedBonus: number;
    armorPlatingBonus: number;
    shieldCapacityBonus: number;
    evasionThrustersBonus: number;
    counterProtocolsBonus: number;
    servoMotorsBonus: number;
    gyroStabilizersBonus: number;
    hydraulicSystemsBonus: number;
    powerCoreBonus: number;
    threatAnalysisBonus: number;
  };
}

/**
 * Base robot interface with attributes accessible by key.
 * Components that need dynamic attribute access (e.g., `robot[attrKey]`)
 * should use this type.
 */
export interface RobotWithAttributes extends RobotAttributes {
  id: number;
  name: string;
  userId: number;
  elo: number;
  currentLeague: string;
  leagueId: string;
  leaguePoints: number;
  fame: number;
  currentHP: number;
  maxHP: number;
  currentShield: number;
  maxShield: number;
  mainWeaponId: number | null;
  offhandWeaponId: number | null;
  mainWeapon: { id: number; weapon: Record<string, unknown> } | null;
  offhandWeapon: { id: number; weapon: Record<string, unknown> } | null;
  loadoutType: string;
  stance: string;
  yieldThreshold: number;
  imageUrl: string | null;
  totalBattles: number;
  wins: number;
  losses: number;
  draws: number;
  kills: number;
  damageDealtLifetime: number;
  damageTakenLifetime: number;
  totalRepairsPaid: number;
  titles: string | null;
  battleReadiness: number;
  repairCost: number;
  user?: {
    id?: number;
    username: string;
    stableName?: string | null;
  };
  /** Allow dynamic string key access for attribute lookups */
  [key: string]: unknown;
}
