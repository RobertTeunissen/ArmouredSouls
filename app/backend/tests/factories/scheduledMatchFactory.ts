/**
 * Factory for creating valid ScheduledMatch and ScheduledMatchParticipant objects.
 *
 * Supports all 8 MatchType values with appropriate metadata fields
 * pre-populated based on match type (league, tournament, KotH).
 *
 * Types defined locally to match the Prisma schema from Spec #40.
 * Once `prisma generate` is run after Tasks 1.1–1.5, these can be
 * replaced with imports from '../../generated/prisma'.
 */

export type MatchType =
  | 'league_1v1'
  | 'league_2v2'
  | 'league_3v3'
  | 'tag_team'
  | 'koth'
  | 'tournament_1v1'
  | 'tournament_2v2'
  | 'tournament_3v3';

export interface ScheduledMatch {
  id: number;
  matchType: MatchType;
  status: string;
  scheduledFor: Date;
  battleId: number | null;
  createdAt: Date;
  tournamentId: number | null;
  round: number | null;
  matchNumber: number | null;
  isByeMatch: boolean | null;
  leagueType: string | null;
  leagueInstanceId: string | null;
  rotatingZone: boolean | null;
  scoreThreshold: number | null;
  timeLimit: number | null;
  zoneRadius: number | null;
  cancelReason: string | null;
}

export interface ScheduledMatchParticipant {
  id: number;
  scheduledMatchId: number;
  participantType: string;
  participantId: number;
  slot: number;
  createdAt: Date;
}

let matchIdCounter = 1000;
let participantIdCounter = 5000;

const MATCH_TYPES: MatchType[] = [
  'league_1v1',
  'league_2v2',
  'league_3v3',
  'tag_team',
  'koth',
  'tournament_1v1',
  'tournament_2v2',
  'tournament_3v3',
];

const LEAGUE_MATCH_TYPES: MatchType[] = ['league_1v1', 'league_2v2', 'league_3v3', 'tag_team'];
const TOURNAMENT_MATCH_TYPES: MatchType[] = ['tournament_1v1', 'tournament_2v2', 'tournament_3v3'];

function getTomorrow(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(8, 0, 0, 0);
  return d;
}

function getTypeSpecificDefaults(matchType: MatchType): Partial<ScheduledMatch> {
  if (LEAGUE_MATCH_TYPES.includes(matchType)) {
    return {
      leagueType: 'bronze',
      leagueInstanceId: 'bronze_1',
      tournamentId: null,
      round: null,
      matchNumber: null,
      isByeMatch: null,
      rotatingZone: null,
      scoreThreshold: null,
      timeLimit: null,
      zoneRadius: null,
    };
  }

  if (TOURNAMENT_MATCH_TYPES.includes(matchType)) {
    return {
      tournamentId: 1,
      round: 1,
      matchNumber: 1,
      isByeMatch: false,
      leagueType: null,
      leagueInstanceId: null,
      rotatingZone: null,
      scoreThreshold: null,
      timeLimit: null,
      zoneRadius: null,
    };
  }

  // KotH
  return {
    rotatingZone: true,
    scoreThreshold: 100,
    timeLimit: 120,
    zoneRadius: 50,
    leagueType: null,
    leagueInstanceId: null,
    tournamentId: null,
    round: null,
    matchNumber: null,
    isByeMatch: null,
  };
}

/**
 * Creates a valid ScheduledMatch with appropriate metadata fields set for the type.
 * Default status is 'scheduled', scheduledFor is tomorrow at 08:00.
 */
export function createScheduledMatch(
  matchType: MatchType,
  overrides?: Partial<ScheduledMatch>
): ScheduledMatch {
  const id = overrides?.id ?? ++matchIdCounter;

  const base: ScheduledMatch = {
    id,
    matchType,
    status: 'scheduled',
    scheduledFor: getTomorrow(),
    battleId: null,
    createdAt: new Date(),
    cancelReason: null,
    ...getTypeSpecificDefaults(matchType),
  } as ScheduledMatch;

  return { ...base, ...overrides };
}

/**
 * Creates a valid ScheduledMatchParticipant.
 */
export function createScheduledMatchParticipant(
  scheduledMatchId: number,
  slot: number,
  overrides?: Partial<ScheduledMatchParticipant>
): ScheduledMatchParticipant {
  const id = overrides?.id ?? ++participantIdCounter;

  const base: ScheduledMatchParticipant = {
    id,
    scheduledMatchId,
    participantType: 'robot',
    participantId: id + 3000,
    slot,
    createdAt: new Date(),
  };

  return { ...base, ...overrides };
}

/**
 * Creates a ScheduledMatch with an array of participants.
 * Participants are automatically assigned sequential slots starting at 1.
 */
export function createMatchWithParticipants(
  matchType: MatchType,
  participants: Array<Partial<ScheduledMatchParticipant>>,
  overrides?: Partial<ScheduledMatch>
): { match: ScheduledMatch; participants: ScheduledMatchParticipant[] } {
  const match = createScheduledMatch(matchType, overrides);

  const participantRecords = participants.map((p, index) =>
    createScheduledMatchParticipant(match.id, index + 1, p)
  );

  return { match, participants: participantRecords };
}

export { MATCH_TYPES, LEAGUE_MATCH_TYPES, TOURNAMENT_MATCH_TYPES };
