import { createPlayerSafeSourceReference } from '../playerSafeSourceReference';

describe('Player-safe finance source references', () => {
  const originalSecret = process.env.FINANCE_REPORT_REFERENCE_SECRET;

  beforeEach(() => {
    process.env.FINANCE_REPORT_REFERENCE_SECRET = 'test-finance-reference-secret';
  });

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.FINANCE_REPORT_REFERENCE_SECRET;
    else process.env.FINANCE_REPORT_REFERENCE_SECRET = originalSecret;
  });

  it('should be stable, opaque, and scoped to the authenticated stable and season', () => {
    const source = 'battle:42:stable:7:league_1v1';
    const first = createPlayerSafeSourceReference(7, 3, source);

    expect(createPlayerSafeSourceReference(7, 3, source)).toBe(first);
    expect(createPlayerSafeSourceReference(8, 3, source)).not.toBe(first);
    expect(createPlayerSafeSourceReference(7, 4, source)).not.toBe(first);
    expect(first).toMatch(/^FIN-[A-Za-z0-9_-]{22}$/);
    expect(first).not.toContain('42');
    expect(first).not.toContain('battle');
  });
});
