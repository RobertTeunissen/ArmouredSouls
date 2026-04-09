/**
 * Constants for Facilities page components.
 */

import type { CategoryInfo } from './types';

export const FACILITY_CATEGORIES: CategoryInfo[] = [
  {
    id: 'economy',
    name: 'Economy & Discounts',
    icon: '💰',
    description: 'Reduce operational costs and unlock passive income',
    facilityTypes: ['training_facility', 'weapons_workshop', 'repair_bay', 'merchandising_hub', 'streaming_studio']
  },
  {
    id: 'capacity',
    name: 'Capacity & Storage',
    icon: '📦',
    description: 'Expand stable capacity for robots and weapons',
    facilityTypes: ['roster_expansion', 'storage_facility']
  },
  {
    id: 'training',
    name: 'Training Academies',
    icon: '🎓',
    description: 'Increase attribute caps for robot development',
    facilityTypes: ['combat_training_academy', 'defense_training_academy', 'mobility_training_academy', 'ai_training_academy']
  },
  {
    id: 'advanced',
    name: 'Advanced Features',
    icon: '⭐',
    description: 'Unlock special features and advanced gameplay mechanics',
    facilityTypes: ['research_lab', 'medical_bay', 'coaching_staff', 'booking_office']
  }
];

export const FACILITY_DISPLAY_NAMES: Record<string, string> = {
  merchandising_hub: 'Merchandising Hub',
  streaming_studio: 'Streaming Studio',
  repair_bay: 'Repair Bay',
  training_facility: 'Training Facility',
  weapons_workshop: 'Weapons Workshop',
};
