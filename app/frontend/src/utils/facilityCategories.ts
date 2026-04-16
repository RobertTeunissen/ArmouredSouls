/**
 * Facility category mapping — shared between StableViewPage and property tests.
 * Extracted to avoid fast-refresh warnings from exporting non-components from page files.
 */

export const FACILITY_CATEGORIES = [
  {
    id: 'economy',
    name: 'Economy & Discounts',
    icon: '💰',
    facilityTypes: ['repair_bay', 'training_facility', 'weapons_workshop', 'merchandising_hub', 'streaming_studio'],
  },
  {
    id: 'capacity',
    name: 'Capacity & Storage',
    icon: '📦',
    facilityTypes: ['roster_expansion', 'storage_facility'],
  },
  {
    id: 'training',
    name: 'Training Academies',
    icon: '🎓',
    facilityTypes: ['combat_training_academy', 'defense_training_academy', 'mobility_training_academy', 'ai_training_academy'],
  },
  {
    id: 'advanced',
    name: 'Tactical & Advanced',
    icon: '⭐',
    facilityTypes: ['tuning_bay', 'research_lab', 'medical_bay', 'coaching_staff', 'booking_office'],
  },
] as const;

/** Returns the category name for a given facility type, or null if unknown. */
export function getFacilityCategory(facilityType: string): string | null {
  for (const cat of FACILITY_CATEGORIES) {
    if ((cat.facilityTypes as readonly string[]).includes(facilityType)) {
      return cat.name;
    }
  }
  return null;
}
