/**
 * `GET /api/stables/:userId` response (public stable page).
 *
 * Mirrors `stableViewService.getStableProfile` and
 * `stable-view-sections.ts` in the backend.
 */
import type { StableType } from '../../types/stable';
import type { PublicRobotStanding, RecentResult, StableAccolade, StableAchievementData } from '@shared/types';

export interface StableUser {
  id: number;
  username: string;
  stableName: string | null;
  /** Spec #55: Stable_Type of the owning stable (drives the Automaton_Badge). */
  stableType?: StableType;
  /** ISO timestamp the account was created. */
  memberSince?: string;
  prestige: number;
  prestigeRank: string;
  championshipTitles: number;
  championshipTitles1v1?: number;
  championshipTitles2v2?: number;
  championshipTitles3v3?: number;
}

export interface PublicRobot {
  id: number;
  name: string;
  imageUrl: string | null;
  elo: number;
  /** Omitted when the robot has no league_1v1 standing (Unranked). */
  currentLeague?: string;
  leaguePoints?: number;
  wins: number;
  losses: number;
  draws: number;
  totalBattles: number;
  /** #532: battles across every mode (totalBattles + KotH + Grand Melee). */
  allModesBattleCount?: number;
  fame: number;
  kills: number;
  damageDealtLifetime: number;
  damageTakenLifetime: number;
  standings?: PublicRobotStanding[];
}

export interface FacilitySummary {
  type: string;
  name: string;
  level: number;
  maxLevel: number;
}

export interface StableStats {
  totalBattles: number;
  totalWins: number;
  totalLosses: number;
  totalDraws: number;
  winRate: number;
  highestElo: number;
  activeRobots: number;
  totalTeamBattles: number;
  teamBattleWins: number;
  teamBattleWinRate: number;
}

export interface StableData {
  user: StableUser;
  robots: PublicRobot[];
  facilities: FacilitySummary[];
  stats: StableStats;
  achievements?: StableAchievementData;
  recentResults?: RecentResult[];
  accolades?: StableAccolade[];
}
