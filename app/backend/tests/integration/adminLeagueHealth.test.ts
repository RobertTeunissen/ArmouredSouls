/**
 * League Health overview against the database.
 *
 * - Rows: stable type, active flag (robot subscription; team = every member
 *   subscribed), robot ELO and combined team ELO, for this file's fixtures.
 * - Parity: for every mode and tier, the overview's promotion and demotion
 *   numbers equal `getLeagueTierPreview`, the read-only plan the player league
 *   pages use and the rebalancer executes. Both read the whole tier, so rows
 *   from other suites do not break the comparison.
 */
import prisma from '../../src/lib/prisma';
import type { StandingsMode } from '../../generated/prisma';
import { getLeagueHealthOverview } from '../../src/services/admin/league-health';
import { loadLeagueHealthRows, loadRebalanceHistory } from '../../src/services/admin/league-health/leagueHealthData';
import { getLeagueTierPreview } from '../../src/services/league/league-rebalancing-preview';
import { getLeagueRulesForMode } from '../../src/services/league/league-rules';
import { createTestRobot, deleteTestUser } from '../testHelpers';
import { enterRobotStanding, enterTeamStanding } from '../helpers/standings';

const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
// Instance numbers no other suite uses, so the fixture's instances are its own.
const INSTANCE = 'diamond_987';

describe('League Health overview (database)', () => {
  const userIds: number[] = [];
  const robotIds: number[] = [];
  const teamIds: number[] = [];
  let subscribedRobot = 0;
  let unsubscribedRobot = 0;
  let fullTeam = 0;
  let partialTeam = 0;

  beforeAll(async () => {
    const human = await prisma.user.create({
      data: { username: `lhealth_h_${suffix}`, passwordHash: 'x', stableType: 'human' },
    });
    const automaton = await prisma.user.create({
      data: { username: `lhealth_a_${suffix}`, passwordHash: 'x', stableType: 'automaton' },
    });
    userIds.push(human.id, automaton.id);

    const robots = await Promise.all([
      createTestRobot(human.id, `LH_A_${suffix}`),
      createTestRobot(automaton.id, `LH_B_${suffix}`),
      createTestRobot(human.id, `LH_C_${suffix}`),
      createTestRobot(human.id, `LH_D_${suffix}`),
    ]);
    robotIds.push(...robots.map((robot) => robot.id));
    const [a, b, c, d] = robots;
    await Promise.all([
      prisma.robot.update({ where: { id: a.id }, data: { elo: 1400 } }),
      prisma.robot.update({ where: { id: b.id }, data: { elo: 1100 } }),
      prisma.robot.update({ where: { id: c.id }, data: { elo: 1300 } }),
      prisma.robot.update({ where: { id: d.id }, data: { elo: 1250 } }),
    ]);
    subscribedRobot = a.id;
    unsubscribedRobot = b.id;

    // 1v1: A subscribed, B not (its standing survives an unsubscribe).
    await prisma.subscription.create({ data: { robotId: a.id, eventType: 'league_1v1', status: 'active' } });
    await enterRobotStanding(a.id, 'league_1v1', { tier: 'diamond', leagueInstanceId: INSTANCE, leaguePoints: 120, cyclesInTier: 6 });
    await enterRobotStanding(b.id, 'league_1v1', { tier: 'diamond', leagueInstanceId: INSTANCE, leaguePoints: 30, cyclesInTier: 6 });

    // 2v2: team A+C fully subscribed; team C+D with D unsubscribed.
    const team1 = await prisma.teamBattle.create({
      data: {
        stableId: human.id, teamSize: 2, teamName: `LH full ${suffix}`.slice(0, 32),
        members: { create: [{ robotId: a.id, slotIndex: 0 }, { robotId: c.id, slotIndex: 1 }] },
      },
    });
    const team2 = await prisma.teamBattle.create({
      data: {
        stableId: human.id, teamSize: 2, teamName: `LH part ${suffix}`.slice(0, 32),
        members: { create: [{ robotId: c.id, slotIndex: 0 }, { robotId: d.id, slotIndex: 1 }] },
      },
    });
    teamIds.push(team1.id, team2.id);
    fullTeam = team1.id;
    partialTeam = team2.id;
    await prisma.subscription.createMany({
      data: [
        { robotId: a.id, eventType: 'league_2v2', status: 'active' },
        { robotId: c.id, eventType: 'league_2v2', status: 'active' },
      ],
    });
    await enterTeamStanding(team1.id, 'league_2v2', { tier: 'diamond', leagueInstanceId: INSTANCE, cyclesInTier: 6 });
    await enterTeamStanding(team2.id, 'league_2v2', { tier: 'diamond', leagueInstanceId: INSTANCE, cyclesInTier: 6 });
  });

  afterAll(async () => {
    await prisma.standing.deleteMany({ where: { entityType: 'robot', entityId: { in: robotIds } } });
    await prisma.standing.deleteMany({ where: { entityType: 'team', entityId: { in: teamIds } } });
    await prisma.teamBattle.deleteMany({ where: { id: { in: teamIds } } });
    await prisma.subscription.deleteMany({ where: { robotId: { in: robotIds } } });
    for (const userId of userIds) await deleteTestUser(userId);
  });

  it('loads stable type, the active flag and ELO per standings row', async () => {
    const rows = await loadLeagueHealthRows();
    const robotRow = (id: number) => rows.find((row) => row.entityType === 'robot' && row.entityId === id && row.mode === 'league_1v1');
    const teamRow = (id: number) => rows.find((row) => row.entityType === 'team' && row.entityId === id && row.mode === 'league_2v2');

    expect(robotRow(subscribedRobot)).toMatchObject({ active: true, stableType: 'human', elo: 1400, tier: 'diamond', leagueInstanceId: INSTANCE, leaguePoints: 120, cyclesInTier: 6 });
    expect(robotRow(unsubscribedRobot)).toMatchObject({ active: false, stableType: 'automaton', elo: 1100 });
    expect(teamRow(fullTeam)).toMatchObject({ active: true, stableType: 'human', elo: 1400 + 1300 });
    expect(teamRow(partialTeam)).toMatchObject({ active: false, elo: 1300 + 1250 });
  });

  it('reports the fixture instance in the overview', async () => {
    const overview = await getLeagueHealthOverview();
    const diamond = overview.modes.find((mode) => mode.mode === 'league_1v1')?.tiers.find((tier) => tier.tier === 'diamond');
    const instance = diamond?.instances.find((item) => item.id === INSTANCE);
    expect(instance).toMatchObject({ total: 2, active: 1, human: 1, topLp: 120, hasEnoughEntities: false });

    const teamDiamond = overview.modes.find((mode) => mode.mode === 'league_2v2')?.tiers.find((tier) => tier.tier === 'diamond');
    expect(teamDiamond?.instances.find((item) => item.id === INSTANCE)).toMatchObject({ total: 2, active: 1 });
  });

  it('reads the last rebalances per mode from league_history', async () => {
    // Cycle numbers far above any real cycle, so these are the newest for the mode.
    const base = 90_000;
    const move = (cycle: number, changeType: 'promotion' | 'demotion', sourceTier: string, destinationTier: string) => ({
      entityType: 'robot', entityId: subscribedRobot, userId: userIds[0], changeType, mode: 'grand_melee',
      sourceTier, destinationTier, sourceLeagueId: `${sourceTier}_1`, destinationLeagueId: `${destinationTier}_1`,
      leaguePoints: 10, cycleNumber: base + cycle,
    });
    await prisma.leagueHistory.createMany({
      data: [
        move(1, 'promotion', 'gold', 'platinum'), // outside the 5-rebalance window
        move(2, 'promotion', 'gold', 'platinum'),
        move(3, 'promotion', 'bronze', 'silver'),
        move(4, 'promotion', 'gold', 'platinum'),
        move(4, 'promotion', 'gold', 'platinum'),
        move(5, 'demotion', 'gold', 'silver'),
        move(6, 'promotion', 'gold', 'platinum'),
      ],
    });
    try {
      const history = (await loadRebalanceHistory(5)).get('grand_melee');
      expect(history?.cycles).toEqual([base + 6, base + 5, base + 4, base + 3, base + 2]);
      const goldPromotions = history?.moves
        .filter((m) => m.sourceTier === 'gold' && m.changeType === 'promotion')
        .map((m) => [m.cycleNumber - base, m.moved]);
      expect(goldPromotions?.sort()).toEqual([[2, 1], [4, 2], [6, 1]]);
    } finally {
      await prisma.leagueHistory.deleteMany({ where: { cycleNumber: { gte: base } } });
    }
  });

  it('matches getLeagueTierPreview for every mode and tier', async () => {
    const overview = await getLeagueHealthOverview();
    for (const mode of overview.modes) {
      const rules = getLeagueRulesForMode(mode.mode);
      for (const tier of mode.tiers) {
        const preview = await getLeagueTierPreview(mode.mode as StandingsMode, tier.tier, rules);
        const label = `${mode.mode} ${tier.tier}`;
        expect({ label, promoted: tier.promotion.qualifyingNow, demoted: tier.demotion.qualifyingNow, block: tier.promotion.blockReason })
          .toEqual({
            label,
            promoted: preview.plan.promotionCandidates.length,
            demoted: preview.demotionEntityIds.size,
            block: preview.plan.promotionBlockReason,
          });
        for (const instance of tier.instances) {
          const plan = preview.instancePlansById.get(instance.id);
          expect({ label: instance.id, slots: instance.promotionSlots, promoted: instance.promotionCandidates, demotionSlots: instance.demotionSlots, demoted: instance.demotionCandidates })
            .toEqual({ label: instance.id, slots: plan?.promotionSlots, promoted: plan?.promotionCandidates.length, demotionSlots: plan?.demotionSlots, demoted: plan?.demotionCandidates.length });
        }
      }
    }
  });
});
