/**
 * Shared types for Hall of Records page components.
 *
 * Extracted from HallOfRecordsPage.tsx during component splitting (Spec 18).
 */

/**
 * Battle modes Most Damage is ranked within (Spec #46 R4.5).
 *
 * Kept in declaration order so the UI renders the mode switcher in a stable
 * sequence.
 */
export const DAMAGE_RECORD_MODES = [
  'league_1v1',
  'tournament_1v1',
  'league_2v2',
  'league_3v3',
  'koth',
  'grand_melee',
] as const;

export type DamageRecordMode = typeof DAMAGE_RECORD_MODES[number];

/** Player-facing label for each Most Damage mode. */
export const DAMAGE_RECORD_MODE_LABELS: Record<DamageRecordMode, string> = {
  league_1v1: '1v1 League',
  tournament_1v1: '1v1 Tournament',
  league_2v2: '2v2 League',
  league_3v3: '3v3 League',
  koth: 'King of the Hill',
  grand_melee: 'Grand Melee',
};

/**
 * League modes with a tracked win streak (Spec #46 R7).
 *
 * Tournament modes are absent because their orchestrators never call
 * `recordBattleResult()`, leaving their streak columns permanently zero.
 * `grand_melee` is absent by decision: a win there is placement 1 of 20, so
 * streaks would rank near zero for everyone.
 */
export const WIN_STREAK_MODES = ['league_1v1', 'league_2v2', 'league_3v3', 'tag_team'] as const;

export type WinStreakMode = typeof WIN_STREAK_MODES[number];

export const WIN_STREAK_MODE_LABELS: Record<WinStreakMode, string> = {
  league_1v1: '1v1 League',
  league_2v2: '2v2 League',
  league_3v3: '3v3 League',
  tag_team: 'Tag Team',
};

export interface WinStreakEntry {
  entityId: number;
  /** Robot name for `league_1v1`, team name for the three team modes. */
  entityName: string;
  username: string;
  bestWinStreak: number;
  currentWinStreak: number;
  /** True when the best streak is the one currently running. */
  isActive: boolean;
  wins: number;
}

export interface RecordsData {
  combat: {
    // Spec #46 R4.1/R4.2: fastestVictory and longestBattle removed — every
    // capped battle reports the same MAX_BATTLE_DURATION, so the ranking was
    // degenerate.
    mostDamageInBattle: Partial<Record<DamageRecordMode, MostDamageInBattle[]>>;
    narrowestVictory: NarrowestVictory[];
  };
  upsets: {
    // Spec #46 R4.8: biggestEloGain and biggestEloLoss removed — ELO_K_FACTOR is
    // a fixed 32, so every entry reported the same ±32.
    biggestUpset: BiggestUpset[];
    biggestTeamUpset: BiggestTeamUpset[];
  };
  career: {
    mostBattles: MostBattles[];
    highestWinRate: HighestWinRate[];
    mostLifetimeDamage: MostLifetimeDamage[];
    highestElo: HighestElo[];
    mostKills: MostKills[];
  };
  economic: {
    mostExpensiveBattle: MostExpensiveBattle[];
    highestFame: HighestFame[];
    richestStables: RichestStables[];
  };
  prestige: {
    highestPrestige: HighestPrestige[];
    mostTitles: MostTitles[];
  };
  koth: {
    mostWins: KothMostWins[];
    highestAvgZoneScore: KothHighestAvgZoneScore[];
    mostKillsCareer: KothMostKillsCareer[];
    longestWinStreak: KothLongestWinStreak[];
    mostZoneTime: KothMostZoneTime[];
    // Spec #46 R4.3: bestPlacement removed — any robot that has won a KotH match
    // has a best placement of 1, so the whole list tied at first.
    zoneDominator: KothZoneDominator[];
  };
  teamBattle: {
    '2v2': TeamBattleSizeRecords;
    '3v3': TeamBattleSizeRecords;
  };
  grandMelee: {
    mostWins: GrandMeleeMostWins[];
    highestLp: GrandMeleeHighestLp[];
    mostKillsCareer: GrandMeleeMostKills[];
  };
  winStreaks: Partial<Record<WinStreakMode, WinStreakEntry[]>>;
  tournamentChampions1v1?: TournamentChampionRecord[];
  tournamentChampions2v2?: TournamentChampionRecord[];
  tournamentChampions3v3?: TournamentChampionRecord[];
  timestamp: string;
}

export interface MostDamageInBattle {
  battleId: number;
  damageDealt: number;
  robot: { id: number; name: string; username: string };
  /**
   * Present only for the two 1v1 modes. In 2v2, 3v3, KotH, and Grand Melee a
   * single opponent is not well defined, so the field is omitted rather than
   * populated with an arbitrary one of many.
   */
  opponent?: { id: number; name: string; username: string };
  durationSeconds: number;
  date: string;
}

export interface NarrowestVictory {
  battleId: number;
  remainingHP: number;
  winner: { id: number; name: string; username: string };
  loser: { id: number; name: string; username: string };
  date: string;
}

export interface BiggestUpset {
  battleId: number;
  eloDifference: number;
  underdog: { id: number; name: string; username: string; eloBefore: number };
  favorite: { id: number; name: string; username: string; eloBefore: number };
  date: string;
}

/**
 * Team tournament upset (Spec #46 R4.7). The differential is computed from
 * *summed* team ELO, so a 2v2 or 3v3 upset naturally reports a larger number
 * than a 1v1 one — the gap overcome is the sum of two or three rating gaps.
 */
export interface BiggestTeamUpset {
  battleId: number;
  battleType: string;
  eloDifference: number;
  underdog: { robots: { id: number; name: string; username: string }[]; teamEloBefore: number };
  favorite: { robots: { id: number; name: string; username: string }[]; teamEloBefore: number };
  date: string;
}

export interface MostBattles {
  robotId: number;
  robotName: string;
  username: string;
  totalBattles: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  elo: number;
}

export interface HighestWinRate {
  robotId: number;
  robotName: string;
  username: string;
  totalBattles: number;
  wins: number;
  winRate: number;
  elo: number;
  league: string;
}

export interface MostLifetimeDamage {
  robotId: number;
  robotName: string;
  username: string;
  damageDealt: number;
  totalBattles: number;
  avgDamagePerBattle: number;
}

export interface HighestElo {
  robotId: number;
  robotName: string;
  username: string;
  elo: number;
  league: string;
  wins: number;
  losses: number;
  draws: number;
}

export interface MostKills {
  robotId: number;
  robotName: string;
  username: string;
  kills: number;
  totalBattles: number;
  killRate: number;
}

export interface MostExpensiveBattle {
  battleId: number;
  totalRepairCost: number;
  robot1: { id: number; name: string; username: string; repairCost: number };
  robot2: { id: number; name: string; username: string; repairCost: number };
  winnerId: number;
  date: string;
}

export interface HighestFame {
  robotId: number;
  robotName: string;
  username: string;
  fame: number;
  league: string;
  elo: number;
}

export interface RichestStables {
  userId: number;
  username: string;
  currency: number;
  totalBattles: number;
  prestige: number;
  robotCount: number;
}

export interface HighestPrestige {
  userId: number;
  username: string;
  prestige: number;
  totalBattles: number;
  totalWins: number;
  championshipTitles: number;
  robotCount: number;
}

export interface MostTitles {
  userId: number;
  username: string;
  championshipTitles: number;
  prestige: number;
  totalBattles: number;
  robotCount: number;
}

export interface KothMostWins {
  robotId: number;
  robotName: string;
  username: string;
  kothWins: number;
  kothMatches: number;
  winRate: number;
}

export interface KothHighestAvgZoneScore {
  robotId: number;
  robotName: string;
  username: string;
  avgZoneScore: number;
  kothMatches: number;
}

export interface KothMostKillsCareer {
  robotId: number;
  robotName: string;
  username: string;
  kothKills: number;
  kothMatches: number;
}

export interface KothLongestWinStreak {
  robotId: number;
  robotName: string;
  username: string;
  bestWinStreak: number;
  kothWins: number;
}

export interface KothMostZoneTime {
  robotId: number;
  robotName: string;
  username: string;
  totalZoneTime: number;
  kothMatches: number;
}

export interface KothZoneDominator {
  robotId: number;
  robotName: string;
  username: string;
  avgZoneScore: number;
  kothMatches: number;
  totalZoneScore: number;
}

export type CategoryKey = 'combat' | 'upsets' | 'career' | 'winStreaks' | 'economic' | 'prestige' | 'koth' | 'teamBattle' | 'tournaments' | 'grandMelee';

// ─── Team Battle Records ────────────────────────────────────────────

export interface TeamBattleSizeRecords {
  fastestVictory: TeamBattleFastestVictory[];
  longestSurvival: TeamBattleLongestSurvival[];
  mostDamageDealt: TeamBattleMostDamage[];
  mostDecisiveVictory: TeamBattleDecisiveVictory[];
  longestNonDrawBattle: TeamBattleLongestBattle[];
}

export interface TeamBattleParticipantDisplay {
  id: number;
  name: string;
  username: string;
}

export interface TeamBattleFastestVictory {
  battleId: number;
  durationSeconds: number;
  team1: TeamBattleParticipantDisplay[];
  team2: TeamBattleParticipantDisplay[];
  date: string;
}

export interface TeamBattleLongestSurvival {
  battleId: number;
  survivalSeconds: number;
  robot: { id: number; name: string; username: string };
  date: string;
}

export interface TeamBattleMostDamage {
  battleId: number;
  damageDealt: number;
  robot: { id: number; name: string; username: string };
  durationSeconds: number;
  date: string;
}

export interface TeamBattleDecisiveVictory {
  battleId: number;
  hpDifference: number;
  team1: TeamBattleParticipantDisplay[];
  team2: TeamBattleParticipantDisplay[];
  date: string;
}

export interface TeamBattleLongestBattle {
  battleId: number;
  durationSeconds: number;
  team1: TeamBattleParticipantDisplay[];
  team2: TeamBattleParticipantDisplay[];
  date: string;
}


// ─── Grand Melee Records ────────────────────────────────────────────

export interface GrandMeleeMostWins {
  robotId: number;
  robotName: string;
  username: string;
  grandMeleeWins: number;
}

export interface GrandMeleeHighestLp {
  robotId: number;
  robotName: string;
  username: string;
  leaguePoints: number;
  tier: string;
}

export interface GrandMeleeMostKills {
  robotId: number;
  robotName: string;
  username: string;
  totalKills: number;
  grandMeleeMatches: number;
  /** Spec #46 R4.17 — total kills alone rewards match volume over lethality. */
  killsPerMatch: number;
}

// ─── Tournament Champions ───────────────────────────────────────────

export interface TournamentChampionRecord {
  tournamentId: number;
  tournamentName: string;
  championName: string; // Robot name for 1v1, team name for 2v2/3v3
  memberRobots?: string[]; // Only for team tournaments
  ownerStableName: string;
  completedAt: string;
  participantType: string;
}
