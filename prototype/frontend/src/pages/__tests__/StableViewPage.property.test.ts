// Feature: view-other-stables, Property 7: Facility category grouping completeness
// **Validates: Requirements 3.2**

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { FACILITY_CATEGORIES, getFacilityCategory } from '../StableViewPage';

const ALL_FACILITY_TYPES = [
  'repair_bay',
  'training_facility',
  'weapons_workshop',
  'merchandising_hub',
  'streaming_studio',
  'roster_expansion',
  'storage_facility',
  'combat_training_academy',
  'defense_training_academy',
  'mobility_training_academy',
  'ai_training_academy',
  'research_lab',
  'medical_bay',
  'coaching_staff',
  'booking_office',
] as const;

const EXPECTED_CATEGORIES = [
  'Economy & Discounts',
  'Capacity & Storage',
  'Training Academies',
  'Advanced Features',
] as const;

describe('Property 7: Facility category grouping completeness', () => {
  it('every known facility type maps to exactly one of the four categories', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_FACILITY_TYPES),
        (facilityType) => {
          const category = getFacilityCategory(facilityType);

          // Must not be null — every known type must be grouped
          expect(category).not.toBeNull();

          // Must be one of the four defined categories
          expect(EXPECTED_CATEGORIES).toContain(category);

          // Must appear in exactly one category's facilityTypes array
          const matchingCategories = FACILITY_CATEGORIES.filter((cat) =>
            (cat.facilityTypes as readonly string[]).includes(facilityType),
          );
          expect(matchingCategories).toHaveLength(1);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('all 15 known facility types are covered by the category definitions', () => {
    // Collect every type listed across all categories
    const allCategorizedTypes = FACILITY_CATEGORIES.flatMap(
      (cat) => [...cat.facilityTypes],
    );

    for (const ft of ALL_FACILITY_TYPES) {
      expect(allCategorizedTypes).toContain(ft);
    }

    // No duplicates across categories
    expect(new Set(allCategorizedTypes).size).toBe(allCategorizedTypes.length);
  });
});
