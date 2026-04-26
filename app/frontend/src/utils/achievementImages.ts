// Dynamically import all achievement badge images
const achievementImageModules = import.meta.glob('/src/assets/achievements/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

// Create a lookup map: "achievement-c1" → resolved URL
const achievementImageMap = new Map<string, string>();
Object.entries(achievementImageModules).forEach(([path, url]) => {
  const filename = path.split('/').pop()?.replace('.webp', '') || '';
  achievementImageMap.set(filename, url);
});

/**
 * Get the image URL for an achievement badge.
 * @param badgeIconFile - The badge identifier without extension, e.g. "achievement-c1"
 * @param size - Desired size suffix (128 or 64). Falls back to 128 if the requested size isn't available.
 * @returns Resolved image URL or undefined if no image exists.
 */
export function getAchievementImageUrl(badgeIconFile: string, size: number = 128): string | undefined {
  // Try exact size first, e.g. "achievement-c1-128"
  const withSize = `${badgeIconFile}-${size}`;
  if (achievementImageMap.has(withSize)) {
    return achievementImageMap.get(withSize);
  }
  // Fall back to 128px variant
  const fallback = `${badgeIconFile}-128`;
  return achievementImageMap.get(fallback);
}
