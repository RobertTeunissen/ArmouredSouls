/**
 * `GET /api/facilities` — the stable's facility overview — and level lookups
 * for the screens that only need a few levels (discounts, caps, gates).
 */
import { api } from './api';
import type { AcademyLevels, FacilitiesOverviewResponse } from '@shared/types';

export function getFacilitiesOverview(signal?: AbortSignal): Promise<FacilitiesOverviewResponse> {
  return signal
    ? api.get<FacilitiesOverviewResponse>('/api/facilities', { signal })
    : api.get<FacilitiesOverviewResponse>('/api/facilities');
}

/** The stable's level of one facility; 0 when it is not built. */
export function facilityLevel(overview: FacilitiesOverviewResponse, type: string): number {
  return overview.facilities.find((facility) => facility.type === type)?.currentLevel ?? 0;
}

/** Levels of the four training academies (attribute caps). */
export function getAcademyLevels(overview: FacilitiesOverviewResponse): AcademyLevels {
  return {
    combat_training_academy: facilityLevel(overview, 'combat_training_academy'),
    defense_training_academy: facilityLevel(overview, 'defense_training_academy'),
    mobility_training_academy: facilityLevel(overview, 'mobility_training_academy'),
    ai_training_academy: facilityLevel(overview, 'ai_training_academy'),
  };
}
