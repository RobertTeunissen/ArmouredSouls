/**
 * Typed API of the admin Meta page (`/admin/meta`).
 *
 * The page reads the choice distributions of `GET /api/admin/stats`
 * (`app/backend/src/services/admin/adminSystemStatsService.ts`) and the build
 * sections of `GET /api/admin/meta/builds`
 * (`app/backend/src/services/admin/meta/metaBuildsService.ts`). It does not
 * use the shared `adminStore.fetchStats()` slot: that commits every response,
 * so a slow response for an old filter could overwrite a newer one.
 */
import { api } from './api';
import type { UserFilterType } from '../components/admin/shared';
import type { SystemStats } from '../components/admin/types';

export type AttributeGroup = 'combat' | 'defence' | 'chassis' | 'ai' | 'team';
export type RefinementKind = 'hone' | 'augment' | 'sharpen' | 'forge';

export interface MetaTuning {
  totalRobots: number;
  robotsTuned: number;
  poolUsed: number;
  poolTotal: number;
  byGroup: Array<{ group: AttributeGroup; points: number }>;
  /** All 23 attributes, most points first. */
  attributes: Array<{ attribute: string; group: AttributeGroup; points: number; robots: number }>;
}

export interface MetaRefinements {
  stables: number;
  stablesRefining: number;
  refinements: number;
  weaponsRefined: number;
  creditsSpent: number;
  perKind: Array<{ kind: RefinementKind; refinements: number; stables: number; credits: number }>;
  targeted: Array<{ attribute: string; refinements: number; magnitude: number }>;
  topSpenders: Array<{ userId: number; stableName: string | null; username: string; credits: number; weapons: number }>;
}

export interface MetaEventEntry {
  totalRobots: number;
  robotsEntered: number;
  averageEvents: number;
  perEvent: Array<{ eventType: string; robots: number }>;
  eventsPerRobot: Array<{ events: number; robots: number }>;
}

export interface MetaBuilds {
  tuning: MetaTuning;
  refinements: MetaRefinements;
  eventEntry: MetaEventEntry;
}

export function getMetaStats(filter: UserFilterType, signal?: AbortSignal): Promise<SystemStats> {
  return api.get<SystemStats>('/api/admin/stats', { params: { filter }, signal });
}

export function getMetaBuilds(filter: UserFilterType, signal?: AbortSignal): Promise<MetaBuilds> {
  return api.get<MetaBuilds>('/api/admin/meta/builds', { params: { filter }, signal });
}
