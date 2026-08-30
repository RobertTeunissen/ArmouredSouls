/**
 * Booking Office subscription fixtures.
 *
 * Since Spec #35 every battle event is subscription-gated: matchmaking for all nine modes
 * filters to robots holding an active `subscriptions` row for that `eventType`. A fixture
 * that creates robots and teams but no subscriptions therefore produces entities that are
 * in the competition (they have `standings`) but that matchmaking will never pair.
 *
 * The two gates are independent and a fixture needs both:
 *
 *  - `standings` answers "which competition is this entity in?" — see `./standings`.
 *  - `subscriptions` answers "has this robot signed up for this event?" — this module.
 *
 * Missing either one produces the same symptom, "0 eligible", so check both before
 * concluding a matchmaking service is broken. In the team modes the subscription is
 * per-ROBOT even though the competing entity is a team, and **every** member must be
 * subscribed for the team to be eligible — one unsubscribed member silently removes the
 * whole team.
 *
 * @module tests/helpers/subscriptions
 */

import prisma from '../../src/lib/prisma';

/**
 * Every event type the Event Registry gates. Subscribing is free and always allowed under
 * the cap, so a fixture may subscribe as many robots as it needs.
 */
export type SubscriptionEventType =
  | 'league_1v1'
  | 'tournament_1v1'
  | 'tag_team'
  | 'koth'
  | 'league_2v2'
  | 'league_3v3'
  | 'tournament_2v2'
  | 'tournament_3v3'
  | 'grand_melee';

/**
 * Subscribe robots to an event.
 *
 * Idempotent: uses `skipDuplicates` so a fixture may call it twice for the same robot
 * without tripping the `@@unique([robotId, eventType])` constraint.
 */
export async function subscribeRobots(
  robotIds: readonly number[],
  eventType: SubscriptionEventType,
): Promise<void> {
  if (robotIds.length === 0) return;
  await prisma.subscription.createMany({
    data: robotIds.map((robotId) => ({ robotId, eventType, status: 'active' })),
    skipDuplicates: true,
  });
}

/**
 * Subscribe every member of the given teams to an event.
 *
 * Use this rather than collecting robot ids by hand for a team mode: it encodes the
 * "all members or the team is ineligible" rule in one place.
 */
export async function subscribeTeamMembers(
  teamIds: readonly number[],
  eventType: SubscriptionEventType,
): Promise<void> {
  if (teamIds.length === 0) return;
  const members = await prisma.teamBattleMember.findMany({
    where: { teamId: { in: [...teamIds] } },
    select: { robotId: true },
  });
  await subscribeRobots(
    members.map((m) => m.robotId),
    eventType,
  );
}
