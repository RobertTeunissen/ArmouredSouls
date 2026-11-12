/**
 * Typed API of the admin League Health page (`/admin/league-health`).
 *
 * The response shapes are wire contracts in `@shared/types` (admin-league-health.ts).
 * Structure (places, zones, who qualifies right now) comes from the
 * rebalancer's own planner on the current standings. Flow (how many actually
 * moved) comes from the mode's last rebalances in `league_history`: a league
 * rebalances right after its battles, so a snapshot alone always looks empty.
 */
import { api } from './api';
import type { StableScope } from './adminStableScope';
import type { TieredLeagueMode, LeagueHealthOverview, LeagueSeasonOverview } from '@shared/types';

export function getLeagueHealth(signal?: AbortSignal): Promise<LeagueHealthOverview> {
  return api.get<LeagueHealthOverview>('/api/admin/league-health', { signal });
}

/* ------------------------------------------------------------------ */
/*  This season (GET /api/admin/league-health/season)                  */
/* ------------------------------------------------------------------ */

export function getLeagueSeason(
  mode: TieredLeagueMode,
  stables: StableScope,
  signal?: AbortSignal,
): Promise<LeagueSeasonOverview> {
  return api.get<LeagueSeasonOverview>('/api/admin/league-health/season', { params: { mode, stables }, signal });
}
