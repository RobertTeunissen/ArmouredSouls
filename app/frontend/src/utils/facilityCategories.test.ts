/**
 * Unit tests for facilityCategories — category lookup utility.
 */
import { describe, it, expect } from 'vitest';
import { getFacilityCategory, FACILITY_CATEGORIES } from './facilityCategories';

describe('getFacilityCategory', () => {
  it('should return Economy & Discounts for economy facilities', () => {
    expect(getFacilityCategory('repair_bay')).toBe('Economy & Discounts');
    expect(getFacilityCategory('streaming_studio')).toBe('Economy & Discounts');
    expect(getFacilityCategory('weapons_workshop')).toBe('Economy & Discounts');
  });

  it('should return Capacity & Storage for capacity facilities', () => {
    expect(getFacilityCategory('roster_expansion')).toBe('Capacity & Storage');
    expect(getFacilityCategory('storage_facility')).toBe('Capacity & Storage');
  });

  it('should return Training Academies for training facilities', () => {
    expect(getFacilityCategory('combat_training_academy')).toBe('Training Academies');
    expect(getFacilityCategory('ai_training_academy')).toBe('Training Academies');
  });

  it('should return Tactical & Advanced for advanced facilities', () => {
    expect(getFacilityCategory('tuning_bay')).toBe('Tactical & Advanced');
    expect(getFacilityCategory('booking_office')).toBe('Tactical & Advanced');
  });

  it('should return null for unknown facility types', () => {
    expect(getFacilityCategory('unknown_facility')).toBeNull();
    expect(getFacilityCategory('')).toBeNull();
  });
});

describe('FACILITY_CATEGORIES', () => {
  it('should have 4 categories', () => {
    expect(FACILITY_CATEGORIES).toHaveLength(4);
  });

  it('should cover all known facility types without duplicates', () => {
    const allTypes = FACILITY_CATEGORIES.flatMap(c => c.facilityTypes);
    const uniqueTypes = new Set(allTypes);
    expect(uniqueTypes.size).toBe(allTypes.length);
  });
});
