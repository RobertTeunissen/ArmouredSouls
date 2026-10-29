/**
 * Unit tests for the League Health labels, URL state and sentences.
 */
import { describe, expect, it } from 'vitest';
import {
  attentionText,
  demotionText,
  formatShare,
  formatShortCount,
  gridStatusText,
  leagueHealthHref,
  promotionText,
  readLeagueHealthMode,
  readLeagueHealthTier,
  rulesSummary,
  seasonLabel,
  stableMixText,
  standingsHref,
  tierStatusText,
} from '../adminLeagueHealthFormat';
import { overview, tier } from '../../pages/admin/__tests__/leagueHealthFixture';

const data = overview();
const oneV1 = data.modes[0];
const twoV2 = data.modes[1];
const koth = data.modes[4];

describe('URL state and links', () => {
  it('reads known modes and tiers and falls back otherwise', () => {
    expect(readLeagueHealthMode('tag_team')).toBe('tag_team');
    expect(readLeagueHealthMode('x')).toBe('league_1v1');
    expect(readLeagueHealthMode(null)).toBe('league_1v1');
    expect(readLeagueHealthTier('gold')).toBe('gold');
    expect(readLeagueHealthTier('mythic')).toBeNull();
  });

  it('builds page and player standings links', () => {
    expect(leagueHealthHref('league_1v1')).toBe('/admin/league-health');
    expect(leagueHealthHref('koth', 'gold')).toBe('/admin/league-health?mode=koth&tier=gold');
    expect(standingsHref('league_1v1', 'gold', 'gold_2')).toBe('/league-standings?mode=1v1&tier=gold&instance=gold_2');
    expect(standingsHref('grand_melee', 'bronze')).toBe('/league-standings?mode=grand_melee&tier=bronze');
  });
});

describe('numbers', () => {
  it('shortens counts and formats shares', () => {
    expect(formatShortCount(576)).toBe('576');
    expect(formatShortCount(2744)).toBe('2.7k');
    expect(formatShortCount(12_400)).toBe('12k');
    expect(formatShare(234, 2900)).toBe('8%');
    expect(formatShare(1, 1000)).toBe('<1%');
    expect(formatShare(0, 0)).toBe('0%');
  });

  it('describes the stable mix without zero counts', () => {
    expect(stableMixText({ human: 15, automaton: 0, generated: 1982 })).toBe('15 human · 1,982 generated');
    expect(stableMixText({ human: 0, automaton: 0, generated: 0 })).toBe('no stables');
  });

  it('labels the season', () => {
    expect(seasonLabel({ number: 1, phase: 'competitive', cycle: 88, lengthCycles: 100 })).toBe('Season 1 · cycle 88 of 100');
    expect(seasonLabel({ number: 2, phase: 'preparation', cycle: 0, lengthCycles: 100 })).toBe('Season 2 · preparation');
    expect(seasonLabel(null)).toBeNull();
  });
});

describe('tier texts', () => {
  it('words each status for the table and the grid', () => {
    const [bronze, , , platinum] = oneV1.tiers;
    expect(tierStatusText(bronze, oneV1)).toEqual({ label: 'OK', reason: '234 unsubscribed' });
    expect(gridStatusText(bronze, oneV1)).toBe('OK · 8% unsubscribed');
    expect(tierStatusText(platinum, oneV1)).toEqual({ label: 'Low promotion', reason: 'avg 6.4 of 27 places' });
    expect(gridStatusText(platinum, oneV1)).toBe('Avg 6.4 of 27 promote');
    const diamond = twoV2.tiers[4];
    expect(tierStatusText(diamond, twoV2)).toEqual({ label: 'Promotion blocked', reason: "Champion can't open" });
    expect(gridStatusText(twoV2.tiers[5], twoV2)).toBe('Empty');
    expect(gridStatusText(koth.tiers[2], koth)).toBe('OK · few demotions');
    const none = tier('diamond', { status: { level: 'warning', code: 'no_promotions' } });
    expect(tierStatusText(none, oneV1)).toEqual({ label: 'No promotions', reason: 'none in the last 5 rebalances' });
    const frozen = tier('champion', { status: { level: 'warning', code: 'frozen' } });
    expect(gridStatusText(frozen, oneV1)).toBe('Frozen · below 10');
  });

  it('shows last moves of the places, the average and the gate', () => {
    const [bronze, silver, , , , champion] = oneV1.tiers;
    expect(promotionText(silver, oneV1)).toEqual({ value: '4 of 9', caption: 'avg 3.6 · needs 50 LP' });
    expect(demotionText(silver, oneV1)).toEqual({ value: '3 of 9', caption: 'avg 2.4' });
    expect(demotionText(bronze, oneV1)).toEqual({ value: '—', caption: 'lowest tier' });
    expect(promotionText(champion, oneV1)).toEqual({ value: '—', caption: 'top tier' });
    expect(promotionText(koth.tiers[1], koth)).toEqual({ value: '4 of 9', caption: 'avg 3.6 · no LP gate' });
  });

  it('says when a tier is not judged yet or has no places', () => {
    const early = tier('gold', { promotion: { ...tier('gold').promotion, flow: null } });
    expect(promotionText(early, oneV1)).toEqual({ value: '9 places', caption: 'not judged yet · needs 75 LP' });
    const small = tier('gold', { total: 7, promotion: { ...tier('gold').promotion, slots: 0 }, demotion: { slots: 0, qualifyingNow: 0, flow: null } });
    expect(promotionText(small, oneV1)).toEqual({ value: '0 places', caption: 'below 10 robots' });
    expect(demotionText(small, twoV2)).toEqual({ value: '0 places', caption: 'below 10 teams' });
  });

  it('summarises the rules of a mode', () => {
    expect(rulesSummary(oneV1)).toBe('Top and bottom 10% of each instance · instance needs 10 robots · 5 cycles in tier · LP line rises per tier · an empty tier opens with 3 promotions');
    expect(rulesSummary(koth)).toContain('10 cycles in tier · no LP gate (ranked by points)');
  });
});

describe('attention sentences', () => {
  it('words a blocked tier across modes', () => {
    const text = attentionText(data.attention[0]);
    expect(text.title).toBe("Champion can't open in 2v2, 3v3 and Tag Team");
    expect(text.detail).toBe('Diamond has 18, 17 and 16 teams: 1 promotion place each. Opening an empty tier needs 3 promotions at once.');
    expect(text.href).toBe('/admin/league-health?mode=league_2v2&tier=diamond');
    expect(text.destination).toBe('2v2 Diamond');
  });

  it('words low promotion, low demotion and unsubscribed rows', () => {
    expect(attentionText(data.attention[1])).toMatchObject({
      title: 'Few promotions out of 1v1 Platinum',
      detail: 'On average 6.4 of 27 promotion places were filled over the last 5 rebalances.',
    });
    expect(attentionText(data.attention[2])).toMatchObject({
      title: 'Demotion rarely moves',
      detail: 'In 1 tier fewer than a quarter of the demotion places are filled on average (last 5 rebalances): KotH Gold 0 of 63.',
      href: '/admin/league-health?mode=koth&tier=gold',
    });
    expect(attentionText(data.attention[3])).toMatchObject({
      title: 'Unsubscribed standings rows',
      detail: '1v1 Bronze 234 (8%). They keep their seat and count toward zone sizes.',
    });
  });

  it('names each mode when averages come from several modes', () => {
    const item = {
      ...data.attention[1],
      entries: [
        data.attention[1].entries[0],
        { ...data.attention[1].entries[0], mode: 'grand_melee' as const, promotionSlots: 18, promotionAverage: 4.2 },
      ],
    };
    expect(attentionText(item).detail).toBe('On average 6.4 of 27 (1v1) and 4.2 of 18 (Grand Melee) promotion places were filled over the last 5 rebalances.');
  });

  it('words frozen tiers and tiers without promotions', () => {
    const base = { ...data.attention[1], entries: [{ ...data.attention[1].entries[0], tier: 'champion', total: 7, promotionSlots: 0 }] };
    expect(attentionText({ ...base, code: 'frozen', tier: 'champion' }).title).toBe('1v1 Champion is frozen');
    expect(attentionText({ ...base, code: 'no_promotions', tier: 'champion' }).detail).toBe('None in the last 5 rebalances, with 0 promotion places.');
  });
});
