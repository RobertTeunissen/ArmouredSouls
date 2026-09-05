import { FinancialError, FinancialErrorCode } from '../../errors';

function component(value: string | number, label: string): string {
  const text = String(value);
  if (text.length === 0 || text.includes(':')) {
    throw new FinancialError(
      FinancialErrorCode.INVALID_EVENT_IDENTITY,
      `${label} must be a non-empty value without ':'`,
    );
  }
  return text;
}

function identity(parts: readonly (string | number)[]): string {
  const value = parts.join(':');
  if (value.length > 191) {
    throw new FinancialError(FinancialErrorCode.INVALID_EVENT_IDENTITY, 'Financial event identity is too long');
  }
  return value;
}

export function buildBattleIncomeEventId(
  battleId: string | number,
  stableId: number,
  mode: string,
): string {
  return identity([
    'battle',
    component(battleId, 'battleId'),
    component(stableId, 'stableId'),
    component(mode, 'mode'),
    'battle_income',
  ]);
}

export function buildByeBattleIncomeEventId(
  scheduledMatchId: string | number,
  stableId: number,
  mode: string,
): string {
  return identity([
    'bye',
    component(scheduledMatchId, 'scheduledMatchId'),
    component(stableId, 'stableId'),
    component(mode, 'mode'),
    'battle_income',
  ]);
}

export function buildStreamingEventId(
  battleId: string | number,
  robotId: number,
  mode: string,
): string {
  return identity([
    'streaming',
    component(battleId, 'battleId'),
    component(robotId, 'robotId'),
    component(mode, 'mode'),
    'streaming_revenue',
  ]);
}

export function buildAchievementRewardEventId(
  unlockId: string | number,
  userId: number,
): string {
  return identity([
    'achievement',
    component(unlockId, 'unlockId'),
    component(userId, 'userId'),
    'achievement_reward',
  ]);
}

export function buildRepairEventId(
  operationId: string | number,
  robotId: number,
  repairType: 'manual' | 'automatic',
): string {
  return identity([
    'repair',
    component(operationId, 'operationId'),
    component(robotId, 'robotId'),
    component(repairType, 'repairType'),
    'repair_cost',
  ]);
}

export function buildSettlementEventId(
  stableId: number,
  cycleNumber: number,
  componentType: 'passive_income' | 'operating_costs',
): string {
  return identity([
    'settlement',
    component(stableId, 'stableId'),
    component(cycleNumber, 'cycleNumber'),
    component(componentType, 'componentType'),
  ]);
}

export function buildEconomicOperationEventId(
  operationType: string,
  operationId: string | number,
  userId: number,
): string {
  return identity([
    'operation',
    component(operationType, 'operationType'),
    component(operationId, 'operationId'),
    component(userId, 'userId'),
  ]);
}

export function buildBattlePrestigeEventId(
  battleId: string | number,
  stableId: number,
  mode: string,
): string {
  return identity([
    'prestige',
    'battle',
    component(battleId, 'battleId'),
    component(stableId, 'stableId'),
    component(mode, 'mode'),
  ]);
}

export function buildAchievementPrestigeEventId(
  unlockId: string | number,
  userId: number,
): string {
  return identity([
    'prestige',
    'achievement',
    component(unlockId, 'unlockId'),
    component(userId, 'userId'),
  ]);
}
