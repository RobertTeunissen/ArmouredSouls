/**
 * `GET /api/stables/:userId` response (public stable page).
 *
 * Mirrors `stableViewService.getStableProfile` and
 * `stable-view-sections.ts` in the backend.
 */
import type { TieredStandingsMode } from '@shared/utils/automatonStandingsTier';
import type { StableType } from '../../types/stable';

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

/** One tiered mode a robot has played this season (team modes via its team). */
export interface PublicRobotStanding {
  mode: TieredStandingsMode;
  tier: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  draws: number;
  /** Placement modes: matches entered (`wins` counts first places). */
  totalMatches: number | null;
  teamName: string | null;
  teamId?: number | null;
  /** League instance, e.g. `champion_2`. */
  leagueInstanceId?: string;
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

export interface ShowcaseAchievement {
  id: string;
  name: string;
  tier: string;
  badgeIconFile: string;
  unlockedAt: string;
  pinned: boolean;
  /** Human stables holding it; null until the server's rarity cache has loaded. */
  holders: number | null;
}

export interface StableAchievements {
  pinned: Array<{ id: string; name: string; tier: string; badgeIconFile: string; unlockedAt: string }>;
  showcase?: ShowcaseAchievement[];
  totalUnlocked: number;
  totalAvailable: number;
}

export type ResultOutcome = 'win' | 'loss' | 'draw';

export interface RecentResultEntry {
  robotId: number;
  robotName: string;
  outcome: ResultOutcome | null;
  placement: number | null;
  /** ELO after minus ELO before. */
  eloChange?: number;
}

export interface RecentResult {
  battleId: number;
  battleType: string;
  tier: string | null;
  tournamentRound: number | null;
  createdAt: string;
  entries: RecentResultEntry[];
}

export interface StableAccolade {
  seasonNumber: number;
  category: string;
  rank: number;
  subjectName: string;
  value: number;
  valueLabel: string;
  mode: string | null;
}

export interface StableData {
  user: StableUser;
  robots: PublicRobot[];
  facilities: FacilitySummary[];
  stats: StableStats;
  achievements?: StableAchievements;
  recentResults?: RecentResult[];
  accolades?: StableAccolade[];
}
