/**
 * When each event next books its matches.
 *
 * Every battle mode runs on one daily cron slot that both fights the matches it
 * has queued and books the next ones (see `cycleScheduler` — repair, execute,
 * rebalance, then matchmaking). So a single timestamp answers the only question
 * a player actually has: *by when do I need to be subscribed for this event to
 * pick my robot up?*
 *
 * Knowing that moment is what makes the subscription rule usable. A player
 * knocked out of a tournament early can put the robot to work elsewhere and
 * still get back in time for the next bracket, instead of guessing.
 *
 * @module services/scheduling/eventCronSchedule
 */

import { getConfig } from '../../config/env';
import { getNextCronOccurrence } from '../../utils/scheduleUtils';
import {
  SUBSCRIBABLE_EVENT_TYPES,
  type SubscribableEventType,
} from '../subscription/eventRegistry';

/** Which configured cron expression drives each event's slot. */
function cronExpressionFor(eventType: SubscribableEventType): string {
  const config = getConfig();
  switch (eventType) {
    case 'league_1v1': return config.leagueSchedule;
    case 'league_2v2': return config.team2v2LeagueSchedule;
    case 'league_3v3': return config.team3v3LeagueSchedule;
    case 'tag_team': return config.tagTeamSchedule;
    case 'koth': return config.kothSchedule;
    case 'grand_melee': return config.grandMeleeSchedule;
    case 'tournament_1v1': return config.tournamentSchedule;
    case 'tournament_2v2': return config.team2v2TournamentSchedule;
    case 'tournament_3v3': return config.team3v3TournamentSchedule;
  }
}

/** The next UTC moment at which the given event books matches. */
export function getNextSchedulingMoment(eventType: SubscribableEventType): Date {
  return getNextCronOccurrence(cronExpressionFor(eventType));
}

/**
 * Next scheduling moment for every event, as ISO strings for the API.
 *
 * Returns a plain record rather than a list so the frontend can look a single
 * event up while rendering a cell.
 */
export function getNextSchedulingMoments(): Record<SubscribableEventType, string> {
  const moments = {} as Record<SubscribableEventType, string>;
  for (const eventType of SUBSCRIBABLE_EVENT_TYPES) {
    moments[eventType] = getNextSchedulingMoment(eventType).toISOString();
  }
  return moments;
}
