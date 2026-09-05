import {
  buildEconomicRequestAuditContext,
  createEconomicRequestIdentity,
} from '../economicRequestReplayService';

describe('economic request identity', () => {
  const key = 'request-key-123456';

  it.each([
    ['weapon_purchase', { weaponId: 7 }],
    ['weapon_sale', { inventoryId: 8 }],
    ['weapon_refinement', { inventoryId: 8, tier: 'hone', magnitude: 1, targetAttribute: 'combatPower' }],
    ['facility_upgrade', { facilityType: 'storage_facility' }],
    ['robot_creation', { name: 'Atlas' }],
    ['attribute_upgrade', { robotId: 9, upgrades: { combatPower: { currentLevel: 1, plannedLevel: 2 } } }],
  ] as const)('should build a stable user-scoped identity for %s', (operation, facts) => {
    const first = createEconomicRequestIdentity(42, operation, key, facts);
    const second = createEconomicRequestIdentity(42, operation, key, facts);

    expect(first).toEqual(second);
    expect(first.financialEventId).toBe(`operation:${operation}:${key}:42`);
  });

  it('should retain immutable facts and core response for a sequential replay', () => {
    const identity = createEconomicRequestIdentity(42, 'weapon_sale', key, { inventoryId: 8 });
    const response = { salePrice: 120, currency: 1120, weaponName: 'Arc', message: 'Sold Arc for ₡120' };

    expect(buildEconomicRequestAuditContext(identity, response)).toEqual({
      idempotency: {
        operation: 'weapon_sale',
        requestKey: key,
        requestFacts: { inventoryId: 8 },
        response,
      },
    });
  });

  it('should keep changed canonical request facts distinct from the completed request facts', () => {
    const original = createEconomicRequestIdentity(42, 'facility_upgrade', key, { facilityType: 'storage_facility' });
    const conflicting = createEconomicRequestIdentity(42, 'facility_upgrade', key, { facilityType: 'weapons_workshop' });

    expect(original.financialEventId).toBe(conflicting.financialEventId);
    expect(original.requestFacts).not.toEqual(conflicting.requestFacts);
  });
});
