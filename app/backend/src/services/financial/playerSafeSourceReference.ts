import { createHmac } from 'node:crypto';

const REFERENCE_PREFIX = 'FIN';

/**
 * Resolves the secret shared by the application HMAC and the bounded report
 * query. It is bound as a database parameter only, never stored or returned.
 */
export function getFinanceReportReferenceSecret(): string {
  const secret = process.env.FINANCE_REPORT_REFERENCE_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FINANCE_REPORT_REFERENCE_SECRET is required');
    }
    return 'development-finance-reference-secret';
  }
  return secret;
}

/**
 * Produce a stable, opaque display reference. It is scoped to one stable and
 * season, cannot be reversed to the internal identity, and is never accepted as
 * authorization or as an API lookup key.
 */
export function createPlayerSafeSourceReference(
  userId: number,
  seasonNumber: number,
  sourceIdentity: string,
): string {
  const digest = createHmac('sha256', getFinanceReportReferenceSecret())
    .update(`finance-report-v1\0${userId}\0${seasonNumber}\0${sourceIdentity}`)
    .digest('base64url')
    .slice(0, 22);
  return `${REFERENCE_PREFIX}-${digest}`;
}
