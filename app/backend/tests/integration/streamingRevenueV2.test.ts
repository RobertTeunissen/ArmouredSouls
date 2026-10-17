/**
 * Streaming revenue formula v2 (#524) against a real database.
 *
 * (a) The SQL report validator `finance_report_breakdown_is_valid` (migration
 *     20261017120000) accepts historical v1 rows and v2 rows, and rejects
 *     malformed v2 rows.
 * (b) A real 2-robot team award writes one ledger/audit pair per robot whose
 *     v2 metadata reconciles: totalRevenue = floor(revenueBeforeTeamShare / 2)
 *     = ledger amount, and the SQL validator accepts the stored metadata.
 * (c) A retry for an existing historical v1 event returns the stored amount and
 *     writes nothing; the stored metadata stays formulaVersion '1'.
 * (d) A bye awards nothing.
 */
import prisma from '../../src/lib/prisma';
import { awardStreamingRevenueForParticipant } from '../../src/services/battle/battlePostCombat';
import { applyCreditMutation } from '../../src/services/financial/creditMutationService';
import { buildStreamingEventId } from '../../src/services/financial/financialEventIdentity';
import type { StreamingRevenueBreakdownV1 } from '../../src/types';
import { createTestBattle, createTestRobot, createTestUser } from '../testHelpers';

function v1Breakdown(sourceEventId: string, battleId: number, robotId: number, mode: string, amount: number): StreamingRevenueBreakdownV1 {
  return {
    schemaVersion: 1,
    formula: 'streaming_revenue',
    formulaVersion: '1',
    inputs: [
      { name: 'robotBattles', value: 552, unit: 'battles', source: 'robot' },
      { name: 'robotFame', value: 10492, unit: 'fame', source: 'robot' },
      { name: 'studioLevel', value: 9, unit: 'levels', source: 'facility' },
    ],
    modifiers: [
      { name: 'battleMultiplier', value: 1.552, unit: 'multiplier', source: 'streaming_formula', applied: true },
      { name: 'fameMultiplier', value: 3.0984, unit: 'multiplier', source: 'streaming_formula', applied: true },
      { name: 'studioMultiplier', value: 10, unit: 'multiplier', source: 'streaming_formula', applied: true },
    ],
    rounding: {
      precision: 0,
      mode: 'floor',
      operationOrder: ['baseAmount', 'battleMultiplier', 'fameMultiplier', 'studioMultiplier', 'teamSize'],
      scope: 'per_item',
    },
    finalAmount: amount,
    sourceEventId,
    transactionType: 'streaming_revenue',
    battleId,
    robotId,
    mode,
    eligible: true,
    baseAmount: 1000,
    battleMultiplier: 1.552,
    fameMultiplier: 3.0984,
    studioMultiplier: 10,
    totalRevenue: amount,
  };
}

const V2_SAMPLE = {
  schemaVersion: 1,
  formula: 'streaming_revenue',
  formulaVersion: '2',
  inputs: [{ name: 'teamSize', value: 2, unit: 'robots', source: 'battle' }],
  modifiers: [{ name: 'teamSize', value: 2, unit: 'divisor', source: 'battle', applied: true }],
  rounding: { precision: 0, mode: 'floor', operationOrder: ['baseAmount', 'floor'], scope: 'per_item' },
  finalAmount: 6394,
  sourceEventId: 'streaming:sample',
  transactionType: 'streaming_revenue',
  battleId: 1,
  robotId: 1,
  mode: 'tag_team',
  eligible: true,
  baseAmount: 1000,
  battleContribution: 0.276,
  fameContribution: 1.0492,
  audienceMultiplier: 2.3252,
  studioMultiplier: 5.5,
  teamSize: 2,
  revenueBeforeTeamShare: 12788,
  totalRevenue: 6394,
};

async function sqlValid(metadata: unknown): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ valid: boolean }>>`
    SELECT finance_report_breakdown_is_valid(${JSON.stringify(metadata)}::jsonb, 'streaming_revenue') AS "valid"
  `;
  return rows[0].valid;
}

describe('Streaming revenue v2 (#524) — database', () => {
  const userIds: number[] = [];
  const battleIds: number[] = [];

  afterEach(async () => {
    if (userIds.length > 0) {
      await prisma.financialLedger.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } });
    }
    if (battleIds.length > 0) {
      await prisma.battleParticipant.deleteMany({ where: { battleId: { in: battleIds } } });
      await prisma.battle.deleteMany({ where: { id: { in: battleIds } } });
    }
    if (userIds.length > 0) {
      await prisma.facility.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.robot.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    userIds.length = 0;
    battleIds.length = 0;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('(a) SQL validator', () => {
    it('accepts a historical v1 row', async () => {
      expect(await sqlValid(v1Breakdown('streaming:v1', 1, 1, 'league_1v1', 48087))).toBe(true);
    });

    it('accepts a v2 row', async () => {
      expect(await sqlValid(V2_SAMPLE)).toBe(true);
    });

    it('rejects a v2 row without teamSize', async () => {
      const { teamSize: _omitted, ...missing } = V2_SAMPLE;
      expect(await sqlValid(missing)).toBe(false);
    });

    it('rejects v1 fields under formulaVersion 2', async () => {
      expect(await sqlValid({ ...v1Breakdown('streaming:v1', 1, 1, 'league_1v1', 48087), formulaVersion: '2' })).toBe(false);
    });
  });

  it('(b) a 2-robot team award stores reconciling v2 facts', async () => {
    const user = await createTestUser();
    userIds.push(user.id);
    await prisma.facility.create({
      data: { userId: user.id, facilityType: 'streaming_studio', level: 3, maxLevel: 10 },
    });
    const robotA = await createTestRobot(user.id);
    const robotB = await createTestRobot(user.id);
    // (552 battles, 10,492 fame, L3): (20000 + 5520 + 20984) × 5 / 40 = 232,520 / 40 → 5,813
    await prisma.robot.update({ where: { id: robotA.id }, data: { totalBattles: 552, fame: 10492 } });
    const battle = await createTestBattle({ robot1Id: robotA.id, robot2Id: robotB.id, battleType: 'tag_team' });
    battleIds.push(battle.id);

    const result = await awardStreamingRevenueForParticipant(robotA.id, user.id, battle.id, false, 2, 'tag_team');

    // floor(5,813 / 2) = 2,906
    expect(result?.revenueBeforeTeamShare).toBe(5813);
    expect(result?.teamSize).toBe(2);
    expect(result?.totalRevenue).toBe(2906);

    const ledger = await prisma.financialLedger.findUniqueOrThrow({
      where: { financialEventId: buildStreamingEventId(battle.id, robotA.id, 'tag_team') },
    });
    const metadata = ledger.metadata as unknown as Record<string, unknown>;
    expect(ledger.amount).toBe(2906);
    expect(metadata.formulaVersion).toBe('2');
    expect(metadata.teamSize).toBe(2);
    expect(metadata.revenueBeforeTeamShare).toBe(5813);
    expect(metadata.totalRevenue).toBe(2906);
    expect(metadata.finalAmount).toBe(2906);
    expect(metadata.totalRevenue).toBe(Math.floor((metadata.revenueBeforeTeamShare as number) / 2));
    expect(await sqlValid(ledger.metadata)).toBe(true);

    const audits = await prisma.auditLog.count({
      where: { userId: user.id, eventType: 'financial_transaction' },
    });
    expect(audits).toBe(1);

    const participant = await prisma.battleParticipant.findUniqueOrThrow({
      where: { battleId_robotId: { battleId: battle.id, robotId: robotA.id } },
    });
    expect(participant.streamingRevenue).toBe(2906);
  });

  it('(c) a retry for a historical v1 event returns the stored amount and writes nothing', async () => {
    const user = await createTestUser();
    userIds.push(user.id);
    const robotA = await createTestRobot(user.id);
    const robotB = await createTestRobot(user.id);
    const battle = await createTestBattle({ robot1Id: robotA.id, robot2Id: robotB.id, battleType: 'league' });
    battleIds.push(battle.id);

    const mode = 'league_1v1';
    const financialEventId = buildStreamingEventId(battle.id, robotA.id, mode);
    await applyCreditMutation({
      cycleNumber: 0,
      userId: user.id,
      robotId: robotA.id,
      transactionType: 'streaming_revenue',
      amount: 48087,
      description: `Streaming Studio revenue for robot ${robotA.id}`,
      financialEventId,
      breakdown: v1Breakdown(financialEventId, battle.id, robotA.id, mode, 48087),
    });
    const ledgerCountBefore = await prisma.financialLedger.count({ where: { userId: user.id } });

    const result = await awardStreamingRevenueForParticipant(robotA.id, user.id, battle.id, false, 1, mode);

    expect(result?.totalRevenue).toBe(48087);
    expect(await prisma.financialLedger.count({ where: { userId: user.id } })).toBe(ledgerCountBefore);
    const stored = await prisma.financialLedger.findUniqueOrThrow({ where: { financialEventId } });
    expect(stored.amount).toBe(48087);
    expect((stored.metadata as unknown as Record<string, unknown>).formulaVersion).toBe('1');
    const participant = await prisma.battleParticipant.findUniqueOrThrow({
      where: { battleId_robotId: { battleId: battle.id, robotId: robotA.id } },
    });
    expect(participant.streamingRevenue).toBe(48087);
  });

  it('(d) a bye awards nothing', async () => {
    const user = await createTestUser();
    userIds.push(user.id);
    const robotA = await createTestRobot(user.id);
    const robotB = await createTestRobot(user.id);
    const battle = await createTestBattle({ robot1Id: robotA.id, robot2Id: robotB.id, battleType: 'league' });
    battleIds.push(battle.id);

    const result = await awardStreamingRevenueForParticipant(robotA.id, user.id, battle.id, true, 1, 'league_1v1');

    expect(result).toBeNull();
    expect(await prisma.financialLedger.count({ where: { userId: user.id } })).toBe(0);
  });
});
