import { performance } from 'node:perf_hooks';
import { Prisma } from '../generated/prisma';
import prisma, { observePrismaStatements } from '../src/lib/prisma';
import { withAuditSequence } from '../src/services/common/auditSequence';
import { getFinanceOverview } from '../src/services/financial/financeReportQueryService';
import {
  getRobotFinancialEvents,
  getRobotFinancialSummaries,
} from '../src/services/financial/robotDeploymentQueryService';
import type {
  BattleIncomeBreakdown,
  FinanceOverviewResponse,
  RepairBreakdown,
  ReportPeriodSelection,
  RobotDetailResponse,
  RobotSummaryResponse,
  StableMetric,
  StreamingRevenueBreakdown,
} from '../src/types';

const CYCLE_COUNT = 100;
const RECORDS_PER_STABLE = 300;
const SAMPLE_COUNT = 20;
const DETAIL_PAGE_SIZE = 100;
const OPENING_BALANCE = 10_000;
const BATTLE_AMOUNT = 100;
const STREAMING_AMOUNT = 20;
const REPAIR_AMOUNT = 5;
const CYCLE_MOVEMENT = BATTLE_AMOUNT + STREAMING_AMOUNT - REPAIR_AMOUNT;
const FULL_PERIOD_TOTAL = CYCLE_COUNT * CYCLE_MOVEMENT;
const CACHE_MODE = 'bypassed_direct_service_calls';

const RESOURCE_LIMITS = {
  overview: {
    milliseconds: 700,
    bytes: 512 * 1024,
    statements: { total: 32, financeAudit: 15, battleParticipant: 0 },
  },
  summary: {
    milliseconds: 1_000,
    bytes: 64 * 1024,
    statements: { total: 20, financeAudit: 8, battleParticipant: 2 },
  },
  detail: {
    milliseconds: 300,
    bytes: 128 * 1024,
    statements: { total: 18, financeAudit: 6, battleParticipant: 4 },
  },
} as const;

type ResourceName = keyof typeof RESOURCE_LIMITS;

interface StableFixture {
  label: 'one_robot' | 'eleven_robot';
  userId: number;
  targetRobotId: number;
  robotCount: number;
}

interface MetadataSnapshot {
  id: number;
  totalCycles: number;
  lastCycleAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  featureFlags: Prisma.JsonValue;
}

interface FixtureState {
  marker: string;
  fromCycle: number;
  toCycle: number;
  metadata: MetadataSnapshot | null;
  metadataCreated: boolean;
  seasonId: number | null;
  userIds: number[];
  battleIds: number[];
  snapshotIds: number[];
  stables: StableFixture[];
}

interface StatementProfile {
  total: number;
  financeAudit: number;
  battleParticipant: number;
}

interface Measurement<T> {
  response: T;
  milliseconds: number;
  bytes: number;
  statements: StatementProfile;
}

interface ResourceSampleResult {
  statementProfile: StatementProfile;
  bytes: number;
  p95Milliseconds: number;
  maxMilliseconds: number;
}

interface BenchmarkResult {
  fixture: {
    cycles: number;
    recordsPerStable: number;
    oneRobotRoster: number;
    maximumRoster: number;
    detailPageSize: number;
    samplesPerResource: number;
  };
  cache: string;
  nodeVersion: string;
  postgresVersion: string;
  resources: Record<ResourceName, ResourceSampleResult>;
}

type ResourceResponse = FinanceOverviewResponse | RobotSummaryResponse | RobotDetailResponse;
type ResourceOperation = () => Promise<ResourceResponse>;

const state: FixtureState = {
  marker: `fcperf_${Date.now().toString(36)}_${process.pid}`,
  fromCycle: 0,
  toCycle: 0,
  metadata: null,
  metadataCreated: false,
  seasonId: null,
  userIds: [],
  battleIds: [],
  snapshotIds: [],
  stables: [],
};

function json(value: object): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

function stableMetric(userId: number, balance: number): StableMetric {
  return {
    userId,
    battlesParticipated: 1,
    totalCreditsEarned: BATTLE_AMOUNT + STREAMING_AMOUNT,
    totalPrestigeEarned: 0,
    cycleRepairCreditsPaid: REPAIR_AMOUNT,
    merchandisingIncome: 0,
    streamingIncome: STREAMING_AMOUNT,
    operatingCosts: 0,
    weaponPurchases: 0,
    facilityPurchases: 0,
    robotPurchases: 0,
    attributeUpgrades: 0,
    totalPurchases: 0,
    achievementRewards: 0,
    netProfit: CYCLE_MOVEMENT,
    balance,
  };
}

function commonBreakdown(financialEventId: string, finalAmount: number): Pick<
  BattleIncomeBreakdown,
  'schemaVersion' | 'formulaVersion' | 'inputs' | 'modifiers' | 'rounding' | 'finalAmount' | 'sourceEventId'
> {
  return {
    schemaVersion: 1,
    formulaVersion: '1',
    inputs: [{ name: 'fixtureAmount', value: Math.abs(finalAmount), unit: 'credits', source: 'performance_fixture' }],
    modifiers: [],
    rounding: { precision: 0, mode: 'round', operationOrder: ['fixtureAmount'], scope: 'aggregate' },
    finalAmount,
    sourceEventId: financialEventId,
  };
}

function battleBreakdown(financialEventId: string): BattleIncomeBreakdown {
  return {
    ...commonBreakdown(financialEventId, BATTLE_AMOUNT),
    formula: 'battle.reward',
    transactionType: 'battle_income',
    mode: 'league_1v1',
    tier: 1,
    outcome: 'win',
    placement: null,
    participationFloor: BATTLE_AMOUNT,
    winComponent: 0,
    teamSize: 1,
    stableAggregation: 'stable',
    isBye: false,
  };
}

function streamingBreakdown(
  financialEventId: string,
  battleId: number,
  robotId: number,
): StreamingRevenueBreakdown {
  return {
    ...commonBreakdown(financialEventId, STREAMING_AMOUNT),
    formula: 'streaming.revenue',
    rounding: {
      precision: 0,
      mode: 'floor',
      operationOrder: ['baseAmount', 'battleMultiplier', 'fameMultiplier', 'studioMultiplier'],
      scope: 'per_item',
    },
    transactionType: 'streaming_revenue',
    battleId,
    robotId,
    mode: 'league_1v1',
    eligible: true,
    baseAmount: STREAMING_AMOUNT,
    battleMultiplier: 1,
    fameMultiplier: 1,
    studioMultiplier: 1,
    totalRevenue: STREAMING_AMOUNT,
  };
}

function repairBreakdown(
  financialEventId: string,
  robotId: number,
  activeRobotCount: number,
): RepairBreakdown {
  return {
    ...commonBreakdown(financialEventId, -REPAIR_AMOUNT),
    formula: 'repair.quote',
    rounding: {
      precision: 0,
      mode: 'round',
      operationOrder: ['baseQuote', 'perRobotCharge'],
      scope: 'per_item',
    },
    transactionType: 'repair_cost',
    repairType: 'automatic',
    robotId,
    baseQuote: REPAIR_AMOUNT,
    damageRepaired: 1,
    repairBayLevel: 0,
    activeRobotCount,
    repairBayDiscountPercent: 0,
    manualRepairDiscountPercent: 0,
    quoteBeforeManualDiscount: REPAIR_AMOUNT,
    perRobotCharge: REPAIR_AMOUNT,
  };
}

function financialAuditPayload(
  financialEventId: string,
  transactionType: 'battle_income' | 'streaming_revenue' | 'repair_cost',
  amount: number,
  balanceAfter: number,
  breakdown: BattleIncomeBreakdown | StreamingRevenueBreakdown | RepairBreakdown,
): Prisma.InputJsonValue {
  return json({
    financialEventId,
    transactionType,
    amount,
    balanceAfter,
    description: 'Finance Center performance fixture',
    breakdown,
  });
}

function cycleTimestamp(cycleIndex: number, offsetSeconds = 0): Date {
  const base = Date.UTC(2099, 0, 1, 0, 0, 0);
  return new Date(base + cycleIndex * 86_400_000 + offsetSeconds * 1_000);
}

async function captureMetadataAndRange(): Promise<void> {
  const [metadata, auditMax, snapshotMax] = await Promise.all([
    prisma.cycleMetadata.findUnique({ where: { id: 1 } }),
    prisma.auditLog.aggregate({ _max: { cycleNumber: true } }),
    prisma.cycleSnapshot.aggregate({ _max: { cycleNumber: true } }),
  ]);
  state.metadata = metadata;
  const greatestCycle = Math.max(
    metadata?.totalCycles ?? 0,
    auditMax._max.cycleNumber ?? 0,
    snapshotMax._max.cycleNumber ?? 0,
  );
  state.fromCycle = greatestCycle + 1;
  state.toCycle = state.fromCycle + CYCLE_COUNT - 1;

  if (metadata) {
    await prisma.cycleMetadata.update({
      where: { id: 1 },
      data: { totalCycles: state.toCycle },
    });
  } else {
    await prisma.cycleMetadata.create({
      data: { id: 1, totalCycles: state.toCycle },
    });
    state.metadataCreated = true;
  }
}

async function createTemporarySeason(): Promise<void> {
  const seasonMax = await prisma.season.aggregate({ _max: { seasonNumber: true } });
  const season = await prisma.season.create({
    data: {
      seasonNumber: (seasonMax._max.seasonNumber ?? 0) + 1,
      phase: 'competitive',
      competitiveCyclesCompleted: state.toCycle,
      preparationCyclesCompleted: 0,
      startedAt: cycleTimestamp(0),
    },
    select: { id: true },
  });
  state.seasonId = season.id;
}

async function createStables(): Promise<void> {
  for (const specification of [
    { label: 'one_robot' as const, robotCount: 1 },
    { label: 'eleven_robot' as const, robotCount: 11 },
  ]) {
    const user = await prisma.user.create({
      data: {
        username: `${state.marker}_${specification.label}`,
        passwordHash: 'performance-fixture-hash',
        currency: OPENING_BALANCE + CYCLE_COUNT * CYCLE_MOVEMENT,
      },
      select: { id: true },
    });
    state.userIds.push(user.id);
    const robots = await prisma.robot.createManyAndReturn({
      data: Array.from({ length: specification.robotCount }, (_, index) => ({
        userId: user.id,
        name: `${state.marker}_${specification.label}_${index.toString().padStart(2, '0')}`,
        currentHP: 100,
        maxHP: 100,
        currentShield: 10,
        maxShield: 10,
      })),
      select: { id: true, name: true },
    });
    robots.sort((left, right) => left.name.localeCompare(right.name));
    state.stables.push({
      label: specification.label,
      userId: user.id,
      targetRobotId: robots[0].id,
      robotCount: specification.robotCount,
    });
  }
}

async function createBattles(): Promise<number[]> {
  const battles = await prisma.battle.createManyAndReturn({
    data: Array.from({ length: CYCLE_COUNT }, (_, index) => ({
      battleType: 'league',
      leagueType: 'bronze',
      durationSeconds: 60,
      createdAt: cycleTimestamp(index, 1),
    })),
    select: { id: true, createdAt: true },
  });
  battles.sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  state.battleIds = battles.map((battle) => battle.id);
  const [oneRobot, elevenRobot] = state.stables;
  await prisma.battleParticipant.createMany({
    data: battles.flatMap((battle) => [
      {
        battleId: battle.id,
        robotId: oneRobot.targetRobotId,
        team: 1,
        credits: BATTLE_AMOUNT,
        eloBefore: 1_200,
        eloAfter: 1_200,
        finalHP: 100,
      },
      {
        battleId: battle.id,
        robotId: elevenRobot.targetRobotId,
        team: 2,
        credits: BATTLE_AMOUNT,
        eloBefore: 1_200,
        eloAfter: 1_200,
        finalHP: 100,
      },
    ]),
  });
  return state.battleIds;
}

interface StableCycleEvidence {
  ledgerRows: Prisma.FinancialLedgerCreateManyInput[];
  auditRows: Prisma.AuditLogCreateManyInput[];
  closingBalance: number;
}

function buildStableCycleEvidence(
  stable: StableFixture,
  cycleNumber: number,
  cycleIndex: number,
  battleId: number,
): StableCycleEvidence {
  const balanceBefore = OPENING_BALANCE + cycleIndex * CYCLE_MOVEMENT;
  const battleBalance = balanceBefore + BATTLE_AMOUNT;
  const streamingBalance = battleBalance + STREAMING_AMOUNT;
  const closingBalance = streamingBalance - REPAIR_AMOUNT;
  const battleIdentity = `battle:${battleId}:${state.marker}:${stable.label}`;
  const streamingIdentity = `${state.marker}:stream:${stable.label}:${cycleNumber}`;
  const repairIdentity = `${state.marker}:repair:${stable.label}:${cycleNumber}`;
  const battle = battleBreakdown(battleIdentity);
  const streaming = streamingBreakdown(streamingIdentity, battleId, stable.targetRobotId);
  const repair = repairBreakdown(repairIdentity, stable.targetRobotId, stable.robotCount);
  const timestamp = cycleTimestamp(cycleIndex);

  const ledgerRows: Prisma.FinancialLedgerCreateManyInput[] = [
    {
      cycleNumber,
      userId: stable.userId,
      robotId: null,
      transactionType: 'battle_income',
      amount: BATTLE_AMOUNT,
      balanceAfter: battleBalance,
      description: 'Performance fixture battle income',
      metadata: json(battle),
      financialEventId: battleIdentity,
      createdAt: timestamp,
    },
    {
      cycleNumber,
      userId: stable.userId,
      robotId: stable.targetRobotId,
      transactionType: 'streaming_revenue',
      amount: STREAMING_AMOUNT,
      balanceAfter: streamingBalance,
      description: 'Performance fixture streaming revenue',
      metadata: json(streaming),
      financialEventId: streamingIdentity,
      createdAt: new Date(timestamp.getTime() + 1_000),
    },
    {
      cycleNumber,
      userId: stable.userId,
      robotId: stable.targetRobotId,
      transactionType: 'repair_cost',
      amount: -REPAIR_AMOUNT,
      balanceAfter: closingBalance,
      description: 'Performance fixture automatic repair',
      metadata: json(repair),
      financialEventId: repairIdentity,
      createdAt: new Date(timestamp.getTime() + 2_000),
    },
  ];

  const auditRows: Prisma.AuditLogCreateManyInput[] = [
    {
      cycleNumber,
      eventType: 'financial_transaction',
      eventTimestamp: timestamp,
      sequenceNumber: 0,
      userId: stable.userId,
      financialEventId: battleIdentity,
      payload: financialAuditPayload(battleIdentity, 'battle_income', BATTLE_AMOUNT, battleBalance, battle),
    },
    {
      cycleNumber,
      eventType: 'financial_transaction',
      eventTimestamp: new Date(timestamp.getTime() + 1_000),
      sequenceNumber: 0,
      userId: stable.userId,
      robotId: stable.targetRobotId,
      financialEventId: streamingIdentity,
      payload: financialAuditPayload(streamingIdentity, 'streaming_revenue', STREAMING_AMOUNT, streamingBalance, streaming),
    },
    {
      cycleNumber,
      eventType: 'financial_transaction',
      eventTimestamp: new Date(timestamp.getTime() + 2_000),
      sequenceNumber: 0,
      userId: stable.userId,
      robotId: stable.targetRobotId,
      financialEventId: repairIdentity,
      payload: financialAuditPayload(repairIdentity, 'repair_cost', -REPAIR_AMOUNT, closingBalance, repair),
    },
    {
      cycleNumber,
      eventType: 'robot_repair',
      eventTimestamp: new Date(timestamp.getTime() + 3_000),
      sequenceNumber: 0,
      userId: stable.userId,
      robotId: stable.targetRobotId,
      sourceEventId: repairIdentity,
      payload: json({
        creditsCharged: REPAIR_AMOUNT,
        damageRepaired: 1,
        discountPercent: 0,
        repairType: 'automatic',
        sourceEventId: repairIdentity,
      }),
    },
    {
      cycleNumber,
      eventType: 'cycle_end_balance',
      eventTimestamp: new Date(timestamp.getTime() + 4_000),
      sequenceNumber: 0,
      userId: stable.userId,
      sourceEventId: `${state.marker}:boundary:${stable.label}:${cycleNumber}`,
      payload: json({ balance: closingBalance }),
    },
  ];
  return { ledgerRows, auditRows, closingBalance };
}

async function createFinancialEvidence(battleIds: readonly number[]): Promise<void> {
  const ledgerRows: Prisma.FinancialLedgerCreateManyInput[] = [];
  const auditRowsByCycle = new Map<number, Prisma.AuditLogCreateManyInput[]>();
  const snapshotRows: Prisma.CycleSnapshotCreateManyInput[] = [];

  for (let index = 0; index < CYCLE_COUNT; index += 1) {
    const cycleNumber = state.fromCycle + index;
    const perStable = state.stables.map((stable) =>
      buildStableCycleEvidence(stable, cycleNumber, index, battleIds[index]),
    );
    const cycleAudits = perStable.flatMap((evidence) => evidence.auditRows);
    cycleAudits.push({
      cycleNumber,
      eventType: 'cycle_complete',
      eventTimestamp: cycleTimestamp(index, 10),
      sequenceNumber: 0,
      sourceEventId: `${state.marker}:cycle-complete:${cycleNumber}`,
      payload: json({ cycleNumber }),
    });
    ledgerRows.push(...perStable.flatMap((evidence) => evidence.ledgerRows));
    auditRowsByCycle.set(cycleNumber, cycleAudits);
    snapshotRows.push({
      cycleNumber,
      triggerType: 'manual',
      startTime: cycleTimestamp(index),
      endTime: cycleTimestamp(index, 10),
      durationMs: 10_000,
      stableMetrics: json(perStable.map((evidence, stableIndex) =>
        stableMetric(state.stables[stableIndex].userId, evidence.closingBalance))),
      robotMetrics: json([]),
      stepDurations: json([]),
      totalBattles: 1,
      totalCreditsTransacted: BigInt(2 * (BATTLE_AMOUNT + STREAMING_AMOUNT + REPAIR_AMOUNT)),
      totalPrestigeAwarded: 0,
    });
  }

  await prisma.financialLedger.createMany({ data: ledgerRows });
  for (const [cycleNumber, cycleAudits] of auditRowsByCycle) {
    await withAuditSequence(cycleNumber, cycleAudits.length, async (startSequence, tx) => {
      await tx.auditLog.createMany({
        data: cycleAudits.map((row, index) => ({ ...row, sequenceNumber: startSequence + index })),
      });
    });
  }
  const snapshots = await prisma.cycleSnapshot.createManyAndReturn({
    data: snapshotRows,
    select: { id: true },
  });
  state.snapshotIds = snapshots.map((snapshot) => snapshot.id);
}

function statementProfile(statements: readonly string[]): StatementProfile {
  return {
    total: statements.length,
    financeAudit: statements.filter((sql) =>
      sql.includes('financial_ledger') || sql.includes('audit_logs')).length,
    battleParticipant: statements.filter((sql) =>
      sql.includes('battle_participants') || sql.includes('"battles"')).length,
  };
}

async function measure<T>(operation: () => Promise<T>): Promise<Measurement<T>> {
  const statements: string[] = [];
  const stopObserving = observePrismaStatements((sql) => statements.push(sql));
  const startedAt = performance.now();
  try {
    const response = await operation();
    const serialized = JSON.stringify(response);
    const bytes = Buffer.byteLength(serialized, 'utf8');
    const milliseconds = performance.now() - startedAt;
    return { response, milliseconds, bytes, statements: statementProfile(statements) };
  } finally {
    stopObserving();
  }
}

function operations(stable: StableFixture): Record<ResourceName, ResourceOperation> {
  const selection: ReportPeriodSelection = { fromCycle: state.fromCycle, toCycle: state.toCycle };
  return {
    overview: () => getFinanceOverview(stable.userId, selection),
    summary: () => getRobotFinancialSummaries(stable.userId, selection),
    detail: () => getRobotFinancialEvents(
      stable.userId,
      stable.targetRobotId,
      selection,
      1,
      DETAIL_PAGE_SIZE,
    ),
  };
}

function nearestRankP95(samples: readonly number[]): number {
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[Math.ceil(0.95 * sorted.length) - 1];
}

function fail(message: string, diagnostics: object): never {
  throw new Error(`${message}: ${JSON.stringify(diagnostics)}`);
}

function assertCondition(condition: boolean, message: string, diagnostics: object): void {
  if (!condition) fail(message, diagnostics);
}

function assertDetailShape(response: RobotDetailResponse, postgresVersion: string): void {
  const diagnostics = {
    fixtureCycles: CYCLE_COUNT,
    recordsPerStable: RECORDS_PER_STABLE,
    pageSize: response.data.page.pageSize,
    totalItems: response.data.page.totalItems,
    itemCount: response.data.items.length,
    fullPeriodTotal: response.data.fullPeriodTotal,
    headlineTotal: response.data.robot.fullPeriodTotal,
    cache: CACHE_MODE,
    nodeVersion: process.version,
    postgresVersion,
  };
  assertCondition(response.data.items.length === DETAIL_PAGE_SIZE, 'Detail item count changed', diagnostics);
  assertCondition(response.data.page.pageSize === DETAIL_PAGE_SIZE, 'Detail page size changed', diagnostics);
  assertCondition(response.data.page.totalItems === RECORDS_PER_STABLE, 'Detail total item count changed', diagnostics);
  assertCondition(response.data.fullPeriodTotal === FULL_PERIOD_TOTAL, 'Detail full-period total changed', diagnostics);
  assertCondition(response.data.robot.fullPeriodTotal === FULL_PERIOD_TOTAL, 'Detail headline total changed', diagnostics);
  assertCondition(response.data.robot.directNet === FULL_PERIOD_TOTAL, 'Detail direct net changed', diagnostics);
}

async function restoreGlobalState(): Promise<void> {
  if (state.seasonId !== null) {
    await prisma.season.deleteMany({ where: { id: state.seasonId } });
  }
  if (state.metadataCreated) {
    await prisma.cycleMetadata.deleteMany({ where: { id: 1 } });
  } else if (state.metadata) {
    await prisma.cycleMetadata.update({
      where: { id: state.metadata.id },
      data: {
        totalCycles: state.metadata.totalCycles,
        lastCycleAt: state.metadata.lastCycleAt,
        featureFlags: state.metadata.featureFlags as Prisma.InputJsonValue,
        createdAt: state.metadata.createdAt,
        updatedAt: state.metadata.updatedAt,
      },
    });
  }
}

async function cleanupFixture(): Promise<void> {
  if (state.userIds.length > 0) {
    await prisma.auditLog.deleteMany({ where: { userId: { in: state.userIds } } });
    await prisma.financialLedger.deleteMany({ where: { userId: { in: state.userIds } } });
  }
  await prisma.auditLog.deleteMany({
    where: { sourceEventId: { startsWith: `${state.marker}:cycle-complete:` } },
  });
  if (state.snapshotIds.length > 0) {
    await prisma.cycleSnapshot.deleteMany({ where: { id: { in: state.snapshotIds } } });
  }
  if (state.battleIds.length > 0) {
    await prisma.battleParticipant.deleteMany({ where: { battleId: { in: state.battleIds } } });
    await prisma.battle.deleteMany({ where: { id: { in: state.battleIds } } });
  }
  if (state.userIds.length > 0) {
    await prisma.robot.deleteMany({ where: { userId: { in: state.userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: state.userIds } } });
  }
  await restoreGlobalState();
}

jest.setTimeout(300_000);

describe('Finance Center maximum-shape performance and query growth', () => {
  beforeAll(async () => {
    await prisma.$connect();
    await captureMetadataAndRange();
    await createTemporarySeason();
    await createStables();
    const battleIds = await createBattles();
    await createFinancialEvidence(battleIds);
  });

  afterAll(async () => {
    await cleanupFixture();
    await prisma.$disconnect();
  });

  it('should keep set-based query shape and p95 response budgets at maximum history and roster size', async () => {
    const [oneRobot, elevenRobot] = state.stables;
    const oneRobotOperations = operations(oneRobot);
    const maximumOperations = operations(elevenRobot);
    const [database] = await prisma.$queryRaw<Array<{ postgresVersion: string }>>`
      SELECT current_setting('server_version') AS "postgresVersion"
    `;
    const postgresVersion = database.postgresVersion;

    for (const resource of ['overview', 'summary', 'detail'] as const) {
      await oneRobotOperations[resource]();
      await maximumOperations[resource]();
    }

    const oneRobotProfiles = {} as Record<ResourceName, StatementProfile>;
    const maximumProfiles = {} as Record<ResourceName, StatementProfile>;
    for (const resource of ['overview', 'summary', 'detail'] as const) {
      oneRobotProfiles[resource] = (await measure(oneRobotOperations[resource])).statements;
      maximumProfiles[resource] = (await measure(maximumOperations[resource])).statements;
      const diagnostics = {
        resource,
        oneRobotRoster: 1,
        maximumRoster: 11,
        oneRobot: oneRobotProfiles[resource],
        maximum: maximumProfiles[resource],
        cache: CACHE_MODE,
        nodeVersion: process.version,
        postgresVersion,
      };
      assertCondition(
        JSON.stringify(oneRobotProfiles[resource]) === JSON.stringify(maximumProfiles[resource]),
        'Statement count grew with roster size',
        diagnostics,
      );
      const statementCeiling = RESOURCE_LIMITS[resource].statements;
      assertCondition(
        maximumProfiles[resource].total <= statementCeiling.total
          && maximumProfiles[resource].financeAudit <= statementCeiling.financeAudit
          && maximumProfiles[resource].battleParticipant <= statementCeiling.battleParticipant,
        'Statement ceiling exceeded',
        { ...diagnostics, statementCeiling },
      );
    }

    const resources = {} as Record<ResourceName, ResourceSampleResult>;
    for (const resource of ['overview', 'summary', 'detail'] as const) {
      const measurements: Array<Measurement<ResourceResponse>> = [];
      for (let sample = 0; sample < SAMPLE_COUNT; sample += 1) {
        measurements.push(await measure(maximumOperations[resource]));
      }
      if (resource === 'detail') {
        for (const measurement of measurements) {
          assertDetailShape(measurement.response as RobotDetailResponse, postgresVersion);
        }
      }
      if (resource === 'summary') {
        const summary = measurements[0].response as RobotSummaryResponse;
        const target = summary.data.find((robot) => robot.robotId === elevenRobot.targetRobotId);
        assertCondition(
          target?.fullPeriodTotal === FULL_PERIOD_TOTAL && target.directNet === FULL_PERIOD_TOTAL,
          'Summary headline changed from detail full-period total',
          {
            resource,
            cycles: CYCLE_COUNT,
            recordsPerStable: RECORDS_PER_STABLE,
            expectedFullPeriodTotal: FULL_PERIOD_TOTAL,
            observedFullPeriodTotal: target?.fullPeriodTotal ?? null,
            cache: CACHE_MODE,
            nodeVersion: process.version,
            postgresVersion,
          },
        );
      }
      const timings = measurements.map((measurement) => measurement.milliseconds);
      const bytes = Math.max(...measurements.map((measurement) => measurement.bytes));
      const p95Milliseconds = nearestRankP95(timings);
      const maxMilliseconds = Math.max(...timings);
      const observedStatementProfiles = measurements.map((measurement) => measurement.statements);
      const diagnostics = {
        resource,
        cycles: CYCLE_COUNT,
        recordsPerStable: RECORDS_PER_STABLE,
        roster: 11,
        samples: SAMPLE_COUNT,
        statements: maximumProfiles[resource],
        bytes,
        p95Milliseconds: Number(p95Milliseconds.toFixed(2)),
        maxMilliseconds: Number(maxMilliseconds.toFixed(2)),
        cache: CACHE_MODE,
        nodeVersion: process.version,
        postgresVersion,
      };
      assertCondition(
        observedStatementProfiles.every((profile) => JSON.stringify(profile) === JSON.stringify(maximumProfiles[resource])),
        'Statement count changed between sequential samples',
        diagnostics,
      );
      assertCondition(bytes <= RESOURCE_LIMITS[resource].bytes, 'Response byte ceiling exceeded', diagnostics);
      assertCondition(
        p95Milliseconds <= RESOURCE_LIMITS[resource].milliseconds,
        'Nearest-rank p95 budget exceeded',
        diagnostics,
      );
      resources[resource] = {
        statementProfile: maximumProfiles[resource],
        bytes,
        p95Milliseconds: Number(p95Milliseconds.toFixed(2)),
        maxMilliseconds: Number(maxMilliseconds.toFixed(2)),
      };
    }

    const result: BenchmarkResult = {
      fixture: {
        cycles: CYCLE_COUNT,
        recordsPerStable: RECORDS_PER_STABLE,
        oneRobotRoster: 1,
        maximumRoster: 11,
        detailPageSize: DETAIL_PAGE_SIZE,
        samplesPerResource: SAMPLE_COUNT,
      },
      cache: CACHE_MODE,
      nodeVersion: process.version,
      postgresVersion,
      resources,
    };
    console.info(`[finance-center-performance] ${JSON.stringify(result)}`);
  });
});
