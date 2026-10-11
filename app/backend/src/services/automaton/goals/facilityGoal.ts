/**
 * Facility → level Goal (Spec #55, R5.2, R5.12, design §8.2).
 *
 * Satisfied at the target (target 0 skips the Goal). A Booking Office Goal is
 * Satisfied at `min(target, useful level)` and re-opens when the useful level
 * rises, which happens when a team forms.
 */
import { getSubscriptionCap } from '../../../config/subscriptions';
import { quoteFacilityLevel } from '../pricing';
import type { FacilityType, StableFacts } from '../stableFacts';
import { SOLO_EVENT_TYPES, TEAM_EVENT_SIZE } from '../upkeep/subscriptionUpkeep';
import { blockedFromQuote } from './goalSupport';
import { savingOrActionable, type Goal, type GoalContext, type GoalOutcome } from './goalTypes';

/** Highest Booking Office level any stable can use. */
export const BOOKING_OFFICE_USEFUL_MAX = 6;

/** Team event types of a team size (league_2v2, tag_team, tournament_2v2 / league_3v3, tournament_3v3). */
function teamEventTypeCount(size: 2 | 3): number {
  return Object.values(TEAM_EVENT_SIZE).filter((teamSize) => teamSize === size).length;
}

/** Smallest Booking Office level whose cap reaches `events` per robot (from `getSubscriptionCap`). */
function levelForEvents(events: number): number {
  let level = 0;
  while (level < BOOKING_OFFICE_USEFUL_MAX && getSubscriptionCap(level) < events) level++;
  return level;
}

/**
 * Booking Office useful level (R5.12): the smallest level whose events per
 * robot reach the most event types any live robot can enter (solo events,
 * plus the team events of every formed team it is in), at most L6; 0 with no
 * live robots. Derived from `getSubscriptionCap` and the event lists, so a
 * change to the cap curve moves it too.
 */
export function bookingOfficeUsefulLevel(facts: StableFacts): number {
  if (facts.robots.length === 0) return 0;
  let most = 0;
  for (const robot of facts.robots) {
    const inTeamOf = (size: 2 | 3): boolean =>
      facts.teams.some((team) => team.size === size && team.memberRobotIds.includes(robot.robotId));
    const playable = SOLO_EVENT_TYPES.length
      + (inTeamOf(2) ? teamEventTypeCount(2) : 0)
      + (inTeamOf(3) ? teamEventTypeCount(3) : 0);
    most = Math.max(most, playable);
  }
  return levelForEvents(most);
}

/** Create the Goal "{facilityType} → level". */
export function createFacilityGoal(id: string, facilityType: FacilityType): Goal {
  return {
    id,
    evaluate(facts: StableFacts, ctx: GoalContext): GoalOutcome {
      const level = facts.facilities[facilityType];
      const effectiveTarget = facilityType === 'booking_office'
        ? Math.min(ctx.target, bookingOfficeUsefulLevel(facts))
        : ctx.target;
      if (effectiveTarget <= 0 || level >= effectiveTarget) {
        return { kind: 'satisfied', goalId: id };
      }
      const quote = quoteFacilityLevel(facilityType, level, facts.prestige);
      if (quote.kind !== 'available') {
        const blocked = blockedFromQuote(quote);
        return { kind: 'blocked', goalId: id, reason: blocked.reason, detail: blocked.detail };
      }
      return savingOrActionable(
        id,
        { kind: 'facility_upgrade', facilityType, toLevel: quote.toLevel, cost: quote.cost },
        quote.cost,
        ctx.balance,
        { facilityType, toLevel: quote.toLevel },
      );
    },
  };
}
