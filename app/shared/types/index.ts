/**
 * API contract types shared by the backend and frontend. Type-only: import
 * them with `import type` so nothing from this folder loads at runtime.
 * Dates travel as ISO 8601 strings.
 */
export type {
  ArenaPoint,
  BattleLogEvent,
  BattleLogParticipant,
  BattleLogPayload,
  BattleLogResponse,
  BattleLogRobot,
  BattleSummaryView,
  KothLogParticipant,
  KothLogPlacement,
  KothPlaybackMetadata,
  TagTeamLogRobot,
  TagTeamLogSide,
  TagTeamLogSummary,
  TeamBattleFocusFireEvent,
  TeamBattleLog,
  TeamBattleLogEvent,
  TeamBattleParticipantResult,
  TeamMetricPair,
} from './battle-log';
export type {
  AllEconomicROIsResult,
  FacilityRecommendation,
  FacilityRecommendationPriority,
  RecommendationSummary,
  UnifiedFacilityROI,
} from './facility-roi';
export type {
  CycleBoundaryProof,
  EvidenceKind,
  FinanceHistoryData,
  FinanceHistoryPoint,
  FinanceHistoryResponse,
  FinanceOverviewData,
  FinanceOverviewResponse,
  FinanceReportEnvelope,
  FinanceStatement,
  FinanceTaxonomy,
  FullDamageRepairReference,
  ItemisedStatementLine,
  PageMetadata,
  PeriodFinality,
  PrestigeMilestoneForecast,
  ReconciliationLimitationCode,
  ReconciliationProof,
  RecordedDriver,
  RepairStatementLine,
  ReportLimitation,
  ReportPeriodMetadata,
  ReportPhase,
  ReportScope,
  RevenueGrowth,
  RobotDetailResponse,
  RobotEventExposure,
  RobotFinancialEvent,
  RobotFinancialEventPage,
  RobotFinancialSummary,
  RobotSummaryResponse,
  SourceProvenance,
} from './finance-report';
export type { FinancialSummary } from './finances';
export type { TierChange, TierChangeType, TierChangesResponse } from './league-notifications';
export type { PlacementStanding, PlacementStandingResponse } from './robot-standings';
export type { SchedulingEligibilityGate, SchedulingEligibilityGateId, SchedulingEligibilityReport } from './robot-setup';
export type { StableType } from './stable';
export type {
  EligibleEvent,
  RegistryResponse,
  StableOverview,
  StableOverviewRobot,
  SubscribableEventType,
  SubscriptionChangeResponse,
  SubscriptionChangeResult,
} from './subscriptions';
