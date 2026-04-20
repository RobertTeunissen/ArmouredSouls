/**
 * Shared types for Battle Detail page components.
 *
 * Extracted from BattleDetailPage.tsx during component splitting (Spec 18).
 */

import type { ReactNode } from 'react';
import type { BattleLogResponse, BattleLogEvent } from '../../utils/matchmakingApi';
import type { BattleStatistics, DamageFlow } from '../../utils/battleStatistics';

export type { BattleLogResponse, BattleLogEvent };

export type TabId = 'overview' | 'playback';

export interface TabLayoutProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  hasPlayback: boolean;
  children: {
    overview: ReactNode;
    playback?: ReactNode;
  };
}

export interface BattleResultBannerProps {
  battleLog: BattleLogResponse;
  userId?: number;
  /** When true, renders compact mobile layout */
  isMobile?: boolean;
}

export interface TagTeamInfoProps {
  battleLog: BattleLogResponse;
}

export interface StableRewardsProps {
  battleLog: BattleLogResponse;
  /** When set, renders single-column for the selected robot (mobile) */
  selectedRobotIndex?: number;
}

export interface ArenaSummaryProps {
  battleLog: BattleLogResponse;
}

export interface CombatMessagesProps {
  battleLog: BattleLogResponse;
}

export interface AttributeTooltipProps {
  statName: string; // e.g., "hitRate", "critRate", "malfunction"
}

export interface BattleStatisticsSummaryProps {
  statistics: BattleStatistics;
  battleType?: string;
  robotImageUrls?: Record<string, string | null>;
  /** Robot1 name from the API — used to ensure consistent left/right ordering in duel layout */
  robot1Name?: string;
  /** Full battle log response for stance/weapon info */
  battleLog?: BattleLogResponse;
  /** When set, renders single-column for the selected robot (mobile) */
  selectedRobotIndex?: number;
}

export interface DamageFlowDiagramProps {
  damageFlows: DamageFlow[];
  battleType?: string;
  /** Full battle log for participant links and ordering */
  battleLog?: BattleLogResponse;
  /** When set, renders single-column for the selected robot (mobile) */
  selectedRobotIndex?: number;
}
