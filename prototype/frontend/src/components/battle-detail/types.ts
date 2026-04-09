/**
 * Shared types for Battle Detail page components.
 *
 * Extracted from BattleDetailPage.tsx during component splitting (Spec 18).
 */

import type { BattleLogResponse, BattleLogEvent } from '../../utils/matchmakingApi';

export type { BattleLogResponse, BattleLogEvent };

export interface BattleResultBannerProps {
  battleLog: BattleLogResponse;
  userId?: number;
}

export interface TagTeamInfoProps {
  battleLog: BattleLogResponse;
}

export interface KothParticipantsProps {
  battleLog: BattleLogResponse;
  userId?: number;
}

export interface BattleSummaryProps {
  battleLog: BattleLogResponse;
}

export interface ArenaSummaryProps {
  battleLog: BattleLogResponse;
}

export interface CombatMessagesProps {
  battleLog: BattleLogResponse;
}
