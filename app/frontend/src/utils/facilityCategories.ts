/**
 * Facility category mapping — shared between StableViewPage and property tests.
 * Extracted to avoid fast-refresh warnings from exporting non-components from page files.
 */

export const FACILITY_CATEGORIES = [
  {
    id: 'economy',
    name: 'Economy',
    icon: '💰',
    facilityTypes: ['repair_bay', 'training_facility', 'merchandising_hub', 'streaming_studio'],
  },
  {
    id: 'capacity',
    name: 'Hangar & Armory',
    icon: '📦',
    facilityTypes: ['roster_expansion', 'storage_facility', 'weapons_workshop', 'refinement_lab'],
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
    facilityTypes: ['tuning_bay', 'booking_office'],
  },
] as const;

