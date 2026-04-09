// Utility functions for weapon calculations

/**
 * Calculate weapon cooldown in seconds based on weapon type and base damage
 * Cooldown formula: baseCooldown + (baseDamage / damagePerSecond)
 */
export function calculateWeaponCooldown(weaponType: string, baseDamage: number): number {
  // Base cooldowns by weapon type (in seconds)
  const baseCooldowns: { [key: string]: number } = {
    'melee': 2.0,
    'ballistic': 3.0,
    'energy': 2.5,
    'explosive': 4.0,
  };

  // Damage scaling factors (lower = faster cooldown per damage point)
  const damageScaling: { [key: string]: number } = {
    'melee': 15,
    'ballistic': 20,
    'energy': 18,
    'explosive': 25,
  };

  const baseCooldown = baseCooldowns[weaponType] || 3.0;
  const scaling = damageScaling[weaponType] || 20;

  return baseCooldown + (baseDamage / scaling);
}
