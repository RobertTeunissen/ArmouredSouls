/**
 * Unit tests for facilityCategories — category lookup utility.
 */
import { describe, it, expect } from 'vitest';
import { getFacilityCategory, FACILITY_CATEGORIES } from './facilityCategories';

describe('getFacilityCategory', () => {
  it('should return Economy for economy facilities', () => {
    expect(getFacilityCategory('repair_bay')).toBe('Economy');
    expect(getFacilityCategory('training_facility')).toBe('Economy');
    expect(getFacilityCategory('merchandising_hub')).toBe('Economy');
    expect(getFacilityCategory('streaming_studio')).toBe('Economy');
  });

  it('should return Hangar & Armory for robot, storage, weapon and refinement facilities', () => {
    expect(getFacilityCategory('roster_expansion')).toBe('Hangar & Armory');
    expect(getFacilityCategory('storage_facility')).toBe('Hangar & Armory');
    expect(getFacilityCategory('weapons_workshop')).toBe('Hangar & Armory');
    expect(getFacilityCategory('refinement_lab')).toBe('Hangar & Armory');
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
