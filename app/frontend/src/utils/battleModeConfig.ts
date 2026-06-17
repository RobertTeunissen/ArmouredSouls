/**
 * Shared battle mode configuration — defines icons, labels, badge colors, and border colors
 * for each battle mode. Used by BOTH upcoming match cards and battle history cards to ensure
 * visual consistency across the app.
 */

export interface BattleModeConfig {
  icon: string;
  label: string;
  badgeColor: string;
  borderColor: string;
  tierPrefix: string;
}

export type BattleModeType =
  | 'league_1v1'
  | 'league_2v2'
  | 'league_3v3'
  | 'tag_team'
  | 'tournament_1v1'
  | 'tournament_2v2'
  | 'tournament_3v3'
  | 'koth';

export const BATTLE_MODE_CONFIG: Record<BattleModeType, BattleModeConfig> = {
  league_1v1: {
    icon: '⚔️',
    label: '1v1',
    badgeColor: 'bg-blue-400/20 text-blue-400',
    borderColor: 'border-l-[#58a6ff]',
    tierPrefix: 'League',
  },
  league_2v2: {
    icon: '⚔️',
    label: '2v2',
    badgeColor: 'bg-emerald-400/20 text-emerald-400',
    borderColor: 'border-l-emerald-400',
    tierPrefix: 'League',
  },
  league_3v3: {
    icon: '⚔️',
    label: '3v3',
    badgeColor: 'bg-violet-400/20 text-violet-400',
    borderColor: 'border-l-violet-400',
    tierPrefix: 'League',
  },
  tag_team: {
    icon: '🤝',
    label: 'Tag Team',
    badgeColor: 'bg-amber-400/20 text-amber-400',
    borderColor: 'border-l-[#f0a030]',
    tierPrefix: 'League',
  },
  tournament_1v1: {
    icon: '🏆',
    label: '1v1 T',
    badgeColor: 'bg-[#d29922]/20 text-[#d29922]',
    borderColor: 'border-l-[#d29922]',
    tierPrefix: 'Tournament',
  },
  tournament_2v2: {
    icon: '🏆',
    label: '2v2 T',
    badgeColor: 'bg-[#d29922]/20 text-[#d29922]',
    borderColor: 'border-l-[#d29922]',
    tierPrefix: 'Tournament',
  },
  tournament_3v3: {
    icon: '🏆',
    label: '3v3 T',
    badgeColor: 'bg-[#d29922]/20 text-[#d29922]',
    borderColor: 'border-l-[#d29922]',
    tierPrefix: 'Tournament',
  },
  koth: {
    icon: '👑',
    label: 'KotH',
    badgeColor: 'bg-orange-400/20 text-orange-400',
    borderColor: 'border-l-orange-500',
    tierPrefix: '',
  },
};

/**
 * Get the mode config for a given battle type string.
 * Falls back to league_1v1 for unknown types.
 */
export function getModeConfig(battleType: string | null | undefined): BattleModeConfig {
  if (!battleType) return BATTLE_MODE_CONFIG.league_1v1;

  // Direct match
  if (battleType in BATTLE_MODE_CONFIG) {
    return BATTLE_MODE_CONFIG[battleType as BattleModeType];
  }

  // Infer from partial strings
  if (battleType.includes('tournament')) {
    if (battleType.includes('3v3')) return BATTLE_MODE_CONFIG.tournament_3v3;
    if (battleType.includes('2v2')) return BATTLE_MODE_CONFIG.tournament_2v2;
    return BATTLE_MODE_CONFIG.tournament_1v1;
  }
  if (battleType.includes('tag_team')) return BATTLE_MODE_CONFIG.tag_team;
  if (battleType.includes('koth')) return BATTLE_MODE_CONFIG.koth;
  if (battleType.includes('3v3')) return BATTLE_MODE_CONFIG.league_3v3;
  if (battleType.includes('2v2')) return BATTLE_MODE_CONFIG.league_2v2;

  return BATTLE_MODE_CONFIG.league_1v1;
}

/**
 * Outcome badge styling — used by both CompactBattleCard and any history card.
 */
export const OUTCOME_BADGE_CONFIG = {
  win: { label: 'WIN', badgeColor: 'bg-[#3fb950]/20 text-[#3fb950]' },
  loss: { label: 'LOSS', badgeColor: 'bg-[#f85149]/20 text-[#f85149]' },
  draw: { label: 'DRAW', badgeColor: 'bg-[#57606a]/20 text-[#57606a]' },
} as const;
