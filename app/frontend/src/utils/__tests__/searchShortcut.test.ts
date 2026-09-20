import { afterEach, describe, expect, it } from 'vitest';
import { getSearchShortcutLabel } from '../searchShortcut';

const originalPlatform = navigator.platform;
const originalUserAgent = navigator.userAgent;

function setNavigatorValue(key: 'platform' | 'userAgent', value: string): void {
  Object.defineProperty(navigator, key, {
    configurable: true,
    value,
  });
}

describe('getSearchShortcutLabel', () => {
  afterEach(() => {
    setNavigatorValue('platform', originalPlatform);
    setNavigatorValue('userAgent', originalUserAgent);
  });

  it.each(['MacIntel', 'iPhone', 'iPad'])('uses the Cmd hint on Apple platform %s', (platform) => {
    setNavigatorValue('platform', platform);
    setNavigatorValue('userAgent', 'Mozilla/5.0');

    expect(getSearchShortcutLabel()).toBe('⌘ K');
  });

  it.each(['Win32', 'Linux x86_64', ''])('uses the Ctrl hint on non-Apple platform %s', (platform) => {
    setNavigatorValue('platform', platform);
    setNavigatorValue('userAgent', 'Mozilla/5.0');

    expect(getSearchShortcutLabel()).toBe('Ctrl K');
  });
});
