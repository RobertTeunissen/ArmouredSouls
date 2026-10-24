import { describe, expect, it } from 'vitest';
import {
  blockedReasonText,
  boundsText,
  cycleColumnLabel,
  formatCredits,
  gatedFurtherDownText,
  hasUpgradableStables,
  highestTierText,
  lastCycleText,
  ordinal,
  stageCost,
  stageRangeText,
  statusDetailText,
  targetError,
  targetText,
  turnStatusLabel,
  turnStepLabel,
  upgradeResultText,
  upgradeWarningText,
  winRateVsHumansText,
} from '../automatonText';
import { LIBRARY, PROFILES, WEAPON_MAP, listItem, turnPreview } from './fixtures';

describe('automatonText (approved admin text, PLAYER_FACING_TEXT §6)', () => {
  it('labels Turn_Triggers as Cycle {n} · Prep {n} · Season start', () => {
    expect(turnStepLabel('settlement', 42)).toBe('Cycle 42');
    expect(turnStepLabel('preparation', 2)).toBe('Prep 2');
    expect(turnStepLabel('season_open', 0)).toBe('Season start');
    expect(cycleColumnLabel('settlement', 42)).toBe('42');
    expect(cycleColumnLabel('preparation', 2)).toBe('Prep 2');
  });

  it('labels cycle statuses', () => {
    expect(turnStatusLabel('completed', null)).toBe('Completed');
    expect(turnStatusLabel('skipped', 'program_off')).toBe('Skipped (Automatons stopped)');
    expect(turnStatusLabel('failed', 'AUTOMATON_PROFILE_INVALID')).toBe('Failed — AUTOMATON_PROFILE_INVALID');
  });

  it('formats credits with a minus sign for a negative balance', () => {
    expect(formatCredits(412_000)).toBe('₡412,000');
    expect(formatCredits(-12_400)).toBe('−₡12,400');
  });

  it('formats targets and bounds per Goal type', () => {
    expect(targetText({ type: 'facility', isMax: false }, 3)).toBe('L3');
    expect(targetText({ type: 'refine', isMax: false }, 8)).toBe('8 steps');
    expect(targetText({ type: 'economy', isMax: false }, 20)).toBe('20 cycles');
    expect(targetText({ type: 'economy', isMax: false }, 0)).toBe('off');
    expect(targetText({ type: 'weapons', isMax: false }, 3)).toBe('final');
    expect(targetText({ type: 'attributes', isMax: true }, 50)).toBe('Max');
    expect(boundsText({ type: 'facility', isMax: false }, { min: 0, max: 6 })).toBe('L0–L6');
    expect(boundsText({ type: 'robots', isMax: false }, { min: 1, max: 1 })).toBe('1');
    expect(targetError({ type: 'robots', isMax: false, bounds: { min: 1, max: 3 } }, 4)).toBe('Allowed 1–3');
    expect(targetError({ type: 'robots', isMax: false, bounds: { min: 1, max: 3 } }, 2)).toBeNull();
    expect(targetError({ type: 'robots', isMax: false, bounds: { min: 1, max: 3 } }, Number.NaN)).toBe('Allowed 1–3');
  });

  it('writes the Last cycle column', () => {
    expect(lastCycleText(PROFILES[0])).toBe('Bought 1 · saving for Booking Office L2');
    expect(lastCycleText(PROFILES[2])).toBe('Not active yet');
    const saving = listItem({ lastTurn: { ...PROFILES[0].lastTurn!, actionCount: 0, savingGoal: { goalId: 'g', position: 3, label: 'Robots', target: 4 } } });
    expect(lastCycleText(saving)).toBe('Saving for Robot 4');
    const economy = listItem({ lastTurn: { ...PROFILES[0].lastTurn!, actionCount: 0, savingGoal: { goalId: 'g', position: 4, label: 'Economy', target: 20 } } });
    expect(lastCycleText(economy)).toBe('Saving for Economy (payback ≤ 20 cycles)');
  });

  it('writes the highest tier with its mode', () => {
    expect(highestTierText('gold', 'league_3v3')).toBe('Gold · 3v3 League');
    expect(highestTierText('champion', 'koth')).toBe('Champion · King of the Hill');
    expect(highestTierText('bronze', 'tag_team')).toBe('Bronze · Tag Team');
    expect(highestTierText(null, 'league_1v1')).toBe('—');
    expect(highestTierText('gold', null)).toBe('—');
    expect(highestTierText(null, null)).toBe('—');
  });

  it('writes ordinals', () => {
    expect([1, 2, 3, 4, 10, 11, 12, 13, 21, 22, 23, 101, 111, 112].map(ordinal))
      .toEqual(['1st', '2nd', '3rd', '4th', '10th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st', '111th', '112th']);
  });

  it('writes the win rate vs humans with its sample size', () => {
    const rate = { wins: 61, losses: 78, draws: 3, total: 142, percentage: 43 };
    expect(winRateVsHumansText(rate)).toBe('43% · 61–78–3 (n = 142)');
    expect(winRateVsHumansText(rate, true)).toBe('43% (n = 142)');
    expect(winRateVsHumansText({ wins: 0, losses: 0, draws: 0, total: 0, percentage: null })).toBe('— (n = 0)');
    expect(winRateVsHumansText({ wins: 0, losses: 0, draws: 0, total: 0, percentage: null }, true)).toBe('— (n = 0)');
    expect(winRateVsHumansText(null)).toBe('—');
  });

  it('writes the build order status details', () => {
    const preview = turnPreview();
    const [done, bought, saving, waiting] = preview.goals;
    expect(statusDetailText(done, preview.actions)).toBe('');
    expect(statusDetailText(bought, preview.actions)).toBe('Bought Booking Office L2 for ₡150,000');
    expect(statusDetailText(saving, preview.actions)).toBe('needs ₡225,000, has ₡166,000');
    expect(statusDetailText(waiting, preview.actions)).toBe('will be blocked when reached: Combat Training Academy L4 needs 1,000 prestige');
    expect(gatedFurtherDownText(preview.goals)).toBe('Gated further down: goal 4 (Combat Training Academy L4) — each needs 1,000 prestige.');
  });

  it('writes the blocked reasons', () => {
    expect(blockedReasonText('prestige_gate', { facilityType: 'roster_expansion', level: 4, prestigeRequired: 1000, prestigeHeld: 640 }))
      .toBe('Roster Expansion L4 needs 1,000 prestige (has 640)');
    expect(blockedReasonText('roster_limit', {})).toBe('roster full');
    expect(blockedReasonText('no_blueprint', { slotIndex: 4 })).toBe('no blueprint for robot 4');
    expect(blockedReasonText('awaiting_final_weapon', {})).toBe('waiting for final weapon');
    expect(blockedReasonText('storage_limit', {})).toBe('storage full at Storage Facility L10, nothing to sell');
    expect(blockedReasonText('name_unavailable', { slotIndex: 2 })).toBe('no free name for robot 2');
  });

  it('derives the range of a stage with the approved tie wording', () => {
    expect(stageRangeText({ main: 'Laser Pistol' }, 'single', WEAPON_MAP)).toBe('short');
    expect(stageRangeText({ main: 'Laser Pistol', offhand: 'Volt Sabre' }, 'dual_wield', WEAPON_MAP)).toBe('melee (Volt Sabre has the higher damage per second)');
    expect(stageRangeText({ main: 'Volt Sabre', offhand: 'Nova Caster' }, 'dual_wield', WEAPON_MAP)).toBe('melee (equal damage per second; the main hand decides)');
    expect(stageRangeText({ main: 'Laser Pistol', offhand: 'Tower Shield' }, 'weapon_shield', WEAPON_MAP)).toBe('short');
  });

  it('charges only the hands that change between stages', () => {
    const path = [{ main: 'Laser Pistol', offhand: 'Laser Pistol' }, { main: 'Volt Sabre', offhand: 'Laser Pistol' }];
    expect(stageCost(path, 0, WEAPON_MAP)).toBe(114_000);
    expect(stageCost(path, 1, WEAPON_MAP)).toBe(425_000);
  });

  it('writes the upgrade texts', () => {
    expect(hasUpgradableStables(LIBRARY[0])).toBe(true);
    expect(hasUpgradableStables(LIBRARY[1])).toBe(false);
    expect(upgradeWarningText([{ catalogueKey: 'a', stableName: 'A', fromVersion: 1, code: 'X', reason: 'too few' }]))
      .toBe('These stables could not be upgraded to this version yet: A (too few) Fix them in the Editor before you upgrade.');
    expect(upgradeResultText({ strategyKey: 'swarm', toVersion: 2, confirm: true, upgraded: [{ catalogueKey: 'a', stableName: 'A', fromVersion: 1, toVersion: 2, changedFields: [] }], rejected: [] }))
      .toBe('Upgraded 1 stables to v2.');
  });
});
