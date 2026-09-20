import { afterEach, describe, expect, it } from 'vitest';
import { getSearchShortcutLabel, isApplePlatform } from '../searchShortcut';

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

  it('prefers explicit user-agent platform data over a misleading user agent string', () => {
    expect(isApplePlatform({
      userAgentData: { platform: 'Windows' },
      platform: 'Win32',
      userAgent: 'Mozilla/5.0 Macintosh',
    })).toBe(false);
    expect(isApplePlatform({
      userAgentData: { platform: 'macOS' },
      platform: 'Linux x86_64',
      userAgent: 'Mozilla/5.0 Windows NT 10.0',
    })).toBe(true);
  });

  it('recognizes iPad desktop mode from MacIntel touch support', () => {
    expect(isApplePlatform({ platform: 'MacIntel', maxTouchPoints: 5 })).toBe(true);
    expect(isApplePlatform({ platform: 'MacIntel', maxTouchPoints: 0 })).toBe(true);
  });
