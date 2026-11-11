/**
 * Stable page trophy cabinet: pins first, then the rarest other unlocks.
 */
jest.mock('../../../lib/prisma', () => ({ __esModule: true, default: {} }));

import { buildShowcase, SHOWCASE_SIZE } from '../achievementQueries';
import { ACHIEVEMENTS } from '../../../config/achievements';
import type { AchievementRarityCache } from '../achievementTypes';

const visible = ACHIEVEMENTS.filter((a) => !a.hidden);
const hidden = ACHIEVEMENTS.find((a) => a.hidden);
const at = (day: number): Date => new Date(Date.UTC(2026, 9, day));
const unlock = (id: string, day = 1) => ({ achievementId: id, unlockedAt: at(day) });

function cache(counts: Record<string, number>): AchievementRarityCache {
  return { counts: new Map(Object.entries(counts)), totalActivePlayers: 80, refreshedAt: new Date() };
}

describe('buildShowcase', () => {
  it('fills the cabinet with the rarest unlocks when nothing is pinned', () => {
    const [a, b, c] = visible;
    const showcase = buildShowcase([], [unlock(a.id), unlock(b.id), unlock(c.id)], cache({ [a.id]: 40, [b.id]: 2, [c.id]: 9 }));

    expect(showcase.map((s) => [s.id, s.holders, s.pinned])).toEqual([
      [b.id, 2, false],
      [c.id, 9, false],
      [a.id, 40, false],
    ]);
  });

  it('puts pins first in the owner order and does not repeat them', () => {
    const [a, b, c] = visible;
    const showcase = buildShowcase([c.id, a.id], [unlock(a.id), unlock(b.id), unlock(c.id)], cache({ [a.id]: 1, [b.id]: 5, [c.id]: 50 }));

    expect(showcase.map((s) => [s.id, s.pinned])).toEqual([
      [c.id, true],
      [a.id, true],
      [b.id, false],
    ]);
  });

  it(`never shows more than ${SHOWCASE_SIZE} badges`, () => {
    const unlocks = visible.slice(0, 10).map((a) => unlock(a.id));
    expect(buildShowcase([], unlocks, cache({}))).toHaveLength(SHOWCASE_SIZE);
  });

  it('never auto-fills a hidden achievement, but keeps a pinned one', () => {
    if (!hidden) return;
    const [a] = visible;
    expect(buildShowcase([], [unlock(hidden.id), unlock(a.id)], cache({ [hidden.id]: 0 })).map((s) => s.id)).toEqual([a.id]);
    expect(buildShowcase([hidden.id], [unlock(hidden.id)], cache({})).map((s) => s.id)).toEqual([hidden.id]);
  });

  it('skips pins that are not unlocked or no longer exist', () => {
    const [a] = visible;
    expect(buildShowcase(['NOPE', a.id], [], cache({}))).toEqual([]);
  });

  it('without a loaded rarity cache, orders by harder tier and leaves holders unknown', () => {
    const easy = visible.find((a) => a.tier === 'easy');
    const hard = visible.find((a) => a.tier === 'hard');
    if (!easy || !hard) throw new Error('fixture needs an easy and a hard achievement');

    const showcase = buildShowcase([], [unlock(easy.id), unlock(hard.id)], null);

    expect(showcase.map((s) => s.id)).toEqual([hard.id, easy.id]);
    expect(showcase.every((s) => s.holders === null)).toBe(true);
  });

  it('leaves holders unknown for an unlock the rarity cache has not seen yet', () => {
    // E.g. the achievements a Season_Rollover re-awards after the settlement
    // refresh: "No player holds this" under the stable's own badge is wrong.
    const [a, b] = visible;
    const before = { ...cache({ [a.id]: 12 }), refreshedAt: at(10) };

    const showcase = buildShowcase([], [unlock(a.id, 11), unlock(b.id, 11), unlock(visible[2].id, 9)], before);

    expect(new Map(showcase.map((s) => [s.id, s.holders]))).toEqual(new Map([
      [a.id, 12], // listed: the count stands
      [b.id, null], // not listed, unlocked after the refresh: unknown
      [visible[2].id, 0], // not listed, unlocked before it: no human holder
    ]));
  });

  it('breaks rarity ties by the most recent unlock', () => {
    const [a, b] = visible.filter((x) => x.tier === 'easy');
    const showcase = buildShowcase([], [unlock(a.id, 1), unlock(b.id, 20)], cache({ [a.id]: 3, [b.id]: 3 }));
    expect(showcase.map((s) => s.id)).toEqual([b.id, a.id]);
  });
});
