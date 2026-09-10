import { z } from 'zod';

export const MAX_FINANCE_REPORT_RANGE = 100;
export const MAX_FINANCE_EVENT_PAGE_SIZE = 100;

const presetScopeSchema = z.enum(
  ['current', 'last_completed', 'last_seven', 'season_to_date'],
  { message: 'Scope must be current, last_completed, last_seven, or season_to_date' },
);
const cycleField = (field: string) => z.coerce.number({ message: `${field} must be a number` })
  .int(`${field} must be a whole number`)
  .positive(`${field} must be a positive cycle number`);

export const financeReportPeriodQuerySchema = z.object({
  scope: presetScopeSchema.optional(),
  fromCycle: cycleField('From cycle').optional(),
  toCycle: cycleField('To cycle').optional(),
}).superRefine((value, context) => {
  const hasRangeField = value.fromCycle !== undefined || value.toCycle !== undefined;
  if (value.scope !== undefined && hasRangeField) {
    context.addIssue({ code: 'custom', path: ['scope'], message: 'Scope cannot be combined with a cycle range' });
  }
  if (value.scope === undefined && !hasRangeField) {
    context.addIssue({ code: 'custom', path: ['scope'], message: 'Scope or a complete cycle range is required' });
  }
  if (hasRangeField && value.fromCycle === undefined) {
    context.addIssue({ code: 'custom', path: ['fromCycle'], message: 'From cycle is required for a custom range' });
  }
  if (hasRangeField && value.toCycle === undefined) {
    context.addIssue({ code: 'custom', path: ['toCycle'], message: 'To cycle is required for a custom range' });
  }
  if (value.fromCycle !== undefined && value.toCycle !== undefined) {
    if (value.fromCycle > value.toCycle) {
      context.addIssue({ code: 'custom', path: ['fromCycle'], message: 'From cycle must not be after to cycle' });
    }
    if (value.toCycle - value.fromCycle + 1 > MAX_FINANCE_REPORT_RANGE) {
      context.addIssue({ code: 'custom', path: ['toCycle'], message: `Cycle range cannot exceed ${MAX_FINANCE_REPORT_RANGE} cycles` });
    }
  }
});

export const financeRobotDetailParamsSchema = z.object({
  robotId: z.coerce.number({ message: 'Robot id must be a number' })
    .int('Robot id must be a whole number')
    .positive('Robot id must be positive'),
});

export const financeRobotEventsQuerySchema = z.object({
  scope: presetScopeSchema.optional(),
  fromCycle: cycleField('From cycle').optional(),
  toCycle: cycleField('To cycle').optional(),
  page: z.coerce.number({ message: 'Page must be a number' })
    .int('Page must be a whole number')
    .positive('Page must be positive')
    .default(1),
  pageSize: z.coerce.number({ message: 'Page size must be a number' })
    .int('Page size must be a whole number')
    .min(1, 'Page size must be at least 1')
    .max(MAX_FINANCE_EVENT_PAGE_SIZE, `Page size cannot exceed ${MAX_FINANCE_EVENT_PAGE_SIZE}`)
    .default(20),
}).superRefine((value, context) => {
  const result = financeReportPeriodQuerySchema.safeParse({
    scope: value.scope,
    fromCycle: value.fromCycle,
    toCycle: value.toCycle,
  });
  if (!result.success) {
    for (const issue of result.error.issues) {
      context.addIssue({ code: 'custom', path: issue.path, message: issue.message });
    }
  }
});

export type FinanceReportPeriodQuery = z.infer<typeof financeReportPeriodQuerySchema>;
export type FinanceRobotEventsQuery = z.infer<typeof financeRobotEventsQuerySchema>;
