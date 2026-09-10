import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { Prisma } from '../generated/prisma';
import prisma from '../src/lib/prisma';
import { errorHandler } from '../src/middleware/errorHandler';
import financesRoutes from '../src/routes/finances';
import { applyCreditMutation } from '../src/services/financial/creditMutationService';
import {
  getRobotFinancialEvents,
  getRobotFinancialSummaries,
} from '../src/services/financial/robotDeploymentQueryService';
import { withAuditSequence } from '../src/services/common/auditSequence';
import { createPlayerSafeSourceReference } from '../src/services/financial/playerSafeSourceReference';
import { resolveCanonicalCycleIdentity } from '../src/services/cycle/canonicalCycleIdentity';
import type { BattleIncomeBreakdown, RepairBreakdown } from '../src/types';

const FINANCE_AMOUNT = 100;
const FIXTURE_TIMESTAMP = new Date('2025-01-15T12:00:00.000Z');

const app = express();
app.use(express.json());
app.use('/api/finances', financesRoutes);
app.use(errorHandler);

interface FinanceFixture {
  userId: number;
  robotId: number;
  battleId: number | null;
  token: string;
  financialEventId: string;
}

function battleBreakdown(financialEventId: string): BattleIncomeBreakdown {
  return {
    schemaVersion: 1,
    formula: 'battle.reward',
    formulaVersion: '1',
    inputs: [{ name: 'participationFloor', value: FINANCE_AMOUNT, unit: 'credits', source: 'integration_test' }],
    modifiers: [],
    rounding: { precision: 0, mode: 'round', operationOrder: ['participationFloor'], scope: 'aggregate' },
    finalAmount: FINANCE_AMOUNT,
    sourceEventId: financialEventId,
    transactionType: 'battle_income',
    mode: 'league_1v1',
    tier: 1,
    outcome: 'win',
    placement: null,
    participationFloor: FINANCE_AMOUNT,
    winComponent: 0,
    teamSize: 1,
    stableAggregation: 'stable',
    isBye: false,
  };
}

function repairBreakdown(financialEventId: string): RepairBreakdown {
  return {
    schemaVersion: 1,
    formula: 'repair.quote',
    formulaVersion: '1',
    inputs: [{ name: 'damageRepaired', value: 5, unit: 'hp', source: 'integration_test' }],
    modifiers: [],
    rounding: { precision: 0, mode: 'round', operationOrder: ['quote'], scope: 'per_item' },
    finalAmount: -5,
    sourceEventId: financialEventId,
    transactionType: 'repair_cost',
    repairType: 'automatic',
    robotId: 0,
    baseQuote: 5,
    damageRepaired: 5,
    repairBayLevel: 0,
    activeRobotCount: 1,
    repairBayDiscountPercent: 0,
    manualRepairDiscountPercent: 0,
    quoteBeforeManualDiscount: 5,
    perRobotCharge: 5,
  };
}

async function createFixture(label: string, withFinancialEvent: boolean): Promise<FinanceFixture> {
  const unique = `finance_center_${label}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const user = await prisma.user.create({
    data: { username: unique, passwordHash: 'integration-test-hash', currency: 1_000 },
    select: { id: true, username: true },
  });
  const robot = await prisma.robot.create({
    data: {
      name: `${unique}_robot`,
      userId: user.id,
      currentHP: 100,
      maxHP: 100,
      currentShield: 10,
      maxShield: 10,
    },
    select: { id: true },
  });
  let battleId: number | null = null;
  let financialEventId = `finance-center:${label}:${user.id}`;

  if (withFinancialEvent) {
    const battle = await prisma.battle.create({
      data: {
        battleType: 'league',
        leagueType: 'bronze',
        durationSeconds: 60,
        createdAt: FIXTURE_TIMESTAMP,
        participants: {
          create: {
            robotId: robot.id,
            team: 1,
            credits: FINANCE_AMOUNT,
            eloBefore: 1_200,
            eloAfter: 1_200,
            finalHP: 100,
          },
        },
      },
      select: { id: true },
    });
    battleId = battle.id;
    financialEventId = `battle:${battle.id}:finance-center:${label}:${user.id}`;
    await applyCreditMutation({
      cycleNumber: 0,
      userId: user.id,
      robotId: robot.id,
      transactionType: 'battle_income',
      amount: FINANCE_AMOUNT,
      description: 'Finance Center integration battle income',
      financialEventId,
      breakdown: battleBreakdown(financialEventId),
      timestamp: FIXTURE_TIMESTAMP,
    });
  }

  return {
    userId: user.id,
    robotId: robot.id,
    battleId,
    token: jwt.sign({ userId: user.id, username: user.username, role: 'user', tokenVersion: 0 }, process.env.JWT_SECRET || 'test-secret'),
    financialEventId,
  };
}

async function deleteFixture(fixture: FinanceFixture): Promise<void> {
  await prisma.financialLedger.deleteMany({ where: { userId: fixture.userId } });
  await prisma.auditLog.deleteMany({ where: { userId: fixture.userId } });
  if (fixture.battleId !== null) {
    await prisma.battle.deleteMany({ where: { id: fixture.battleId } });
  }
  await prisma.robot.deleteMany({ where: { userId: fixture.userId } });
  await prisma.user.deleteMany({ where: { id: fixture.userId } });
}

describe('Finance Center v1 route integration', () => {
  let owner: FinanceFixture;
  let otherUser: FinanceFixture;

  beforeAll(async () => {
    await prisma.$connect();
    owner = await createFixture('owner', true);
    otherUser = await createFixture('other', false);
  });

  afterAll(async () => {
    await deleteFixture(owner);
    await deleteFixture(otherUser);
    await prisma.$disconnect();
  });

  it.each([
    '/api/finances/report?scope=current',
    '/api/finances/history?scope=current',
    '/api/finances/robots?scope=current',
    () => `/api/finances/robots/${owner.robotId}/events?scope=current`,
  ])('should require authentication for %s', async (path) => {
    const response = await request(app).get(typeof path === 'function' ? path() : path);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Access token required' });
  });

  it('should reject malformed and conflicting period selections before report data is read', async () => {
    const missing = await request(app)
      .get('/api/finances/report')
      .set('Authorization', `Bearer ${owner.token}`);
    const conflicting = await request(app)
      .get('/api/finances/history?scope=current&fromCycle=1&toCycle=1')
      .set('Authorization', `Bearer ${owner.token}`);
    const reversed = await request(app)
      .get('/api/finances/robots?fromCycle=2&toCycle=1')
      .set('Authorization', `Bearer ${owner.token}`);

    for (const response of [missing, conflicting, reversed]) {
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    }
  });

  it('should return the typed report-period 400 for unavailable ranges on all four resources', async () => {
    const identity = await resolveCanonicalCycleIdentity();
    const unavailableCycle = identity.completedCycles + 1;
    const query = `fromCycle=${unavailableCycle}&toCycle=${unavailableCycle}`;
    const paths = [
      `/api/finances/report?${query}`,
      `/api/finances/history?${query}`,
      `/api/finances/robots?${query}`,
      `/api/finances/robots/${owner.robotId}/events?${query}`,
    ];

    for (const path of paths) {
      const response = await request(app)
        .get(path)
        .set('Authorization', `Bearer ${owner.token}`);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: identity.completedCycles < 1
          ? 'No completed financial cycles are available yet. Use Current cycle, or try again after Cycle 1 closes.'
          : `Completed cycle range must be between 1 and ${identity.completedCycles}`,
        code: 'FINANCIAL_INVALID_REPORT_PERIOD',
      });
    }
  });

  it('should return versioned current-period envelopes for report, history, robot summaries, and owned events', async () => {
    const report = await request(app)
      .get('/api/finances/report?scope=current')
      .set('Authorization', `Bearer ${owner.token}`);
    const history = await request(app)
      .get('/api/finances/history?scope=current')
      .set('Authorization', `Bearer ${owner.token}`);
    const robots = await request(app)
      .get('/api/finances/robots?scope=current')
      .set('Authorization', `Bearer ${owner.token}`);
    const events = await request(app)
      .get(`/api/finances/robots/${owner.robotId}/events?scope=current`)
      .set('Authorization', `Bearer ${owner.token}`);

    for (const response of [report, history, robots, events]) {
      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('private, max-age=15');
      expect(response.body).toMatchObject({
        version: 1,
        period: { scope: 'current', containsCurrentCycle: true },
        provenance: expect.any(Array),
        reconciliation: expect.any(Object),
        limitations: expect.any(Array),
      });
    }

    expect(report.body.reconciliation.signedMovement).toBe(FINANCE_AMOUNT);
    expect(report.body.data.statement.netCashMovement).toBe(FINANCE_AMOUNT);
    expect(history.body.data.points).toEqual(expect.arrayContaining([
      expect.objectContaining({
        statement: expect.objectContaining({ netCashMovement: FINANCE_AMOUNT }),
        reconciliation: expect.objectContaining({ signedMovement: FINANCE_AMOUNT }),
      }),
    ]));
    expect(robots.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ robotId: owner.robotId, battleByeIncome: FINANCE_AMOUNT, directNet: FINANCE_AMOUNT }),
    ]));
    expect(events.body.data).toMatchObject({
      robot: expect.objectContaining({ robotId: owner.robotId, battleByeIncome: FINANCE_AMOUNT }),
      items: [expect.objectContaining({ eventKind: 'battle_income', amount: FINANCE_AMOUNT, fought: true })],
    });

    const serialized = JSON.stringify([report.body, history.body, robots.body, events.body]);
    expect(serialized).not.toContain(owner.financialEventId);
    expect(serialized).not.toContain('financialEventId');
    expect(serialized).not.toContain('auditLogId');
    expect(serialized).not.toContain('auditId');
    expect(serialized).not.toContain('sourceEventId');
  });

  it('should keep summary and detail invariant across owner-scoped battle and exact repair evidence', async () => {
    const battle = await prisma.battle.create({
      data: {
        battleType: 'league',
        leagueType: 'bronze',
        durationSeconds: 1,
        participants: {
          create: [
            { robotId: owner.robotId, team: 1, credits: 25, eloBefore: 1200, eloAfter: 1200, finalHP: 100 },
            { robotId: otherUser.robotId, team: 2, credits: 75, eloBefore: 1200, eloAfter: 1200, finalHP: 100 },
          ],
        },
      },
      select: { id: true },
    });
    const ownerByeId = `finance-center:bye-owner:${battle.id}`;
    const otherByeId = `finance-center:bye-other:${battle.id}`;
    const linkedRepairId = `finance-center:linked-repair:${battle.id}`;
    const unlinkedRepairId = `finance-center:unlinked-repair:${battle.id}`;
    const byeBreakdown = (financialEventId: string, amount: number): BattleIncomeBreakdown => ({
      ...battleBreakdown(financialEventId),
      finalAmount: amount,
      sourceEventId: `bye:${battle.id}:${financialEventId}`,
      isBye: true,
      battleId: battle.id,
    } as unknown as BattleIncomeBreakdown);

    try {
      await applyCreditMutation({
        cycleNumber: 0,
        userId: owner.userId,
        transactionType: 'battle_income',
        amount: 25,
        description: 'Owner-scoped stable bye award',
        financialEventId: ownerByeId,
        breakdown: byeBreakdown(ownerByeId, 25),
        timestamp: FIXTURE_TIMESTAMP,
      });
      await applyCreditMutation({
        cycleNumber: 0,
        userId: otherUser.userId,
        transactionType: 'battle_income',
        amount: 75,
        description: 'Other stable bye award',
        financialEventId: otherByeId,
        breakdown: byeBreakdown(otherByeId, 75),
        timestamp: FIXTURE_TIMESTAMP,
      });
      const linkedRepair = await applyCreditMutation({
        cycleNumber: 0,
        userId: owner.userId,
        robotId: owner.robotId,
        transactionType: 'repair_cost',
        amount: -5,
        description: 'Exactly linked repair evidence',
        financialEventId: linkedRepairId,
        breakdown: { ...repairBreakdown(linkedRepairId), robotId: owner.robotId },
        timestamp: FIXTURE_TIMESTAMP,
      });
      await withAuditSequence(linkedRepair.cycleNumber, 1, async (sequenceNumber, tx) => {
        await tx.auditLog.create({
          data: {
            cycleNumber: linkedRepair.cycleNumber,
            eventType: 'robot_repair',
            eventTimestamp: FIXTURE_TIMESTAMP,
            sequenceNumber,
            userId: owner.userId,
            robotId: owner.robotId,
            sourceEventId: linkedRepairId,
            payload: {
              creditsCharged: 5,
              repairType: 'automatic',
              sourceEventId: linkedRepairId,
            },
          },
        });
      });
      await applyCreditMutation({
        cycleNumber: 0,
        userId: owner.userId,
        robotId: owner.robotId,
        transactionType: 'repair_cost',
        amount: -5,
        description: 'Unlinked repair evidence',
        financialEventId: unlinkedRepairId,
        breakdown: { ...repairBreakdown(unlinkedRepairId), robotId: owner.robotId },
        timestamp: FIXTURE_TIMESTAMP,
      });

      const [summaryResponse, detailResponse] = await Promise.all([
        getRobotFinancialSummaries(owner.userId, { scope: 'current' }),
        request(app)
          .get(`/api/finances/robots/${owner.robotId}/events?scope=current&pageSize=7`)
          .set('Authorization', `Bearer ${owner.token}`),
      ]);

      expect(detailResponse.status).toBe(200);
      const summary = summaryResponse.data.find((item) => item.robotId === owner.robotId);
      expect(summary).toBeDefined();
      const expectedHeadline = {
        foughtMatches: 1,
        battleByeIncome: 125,
        streamingRevenue: 0,
        actualRepairSpend: 5,
        directNet: 120,
        fullPeriodTotal: 120,
      };
      expect(summary).toMatchObject(expectedHeadline);
      expect(detailResponse.body.data.robot).toMatchObject(expectedHeadline);
      expect(detailResponse.body.data.items).toEqual(expect.arrayContaining([
        expect.objectContaining({ eventKind: 'bye_income', amount: 25, fought: false }),
        expect.objectContaining({ eventKind: 'repair_cost', amount: -5, repairType: 'automatic' }),
      ]));
      expect(detailResponse.body.data.items.filter((item: { eventKind: string }) => item.eventKind === 'repair_cost')).toHaveLength(1);
      expect(summaryResponse.limitations).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'repair_link_mismatch' }),
      ]));
      expect(detailResponse.body.limitations).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'repair_link_mismatch' }),
      ]));
    } finally {
      const financialEventIds = [ownerByeId, otherByeId, linkedRepairId, unlinkedRepairId];
      await prisma.financialLedger.deleteMany({ where: { financialEventId: { in: financialEventIds } } });
      await prisma.auditLog.deleteMany({
        where: {
          OR: [
            { financialEventId: { in: financialEventIds } },
            { sourceEventId: { in: [linkedRepairId, unlinkedRepairId] } },
          ],
        },
      });
      await prisma.battle.delete({ where: { id: battle.id } });
      await prisma.user.update({ where: { id: owner.userId }, data: { currency: 1_100 } });
      await prisma.user.update({ where: { id: otherUser.userId }, data: { currency: 1_000 } });
    }
  });

  it('should exclude unconserved direct and stable battle awards from both robot resources', async () => {
    if (owner.battleId === null) throw new Error('Owner battle fixture is required');
    const directMismatchId = `battle:${owner.battleId}:finance-center:direct-mismatch:${owner.userId}`;
    const stableMismatchId = `battle:${owner.battleId}:finance-center:stable-mismatch:${owner.userId}`;
    const mismatchBreakdown = (financialEventId: string, amount: number): BattleIncomeBreakdown => ({
      ...battleBreakdown(financialEventId),
      finalAmount: amount,
      participationFloor: amount,
      battleId: owner.battleId ?? undefined,
    });

    try {
      await applyCreditMutation({
        cycleNumber: 0,
        userId: owner.userId,
        robotId: owner.robotId,
        transactionType: 'battle_income',
        amount: 11,
        description: 'Unconserved direct battle award',
        financialEventId: directMismatchId,
        breakdown: mismatchBreakdown(directMismatchId, 11),
        timestamp: FIXTURE_TIMESTAMP,
      });
      await applyCreditMutation({
        cycleNumber: 0,
        userId: owner.userId,
        transactionType: 'battle_income',
        amount: 12,
        description: 'Unconserved stable battle award',
        financialEventId: stableMismatchId,
        breakdown: mismatchBreakdown(stableMismatchId, 12),
        timestamp: FIXTURE_TIMESTAMP,
      });

      const [summaryResponse, detailResponse] = await Promise.all([
        getRobotFinancialSummaries(owner.userId, { scope: 'current' }),
        getRobotFinancialEvents(owner.userId, owner.robotId, { scope: 'current' }, 1, 20),
      ]);
      const summary = summaryResponse.data.find((item) => item.robotId === owner.robotId);
      const expectedHeadline = {
        foughtMatches: 1,
        battleByeIncome: FINANCE_AMOUNT,
        actualRepairSpend: 0,
        directNet: FINANCE_AMOUNT,
        fullPeriodTotal: FINANCE_AMOUNT,
      };

      expect(summary).toMatchObject(expectedHeadline);
      expect(detailResponse.data.robot).toMatchObject(expectedHeadline);
      expect(detailResponse.data.items).toHaveLength(1);
      expect(summaryResponse.limitations).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'battle_allocation_mismatch' }),
      ]));
      expect(detailResponse.limitations).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'battle_allocation_mismatch' }),
      ]));
    } finally {
      const financialEventIds = [directMismatchId, stableMismatchId];
      await prisma.financialLedger.deleteMany({ where: { financialEventId: { in: financialEventIds } } });
      await prisma.auditLog.deleteMany({ where: { financialEventId: { in: financialEventIds } } });
      await prisma.user.update({ where: { id: owner.userId }, data: { currency: 1_100 } });
    }
  });

  it('should exclude a paired record with malformed nested breakdown evidence', async () => {
    const corruptedEventId = `finance-center:malformed-inputs:${owner.userId}`;
    const validBreakdown = battleBreakdown(corruptedEventId);
    await applyCreditMutation({
      cycleNumber: 0,
      userId: owner.userId,
      robotId: owner.robotId,
      transactionType: 'battle_income',
      amount: 11,
      description: 'Malformed nested evidence regression',
      financialEventId: corruptedEventId,
      breakdown: { ...validBreakdown, finalAmount: 11 },
      timestamp: FIXTURE_TIMESTAMP,
    });
    await prisma.financialLedger.update({
      where: { financialEventId: corruptedEventId },
      data: { metadata: { ...validBreakdown, finalAmount: 11, inputs: [{}] } as unknown as Prisma.InputJsonValue },
    });

    try {
      const response = await request(app)
        .get(`/api/finances/robots/${owner.robotId}/events?scope=current&pageSize=8`)
        .set('Authorization', `Bearer ${owner.token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.items).not.toEqual(expect.arrayContaining([
        expect.objectContaining({ amount: 11 }),
      ]));
      expect(response.body.limitations).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'legacy_evidence' }),
      ]));
    } finally {
      await prisma.financialLedger.delete({ where: { financialEventId: corruptedEventId } });
      await prisma.auditLog.deleteMany({ where: { financialEventId: corruptedEventId } });
      await prisma.user.update({ where: { id: owner.userId }, data: { currency: 1_100 } });
    }
  });

  it('should produce the same opaque source reference in PostgreSQL for deterministic page ordering', async () => {
    const originalSecret = process.env.FINANCE_REPORT_REFERENCE_SECRET;
    const secret = 'finance-center-sql-parity-secret';
    const sourceIdentities = ['battle:42:stable:7:league_1v1', 'bye:雪:42'];
    process.env.FINANCE_REPORT_REFERENCE_SECRET = secret;
    try {
      const [migrationCapabilities] = await prisma.$queryRaw<Array<{ hasPgcrypto: boolean; validator: string | null }>>`
        SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') AS "hasPgcrypto",
          to_regprocedure('finance_report_breakdown_is_valid(jsonb,text)')::text AS "validator"
      `;
      expect(migrationCapabilities).toEqual({
        hasPgcrypto: true,
        validator: 'finance_report_breakdown_is_valid(jsonb,text)',
      });
      for (const sourceIdentity of sourceIdentities) {
        const [row] = await prisma.$queryRaw<Array<{ sourceReference: string }>>`
          SELECT finance_report_source_reference(${owner.userId}, ${8}, ${sourceIdentity}, ${secret}) AS "sourceReference"
        `;
        expect(row?.sourceReference).toBe(
          createPlayerSafeSourceReference(owner.userId, 8, sourceIdentity),
        );
      }
    } finally {
      if (originalSecret === undefined) delete process.env.FINANCE_REPORT_REFERENCE_SECRET;
      else process.env.FINANCE_REPORT_REFERENCE_SECRET = originalSecret;
    }
  });

  it('should deny another stable robot with the generic ownership response', async () => {
    const response = await request(app)
      .get(`/api/finances/robots/${otherUser.robotId}/events?scope=current`)
      .set('Authorization', `Bearer ${owner.token}`);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: 'Access denied', code: 'FORBIDDEN' });
  });
});
