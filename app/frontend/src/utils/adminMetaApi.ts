/**
 * Typed API of the admin Meta page (`/admin/meta`).
 *
 * The page reads the choice sections of `GET /api/admin/meta/choices`
 * (`app/backend/src/services/admin/meta/metaChoicesService.ts`) and the build
 * sections of `GET /api/admin/meta/builds`
 * (`app/backend/src/services/admin/meta/metaBuildsService.ts`), both per
 * stable type (`stables`).
 */
import { api } from './api';
import type { StableScope } from './adminStableScope';

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

/** Stances, loadouts, yield thresholds, weapon totals and facility ownership. */
export interface MetaChoices {
  weapons: {
    totalBought: number;
    /** Robots with a main weapon (ignores offhands). */
    equipped: number;
    /** Owned weapons sitting in any robot's main or offhand slot. */
    equippedInventoryItems: number;
  };
  stances: Array<{ stance: string; count: number }>;
  loadouts: Array<{ type: string; count: number }>;
  yieldThresholds: {
    distribution: Array<{ threshold: number; count: number }>;
    mostCommon: number;
    mostCommonCount: number;
  };
  facilities: {
    /** `purchaseCount` = stables owning the facility at level 1 or higher. */
    summary: Array<{ type: string; purchaseCount: number; avgLevel: number }>;
    totalPurchases: number;
    mostPopular: string;
  };
  timestamp: string;
}

export function getMetaChoices(stables: StableScope, signal?: AbortSignal): Promise<MetaChoices> {
  return api.get<MetaChoices>('/api/admin/meta/choices', { params: { stables }, signal });
}

export function getMetaBuilds(stables: StableScope, signal?: AbortSignal): Promise<MetaBuilds> {
  return api.get<MetaBuilds>('/api/admin/meta/builds', { params: { stables }, signal });
}
