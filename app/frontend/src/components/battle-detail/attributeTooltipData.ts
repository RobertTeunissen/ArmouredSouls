/* ── Types ──────────────────────────────────────────────────────────── */

export interface AttributeEntry {
  attribute: string;
  label: string;
  category: 'combat' | 'defense' | 'chassis' | 'ai' | 'team';
  effect: 'increases' | 'decreases';
}

export interface StatAttributeMapping {
  attackerAttributes: AttributeEntry[];
  defenderAttributes: AttributeEntry[];
  description?: string;
}

/* ── Category colors ────────────────────────────────────────────────── */

export const CATEGORY_COLORS: Record<AttributeEntry['category'], string> = {
  combat: 'text-error',
  defense: 'text-primary',
  chassis: 'text-success',
  ai: 'text-warning',
  team: 'text-info',
};

export const CATEGORY_LABELS: Record<AttributeEntry['category'], string> = {
  combat: 'Combat',
  defense: 'Defense',
  chassis: 'Chassis',
  ai: 'AI',
  team: 'Team',
};

/* ── Stat → Attribute mapping ───────────────────────────────────────── */

export const STAT_ATTRIBUTE_MAP: Record<string, StatAttributeMapping> = {
  hitRate: {
    attackerAttributes: [
      { attribute: 'targetingSystems', label: 'Targeting Systems', category: 'combat', effect: 'increases' },
      { attribute: 'combatAlgorithms', label: 'Combat Algorithms', category: 'ai', effect: 'increases' },
      { attribute: 'adaptiveAI', label: 'Adaptive AI', category: 'ai', effect: 'increases' },
      { attribute: 'logicCores', label: 'Logic Cores', category: 'ai', effect: 'increases' },
    ],
    defenderAttributes: [
      { attribute: 'evasionThrusters', label: 'Evasion Thrusters', category: 'defense', effect: 'decreases' },
      { attribute: 'gyroStabilizers', label: 'Gyro Stabilizers', category: 'chassis', effect: 'decreases' },
    ],
  },
  critRate: {
    attackerAttributes: [
      { attribute: 'criticalSystems', label: 'Critical Systems', category: 'combat', effect: 'increases' },
      { attribute: 'targetingSystems', label: 'Targeting Systems', category: 'combat', effect: 'increases' },
    ],
    defenderAttributes: [],
  },
  critDamage: {
    attackerAttributes: [],
    defenderAttributes: [
      { attribute: 'damageDampeners', label: 'Damage Dampeners', category: 'defense', effect: 'decreases' },
    ],
  },
  damage: {
    attackerAttributes: [
      { attribute: 'combatPower', label: 'Combat Power', category: 'combat', effect: 'increases' },
      { attribute: 'weaponControl', label: 'Weapon Control', category: 'combat', effect: 'increases' },
      { attribute: 'hydraulicSystems', label: 'Hydraulic Systems', category: 'chassis', effect: 'increases' },
      { attribute: 'adaptiveAI', label: 'Adaptive AI', category: 'ai', effect: 'increases' },
    ],
    defenderAttributes: [
      { attribute: 'armorPlating', label: 'Armor Plating', category: 'defense', effect: 'decreases' },
      { attribute: 'shieldCapacity', label: 'Shield Capacity', category: 'defense', effect: 'decreases' },
      { attribute: 'damageDampeners', label: 'Damage Dampeners', category: 'defense', effect: 'decreases' },
    ],
  },
  malfunction: {
    attackerAttributes: [
      { attribute: 'weaponControl', label: 'Weapon Control', category: 'combat', effect: 'decreases' },
    ],
    defenderAttributes: [],
  },
  counterChance: {
    attackerAttributes: [],
    defenderAttributes: [
      { attribute: 'counterProtocols', label: 'Counter Protocols', category: 'defense', effect: 'increases' },
    ],
  },
  attackSpeed: {
    attackerAttributes: [
      { attribute: 'attackSpeed', label: 'Attack Speed', category: 'combat', effect: 'increases' },
    ],
    defenderAttributes: [],
    description: 'Reduces cooldown between attacks. Offhand cooldown is 40% longer.',
  },
  offhandHitRate: {
    attackerAttributes: [
      { attribute: 'targetingSystems', label: 'Targeting Systems', category: 'combat', effect: 'increases' },
      { attribute: 'combatAlgorithms', label: 'Combat Algorithms', category: 'ai', effect: 'increases' },
    ],
    defenderAttributes: [
      { attribute: 'evasionThrusters', label: 'Evasion Thrusters', category: 'defense', effect: 'decreases' },
      { attribute: 'gyroStabilizers', label: 'Gyro Stabilizers', category: 'chassis', effect: 'decreases' },
    ],
    description: 'Offhand base hit chance is 50% (vs 70% for main hand).',
  },
  shieldRegen: {
    attackerAttributes: [],
    defenderAttributes: [
      { attribute: 'powerCore', label: 'Power Core', category: 'chassis', effect: 'increases' },
    ],
    description: 'Defensive stance increases regen rate.',
  },
  shieldCapacity: {
    attackerAttributes: [],
    defenderAttributes: [
      { attribute: 'shieldCapacity', label: 'Shield Capacity', category: 'defense', effect: 'increases' },
    ],
    description: 'Shield absorbs damage before HP is affected.',
  },
  hitSeverity: {
    attackerAttributes: [
      { attribute: 'combatPower', label: 'Combat Power', category: 'combat', effect: 'increases' },
    ],
    defenderAttributes: [],
    description: 'Glancing → Solid → Heavy → Devastating. Based on damage relative to defender max HP.',
  },
  penetration: {
    attackerAttributes: [
      { attribute: 'penetration', label: 'Penetration', category: 'combat', effect: 'increases' },
    ],
    defenderAttributes: [
      { attribute: 'armorPlating', label: 'Armor Plating', category: 'defense', effect: 'decreases' },
    ],
  },
};
