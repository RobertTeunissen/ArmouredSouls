import prisma from '../../lib/prisma';
import type { ByeRewardInput } from '../../utils/byeRewards';
import { BYE_MODE_SPECS, resolveByeReward } from '../../utils/byeRewards';

export type ByeDisplayContext = ByeRewardInput;

export interface ByeRewardDisplay {
  byeRewardCredits: number | null;
  byeRewardStatus: 'expected' | 'awarded' | 'pending';
}

function validateByeDisplayContext(input: ByeDisplayContext): void {
  const spec = BYE_MODE_SPECS[input.mode];
  if (spec.floor === 'tier_scaled' && !('tier' in input)) {
    throw new Error(`Tier is required for ${input.mode} bye display`);
  }
  if (spec.floor === 'tournament_round_loss' && !('totalParticipants' in input)) {
    throw new Error(`Tournament round context is required for ${input.mode} bye display`);
  }
}

/**
 * Build the informational reward shown for a queued bye without writing any
 * economic or battle records.
 */
export function getExpectedByeReward(input: ByeDisplayContext): ByeRewardDisplay {
  validateByeDisplayContext(input);
  return {
    byeRewardCredits: resolveByeReward(input).credits,
    byeRewardStatus: 'expected',
  };
}

/**
 * Read the awarded credit shares for the authenticated stable's real robots.
 * An incomplete Bye_Record remains pending rather than being displayed as zero.
 */
export async function getAwardedByeReward(
  battleId: number,
  robotIds: number[],
): Promise<ByeRewardDisplay> {
  if (robotIds.length === 0) {
    return { byeRewardCredits: null, byeRewardStatus: 'pending' };
  }

  const participants = await prisma.battleParticipant.findMany({
    where: { battleId, robotId: { in: robotIds } },
    select: { credits: true },
  });

  if (participants.length === 0) {
    return { byeRewardCredits: null, byeRewardStatus: 'pending' };
  }

  return {
    byeRewardCredits: participants.reduce((total, participant) => total + participant.credits, 0),
    byeRewardStatus: 'awarded',
  };
}
