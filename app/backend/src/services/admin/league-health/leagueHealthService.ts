/**
 * League Health overview for `/admin/league-health`: every tiered league, its
 * tiers and instances, and what the next rebalance would do.
 *
 * @module services/admin/league-health/leagueHealthService
 */

import logger from '../../../config/logger';
import { TIERED_LEAGUE_MODES, TieredLeagueMode } from '../../league/league-rules';
import { getCurrentSeason } from '../../season/seasonService';
import { LEAGUE_HISTORY_WINDOW, LEAGUE_LOW_MOVEMENT_SHARE, LEAGUE_UNSUBSCRIBED_NOTICE_SHARE } from '../adminThresholds';
import { loadLeagueHealthRows, loadRebalanceHistory } from './leagueHealthData';
import { summariseMode } from './leagueHealthPlan';
import { buildAttention } from './leagueHealthStatus';
import type { LeagueHealthOverview, LeagueHealthRow, ModeRebalanceHistory } from './leagueHealthTypes';

/** Pure assembly of the overview from loaded rows and rebalance history. */
export function buildLeagueHealthOverview(
  rows: readonly LeagueHealthRow[],
  history: ReadonlyMap<TieredLeagueMode, ModeRebalanceHistory>,
  season: LeagueHealthOverview['season'],
  now: Date = new Date(),
): LeagueHealthOverview {
  const modes = TIERED_LEAGUE_MODES.map((mode) =>
    summariseMode(mode, rows.filter((row) => row.mode === mode), history.get(mode)));
  return {
    generatedAt: now.toISOString(),
    season,
    thresholds: {
      historyWindow: LEAGUE_HISTORY_WINDOW,
      lowMovementShare: LEAGUE_LOW_MOVEMENT_SHARE,
      unsubscribedNoticeShare: LEAGUE_UNSUBSCRIBED_NOTICE_SHARE,
    },
    modes,
    attention: buildAttention(modes),
  };
}

async function loadSeason(): Promise<LeagueHealthOverview['season']> {
  try {
    const season = await getCurrentSeason();
    return {
      number: season.seasonNumber,
      phase: season.phase,
      cycle: season.seasonCycle,
      lengthCycles: season.seasonLengthCycles,
    };
  } catch (error) {
    // The season label is context only; the overview stays useful without it.
    logger.warn('[LeagueHealth] Could not read the current season', { error });
    return null;
  }
}

/** Read the standings and the recent rebalances, and build the overview. */
export async function getLeagueHealthOverview(): Promise<LeagueHealthOverview> {
  const [rows, history, season] = await Promise.all([
    loadLeagueHealthRows(),
    loadRebalanceHistory(LEAGUE_HISTORY_WINDOW),
    loadSeason(),
  ]);
  return buildLeagueHealthOverview(rows, history, season);
}
