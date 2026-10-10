/**
 * Facility → level Goal (Spec #55, R5.2, R5.12, design §8.2).
 *
 * Satisfied at the target (target 0 skips the Goal). A Booking Office Goal is
 * Satisfied at `min(target, useful level)` and re-opens when the useful level
 * rises, which happens when a team forms.
 */
import { quoteFacilityLevel } from '../pricing';
import type { FacilityType, StableFacts } from '../stableFacts';
import { blockedFromQuote } from './goalSupport';
import { savingOrActionable, type Goal, type GoalContext, type GoalOutcome } from './goalTypes';

/** Solo event types every live robot can enter. */
const SOLO_EVENT_TYPE_COUNT = 4;
/** Extra event types for a robot in a formed 2v2 team (league_2v2, tag_team, tournament_2v2). */
const TEAM_2V2_EVENT_TYPE_COUNT = 3;
/** Extra event types for a robot in a formed 3v3 team (league_3v3, tournament_3v3). */
const TEAM_3V3_EVENT_TYPE_COUNT = 2;
/** Booking Office events per robot are 3 + level. */
const BASE_EVENTS_PER_ROBOT = 3;
/** Highest Booking Office level any stable can use. */
export const BOOKING_OFFICE_USEFUL_MAX = 6;

/**
 * Booking Office useful level (R5.12): `min(6, p − 3)` where p is the most
 * event types any live robot can enter; 0 with no live robots.
 */
export function bookingOfficeUsefulLevel(facts: StableFacts): number {
  if (facts.robots.length === 0) return 0;
  let most = 0;
  for (const robot of facts.robots) {
    const inTeamOf = (size: 2 | 3): boolean =>
      facts.teams.some((team) => team.size === size && team.memberRobotIds.includes(robot.robotId));
    const playable = SOLO_EVENT_TYPE_COUNT
      + (inTeamOf(2) ? TEAM_2V2_EVENT_TYPE_COUNT : 0)
      + (inTeamOf(3) ? TEAM_3V3_EVENT_TYPE_COUNT : 0);
    most = Math.max(most, playable);
  }
  return Math.min(BOOKING_OFFICE_USEFUL_MAX, most - BASE_EVENTS_PER_ROBOT);
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
