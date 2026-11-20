/**
 * Unit tests for facilityCategories — category definitions.
 */
import { describe, it, expect } from 'vitest';
import { FACILITY_CATEGORIES } from './facilityCategories';

describe('FACILITY_CATEGORIES', () => {
  it('should have 4 categories', () => {
    expect(FACILITY_CATEGORIES).toHaveLength(4);
  });

  it('should split the 14 facilities 4-4-4-2', () => {
    expect(FACILITY_CATEGORIES.map(c => [c.id, c.name, c.facilityTypes.length])).toEqual([
      ['economy', 'Economy', 4],
      ['capacity', 'Hangar & Armory', 4],
      ['training', 'Training Academies', 4],
      ['advanced', 'Tactical & Advanced', 2],
    ]);
  });

  it('should cover all known facility types without duplicates', () => {
    const allTypes = FACILITY_CATEGORIES.flatMap(c => c.facilityTypes);
    const uniqueTypes = new Set(allTypes);
    expect(uniqueTypes.size).toBe(allTypes.length);
  });
});
