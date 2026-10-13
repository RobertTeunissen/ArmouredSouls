import { describe, expect, it } from 'vitest';
import {
  deriveStablesView,
  matchesSearch,
  nextSort,
  parseStableSort,
  serializeStableSort,
  strategyOptions,
  type StableSort,
  type StableSortKey,
  type StablesViewInput,
} from '../stablesView';
import { LIBRARY, PROFILES, listItem } from './fixtures';
import type { ProfileListItem, TurnSummary } from '../../../../utils/automatonAdminApi';

const TURN = PROFILES[0].lastTurn as TurnSummary;

const ALL: StablesViewInput = { filter: 'all', strategy: null, query: '', sort: null };

/** Five stables with distinct values; `d-draft` is a draft, `e-never` never played and never ran a cycle. */
const STABLES: ProfileListItem[] = [
  listItem({
    catalogueKey: 'c-gold-1v1', stableName: 'Charlie', franchise: 'Mecha', strategyKey: 'swarm', strategyDisplayName: 'Swarm',
    robots: { current: 3, target: 5 }, credits: 300, prestige: 30, bestTier: 'gold', bestTierMode: 'league_1v1',
    lastTurn: { ...TURN, status: 'completed', actionCount: 0 },
  }),
  listItem({
    catalogueKey: 'a-gold-3v3', stableName: 'alpha', franchise: 'Transformers', strategyKey: 'trio', strategyDisplayName: 'Trio',
    robots: { current: 5, target: 5 }, credits: 100, prestige: 10, bestTier: 'gold', bestTierMode: 'league_3v3',
    lastTurn: { ...TURN, status: 'completed', actionCount: 4 },
  }),
  listItem({
    catalogueKey: 'b-silver', stableName: 'Bravo', franchise: 'Star Wars', strategyKey: 'swarm', strategyDisplayName: 'Swarm',
    robots: { current: 1, target: 5 }, credits: 200, prestige: 20, bestTier: 'silver', bestTierMode: 'koth',
    lastTurn: { ...TURN, status: 'failed', reason: 'X', actionCount: 0 }, needAttention: [{ code: 'balance_negative', label: 'Balance negative' }],
  }),
  listItem({
    catalogueKey: 'd-draft', stableName: 'Delta', franchise: 'Gundam', status: 'draft', strategyKey: 'generalist', strategyDisplayName: null,
    robots: { current: 0, target: 2 }, credits: null, prestige: null, bestTier: null, bestTierMode: null, lastTurn: null,
  }),
  listItem({
    catalogueKey: 'e-never', stableName: 'Echo', franchise: 'Zoids', strategyKey: 'trio', strategyDisplayName: 'Trio',
    robots: { current: 1, target: 5 }, credits: 400, prestige: 0, bestTier: null, bestTierMode: null, lastTurn: null,
  }),
];

function order(sort: StableSort | null, input: Partial<StablesViewInput> = {}): string[] {
  return deriveStablesView(STABLES, { ...ALL, ...input, sort }).rows.map((r) => r.catalogueKey);
}

describe('stablesView', () => {
  it('searches name, catalogue key and franchise, trimmed and case-insensitive', () => {
    const item = STABLES[1];
    expect(matchesSearch(item, '')).toBe(true);
    expect(matchesSearch(item, '   ')).toBe(true);
    expect(matchesSearch(item, '  ALPHA ')).toBe(true);
    expect(matchesSearch(item, 'gold-3v')).toBe(true);
    expect(matchesSearch(item, 'transform')).toBe(true);
    expect(matchesSearch(item, 'bravo')).toBe(false);
  });

  it('counts follow strategy and search, not the status chip', () => {
    const swarm = deriveStablesView(STABLES, { ...ALL, strategy: 'swarm', filter: 'attention' });
    expect(swarm.counts).toEqual({ all: 2, active: 2, draft: 0, attention: 1 });
    expect(swarm.rows.map((r) => r.catalogueKey)).toEqual(['b-silver']);
    expect(swarm.total).toBe(5);

    const searched = deriveStablesView(STABLES, { ...ALL, query: 'a', filter: 'draft' });
    // "a" matches alpha, Bravo, Charlie, Delta (Gundam) and Star Wars; not Echo / Zoids.
    expect(searched.counts).toEqual({ all: 4, active: 3, draft: 1, attention: 1 });
    expect(searched.rows.map((r) => r.catalogueKey)).toEqual(['d-draft']);

    const both = deriveStablesView(STABLES, { ...ALL, strategy: 'trio', query: 'zoids' });
    expect(both.counts.all).toBe(1);
    expect(both.rows.map((r) => r.catalogueKey)).toEqual(['e-never']);
  });

  it('keeps catalogue key order without a sort, and is safe on an empty or missing list', () => {
    expect(order(null)).toEqual(['a-gold-3v3', 'b-silver', 'c-gold-1v1', 'd-draft', 'e-never']);
    expect(deriveStablesView(null, ALL)).toEqual({ rows: [], counts: { all: 0, active: 0, draft: 0, attention: 0 }, total: 0 });
  });

  it.each<[StableSortKey, string[], string[]]>([
    ['name', ['a-gold-3v3', 'b-silver', 'c-gold-1v1', 'd-draft', 'e-never'], ['e-never', 'd-draft', 'c-gold-1v1', 'b-silver', 'a-gold-3v3']],
    // Swarm × 2 tie → catalogue key; the draft has no display name and sorts by its key "generalist".
    ['strategy', ['d-draft', 'b-silver', 'c-gold-1v1', 'a-gold-3v3', 'e-never'], ['a-gold-3v3', 'e-never', 'b-silver', 'c-gold-1v1', 'd-draft']],
    // Draft robots are null → last; b-silver and e-never both have 1 → catalogue key.
    ['robots', ['b-silver', 'e-never', 'c-gold-1v1', 'a-gold-3v3', 'd-draft'], ['a-gold-3v3', 'c-gold-1v1', 'b-silver', 'e-never', 'd-draft']],
    ['credits', ['a-gold-3v3', 'b-silver', 'c-gold-1v1', 'e-never', 'd-draft'], ['e-never', 'c-gold-1v1', 'b-silver', 'a-gold-3v3', 'd-draft']],
    ['prestige', ['e-never', 'a-gold-3v3', 'b-silver', 'c-gold-1v1', 'd-draft'], ['c-gold-1v1', 'b-silver', 'a-gold-3v3', 'e-never', 'd-draft']],
    // Silver < Gold · 1v1 < Gold · 3v3; never played and draft last.
    ['tier', ['b-silver', 'c-gold-1v1', 'a-gold-3v3', 'd-draft', 'e-never'], ['a-gold-3v3', 'c-gold-1v1', 'b-silver', 'd-draft', 'e-never']],
    // Failed (−1) < Bought nothing (0) < Bought 4; no cycle and draft last.
    ['lastCycle', ['b-silver', 'c-gold-1v1', 'a-gold-3v3', 'd-draft', 'e-never'], ['a-gold-3v3', 'c-gold-1v1', 'b-silver', 'd-draft', 'e-never']],
  ])('sorts by %s in both directions with nulls last', (key, asc, desc) => {
    expect(order({ key, direction: 'asc' })).toEqual(asc);
    expect(order({ key, direction: 'desc' })).toEqual(desc);
  });

  it('parses and serializes ?sort=key:dir', () => {
    for (const sort of [{ key: 'credits', direction: 'desc' }, { key: 'lastCycle', direction: 'asc' }] as StableSort[]) {
      expect(parseStableSort(serializeStableSort(sort))).toEqual(sort);
    }
    expect(serializeStableSort({ key: 'tier', direction: 'desc' })).toBe('tier:desc');
    for (const raw of [null, '', 'foo', 'credits', 'credits:up', ':desc', 'foo:asc', 'credits:desc:x']) {
      expect(parseStableSort(raw)).toBeNull();
    }
  });

  it('starts names ascending and numbers descending, and toggles the active column', () => {
    expect(nextSort(null, 'name')).toEqual({ key: 'name', direction: 'asc' });
    expect(nextSort(null, 'strategy')).toEqual({ key: 'strategy', direction: 'asc' });
    for (const key of ['robots', 'credits', 'prestige', 'tier', 'lastCycle'] as StableSortKey[]) {
      expect(nextSort(null, key)).toEqual({ key, direction: 'desc' });
    }
    expect(nextSort({ key: 'credits', direction: 'desc' }, 'credits')).toEqual({ key: 'credits', direction: 'asc' });
    expect(nextSort({ key: 'credits', direction: 'asc' }, 'credits')).toEqual({ key: 'credits', direction: 'desc' });
    expect(nextSort({ key: 'credits', direction: 'asc' }, 'name')).toEqual({ key: 'name', direction: 'asc' });
  });

  it('lists library strategies plus strategies in use, by display name', () => {
    expect(strategyOptions(STABLES, LIBRARY)).toEqual([
      { key: 'generalist', displayName: 'generalist' },
      { key: 'paragon', displayName: 'Paragon' },
      { key: 'swarm', displayName: 'Swarm' },
      { key: 'trio', displayName: 'Trio' },
    ]);
    expect(strategyOptions(null, null)).toEqual([]);
    expect(strategyOptions(PROFILES, null).map((o) => o.displayName)).toEqual(['Generalist', 'Swarm', 'Trio']);
  });
});
