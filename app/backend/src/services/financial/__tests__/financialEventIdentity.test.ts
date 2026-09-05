import {
  buildAchievementRewardEventId,
  buildBattleIncomeEventId,
  buildByeBattleIncomeEventId,
  buildEconomicOperationEventId,
  buildRepairEventId,
  buildSettlementEventId,
  buildStreamingEventId,
} from '../financialEventIdentity';

describe('Financial_Event identity builders', () => {
  it('should make battle and streaming identities stable by source component', () => {
    expect(buildBattleIncomeEventId(10, 2, 'league_1v1')).toBe('battle:10:2:league_1v1:battle_income');
    expect(buildBattleIncomeEventId(10, 2, 'league_1v1')).toBe(buildBattleIncomeEventId(10, 2, 'league_1v1'));
    expect(buildStreamingEventId(10, 20, 'league_1v1')).toBe('streaming:10:20:league_1v1:streaming_revenue');
    expect(buildByeBattleIncomeEventId(99, 2, 'koth')).toBe('bye:99:2:koth:battle_income');
  });

  it('should make source-specific identities for achievements, repairs, settlement, and operations', () => {
    expect(buildAchievementRewardEventId(5, 2)).toBe('achievement:5:2:achievement_reward');
    expect(buildRepairEventId('manual-1', 20, 'manual')).toBe('repair:manual-1:20:manual:repair_cost');
    expect(buildSettlementEventId(2, 7, 'passive_income')).toBe('settlement:2:7:passive_income');
    expect(buildEconomicOperationEventId('weapon_purchase', 44, 2)).toBe('operation:weapon_purchase:44:2');
  });

  it('should reject ambiguous or oversized identities', () => {
    expect(() => buildBattleIncomeEventId('10:retry', 2, 'league_1v1')).toThrow();
    expect(() => buildEconomicOperationEventId('x'.repeat(190), 1, 2)).toThrow();
  });
});
