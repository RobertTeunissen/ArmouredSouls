import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  boardColumns,
  buildRecordCatalogue,
  findMyPlaces,
  formatRecordDuration,
  rankRows,
  summariseMyPlaces,
  tileFootprint,
} from '../hallOfRecords';
import { emptyRecords, fullRecords, VIEWER } from '../../components/hall-of-records/__tests__/fixtures';
import type { RecordsData } from '../../components/hall-of-records/types';

const holder = { subjectName: 'R', stable: { name: 'S', userId: null, stableType: null } };

describe('buildRecordCatalogue', () => {
  it('lists every record once, with unique URL keys, in board group order', () => {
    const catalogue = buildRecordCatalogue(fullRecords());
    const keys = catalogue.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
    const groups = catalogue.map((r) => r.group);
    expect(groups).toEqual([...groups].sort((a, b) =>
      ['robots', 'battles', 'streaks', 'koth-melee', 'stables'].indexOf(a) - ['robots', 'battles', 'streaks', 'koth-melee', 'stables'].indexOf(b)));
  });

  it('has no Narrowest Victory and none of the removed team duration records', () => {
    const titles = buildRecordCatalogue(fullRecords()).map((r) => r.title.toLowerCase());
    for (const removed of ['narrowest', 'fastest', 'longest survival', 'longest battle', 'expensive', 'grand melee lp']) {
      expect(titles.some((t) => t.includes(removed))).toBe(false);
    }
  });

  it('keeps only the modes that have entries in per-mode records', () => {
    const catalogue = buildRecordCatalogue(fullRecords());
    const damage = catalogue.find((r) => r.key === 'mostDamageInBattle');
    expect(damage?.variants.map((v) => v.key)).toEqual(['league_1v1', 'grand_melee']);
    const decisive = catalogue.find((r) => r.key === 'mostDecisiveVictory');
    expect(decisive?.variants.map((v) => v.key)).toEqual(['3v3']);
    const streaks = catalogue.find((r) => r.key === 'leagueWinStreak');
    expect(streaks?.variants.map((v) => v.label)).toEqual(['1v1 League', '2v2 League']);
  });

  it('leaves every record empty for a fresh season', () => {
    const catalogue = buildRecordCatalogue(emptyRecords());
    expect(catalogue.length).toBeGreaterThan(0);
    expect(catalogue.every((r) => r.variants.length === 0)).toBe(true);
  });

  it('tolerates a payload with sections missing (an older cached response)', () => {
    const catalogue = buildRecordCatalogue({ timestamp: '' } as unknown as RecordsData);
    expect(catalogue.every((r) => r.variants.length === 0)).toBe(true);
  });

  it('links the three records with a full leaderboard page to it', () => {
    const catalogue = buildRecordCatalogue(fullRecords());
    const linked = Object.fromEntries(catalogue.filter((r) => r.leaderboard).map((r) => [r.key, r.leaderboard?.href]));
    expect(linked).toEqual({
      mostKills: '/leaderboards/losses',
      highestFame: '/leaderboards/fame',
      highestPrestige: '/leaderboards/prestige',
    });
  });

  it('formats values and context the way the board shows them', () => {
    const catalogue = buildRecordCatalogue(fullRecords());
    const top = (key: string) => catalogue.find((r) => r.key === key)?.variants[0].rows[0];

    expect(top('mostBattles')).toMatchObject({ value: '739', detail: '300-280-20 in win/loss modes' });
    expect(top('highestWinRate')).toMatchObject({ value: '97.2%', detail: '69 of 71 battles' });
    expect(top('mostKills')).toMatchObject({ value: '756', detail: '1.12 per battle' });
    expect(top('biggestUpset')).toMatchObject({ value: '+446 ELO', detail: '1,491 beat Ironclad (1,937)', battleId: 203 });
    expect(top('kothZoneTime')).toMatchObject({ value: '60m 31s' });
    expect(top('kothZoneDominator')).toMatchObject({ value: '1,163.1' });
    expect(top('kothAvgZoneScore')?.value).toBe('25.3');
    expect(top('mostDecisiveVictory')).toMatchObject({ value: '975 HP', detail: 'beat Iron Warriors' });
  });

  it('marks a running streak, and links only 1v1 streak holders as robots', () => {
    const streaks = buildRecordCatalogue(fullRecords()).find((r) => r.key === 'leagueWinStreak');
    const [oneVsOne, twoVsTwo] = streaks?.variants ?? [];
    expect(oneVsOne.rows[0]).toMatchObject({ running: true, detail: 'still running' });
    expect(oneVsOne.rows[0].holder.robotId).toBe(101);
    expect(twoVsTwo.rows[0]).toMatchObject({ running: false, detail: 'current streak 2' });
    expect(twoVsTwo.rows[0].holder.robotId).toBeUndefined();
  });

  it('treats tournament champions as a log, newest first, not a ranking', () => {
    const champions = buildRecordCatalogue(fullRecords()).find((r) => r.key === 'tournamentChampions');
    expect(champions?.ranked).toBe(false);
    expect(champions?.variants.map((v) => v.key)).toEqual(['1v1', '3v3']);
    expect(champions?.variants[0].rows[0].holder).toMatchObject({ subjectName: 'CT-7567 Rex', robotId: 101 });
    expect(champions?.variants[1].rows[0].holder.robotId).toBeUndefined();
  });
});

describe('rankRows', () => {
  it('gives equal values the same rank and skips the next ranks', () => {
    const rows = rankRows([10, 10, 8, 8, 8, 3].map((sortValue) => ({ sortValue, value: String(sortValue), holder })));
    expect(rows.map((r) => r.rank)).toEqual([1, 1, 3, 3, 3, 6]);
  });

  it('never ranks a row above the one before it, and ranks the first row 1', () => {
    fc.assert(fc.property(fc.array(fc.integer({ min: 0, max: 50 }), { minLength: 1, maxLength: 10 }), (values) => {
      const sorted = [...values].sort((a, b) => b - a);
      const rows = rankRows(sorted.map((sortValue) => ({ sortValue, value: '', holder })));
      expect(rows[0].rank).toBe(1);
      for (let i = 1; i < rows.length; i++) {
        expect(rows[i].rank).toBeGreaterThanOrEqual(rows[i - 1].rank);
        expect(rows[i].rank).toBeLessThanOrEqual(i + 1);
      }
    }));
  });
});

describe('findMyPlaces / summariseMyPlaces', () => {
  it('finds every ranked row the viewer holds, best rank first, and skips the champions log', () => {
    const catalogue = buildRecordCatalogue(fullRecords());
    const places = findMyPlaces(catalogue, VIEWER.userId);
    expect(places.length).toBeGreaterThan(0);
    expect(places.every((p) => p.row.holder.stable.userId === VIEWER.userId)).toBe(true);
    expect(places.some((p) => p.recordKey === 'tournamentChampions')).toBe(false);
    expect(places.map((p) => p.row.rank)).toEqual([...places.map((p) => p.row.rank)].sort((a, b) => a - b));
  });

  it('counts held records and top-10 places', () => {
    const catalogue = buildRecordCatalogue(fullRecords());
    const summary = summariseMyPlaces(findMyPlaces(catalogue, 11));
    expect(summary.held.length).toBeGreaterThan(5);
    expect(summary.placeCount).toBeGreaterThanOrEqual(summary.held.length);

    const viewer = summariseMyPlaces(findMyPlaces(catalogue, VIEWER.userId));
    expect(viewer.held).toHaveLength(0);
    expect(viewer.best?.row.rank).toBe(2);
  });

  it('returns nothing without a viewer', () => {
    expect(findMyPlaces(buildRecordCatalogue(fullRecords()), null)).toEqual([]);
    expect(summariseMyPlaces([])).toEqual({ held: [], placeCount: 0, best: null });
  });
});

describe('tileFootprint / boardColumns', () => {
  const catalogue = buildRecordCatalogue(fullRecords()).filter((r) => r.variants.length > 0);
  const inGroup = (group: string) => catalogue.filter((r) => r.group === group);

  it('gives single records one cell, per-mode records two columns, long per-mode lists two rows', () => {
    const footprint = (key: string) => tileFootprint(catalogue.find((r) => r.key === key)!);
    expect(footprint('highestElo')).toEqual({ cols: 1, rows: 1 });
    expect(footprint('mostDamageInBattle')).toEqual({ cols: 2, rows: 1 }); // two modes in the fixture
    expect(footprint('tournamentChampions')).toEqual({ cols: 1, rows: 1 });
  });

  it('uses three columns when that leaves fewer gaps, four otherwise', () => {
    expect(boardColumns(inGroup('robots'))).toBe(3); // 6 cells
    expect(boardColumns(inGroup('koth-melee'))).toBe(4); // 7 cells: one gap with four, two with three
    expect(boardColumns(inGroup('stables'))).toBe(4); // 4 cells
    expect(boardColumns([])).toBe(4);
  });
});

describe('formatRecordDuration', () => {
  it.each([[0, '0.0s'], [45, '45.0s'], [60, '1m 0s'], [3631.6, '60m 31s'], [-5, '0.0s']])('%s → %s', (seconds, expected) => {
    expect(formatRecordDuration(seconds)).toBe(expected);
  });
});
