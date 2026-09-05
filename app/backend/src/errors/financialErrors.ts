import { AppError } from './AppError';

export const FinancialErrorCode = {
  INVALID_TRANSACTION_TYPE: 'FINANCIAL_INVALID_TRANSACTION_TYPE',
  INVALID_BREAKDOWN: 'FINANCIAL_INVALID_BREAKDOWN',
  INVALID_EVENT_IDENTITY: 'FINANCIAL_INVALID_EVENT_IDENTITY',
  EVENT_CONFLICT: 'FINANCIAL_EVENT_CONFLICT',
  PRESTIGE_EVENT_CONFLICT: 'PRESTIGE_EVENT_CONFLICT',
  INVALID_PRESTIGE_BREAKDOWN: 'PRESTIGE_INVALID_BREAKDOWN',
  REQUIRED_CAPTURE_UNAVAILABLE: 'FINANCIAL_REQUIRED_CAPTURE_UNAVAILABLE',
  PAIR_MISSING: 'FINANCIAL_PAIR_MISSING',
  ROLLOUT_PHASE_BLOCKED: 'FINANCIAL_ROLLOUT_PHASE_BLOCKED',
} as const;

export type FinancialErrorCodeType = typeof FinancialErrorCode[keyof typeof FinancialErrorCode];

export class FinancialError extends AppError {
  constructor(
    code: FinancialErrorCodeType,
    message: string,
    statusCode = 400,
    details?: unknown,
  ) {
    super(code, message, statusCode, details);
    this.name = 'FinancialError';
  }
}
