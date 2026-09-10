import type {
  FinanceHistoryResponse,
  FinanceOverviewResponse,
  FinanceStatement,
  ReconciliationProof,
  RobotDetailResponse,
  RobotFinancialSummary,
  RobotSummaryResponse,
  SourceProvenance,
} from '../../../utils/financeApi';

export const PROVENANCE: SourceProvenance = {
  evidenceKind: 'actual',
  finality: 'current_provisional',
  basis: 'report_period',
  asOf: '2026-03-29T12:00:00.000Z',
};

export const RECONCILIATION: ReconciliationProof = {
  status: 'provisional',
  orderedBy: 'cycle_number_then_audit_sequence_number',
  firstOrderKey: { cycleNumber: 1, sequenceNumber: 1 },
  lastOrderKey: { cycleNumber: 1, sequenceNumber: 4 },
  financialRecordCount: 4,
  openingBalance: 100000,
  signedMovement: 34000,
  earnedCredits: 50000,
  investmentProceeds: 5000,
  runningCosts: 11000,
  investmentPurchases: 10000,
  closingBalance: 134000,
  equationDifference: 0,
  completedCycleBoundaries: [],
  currentCurrencyConfirmation: 134000,
};

export const STATEMENT: FinanceStatement = {
  provenance: PROVENANCE,
  openingBalance: 100000,
  earnedCredits: 50000,
  investmentProceeds: 5000,
  runningCosts: 11000,
  investmentPurchases: 10000,
  netCashMovement: 34000,
  closingBalance: 134000,
  earnedLines: [{ taxonomy: 'battle_income', label: 'Battle/bye income', amount: 45000, sourceReference: 'FS-A1', provenance: PROVENANCE }],
  investmentProceedLines: [{ taxonomy: 'weapon_sale', label: 'Weapon sale: Arc Welder', amount: 5000, sourceReference: 'FS-SALE', provenance: PROVENANCE }],
  runningCostLines: [{ taxonomy: 'repair_cost', label: 'Manual repairs', amount: 1000, sourceReference: 'FS-REPAIR', provenance: PROVENANCE, repairType: 'manual', eventCount: 1 }],
  investmentPurchaseLines: [{ taxonomy: 'weapon_refinement', label: 'Weapon Refinement', amount: 10000, sourceReference: 'FS-BUY', provenance: PROVENANCE }],
};

export const OVERVIEW_RESPONSE: FinanceOverviewResponse = {
  version: 1,
  period: {
    seasonNumber: 1,
    scope: 'current',
    fromCycle: 1,
    toCycle: 1,
    activeCycle: 1,
    phase: 'preparation',
    containsCurrentCycle: true,
    startsAt: '2026-03-29T00:00:00.000Z',
    endsAt: '2026-03-30T00:00:00.000Z',
    asOf: PROVENANCE.asOf,
    finality: 'current_provisional',
  },
  provenance: [PROVENANCE],
  reconciliation: RECONCILIATION,
  limitations: [],
  data: {
    statement: STATEMENT,
    revenueGrowth: {
      provenance: PROVENANCE,
      currentEarnedCredits: 50000,
      previousEarnedCredits: 60000,
      amountDelta: -10000,
      percentDelta: -16.7,
      comparedCycleNumber: 0,
      comparisonBasis: 'current_partial_to_completed',
      limitations: [],
    },
    repairReference: {
      provenance: { ...PROVENANCE, evidenceKind: 'quoted', basis: 'current_context' },
      activeRobotCount: 2,
      automatic: { amount: 20000, robotCount: 2 },
      manual: { amount: 10000, robotCount: 2, saving: 10000 },
      repairBayDiscountPercent: 15,
      scenario: 'full_repairable_damage',
    },
    prestigeForecast: {
      provenance: { ...PROVENANCE, evidenceKind: 'modelled', basis: 'completed_sample' },
      currentPrestige: 1200,
      nextGatePrestige: 2000,
      remainingPrestige: 800,
      completedCyclesSampled: 4,
      positivePrestigeAwarded: 400,
      averagePerCompletedCycle: 100,
      estimatedCycles: 8,
      status: 'available',
    },
  },
};

export const HISTORY_RESPONSE: FinanceHistoryResponse = {
  ...OVERVIEW_RESPONSE,
  data: {
    points: [{
      cycleNumber: 1,
      statement: STATEMENT,
      revenueGrowth: OVERVIEW_RESPONSE.data.revenueGrowth,
      reconciliation: RECONCILIATION,
      limitations: [],
      drivers: [],
    }],
    selectedCycle: null,
  },
};

export const ROBOT: RobotFinancialSummary = {
  provenance: PROVENANCE,
  robotId: 7,
  robotName: 'Atlas',
  foughtMatches: 3,
  battleByeIncome: 12000,
  streamingRevenue: 2000,
  actualRepairSpend: 1000,
  directNet: 13000,
  fullPeriodTotal: 13000,
  limitations: [],
};

export const ROBOT_SUMMARY_RESPONSE: RobotSummaryResponse = {
  ...OVERVIEW_RESPONSE,
  data: [ROBOT],
};

export const ROBOT_DETAIL_RESPONSE: RobotDetailResponse = {
  ...OVERVIEW_RESPONSE,
  data: {
    robot: ROBOT,
    exposure: {
      subscriptions: ['league_1v1'],
      outstandingObligations: 1,
      scheduledEvents: [{ eventType: 'league_1v1', scheduledFor: '2026-03-30T08:00:00.000Z' }],
      teamMembership: null,
    },
    items: [
      { provenance: PROVENANCE, occurredAt: '2026-03-29T10:00:00.000Z', sourceReference: 'FS-BYE', eventKind: 'bye_income', mode: 'league_1v1', fought: false, amount: 2000, repairType: null },
      { provenance: PROVENANCE, occurredAt: '2026-03-29T09:00:00.000Z', sourceReference: 'FS-REPAIR', eventKind: 'repair_cost', mode: null, fought: false, amount: -1000, repairType: 'manual' },
    ],
    page: { page: 1, pageSize: 20, totalItems: 22, totalPages: 2, hasNextPage: true, order: 'occurred_at_desc_source_reference_asc' },
    pageSubtotal: 1000,
    fullPeriodTotal: 13000,
  },
};
