/**
 * Tag team fixtures.
 *
 * Four heavy suites each carried a byte-identical private copy of `createTagTeamFixture`,
 * and all four were wrong in the same way: they created a `TeamBattle` and stopped there.
 * A tag team needs three things before matchmaking will look at it, and the other two are
 * not on the team row:
 *
 *  1. The team itself, `teamSize: 2`, with a member in slot 0 (active) and slot 1 (reserve).
 *  2. A `standings` row for mode `tag_team` — Spec #40 made `standings` the source of truth
 *     for tier and league instance, and `getEligibleTeams` scopes its candidates from it.
 *  3. An active `tag_team` subscription for **every** member — Spec #35 gates all nine
 *     events on the Booking Office, and one unsubscribed member removes the whole team.
 *
 * With any of the three missing, `runTagTeamMatchmaking()` returns 0 and the suites read
 * "0 eligible teams (N total, N ready, 0 already scheduled)". That message names the gate
 * that failed, and is worth reading before suspecting the matchmaker.
 *
 * Declared once here so a fourth divergent copy cannot appear, and so the next mode-gating
 * change lands in one place rather than four.
 *
 * @module tests/helpers/tagTeam
 */

import prisma from '../../src/lib/prisma';
import type { Prisma } from '../../generated/prisma';
import { enterTeamStanding, type StandingFixtureOptions } from './standings';
import { subscribeTeamMembers } from './subscriptions';

export type TagTeamFixture = Prisma.TeamBattleGetPayload<{ include: { members: true } }>;

export interface TagTeamFixtureOptions extends StandingFixtureOptions {
  /**
   * Skip the `tag_team` subscription, to test the Booking Office gate itself.
   * Defaults to false, because the overwhelmingly common intent is "a team that can fight".
   */
  withoutSubscription?: boolean;
}

/**
 * Create a 2v2 tag team that matchmaking will actually consider.
 *
 * Slot 0 is the active robot and slot 1 the reserve, matching the Active/Reserve roles the
 * tag team orchestrator expects.
 */
export async function createTagTeamFixture(
  stableId: number,
  activeRobotId: number,
  reserveRobotId: number,
  options: TagTeamFixtureOptions = {},
): Promise<TagTeamFixture> {
  const team = await prisma.teamBattle.create({
    data: {
      stableId,
      teamSize: 2,
      teamName: `Test_Team_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      members: {
        create: [
          { robotId: activeRobotId, slotIndex: 0 },
          { robotId: reserveRobotId, slotIndex: 1 },
        ],
      },
    },
    include: { members: true },
  });

  const { withoutSubscription, ...standingOptions } = options;
  await enterTeamStanding(team.id, 'tag_team', {
    tier: standingOptions.tier ?? 'bronze',
    ...standingOptions,
  });

  if (!withoutSubscription) {
    await subscribeTeamMembers([team.id], 'tag_team');
  }

  return team;
}

/**
 * Remove the rows a tag team fixture creates that nothing cascades.
 *
 * `standings` is polymorphic (`entityType` + `entityId`) so it has no foreign key to
 * `team_battles` and is never cascaded — it has to be deleted explicitly, and before the
 * teams it refers to. Subscriptions cascade from `robots`, but are cleared here too so a
 * suite's delete order cannot matter.
 */
export async function clearTagTeamCompetition(
  teamIds: readonly number[],
  robotIds: readonly number[],
): Promise<void> {
  if (teamIds.length > 0) {
    await prisma.standing.deleteMany({
      where: { mode: 'tag_team', entityType: 'team', entityId: { in: [...teamIds] } },
    });
  }
  if (robotIds.length > 0) {
    await prisma.subscription.deleteMany({ where: { robotId: { in: [...robotIds] } } });
  }
}
