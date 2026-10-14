import { describe, it, expect } from 'vitest';
import { getTierName, getTierColor, getTierIcon, UNRANKED_LABEL } from '../tierHelpers';

describe('tierHelpers', () => {
  it('maps known tiers case-insensitively', () => {
    expect(getTierName('gold')).toBe('Gold');
    expect(getTierName('GOLD')).toBe('Gold');
    expect(getTierColor('gold')).toBe('text-yellow-500');
    expect(getTierIcon('champion')).toBe('👑');
  });

  it('falls back for unknown tier strings', () => {
    expect(getTierName('mythic')).toBe('mythic');
    expect(getTierColor('mythic')).toBe('text-gray-400');
    expect(getTierIcon('mythic')).toBe('⚔️');
  });

  it.each([undefined, null])('treats %s as unranked without throwing', (tier) => {
    expect(getTierName(tier)).toBe(UNRANKED_LABEL);
    expect(getTierColor(tier)).toBe('text-secondary');
    expect(getTierIcon(tier)).toBe('—');
  });

  it('exposes "Unranked" as the shared label', () => {
    expect(UNRANKED_LABEL).toBe('Unranked');
  });
});
