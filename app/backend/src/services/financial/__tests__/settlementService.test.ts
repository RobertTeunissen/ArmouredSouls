import type { CreditMutationInput } from '../creditMutationService';

const mockApplyInTransaction = jest.fn();
const mockLogSettlementComponent = jest.fn().mockResolvedValue(undefined);
const mockTransaction = jest.fn();
const mockUserFindMany = jest.fn();
const mockFacilityFindMany = jest.fn();
const mockRobotFindMany = jest.fn();

const mockPrisma = {
  user: { findMany: mockUserFindMany },
  facility: { findMany: mockFacilityFindMany },
  robot: { findMany: mockRobotFindMany },
  $transaction: mockTransaction,
};

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock('../../common/eventLogger', () => ({
  eventLogger: {
    logSettlementComponentInTransaction: mockLogSettlementComponent,
  },
}));

jest.mock('../creditMutationService', () => ({
  creditMutationService: {
    applyInTransaction: mockApplyInTransaction,
  },
}));

import {
  calculateSettlementFacts,
  settleCycle,
} from '../settlementService';

const user = {
  id: 7,
  username: 'stable-seven',
  role: 'user',
  currency: 100000,
  prestige: 10000,
};

const facilities = [
  { userId: 7, facilityType: 'merchandising_hub', level: 1 },
  { userId: 7, facilityType: 'roster_expansion', level: 1 },
  { userId: 7, facilityType: 'streaming_studio', level: 2 },
];

const robots = [
  {
    userId: 7,
    totalBattles: 12,
    fame: 40,
    currentHP: 90,
    maxHP: 100,
    repairQuoteCredits: 125,
  },
  {
    userId: 7,
    totalBattles: 8,
    fame: 20,
    currentHP: 100,
    maxHP: 100,
    repairQuoteCredits: 0,
  },
];

function mutationResult(input: CreditMutationInput, balanceBefore: number, created = true) {
  return {
    created,
    financialEventId: input.financialEventId,
    ledgerId: 1,
    auditLogId: 1n,
    userId: input.userId,
    robotId: null,
    cycleNumber: input.cycleNumber,
    transactionType: input.transactionType,
    amount: input.amount,
    balanceBefore,
    balanceAfter: balanceBefore + input.amount,
  };
}

describe('Settlement_Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserFindMany.mockResolvedValue([user]);
    mockFacilityFindMany.mockResolvedValue(facilities);
    mockRobotFindMany.mockResolvedValue(robots);
    mockTransaction.mockImplementation(async (callback: (tx: object) => Promise<void>) => callback({}));

    let balance = user.currency;
    mockApplyInTransaction.mockImplementation(async (_tx: object, input: CreditMutationInput) => {
      const result = mutationResult(input, balance);
      balance = result.balanceAfter;
      return result;
    });
  });

  it('should use the normalized merchandising formula and every operating-cost component', () => {
    const facts = calculateSettlementFacts(user, facilities, robots);

    expect(facts.passiveIncome).toBe(15000);
    expect(facts.rosterCapacity).toBe(2);
    expect(facts.prestigePerSlot).toBe(5000);
    expect(facts.operatingCosts).toBe(900);
    expect(facts.operatingCostComponents).toEqual([
      expect.objectContaining({ facilityType: 'merchandising_hub', cost: 200 }),
      expect.objectContaining({ facilityType: 'streaming_studio', cost: 200 }),
      expect.objectContaining({ facilityType: 'roster_expansion', cost: 500 }),
    ]);
    expect(facts.repairQuoteTotal).toBe(125);
    expect(facts.totalBattles).toBe(20);
    expect(facts.totalFame).toBe(60);
  });

  it('should write both positive and negative components, including a zero component, with deterministic identities', async () => {
    const result = await settleCycle({ cycleNumber: 12 });

    expect(result).toMatchObject({
      cycleNumber: 12,
      usersProcessed: 1,
      totalPassiveIncome: 15000,
      totalOperatingCosts: 900,
    });
    expect(mockApplyInTransaction).toHaveBeenCalledTimes(2);
    expect(mockApplyInTransaction.mock.calls.map((call) => call[1].amount)).toEqual([15000, -900]);
    expect(mockApplyInTransaction.mock.calls.map((call) => call[1].financialEventId)).toEqual([
      'settlement:7:12:passive_income',
      'settlement:7:12:operating_costs',
    ]);
    expect(mockLogSettlementComponent).toHaveBeenCalledTimes(2);
    expect(result.components[0]).toMatchObject({
      passiveIncome: { balanceBefore: 100000, balanceAfter: 115000, created: true },
      operatingCosts: { balanceBefore: 115000, balanceAfter: 114100, created: true },
    });
  });

  it('should preserve unchanged balance for zero passive income and zero operating costs', async () => {
    mockFacilityFindMany.mockResolvedValue([]);
    mockRobotFindMany.mockResolvedValue([]);
    mockUserFindMany.mockResolvedValue([{ ...user, prestige: 0 }]);

    const result = await settleCycle({ cycleNumber: 13 });

    expect(mockApplyInTransaction.mock.calls.map((call) => call[1].amount)).toEqual([0, 0]);
    expect(result.totalPassiveIncome).toBe(0);
    expect(result.totalOperatingCosts).toBe(0);
    expect(result.components[0]).toMatchObject({
      passiveIncome: { amount: 0, balanceBefore: 100000, balanceAfter: 100000 },
      operatingCosts: { amount: 0, balanceBefore: 100000, balanceAfter: 100000 },
    });
    expect(result.summaries[0].endingBalance).toBe(100000);
  });

  it('should let a component failure roll back the enclosing transaction', async () => {
    mockApplyInTransaction
      .mockResolvedValueOnce(mutationResult({
        cycleNumber: 14,
        userId: 7,
        transactionType: 'passive_income',
        amount: 15000,
        description: 'Settlement passive income for cycle 14',
        financialEventId: 'settlement:7:14:passive_income',
        breakdown: {} as never,
      }, 100000))
      .mockRejectedValueOnce(new Error('operating pair unavailable'));

    await expect(settleCycle({ cycleNumber: 14 })).rejects.toThrow('operating pair unavailable');
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockLogSettlementComponent).not.toHaveBeenCalled();
  });

  it('should use the same component identities on a rerun so Credit_Mutation_Service suppresses duplicates', async () => {
    await settleCycle({ cycleNumber: 15 });
    await settleCycle({ cycleNumber: 15 });

    expect(mockApplyInTransaction.mock.calls.map((call) => call[1].financialEventId)).toEqual([
      'settlement:7:15:passive_income',
      'settlement:7:15:operating_costs',
      'settlement:7:15:passive_income',
      'settlement:7:15:operating_costs',
    ]);
  });
});
