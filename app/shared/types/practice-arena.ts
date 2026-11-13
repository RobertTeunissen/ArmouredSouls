/**
 * Wire contracts of the Practice Arena: the What-If request overrides and the
 * academy levels the panel simulates against.
 */

/** What-If overrides for an owned robot */
export interface WhatIfOverrides {
  attributes?: Partial<Record<string, number>>; // any of 23 attributes, each 1-50
  loadoutType?: 'single' | 'weapon_shield' | 'two_handed' | 'dual_wield';
  stance?: 'offensive' | 'defensive' | 'balanced';
  yieldThreshold?: number;
  mainWeaponId?: number;
  offhandWeaponId?: number;
  tuningBonuses?: Partial<Record<string, number>>; // override tuning allocation for this practice battle
}

export interface AcademyLevels {
  combat_training_academy: number;
  defense_training_academy: number;
  mobility_training_academy: number;
  ai_training_academy: number;
}
