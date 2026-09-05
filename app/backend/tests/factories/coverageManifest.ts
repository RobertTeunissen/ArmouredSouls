import {
  discoverDirectCurrencyMutations,
  findWorkspaceRoot,
  mutationKey,
  type CurrencyMutationOperation,
  type DiscoveredDirectCurrencyMutation,
} from '../../src/services/migration/directWriterCoverage';

export const TRANSACTION_TYPES = [
  'battle_income',
  'streaming_revenue',
  'repair_cost',
  'facility_upgrade',
  'weapon_purchase',
  'weapon_sale',
  'weapon_refinement',
  'robot_creation',
  'attribute_upgrade',
  'achievement_reward',
  'passive_income',
  'operating_costs',
] as const;

export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const BATTLE_MODES = [
  'league_1v1',
  'tournament_1v1',
  'tag_team',
  'koth',
  'league_2v2',
  'league_3v3',
  'tournament_2v2',
  'tournament_3v3',
  'grand_melee',
] as const;

export type BattleMode = (typeof BATTLE_MODES)[number];
export type TestTier = 'unit' | 'integration' | 'heavy' | 'frontend' | 'e2e';
export type { CurrencyMutationOperation } from '../../src/services/migration/directWriterCoverage';

export interface ManifestSource {
  file: string;
  symbol: string;
}

export interface DirectCurrencyMutation {
  operation: CurrencyMutationOperation;
  occurrence: number;
}

export type ManifestEntryStatus =
  | 'baseline-direct-writer'
  | 'opening-balance-boundary'
  | 'positive-prestige-source'
  | 'shared-prestige-writer'
  | 'bye-caller'
  | 'bye-implementation'
  | 'compatibility-entry-point'
  | 'canonical-source';

export interface CoverageManifestEntry {
  id: string;
  area:
    | 'battle-income'
    | 'streaming'
    | 'achievement'
    | 'economic-operation'
    | 'repair'
    | 'settlement'
    | 'prestige'
    | 'bye'
    | 'subscription'
    | 'lifecycle';
  status: ManifestEntryStatus;
  currentSource: ManifestSource;
  finalService: string;
  expectedTaxonomy: readonly TransactionType[];
  identityStrategy: string;
  pairedOrDomainRecords: readonly string[];
  targetTestTiers: readonly TestTier[];
  directCurrencyMutation?: DirectCurrencyMutation;
  notes: string;
}

export interface ByeCallerBoundary {
  id: string;
  currentSource: ManifestSource;
  modes: readonly BattleMode[];
  finalService: 'Bye_Reward_Module';
  identityStrategy: string;
  pairedOrDomainRecords: readonly string[];
  targetTestTiers: readonly TestTier[];
  notes: string;
}

export interface PrestigeSourceBoundary {
  id: string;
  currentSource: ManifestSource;
  finalService: 'Prestige_Service';
  source: 'battle' | 'achievement';
  identityStrategy: string;
  pairedOrDomainRecords: readonly string[];
  targetTestTiers: readonly TestTier[];
  notes: string;
}

export interface PrestigeWriterBoundary {
  id: string;
  currentSource: ManifestSource;
  kind: 'positive-award' | 'lifecycle-reset';
  finalService: 'Prestige_Service' | 'Opening_Balance_Boundary';
  expectedOutput: 'prestige_change' | 'none';
  targetTestTiers: readonly TestTier[];
  notes: string;
}

export interface SettlementEntryPoint {
  id: string;
  currentSource: ManifestSource;
  mutatesUserCurrency: boolean;
  expectedTaxonomy: readonly ('passive_income' | 'operating_costs')[];
  finalService: 'Settlement_Service';
  identityStrategy: string;
  pairedOrDomainRecords: readonly string[];
  targetTestTiers: readonly TestTier[];
  notes: string;
}

export interface SubscriptionBoundary {
  currentSource: ManifestSource;
  eventTypes: readonly BattleMode[];
  finalService: 'Booking_Office';
  financialOutput: 'none';
  domainRecords: readonly string[];
  targetTestTiers: readonly TestTier[];
  notes: string;
}

export interface LifecycleBoundary {
  id: string;
  currentSource: ManifestSource;
  operation: 'account_creation' | 'account_reset' | 'season_rollover' | 'balance_purge';
  financialOutput: 'none';
  domainRecords: readonly string[];
  targetTestTiers: readonly TestTier[];
  notes: string;
}

export interface AdminCompatibilitySurface {
  id: string;
  route: string;
  currentSource: ManifestSource;
  purpose: string;
  preserves: readonly string[];
  targetTestTiers: readonly TestTier[];
}

export interface TestTierCoverage {
  tier: TestTier;
  command: string;
  surfaces: readonly string[];
  assertions: readonly string[];
}

export interface NoUiBoundary {
  unchangedFiles: readonly string[];
  playerGuideValidation: string;
  deferredConcepts: readonly string[];
  notes: string;
}

export interface DirectWriterPolicy {
  productionRoot: string;
  excludedPaths: readonly string[];
  sharedServicePath: string;
  lifecycleBoundaryIds: readonly string[];
  baselineRule: string;
  postMigrationRule: string;
}

export interface RepairSpendSource {
  canonicalSource: ManifestSource;
  eventType: 'robot_repair';
  chargedAmountField: 'creditsCharged';
  subtypeField: 'repairType';
  allowedSubtypes: readonly ['manual', 'automatic'];
  forbiddenSources: readonly string[];
}

export interface CoverageManifest {
  version: 1;
  currencyField: 'User.currency';
  transactionTaxonomy: typeof TRANSACTION_TYPES;
  battleModes: typeof BATTLE_MODES;
  entries: readonly CoverageManifestEntry[];
  byeCallerBoundaries: readonly ByeCallerBoundary[];
  prestigeSources: readonly PrestigeSourceBoundary[];
  prestigeWriters: readonly PrestigeWriterBoundary[];
  repairSpendSource: RepairSpendSource;
  settlementEntryPoints: readonly SettlementEntryPoint[];
  subscriptionBoundary: SubscriptionBoundary;
  lifecycleBoundaries: readonly LifecycleBoundary[];
  adminCompatibilitySurfaces: readonly AdminCompatibilitySurface[];
  testTiers: readonly TestTierCoverage[];
  noUiBoundary: NoUiBoundary;
  directWriterPolicy: DirectWriterPolicy;
}

const ALL_CRITICAL_TIERS: readonly TestTier[] = ['unit', 'integration', 'heavy'];
const UNIT_AND_INTEGRATION: readonly TestTier[] = ['unit', 'integration'];

const directCurrencyEntries: readonly CoverageManifestEntry[] = [
  {
    id: 'currency-battle-simple-award',
    area: 'battle-income',
    status: 'baseline-direct-writer',
    currentSource: {
      file: 'app/backend/src/services/battle/battlePostCombat.ts',
      symbol: 'awardCreditsToUser',
    },
    finalService: 'Credit_Mutation_Service',
    expectedTaxonomy: ['battle_income'],
    identityStrategy: 'source battle or scheduled match + stable user + battle_income component',
    pairedOrDomainRecords: ['FinancialLedger', 'AuditLog:eventType=financial_transaction', 'battle_complete compatibility record'],
    targetTestTiers: ALL_CRITICAL_TIERS,
    notes: 'Simple battle credit helper currently mutates User.currency without a ledger pair.',
  },
  {
    id: 'currency-battle-ledger-award',
    area: 'battle-income',
    status: 'baseline-direct-writer',
    currentSource: {
      file: 'app/backend/src/services/battle/battlePostCombat.ts',
      symbol: 'awardCreditsWithLedger',
    },
    finalService: 'Credit_Mutation_Service',
    expectedTaxonomy: ['battle_income'],
    identityStrategy: 'source battle or scheduled match + stable user + battle_income component',
    pairedOrDomainRecords: ['FinancialLedger', 'AuditLog:eventType=financial_transaction', 'battle_complete compatibility record'],
    targetTestTiers: ALL_CRITICAL_TIERS,
    notes: 'Current legacy ledger enrichment happens after the balance update and may be disabled or swallowed.',
  },
  {
    id: 'currency-streaming-award',
    area: 'streaming',
    status: 'baseline-direct-writer',
    currentSource: {
      file: 'app/backend/src/services/economy/streamingRevenueService.ts',
      symbol: 'awardStreamingRevenue',
    },
    finalService: 'Credit_Mutation_Service',
    expectedTaxonomy: ['streaming_revenue'],
    identityStrategy: 'source battle + participating robot + streaming_revenue',
    pairedOrDomainRecords: ['FinancialLedger', 'AuditLog:eventType=financial_transaction', 'BattleParticipant.streamingRevenue'],
    targetTestTiers: ALL_CRITICAL_TIERS,
    notes: 'The per-robot formula is already centralized; the balance write is not paired atomically.',
  },
  {
    id: 'currency-koth-combined-award',
    area: 'battle-income',
    status: 'baseline-direct-writer',
    currentSource: {
      file: 'app/backend/src/services/koth/kothBattleOrchestrator.ts',
      symbol: 'processKothBattle',
    },
    finalService: 'Battle_Financial_Reward_Service',
    expectedTaxonomy: ['battle_income', 'streaming_revenue'],
    identityStrategy: 'source KotH battle + stable recipient + separate reward component',
    pairedOrDomainRecords: ['FinancialLedger', 'AuditLog:eventType=financial_transaction', 'battle_complete compatibility record', 'Prestige_Audit_Record'],
    targetTestTiers: ALL_CRITICAL_TIERS,
    notes: 'Current combined update folds battle income and Streaming Studio revenue together and also updates prestige.',
  },
  {
    id: 'currency-grand-melee-combined-award',
    area: 'battle-income',
    status: 'baseline-direct-writer',
    currentSource: {
      file: 'app/backend/src/services/grand-melee/grandMeleeBattleOrchestrator.ts',
      symbol: 'processGrandMeleeBattle',
    },
    finalService: 'Battle_Financial_Reward_Service',
    expectedTaxonomy: ['battle_income', 'streaming_revenue'],
    identityStrategy: 'source Grand Melee battle + stable recipient + separate reward component',
    pairedOrDomainRecords: ['FinancialLedger', 'AuditLog:eventType=financial_transaction', 'battle_complete compatibility record', 'Prestige_Audit_Record'],
    targetTestTiers: ALL_CRITICAL_TIERS,
    notes: 'Current combined update is the second placement-mode exception and must be split later.',
  },
  {
    id: 'currency-achievement-reward',
    area: 'achievement',
    status: 'baseline-direct-writer',
    currentSource: {
      file: 'app/backend/src/services/achievement/achievementService.ts',
      symbol: 'AchievementService.checkAndAward',
    },
    finalService: 'Credit_Mutation_Service + Prestige_Service',
    expectedTaxonomy: ['achievement_reward'],
    identityStrategy: 'achievement unlock identity + stable user + achievement_reward',
    pairedOrDomainRecords: ['FinancialLedger', 'AuditLog:eventType=financial_transaction', 'achievement_unlock compatibility record', 'Prestige_Audit_Record when rewardPrestige > 0'],
    targetTestTiers: ALL_CRITICAL_TIERS,
    notes: 'The current User.update mutates currency and prestige together after creating the unlock row.',
  },
  {
    id: 'currency-weapon-purchase',
    area: 'economic-operation',
    status: 'baseline-direct-writer',
    currentSource: {
      file: 'app/backend/src/routes/weaponInventory.ts',
      symbol: 'POST /purchase transaction',
    },
    finalService: 'Credit_Mutation_Service',
    expectedTaxonomy: ['weapon_purchase'],
    identityStrategy: 'durable purchase operation + user + weapon inventory identity',
    pairedOrDomainRecords: ['FinancialLedger', 'AuditLog:eventType=financial_transaction', 'weapon purchase audit compatibility record'],
    targetTestTiers: ALL_CRITICAL_TIERS,
    notes: 'Ownership and lockUserForSpending remain part of the later shared-service transaction.',
  },
  {
    id: 'currency-weapon-sale',
    area: 'economic-operation',
    status: 'baseline-direct-writer',
    currentSource: {
      file: 'app/backend/src/routes/weaponInventory.ts',
      symbol: 'DELETE /:id resale transaction',
    },
    finalService: 'Credit_Mutation_Service',
    expectedTaxonomy: ['weapon_sale'],
    identityStrategy: 'durable resale operation + user + weapon inventory identity',
    pairedOrDomainRecords: ['FinancialLedger', 'AuditLog:eventType=financial_transaction', 'weapon sale audit compatibility record'],
    targetTestTiers: ALL_CRITICAL_TIERS,
    notes: 'Sale is positive income and must remain distinct from purchase/refinement spending.',
  },
  {
    id: 'currency-weapon-refinement',
    area: 'economic-operation',
    status: 'baseline-direct-writer',
    currentSource: {
      file: 'app/backend/src/routes/weaponInventory.ts',
      symbol: 'POST /:id/refine transaction',
    },
    finalService: 'Credit_Mutation_Service',
    expectedTaxonomy: ['weapon_refinement'],
    identityStrategy: 'durable refinement operation + user + weapon inventory identity',
    pairedOrDomainRecords: ['FinancialLedger', 'AuditLog:eventType=financial_transaction', 'refinement audit compatibility record'],
    targetTestTiers: ALL_CRITICAL_TIERS,
    notes: 'The occurrence is the second decrementing currency mutation in this route file.',
  },
  {
    id: 'currency-facility-upgrade',
    area: 'economic-operation',
    status: 'baseline-direct-writer',
    currentSource: {
      file: 'app/backend/src/routes/facility.ts',
      symbol: 'POST /upgrade transaction',
    },
    finalService: 'Credit_Mutation_Service',
    expectedTaxonomy: ['facility_upgrade'],
    identityStrategy: 'durable facility upgrade operation + user + facility type/level transition',
    pairedOrDomainRecords: ['FinancialLedger', 'AuditLog:eventType=financial_transaction', 'facility upgrade audit compatibility record'],
    targetTestTiers: ALL_CRITICAL_TIERS,
    notes: 'The existing spending lock and ownership checks must remain inside the final operation.',
  },
  {
    id: 'currency-robot-creation',
    area: 'economic-operation',
    status: 'baseline-direct-writer',
    currentSource: {
      file: 'app/backend/src/services/robot/robotCreationService.ts',
      symbol: 'createRobotTransaction',
    },
    finalService: 'Credit_Mutation_Service',
    expectedTaxonomy: ['robot_creation'],
    identityStrategy: 'durable robot-creation operation + user + created robot identity',
    pairedOrDomainRecords: ['FinancialLedger', 'AuditLog:eventType=financial_transaction', 'Robot', 'Standing rows'],
    targetTestTiers: ALL_CRITICAL_TIERS,
    notes: 'The balance charge and robot/standing creation currently share a transaction but not a financial pair.',
  },
  {
    id: 'currency-attribute-upgrade',
    area: 'economic-operation',
    status: 'baseline-direct-writer',
    currentSource: {
      file: 'app/backend/src/services/robot/robotUpgradeService.ts',
      symbol: 'executeUpgradeTransaction',
    },
    finalService: 'Credit_Mutation_Service',
    expectedTaxonomy: ['attribute_upgrade'],
    identityStrategy: 'durable upgrade operation + user + robot + ordered attribute transitions',
    pairedOrDomainRecords: ['FinancialLedger', 'AuditLog:eventType=financial_transaction', 'Robot attribute update'],
    targetTestTiers: ALL_CRITICAL_TIERS,
    notes: 'Freshly recalculated locked pricing is part of the future Financial_Breakdown, not the identity.',
  },
  {
    id: 'currency-manual-repair',
    area: 'repair',
    status: 'baseline-direct-writer',
    currentSource: {
      file: 'app/backend/src/services/robot/robotRepairService.ts',
      symbol: 'repairAllRobots',
    },
    finalService: 'Credit_Mutation_Service',
    expectedTaxonomy: ['repair_cost'],
    identityStrategy: 'manual repair operation + repaired robot + repair_cost',
    pairedOrDomainRecords: ['FinancialLedger', 'AuditLog:eventType=financial_transaction', 'AuditLog:eventType=robot_repair', 'lifetimeRepairCreditsPaid'],
    targetTestTiers: ALL_CRITICAL_TIERS,
    notes: 'The current batch charge already quotes per robot before summing; the final path must preserve that fact.',
  },
  {
    id: 'currency-automatic-repair',
    area: 'repair',
    status: 'baseline-direct-writer',
    currentSource: {
      file: 'app/backend/src/services/economy/repairService.ts',
      symbol: 'repairRobots',
    },
    finalService: 'Credit_Mutation_Service',
    expectedTaxonomy: ['repair_cost'],
    identityStrategy: 'automatic repair operation + repaired robot + repair_cost',
    pairedOrDomainRecords: ['FinancialLedger', 'AuditLog:eventType=financial_transaction', 'AuditLog:eventType=robot_repair', 'lifetimeRepairCreditsPaid'],
    targetTestTiers: ALL_CRITICAL_TIERS,
    notes: 'The event scope includes a robot with a Bye_Event and remains separate from the bye reward.',
  },
  {
    id: 'currency-admin-repair',
    area: 'repair',
    status: 'baseline-direct-writer',
    currentSource: {
      file: 'app/backend/src/services/admin/adminMaintenanceService.ts',
      symbol: 'repairAllRobotsAdmin',
    },
    finalService: 'Credit_Mutation_Service',
    expectedTaxonomy: ['repair_cost'],
    identityStrategy: 'admin repair operation + repaired robot + repair_cost',
    pairedOrDomainRecords: ['FinancialLedger', 'AuditLog:eventType=financial_transaction', 'AuditLog:eventType=robot_repair'],
    targetTestTiers: ALL_CRITICAL_TIERS,
    notes: 'Charged admin maintenance is included; free administrative repair has no credit mutation.',
  },
  {
    id: 'currency-scheduled-passive-income',
    area: 'settlement',
    status: 'baseline-direct-writer',
    currentSource: {
      file: 'app/backend/src/services/cycle/cycleScheduler.ts',
      symbol: 'executeSettlement',
    },
    finalService: 'Settlement_Service',
    expectedTaxonomy: ['passive_income'],
    identityStrategy: 'stable user + cycle number + passive_income component',
    pairedOrDomainRecords: ['FinancialLedger', 'AuditLog:eventType=financial_transaction', 'AuditLog:eventType=passive_income', 'cycle snapshot stableMetrics'],
    targetTestTiers: ALL_CRITICAL_TIERS,
    notes: 'Current scheduler implementation credits Merchandising Hub income and logs a domain event separately.',
  },
  {
    id: 'currency-scheduled-operating-costs',
    area: 'settlement',
    status: 'baseline-direct-writer',
    currentSource: {
      file: 'app/backend/src/services/cycle/cycleScheduler.ts',
      symbol: 'executeSettlement',
    },
    finalService: 'Settlement_Service',
    expectedTaxonomy: ['operating_costs'],
    identityStrategy: 'stable user + cycle number + operating_costs component',
    pairedOrDomainRecords: ['FinancialLedger', 'AuditLog:eventType=financial_transaction', 'AuditLog:eventType=operating_costs', 'cycle snapshot stableMetrics'],
    targetTestTiers: ALL_CRITICAL_TIERS,
    notes: 'Current scheduler implementation debits facility and roster operating costs separately from passive income.',
  },
  {
    id: 'currency-admin-bulk-settlement',
    area: 'settlement',
    status: 'baseline-direct-writer',
    currentSource: {
      file: 'app/backend/src/services/admin/adminCycleService.ts',
      symbol: 'executeBulkCycles',
    },
    finalService: 'Settlement_Service',
    expectedTaxonomy: ['passive_income', 'operating_costs'],
    identityStrategy: 'stable user + cycle number + component; never a net settlement identity',
    pairedOrDomainRecords: ['FinancialLedger', 'AuditLog:eventType=financial_transaction', 'passive_income compatibility record', 'operating_costs compatibility record'],
    targetTestTiers: ALL_CRITICAL_TIERS,
    notes: 'The current bulk path applies one net currency mutation; the final service must emit two component events.',
  },
  {
    id: 'currency-legacy-daily-finances',
    area: 'settlement',
    status: 'baseline-direct-writer',
    currentSource: {
      file: 'app/backend/src/utils/economyCalculations.ts',
      symbol: 'processDailyFinances',
    },
    finalService: 'Settlement_Service',
    expectedTaxonomy: ['operating_costs'],
    identityStrategy: 'stable user + cycle number + operating_costs component',
    pairedOrDomainRecords: ['FinancialLedger', 'AuditLog:eventType=financial_transaction', 'admin response summary'],
    targetTestTiers: ALL_CRITICAL_TIERS,
    notes: 'Compatibility route currently invokes processAllDailyFinances/processDailyFinances, an independent mutation implementation.',
  },
  {
    id: 'currency-generated-stable-opening-balance',
    area: 'lifecycle',
    status: 'opening-balance-boundary',
    currentSource: {
      file: 'app/backend/src/utils/userGeneration.ts',
      symbol: 'generateBattleReadyUsers',
    },
    finalService: 'Opening_Balance_Boundary',
    expectedTaxonomy: [],
    identityStrategy: 'generated stable creation identity; starting balance is not current-economy income',
    pairedOrDomainRecords: ['User row with isGenerated=true', 'generated robot/team domain rows'],
    targetTestTiers: ['unit', 'integration', 'heavy'],
    directCurrencyMutation: { operation: 'set', occurrence: 1 },
    notes: 'Generated stables are created with an explicit opening balance and are deleted, not reset, at Season_Rollover.',
  },
];

const modeEntries: readonly CoverageManifestEntry[] = [
  {
    id: 'battle-mode-league-1v1',
    area: 'battle-income',
    status: 'compatibility-entry-point',
    currentSource: { file: 'app/backend/src/services/league/leagueBattleOrchestrator.ts', symbol: 'processBattle' },
    finalService: 'Battle_Financial_Reward_Service',
    expectedTaxonomy: ['battle_income', 'streaming_revenue'],
    identityStrategy: 'battle or scheduled match + recipient stable/robot + reward component',
    pairedOrDomainRecords: ['FinancialLedger', 'financial_transaction AuditLog', 'battle_complete AuditLog', 'BattleParticipant'],
    targetTestTiers: ALL_CRITICAL_TIERS,
    notes: 'Fought league_1v1 path; prestige is separately listed in prestigeSources.',
  },
  {
    id: 'battle-mode-tournament-1v1',
    area: 'battle-income',
    status: 'compatibility-entry-point',
    currentSource: { file: 'app/backend/src/services/tournament/tournamentBattleOrchestrator.ts', symbol: 'processTournamentBattle' },
    finalService: 'Battle_Financial_Reward_Service',
    expectedTaxonomy: ['battle_income', 'streaming_revenue'],
    identityStrategy: 'scheduled tournament match + recipient stable/robot + round reward component',
    pairedOrDomainRecords: ['FinancialLedger', 'financial_transaction AuditLog', 'battle_complete AuditLog', 'BattleParticipant'],
    targetTestTiers: ALL_CRITICAL_TIERS,
    notes: 'Fought 1v1 tournament path; tournament bye resolution is a separate caller boundary.',
  },
  {
    id: 'battle-mode-tag-team',
    area: 'battle-income',
    status: 'compatibility-entry-point',
    currentSource: { file: 'app/backend/src/services/tag-team/tagTeamResultUpdater.ts', symbol: 'updateTagTeamBattleResults' },
    finalService: 'Battle_Financial_Reward_Service',
    expectedTaxonomy: ['battle_income', 'streaming_revenue'],
    identityStrategy: 'tag-team battle + recipient stable/robot + reward component',
    pairedOrDomainRecords: ['FinancialLedger', 'financial_transaction AuditLog', 'battle_complete AuditLog', 'BattleParticipant'],
    targetTestTiers: ALL_CRITICAL_TIERS,
    notes: 'Fought sequential tag-team path; no tag-team bye simulation is allowed.',
  },
  {
    id: 'battle-mode-koth',
    area: 'battle-income',
    status: 'compatibility-entry-point',
    currentSource: { file: 'app/backend/src/services/koth/kothBattleOrchestrator.ts', symbol: 'processKothBattle' },
    finalService: 'Battle_Financial_Reward_Service',
    expectedTaxonomy: ['battle_income', 'streaming_revenue'],
    identityStrategy: 'KotH battle + placement participant + recipient stable/robot + component',
    pairedOrDomainRecords: ['FinancialLedger', 'financial_transaction AuditLog', 'battle_complete AuditLog', 'BattleParticipant'],
    targetTestTiers: ALL_CRITICAL_TIERS,
    notes: 'Fought placement-mode path; current combined currency/prestige/streaming update is a known exception.',
  },
  {
    id: 'battle-mode-league-2v2',
    area: 'battle-income',
    status: 'compatibility-entry-point',
    currentSource: { file: 'app/backend/src/services/team-battle/teamBattleOrchestrator.ts', symbol: 'executeSingleTeamBattle(teamSize=2)' },
    finalService: 'Battle_Financial_Reward_Service',
    expectedTaxonomy: ['battle_income', 'streaming_revenue'],
    identityStrategy: 'team battle + recipient stable + aggregate battle component; each eligible robot stream component',
    pairedOrDomainRecords: ['FinancialLedger', 'financial_transaction AuditLog', 'battle_complete AuditLog', 'BattleParticipant'],
    targetTestTiers: ALL_CRITICAL_TIERS,
    notes: 'Stable-level battle income must not fan out once per robot; streaming remains per robot.',
  },
  {
    id: 'battle-mode-league-3v3',
    area: 'battle-income',
    status: 'compatibility-entry-point',
    currentSource: { file: 'app/backend/src/services/team-battle/teamBattleOrchestrator.ts', symbol: 'executeSingleTeamBattle(teamSize=3)' },
    finalService: 'Battle_Financial_Reward_Service',
    expectedTaxonomy: ['battle_income', 'streaming_revenue'],
    identityStrategy: 'team battle + recipient stable + aggregate battle component; each eligible robot stream component',
    pairedOrDomainRecords: ['FinancialLedger', 'financial_transaction AuditLog', 'battle_complete AuditLog', 'BattleParticipant'],
    targetTestTiers: ALL_CRITICAL_TIERS,
    notes: 'The team-size distinction belongs in Financial_Breakdown, not in a second writer.',
  },
  {
    id: 'battle-mode-tournament-2v2',
    area: 'battle-income',
    status: 'compatibility-entry-point',
    currentSource: { file: 'app/backend/src/services/tournament/teamTournamentBattleOrchestrator.ts', symbol: 'executeTeamTournamentRound(teamSize=2)' },
    finalService: 'Battle_Financial_Reward_Service',
    expectedTaxonomy: ['battle_income', 'streaming_revenue'],
    identityStrategy: 'tournament match + round + recipient stable + component',
    pairedOrDomainRecords: ['FinancialLedger', 'financial_transaction AuditLog', 'battle_complete AuditLog', 'BattleParticipant'],
    targetTestTiers: ALL_CRITICAL_TIERS,
    notes: 'Team tournament rewards are round/placement-aware and are aggregated at stable level.',
  },
  {
    id: 'battle-mode-tournament-3v3',
    area: 'battle-income',
    status: 'compatibility-entry-point',
    currentSource: { file: 'app/backend/src/services/tournament/teamTournamentBattleOrchestrator.ts', symbol: 'executeTeamTournamentRound(teamSize=3)' },
    finalService: 'Battle_Financial_Reward_Service',
    expectedTaxonomy: ['battle_income', 'streaming_revenue'],
    identityStrategy: 'tournament match + round + recipient stable + component',
    pairedOrDomainRecords: ['FinancialLedger', 'financial_transaction AuditLog', 'battle_complete AuditLog', 'BattleParticipant'],
    targetTestTiers: ALL_CRITICAL_TIERS,
    notes: 'This shares the team tournament path but remains an explicit mode in the coverage inventory.',
  },
  {
    id: 'battle-mode-grand-melee',
    area: 'battle-income',
    status: 'compatibility-entry-point',
    currentSource: { file: 'app/backend/src/services/grand-melee/grandMeleeBattleOrchestrator.ts', symbol: 'processGrandMeleeBattle' },
    finalService: 'Battle_Financial_Reward_Service',
    expectedTaxonomy: ['battle_income', 'streaming_revenue'],
    identityStrategy: 'Grand Melee battle + placement + recipient stable/robot + component',
    pairedOrDomainRecords: ['FinancialLedger', 'financial_transaction AuditLog', 'battle_complete AuditLog', 'BattleParticipant'],
    targetTestTiers: ALL_CRITICAL_TIERS,
    notes: 'Fought placement-mode path; current combined currency/prestige/streaming update is a known exception.',
  },
];

const byeImplementationEntry: CoverageManifestEntry = {
  id: 'bye-resolution-implementation',
  area: 'bye',
  status: 'bye-implementation',
  currentSource: { file: 'app/backend/src/services/battle/byeResolutionService.ts', symbol: 'resolveByeEvent' },
  finalService: 'Bye_Reward_Module',
  expectedTaxonomy: ['battle_income'],
  identityStrategy: 'queued match claim identity; scheduled match or tournament match token is claimed before payment',
  pairedOrDomainRecords: ['FinancialLedger', 'financial_transaction AuditLog', 'Bye_Event Battle row', 'inert BattleParticipant rows', 'zero-event BattleSummary'],
  targetTestTiers: ['unit', 'integration', 'heavy'],
  notes: 'A bye pays only the mode-scaled participation floor; no simulation, streaming, prestige, fame, draw, or bye-attributed repair.',
};

const byeCallerBoundaries: readonly ByeCallerBoundary[] = [
  {
    id: 'bye-caller-league-1v1',
    currentSource: { file: 'app/backend/src/services/league/leagueBattleOrchestrator.ts', symbol: 'processByeBattle' },
    modes: ['league_1v1'],
    finalService: 'Bye_Reward_Module',
    identityStrategy: 'scheduled_matches_v2.id + stable user + battle_income bye component',
    pairedOrDomainRecords: ['Bye_Event Battle row', 'FinancialLedger', 'financial_transaction AuditLog', 'Standing/ELO compatibility updates'],
    targetTestTiers: ALL_CRITICAL_TIERS,
    notes: 'Direct resolveByeEvent caller #1.',
  },
  {
    id: 'bye-caller-team-league',
    currentSource: { file: 'app/backend/src/services/team-battle/teamBattleOrchestrator.ts', symbol: 'resolveTeamLeagueBye' },
    modes: ['league_2v2', 'league_3v3'],
    finalService: 'Bye_Reward_Module',
    identityStrategy: 'scheduled_matches_v2.id + team stable + battle_income bye component',
    pairedOrDomainRecords: ['Bye_Event Battle row', 'FinancialLedger', 'financial_transaction AuditLog', 'team Standing/ELO compatibility updates'],
    targetTestTiers: ALL_CRITICAL_TIERS,
    notes: 'Direct resolveByeEvent caller #2 and the shared team-size branch for both league modes.',
  },
  {
    id: 'bye-caller-tag-team',
    currentSource: { file: 'app/backend/src/services/tag-team/tagTeamScheduler.ts', symbol: 'resolveTagTeamBye' },
    modes: ['tag_team'],
    finalService: 'Bye_Reward_Module',
    identityStrategy: 'scheduled_matches_v2.id + team stable + battle_income bye component',
    pairedOrDomainRecords: ['Bye_Event Battle row', 'FinancialLedger', 'financial_transaction AuditLog', 'team Standing/ELO compatibility updates'],
    targetTestTiers: ALL_CRITICAL_TIERS,
    notes: 'Direct resolveByeEvent caller #3.',
  },
  {
    id: 'bye-caller-tournaments',
    currentSource: { file: 'app/backend/src/services/tournament/tournamentService.ts', symbol: 'completeByeMatch' },
    modes: ['tournament_1v1', 'tournament_2v2', 'tournament_3v3'],
    finalService: 'Bye_Reward_Module',
    identityStrategy: 'scheduled_tournament_matches.id + tournament round + recipient stable + battle_income bye component',
    pairedOrDomainRecords: ['Bye_Event Battle row', 'FinancialLedger', 'financial_transaction AuditLog', 'bracket advancement compatibility record'],
    targetTestTiers: ALL_CRITICAL_TIERS,
    notes: 'Direct resolveByeEvent caller #4; tournament bracket status is the claim token boundary.',
  },
  {
    id: 'bye-caller-placement-thin-instance',
    currentSource: { file: 'app/backend/src/services/scheduling/thinInstanceByes.ts', symbol: 'resolvePlacementBye' },
    modes: ['koth', 'grand_melee'],
    finalService: 'Bye_Reward_Module',
    identityStrategy: 'scheduled_matches_v2.id + robot stable + battle_income bye component',
    pairedOrDomainRecords: ['Bye_Event Battle row', 'FinancialLedger', 'financial_transaction AuditLog', 'zero-standing/zero-ELO placement compatibility record'],
    targetTestTiers: ALL_CRITICAL_TIERS,
    notes: 'Direct resolveByeEvent caller #5; covers thin KotH and Grand Melee instances below the minimum field size.',
  },
];

const prestigeSources: readonly PrestigeSourceBoundary[] = [
  {
    id: 'prestige-source-league-1v1',
    currentSource: { file: 'app/backend/src/services/league/leagueBattleOrchestrator.ts', symbol: 'calculatePrestigeForBattle + updateRobotStats' },
    finalService: 'Prestige_Service',
    source: 'battle',
    identityStrategy: 'fought battle id + recipient stable + battle prestige component',
    pairedOrDomainRecords: ["AuditLog:eventType=prestige_change", 'battle_complete compatibility record', 'User.prestige'],
    targetTestTiers: ALL_CRITICAL_TIERS,
    notes: 'Positive 1v1 league prestige; draws and bye paths return zero.',
  },
  {
    id: 'prestige-source-tournament-1v1',
    currentSource: { file: 'app/backend/src/services/tournament/tournamentBattleOrchestrator.ts', symbol: 'processTournamentBattle + updateRobotStatsForTournament' },
    finalService: 'Prestige_Service',
    source: 'battle',
    identityStrategy: 'tournament battle id + round + winner stable + battle prestige component',
    pairedOrDomainRecords: ["AuditLog:eventType=prestige_change", 'battle_complete compatibility record', 'User.prestige'],
    targetTestTiers: ALL_CRITICAL_TIERS,
    notes: 'Current participant prestige fields are the source context; the stable-level amount must be aggregated before the future audit record.',
  },
  {
    id: 'prestige-source-team-leagues',
    currentSource: { file: 'app/backend/src/services/team-battle/teamBattleRewardService.ts', symbol: 'calculateTeamBattlePrestige -> executeSingleTeamBattle' },
    finalService: 'Prestige_Service',
    source: 'battle',
    identityStrategy: 'team battle id + team stable + mode + battle prestige component',
    pairedOrDomainRecords: ["AuditLog:eventType=prestige_change", 'battle_complete compatibility record', 'User.prestige'],
    targetTestTiers: ALL_CRITICAL_TIERS,
    notes: 'Covers both league_2v2 and league_3v3; team award is aggregated at stable level.',
  },
  {
    id: 'prestige-source-tag-team',
    currentSource: { file: 'app/backend/src/services/tag-team/tagTeamRewards.ts', symbol: 'calculateTagTeamPrestige -> updateTagTeamBattleResults' },
    finalService: 'Prestige_Service',
    source: 'battle',
    identityStrategy: 'tag-team battle id + team stable + tag_team prestige component',
    pairedOrDomainRecords: ["AuditLog:eventType=prestige_change", 'battle_complete compatibility record', 'User.prestige'],
    targetTestTiers: ALL_CRITICAL_TIERS,
    notes: 'Positive prestige is only for fought tag-team outcomes; a tag-team bye is zero.',
  },
  {
    id: 'prestige-source-team-tournaments',
    currentSource: { file: 'app/backend/src/services/tournament/teamTournamentBattleOrchestrator.ts', symbol: 'calculateTeamTournamentPrestige -> executeTeamTournamentRound' },
    finalService: 'Prestige_Service',
    source: 'battle',
    identityStrategy: 'tournament match id + round + winner stable + team size + battle prestige component',
    pairedOrDomainRecords: ["AuditLog:eventType=prestige_change", 'battle_complete compatibility record', 'User.prestige'],
    targetTestTiers: ALL_CRITICAL_TIERS,
    notes: 'Covers tournament_2v2 and tournament_3v3 stepped prestige, with team-size aggregation.',
  },
  {
    id: 'prestige-source-koth',
    currentSource: { file: 'app/backend/src/services/koth/kothBattleOrchestrator.ts', symbol: 'calculateKothRewards -> processKothBattle' },
    finalService: 'Prestige_Service',
    source: 'battle',
    identityStrategy: 'KotH battle id + placement participant stable + battle prestige component',
    pairedOrDomainRecords: ["AuditLog:eventType=prestige_change", 'battle_complete compatibility record', 'User.prestige'],
    targetTestTiers: ALL_CRITICAL_TIERS,
    notes: 'Placement reward object currently carries prestige beside credits and streaming.',
  },
  {
    id: 'prestige-source-grand-melee',
    currentSource: { file: 'app/backend/src/services/grand-melee/grandMeleeRewards.ts', symbol: 'calculateGrandMeleeRewards -> processGrandMeleeBattle' },
    finalService: 'Prestige_Service',
    source: 'battle',
    identityStrategy: 'Grand Melee battle id + placement participant stable + battle prestige component',
    pairedOrDomainRecords: ["AuditLog:eventType=prestige_change", 'battle_complete compatibility record', 'User.prestige'],
    targetTestTiers: ALL_CRITICAL_TIERS,
    notes: 'F1-style placement reward object currently carries prestige beside credits and streaming.',
  },
  {
    id: 'prestige-source-shared-battle-strategy',
    currentSource: { file: 'app/backend/src/services/battle/battleStrategy.ts', symbol: 'BattleStrategy.calculateRewards -> BattleProcessor.process' },
    finalService: 'Prestige_Service',
    source: 'battle',
    identityStrategy: 'processed battle id + stable recipient + battle prestige component',
    pairedOrDomainRecords: ["AuditLog:eventType=prestige_change", 'battle_complete compatibility record', 'User.prestige'],
    targetTestTiers: ALL_CRITICAL_TIERS,
    notes: 'Generic strategy reward?.prestige is a separate source boundary even when a concrete strategy supplies the formula.',
  },
  {
    id: 'prestige-source-achievements',
    currentSource: { file: 'app/backend/src/services/achievement/achievementService.ts', symbol: 'AchievementService.checkAndAward' },
    finalService: 'Prestige_Service',
    source: 'achievement',
    identityStrategy: 'achievement unlock identity + stable user + achievement prestige sourceEventId',
    pairedOrDomainRecords: ["AuditLog:eventType=prestige_change", 'achievement_unlock compatibility record', 'User.prestige'],
    targetTestTiers: ALL_CRITICAL_TIERS,
    notes: 'Achievement definitions provide rewardPrestige; it must never become a FinancialLedger row.',
  },
];

const prestigeWriters: readonly PrestigeWriterBoundary[] = [
  {
    id: 'prestige-writer-battle-award',
    currentSource: { file: 'app/backend/src/services/battle/battlePostCombat.ts', symbol: 'awardPrestigeToUser' },
    kind: 'positive-award',
    finalService: 'Prestige_Service',
    expectedOutput: 'prestige_change',
    targetTestTiers: ALL_CRITICAL_TIERS,
    notes: 'Shared post-combat helper currently increments User.prestige for positive battle rewards.',
  },
  {
    id: 'prestige-writer-koth-award',
    currentSource: { file: 'app/backend/src/services/koth/kothBattleOrchestrator.ts', symbol: 'processKothBattle' },
    kind: 'positive-award',
    finalService: 'Prestige_Service',
    expectedOutput: 'prestige_change',
    targetTestTiers: ALL_CRITICAL_TIERS,
    notes: 'KotH placement processing currently updates User.prestige alongside the combined reward write.',
  },
  {
    id: 'prestige-writer-grand-melee-award',
    currentSource: { file: 'app/backend/src/services/grand-melee/grandMeleeBattleOrchestrator.ts', symbol: 'processGrandMeleeBattle' },
    kind: 'positive-award',
    finalService: 'Prestige_Service',
    expectedOutput: 'prestige_change',
    targetTestTiers: ALL_CRITICAL_TIERS,
    notes: 'Grand Melee placement processing currently updates User.prestige alongside the combined reward write.',
  },
  {
    id: 'prestige-writer-achievement-award',
    currentSource: { file: 'app/backend/src/services/achievement/achievementService.ts', symbol: 'AchievementService.checkAndAward' },
    kind: 'positive-award',
    finalService: 'Prestige_Service',
    expectedOutput: 'prestige_change',
    targetTestTiers: ALL_CRITICAL_TIERS,
    notes: 'Achievement unlock processing currently applies rewardPrestige in the same User.update as the credit reward.',
  },
  {
    id: 'prestige-writer-account-reset',
    currentSource: { file: 'app/backend/src/services/common/resetService.ts', symbol: 'performAccountReset' },
    kind: 'lifecycle-reset',
    finalService: 'Opening_Balance_Boundary',
    expectedOutput: 'none',
    targetTestTiers: UNIT_AND_INTEGRATION,
    notes: 'Account reset clears competitive progression and restores the starting User.prestige value; it is not a reward.',
  },
  {
    id: 'prestige-writer-season-purge-reset',
    currentSource: { file: 'app/backend/src/services/season/seasonPurgeService.ts', symbol: 'resetCompetitiveAndEconomicState' },
    kind: 'lifecycle-reset',
    finalService: 'Opening_Balance_Boundary',
    expectedOutput: 'none',
    targetTestTiers: ['unit', 'integration', 'heavy'],
    notes: 'Season rollover purge restores human stables to the starting User.prestige value after archival; generated stables are deleted.',
  },
];

const lifecycleEntries: readonly CoverageManifestEntry[] = [
  {
    id: 'lifecycle-account-creation-default',
    area: 'lifecycle',
    status: 'opening-balance-boundary',
    currentSource: { file: 'app/backend/src/services/auth/userService.ts', symbol: 'createUser + Prisma User.currency default' },
    finalService: 'Opening_Balance_Boundary',
    expectedTaxonomy: [],
    identityStrategy: 'new user identity and database default; not a current-economy event',
    pairedOrDomainRecords: ['User row', 'account creation/auth domain record'],
    targetTestTiers: UNIT_AND_INTEGRATION,
    notes: 'Account creation establishes the schema default; it is not a battle or settlement income event.',
  },
  {
    id: 'lifecycle-account-reset',
    area: 'lifecycle',
    status: 'opening-balance-boundary',
    currentSource: { file: 'app/backend/src/services/common/resetService.ts', symbol: 'performAccountReset' },
    finalService: 'Opening_Balance_Boundary',
    expectedTaxonomy: [],
    identityStrategy: 'resetLog identity + user + reset request; not a financial event identity',
    pairedOrDomainRecords: ['resetLog', 'deleted season-scoped rows', 'User.currency reset', 'User.prestige reset'],
    targetTestTiers: UNIT_AND_INTEGRATION,
    directCurrencyMutation: { operation: 'set', occurrence: 1 },
    notes: 'Explicitly sets User.currency to starting credits and clears competitive state.',
  },
  {
    id: 'lifecycle-season-rollover-reset',
    area: 'lifecycle',
    status: 'opening-balance-boundary',
    currentSource: { file: 'app/backend/src/services/season/seasonPurgeService.ts', symbol: 'resetCompetitiveAndEconomicState' },
    finalService: 'Opening_Balance_Boundary',
    expectedTaxonomy: [],
    identityStrategy: 'season rollover identity + human stable set; not a current-economy event',
    pairedOrDomainRecords: ['season archives', 'purged season-scoped tables', 'User.currency reset', 'User.prestige reset'],
    targetTestTiers: ['unit', 'integration', 'heavy'],
    directCurrencyMutation: { operation: 'set', occurrence: 1 },
    notes: 'Season rollover restores human stables to starting state after archive/purge; generated stables are deleted.',
  },
];

export const COVERAGE_MANIFEST: CoverageManifest = {
  version: 1,
  currencyField: 'User.currency',
  transactionTaxonomy: TRANSACTION_TYPES,
  battleModes: BATTLE_MODES,
  entries: [...directCurrencyEntries, ...modeEntries, byeImplementationEntry, ...lifecycleEntries],
  byeCallerBoundaries,
  prestigeSources,
  prestigeWriters,
  repairSpendSource: {
    canonicalSource: {
      file: 'app/backend/src/services/common/eventLogger.ts',
      symbol: 'EventLogger.logRobotRepair',
    },
    eventType: 'robot_repair',
    chargedAmountField: 'creditsCharged',
    subtypeField: 'repairType',
    allowedSubtypes: ['manual', 'automatic'],
    forbiddenSources: [
      'battle_complete payload repairCost',
      'robots.repairQuoteCredits cached quote',
      'FinancialLedger aggregation that loses repairType',
      'financial_ledger as the dashboard Repair_Spend canonical source',
    ],
  },
  settlementEntryPoints: [
    {
      id: 'settlement-scheduled-cycle',
      currentSource: { file: 'app/backend/src/services/cycle/cycleScheduler.ts', symbol: 'executeSettlement' },
      mutatesUserCurrency: true,
      expectedTaxonomy: ['passive_income', 'operating_costs'],
      finalService: 'Settlement_Service',
      identityStrategy: 'stable user + cycle number + component',
      pairedOrDomainRecords: ['FinancialLedger', 'financial_transaction AuditLog', 'passive_income/operating_costs domain audit rows'],
      targetTestTiers: ALL_CRITICAL_TIERS,
      notes: 'Scheduled midnight settlement entry point.',
    },
    {
      id: 'settlement-admin-bulk-cycle',
      currentSource: { file: 'app/backend/src/services/admin/adminCycleService.ts', symbol: 'executeBulkCycles' },
      mutatesUserCurrency: true,
      expectedTaxonomy: ['passive_income', 'operating_costs'],
      finalService: 'Settlement_Service',
      identityStrategy: 'stable user + cycle number + component',
      pairedOrDomainRecords: ['FinancialLedger', 'financial_transaction AuditLog', 'bulk response settlement.finances'],
      targetTestTiers: ALL_CRITICAL_TIERS,
      notes: 'Admin bulk cycles currently use a net balance update under includeDailyFinances.',
    },
    {
      id: 'settlement-legacy-process-user',
      currentSource: { file: 'app/backend/src/utils/economyCalculations.ts', symbol: 'processDailyFinances' },
      mutatesUserCurrency: true,
      expectedTaxonomy: ['operating_costs'],
      finalService: 'Settlement_Service',
      identityStrategy: 'stable user + cycle number + operating_costs component',
      pairedOrDomainRecords: ['FinancialLedger', 'financial_transaction AuditLog', 'DailyFinancialSummary'],
      targetTestTiers: ALL_CRITICAL_TIERS,
      notes: 'Legacy per-user implementation used by the compatibility route.',
    },
    {
      id: 'settlement-legacy-process-all',
      currentSource: { file: 'app/backend/src/utils/economyCalculations.ts', symbol: 'processAllDailyFinances' },
      mutatesUserCurrency: false,
      expectedTaxonomy: ['operating_costs'],
      finalService: 'Settlement_Service',
      identityStrategy: 'delegates per-user stable/cycle component identity',
      pairedOrDomainRecords: ['DailyFinancialSummary[]', 'admin response summary'],
      targetTestTiers: ALL_CRITICAL_TIERS,
      notes: 'Batch orchestration boundary; the nested processDailyFinances call owns the direct mutation.',
    },
    {
      id: 'settlement-admin-daily-finance-route',
      currentSource: { file: 'app/backend/src/routes/adminMaintenance.ts', symbol: 'POST /daily-finances/process' },
      mutatesUserCurrency: false,
      expectedTaxonomy: ['operating_costs'],
      finalService: 'Settlement_Service',
      identityStrategy: 'delegates route request to the compatibility settlement identity',
      pairedOrDomainRecords: ['Admin_Compatibility response summary.totalCostsDeducted', 'usersProcessed', 'timestamp'],
      targetTestTiers: ['unit', 'integration'],
      notes: 'Route boundary must remain available while no longer owning an independent mutation.',
    },
  ],
  subscriptionBoundary: {
    currentSource: { file: 'app/backend/src/services/subscription/subscriptionService.ts', symbol: 'applySubscriptionChange / subscribeRobot / unsubscribeRobot' },
    eventTypes: BATTLE_MODES,
    finalService: 'Booking_Office',
    financialOutput: 'none',
    domainRecords: ['Subscription rows', 'subscription audit entries', 'Standing initialization where applicable'],
    targetTestTiers: ['unit', 'integration', 'heavy'],
    notes: 'All nine subscription changes are free; the schedule/obligation slot rule is not a financial event.',
  },
  lifecycleBoundaries: [
    {
      id: 'generated-stable-creation',
      currentSource: { file: 'app/backend/src/utils/userGeneration.ts', symbol: 'generateBattleReadyUsers' },
      operation: 'account_creation',
      financialOutput: 'none',
      domainRecords: ['User row with isGenerated=true', 'generated robot/team domain rows'],
      targetTestTiers: ['unit', 'integration', 'heavy'],
      notes: 'Generated stable creation uses an explicit opening balance but does not earn current-economy income.',
    },
    {
      id: 'account-creation',
      currentSource: { file: 'app/backend/src/services/auth/userService.ts', symbol: 'createUser' },
      operation: 'account_creation',
      financialOutput: 'none',
      domainRecords: ['User row', 'auth/account domain record'],
      targetTestTiers: UNIT_AND_INTEGRATION,
      notes: 'Database default establishes starting User.currency.',
    },
    {
      id: 'account-reset',
      currentSource: { file: 'app/backend/src/services/common/resetService.ts', symbol: 'performAccountReset' },
      operation: 'account_reset',
      financialOutput: 'none',
      domainRecords: ['resetLog', 'deleted live economy rows', 'User state reset'],
      targetTestTiers: ['unit', 'integration'],
      notes: 'Reset is a lifecycle boundary, never income, expense, settlement, or adjustment.',
    },
    {
      id: 'season-rollover',
      currentSource: { file: 'app/backend/src/services/season/seasonRolloverService.ts', symbol: 'executeSeasonRollover' },
      operation: 'season_rollover',
      financialOutput: 'none',
      domainRecords: ['season archives', 'purged live season rows', 'rollover audit/notification records'],
      targetTestTiers: ['unit', 'integration', 'heavy'],
      notes: 'Rollover delegates economic reset/purge and does not reconstruct historical financial records.',
    },
    {
      id: 'balance-purge',
      currentSource: { file: 'app/backend/src/services/season/seasonPurgeService.ts', symbol: 'resetCompetitiveAndEconomicState' },
      operation: 'balance_purge',
      financialOutput: 'none',
      domainRecords: ['season purge result', 'User.currency reset', 'User.prestige reset'],
      targetTestTiers: ['unit', 'integration', 'heavy'],
      notes: 'Explicit purge boundary is separately enumerated for the direct-writer guard.',
    },
  ],
  adminCompatibilitySurfaces: [
    {
      id: 'admin-repair-all',
      route: '/api/admin/repair/all',
      currentSource: { file: 'app/backend/src/routes/adminMaintenance.ts', symbol: 'POST /repair/all' },
      purpose: 'charged or free administrative repair maintenance',
      preserves: ['AdminRepairResult', 'robotsRepaired', 'totalBaseCost', 'totalFinalCost', 'costsDeducted', 'timestamp'],
      targetTestTiers: ['unit', 'integration', 'heavy'],
    },
    {
      id: 'admin-daily-finances',
      route: '/api/admin/daily-finances/process',
      currentSource: { file: 'app/backend/src/routes/adminMaintenance.ts', symbol: 'POST /daily-finances/process' },
      purpose: 'legacy daily-finance compatibility trigger',
      preserves: ['summary.totalCostsDeducted', 'usersProcessed', 'timestamp'],
      targetTestTiers: ['unit', 'integration'],
    },
    {
      id: 'admin-bulk-cycles',
      route: '/api/admin/cycles/bulk',
      currentSource: { file: 'app/backend/src/routes/adminMaintenance.ts', symbol: 'POST /cycles/bulk' },
      purpose: 'bulk cycle execution and settlement compatibility',
      preserves: ['includeDailyFinances', 'settlement.finances', 'totalPassiveIncome', 'totalOperatingCosts', 'usersProcessed', 'skipped'],
      targetTestTiers: ['unit', 'integration', 'heavy'],
    },
    {
      id: 'admin-scheduler-status',
      route: '/api/admin/scheduler/status',
      currentSource: { file: 'app/backend/src/routes/adminMaintenance.ts', symbol: 'GET /scheduler/status' },
      purpose: 'scheduler state inspection',
      preserves: ['scheduler state response'],
      targetTestTiers: ['unit', 'integration'],
    },
    {
      id: 'admin-scheduler-trigger',
      route: '/api/admin/scheduler/trigger/:jobName',
      currentSource: { file: 'app/backend/src/routes/adminMaintenance.ts', symbol: 'POST /scheduler/trigger/:jobName' },
      purpose: 'manual execution of the same repair/execute/settlement job paths as cron',
      preserves: ['jobName', 'success', 'timestamp', 'admin audit action'],
      targetTestTiers: ['unit', 'integration', 'heavy'],
    },
    {
      id: 'admin-audit-log',
      route: '/api/admin/audit-log',
      currentSource: { file: 'app/backend/src/routes/adminUsers.ts', symbol: 'GET/POST /audit-log' },
      purpose: 'general audit and future financial_transaction investigation',
      preserves: ['pagination', 'filters', 'existing audit response fields'],
      targetTestTiers: ['unit', 'integration'],
    },
    {
      id: 'admin-repair-audit-log',
      route: '/api/admin/audit-log/repairs',
      currentSource: { file: 'app/backend/src/routes/adminUsers.ts', symbol: 'GET /audit-log/repairs' },
      purpose: 'subtype-bearing repair audit view',
      preserves: ['repairType filter', 'creditsCharged source', 'summary stats', 'pagination'],
      targetTestTiers: ['unit', 'integration', 'heavy'],
    },
    {
      id: 'admin-economy-overview',
      route: '/api/admin/economy/overview',
      currentSource: { file: 'app/backend/src/routes/adminAnalytics.ts', symbol: 'GET /economy/overview' },
      purpose: 'economy KPI and financial compatibility reporting',
      preserves: ['filter query', 'existing KPI response fields'],
      targetTestTiers: ['unit', 'integration'],
    },
    {
      id: 'admin-season-rollover-preview',
      route: '/api/admin/seasons/rollover-preview',
      currentSource: { file: 'app/backend/src/routes/adminSeasons.ts', symbol: 'GET /rollover-preview' },
      purpose: 'read-only lifecycle preview',
      preserves: ['archive/delete/purge preview response'],
      targetTestTiers: ['unit', 'integration', 'heavy'],
    },
    {
      id: 'admin-season-rollover-execute',
      route: '/api/admin/seasons/rollover',
      currentSource: { file: 'app/backend/src/routes/adminSeasons.ts', symbol: 'POST /rollover' },
      purpose: 'manual lifecycle rollover trigger',
      preserves: ['confirmation and season validation', 'rollover result', 'admin action audit'],
      targetTestTiers: ['unit', 'integration', 'heavy'],
    },
  ],
  testTiers: [
    {
      tier: 'unit',
      command: 'pnpm run test:unit',
      surfaces: ['tests/coverageManifest.test.ts', 'typed taxonomy and breakdown tests', 'formula/property tests', 'direct-writer guard'],
      assertions: ['manifest is complete and uniquely identified', 'all nine modes and five bye callers are represented', 'no unmanifested direct User.currency mutation exists'],
    },
    {
      tier: 'integration',
      command: 'pnpm run test:integration',
      surfaces: ['PostgreSQL financial pairing', 'admin contracts', 'repair audit source', 'all mode/bye workflows'],
      assertions: ['atomic pair rollback and idempotency', 'prestige sourceEventId behavior', 'admin compatibility and canonical repair reads'],
    },
    {
      tier: 'heavy',
      command: 'pnpm run test:heavy',
      surfaces: ['complete scheduler cycles', 'bulk admin cycles', 'team/tag/tournament/placement modes'],
      assertions: ['bye automatic repair stays separate', 'settlement components and retries remain stable'],
    },
    {
      tier: 'frontend',
      command: 'pnpm run test:ci',
      surfaces: ['existing admin page contract tests', 'FinancialReportPage and CycleSummaryPage regression tests'],
      assertions: ['no financial-page layout/API contract regression is introduced by capture work'],
    },
    {
      tier: 'e2e',
      command: 'pnpm exec playwright test',
      surfaces: ['tests/e2e/financial-flow.spec.ts', 'authenticated admin and battle/result flows'],
      assertions: ['existing player/admin flows remain usable; no new financial UI is required'],
    },
  ],
  noUiBoundary: {
    unchangedFiles: [
      'app/frontend/src/pages/FinancialReportPage.tsx',
      'app/frontend/src/pages/CycleSummaryPage.tsx',
      'app/frontend/src/pages/admin/CycleControlsPage.tsx',
      'app/frontend/src/pages/admin/RepairLogPage.tsx',
      'app/frontend/src/pages/admin/EconomyOverviewPage.tsx',
      'app/frontend/src/pages/admin/AuditLogPage.tsx',
      'app/frontend/src/utils/financialApi.ts',
    ],
    playerGuideValidation: 'app/backend/tests/guide/content-validation.test.ts',
    deferredConcepts: ['Income_Dashboard', 'Cycle_Summary', 'Financial_Page_Follow_On'],
    notes: 'Task Group 1 changes capture inventory and documentation only. It does not add or redesign financial UI, layouts, charts, or player-guide articles.',
  },
  directWriterPolicy: {
    productionRoot: 'app/backend/src',
    excludedPaths: ['app/backend/src/shared', 'app/backend/generated', 'app/backend/dist'],
    sharedServicePath: 'app/backend/src/services/financial/creditMutationService.ts',
    lifecycleBoundaryIds: ['currency-generated-stable-opening-balance', 'lifecycle-account-reset', 'lifecycle-season-rollover-reset'],
    baselineRule: 'The Unit-tier guard compares every discovered direct User.currency mutation with this frozen baseline. An unlisted current-economy writer fails immediately; lifecycle sets are explicit entries.',
    postMigrationRule: 'After Credit_Mutation_Service exists, current-economy direct mutations must disappear from this baseline set; only the shared service and the enumerated Opening_Balance_Boundary operations may remain.',
  },
};

export type { DiscoveredDirectCurrencyMutation } from '../../src/services/migration/directWriterCoverage';

export interface DirectWriterCheckResult {
  discovered: readonly DiscoveredDirectCurrencyMutation[];
  expected: readonly DiscoveredDirectCurrencyMutation[];
  unmanifested: readonly DiscoveredDirectCurrencyMutation[];
  missingFromSource: readonly DiscoveredDirectCurrencyMutation[];
}

export function checkDirectWriterCoverage(
  manifest: CoverageManifest = COVERAGE_MANIFEST,
  workspaceRoot: string = findWorkspaceRoot(),
): DirectWriterCheckResult {
  const discovered = discoverDirectCurrencyMutations(workspaceRoot);
  const expected = manifest.entries
    .filter((entry): entry is CoverageManifestEntry & { directCurrencyMutation: DirectCurrencyMutation } => entry.directCurrencyMutation !== undefined)
    .map((entry) => ({
      file: entry.currentSource.file,
      operation: entry.directCurrencyMutation.operation,
      occurrence: entry.directCurrencyMutation.occurrence,
    }))
    .sort((left, right) => mutationKey(left).localeCompare(mutationKey(right)));

  const expectedKeys = new Set(expected.map(mutationKey));
  const discoveredKeys = new Set(discovered.map(mutationKey));
  const sharedServicePath = manifest.directWriterPolicy.sharedServicePath;

  return {
    discovered,
    expected,
    unmanifested: discovered.filter(
      (mutation) => mutation.file !== sharedServicePath && !expectedKeys.has(mutationKey(mutation)),
    ),
    missingFromSource: expected.filter((mutation) => !discoveredKeys.has(mutationKey(mutation))),
  };
}

export function validateCoverageManifest(manifest: CoverageManifest = COVERAGE_MANIFEST): readonly string[] {
  const errors: string[] = [];
  const ids = manifest.entries.map((entry) => entry.id);
  const uniqueIds = new Set(ids);

  if (uniqueIds.size !== ids.length) errors.push('manifest entry ids must be unique');
  if (manifest.currencyField !== 'User.currency') errors.push('manifest must use User.currency');
  if (manifest.transactionTaxonomy.length !== 12) errors.push('transaction taxonomy must contain exactly 12 values');
  if (new Set(manifest.transactionTaxonomy).size !== manifest.transactionTaxonomy.length) errors.push('transaction taxonomy values must be unique');
  if (manifest.battleModes.length !== 9) errors.push('battle mode inventory must contain exactly nine modes');
  if (new Set(manifest.battleModes).size !== manifest.battleModes.length) errors.push('battle mode values must be unique');
  if (manifest.byeCallerBoundaries.length !== 5) errors.push('bye caller inventory must contain the five actual resolveByeEvent callers');

  const byeModes = new Set(manifest.byeCallerBoundaries.flatMap((caller) => caller.modes));
  for (const mode of manifest.battleModes) {
    if (!byeModes.has(mode)) errors.push(`missing bye caller coverage for ${mode}`);
  }

  for (const entry of manifest.entries) {
    if (entry.currentSource.file.length === 0 || entry.currentSource.symbol.length === 0) errors.push(`${entry.id} is missing its current source`);
    if (entry.finalService.length === 0) errors.push(`${entry.id} is missing its final service`);
    if (entry.identityStrategy.length === 0) errors.push(`${entry.id} is missing an identity strategy`);
    if (entry.pairedOrDomainRecords.length === 0) errors.push(`${entry.id} is missing paired/domain records`);
    if (entry.targetTestTiers.length === 0) errors.push(`${entry.id} is missing a target test tier`);
  }

  const directEntryIds = new Set(
    manifest.entries
      .filter((entry) => entry.directCurrencyMutation !== undefined)
      .map((entry) => entry.id),
  );
  for (const boundaryId of manifest.directWriterPolicy.lifecycleBoundaryIds) {
    if (!manifest.entries.some((entry) => entry.id === boundaryId || entry.id === `lifecycle-${boundaryId}`)) {
      errors.push(`direct-writer policy references missing lifecycle entry ${boundaryId}`);
    }
  }
  if (directEntryIds.size === 0) errors.push('manifest must enumerate current direct currency writers and lifecycle sets');

  if (manifest.repairSpendSource.eventType !== 'robot_repair') errors.push('repair source must be robot_repair');
  if (manifest.repairSpendSource.chargedAmountField !== 'creditsCharged') errors.push('repair source must use creditsCharged');
  if (manifest.repairSpendSource.subtypeField !== 'repairType') errors.push('repair source must use repairType');
  if (manifest.repairSpendSource.allowedSubtypes.join(',') !== 'manual,automatic') errors.push('repair subtypes must be manual and automatic');

  return errors;
}

export { findWorkspaceRoot };
