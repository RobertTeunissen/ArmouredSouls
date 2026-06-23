/**
 * Shared team matchmaking utilities.
 *
 * Extracted from tagTeamMatchmakingService.ts and matchmakingService.ts.
 * Consumed by:
 *   - 1v1 league matchmaking (matchmakingService.ts)
 *   - Tag Team matchmaking (tagTeamMatchmakingService.ts)
 *   - 2v2/3v3 Team Battle matchmaking (teamBattleMatchmakingService.ts)
 *
 * LP-primary scoring formula shared across all leagues.
 */

// ─── Constants ───────────────────────────────────────────────────────────────

/** Ideal LP difference — minimal penalty (×1) */
export const LP_MATCH_IDEAL = 10;

/** Fallback LP difference — moderate penalty (×5) */
export const LP_MATCH_FALLBACK = 20;

/** Ideal ELO difference — minimal penalty (×0.1) */
export const ELO_MATCH_IDEAL = 150;

/** Fallback ELO difference — moderate penalty (×0.5) */
export const ELO_MATCH_FALLBACK = 300;

/** Penalty added per direction when entities recently fought (+400 each) */
export const RECENT_OPPONENT_PENALTY = 400;

/** Penalty for same-stable matchups — effectively blocks unless no other option */
export const SAME_STABLE_PENALTY = 10000;

/** Number of recent opponents to track per entity */
export const RECENT_OPPONENT_LIMIT = 5;

// ─── Interfaces ──────────────────────────────────────────────────────────────

/**
 * Generic input for the shared match scoring function.
 * Works for robots (1v1), tag teams, and team battle teams alike.
 */
export interface MatchScoreInput {
  entity1LP: number;
  entity2LP: number;
  entity1ELO: number;
  entity2ELO: number;
  recentOpponents1: number[];
  recentOpponents2: number[];
  entity1Id: number;
  entity2Id: number;
  entity1StableId: number;
  entity2StableId: number;
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

/**
 * Calculate match quality score (lower is better).
 *
 * LP difference is the PRIMARY factor:
 *   - ≤10 LP diff: ×1 (ideal)
 *   - ≤20 LP diff: ×5 (fallback)
 *   - >20 LP diff: ×20 (heavy penalty)
 *
 * ELO difference is SECONDARY (soft, NO hard reject):
 *   - ≤150 ELO diff: ×0.1 (ideal)
 *   - ≤300 ELO diff: ×0.5 (fallback)
 *   - >300 ELO diff: ×1.0 (beyond — still no hard reject)
 *
 * Recent-opponent penalty: +400 per direction (heavier than ELO to force variety).
 * Same-stable penalty: +10000 (effectively blocks unless no other option).
 */
export function calculateMatchScore(input: MatchScoreInput): number {
  let score = 0;

  // LP difference (PRIMARY factor)
  const lpDiff = Math.abs(input.entity1LP - input.entity2LP);
  if (lpDiff <= LP_MATCH_IDEAL) {
    score += lpDiff * 1;
  } else if (lpDiff <= LP_MATCH_FALLBACK) {
    score += lpDiff * 5;
  } else {
    score += lpDiff * 20;
  }

  // ELO difference (SECONDARY — no hard reject)
  const eloDiff = Math.abs(input.entity1ELO - input.entity2ELO);
  if (eloDiff <= ELO_MATCH_IDEAL) {
    score += eloDiff * 0.1;
  } else if (eloDiff <= ELO_MATCH_FALLBACK) {
    score += eloDiff * 0.5;
  } else {
    score += eloDiff * 1.0;
  }

  // Recent opponent penalty (+400 per direction)
  if (input.recentOpponents1.includes(input.entity2Id)) {
    score += RECENT_OPPONENT_PENALTY;
  }
  if (input.recentOpponents2.includes(input.entity1Id)) {
    score += RECENT_OPPONENT_PENALTY;
  }

  // Same stable penalty
  if (input.entity1StableId === input.entity2StableId) {
    score += SAME_STABLE_PENALTY;
  }

  return score;
}

// ─── Recent Opponents ────────────────────────────────────────────────────────

/**
 * Batch-fetch recent opponents for a set of entity IDs.
 *
 * Delegates to an injected query function for testability and to decouple
 * from specific Prisma models (works for robots, tag teams, and team battles).
 *
 * @param entityIds - IDs of entities to fetch recent opponents for
 * @param queryFn - Injected function that performs the actual DB query.
 *                  Receives entity IDs and limit, returns Map<entityId, opponentIds[]>.
 * @param limit - Maximum number of recent opponents per entity (default: RECENT_OPPONENT_LIMIT)
 */
export async function getRecentOpponentsBatch(
  entityIds: number[],
  queryFn: (ids: number[], limit: number) => Promise<Map<number, number[]>>,
  limit: number = RECENT_OPPONENT_LIMIT
): Promise<Map<number, number[]>> {
  if (entityIds.length === 0) return new Map();
  return queryFn(entityIds, limit);
}

// ─── Bye Team Factory ────────────────────────────────────────────────────────

/**
 * Create a bye entity with neutral stats for odd-count pairing.
 *
 * Generic factory function — the caller provides a factory callback that
 * constructs the appropriate bye entity for their domain (TagTeam, TeamBattle, etc.).
 *
 * @param factory - Callback that creates the bye entity given league and leagueId
 * @param league - The league tier (e.g. 'bronze', 'silver')
 * @param leagueId - The league instance ID (e.g. 'bronze_1')
 */
export function createByeTeam<T>(
  factory: (league: string, leagueId: string) => T,
  league: string,
  leagueId: string
): T {
  return factory(league, leagueId);
}

// ─── Unified Recent-Opponent Query Factory ───────────────────────────────────

import { MatchType } from '../../../generated/prisma';

/**
 * Factory that creates a recent-opponent query function for a specific MatchType.
 *
 * The returned function queries `scheduled_matches_v2` for completed matches of the
 * given type, then extracts all other participants as "recent opponents" for each
 * entity in the input set.
 *
 * For paired modes (1v1, 2v2, 3v3, Tag Team): the other participant is the recent opponent.
 * For KotH (multi-participant): ALL other participants in the same match group are recent opponents.
 *
 * @param matchType - The MatchType to filter completed matches by
 * @param participantType - 'robot' for 1v1/KotH, 'team' for 2v2/3v3/Tag Team
 * @returns An async query function compatible with `getRecentOpponentsBatch`
 */
export function createRecentOpponentQueryFn(
  matchType: MatchType,
  participantType: 'robot' | 'team',
): (entityIds: number[], limit: number) => Promise<Map<number, number[]>> {
  return async (entityIds: number[], limit: number): Promise<Map<number, number[]>> => {
    if (entityIds.length === 0) return new Map();

    // Lazy import to avoid triggering Prisma initialization at module load time
    const prismaModule = await import('../../lib/prisma');
    const prismaClient = prismaModule.default;

    // Single query to get recent completed matches involving any of the entities
    const completedMatches = await prismaClient.scheduledMatch.findMany({
      where: {
        matchType,
        status: 'completed',
        participants: {
          some: {
            participantType,
            participantId: { in: entityIds },
          },
        },
      },
      include: {
        participants: {
          select: { participantId: true, participantType: true },
        },
      },
      orderBy: { scheduledFor: 'desc' },
      take: entityIds.length * limit,
    });

    // Build per-entity opponent lists
    const map = new Map<number, number[]>();
    for (const entityId of entityIds) {
      const opponents: number[] = [];
      for (const match of completedMatches) {
        if (opponents.length >= limit) break;
        const participantIds = match.participants
          .filter((p) => p.participantType === participantType)
          .map((p) => p.participantId);
        if (participantIds.includes(entityId)) {
          // All other participants of the same type in this match are recent opponents
          for (const opId of participantIds) {
            if (opId !== entityId && !opponents.includes(opId)) {
              opponents.push(opId);
              if (opponents.length >= limit) break;
            }
          }
        }
      }
      map.set(entityId, opponents);
    }

    return map;
  };
}

// ─── Default ScheduledFor Computation ────────────────────────────────────────

/**
 * Compute the default scheduledFor value: 24 hours from now, rounded down to the nearest hour.
 * Minutes, seconds, and milliseconds are zeroed.
 *
 * Used by all matchmaking services when no explicit scheduledFor is provided.
 */
export function defaultScheduledFor(): Date {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  return d;
}
