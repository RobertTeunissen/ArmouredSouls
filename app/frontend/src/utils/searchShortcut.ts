import { useEffect, useState } from 'react';

export type SearchShortcutLabel = '⌘ K' | 'Ctrl K';

interface NavigatorPlatformData {
  userAgentData?: { platform?: string };
  platform?: string;
  userAgent?: string;
  maxTouchPoints?: number;
}

/**
 * Detect Apple platforms from explicit platform data, with an iPadOS desktop
 * mode fallback. No browser globals are read during server rendering.
 */
export function isApplePlatform(platformNavigator?: NavigatorPlatformData): boolean {
  if (typeof navigator === 'undefined' && platformNavigator === undefined) return false;

  const currentNavigator = platformNavigator ?? (navigator as NavigatorPlatformData);
  const platform = [
    currentNavigator.userAgentData?.platform,
    currentNavigator.platform,
  ].find((value) => typeof value === 'string' && value.trim().length > 0) ?? '';

  if (/^(Mac|iPhone|iPad|iPod)/i.test(platform)) return true;
  if (/^MacIntel$/i.test(platform) && (currentNavigator.maxTouchPoints ?? 0) > 1) return true;

  // Older Safari versions may not expose a useful platform value.
  return platform.length === 0 && /Macintosh|iPhone|iPad|iPod/i.test(currentNavigator.userAgent ?? '');
}

/** Return the platform-appropriate visible search accelerator label. */
export function getSearchShortcutLabel(): SearchShortcutLabel {
  return isApplePlatform() ? '⌘ K' : 'Ctrl K';
}

/**
 * Hydration-safe visible shortcut label. SSR and the first client render use
 * the deterministic non-Apple label; the browser-specific label is applied
 * after mount so Apple detection cannot create a hydration mismatch.
 */
export function useSearchShortcutLabel(): SearchShortcutLabel {
  const [label, setLabel] = useState<SearchShortcutLabel>('Ctrl K');

  useEffect(() => {
    setLabel(getSearchShortcutLabel());
  }, []);

  return label;
}
