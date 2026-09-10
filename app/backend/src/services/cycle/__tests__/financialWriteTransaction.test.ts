const mockTransaction = jest.fn();
const mockResolveFinancialWriteCycle = jest.fn();

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: { $transaction: (...args: unknown[]) => mockTransaction(...args) },
}));

jest.mock('../canonicalCycleIdentity', () => ({
  ...jest.requireActual('../canonicalCycleIdentity'),
  resolveFinancialWriteCycle: (...args: unknown[]) => mockResolveFinancialWriteCycle(...args),
}));

import { FinancialErrorCode } from '../../../errors';
import { FinancialCycleCutoverInProgressError } from '../canonicalCycleIdentity';
import { runFinancialWriteTransaction } from '../financialWriteTransaction';

describe('runFinancialWriteTransaction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should delay only after the failed transaction has rolled back and then retry the whole operation', async () => {
    let transactionActive = false;
    let operationAttempts = 0;
    const delay = jest.fn(async () => {
      expect(transactionActive).toBe(false);
    });
    mockResolveFinancialWriteCycle
      .mockRejectedValueOnce(new FinancialCycleCutoverInProgressError(8))
      .mockResolvedValueOnce(9);
    mockTransaction.mockImplementation(async (operation: (tx: object) => Promise<string>) => {
      transactionActive = true;
      try {
        return await operation({ attempt: mockTransaction.mock.calls.length });
      } finally {
        transactionActive = false;
      }
    });

    const result = await runFinancialWriteTransaction(
      async (_tx, cycleNumber) => {
        operationAttempts += 1;
        expect(cycleNumber).toBe(9);
        return 'committed';
      },
      { timeout: 30_000 },
      { maxAttempts: 3, delayMs: 500, delay },
    );

    expect(result).toBe('committed');
    expect(operationAttempts).toBe(1);
    expect(mockTransaction).toHaveBeenCalledTimes(2);
    expect(mockResolveFinancialWriteCycle).toHaveBeenCalledTimes(2);
    expect(delay).toHaveBeenCalledWith(500);
    expect(delay).toHaveBeenCalledTimes(1);
  });

  it('should return a typed 503 after the bounded retry policy is exhausted', async () => {
    const delay = jest.fn().mockResolvedValue(undefined);
    const operation = jest.fn();
    mockResolveFinancialWriteCycle.mockRejectedValue(
      new FinancialCycleCutoverInProgressError(12),
    );
    mockTransaction.mockImplementation(
      async (transaction: (tx: object) => Promise<unknown>) => transaction({}),
    );

    await expect(runFinancialWriteTransaction(
      operation,
      {},
      { maxAttempts: 2, delayMs: 1, delay },
    )).rejects.toMatchObject({
      code: FinancialErrorCode.CYCLE_CUTOVER_TIMEOUT,
      statusCode: 503,
      message: 'Financial cycle transition is still in progress; retry shortly',
      details: { attempts: 2, closingCycle: 12 },
    });
    expect(operation).not.toHaveBeenCalled();
    expect(mockTransaction).toHaveBeenCalledTimes(2);
    expect(delay).toHaveBeenCalledTimes(1);
  });

  it('should not retry unrelated transaction failures', async () => {
    const failure = new Error('domain failure');
    mockResolveFinancialWriteCycle.mockResolvedValue(4);
    mockTransaction.mockImplementation(
      async (transaction: (tx: object) => Promise<unknown>) => transaction({}),
    );

    await expect(runFinancialWriteTransaction(async () => { throw failure; })).rejects.toBe(failure);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });
});
