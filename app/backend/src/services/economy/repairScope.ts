/**
 * Repair scope resolution — which robots are about to fight (issue #411).
 *
 * Pre-battle repair used to repair every damaged robot in the game, once per
 * battle cron. With nine daily slots that meant a robot subscribed only to
 * `league_1v1` was auto-repaired at full price by the 2v2 cron an hour later,
 * before its owner had any realistic chance to log in and take the 50% manual
 * repair discount. Scoping each cron to its own participants leaves everyone
 * else damaged until either the player repairs manually or their own match comes
 * up, which is what makes the discount reachable without logging in constantly.
 *
 * The scope map itself lives in `services/scheduling/eventScheduleScope`,
 * because subscription slot accounting asks the same "is there a queued match?"
 * question from the other direction and the two must not drift apart.
 *
 * Leaving a robot damaged is safe: `checkBattleReadiness` is weapon-only and
 * explicitly does not check HP, so a damaged robot is still matched normally and
 * gets repaired by the cron that runs its match. It cannot strand itself.
 *
 * @module services/economy/repairScope
 */

export { resolveRobotIdsForEvent } from '../scheduling/eventScheduleScope';
