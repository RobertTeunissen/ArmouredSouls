/**
 * Price Verification Script — Weapon DPS Rebalance (Spec #31)
 *
 * For each weapon, calculates expected price using:
 *   Price = (50000 + AttrCost + 50000 × (DPS/2.0 - 1.0) × 6.0) × HandMult
 *
 * Where:
 *   AttrCost = Σ(500 × bonus²) for all attribute bonuses
 *   HandMult = 1.0 (one), 1.6 (two), 0.9 (shield)
 *
 * Asserts deviation is ≤ 5% for all 47 weapons.
 *
 * Usage:
 *   npx tsx app/backend/scripts/verify-weapon-prices.ts
 */

import { WEAPON_DEFINITIONS } from '../prisma/seed';

const BONUS_FIELDS = [
  'combatPowerBonus',
  'targetingSystemsBonus',
  'criticalSystemsBonus',
  'penetrationBonus',
  'weaponControlBonus',
  'attackSpeedBonus',
  'armorPlatingBonus',
  'shieldCapacityBonus',
  'evasionThrustersBonus',
  'damageDampenersBonus',
  'counterProtocolsBonus',
  'hullIntegrityBonus',
  'servoMotorsBonus',
  'gyroStabilizersBonus',
  'hydraulicSystemsBonus',
  'powerCoreBonus',
  'combatAlgorithmsBonus',
  'threatAnalysisBonus',
  'adaptiveAIBonus',
  'logicCoresBonus',
  'syncProtocolsBonus',
  'supportSystemsBonus',
  'formationTacticsBonus',
] as const;

const HAND_MULTIPLIERS: Record<string, number> = {
  one: 1.0,
  two: 1.6,
  shield: 0.9,
};

function getBonus(weapon: Record<string, unknown>, field: string): number {
  return (weapon[field] as number) ?? 0;
}

function calculateExpectedPrice(weapon: Record<string, unknown>): number {
  const baseCost = 50000;

  // Attribute cost: Σ(500 × bonus²)
  let attrCost = 0;
  for (const field of BONUS_FIELDS) {
    const bonus = getBonus(weapon, field);
    attrCost += 500 * bonus * bonus;
  }

  // DPS cost: shields have 0 DPS cost
  let dpsCost = 0;
  const baseDamage = weapon.baseDamage as number;
  const cooldown = weapon.cooldown as number;
  if (baseDamage > 0 && cooldown > 0) {
    const dps = baseDamage / cooldown;
    dpsCost = 50000 * (dps / 2.0 - 1.0) * 6.0;
  }

  const handMult = HAND_MULTIPLIERS[weapon.handsRequired as string] ?? 1.0;
  return (baseCost + attrCost + dpsCost) * handMult;
}

// Starter weapons are intentionally priced at ₡50K baseline regardless of formula
const STARTER_NAMES = new Set([
  'Practice Sword',
  'Practice Blaster',
  'Training Rifle',
  'Training Beam',
]);

// Run verification
let passed = 0;
let failed = 0;
const failures: string[] = [];

for (const weapon of WEAPON_DEFINITIONS) {
  // Skip starter weapons — they're priced at baseline ₡50K by design
  if (STARTER_NAMES.has(weapon.name)) {
    passed++;
    continue;
  }

  const expected = calculateExpectedPrice(weapon as unknown as Record<string, unknown>);
  const actual = weapon.cost;
  const deviation = Math.abs(actual - expected) / actual;
  const deviationPct = (deviation * 100).toFixed(2);

  if (deviation <= 0.05) {
    passed++;
  } else {
    failed++;
    failures.push(
      `  FAIL: ${weapon.name} — expected ₡${Math.round(expected).toLocaleString()}, actual ₡${actual.toLocaleString()}, deviation ${deviationPct}%`
    );
  }
}

console.log(`\n=== Weapon Price Verification (M=6.0) ===\n`);
console.log(`Total weapons: ${WEAPON_DEFINITIONS.length}`);
console.log(`Passed (≤5% deviation): ${passed}`);
console.log(`Failed (>5% deviation): ${failed}`);

if (failures.length > 0) {
  console.log(`\nFailures:`);
  for (const f of failures) {
    console.log(f);
  }
  process.exit(1);
} else {
  console.log(`\n✅ All ${passed} weapons pass price verification (≤5% deviation).`);
}
