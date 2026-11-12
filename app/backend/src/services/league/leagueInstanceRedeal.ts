/**
 * Re-deal every tiered league's instances outside the nightly rebalance.
 *
 * A new standings row joins the least-full instance of its tier
 * (`leagueInstancePlacement`), and a new instance only opens once every
 * instance holds 100. A bulk placement such as the Automatons' season-opening
 * build therefore fills the instances one after another and leaves a single
 * part-filled instance at the end, which then takes every later entrant: on ACC
 * at the start of Season 2 all human robots landed in 1v1 Bronze 11 and the
 * human 2v2 teams in Bronze 5 (issue #599). The nightly rebalance re-deals the
 * tiers, but battle events don't run during the preparation phase, so the
 * cluster stood until the first competitive cycle.
 *
 * Re-dealing right after the bulk placement (season rollover) and on every
 * preparation day spreads the tiers evenly, so later entrants have room in
 * every instance. No promotions or demotions happen here, only instance moves.
 *
 * @module services/league/leagueInstanceRedeal
 */

import logger from '../../config/logger';
import { MAX_ENTITIES_PER_INSTANCE } from './leagueInstancePlacement';
import { LEAGUE_TIERS, rebalanceInstances } from './leagueInstanceService';
import { TIERED_LEAGUE_MODES } from './league-rules';

export interface LeagueInstanceRedealResult {
  /** Standings rows moved to another instance, across all modes and tiers. */
  moved: number;
  /** `mode/tier` pairs whose re-deal failed (logged; the rest still ran). */
  failures: string[];
}

/**
 * Round-robin re-deal of every tier of every tiered league mode.
 *
 * Never throws: a failing mode/tier is logged and reported in `failures`, and
 * the remaining tiers are still re-dealt. Callers treat it as a non-fatal step.
 */
export async function redealLeagueInstances(context: string): Promise<LeagueInstanceRedealResult> {
  const result: LeagueInstanceRedealResult = { moved: 0, failures: [] };

  for (const mode of TIERED_LEAGUE_MODES) {
    for (const tier of LEAGUE_TIERS) {
      try {
        result.moved += await rebalanceInstances(tier, { mode, maxPerInstance: MAX_ENTITIES_PER_INSTANCE });
      } catch (error) {
        result.failures.push(`${mode}/${tier}`);
        logger.error(
          `${context}: league instance re-deal failed for ${mode}/${tier} (non-fatal) — `
          + `${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  logger.info(
    `${context}: league instances re-dealt — ${result.moved} standings moved`
    + (result.failures.length > 0 ? `, ${result.failures.length} mode/tier re-deal(s) failed` : ''),
  );
  return result;
}
