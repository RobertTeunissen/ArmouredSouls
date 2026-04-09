/**
 * Shared types for Hall of Records page components.
 *
 * Extracted from HallOfRecordsPage.tsx during component splitting (Spec 18).
 */

export interface RecordsData {
  combat: {
    fastestVictory: FastestVictory[];
    longestBattle: LongestBattle[];
    mostDamageInBattle: MostDamageInBattle[];
    narrowestVictory: NarrowestVictory[];
  };
  upsets: {
    biggestUpset: BiggestUpset[];
    biggestEloGain: BiggestEloGain[];
    biggestEloLoss: BiggestEloLoss[];
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
    bestPlacement: KothBestPlacement[];
    zoneDominator: KothZoneDominator[];
  };
  timestamp: string;
}

export interface FastestVictory {
  battleId: number;
  durationSeconds: number;
  winner: { id: number; name: string; username: string };
  loser: { id: number; name: string; username: string };
  date: string;
}

export interface LongestBattle {
  battleId: number;
  durationSeconds: number;
  winner: { id: number; name: string; username: string };
  loser: { id: number; name: string; username: string };
  date: string;
}

export interface MostDamageInBattle {
  battleId: number;
  damageDealt: number;
  robot: { id: number; name: string; username: string };
  opponent: { id: number; name: string; username: string };
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

export interface BiggestEloGain {
  battleId: number;
  eloChange: number;
  winner: { id: number; name: string; username: string; eloBefore: number; eloAfter: number };
  loser: { id: number; name: string; username: string; eloBefore: number };
  date: string;
}

export interface BiggestEloLoss {
  battleId: number;
  eloChange: number;
  loser: { id: number; name: string; username: string; eloBefore: number; eloAfter: number };
  winner: { id: number; name: string; username: string };
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

export interface KothBestPlacement {
  robotId: number;
  robotName: string;
  username: string;
  bestPlacement: number;
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

export type CategoryKey = 'combat' | 'upsets' | 'career' | 'economic' | 'prestige' | 'koth';
