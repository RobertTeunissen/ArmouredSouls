/**
 * Get the image path for a weapon based on its name
 */
export const getWeaponImagePath = (weaponName: string): string => {
  // Convert weapon name to kebab-case filename
  const filename = weaponName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  
  return `/src/assets/weapons/${filename}.webp`;
};

/**
 * Get a fallback color based on weapon type
 */
export const getWeaponTypeColor = (weaponType: string): string => {
  switch (weaponType.toLowerCase()) {
    case 'melee':
      return '#ef4444'; // red
    case 'ballistic':
      return '#f97316'; // orange
    case 'energy':
      return '#3b82f6'; // blue
    case 'shield':
      return '#06b6d4'; // cyan
    default:
      return '#9ca3af'; // gray
  }
};
