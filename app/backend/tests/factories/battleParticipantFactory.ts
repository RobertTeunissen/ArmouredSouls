/**
 * Factory for creating valid BattleParticipant objects with enhanced roles.
 *
 * Supports all participant roles: solo, active, reserve, team_member, koth_participant.
 * Includes helpers for creating complete participant sets for tag-team, KotH, and 1v1 battles.
 *
 * Types defined locally to match the Prisma schema (existing BattleParticipant model
 * with the tagOutTimeMs enhancement from Task 1.5).
 * Once `prisma generate` is run after Task 1.5, these can be replaced with
 * imports from '../../generated/prisma'.
 */

export interface BattleParticipant {
  id: number;
  battleId: number;
  robotId: number;
  team: number;
  role: string | null;
  placement: number | null;
  credits: number;
  streamingRevenue: number;
  eloBefore: number;
  eloAfter: number;
  prestigeAwarded: number;
  fameAwarded: number;
  damageDealt: number;
  finalHP: number;
  yielded: boolean;
  destroyed: boolean;
  tagOutTimeMs: bigint | null;
  createdAt: Date;
}

export type ParticipantRole = 'solo' | 'active' | 'reserve' | 'team_member' | 'koth_participant';

let participantIdCounter = 1000;

const PARTICIPANT_ROLES: ParticipantRole[] = [
  'solo',
  'active',
  'reserve',
  'team_member',
  'koth_participant',
];

/**
 * Creates a valid BattleParticipant for the given role.
 */
export function createParticipant(
  role: ParticipantRole,
  overrides?: Partial<BattleParticipant>
): BattleParticipant {
  const id = overrides?.id ?? ++participantIdCounter;

  const base: BattleParticipant = {
    id,
    battleId: overrides?.battleId ?? 1,
    robotId: id + 6000,
    team: 1,
    role,
    placement: role === 'koth_participant' ? 1 : null,
    credits: 1000,
    streamingRevenue: 0,
    eloBefore: 1200,
    eloAfter: 1210,
    prestigeAwarded: 10,
    fameAwarded: 20,
    damageDealt: 100,
    finalHP: 50,
    yielded: false,
    destroyed: false,
    tagOutTimeMs: role === 'active' || role === 'reserve' ? BigInt(45000) : null,
    createdAt: new Date(),
  };

  return { ...base, ...overrides };
}

/**
 * Creates 4 participants for a tag-team battle:
 * - Team 1: 1 active + 1 reserve
 * - Team 2: 1 active + 1 reserve
 * Each has tagOutTimeMs set and correct team assignments.
 */
export function createTagTeamParticipants(
  battleId: number,
  overrides?: Partial<BattleParticipant>
): BattleParticipant[] {
  return [
    createParticipant('active', {
      ...overrides,
      battleId,
      team: 1,
      robotId: 7001,
      tagOutTimeMs: BigInt(30000),
    }),
    createParticipant('reserve', {
      ...overrides,
      battleId,
      team: 1,
      robotId: 7002,
      tagOutTimeMs: BigInt(30000),
    }),
    createParticipant('active', {
      ...overrides,
      battleId,
      team: 2,
      robotId: 7003,
      tagOutTimeMs: BigInt(45000),
    }),
    createParticipant('reserve', {
      ...overrides,
      battleId,
      team: 2,
      robotId: 7004,
      tagOutTimeMs: BigInt(45000),
    }),
  ];
}

/**
 * Creates N participants for a KotH battle with sequential placements.
 * Each participant gets a descending placement (1st, 2nd, 3rd, etc.)
 * and descending credits reflecting placement-based rewards.
 */
export function createKothParticipants(
  battleId: number,
  count: number,
  overrides?: Partial<BattleParticipant>
): BattleParticipant[] {
  // F1-style point awards by placement
  const pointsByPlacement = [25, 18, 15, 12, 10, 8, 6, 4];

  const participants: BattleParticipant[] = [];
  for (let i = 0; i < count; i++) {
    participants.push(
      createParticipant('koth_participant', {
        ...overrides,
        battleId,
        team: i + 1, // KotH uses team as a unique identifier per participant
        robotId: 8000 + i,
        placement: i + 1,
        credits: (pointsByPlacement[i] ?? 2) * 40,
        tagOutTimeMs: null,
      })
    );
  }

  return participants;
}

/**
 * Creates 2 participants for a standard 1v1 battle with role='solo'.
 * Team 1 is the winner (higher ELO after), Team 2 is the loser.
 */
export function create1v1Participants(
  battleId: number,
  overrides?: Partial<BattleParticipant>
): BattleParticipant[] {
  return [
    createParticipant('solo', {
      ...overrides,
      battleId,
      team: 1,
      robotId: 9001,
      eloBefore: 1200,
      eloAfter: 1210,
      credits: 1000,
      damageDealt: 120,
      finalHP: 45,
      fameAwarded: 20,
      prestigeAwarded: 10,
      yielded: false,
      destroyed: false,
      tagOutTimeMs: null,
    }),
    createParticipant('solo', {
      ...overrides,
      battleId,
      team: 2,
      robotId: 9002,
      eloBefore: 1200,
      eloAfter: 1190,
      credits: 500,
      damageDealt: 55,
      finalHP: 0,
      fameAwarded: 10,
      prestigeAwarded: 5,
      yielded: false,
      destroyed: true,
      tagOutTimeMs: null,
    }),
  ];
}

export { PARTICIPANT_ROLES };
