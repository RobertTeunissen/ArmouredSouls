import { api } from './api';

export type FinanceTaxonomy =
  | 'battle_income'
  | 'streaming_revenue'
  | 'repair_cost'
  | 'facility_upgrade'
  | 'weapon_purchase'
  | 'weapon_sale'
  | 'weapon_refinement'
  | 'robot_creation'
  | 'attribute_upgrade'
  | 'achievement_reward'
  | 'passive_income'
  | 'operating_costs';

export type ReportScope =
  | 'current'
  | 'last_completed'
  | 'last_seven'
  | 'season_to_date'
  | 'custom';

export type EvidenceKind = 'actual' | 'quoted' | 'modelled';
export type PeriodFinality = 'current_provisional' | 'completed_historical';

export type ReconciliationLimitationCode =
  | 'missing_financial_pair'
  | 'missing_period_boundary'
  | 'snapshot_balance_disagreement'
  | 'cycle_end_balance_disagreement'
  | 'administrative_anomaly'
  | 'legacy_evidence'
  | 'cycle_identity_mismatch'
  | 'repair_link_mismatch'
  | 'battle_allocation_mismatch';

export interface ReportPeriodMetadata {
  seasonNumber: number;
  scope: ReportScope;
  fromCycle: number;
  toCycle: number;
  activeCycle: number;
  phase: 'preparation' | 'competitive';
  containsCurrentCycle: boolean;
  startsAt: string;
  endsAt: string;
  asOf: string;
  finality: PeriodFinality;
}

export interface SourceProvenance {
  evidenceKind: EvidenceKind;
  finality: PeriodFinality;
  basis: 'report_period' | 'current_context' | 'completed_sample';
  asOf: string;
}

export interface ReportLimitation {
  code: ReconciliationLimitationCode;
  message: string;
  affectedCycleNumber?: number;
  affectedSourceReference?: string;
}

export interface CycleBoundaryProof {
  cycleNumber: number;
  cycleEndBalance: number | null;
  snapshotClosingBalance: number | null;
  status: 'matched' | 'limited';
  limitations: ReportLimitation[];
}

export interface ReconciliationProof {
  status: 'reconciled' | 'provisional' | 'limited';
  orderedBy: 'cycle_number_then_audit_sequence_number';
  firstOrderKey: { cycleNumber: number; sequenceNumber: number } | null;
  lastOrderKey: { cycleNumber: number; sequenceNumber: number } | null;
  financialRecordCount: number;
  openingBalance: number | null;
  signedMovement: number;
  earnedCredits: number;
  investmentProceeds: number;
  runningCosts: number;
  investmentPurchases: number;
  closingBalance: number | null;
  equationDifference: number | null;
  completedCycleBoundaries: CycleBoundaryProof[];
  currentCurrencyConfirmation: number | null;
}

export interface FinanceReportEnvelope<TData> {
  version: 1;
  period: ReportPeriodMetadata;
  provenance: SourceProvenance[];
  reconciliation: ReconciliationProof;
  limitations: ReportLimitation[];
  data: TData;
}

export interface ItemisedStatementLine {
  taxonomy: FinanceTaxonomy;
  label: string;
  amount: number;
  sourceReference: string;
  provenance: SourceProvenance;
}

export interface RepairStatementLine extends ItemisedStatementLine {
  taxonomy: 'repair_cost';
  repairType: 'manual' | 'automatic';
  eventCount: number;
}

export interface FinanceStatement {
  provenance: SourceProvenance;
  openingBalance: number | null;
  earnedCredits: number;
  investmentProceeds: number;
  runningCosts: number;
  investmentPurchases: number;
  netCashMovement: number;
  closingBalance: number | null;
  earnedLines: ItemisedStatementLine[];
  investmentProceedLines: ItemisedStatementLine[];
  runningCostLines: Array<ItemisedStatementLine | RepairStatementLine>;
  investmentPurchaseLines: ItemisedStatementLine[];
}

export interface FullDamageRepairReference {
  provenance: SourceProvenance;
  activeRobotCount: number;
  automatic: { amount: number; robotCount: number };
  manual: { amount: number; robotCount: number; saving: number };
  repairBayDiscountPercent: number;
  scenario: 'full_repairable_damage';
}

export interface RevenueGrowth {
  provenance: SourceProvenance;
  currentEarnedCredits: number;
  previousEarnedCredits: number | null;
  amountDelta: number | null;
  percentDelta: number | null;
  comparedCycleNumber: number | null;
  comparisonBasis: 'completed_to_completed' | 'current_partial_to_completed';
  limitations: ReportLimitation[];
}

export interface PrestigeMilestoneForecast {
  provenance: SourceProvenance;
  currentPrestige: number;
  nextGatePrestige: number | null;
  remainingPrestige: number | null;
  completedCyclesSampled: number;
  positivePrestigeAwarded: number;
  averagePerCompletedCycle: number | null;
  estimatedCycles: number | null;
  status: 'available' | 'insufficient_history' | 'no_positive_pace' | 'no_next_gate';
}

export interface FinanceOverviewData {
  statement: FinanceStatement;
  revenueGrowth: RevenueGrowth;
  repairReference: FullDamageRepairReference;
  prestigeForecast: PrestigeMilestoneForecast;
}

export interface RecordedDriver {
  kind: 'financial_delta' | 'facility_upgrade' | 'standing_tier_change' | 'battle_activity' | 'repair_event';
  label: string;
  description: string;
  amountDelta: number | null;
  sourceReference: string | null;
  occurredAt: string | null;
  provenance: SourceProvenance;
}

export interface FinanceHistoryPoint {
  cycleNumber: number;
  statement: FinanceStatement;
  revenueGrowth: RevenueGrowth;
  reconciliation: ReconciliationProof;
  limitations: ReportLimitation[];
  drivers: RecordedDriver[];
}

export interface FinanceHistoryData {
  points: FinanceHistoryPoint[];
  selectedCycle: FinanceHistoryPoint | null;
}

export interface RobotFinancialSummary {
  provenance: SourceProvenance;
  robotId: number;
  robotName: string;
  foughtMatches: number;
  battleByeIncome: number;
  streamingRevenue: number;
  actualRepairSpend: number;
  directNet: number;
  fullPeriodTotal: number;
  limitations: ReportLimitation[];
}

export interface RobotFinancialEvent {
  provenance: SourceProvenance;
  occurredAt: string;
  sourceReference: string;
  eventKind: 'battle_income' | 'bye_income' | 'streaming_revenue' | 'repair_cost';
  mode: string | null;
  fought: boolean;
  amount: number;
  repairType: 'manual' | 'automatic' | null;
}

export interface PageMetadata {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  order: 'occurred_at_desc_source_reference_asc';
}

export interface RobotEventExposure {
  subscriptions: string[];
  outstandingObligations: number;
  scheduledEvents: Array<{ eventType: string; scheduledFor: string }>;
  teamMembership: { teamName: string; teamSize: number; role: 'active' | 'reserve' } | null;
}

export interface RobotFinancialEventPage {
  robot: RobotFinancialSummary;
  exposure: RobotEventExposure;
  items: RobotFinancialEvent[];
  page: PageMetadata;
  pageSubtotal?: number;
  fullPeriodTotal: number;
}

export type FinanceOverviewResponse = FinanceReportEnvelope<FinanceOverviewData>;
export type FinanceHistoryResponse = FinanceReportEnvelope<FinanceHistoryData>;
export type RobotSummaryResponse = FinanceReportEnvelope<RobotFinancialSummary[]>;
export type RobotDetailResponse = FinanceReportEnvelope<RobotFinancialEventPage>;

export type PresetReportScope = Exclude<ReportScope, 'custom'>;
export type FinancePeriodSelection =
  | { scope: PresetReportScope }
  | { scope: 'custom'; fromCycle: number; toCycle: number };

export interface FinanceRequestOptions {
  fresh?: boolean;
}

export function financePeriodKey(period: FinancePeriodSelection): string {
  return period.scope === 'custom'
    ? `custom:${period.fromCycle}:${period.toCycle}`
    : period.scope;
}

export function buildFinancePeriodParams(period: FinancePeriodSelection): Record<string, number | string> {
  if (period.scope === 'custom') {
    return { fromCycle: period.fromCycle, toCycle: period.toCycle };
  }
  return { scope: period.scope };
}

function assertVersionOne<TData>(response: FinanceReportEnvelope<TData>): FinanceReportEnvelope<TData> {
  if (
    response.version !== 1
    || response.period === undefined
    || response.reconciliation === undefined
    || response.data === undefined
    || !Array.isArray(response.provenance)
    || !Array.isArray(response.limitations)
  ) {
    throw new Error('Unsupported Finance Center response');
  }
  return response;
}

export async function getFinanceOverview(
  period: FinancePeriodSelection,
  signal?: AbortSignal,
  options?: FinanceRequestOptions,
): Promise<FinanceOverviewResponse> {
  const response = await api.get<FinanceOverviewResponse>('/api/finances/report', {
    params: buildFinancePeriodParams(period),
    signal,
    ...(options?.fresh === true ? { headers: { 'Cache-Control': 'no-cache' } } : {}),
  });
  return assertVersionOne(response);
}

export async function getFinanceHistory(
  period: FinancePeriodSelection,
  signal?: AbortSignal,
  options?: FinanceRequestOptions,
): Promise<FinanceHistoryResponse> {
  const response = await api.get<FinanceHistoryResponse>('/api/finances/history', {
    params: buildFinancePeriodParams(period),
    signal,
    ...(options?.fresh === true ? { headers: { 'Cache-Control': 'no-cache' } } : {}),
  });
  return assertVersionOne(response);
}

export async function getRobotFinancialSummaries(
  period: FinancePeriodSelection,
  signal?: AbortSignal,
  options?: FinanceRequestOptions,
): Promise<RobotSummaryResponse> {
  const response = await api.get<RobotSummaryResponse>('/api/finances/robots', {
    params: buildFinancePeriodParams(period),
    signal,
    ...(options?.fresh === true ? { headers: { 'Cache-Control': 'no-cache' } } : {}),
  });
  return assertVersionOne(response);
}

export async function getRobotFinancialEvents(
  robotId: number,
  period: FinancePeriodSelection,
  page: number,
  pageSize: number,
  signal?: AbortSignal,
  options?: FinanceRequestOptions,
): Promise<RobotDetailResponse> {
  const response = await api.get<RobotDetailResponse>(`/api/finances/robots/${robotId}/events`, {
    params: { ...buildFinancePeriodParams(period), page, pageSize },
    signal,
    ...(options?.fresh === true ? { headers: { 'Cache-Control': 'no-cache' } } : {}),
  });
  return assertVersionOne(response);
}
