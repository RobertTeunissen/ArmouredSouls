import { buildAutomatonRequestKey, type AutomatonRequestKeyParts } from '../requestKeys';
import {
  createEconomicRequestIdentity,
  type EconomicOperation,
} from '../../financial/economicRequestReplayService';

const OPERATIONS: EconomicOperation[] = [
  'weapon_purchase',
  'weapon_sale',
  'weapon_refinement',
  'facility_upgrade',
  'robot_creation',
  'attribute_upgrade',
];

const base: AutomatonRequestKeyParts = {
  profileId: 7,
  seasonNumber: 3,
  trigger: 'settlement',
  slot: 412,
  attempt: 2,
  ordinal: 5,
};

describe('requestKeys (R7.7, design §9.3)', () => {
  it('derives the key from profile, season, trigger, slot, attempt and ordinal', () => {
    expect(buildAutomatonRequestKey(base)).toBe('automaton.7.s3.settlement.412.a2.5');
    expect(buildAutomatonRequestKey({ ...base, trigger: 'season_open', slot: 0, attempt: 1, ordinal: 1 }))
      .toBe('automaton.7.s3.season_open.0.a1.1');
  });

  it('is deterministic and distinct per component', () => {
    const key = buildAutomatonRequestKey(base);
    expect(buildAutomatonRequestKey({ ...base })).toBe(key);
    const variants: Partial<AutomatonRequestKeyParts>[] = [
      { profileId: 8 }, { seasonNumber: 4 }, { trigger: 'preparation' }, { slot: 413 }, { attempt: 3 }, { ordinal: 6 },
    ];
    const keys = new Set(variants.map((v) => buildAutomatonRequestKey({ ...base, ...v })));
    expect(keys.size).toBe(variants.length);
    expect(keys.has(key)).toBe(false);
  });

  it('contains no ":" so the financial event identity accepts it', () => {
    expect(buildAutomatonRequestKey(base)).not.toContain(':');
  });

  it('produces a financialEventId within 191 characters for every operation at extreme values', () => {
    const extreme: AutomatonRequestKeyParts = {
      profileId: 2_147_483_647,
      seasonNumber: 2_147_483_647,
      trigger: 'season_open',
      slot: 2_147_483_647,
      attempt: 2_147_483_647,
      ordinal: 2_147_483_647,
    };
    const key = buildAutomatonRequestKey(extreme);
    for (const operation of OPERATIONS) {
      const identity = createEconomicRequestIdentity(2_147_483_647, operation, key, {});
      expect(identity.financialEventId.length).toBeLessThanOrEqual(191);
      expect(identity.requestKey).toBe(key);
    }
  });

  it.each([
    ['profileId', { profileId: 0 }],
    ['seasonNumber', { seasonNumber: -1 }],
    ['slot', { slot: 1.5 }],
    ['attempt', { attempt: 0 }],
    ['ordinal', { ordinal: 0 }],
  ])('rejects an invalid %s', (_label, override) => {
    expect(() => buildAutomatonRequestKey({ ...base, ...override })).toThrow(RangeError);
  });
});
