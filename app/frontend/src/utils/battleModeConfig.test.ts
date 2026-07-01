/**
 * Unit tests for battleModeConfig — mode config lookup and fallback logic.
 */
import { describe, it, expect } from 'vitest';
import { getModeConfig, BATTLE_MODE_CONFIG, OUTCOME_BADGE_CONFIG } from './battleModeConfig';

describe('getModeConfig', () => {
  it('should return correct config for direct mode matches', () => {
    expect(getModeConfig('league_1v1')).toBe(BATTLE_MODE_CONFIG.league_1v1);
    expect(getModeConfig('league_2v2')).toBe(BATTLE_MODE_CONFIG.league_2v2);
    expect(getModeConfig('league_3v3')).toBe(BATTLE_MODE_CONFIG.league_3v3);
    expect(getModeConfig('tag_team')).toBe(BATTLE_MODE_CONFIG.tag_team);
    expect(getModeConfig('tournament_1v1')).toBe(BATTLE_MODE_CONFIG.tournament_1v1);
    expect(getModeConfig('tournament_2v2')).toBe(BATTLE_MODE_CONFIG.tournament_2v2);
    expect(getModeConfig('tournament_3v3')).toBe(BATTLE_MODE_CONFIG.tournament_3v3);
    expect(getModeConfig('koth')).toBe(BATTLE_MODE_CONFIG.koth);
    expect(getModeConfig('grand_melee')).toBe(BATTLE_MODE_CONFIG.grand_melee);
  });

  it('should fall back to league_1v1 for null/undefined', () => {
    expect(getModeConfig(null)).toBe(BATTLE_MODE_CONFIG.league_1v1);
    expect(getModeConfig(undefined)).toBe(BATTLE_MODE_CONFIG.league_1v1);
  });

  it('should fall back to league_1v1 for unknown types', () => {
    expect(getModeConfig('unknown_battle_type')).toBe(BATTLE_MODE_CONFIG.league_1v1);
  });

  it('should infer tournament type from partial strings', () => {
    expect(getModeConfig('some_tournament_match')).toBe(BATTLE_MODE_CONFIG.tournament_1v1);
    expect(getModeConfig('tournament_2v2_final')).toBe(BATTLE_MODE_CONFIG.tournament_2v2);
    expect(getModeConfig('tournament_3v3_semi')).toBe(BATTLE_MODE_CONFIG.tournament_3v3);
  });

  it('should infer team modes from partial strings', () => {
    expect(getModeConfig('team_tag_team_battle')).toBe(BATTLE_MODE_CONFIG.tag_team);
    expect(getModeConfig('koth_match')).toBe(BATTLE_MODE_CONFIG.koth);
    expect(getModeConfig('grand_melee_round')).toBe(BATTLE_MODE_CONFIG.grand_melee);
  });

  it('should infer league NvN from partial strings', () => {
    expect(getModeConfig('some_2v2_match')).toBe(BATTLE_MODE_CONFIG.league_2v2);
    expect(getModeConfig('some_3v3_match')).toBe(BATTLE_MODE_CONFIG.league_3v3);
  });
});

describe('BATTLE_MODE_CONFIG', () => {
  it('should have all 9 battle mode entries', () => {
    expect(Object.keys(BATTLE_MODE_CONFIG)).toHaveLength(9);
  });

  it('should have consistent structure for all entries', () => {
    for (const config of Object.values(BATTLE_MODE_CONFIG)) {
      expect(config).toHaveProperty('icon');
      expect(config).toHaveProperty('label');
      expect(config).toHaveProperty('badgeColor');
      expect(config).toHaveProperty('borderColor');
      expect(config).toHaveProperty('tierPrefix');
    }
  });
});

describe('OUTCOME_BADGE_CONFIG', () => {
  it('should have win/loss/draw entries', () => {
    expect(OUTCOME_BADGE_CONFIG.win.label).toBe('WIN');
    expect(OUTCOME_BADGE_CONFIG.loss.label).toBe('LOSS');
    expect(OUTCOME_BADGE_CONFIG.draw.label).toBe('DRAW');
  });
});
