/**
 * #542 — Facility ROI reads recorded Streaming Studio and Repair Bay returns
 * through database aggregates instead of loading every row.
 * #550 — the stable's `cycle_snapshots.stable_metrics` totals and the
 * purchase-cycle fallback are aggregated in the database as well.
 *
 * Against real PostgreSQL this suite asserts:
 *  (a) the aggregates, `calculateFacilityROI` and `calculateAllEconomicROIs`
 *      produce exactly the totals of the previous row-loading path (the old
 *      `findMany` queries fed to the per-row reference helpers), on a fixture
 *      with valid, legacy, malformed, out-of-window and other-user rows;
 *  (b) statement count does not depend on history length, no statement reads
 *      ledger metadata or repair payloads row by row, and the aggregates
 *      return at most one row per distinct stored key;
 *  (c) the indexes the aggregate predicates rely on exist.
 *
 * The snapshot fixture (#550) carries per-cycle merchandising, attribute and
 * weapon figures plus a non-array `stable_metrics` row, duplicate entries for
 * one stable (the first wins), a string `userId` that must not match, null and
 * missing fields, and both repair-spend key generations.
 */
import { performance } from 'node:perf_hooks';
import { Prisma } from '../../../generated/prisma';
import prisma, { observePrismaStatements } from '../../../src/lib/prisma';
import { withAuditSequence } from '../../../src/services/common/auditSequence';
import {
  sumRepairBaySavingsFromGroups,
  sumRepairBaySavingsFromRecords,
  sumStudioAttributableStreaming,
  sumStudioAttributableStreamingFromGroups,
} from '../../../src/services/economy/recorded-facility-returns';
import {
  aggregateRepairChargedByDiscount,
  aggregateStudioStreamingByMultiplier,
} from '../../../src/services/economy/recorded-facility-returns-queries';
import { unifiedFacilityROIService } from '../../../src/services/economy/unifiedFacilityROIService';
import {
  aggregateStableSnapshotTotals,
  findEarliestSnapshotCycleWithActivity,
  type SnapshotActivityFacilityType,
  type StableSnapshotTotals,
} from '../../../src/services/economy/snapshot-stable-metric-queries';
import { readCycleRepairSpend } from '../../../src/services/economy/repairPayloadKeys';
import type { StableMetric } from '../../../src/types';

const CYCLE_COUNT = 100;
const LARGE_ROBOTS = 10;
const LARGE_AWARDS_PER_ROBOT_PER_CYCLE = 20; // 100 × 10 × 20 = 20,000 awards
const LARGE_REPAIRS_PER_CYCLE = 50; // 100 × 50 = 5,000 repairs
const LATENCY_CEILING_MS = 2_000;
const LEDGER_CHUNK = 5_000;

const STUDIO_MULTIPLIERS = [1, 1.5, 2, 3.5] as const;
const ACTIVITY_FACILITY_TYPES: readonly SnapshotActivityFacilityType[] = [
  'merchandising_hub',
  'streaming_studio',
  'repair_bay',
  'training_facility',
  'weapons_workshop',
];
/** Snapshot cycle indexes with deliberately odd shapes (#550). */
const NON_ARRAY_SNAPSHOT_INDEX = 13;
const NULL_FIELDS_SNAPSHOT_INDEX = 17;
const STRING_USER_ID_SNAPSHOT_INDEX = 21;
const REPAIR_DISCOUNTS = [0, 6, 36, 48, 90] as const;

type StableLabel = 'varied' | 'empty' | 'small' | 'large' | 'other';

interface MetadataSnapshot {
  totalCycles: number;
}

interface FixtureState {
  marker: string;
  fromCycle: number;
  toCycle: number;
  metadata: MetadataSnapshot | null;
  metadataCreated: boolean;
  users: Record<StableLabel, number>;
  snapshotIds: number[];
  /** Ownership start of the varied stable's facilities (mid-window). */
  variedPurchaseCycle: number;
}

const state: FixtureState = {
  marker: `roiagg_${Date.now().toString(36)}_${process.pid}`,
  fromCycle: 0,
  toCycle: 0,
  metadata: null,
  metadataCreated: false,
  users: { varied: 0, empty: 0, small: 0, large: 0, other: 0 },
  snapshotIds: [],
  variedPurchaseCycle: 0,
};

const ledgerRows: Prisma.FinancialLedgerCreateManyInput[] = [];
const auditRowsByCycle = new Map<number, Prisma.AuditLogCreateManyInput[]>();

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function stableMetric(userId: number, index = 0): StableMetric {
  // Activity starts a few cycles in, so the purchase-cycle fallback has a
  // non-trivial earliest cycle; odd values exercise exact summing.
  const active = index >= 3;
  return {
    userId,
    battlesParticipated: 1,
    totalCreditsEarned: 0,
    totalPrestigeEarned: 0,
    cycleRepairCreditsPaid: active && index % 2 === 0 ? 1_000 + index : 0,
    merchandisingIncome: active ? 1_111 + index * 37 + (userId % 7) : 0,
    streamingIncome: index >= 5 ? 300 + index : 0,
    operatingCosts: 0,
    weaponPurchases: index >= 7 && index % 3 === 0 ? 2_500 + index * 11 : 0,
    facilityPurchases: 0,
    robotPurchases: 0,
    attributeUpgrades: index >= 4 && index % 4 === 0 ? 7_777 + index : 0,
    totalPurchases: 0,
    achievementRewards: 0,
    netProfit: 0,
    balance: 0,
  };
}

function addLedger(
  userId: number,
  cycleNumber: number,
  amount: number,
  metadata: Prisma.FinancialLedgerCreateManyInput['metadata'],
  transactionType = 'streaming_revenue',
): void {
  ledgerRows.push({
    cycleNumber,
    userId,
    transactionType,
    amount,
    balanceAfter: 0,
    description: `${state.marker} fixture`,
    metadata,
  });
}

function addAudit(userId: number, cycleNumber: number, payload: Prisma.InputJsonValue, eventType = 'robot_repair'): void {
  const rows = auditRowsByCycle.get(cycleNumber) ?? [];
  rows.push({ cycleNumber, eventType, sequenceNumber: 0, userId, payload });
  auditRowsByCycle.set(cycleNumber, rows);
}

function cycleAt(index: number): number {
  return state.fromCycle + index;
}

/** Valid, legacy, malformed, pre-purchase and wrong-type rows for one stable. */
function buildVariedHistory(userId: number): void {
  const window = state.variedPurchaseCycle;
  // Before the purchase cycle: must not count.
  addLedger(userId, window - 5, 9_001, json({ formulaVersion: '1', studioMultiplier: 3 }));
  addAudit(userId, window - 5, json({ creditsCharged: 9_001, discountPercent: 50 }));

  for (let index = 0; index < 30; index += 1) {
    const cycleNumber = window + (index % (state.toCycle - window + 1));
    const multiplier = STUDIO_MULTIPLIERS[index % STUDIO_MULTIPLIERS.length];
    // Odd amounts, including team-shared floored values.
    addLedger(userId, cycleNumber, 1_237 + index * 97, json({ formulaVersion: index % 2 === 0 ? '1' : '2', studioMultiplier: multiplier }));
    addLedger(userId, cycleNumber, Math.floor((3_001 + index * 13) / 3), json({ formulaVersion: '2', studioMultiplier: multiplier, teamShare: 3 }));

    const discount = REPAIR_DISCOUNTS[index % REPAIR_DISCOUNTS.length];
    addAudit(userId, cycleNumber, json({ creditsCharged: 4_321 + index * 37, discountPercent: discount, repairType: 'automatic' }));
    addAudit(userId, cycleNumber, json({ cost: 1_999 + index * 11, discountPercent: discount }));
    addAudit(userId, cycleNumber, json({ creditsCharged: 777 + index, cost: 99_999, discountPercent: discount }));
    addAudit(userId, cycleNumber, json({ creditsCharged: '500', cost: 1_234 + index, discountPercent: discount }));
  }

  const inWindow = window + 1;
  // Malformed streaming rows.
  addLedger(userId, inWindow, 5_000, Prisma.DbNull);
  addLedger(userId, inWindow, 5_000, Prisma.JsonNull);
  addLedger(userId, inWindow, 5_000, json([1, 2]));
  addLedger(userId, inWindow, 5_000, json('not-an-object'));
  addLedger(userId, inWindow, 5_000, json({ studioMultiplier: '2' }));
  addLedger(userId, inWindow, 5_000, json({ studioMultiplier: 0.5 }));
  addLedger(userId, inWindow, 5_000, json({}));
  // Not a streaming award, despite carrying a multiplier.
  addLedger(userId, inWindow, 5_000, json({ studioMultiplier: 2 }), 'battle_income');

  // Invalid repair rows.
  addAudit(userId, inWindow, json({ discountPercent: 36 }));
  addAudit(userId, inWindow, json({ creditsCharged: 6_400 }));
  addAudit(userId, inWindow, json({ creditsCharged: 6_400, discountPercent: 100 }));
  addAudit(userId, inWindow, json({ creditsCharged: 6_400, discountPercent: -1 }));
  addAudit(userId, inWindow, json({ creditsCharged: 6_400, discountPercent: '36' }));
  addAudit(userId, inWindow, json({ creditsCharged: '6400', discountPercent: 36 }));
  addAudit(userId, inWindow, Prisma.JsonNull as unknown as Prisma.InputJsonValue);
  addAudit(userId, inWindow, json([6_400, 36]));
  // Not a repair, despite the shape.
  addAudit(userId, inWindow, json({ creditsCharged: 6_400, discountPercent: 36 }), 'financial_transaction');
}

function buildSmallHistory(userId: number): void {
  for (let index = 0; index < 10; index += 1) {
    addLedger(userId, cycleAt(index * 9), 1_000 + index, json({ formulaVersion: '2', studioMultiplier: STUDIO_MULTIPLIERS[index % 4] }));
    addAudit(userId, cycleAt(index * 9), json({ creditsCharged: 2_000 + index, discountPercent: REPAIR_DISCOUNTS[index % 5] }));
  }
}

function buildLargeHistory(userId: number): void {
  for (let index = 0; index < CYCLE_COUNT; index += 1) {
    for (let robot = 0; robot < LARGE_ROBOTS; robot += 1) {
      for (let award = 0; award < LARGE_AWARDS_PER_ROBOT_PER_CYCLE; award += 1) {
        const multiplier = STUDIO_MULTIPLIERS[(robot + award) % STUDIO_MULTIPLIERS.length];
        addLedger(userId, cycleAt(index), 100 + ((index + robot + award) % 900), json({ formulaVersion: '2', studioMultiplier: multiplier }));
      }
    }
    for (let repair = 0; repair < LARGE_REPAIRS_PER_CYCLE; repair += 1) {
      addAudit(userId, cycleAt(index), json({
        creditsCharged: 500 + ((index * 7 + repair) % 4_000),
        discountPercent: REPAIR_DISCOUNTS[repair % REPAIR_DISCOUNTS.length],
      }));
    }
  }
}

async function captureMetadataAndRange(): Promise<void> {
  const [metadata, auditMax, snapshotMax, ledgerMax] = await Promise.all([
    prisma.cycleMetadata.findUnique({ where: { id: 1 } }),
    prisma.auditLog.aggregate({ _max: { cycleNumber: true } }),
    prisma.cycleSnapshot.aggregate({ _max: { cycleNumber: true } }),
    prisma.financialLedger.aggregate({ _max: { cycleNumber: true } }),
  ]);
  state.metadata = metadata ? { totalCycles: metadata.totalCycles } : null;
  const greatestCycle = Math.max(
    metadata?.totalCycles ?? 0,
    auditMax._max.cycleNumber ?? 0,
    snapshotMax._max.cycleNumber ?? 0,
    ledgerMax._max.cycleNumber ?? 0,
  );
  state.fromCycle = greatestCycle + 1;
  state.toCycle = state.fromCycle + CYCLE_COUNT - 1;
  state.variedPurchaseCycle = state.fromCycle + 40;
  if (metadata) {
    await prisma.cycleMetadata.update({ where: { id: 1 }, data: { totalCycles: state.toCycle } });
  } else {
    await prisma.cycleMetadata.create({ data: { id: 1, totalCycles: state.toCycle } });
    state.metadataCreated = true;
  }
}

async function createUsersAndFacilities(): Promise<void> {
  for (const label of Object.keys(state.users) as StableLabel[]) {
    const user = await prisma.user.create({
      data: { username: `${state.marker}_${label}`, passwordHash: 'roi-aggregate-fixture-hash', currency: 0 },
      select: { id: true },
    });
    state.users[label] = user.id;
    await prisma.facility.createMany({
      data: ['streaming_studio', 'repair_bay'].map((facilityType) => ({
        userId: user.id,
        facilityType,
        level: 2,
        maxLevel: 10,
      })),
    });
    const purchaseCycle = label === 'varied' ? state.variedPurchaseCycle : state.fromCycle;
    for (const facilityType of ['streaming_studio', 'repair_bay']) {
      addAudit(user.id, purchaseCycle, json({ facilityType, oldLevel: 0, newLevel: 1 }), 'facility_purchase');
    }
  }
}

async function persistFixture(): Promise<void> {
  for (let offset = 0; offset < ledgerRows.length; offset += LEDGER_CHUNK) {
    await prisma.financialLedger.createMany({ data: ledgerRows.slice(offset, offset + LEDGER_CHUNK) });
  }
  for (const [cycleNumber, rows] of auditRowsByCycle) {
    await withAuditSequence(cycleNumber, rows.length, async (startSequence, tx) => {
      await tx.auditLog.createMany({
        data: rows.map((row, index) => ({ ...row, sequenceNumber: startSequence + index })),
      });
    });
  }
  // Every stable except `other` has a snapshot entry in (almost) every cycle,
  // so all ROI calls take the snapshot (recorded-history) path.
  const snapshots = await prisma.cycleSnapshot.createManyAndReturn({
    data: Array.from({ length: CYCLE_COUNT }, (_, index) => ({
      cycleNumber: cycleAt(index),
      triggerType: 'manual',
      startTime: new Date(Date.UTC(2099, 0, 1) + index * 86_400_000),
      endTime: new Date(Date.UTC(2099, 0, 1) + index * 86_400_000 + 1_000),
      durationMs: 1_000,
      stableMetrics: snapshotStableMetrics(index),
      robotMetrics: json([]),
      stepDurations: json([]),
    })),
    select: { id: true },
  });
  state.snapshotIds = snapshots.map((snapshot) => snapshot.id);
}

/** The `stable_metrics` JSON for fixture cycle `index`, with the odd shapes (#550). */
function snapshotStableMetrics(index: number): Prisma.InputJsonValue {
  if (index === NON_ARRAY_SNAPSHOT_INDEX) {
    return json({ note: 'not an array', userId: state.users.varied, merchandisingIncome: 123_456 });
  }
  const metrics: Array<Record<string, unknown>> = (['varied', 'empty', 'small', 'large'] as const).map((label) => ({
    ...stableMetric(state.users[label], index),
  }));
  const varied = metrics[0];
  if (index === NULL_FIELDS_SNAPSHOT_INDEX) {
    varied.merchandisingIncome = null;
    delete varied.attributeUpgrades;
  }
  if (index % 2 === 1 && index > 3) {
    // Pre-rename repair-spend key only.
    delete varied.cycleRepairCreditsPaid;
    varied.totalRepairCosts = 900 + index;
  }
  if (index % 10 === 0) {
    // A later duplicate entry for the same stable is ignored (first match wins).
    metrics.push({ ...stableMetric(state.users.varied, index), merchandisingIncome: 999_999, weaponPurchases: 999_999 });
  }
  if (index === STRING_USER_ID_SNAPSHOT_INDEX) {
    // `userId` as a string never matches the numeric id.
    metrics.unshift({ userId: String(state.users.varied), merchandisingIncome: 888_888 });
  }
  return json(metrics);
}

/** The pre-#550 path: load the window's snapshots and pick the stable's entry in JS. */
async function referenceSnapshotTotals(userId: number, fromCycle: number, toCycle: number): Promise<StableSnapshotTotals> {
  const snapshots = await prisma.cycleSnapshot.findMany({
    where: { cycleNumber: { gte: fromCycle, lte: toCycle } },
    select: { cycleNumber: true, stableMetrics: true },
  });
  const userMetrics: StableMetric[] = [];
  for (const snapshot of snapshots) {
    const metrics = snapshot.stableMetrics as unknown as StableMetric[];
    if (Array.isArray(metrics)) {
      const userMetric = metrics.find((m) => m.userId === userId);
      if (userMetric) userMetrics.push(userMetric);
    }
  }
  return {
    snapshotCount: userMetrics.length,
    merchandisingIncome: userMetrics.reduce((sum, m) => sum + (m.merchandisingIncome || 0), 0),
    attributeUpgrades: userMetrics.reduce((sum, m) => sum + (m.attributeUpgrades || 0), 0),
    weaponPurchases: userMetrics.reduce((sum, m) => sum + (m.weaponPurchases || 0), 0),
  };
}

/** The pre-#550 purchase-cycle fallback: first 100 snapshots, first active one in JS. */
async function referenceEarliestActivity(userId: number, facilityType: SnapshotActivityFacilityType): Promise<number | null> {
  const snapshots = await prisma.cycleSnapshot.findMany({
    select: { cycleNumber: true, stableMetrics: true },
    orderBy: { cycleNumber: 'asc' },
    take: 100,
  });
  for (const snapshot of snapshots) {
    const metrics = snapshot.stableMetrics as unknown as StableMetric[];
    if (!Array.isArray(metrics)) continue;
    const metric = metrics.find((m) => m.userId === userId);
    if (!metric) continue;
    const active =
      facilityType === 'merchandising_hub' ? metric.merchandisingIncome > 0
        : facilityType === 'streaming_studio' ? metric.streamingIncome > 0
          : facilityType === 'repair_bay' ? readCycleRepairSpend(metric as unknown as Record<string, unknown>) > 0
            : facilityType === 'training_facility' ? metric.attributeUpgrades > 0
              : metric.weaponPurchases > 0;
    if (active) return snapshot.cycleNumber;
  }
  return null;
}

/** The pre-#542 path: load every row with the old query, sum per row. */
async function referenceStreaming(userId: number, fromCycle: number, toCycle: number): Promise<number> {
  const rows = await prisma.financialLedger.findMany({
    where: { userId, transactionType: 'streaming_revenue', cycleNumber: { gte: fromCycle, lte: toCycle } },
    select: { amount: true, metadata: true, cycleNumber: true },
  });
  return sumStudioAttributableStreaming(rows);
}

async function referenceRepair(userId: number, fromCycle: number, toCycle: number): Promise<number> {
  const rows = await prisma.auditLog.findMany({
    where: { userId, eventType: 'robot_repair', cycleNumber: { gte: fromCycle, lte: toCycle } },
    select: { payload: true, cycleNumber: true },
  });
  return sumRepairBaySavingsFromRecords(rows.map((row) => row.payload));
}

async function captureStatements<T>(operation: () => Promise<T>): Promise<{ result: T; statements: string[] }> {
  const statements: string[] = [];
  const stop = observePrismaStatements((sql) => {
    statements.push(sql);
  });
  try {
    const result = await operation();
    return { result, statements };
  } finally {
    stop();
  }
}

/**
 * Statements that read `cycle_snapshots` rows into the application: anything
 * touching the table that is not one of the #550 aggregates (a COUNT/SUM over
 * the window, or the LIMIT 1 earliest-activity lookup).
 */
function rowWiseSnapshotReads(statements: readonly string[]): string[] {
  return statements.filter((sql) => {
    if (!sql.includes('"cycle_snapshots"')) return false;
    if (/COUNT\(\*\)/i.test(sql) && /SUM\(/i.test(sql)) return false;
    // Literal LIMIT 1 only: a Prisma findMany/findFirst ends in `LIMIT $n OFFSET $m`.
    if (/LIMIT\s+1\s*$/i.test(sql.trim())) return false;
    return true;
  });
}

/** Statements that touch the recorded-history tables must be aggregates or single-row lookups. */
function rowWiseHistoryReads(statements: readonly string[]): string[] {
  return statements.filter((sql) => {
    const touchesLedger = sql.includes('"financial_ledger"');
    const touchesAudit = sql.includes('"audit_logs"');
    if (!touchesLedger && !touchesAudit) return false;
    if (/GROUP BY/i.test(sql)) return false;
    // The purchase-cycle lookup (`findFirst` on facility_purchase) reads one row.
    if (touchesAudit && !touchesLedger && /LIMIT/i.test(sql)) return false;
    return true;
  });
}

beforeAll(async () => {
  await captureMetadataAndRange();
  await createUsersAndFacilities();
  buildVariedHistory(state.users.varied);
  // Same shapes for another stable: must never leak into `varied`.
  buildVariedHistory(state.users.other);
  buildSmallHistory(state.users.small);
  buildLargeHistory(state.users.large);
  await persistFixture();
}, 180_000);

afterAll(async () => {
  const userIds = Object.values(state.users).filter((id) => id > 0);
  await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.financialLedger.deleteMany({ where: { userId: { in: userIds } } });
  if (state.snapshotIds.length > 0) {
    await prisma.cycleSnapshot.deleteMany({ where: { id: { in: state.snapshotIds } } });
  }
  await prisma.facility.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  if (state.metadataCreated) {
    await prisma.cycleMetadata.delete({ where: { id: 1 } });
  } else if (state.metadata) {
    await prisma.cycleMetadata.update({ where: { id: 1 }, data: { totalCycles: state.metadata.totalCycles } });
  }
}, 120_000);

describe('(a) aggregate path equals the previous row-loading path', () => {
  it('aggregate helpers reproduce the per-row reference for a varied history', async () => {
    const userId = state.users.varied;
    const from = state.variedPurchaseCycle;
    const to = state.toCycle;

    const expectedStreaming = await referenceStreaming(userId, from, to);
    const expectedRepair = await referenceRepair(userId, from, to);
    // The fixture is not trivially zero.
    expect(expectedStreaming).toBeGreaterThan(0);
    expect(expectedRepair).toBeGreaterThan(0);

    expect(sumStudioAttributableStreamingFromGroups(await aggregateStudioStreamingByMultiplier(userId, from, to))).toBe(
      expectedStreaming,
    );
    expect(sumRepairBaySavingsFromGroups(await aggregateRepairChargedByDiscount(userId, from, to))).toBe(expectedRepair);

    // Same over the whole window, including the pre-purchase rows.
    expect(sumStudioAttributableStreamingFromGroups(await aggregateStudioStreamingByMultiplier(userId, 1, to))).toBe(
      await referenceStreaming(userId, 1, to),
    );
    expect(sumRepairBaySavingsFromGroups(await aggregateRepairChargedByDiscount(userId, 1, to))).toBe(
      await referenceRepair(userId, 1, to),
    );
  });

  it.each(['varied', 'empty', 'small', 'large', 'other'] as const)(
    'snapshot totals for the %s stable equal the pre-#550 JS path (#550)',
    async (label) => {
      const userId = state.users[label];
      const windows: Array<[number, number]> = [
        [state.fromCycle, state.toCycle],
        [state.variedPurchaseCycle, state.toCycle],
        [state.fromCycle + NON_ARRAY_SNAPSHOT_INDEX, state.fromCycle + STRING_USER_ID_SNAPSHOT_INDEX],
        [1, state.toCycle],
      ];
      for (const [from, to] of windows) {
        expect(await aggregateStableSnapshotTotals(userId, from, to)).toEqual(await referenceSnapshotTotals(userId, from, to));
      }
      const full = await aggregateStableSnapshotTotals(userId, state.fromCycle, state.toCycle);
      if (label === 'other') {
        // No snapshot entries at all: the service would use the estimate.
        expect(full.snapshotCount).toBe(0);
      } else {
        // The non-array snapshot is skipped.
        expect(full.snapshotCount).toBe(CYCLE_COUNT - 1);
        expect(full.merchandisingIncome).toBeGreaterThan(0);
        expect(full.attributeUpgrades).toBeGreaterThan(0);
        expect(full.weaponPurchases).toBeGreaterThan(0);
      }
    },
  );

  it.each(['varied', 'empty', 'small', 'large'] as const)(
    'ROI totals for the %s stable equal the reference in both service paths',
    async (label) => {
      const userId = state.users[label];
      const from = label === 'varied' ? state.variedPurchaseCycle : state.fromCycle;
      const expected = {
        streaming_studio: await referenceStreaming(userId, from, state.toCycle),
        repair_bay: await referenceRepair(userId, from, state.toCycle),
      };
      if (label === 'empty') {
        expect(expected).toEqual({ streaming_studio: 0, repair_bay: 0 });
      }

      const all = await unifiedFacilityROIService.calculateAllEconomicROIs(userId);
      expect(all.facilities).toHaveLength(2);

      for (const facilityType of ['streaming_studio', 'repair_bay'] as const) {
        const single = await unifiedFacilityROIService.calculateFacilityROI(userId, facilityType);
        expect(single).not.toBeNull();
        expect(single!.dataSource).toBe('snapshot');
        expect(single!.cyclesSincePurchase).toBe(state.toCycle - from + 1);
        expect(single!.totalReturns).toBe(expected[facilityType]);
        expect(all.facilities.find((f) => f.facilityType === facilityType)).toEqual(single);
      }
    },
  );
});

describe('(b) bounded statements and row volume', () => {
  it('runs the same statements for a 20,000-award history as for a 10-award one', async () => {
    const small = await captureStatements(() => unifiedFacilityROIService.calculateAllEconomicROIs(state.users.small));
    const large = await captureStatements(() => unifiedFacilityROIService.calculateAllEconomicROIs(state.users.large));

    process.stdout.write(
      `calculateAllEconomicROIs statements: small history ${small.statements.length}, large history ${large.statements.length}\n`,
    );
    // The observer is live (NODE_ENV=test), so an empty capture is a setup fault.
    expect(small.statements.length).toBeGreaterThan(0);
    expect(large.statements.length).toBe(small.statements.length);
    expect(rowWiseHistoryReads(small.statements)).toEqual([]);
    expect(rowWiseHistoryReads(large.statements)).toEqual([]);
    // Snapshot rows are never loaded; one snapshot aggregate per facility (#550).
    expect(rowWiseSnapshotReads(small.statements)).toEqual([]);
    expect(rowWiseSnapshotReads(large.statements)).toEqual([]);
    expect(large.statements.filter((sql) => sql.includes('"cycle_snapshots"'))).toHaveLength(2);
    // One aggregate per recorded-history facility.
    expect(large.statements.filter((sql) => /GROUP BY/i.test(sql) && sql.includes('"financial_ledger"'))).toHaveLength(1);
    expect(large.statements.filter((sql) => /GROUP BY/i.test(sql) && sql.includes('"audit_logs"'))).toHaveLength(1);

    for (const facilityType of ['streaming_studio', 'repair_bay'] as const) {
      const smallSingle = await captureStatements(() =>
        unifiedFacilityROIService.calculateFacilityROI(state.users.small, facilityType),
      );
      const largeSingle = await captureStatements(() =>
        unifiedFacilityROIService.calculateFacilityROI(state.users.large, facilityType),
      );
      process.stdout.write(
        `calculateFacilityROI(${facilityType}) statements: small ${smallSingle.statements.length}, large ${largeSingle.statements.length}\n`,
      );
      expect(largeSingle.statements.length).toBe(smallSingle.statements.length);
      expect(rowWiseHistoryReads(largeSingle.statements)).toEqual([]);
      expect(rowWiseSnapshotReads(largeSingle.statements)).toEqual([]);
    }
  });

  it('reads the same cycle_snapshots statements for a 60-cycle and a 100-cycle ownership window (#550)', async () => {
    const shortWindow = await captureStatements(() => unifiedFacilityROIService.calculateAllEconomicROIs(state.users.varied));
    const longWindow = await captureStatements(() => unifiedFacilityROIService.calculateAllEconomicROIs(state.users.small));
    const snapshotStatements = (statements: string[]): string[] =>
      statements.filter((sql) => sql.includes('"cycle_snapshots"'));
    expect(snapshotStatements(longWindow.statements)).toHaveLength(snapshotStatements(shortWindow.statements).length);
    expect(longWindow.statements.length).toBe(shortWindow.statements.length);
    expect(rowWiseSnapshotReads(shortWindow.statements)).toEqual([]);
    expect(rowWiseSnapshotReads(longWindow.statements)).toEqual([]);
  });

  it('runs the earliest-activity fallback as one bounded statement (#550)', async () => {
    const { result, statements } = await captureStatements(() =>
      findEarliestSnapshotCycleWithActivity(state.users.small, 'merchandising_hub'),
    );
    expect(statements).toHaveLength(1);
    expect(rowWiseSnapshotReads(statements)).toEqual([]);
    expect(result === null || Number.isInteger(result)).toBe(true);
  });

  it('returns at most one aggregate row per distinct stored key', async () => {
    const userId = state.users.large;
    const [ledgerCount, repairCount] = await Promise.all([
      prisma.financialLedger.count({ where: { userId, transactionType: 'streaming_revenue' } }),
      prisma.auditLog.count({ where: { userId, eventType: 'robot_repair' } }),
    ]);
    expect(ledgerCount).toBeGreaterThanOrEqual(20_000);
    expect(repairCount).toBeGreaterThanOrEqual(5_000);

    const streamingGroups = await aggregateStudioStreamingByMultiplier(userId, state.fromCycle, state.toCycle);
    const repairGroups = await aggregateRepairChargedByDiscount(userId, state.fromCycle, state.toCycle);
    process.stdout.write(
      `rows read: ${ledgerCount} awards -> ${streamingGroups.length} groups; ${repairCount} repairs -> ${repairGroups.length} groups\n`,
    );
    expect(streamingGroups.length).toBeLessThanOrEqual(STUDIO_MULTIPLIERS.length);
    expect(repairGroups.length).toBeLessThanOrEqual(REPAIR_DISCOUNTS.length);
  });

  it('computes all ROIs for the large history within a generous latency ceiling', async () => {
    const start = performance.now();
    await unifiedFacilityROIService.calculateAllEconomicROIs(state.users.large);
    const elapsed = performance.now() - start;
    process.stdout.write(`facility ROI aggregate latency sample (20k awards, 5k repairs): ${elapsed.toFixed(1)} ms\n`);
    expect(elapsed).toBeLessThan(LATENCY_CEILING_MS);
  });
});

describe('(c) access paths', () => {
  it('keeps the indexes the aggregate predicates use', async () => {
    const rows = await prisma.$queryRaw<Array<{ indexname: string }>>(Prisma.sql`
      SELECT indexname FROM pg_indexes
      WHERE indexname IN (
        'financial_ledger_user_id_cycle_number_idx',
        'audit_logs_user_id_idx',
        'cycle_snapshots_cycle_number_key'
      )
    `);
    expect(rows.map((row) => row.indexname).sort()).toEqual([
      'audit_logs_user_id_idx',
      'cycle_snapshots_cycle_number_key',
      'financial_ledger_user_id_cycle_number_idx',
    ]);
  });
});

/**
 * The purchase-cycle fallback reads the oldest 100 snapshots of the whole
 * table. A controlled window: 100 snapshots below every existing cycle number
 * are, by construction, exactly the oldest 100, whatever the shared database
 * already holds. One more snapshot above the window carries activity that must
 * be ignored.
 */
describe('(d) earliest-activity fallback over a controlled oldest-100 window (#550)', () => {
  const WINDOW = 100;
  let windowStart = 0;
  const snapshotIds: number[] = [];
  /** Window index of the first activity per facility type for the `early` stable. */
  const EARLY_INDEX: Record<SnapshotActivityFacilityType, number> = {
    merchandising_hub: 3,
    repair_bay: 4, // legacy `totalRepairCosts` key only
    streaming_studio: 5,
    training_facility: 7, // index 6 has activity only in a later duplicate entry, which must be ignored
    weapons_workshop: 8,
  };

  const zeroMetric = (userId: number): Record<string, unknown> => ({ ...stableMetric(userId) });

  function windowMetrics(index: number, early: number, late: number): Prisma.InputJsonValue {
    if (index === 1) {
      // Not an array: skipped even though it names the stable with activity.
      return json({ userId: early, merchandisingIncome: 9_999 });
    }
    const earlyMetric = zeroMetric(early);
    const extra: Array<Record<string, unknown>> = [];
    if (index === 0) {
      // A string userId never matches; the real entry has no activity.
      return json([{ userId: String(early), merchandisingIncome: 1, streamingIncome: 1, attributeUpgrades: 1, weaponPurchases: 1, cycleRepairCreditsPaid: 1 }, earlyMetric, zeroMetric(late)]);
    }
    if (index === EARLY_INDEX.merchandising_hub) earlyMetric.merchandisingIncome = 100;
    if (index === EARLY_INDEX.repair_bay) {
      delete earlyMetric.cycleRepairCreditsPaid;
      earlyMetric.totalRepairCosts = 50;
    }
    if (index === EARLY_INDEX.streaming_studio) earlyMetric.streamingIncome = 10;
    if (index === 6) extra.push({ ...zeroMetric(early), attributeUpgrades: 999 });
    if (index === EARLY_INDEX.training_facility) earlyMetric.attributeUpgrades = 70;
    if (index === EARLY_INDEX.weapons_workshop) earlyMetric.weaponPurchases = 20;
    return json([earlyMetric, ...extra, zeroMetric(late)]);
  }

  beforeAll(async () => {
    const existing = await prisma.cycleSnapshot.aggregate({ _min: { cycleNumber: true } });
    windowStart = (existing._min.cycleNumber ?? 1) - WINDOW;
    const early = state.users.small;
    const late = state.users.other;
    const created = await prisma.cycleSnapshot.createManyAndReturn({
      data: [
        ...Array.from({ length: WINDOW }, (_, index) => ({
          cycleNumber: windowStart + index,
          triggerType: 'manual',
          startTime: new Date(Date.UTC(1999, 0, 1) + index * 86_400_000),
          endTime: new Date(Date.UTC(1999, 0, 1) + index * 86_400_000 + 1_000),
          durationMs: 1_000,
          stableMetrics: windowMetrics(index, early, late),
          robotMetrics: json([]),
          stepDurations: json([]),
        })),
        // Above every other snapshot: outside the oldest-100 window.
        {
          cycleNumber: state.toCycle + 1,
          triggerType: 'manual',
          startTime: new Date(Date.UTC(2099, 11, 1)),
          endTime: new Date(Date.UTC(2099, 11, 1) + 1_000),
          durationMs: 1_000,
          stableMetrics: json([{ ...stableMetric(late), merchandisingIncome: 500, streamingIncome: 500, cycleRepairCreditsPaid: 500, attributeUpgrades: 500, weaponPurchases: 500 }]),
          robotMetrics: json([]),
          stepDurations: json([]),
        },
      ],
      select: { id: true },
    });
    snapshotIds.push(...created.map((snapshot) => snapshot.id));
  }, 60_000);

  afterAll(async () => {
    if (snapshotIds.length > 0) await prisma.cycleSnapshot.deleteMany({ where: { id: { in: snapshotIds } } });
  });

  it.each(ACTIVITY_FACILITY_TYPES)('%s: finds the first active cycle in the window', async (facilityType) => {
    const expected = windowStart + EARLY_INDEX[facilityType];
    expect(await findEarliestSnapshotCycleWithActivity(state.users.small, facilityType)).toBe(expected);
    // Same answer as the pre-#550 JS path.
    expect(await referenceEarliestActivity(state.users.small, facilityType)).toBe(expected);
  });

  it.each(ACTIVITY_FACILITY_TYPES)('%s: ignores activity outside the oldest 100 snapshots', async (facilityType) => {
    expect(await findEarliestSnapshotCycleWithActivity(state.users.other, facilityType)).toBeNull();
    expect(await referenceEarliestActivity(state.users.other, facilityType)).toBeNull();
  });

  it('returns null for a stable with no entry in the window', async () => {
    for (const facilityType of ACTIVITY_FACILITY_TYPES) {
      expect(await findEarliestSnapshotCycleWithActivity(state.users.large, facilityType)).toBeNull();
    }
  });
});
