/**
 * Fixtures of the admin Weapons page: a ready analysis shaped like ACC
 * (melee + shield converging at the top, long range weak) and the collecting state.
 */
import { ANALYSIS_COLUMNS } from '../../attributes/types';
import {
  LOADOUTS,
  RANGE_BANDS,
  type AnalysisColumn,
  type ArchetypeKey,
  type ChoiceResult,
  type ColumnMatchups,
  type EffectEstimate,
  type MatchupGrid,
  type WeaponAnalysisCollecting,
  type WeaponAnalysisReady,
  type WeaponRow,
} from '../types';

const NONE: EffectEstimate = { effect: null, se: null, significant: false };

function est(effect: number | null, se = 1): EffectEstimate {
  return effect === null ? NONE : { effect, se, significant: Math.abs(effect) >= 2 * se };
}

function result(effect: number | null, share: number, playersShare: number | null = 0.02, rawWinRate: number | null = 0.5, robots = 500): ChoiceResult {
  return { robots, share, playersShare, comparisons: robots * 2, rawWinRate, effect: est(effect) };
}

function perColumn<T>(value: (column: AnalysisColumn) => T): Record<AnalysisColumn, T> {
  return Object.fromEntries(ANALYSIS_COLUMNS.map((c) => [c, value(c)])) as Record<AnalysisColumn, T>;
}

const ARCHETYPE_EFFECTS: Record<string, number | null> = {
  'melee+single': -3.0, 'melee+weapon_shield': 3.4, 'melee+two_handed': 3.6, 'melee+dual_wield': 7.4,
  'short+single': 1.7, 'short+weapon_shield': 6.5, 'short+two_handed': 4.9, 'short+dual_wield': 10.5,
  'mid+single': -4.0, 'mid+weapon_shield': 5.8, 'mid+two_handed': 1.2, 'mid+dual_wield': 7.1,
  'long+single': -21.9, 'long+weapon_shield': -8.4, 'long+two_handed': -11.4, 'long+dual_wield': null,
};

function weapon(weaponId: number, name: string, rangeBand: string, handsRequired: string, cost: number, effect: number | null, share: number, playersShare: number, rawWinRate: number | null, robots = 400): WeaponRow {
  return { weaponId, name, weaponType: 'energy', handsRequired, rangeBand, cost, results: perColumn(() => result(effect, share, playersShare, rawWinRate, robots)) };
}

/** 14 weapons: more than the 12 shown before "Show all". */
export const WEAPONS: WeaponRow[] = [
  weapon(1, 'Plasma Rifle', 'short', 'one', 286_000, 6.1, 0.021, 0, 0.76),
  weapon(2, 'Grenade Launcher', 'mid', 'two', 318_000, 5.0, 0.007, 0.018, 0.76),
  weapon(3, 'Thermal Lance', 'melee', 'two', 306_000, 4.2, 0.009, 0.019, 0.7),
  weapon(4, 'Plasma Blade', 'melee', 'one', 273_000, 2.4, 0.027, 0.036, 0.63),
  weapon(5, 'Vibro Mace', 'melee', 'one', 688_000, 0.9, 0.008, 0.395, 0.61),
  weapon(6, 'Gauss Pistol', 'long', 'one', 335_000, 1.8, 0.034, 0, 0.66),
  weapon(7, 'Bolt Carbine', 'mid', 'one', 96_000, -1.2, 0.075, 0.002, 0.44),
  weapon(8, 'Training Beam', 'long', 'two', 50_000, -4.1, 0.033, 0, 0.39),
  weapon(9, 'Beam Pistol', 'long', 'one', 96_000, -5.2, 0.07, 0, 0.34),
  weapon(10, 'Laser Pistol', 'short', 'one', 63_000, -0.6, 0.05, 0, 0.47),
  weapon(11, 'Combat Knife', 'melee', 'one', 96_000, -0.7, 0.04, 0.01, 0.46),
  weapon(12, 'Light Shield', 'melee', 'shield', 81_000, 1.1, 0.12, 0.3, 0.52),
  weapon(13, 'War Club', 'melee', 'two', 82_000, -2.4, 0.03, 0, 0.42),
  weapon(14, 'Ion Beam', 'long', 'two', 903_000, null, 0.0004, 0.01, null, 7),
];

function grid(labels: string[], rows: Array<Array<number | null>>): MatchupGrid {
  return {
    labels,
    cells: rows.map((row) => row.map((winRate) => ({ winRate, se: winRate === null ? null : 2, significant: winRate !== null && Math.abs(winRate - 0.5) > 0.05, comparisons: winRate === null ? 0 : 600 }))),
  };
}

const MATCHUPS: ColumnMatchups = {
  comparisons: 41_000,
  views: {
    bands: grid([...RANGE_BANDS], [
      [null, 0.413, 0.601, 0.615],
      [0.587, null, 0.532, 0.621],
      [0.399, 0.468, null, 0.756],
      [0.385, 0.379, 0.244, null],
    ]),
    loadouts: grid([...LOADOUTS], [
      [null, 0.45, 0.48, 0.44],
      [0.55, null, 0.52, 0.49],
      [0.52, 0.48, null, 0.47],
      [0.56, 0.51, 0.53, null],
    ]),
    archetypes: grid(['melee+weapon_shield', 'mid+weapon_shield'], [[null, 0.55], [0.45, null]]),
  },
};

export function readyWeapons(overrides: Partial<WeaponAnalysisReady> = {}): WeaponAnalysisReady {
  const archetypes = (Object.keys(ARCHETYPE_EFFECTS) as ArchetypeKey[]).map((key) => {
    const [rangeBand, loadout] = key.split('+') as [WeaponAnalysisReady['archetypes'][number]['rangeBand'], WeaponAnalysisReady['archetypes'][number]['loadout']];
    return { key, rangeBand, loadout, results: perColumn(() => result(ARCHETYPE_EFFECTS[key], 0.061, key === 'melee+weapon_shield' ? 0.544 : 0.02)) };
  });
  return {
    status: 'ready',
    recordingSince: '2026-10-27T08:03:41.000Z',
    window: { range: '7d', from: '2026-11-03T12:00:00.000Z', to: '2026-11-10T12:00:00.000Z', battlesInRange: 21_480, battlesUsed: 21_480, sampled: false },
    strength: 'all',
    columns: ANALYSIS_COLUMNS.map((column) => ({
      column, battles: 9_000, comparisons: 40_000, enough: true, robots: 30_000, humanRobots: 1_600, strengthCut: null, investmentEffect: est(4.2, 0.2),
    })),
    weapons: WEAPONS,
    archetypes,
    matchups: { all: MATCHUPS, duel: MATCHUPS, team: null, multi: MATCHUPS },
    tiers: perColumn(() => ({
      segments: ['melee+weapon_shield', 'mid+weapon_shield'] as ArchetypeKey[],
      rows: [
        { tier: 'bronze' as const, robots: 9_972, playersShare: 0.003, shares: [0.06, 0.055, 0.885] },
        { tier: 'diamond' as const, robots: 260, playersShare: 0.573, shares: [0.392, 0.1, 0.508] },
        { tier: 'champion' as const, robots: 28, playersShare: 0.821, shares: [0.536, 0, 0.464] },
        { tier: 'tournament' as const, robots: 300, playersShare: 0.2, shares: [0.2, 0.05, 0.75] },
      ],
    })),
    refinements: perColumn(() => ({
      robots: 30_000, refinedShare: 0.012, tierShares: { hone: 0.009, augment: 0.002, sharpen: 0.001, forge: 0 }, comparisons: 40, effect: NONE,
    })),
    coverage: perColumn(() => ({ catalogue: 47, fought: 47, foughtByPlayers: 30 })),
    notOwnedByPlayers: [{ weaponId: 30, name: 'Plasma Cannon' }, { weaponId: 31, name: 'Railgun' }],
    skipped: { draws: 812, tiedPlacements: 0, forfeits: 95, missingBuilds: 0 },
    generatedAt: '2026-11-10T12:00:00.000Z',
    computeMs: 3_100,
    ...overrides,
  };
}

export function collectingWeapons(overrides: Partial<WeaponAnalysisCollecting> = {}): WeaponAnalysisCollecting {
  return {
    status: 'collecting',
    recordingSince: '2026-10-27T08:03:41.000Z',
    availableFrom: '2026-11-03T08:03:41.000Z',
    battlesRecorded: 16_000,
    ...overrides,
  };
}
