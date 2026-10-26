/**
 * Admin Attributes API (`/admin/attributes`): which attributes win.
 */
import { api } from './api';
import { LAYER_KEYS, type AnalysisRange, type AttributeAnalysisResponse, type LayerToggles } from '../components/admin/attributes/types';

export function getAttributeAnalysis(range: AnalysisRange, toggles: LayerToggles, signal?: AbortSignal): Promise<AttributeAnalysisResponse> {
  const params: Record<string, string> = { range };
  for (const key of LAYER_KEYS) params[key] = toggles[key] ? 'true' : 'false';
  return api.get<AttributeAnalysisResponse>('/api/admin/analysis/attributes', { params, signal });
}
