// Dynamically import all weapon images
const weaponImageModules = import.meta.glob('/src/assets/weapons/*.webp', { 
  eager: true, 
  query: '?url', 
  import: 'default' 
}) as Record<string, string>;

// Create a lookup map for faster access
const weaponImageMap = new Map<string, string>();
Object.entries(weaponImageModules).forEach(([path, url]) => {
  // Extract filename without extension
  const filename = path.split('/').pop()?.replace('.webp', '') || '';
  weaponImageMap.set(filename, url);
});

/**
 * Get the image path for a weapon based on its name
 */
export const getWeaponImagePath = (weaponName: string): string => {
  // Convert weapon name to kebab-case filename
  const filename = weaponName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  
  // Look up the image in our map
  const imageUrl = weaponImageMap.get(filename);
  
  if (imageUrl) {
    return imageUrl;
  }
  
  console.warn(`Weapon image not found: ${filename}.webp`);
  // Return a data URL for a placeholder if image not found
  return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="64" height="64"%3E%3Crect fill="%23374151" width="64" height="64"/%3E%3Ctext x="32" y="32" text-anchor="middle" fill="%239ca3af" font-size="12"%3E%3F%3C/text%3E%3C/svg%3E';
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
