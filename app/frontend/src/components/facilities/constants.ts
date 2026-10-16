/**
 * Constants for Facilities page components.
 */

import type { CategoryInfo } from './types';

export const FACILITY_CATEGORIES: CategoryInfo[] = [
  {
    id: 'economy',
    name: 'Economy',
    icon: '💰',
    description: 'Reduce operational costs and unlock passive income',
    facilityTypes: ['training_facility', 'repair_bay', 'merchandising_hub', 'streaming_studio']
  },
  {
    id: 'capacity',
    name: 'Hangar & Armory',
    icon: '📦',
    description: 'Robot slots, weapon storage, weapon purchasing and weapon refinement',
    facilityTypes: ['roster_expansion', 'storage_facility', 'weapons_workshop', 'refinement_lab']
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
    name: 'Tactical & Advanced',
    icon: '⭐',
    description: 'Unlock special features and advanced gameplay mechanics',
    facilityTypes: ['tuning_bay', 'booking_office']
  }
];
