import type { FinancialInput, FinancialModifier, FinancialRounding } from './financialTypes';

export type PrestigeAwardSource = 'battle' | 'achievement';

export interface PrestigeAwardBreakdown {
  schemaVersion: 1;
  formula: string;
  formulaVersion: string;
  inputs: readonly FinancialInput[];
  modifiers: readonly FinancialModifier[];
  rounding: FinancialRounding;
  sourceEventId: string;
  source: PrestigeAwardSource;
  awardAmount: number;
  mode: string | null;
  battleId: number | string | null;
  achievementId: number | string | null;
}

export interface PrestigeAuditPayload {
  eventTimestamp: string;
  cycleNumber: number;
  userId: number;
  amount: number;
  source: PrestigeAwardSource;
  sourceEventId: string;
  mode: string | null;
  battleId: number | string | null;
  achievementId: number | string | null;
  resultingPrestige: number;
  breakdown: PrestigeAwardBreakdown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isInputValue(value: unknown): boolean {
  return value === null || typeof value === 'string' || typeof value === 'boolean' || isFiniteNumber(value);
}

/** Validate the typed payload stored on a prestige_change AuditLog row. */
export function validatePrestigeAwardBreakdown(value: unknown): value is PrestigeAwardBreakdown {
  if (!isRecord(value)) return false;
  if (value.schemaVersion !== 1 || typeof value.formula !== 'string' || value.formula.length === 0) return false;
  if (typeof value.formulaVersion !== 'string' || value.formulaVersion.length === 0) return false;
  if (typeof value.sourceEventId !== 'string' || value.sourceEventId.length === 0) return false;
  if (value.source !== 'battle' && value.source !== 'achievement') return false;
  const awardAmount = value.awardAmount;
  if (!isFiniteNumber(awardAmount) || !Number.isInteger(awardAmount) || awardAmount <= 0) return false;
  if (value.mode !== null && typeof value.mode !== 'string') return false;
  if (value.battleId !== null && typeof value.battleId !== 'string' && !isFiniteNumber(value.battleId)) return false;
  if (value.achievementId !== null && typeof value.achievementId !== 'string' && !isFiniteNumber(value.achievementId)) return false;
  if (!Array.isArray(value.inputs) || !Array.isArray(value.modifiers)) return false;
  const rounding = value.rounding;
  if (!isRecord(rounding)) return false;
  if (!value.inputs.every((input) => {
    if (!isRecord(input)) return false;
    return typeof input.name === 'string'
      && input.name.length > 0
      && isInputValue(input.value)
      && typeof input.unit === 'string'
      && input.unit.length > 0
      && typeof input.source === 'string'
      && input.source.length > 0;
  })) return false;
  if (!value.modifiers.every((modifier) => {
    if (!isRecord(modifier)) return false;
    return typeof modifier.name === 'string'
      && modifier.name.length > 0
      && isFiniteNumber(modifier.value)
      && typeof modifier.unit === 'string'
      && modifier.unit.length > 0
      && typeof modifier.source === 'string'
      && modifier.source.length > 0
      && typeof modifier.applied === 'boolean';
  })) return false;
  return isFiniteNumber(rounding.precision)
    && Number.isInteger(rounding.precision)
    && rounding.precision >= 0
    && typeof rounding.mode === 'string'
    && ['none', 'round', 'floor', 'ceil', 'trunc'].includes(rounding.mode)
    && Array.isArray(rounding.operationOrder)
    && rounding.operationOrder.every((step) => typeof step === 'string' && step.length > 0)
    && ['per_item', 'aggregate'].includes(String(rounding.scope));
}
