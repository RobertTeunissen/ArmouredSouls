/**
 * Battle modes as the admin Battles page sees them: the nine `battles.battle_type`
 * values, how each is grouped, and the engine time limit each runs under.
 */
import { MAX_BATTLE_DURATION } from '../../battle/combat-simulator/combatTypes';
import { TEAM_BATTLE_MAX_DURATION } from '../../team-battle/teamBattleEngine';
import { BATTLE_TIME_LIMIT as TAG_TEAM_TIME_LIMIT } from '../../tag-team/tagTeamTypes';
import { KOTH_MATCH_DEFAULTS } from '../../arena/koth/kothConfig';
import { BATTLE_MODES, type BattleMode } from './battleFilters';

export { BATTLE_MODES, type BattleMode };

/** How two sides (or a field of robots) are arranged in a mode. */
export type ModeShape = 'duel' | 'team' | 'placement';

export function isBattleMode(value: string): value is BattleMode {
  return (BATTLE_MODES as readonly string[]).includes(value);
}

export function modeShape(mode: string): ModeShape {
  if (mode === 'koth' || mode === 'grand_melee') return 'placement';
  if (mode === 'league_1v1' || mode === 'tournament_1v1') return 'duel';
  return 'team';
}

/**
 * Engine time limit per mode, in seconds. KotH uses the default match limit; a
 * scheduled match can override it (`scheduled_matches_v2.time_limit`).
 */
export const MODE_TIME_LIMIT_SECONDS: Readonly<Record<BattleMode, number>> = {
  league_1v1: MAX_BATTLE_DURATION,
  tournament_1v1: MAX_BATTLE_DURATION,
  league_2v2: TEAM_BATTLE_MAX_DURATION,
  league_3v3: TEAM_BATTLE_MAX_DURATION,
  tournament_2v2: TEAM_BATTLE_MAX_DURATION,
  tournament_3v3: TEAM_BATTLE_MAX_DURATION,
  tag_team: TAG_TEAM_TIME_LIMIT,
  koth: KOTH_MATCH_DEFAULTS.timeLimit,
  grand_melee: MAX_BATTLE_DURATION,
};

/** Time limit for a stored battle type; unknown legacy types fall back to the 1v1 limit. */
export function timeLimitFor(mode: string): number {
  return isBattleMode(mode) ? MODE_TIME_LIMIT_SECONDS[mode] : MAX_BATTLE_DURATION;
}
