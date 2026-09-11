type MetadataState = {
  totalCycles: number;
  featureFlags: unknown;
  lastCycleAt?: Date;
};

type SeasonState = {
  seasonNumber: number;
  phase: string;
  competitiveCyclesCompleted: number;
  preparationCyclesCompleted: number;
  startedAt: Date;
} | null;

const state: { metadata: MetadataState | null; season: SeasonState } = {
  metadata: null,
  season: null,
};

const mockUserFindFirst = jest.fn();

const mockTx = {
  $executeRaw: jest.fn().mockResolvedValue(0),
  cycleMetadata: {
    findUnique: jest.fn(async () => state.metadata),
    create: jest.fn(async () => {
      state.metadata = { totalCycles: 0, featureFlags: {} };
      return state.metadata;
    }),
    update: jest.fn(async ({ data }: { data: Partial<MetadataState> }) => {
      if (!state.metadata) throw new Error('Cycle metadata must exist before update');
      state.metadata = { ...state.metadata, ...data };
      return state.metadata;
    }),
  },
  user: {
    findFirst: mockUserFindFirst,
  },
  season: {
    findFirst: jest.fn(async () => state.season),
  },
};

const mockPrisma = {
  cycleMetadata: mockTx.cycleMetadata,
  $transaction: jest.fn(async (callback: (tx: typeof mockTx) => Promise<unknown>) => callback(mockTx)),
};

jest.mock('../../../lib/prisma', () => ({ __esModule: true, default: mockPrisma }));

import {
  abortSerializedCycleCutover,
  beginSerializedCycleCutover,
  completeSerializedCycleCutover,
  FinancialCycleCutoverInProgressError,
  getSerializedCycleCutoverUserIdWatermark,
  resolveCanonicalCycleIdentity,
  resolveFinancialWriteCycle,
} from '../canonicalCycleIdentity';

function setMetadata(totalCycles: number, featureFlags: unknown = {}): void {
  state.metadata = { totalCycles, featureFlags };
}

function setPreparationSeason(): Date {
  const startedAt = new Date('2026-08-01T00:00:00.000Z');
  state.season = {
    seasonNumber: 3,
    phase: 'preparation',
    competitiveCyclesCompleted: 0,
    preparationCyclesCompleted: 1,
    startedAt,
  };
  return startedAt;
}

describe('canonical cycle identity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    state.metadata = null;
    state.season = null;
    mockUserFindFirst.mockResolvedValue({ id: 42 });
  });

  it('should derive the active cycle as totalCycles plus one', async () => {
    setMetadata(14);

    const identity = await resolveCanonicalCycleIdentity(mockTx as never);

    expect(identity.completedCycles).toBe(14);
    expect(identity.activeCycle).toBe(15);
  });

  it('should expose preparation Cycle 1 metadata without advancing financial completion', async () => {
    setMetadata(0);
    const startedAt = setPreparationSeason();

    const identity = await resolveCanonicalCycleIdentity(mockTx as never);

    expect(identity).toMatchObject({
      completedCycles: 0,
      activeCycle: 1,
      seasonNumber: 3,
      phase: 'preparation',
      competitiveCyclesCompleted: 0,
      preparationCyclesCompleted: 1,
      seasonStartedAt: startedAt,
      isClosing: false,
      closingCycle: null,
    });
  });

  it('should fail closed for ordinary writers during a cutover and allow a retry after completion', async () => {
    setMetadata(7, {
      finance_cycle_closing: true,
      finance_cycle_closing_number: 8,
    });

    await expect(resolveFinancialWriteCycle(mockTx as never)).rejects.toEqual(
      expect.objectContaining({
        name: 'FinancialCycleCutoverInProgressError',
        closingCycle: 8,
      }),
    );
    await expect(resolveFinancialWriteCycle(mockTx as never, { allowClosingCycle: true })).resolves.toBe(8);

    const completedAt = new Date('2026-08-02T00:00:00.000Z');
    await completeSerializedCycleCutover(8, completedAt);

    expect(mockTx.cycleMetadata.update).toHaveBeenLastCalledWith({
      where: { id: 1 },
      data: {
        totalCycles: 8,
        lastCycleAt: completedAt,
        featureFlags: {},
      },
    });
    await expect(resolveFinancialWriteCycle(mockTx as never)).resolves.toBe(9);
    expect(mockTx.$executeRaw).toHaveBeenCalled();
  });

  it('should identify the error type emitted to a blocked financial writer', async () => {
    setMetadata(3, {
      finance_cycle_closing: true,
      finance_cycle_closing_number: 4,
    });

    await expect(resolveFinancialWriteCycle(mockTx as never)).rejects.toBeInstanceOf(
      FinancialCycleCutoverInProgressError,
    );
  });

  it('should place a claimed cutover marker in metadata feature flags without advancing completion', async () => {
    setMetadata(4, { retained_flag: 'preserve me' });

    await expect(beginSerializedCycleCutover()).resolves.toBe(5);

    expect(mockTx.cycleMetadata.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        featureFlags: {
          retained_flag: 'preserve me',
          finance_cycle_closing: true,
          finance_cycle_closing_number: 5,
          finance_cycle_closing_user_watermark: 42,
        },
      },
    });
    expect(state.metadata).toEqual({
      totalCycles: 4,
      featureFlags: {
        retained_flag: 'preserve me',
        finance_cycle_closing: true,
        finance_cycle_closing_number: 5,
        finance_cycle_closing_user_watermark: 42,
      },
    });
  });

  it('should reject a competing closer before it can write duplicate close evidence', async () => {
    setMetadata(4, {
      finance_cycle_closing: true,
      finance_cycle_closing_number: 5,
    });

    await expect(beginSerializedCycleCutover()).rejects.toBeInstanceOf(
      FinancialCycleCutoverInProgressError,
    );
    expect(mockTx.cycleMetadata.update).not.toHaveBeenCalled();
  });

  it('should reuse the durable cycle identity when explicitly resuming after process exit', async () => {
    setMetadata(4, {
      finance_cycle_closing: true,
      finance_cycle_closing_number: 5,
      finance_cycle_closing_user_watermark: 42,
    });

    await expect(beginSerializedCycleCutover({ resumeExisting: true })).resolves.toBe(5);
    expect(mockTx.cycleMetadata.update).not.toHaveBeenCalled();
  });

  it('should preserve the original user watermark when later registrations exist on resume', async () => {
    setMetadata(4);
    await beginSerializedCycleCutover();
    mockUserFindFirst.mockResolvedValue({ id: 99 });

    await expect(beginSerializedCycleCutover({ resumeExisting: true })).resolves.toBe(5);
    await expect(getSerializedCycleCutoverUserIdWatermark(5)).resolves.toBe(42);
  });

  it('should clear only matching cutover flags without advancing completion when aborting', async () => {
    setMetadata(4, {
      retained_flag: 'preserve me',
      finance_cycle_closing: true,
      finance_cycle_closing_number: 5,
    });

    await abortSerializedCycleCutover(5);

    expect(mockTx.cycleMetadata.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { featureFlags: { retained_flag: 'preserve me' } },
    });
    expect(state.metadata).toEqual({
      totalCycles: 4,
      featureFlags: { retained_flag: 'preserve me' },
    });
  });
});
