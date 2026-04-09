// Storage capacity calculations

/**
 * Calculate weapon storage capacity based on Storage Facility level
 * Formula: 5 base slots + (Storage Facility Level × 5)
 * Maximum capacity: 55 weapons at level 10
 */
export function calculateStorageCapacity(storageFacilityLevel: number): number {
  const BASE_CAPACITY = 5;
  const CAPACITY_PER_LEVEL = 5;
  
  return BASE_CAPACITY + (storageFacilityLevel * CAPACITY_PER_LEVEL);
}

/**
 * Check if user has available storage space
 */
export function hasStorageSpace(currentWeaponCount: number, storageFacilityLevel: number): boolean {
  const maxCapacity = calculateStorageCapacity(storageFacilityLevel);
  return currentWeaponCount < maxCapacity;
}

/**
 * Get storage status information
 */
export function getStorageStatus(currentWeaponCount: number, storageFacilityLevel: number): {
  currentWeapons: number;
  maxCapacity: number;
  remainingSlots: number;
  isFull: boolean;
  percentageFull: number;
} {
  const maxCapacity = calculateStorageCapacity(storageFacilityLevel);
  const remainingSlots = Math.max(0, maxCapacity - currentWeaponCount);
  const isFull = currentWeaponCount >= maxCapacity;
  const percentageFull = Math.min(100, Math.round((currentWeaponCount / maxCapacity) * 100));

  return {
    currentWeapons: currentWeaponCount,
    maxCapacity,
    remainingSlots,
    isFull,
    percentageFull,
  };
}
