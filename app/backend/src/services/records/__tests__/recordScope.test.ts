/**
 * #595 — the Hall of Records players' lists keep each entry's place among
 * every stable (filtering never re-ranks).
 */
jest.mock('../../../lib/prisma', () => ({ __esModule: true, default: {} }));

import * as fc from 'fast-check';
import { pickPlayerPlaces, placeField, RECORD_LIST_SIZE, topPlaced, type PlayerSets } from '../recordScope';

interface Row { id: number; value: number; player: boolean }

const value = (row: Row): number => row.value;
const isPlayer = (row: Row): boolean => row.player;

describe('pickPlayerPlaces', () => {
  it('keeps the players\' rows with their place among every row', () => {
    const ordered: Row[] = [
      { id: 1, value: 90, player: false },
      { id: 2, value: 80, player: true },
      { id: 3, value: 70, player: false },
      { id: 4, value: 60, player: true },
    ];
    expect(pickPlayerPlaces(ordered, value, isPlayer).map(({ row, place }) => [row.id, place])).toEqual([[2, 2], [4, 4]]);
  });

  it('gives tied rows the place of the first of them, as the board ranks ties', () => {
    const ordered: Row[] = [
      { id: 1, value: 90, player: false },
      { id: 2, value: 80, player: false },
      { id: 3, value: 80, player: true },
      { id: 4, value: 70, player: true },
    ];
    expect(pickPlayerPlaces(ordered, value, isPlayer).map(({ place }) => place)).toEqual([2, 4]);
  });

  it('stops at the list size', () => {
    const ordered: Row[] = Array.from({ length: 30 }, (_, i) => ({ id: i, value: 100 - i, player: i % 2 === 0 }));
    const picked = pickPlayerPlaces(ordered, value, isPlayer);
    expect(picked).toHaveLength(RECORD_LIST_SIZE);
    expect(picked[RECORD_LIST_SIZE - 1].place).toBe(19);
  });

  it('never ranks a player above the rows that beat it (property)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ value: fc.integer({ min: 0, max: 20 }), player: fc.boolean() }), { maxLength: 60 }),
        (raw) => {
          const ordered = raw
            .map((r, id) => ({ id, ...r }))
            .sort((a, b) => b.value - a.value || a.id - b.id);
          for (const { row, place } of pickPlayerPlaces(ordered, value, isPlayer, 100)) {
            expect(place).toBe(ordered.filter((other) => other.value > row.value).length + 1);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('topPlaced', () => {
  const players: PlayerSets = { userIds: new Set(), robotIds: new Set([2]), teamIds: new Set() };
  const all: Row[] = [{ id: 1, value: 9, player: false }, { id: 2, value: 8, player: true }];

  it('reads the top 10 without places for every stable', async () => {
    const fetchRanked = jest.fn(async () => all);
    const rows = await topPlaced(fetchRanked, value, (row, sets) => sets.robotIds.has(row.id), undefined);
    expect(fetchRanked).toHaveBeenCalledWith(RECORD_LIST_SIZE);
    expect(rows).toEqual([{ row: all[0] }, { row: all[1] }]);
  });

  it('reads the whole ranking for players and keeps their places', async () => {
    const fetchRanked = jest.fn(async () => all);
    const rows = await topPlaced(fetchRanked, value, (row, sets) => sets.robotIds.has(row.id), players);
    expect(fetchRanked).toHaveBeenCalledWith(undefined);
    expect(rows).toEqual([{ row: all[1], place: 2 }]);
  });
});

describe('placeField', () => {
  it('adds a place only to players\' entries', () => {
    expect(placeField(undefined)).toEqual({});
    expect(placeField(14)).toEqual({ place: 14 });
  });
});
