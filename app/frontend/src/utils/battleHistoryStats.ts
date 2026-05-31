import {
  BattleHistory,
  getBattleOutcome,
  getELOChange,
  getBattleReward,
} from './matchmakingApi';

export interface BattleTypeStats {
  battles: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  avgELOChange: number;
}

export interface KothStats extends BattleTypeStats {
  avgZoneScore: number;
  totalCredits: number;
  totalKills: number;
  placements: { first: number; second: number; third: number; other: number };
}

export interface BattleSummaryStats {
  totalBattles: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  avgELOChange: number;
  totalCreditsEarned: number;
  currentStreak?: { type: 'win' | 'loss'; count: number };
  leagueStats: BattleTypeStats;
  tournamentStats: BattleTypeStats;
  tagTeamStats: BattleTypeStats;
  kothStats: KothStats;
  league2v2Stats: BattleTypeStats;
  league3v3Stats: BattleTypeStats;
}

const EMPTY_TYPE_STATS: BattleTypeStats = { battles: 0, wins: 0, losses: 0, draws: 0, winRate: 0, avgELOChange: 0 };
const EMPTY_KOTH_STATS: KothStats = { ...EMPTY_TYPE_STATS, avgZoneScore: 0, totalCredits: 0, totalKills: 0, placements: { first: 0, second: 0, third: 0, other: 0 } };

export const EMPTY_SUMMARY: BattleSummaryStats = {
  totalBattles: 0, wins: 0, losses: 0, draws: 0, winRate: 0, avgELOChange: 0, totalCreditsEarned: 0,
  leagueStats: { ...EMPTY_TYPE_STATS },
  tournamentStats: { ...EMPTY_TYPE_STATS },
  tagTeamStats: { ...EMPTY_TYPE_STATS },
  kothStats: { ...EMPTY_KOTH_STATS },
  league2v2Stats: { ...EMPTY_TYPE_STATS },
  league3v3Stats: { ...EMPTY_TYPE_STATS },
};

/**
 * Compute summary statistics from a list of battles for the current user.
 * Extracted from BattleHistoryPage to keep the component under 300 lines.
 */
export function computeBattleSummary(
  battles: BattleHistory[],
  userId: number,
): BattleSummaryStats {
  if (battles.length === 0) return { ...EMPTY_SUMMARY };

  let wins = 0, losses = 0, draws = 0;
  let totalELOChange = 0, totalCredits = 0;

  // Streak tracking
  let streakCount = 0;
  let streakType: 'win' | 'loss' | null = null;
  let firstBattleOutcome: 'win' | 'loss' | 'draw' | null = null;
  let streakBroken = false;

  // Per-type accumulators
  let leagueWins = 0, leagueLosses = 0, leagueDraws = 0, leagueELO = 0, leagueBattles = 0;
  let tournamentWins = 0, tournamentLosses = 0, tournamentDraws = 0, tournamentELO = 0, tournamentBattles = 0;
  let tagTeamWins = 0, tagTeamLosses = 0, tagTeamDraws = 0, tagTeamELO = 0, tagTeamBattles = 0;
  let kothWins = 0, kothLosses = 0, kothDraws = 0, kothELO = 0, kothBattles = 0;
  let kothTotalZoneScore = 0, kothTotalCredits = 0, kothTotalKills = 0;
  let kothFirst = 0, kothSecond = 0, kothThird = 0, kothOther = 0;
  let league2v2Wins = 0, league2v2Losses = 0, league2v2Draws = 0, league2v2ELO = 0, league2v2Battles = 0;
  let league3v3Wins = 0, league3v3Losses = 0, league3v3Draws = 0, league3v3ELO = 0, league3v3Battles = 0;

  battles.forEach((battle, index) => {
    const isKoth = battle.battleType === 'koth';
    // For KotH, user's robot may not be robot1 or robot2 (3rd-6th place)
    // Fall back to robot1 if neither matches — stats come from kothPlacement anyway
    const myRobotId = battle.robot1.userId === userId
      ? battle.robot1.id
      : battle.robot2.userId === userId
        ? battle.robot2.id
        : battle.robot1.id;
    
    // For KotH, derive outcome from placement instead of winnerId
    const outcome = isKoth
      ? (battle.kothPlacement === 1 ? 'win' : 'loss')
      : getBattleOutcome(battle, myRobotId);
    const eloChange = getELOChange(battle, myRobotId);
    const reward = getBattleReward(battle, myRobotId);
    const isTournament = battle.battleType === 'tournament_1v1';
    const isTagTeam = battle.battleType === 'tag_team';
    const isLeague2v2 = battle.battleType === 'league_2v2';
    const isLeague3v3 = battle.battleType === 'league_3v3';

    if (outcome === 'win') {
      wins++;
      if (isTournament) tournamentWins++;
      else if (isTagTeam) tagTeamWins++;
      else if (isKoth) kothWins++;
      else if (isLeague2v2) league2v2Wins++;
      else if (isLeague3v3) league3v3Wins++;
      else leagueWins++;
    } else if (outcome === 'loss') {
      losses++;
      if (isTournament) tournamentLosses++;
      else if (isTagTeam) tagTeamLosses++;
      else if (isKoth) kothLosses++;
      else if (isLeague2v2) league2v2Losses++;
      else if (isLeague3v3) league3v3Losses++;
      else leagueLosses++;
    } else if (outcome === 'draw') {
      draws++;
      if (isTournament) tournamentDraws++;
      else if (isTagTeam) tagTeamDraws++;
      else if (isKoth) kothDraws++;
      else if (isLeague2v2) league2v2Draws++;
      else if (isLeague3v3) league3v3Draws++;
      else leagueDraws++;
    }

    totalELOChange += eloChange;
    totalCredits += reward;

    if (isTournament) {
      tournamentBattles++;
      tournamentELO += eloChange;
    } else if (isTagTeam) {
      tagTeamBattles++;
      tagTeamELO += eloChange;
    } else if (isKoth) {
      kothBattles++;
      kothELO += eloChange;
      kothTotalCredits += reward;
      kothTotalZoneScore += battle.kothZoneScore ?? 0;
      if (outcome === 'win') kothTotalKills++;
      const placement = battle.kothPlacement;
      if (placement === 1) kothFirst++;
      else if (placement === 2) kothSecond++;
      else if (placement === 3) kothThird++;
      else if (placement != null) kothOther++;
    } else if (isLeague2v2) {
      league2v2Battles++;
      league2v2ELO += eloChange;
    } else if (isLeague3v3) {
      league3v3Battles++;
      league3v3ELO += eloChange;
    } else {
      leagueBattles++;
      leagueELO += eloChange;
    }

    // Streak calculation
    if (!streakBroken) {
      if (index === 0) {
        if (outcome === 'win' || outcome === 'loss') {
          streakCount = 1;
          streakType = outcome as 'win' | 'loss';
          firstBattleOutcome = outcome;
        } else {
          firstBattleOutcome = 'draw';
          streakBroken = true;
        }
      } else if (firstBattleOutcome === 'win' || firstBattleOutcome === 'loss') {
        if (outcome === firstBattleOutcome) streakCount++;
        else streakBroken = true;
      }
    }
  });

  const totalBattles = wins + losses + draws;
  const buildTypeStats = (b: number, w: number, l: number, d: number, elo: number): BattleTypeStats => ({
    battles: b, wins: w, losses: l, draws: d,
    winRate: b > 0 ? w / b : 0,
    avgELOChange: b > 0 ? elo / b : 0,
  });

  return {
    totalBattles, wins, losses, draws,
    winRate: totalBattles > 0 ? wins / totalBattles : 0,
    avgELOChange: totalBattles > 0 ? totalELOChange / totalBattles : 0,
    totalCreditsEarned: totalCredits,
    currentStreak: streakCount >= 3 ? { type: streakType!, count: streakCount } : undefined,
    leagueStats: buildTypeStats(leagueBattles, leagueWins, leagueLosses, leagueDraws, leagueELO),
    tournamentStats: buildTypeStats(tournamentBattles, tournamentWins, tournamentLosses, tournamentDraws, tournamentELO),
    tagTeamStats: buildTypeStats(tagTeamBattles, tagTeamWins, tagTeamLosses, tagTeamDraws, tagTeamELO),
    kothStats: {
      ...buildTypeStats(kothBattles, kothWins, kothLosses, kothDraws, kothELO),
      avgZoneScore: kothBattles > 0 ? kothTotalZoneScore / kothBattles : 0,
      totalCredits: kothTotalCredits,
      totalKills: kothTotalKills,
      placements: { first: kothFirst, second: kothSecond, third: kothThird, other: kothOther },
    },
    league2v2Stats: buildTypeStats(league2v2Battles, league2v2Wins, league2v2Losses, league2v2Draws, league2v2ELO),
    league3v3Stats: buildTypeStats(league3v3Battles, league3v3Wins, league3v3Losses, league3v3Draws, league3v3ELO),
  };
}
