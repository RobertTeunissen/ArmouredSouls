/**
 * Hall of Records types: the `GET /api/records` payload, and the record board
 * view model the page renders (built by `utils/hallOfRecords.ts`).
 */
import type { StableType } from '../../types/stable';

// ─── API payload ────────────────────────────────────────────────────

/**
 * Players' lists only ("Stables: Players", #595): the entry's place among every
 * stable's entries. Absent in the all-stables payload, where the position is
 * the place.
 */
export interface RecordPlace {
  place?: number;
}

/** The owning stable as every record ships it. */
export interface RecordOwner {
  /** The stable's user id (links to `/stables/:id`); null when unknown. */
  userId?: number | null;
  /** Display name of the stable (stable name, or username as fallback). */
  username: string;
  /** Spec #55 decision 42: drives the Automaton_Badge. */
  stableType?: StableType | null;
}

export interface RecordRobot extends RecordOwner {
  id: number;
  name: string;
}

/** Robot-level list entry (career, KotH, Grand Melee, fame). */
export interface RobotRecordBase extends RecordOwner, RecordPlace {
  robotId: number;
  robotName: string;
}

/** Battle modes Most Damage is ranked within (Spec #46 R4.5), in display order. */
export const DAMAGE_RECORD_MODES = [
  'league_1v1',
  'tournament_1v1',
  'league_2v2',
  'league_3v3',
  'koth',
  'grand_melee',
] as const;

export type DamageRecordMode = typeof DAMAGE_RECORD_MODES[number];

/**
 * League modes with a tracked win streak (Spec #46 R7). Tournament modes never
 * record one; Grand Melee is left out by decision; KotH has its own record.
 */
export const WIN_STREAK_MODES = ['league_1v1', 'league_2v2', 'league_3v3', 'tag_team'] as const;

export type WinStreakMode = typeof WIN_STREAK_MODES[number];

export interface MostDamageInBattle extends RecordPlace {
  battleId: number;
  damageDealt: number;
  robot: RecordRobot;
  /** Only for the two 1v1 modes; a single opponent is not defined elsewhere. */
  opponent?: RecordRobot;
  durationSeconds: number;
  date: string;
}

export interface BiggestUpset extends RecordPlace {
  battleId: number;
  eloDifference: number;
  underdog: RecordRobot & { eloBefore: number };
  favorite: RecordRobot & { eloBefore: number };
  date: string;
}

/** Team tournament upset, from summed team ELO (Spec #46 R4.7). */
export interface BiggestTeamUpset extends RecordPlace {
  battleId: number;
  battleType: string;
  eloDifference: number;
  underdog: { robots: RecordRobot[]; teamEloBefore: number };
  favorite: { robots: RecordRobot[]; teamEloBefore: number };
  date: string;
}

export interface MostBattles extends RobotRecordBase {
  /** Battles in every mode, KotH and Grand Melee included. The ranked value. */
  allModesBattleCount: number;
  /** Win/loss-mode battles: the denominator of `winRate` and the W/L/D record. */
  totalBattles: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  elo: number;
}

export interface HighestWinRate extends RobotRecordBase {
  totalBattles: number;
  wins: number;
  winRate: number;
  elo: number;
}

export interface MostLifetimeDamage extends RobotRecordBase {
  damageDealt: number;
  totalBattles: number;
  allModesBattleCount?: number;
  /** Per battle in every mode. */
  avgDamagePerBattle: number;
}

export interface HighestElo extends RobotRecordBase {
  elo: number;
  wins: number;
  losses: number;
  draws: number;
}

export interface MostKills extends RobotRecordBase {
  /** Opponents destroyed in every mode. */
  kills: number;
  totalBattles: number;
  allModesBattleCount?: number;
  /** Destructions per battle in every mode. */
  killsPerBattle?: number;
}

export interface HighestFame extends RobotRecordBase {
  fame: number;
  elo: number;
}

export interface StableRecordBase extends RecordOwner, RecordPlace {
  userId: number;
  prestige: number;
  robotCount: number;
}

export interface RichestStable extends StableRecordBase {
  currency: number;
}

export interface HighestPrestige extends StableRecordBase {
  championshipTitles: number;
}

export interface MostTitles extends StableRecordBase {
  championshipTitles: number;
}

export interface KothMostWins extends RobotRecordBase {
  kothWins: number;
  kothMatches: number;
  winRate: number;
}

export interface KothHighestAvgZoneScore extends RobotRecordBase {
  avgZoneScore: number;
  kothMatches: number;
}

export interface KothMostKills extends RobotRecordBase {
  kothKills: number;
  kothMatches: number;
}

export interface KothLongestWinStreak extends RobotRecordBase {
  bestWinStreak: number;
  kothWins: number;
  currentWinStreak?: number;
  isActive?: boolean;
}

export interface KothMostZoneTime extends RobotRecordBase {
  totalZoneTime: number;
  kothMatches: number;
}

export interface KothZoneDominator extends RobotRecordBase {
  totalZoneScore: number;
  kothMatches: number;
}

export interface TeamDecisiveVictory extends RecordPlace {
  battleId: number;
  /** HP left on the winning side minus the losing side. */
  hpDifference: number;
  winners: RecordRobot[];
  losers: RecordRobot[];
  date: string;
}

export interface TeamBattleSizeRecords {
  mostDecisiveVictory: TeamDecisiveVictory[];
}

export interface GrandMeleeMostWins extends RobotRecordBase {
  grandMeleeWins: number;
}

export interface GrandMeleeMostKills extends RobotRecordBase {
  totalKills: number;
  grandMeleeMatches: number;
  /** Spec #46 R4.17: total kills alone rewards match volume. */
  killsPerMatch: number;
}

export interface WinStreakEntry extends RecordOwner, RecordPlace {
  entityId: number;
  /** Robot name for `league_1v1`, team name for the three team modes. */
  entityName: string;
  bestWinStreak: number;
  currentWinStreak: number;
  /** True when the best streak is the one currently running. */
  isActive: boolean;
  wins: number;
}

export interface TournamentChampionRecord {
  tournamentId: number;
  tournamentName: string;
  /** Robot name for 1v1, team name for 2v2/3v3. */
  championName: string;
  /** The 1v1 champion robot's id; absent for team champions. */
  championRobotId?: number;
  memberRobots?: string[];
  ownerStableName: string;
  ownerUserId?: number | null;
  ownerStableType?: StableType | null;
  completedAt: string;
  participantType: string;
}

export interface RecordsData {
  /** Which payload this is: every stable, or players only (#595). */
  stables?: 'all' | 'players';
  combat: {
    mostDamageInBattle: Partial<Record<DamageRecordMode, MostDamageInBattle[]>>;
  };
  upsets: {
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
    highestFame: HighestFame[];
    richestStables: RichestStable[];
  };
  prestige: {
    highestPrestige: HighestPrestige[];
    mostTitles: MostTitles[];
  };
  koth: {
    mostWins: KothMostWins[];
    highestAvgZoneScore: KothHighestAvgZoneScore[];
    mostKillsCareer: KothMostKills[];
    longestWinStreak: KothLongestWinStreak[];
    mostZoneTime: KothMostZoneTime[];
    zoneDominator: KothZoneDominator[];
  };
  teamBattle: {
    '2v2': TeamBattleSizeRecords;
    '3v3': TeamBattleSizeRecords;
  };
  grandMelee: {
    mostWins: GrandMeleeMostWins[];
    mostKillsCareer: GrandMeleeMostKills[];
  };
  winStreaks: Partial<Record<WinStreakMode, WinStreakEntry[]>>;
  tournamentChampions1v1?: TournamentChampionRecord[];
  tournamentChampions2v2?: TournamentChampionRecord[];
  tournamentChampions3v3?: TournamentChampionRecord[];
  timestamp: string;
}

// ─── Record board view model ────────────────────────────────────────

/** The board's groups, in display order; also the `?group=` values. */
export const RECORD_GROUPS = ['robots', 'battles', 'streaks', 'koth-melee', 'stables'] as const;

export type RecordGroupKey = typeof RECORD_GROUPS[number];

/** The stable a record row belongs to. */
export interface RecordStableRef {
  name: string;
  userId: number | null;
  stableType: StableType | null;
}

/** Who holds a row: a robot (linkable), a team or line-up (text), or a stable. */
export interface RecordHolder {
  /** Robot, team or line-up name; null for a stable record. */
  subjectName: string | null;
  /** Set for robot holders, so the name links to the robot's page. */
  robotId?: number;
  stable: RecordStableRef;
}

export interface RecordRow {
  /** Shared rank: equal values share the rank of the first of them. */
  rank: number;
  /** The value as shown ("2,393", "97.2%", "+446 ELO"). */
  value: string;
  holder: RecordHolder;
  /** Short context ("69 of 71 battles", "vs Gobbelientje"). */
  detail?: string;
  /** Battle records open their battle report. */
  battleId?: number;
  /** A streak that is still running. */
  running?: boolean;
}

/** One ranked list. Most records have one; per-mode records have several. */
export interface RecordVariant {
  key: string;
  label: string;
  rows: RecordRow[];
}

export interface RecordDefinition {
  /** URL key (`?record=`). */
  key: string;
  group: RecordGroupKey;
  title: string;
  /** One line on what the record counts. */
  scope: string;
  /** Column heading for the value in the full list. */
  valueLabel: string;
  /** Lists with at least one row, in display order. */
  variants: RecordVariant[];
  /** A full leaderboard page exists; the board links there instead of a top 10. */
  leaderboard?: { href: string; label: string };
  /** False for logs that are not a ranking (tournament champions, most recent first). */
  ranked: boolean;
}

/** A place the viewer's stable holds in a record list. */
export interface MyPlace {
  recordKey: string;
  recordTitle: string;
  variantKey: string;
  variantLabel: string | null;
  row: RecordRow;
}
