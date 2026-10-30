import { describe, it, expect } from 'vitest';
import {
  archetypeLabel,
  formatCost,
  formatUsage,
  formatWinRate,
  handsLabel,
  isDefaultWeaponFilters,
  matchupEstimate,
  matchupLabel,
  readWeaponFilters,
  sortWeapons,
  writeWeaponFilters,
} from '../adminWeaponsFormat';
import { WEAPONS } from '../../components/admin/weapons/__tests__/weaponsFixture';

describe('adminWeaponsFormat', () => {
  it('labels archetypes, matchups and hands', () => {
    expect(archetypeLabel('melee+weapon_shield')).toBe('Melee + shield');
    expect(archetypeLabel('long+single')).toBe('Long single');
    expect(archetypeLabel('short+dual_wield')).toBe('Short dual wield');
    expect(matchupLabel('bands', 'mid')).toBe('Mid');
    expect(matchupLabel('loadouts', 'two_handed')).toBe('Two-handed');
    expect(matchupLabel('archetypes', 'mid+two_handed')).toBe('Mid two-handed');
    expect(handsLabel('one')).toBe('1H');
    expect(handsLabel('shield')).toBe('Shield');
  });

  it('formats prices, win rates and usage', () => {
    expect(formatCost(286_000)).toBe('₡286k');
    expect(formatCost(1_200_000)).toBe('₡1.2M');
    expect(formatCost(2_000_000)).toBe('₡2M');
    expect(formatWinRate(0.756)).toBe('76%');
    expect(formatWinRate(null)).toBe('—');
    expect(formatUsage(0.0567)).toBe('5.7%');
    expect(formatUsage(0.0004)).toBe('<0.1%');
    expect(formatUsage(null)).toBe('—');
  });

  it('turns a matchup win rate into an effect around 50%', () => {
    expect(matchupEstimate(0.756, 2, true).effect).toBeCloseTo(25.6, 6);
    expect(matchupEstimate(null, null, false).effect).toBeNull();
  });

  it('sorts weapons by effect with the too-few ones last', () => {
    const sorted = sortWeapons(WEAPONS, 'all');
    expect(sorted[0].name).toBe('Plasma Rifle');
    expect(sorted[sorted.length - 2].name).toBe('Beam Pistol');
    expect(sorted[sorted.length - 1].name).toBe('Ion Beam');
  });

  it('round-trips the URL state and drops defaults', () => {
    const filters = readWeaponFilters(new URLSearchParams('range=14d&column=duel&strength=top10&matchups=archetypes'));
    expect(filters).toEqual({ range: '14d', column: 'duel', strength: 'top10', matchups: 'archetypes' });
    expect(writeWeaponFilters(new URLSearchParams('battle=5'), filters).toString()).toBe('battle=5&range=14d&column=duel&strength=top10&matchups=archetypes');
    const defaults = readWeaponFilters(new URLSearchParams('range=1y&column=x&strength=top5&matchups=z'));
    expect(isDefaultWeaponFilters(defaults)).toBe(true);
    expect(writeWeaponFilters(new URLSearchParams(), defaults).toString()).toBe('');
  });
});
