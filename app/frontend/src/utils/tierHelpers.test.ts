/**
 * Unit tests for tierHelpers — league tier display utilities.
 */
import { describe, it, expect } from 'vitest';
import { getTierName, getTierColor, getTierIcon, LEAGUE_TIERS } from './tierHelpers';

describe('getTierName', () => {
  it.each([
    ['bronze', 'Bronze'],
    ['silver', 'Silver'],
    ['gold', 'Gold'],
    ['platinum', 'Platinum'],
    ['diamond', 'Diamond'],
    ['champion', 'Champion'],
  ])('should return "%s" → "%s"', (input, expected) => {
    expect(getTierName(input)).toBe(expected);
  });

  it('should handle uppercase input', () => {
    expect(getTierName('GOLD')).toBe('Gold');
    expect(getTierName('Bronze')).toBe('Bronze');
  });

  it('should return raw string for unknown tiers', () => {
    expect(getTierName('mythic')).toBe('mythic');
    expect(getTierName('unknown')).toBe('unknown');
  });
});

describe('getTierColor', () => {
  it('should return correct color for each tier', () => {
    expect(getTierColor('bronze')).toBe('text-orange-600');
    expect(getTierColor('champion')).toBe('text-purple-500');
  });

  it('should return default gray for unknown tiers', () => {
    expect(getTierColor('mythic')).toBe('text-gray-400');
  });
});

describe('getTierIcon', () => {
  it('should return correct icon for each tier', () => {
    expect(getTierIcon('bronze')).toBe('🥉');
    expect(getTierIcon('champion')).toBe('👑');
  });

  it('should return default icon for unknown tiers', () => {
    expect(getTierIcon('mythic')).toBe('⚔️');
  });
});

describe('LEAGUE_TIERS', () => {
  it('should have 6 tiers in correct order', () => {
    expect(LEAGUE_TIERS).toEqual(['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion']);
  });
});
