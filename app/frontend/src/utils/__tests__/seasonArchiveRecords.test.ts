import { describe, it, expect } from 'vitest';
import { archiveRecordCatalogue } from '../seasonArchiveRecords';
import type { SeasonDetail } from '@shared/types';

type Row = SeasonDetail['accolades'][number];

function row(overrides: Partial<Row>): Row {
  return {
    category: 'mostKills', rank: 1, subjectName: 'HitHard', value: 756, valueLabel: 'kills', mode: null,
    stableName: 'Hit Machine', isGeneratedSubject: false, subjectStableType: 'human', ...overrides,
  };
}

const viewer = { stableName: 'ApenRots', userId: 7 };

describe('archiveRecordCatalogue', () => {
  it('uses the Hall of Records keys, titles, groups and value formats', () => {
    // Board order: win rate, destructions (Robots), zone time (KotH & Melee), richest (Stables).
    const [winRate, kills, zoneTime, richest] = archiveRecordCatalogue([
      row({ category: 'mostKills' }),
      row({ category: 'highestWinRate', value: 97.2, valueLabel: 'win %' }),
      row({ category: 'richestStable', subjectName: 'Sexy Stables', stableName: 'Sexy Stables', value: 103999060, valueLabel: 'credits' }),
      row({ category: 'kothMostZoneTime', value: 3631.6, valueLabel: 'zone seconds', mode: 'koth' }),
    ], viewer);

    expect(kills).toMatchObject({ key: 'mostKills', group: 'robots', title: 'Most destructions', ranked: true });
    expect(kills.variants[0].rows[0]).toMatchObject({ rank: 1, value: '756', holder: { subjectName: 'HitHard' } });
    expect(winRate.variants[0].rows[0].value).toBe('97.2%');
    expect(richest).toMatchObject({ key: 'richestStable', group: 'stables' });
    // Stable records name no robot.
    expect(richest.variants[0].rows[0].holder.subjectName).toBeNull();
    expect(zoneTime).toMatchObject({ key: 'kothZoneTime', group: 'koth-melee' });
    expect(zoneTime.variants[0].rows[0].value).toBe('60m 31s');
  });

  it('orders records like the board and ranks rows by their stored rank', () => {
    const catalogue = archiveRecordCatalogue([
      row({ category: 'highestPrestige', rank: 2, stableName: 'B', subjectName: 'B' }),
      row({ category: 'highestPrestige', rank: 1, stableName: 'A', subjectName: 'A' }),
      row({ category: 'mostBattles' }),
    ], viewer);
    expect(catalogue.map((r) => r.key)).toEqual(['mostBattles', 'highestPrestige']);
    expect(catalogue[1].variants[0].rows.map((r) => r.holder.stable.name)).toEqual(['A', 'B']);
  });

  it('splits per-mode records into variants in board order', () => {
    const [damage] = archiveRecordCatalogue([
      row({ category: 'mostDamageInBattle', mode: 'grand_melee', value: 4102 }),
      row({ category: 'mostDamageInBattle', mode: 'league_1v1', value: 2736 }),
    ], viewer);
    expect(damage.variants.map((v) => [v.key, v.label])).toEqual([['league_1v1', '1v1 League'], ['grand_melee', 'Grand Melee']]);
  });

  it('keeps tournament champions a log with the tournament name as value', () => {
    const [champions] = archiveRecordCatalogue([
      row({ category: 'tournamentChampion', mode: 'tournament_3v3', value: 0, valueLabel: '3v3 Tournament #16', subjectName: 'De Toppers' }),
    ], viewer);
    expect(champions).toMatchObject({ key: 'tournamentChampions', ranked: false });
    expect(champions.variants[0]).toMatchObject({ key: 'tournament_3v3', label: '3v3' });
    expect(champions.variants[0].rows[0].value).toBe('3v3 Tournament #16');
  });

  it('gives only the viewer\u2019s own (non-generated) rows the viewer\u2019s id', () => {
    const [kills] = archiveRecordCatalogue([
      row({ rank: 1, stableName: 'ApenRots' }),
      row({ rank: 2, stableName: 'ApenRots', isGeneratedSubject: true, subjectStableType: 'generated' }),
      row({ rank: 3, stableName: 'Hit Machine' }),
    ], viewer);
    expect(kills.variants[0].rows.map((r) => r.holder.stable.userId)).toEqual([7, null, null]);
    expect(kills.variants[0].rows[1].holder.stable.stableType).toBe('generated');
  });

  it('still reads categories the live Hall no longer has, and unknown ones', () => {
    const catalogue = archiveRecordCatalogue([
      row({ category: 'narrowestVictory', value: 1, valueLabel: 'HP remaining' }),
      row({ category: 'grandMeleeHighestLp', value: 1471, valueLabel: 'LP', mode: 'grand_melee' }),
      row({ category: 'someFutureRecord', value: 3, valueLabel: 'things' }),
    ], viewer);
    expect(catalogue.map((r) => [r.key, r.title, r.variants[0].rows[0].value])).toEqual([
      ['narrowestVictory', 'Narrowest victory', '1 HP'],
      ['meleeLp', 'Grand Melee LP', '1,471'],
      ['someFutureRecord', 'Some Future Record', '3 things'],
    ]);
  });
});
