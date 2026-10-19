/**
 * #542 — Facility ROI reads recorded Streaming Studio and Repair Bay returns
 * through database aggregates instead of loading every row.
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
import type { StableMetric } from '../../../src/types';

const CYCLE_COUNT = 100;
const LARGE_ROBOTS = 10;
const LARGE_AWARDS_PER_ROBOT_PER_CYCLE = 20; // 100 × 10 × 20 = 20,000 awards
const LARGE_REPAIRS_PER_CYCLE = 50; // 100 × 50 = 5,000 repairs
const LATENCY_CEILING_MS = 2_000;
const LEDGER_CHUNK = 5_000;

const STUDIO_MULTIPLIERS = [1, 1.5, 2, 3.5] as const;
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

function stableMetric(userId: number): StableMetric {
  return {
    userId,
    battlesParticipated: 1,
    totalCreditsEarned: 0,
    totalPrestigeEarned: 0,
    cycleRepairCreditsPaid: 0,
    merchandisingIncome: 0,
    streamingIncome: 0,
    operatingCosts: 0,
    weaponPurchases: 0,
    facilityPurchases: 0,
    robotPurchases: 0,
    attributeUpgrades: 0,
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
  // Every stable except `other` has a snapshot entry in every cycle, so all
  // ROI calls take the snapshot (recorded-history) path.
  const metrics = (['varied', 'empty', 'small', 'large'] as const).map((label) => stableMetric(state.users[label]));
  const snapshots = await prisma.cycleSnapshot.createManyAndReturn({
    data: Array.from({ length: CYCLE_COUNT }, (_, index) => ({
      cycleNumber: cycleAt(index),
      triggerType: 'manual',
      startTime: new Date(Date.UTC(2099, 0, 1) + index * 86_400_000),
      endTime: new Date(Date.UTC(2099, 0, 1) + index * 86_400_000 + 1_000),
      durationMs: 1_000,
      stableMetrics: json(metrics),
      robotMetrics: json([]),
      stepDurations: json([]),
    })),
    select: { id: true },
  });
  state.snapshotIds = snapshots.map((snapshot) => snapshot.id);
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
    }
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
      WHERE indexname IN ('financial_ledger_user_id_cycle_number_idx', 'audit_logs_user_id_idx')
    `);
    expect(rows.map((row) => row.indexname).sort()).toEqual([
      'audit_logs_user_id_idx',
      'financial_ledger_user_id_cycle_number_idx',
    ]);
  });
});
