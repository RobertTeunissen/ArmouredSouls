import {
  financeReportPeriodQuerySchema,
  financeRobotDetailParamsSchema,
  financeRobotEventsQuerySchema,
} from '../src/schemas/financeReportSchemas';

describe('Finance Center report schemas', () => {
  it('should accept exactly one named period scope', () => {
    expect(financeReportPeriodQuerySchema.safeParse({ scope: 'season_to_date' }).success).toBe(true);
  });

  it('should coerce and accept an ordered bounded completed range', () => {
    const result = financeReportPeriodQuerySchema.safeParse({ fromCycle: '3', toCycle: '12' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ fromCycle: 3, toCycle: 12 });
  });

  it('should reject a scope combined with a range', () => {
    const result = financeReportPeriodQuerySchema.safeParse({ scope: 'current', fromCycle: 1, toCycle: 1 });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toContain('Scope');
  });

  it('should require both bounds for a custom range', () => {
    const result = financeReportPeriodQuerySchema.safeParse({ fromCycle: 1 });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((issue) => issue.message.includes('To cycle is required'))).toBe(true);
  });

  it('should reject a range larger than one hundred cycles', () => {
    expect(financeReportPeriodQuerySchema.safeParse({ fromCycle: 1, toCycle: 101 }).success).toBe(false);
  });

  it('should apply bounded deterministic detail pagination defaults', () => {
    const query = financeRobotEventsQuerySchema.safeParse({ scope: 'current' });
    expect(query.success).toBe(true);
    if (query.success) expect(query.data).toMatchObject({ page: 1, pageSize: 20 });
    expect(financeRobotEventsQuerySchema.safeParse({ scope: 'current', pageSize: 101 }).success).toBe(false);
    expect(financeRobotDetailParamsSchema.safeParse({ robotId: '7' }).data).toEqual({ robotId: 7 });
  });
});
