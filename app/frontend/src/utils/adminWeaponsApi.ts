/**
 * Admin Weapons API (`/admin/weapons`): which weapons, archetypes and matchups win.
 */
import { api } from './api';
import type { AnalysisRange, AnalysisStrength, WeaponAnalysisResponse } from '../components/admin/weapons/types';

export function getWeaponAnalysis(range: AnalysisRange, strength: AnalysisStrength, signal?: AbortSignal): Promise<WeaponAnalysisResponse> {
  return api.get<WeaponAnalysisResponse>('/api/admin/analysis/weapons', { params: { range, strength }, signal });
}
