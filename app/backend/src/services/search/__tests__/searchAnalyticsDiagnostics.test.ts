const mockLogger = {
  warn: jest.fn(),
};

jest.mock('../../../config/logger', () => ({
  __esModule: true,
  default: mockLogger,
}));

import {
  createSearchPersistenceFailureDiagnostic,
  logSearchPersistenceFailure,
  SEARCH_PERSISTENCE_FAILURE_OPERATION_CODE,
} from '../searchAnalyticsDiagnostics';

describe('search analytics persistence diagnostics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('emits only safe server context and bounded result counts', () => {
    logSearchPersistenceFailure({
      userId: 42,
      eventTimestamp: new Date('2026-08-10T12:34:56.000Z'),
      seasonNumber: 3,
      cycleNumber: 17,
      resultCounts: { robots: 2, stables: 1, guide: 4, total: 7 },
    });

    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Search analytics persistence failure',
      {
        operationCode: SEARCH_PERSISTENCE_FAILURE_OPERATION_CODE,
        eventTimestamp: '2026-08-10T12:34:56.000Z',
        seasonNumber: 3,
        cycleNumber: 17,
        userId: 42,
        resultCounts: { robots: 2, stables: 1, guide: 4, total: 7 },
      },
    );
  });

  it('does not copy forbidden query, request, token, response, error, or audit fields', () => {
    const context = {
      userId: 42,
      eventTimestamp: '2026-08-10T12:34:56.000Z',
      seasonNumber: 3,
      cycleNumber: 17,
      resultCounts: { robots: 2, stables: 1, guide: 4, total: 7 },
      rawQuery: 'secret phrase',
      normalizedPhrase: 'secret phrase',
      requestUrl: '/api/search?q=secret%20phrase',
      token: 'secret-token',
      response: { robots: [{ id: 1, label: 'private response' }] },
      auditPayload: { payload: 'private audit data' },
      error: new Error('database failed for secret phrase'),
    } as Parameters<typeof createSearchPersistenceFailureDiagnostic>[0] & Record<string, unknown>;

    const diagnostic = createSearchPersistenceFailureDiagnostic(context);

    expect(diagnostic).toEqual({
      operationCode: SEARCH_PERSISTENCE_FAILURE_OPERATION_CODE,
      eventTimestamp: '2026-08-10T12:34:56.000Z',
      seasonNumber: 3,
      cycleNumber: 17,
      userId: 42,
      resultCounts: { robots: 2, stables: 1, guide: 4, total: 7 },
    });
    expect(JSON.stringify(diagnostic)).not.toContain('secret phrase');
    expect(JSON.stringify(diagnostic)).not.toContain('secret-token');
    expect(JSON.stringify(diagnostic)).not.toContain('private response');
    expect(JSON.stringify(diagnostic)).not.toContain('private audit data');
  });

  it('omits invalid optional context and normalizes invalid counts without throwing', () => {
    const diagnostic = createSearchPersistenceFailureDiagnostic({
      userId: Number.NaN,
      eventTimestamp: 'not-a-timestamp',
      seasonNumber: Number.POSITIVE_INFINITY,
      cycleNumber: 2.5,
      resultCounts: {
        robots: -1,
        stables: Number.NaN,
        guide: Number.POSITIVE_INFINITY,
        total: 3,
      },
    });

    expect(diagnostic).toEqual({
      operationCode: SEARCH_PERSISTENCE_FAILURE_OPERATION_CODE,
      userId: 0,
      resultCounts: { robots: 0, stables: 0, guide: 0, total: 3 },
    });
  });
});
