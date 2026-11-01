/**
 * Response of `GET /api/admin/meta/builds`: the Tuning, Refinements and
 * Event entry sections of the admin Meta page, for one stable type.
 */
import type { AttributeGroup } from '../analysis/analysisOptions';

export interface MetaTuningAttribute {
  attribute: string;
  group: AttributeGroup;
  /** Tuning points on this attribute across all robots in scope. */
  points: number;
  /** Robots with more than zero points on it. */
  robots: number;
}

export interface MetaTuning {
  totalRobots: number;
  /** Robots with at least one tuning point. */
  robotsTuned: number;
  /** Points allocated, summed over every robot. */
  poolUsed: number;
  /** Each robot's pool ((Tuning Bay level + 1) × 10) summed over every robot. */
  poolTotal: number;
  byGroup: Array<{ group: AttributeGroup; points: number }>;
  /** All 23 attributes, most points first. */
  attributes: MetaTuningAttribute[];
}

export type RefinementKind = 'hone' | 'augment' | 'sharpen' | 'forge';

export interface MetaRefinements {
  /** Stables of this type with at least one robot. */
  stables: number;
  stablesRefining: number;
  refinements: number;
  weaponsRefined: number;
  /** Lifetime credits paid for refinements. */
  creditsSpent: number;
  perKind: Array<{ kind: RefinementKind; refinements: number; stables: number; credits: number }>;
  /** Attributes targeted by Hone and Augment, most refinements first. */
  targeted: Array<{ attribute: string; refinements: number; magnitude: number }>;
  /** Top 5 stables by credits spent. */
  topSpenders: Array<{ userId: number; stableName: string | null; username: string; credits: number; weapons: number }>;
}

export interface MetaEventEntry {
  totalRobots: number;
  /** Robots entered in at least one event. */
  robotsEntered: number;
  /** Entries per robot, over every robot in scope. */
  averageEvents: number;
  /** Every subscribable event in registry order, with the robots entered in it. */
  perEvent: Array<{ eventType: string; robots: number }>;
  /** Robots by number of events entered, from 0 to the number of events. */
  eventsPerRobot: Array<{ events: number; robots: number }>;
}

export interface MetaBuilds {
  tuning: MetaTuning;
  refinements: MetaRefinements;
  eventEntry: MetaEventEntry;
}
