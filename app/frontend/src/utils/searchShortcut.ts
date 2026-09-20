/** Return the platform-appropriate visible search accelerator label. */
export function getSearchShortcutLabel(): '⌘ K' | 'Ctrl K' {
  if (typeof navigator === 'undefined') return 'Ctrl K';

  const navigatorWithPlatformData = navigator as Navigator & {
    userAgentData?: { platform?: string };
  };
  const platform = [
    navigatorWithPlatformData.userAgentData?.platform,
    navigator.platform,
    navigator.userAgent,
  ].find((value) => value?.trim()) ?? '';

  return /Mac|iPhone|iPad|iPod/i.test(platform) ? '⌘ K' : 'Ctrl K';
}
