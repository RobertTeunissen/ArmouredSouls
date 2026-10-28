/**
 * Generated_Stable creation and top-up (userGeneration.ts), against the real DB.
 *
 * Every generated stable is a three-robot filler stable: one 3v3 team (3v3
 * league + tournament), one 2v2 team of robots 1–2 (2v2 tournament only), all
 * three robots in the 1v1 tournament and robot 3 in Grand Melee. The tier
 * (WimpBot / AverageBot / ExpertBot, split evenly) sets only attribute level and
 * weapon price band. The population is topped up to GENERATED_STABLE_TARGET.
 */

import fc from 'fast-check';
import prisma from '../src/lib/prisma';
import {
  createGeneratedStables,
  countGeneratedStables,
  topUpGeneratedStables,
  FILLER_ROBOTS_PER_STABLE,
} from '../src/utils/userGeneration';
import { TIER_CONFIGS, LOADOUT_TITLES, WEAPON_CODENAMES } from '../src/utils/tierConfig';
import { getEligibleTeamsForTournament } from '../src/services/tournament/teamTournamentService';
import { getEligibleRobotsForTournament } from '../src/services/tournament/tournamentService';

const TIER_OF_PREFIX: Record<string, (typeof TIER_CONFIGS)[number]> = {
  auto_wimpbot_: TIER_CONFIGS[0],
  auto_averagebot_: TIER_CONFIGS[1],
  auto_expertbot_: TIER_CONFIGS[2],
};

function tierOf(username: string): (typeof TIER_CONFIGS)[number] {
  const prefix = Object.keys(TIER_OF_PREFIX).find((p) => username.startsWith(p));
  if (!prefix) throw new Error(`not a generated username: ${username}`);
  return TIER_OF_PREFIX[prefix];
}

/** Remove every auto-generated stable and what it owns (standings have no FK). */
async function cleanupAutoUsers(): Promise<void> {
  const userIds = (await prisma.user.findMany({
    where: { username: { startsWith: 'auto_' } },
    select: { id: true },
  })).map((u) => u.id);
  if (userIds.length === 0) return;

  const robotIds = (await prisma.robot.findMany({ where: { userId: { in: userIds } }, select: { id: true } })).map((r) => r.id);
  const teamIds = (await prisma.teamBattle.findMany({ where: { stableId: { in: userIds } }, select: { id: true } })).map((t) => t.id);

  await prisma.standing.deleteMany({
    where: {
      OR: [
        { entityType: 'robot', entityId: { in: robotIds } },
        { entityType: 'team', entityId: { in: teamIds } },
      ],
    },
  });
  if (teamIds.length > 0) {
    await prisma.scheduledMatchParticipant.deleteMany({ where: { participantType: 'team', participantId: { in: teamIds } } });
    await prisma.teamBattleMember.deleteMany({ where: { teamId: { in: teamIds } } });
    await prisma.teamBattle.deleteMany({ where: { id: { in: teamIds } } });
  }
  if (robotIds.length > 0) {
    await prisma.battleParticipant.deleteMany({ where: { robotId: { in: robotIds } } });
    await prisma.scheduledMatchParticipant.deleteMany({ where: { participantType: 'robot', participantId: { in: robotIds } } });
    await prisma.subscription.deleteMany({ where: { robotId: { in: robotIds } } });
  }
  await prisma.weaponInventory.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.facility.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.robot.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

const ORIGINAL_TARGET = process.env.GENERATED_STABLE_TARGET;

describe('Generated stables', () => {
  beforeAll(async () => {
    await prisma.$connect();
    // Weapons are seeded globally via tests/setup.ts
  });

  afterAll(async () => {
    await cleanupAutoUsers();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanupAutoUsers();
  });

  afterEach(() => {
    if (ORIGINAL_TARGET === undefined) delete process.env.GENERATED_STABLE_TARGET;
    else process.env.GENERATED_STABLE_TARGET = ORIGINAL_TARGET;
  });

  describe('createGeneratedStables', () => {
    it('creates nothing for a count of 0 or less', async () => {
      for (const count of [0, -2]) {
        const result = await createGeneratedStables(count);
        expect(result).toMatchObject({ usersCreated: 0, robotsCreated: 0, usernames: [] });
      }
      expect(await countGeneratedStables()).toBe(0);
    });

    it('splits the stables evenly over the three tiers, three robots each', async () => {
      const result = await createGeneratedStables(3);

      expect(result).toMatchObject({
        usersCreated: 3,
        robotsCreated: 9,
        league3v3TeamsCreated: 3,
        league2v2TeamsCreated: 3,
        tagTeamsCreated: 0,
        tierBreakdown: { wimpBot: 1, averageBot: 1, expertBot: 1 },
      });
      for (const username of result.usernames) {
        expect(username).toMatch(/^auto_(wimpbot|averagebot|expertbot)_\d{4}$/);
      }

      const users = await prisma.user.findMany({
        where: { username: { in: result.usernames } },
        include: { robots: true, facilities: true },
      });
      expect(users).toHaveLength(3);
      expect(new Set(users.map((u) => u.stableName)).size).toBe(3);
      for (const user of users) {
        expect(user).toMatchObject({ currency: 100000, role: 'user', isGenerated: true, stableType: 'generated' });
        expect(user.robots).toHaveLength(FILLER_ROBOTS_PER_STABLE);
        expect(user.facilities).toEqual([expect.objectContaining({ facilityType: 'booking_office', level: 1 })]);
      }
    });

    it('builds robots with the tier attribute level, derived HP/shield and a weapon from the tier price band', async () => {
      const result = await createGeneratedStables(3);
      const robots = await prisma.robot.findMany({
        where: { user: { username: { in: result.usernames } } },
        include: { user: true, mainWeapon: { include: { weapon: true } } },
      });
      expect(robots).toHaveLength(9);
      for (const robot of robots) {
        const tier = tierOf(robot.user.username);
        expect(Number(robot.combatPower)).toBe(tier.attributeLevel);
        expect(Number(robot.formationTactics)).toBe(tier.attributeLevel);
        expect(robot.maxHP).toBe(50 + Math.floor(tier.attributeLevel * 5));
        expect(robot.currentHP).toBe(robot.maxHP);
        expect(robot.maxShield).toBe(Math.floor(tier.attributeLevel * 4));
        expect(robot.elo).toBe(1200);
        expect(robot.battleReadiness).toBe(100);
        expect(robot.mainWeapon).not.toBeNull();
        expect(robot.mainWeapon!.weapon.cost).toBeGreaterThanOrEqual(tier.priceTier.min);
        expect(robot.mainWeapon!.weapon.cost).toBeLessThanOrEqual(tier.priceTier.max);
      }
    });

    it('subscribes every robot to the filler events: 2v2 tournament for robots 1–2, Grand Melee for robot 3', async () => {
      const result = await createGeneratedStables(3);
      const users = await prisma.user.findMany({
        where: { username: { in: result.usernames } },
        include: { robots: { include: { subscriptions: true }, orderBy: { id: 'asc' } } },
      });
      for (const user of users) {
        const sets = user.robots.map((r) => r.subscriptions.map((s) => s.eventType).sort());
        expect(sets).toEqual([
          ['league_3v3', 'tournament_1v1', 'tournament_2v2', 'tournament_3v3'],
          ['league_3v3', 'tournament_1v1', 'tournament_2v2', 'tournament_3v3'],
          ['grand_melee', 'league_3v3', 'tournament_1v1', 'tournament_3v3'],
        ]);
      }
    });

    it('registers a 3v3 team in the 3v3 league and a 2v2 team of robots 1–2 in no league', async () => {
      const result = await createGeneratedStables(3);
      const users = await prisma.user.findMany({
        where: { username: { in: result.usernames } },
        include: { robots: { orderBy: { id: 'asc' } } },
      });
      for (const user of users) {
        const teams = await prisma.teamBattle.findMany({ where: { stableId: user.id }, include: { members: true } });
        const team3 = teams.find((t) => t.teamSize === 3);
        const team2 = teams.find((t) => t.teamSize === 2);
        expect(team3?.members.map((m) => m.robotId).sort()).toEqual(user.robots.map((r) => r.id).sort());
        expect(team2?.members.map((m) => m.robotId).sort()).toEqual(user.robots.slice(0, 2).map((r) => r.id).sort());

        const team3Modes = await prisma.standing.findMany({ where: { entityType: 'team', entityId: team3!.id } });
        expect(team3Modes.map((s) => s.mode)).toEqual(['league_3v3']);
        expect(team3Modes[0]).toMatchObject({ tier: 'bronze', leaguePoints: 0 });
        expect(await prisma.standing.count({ where: { entityType: 'team', entityId: team2!.id } })).toBe(0);
      }
    });

    it('gives robot standings only in Grand Melee, for robot 3', async () => {
      const result = await createGeneratedStables(3);
      const robots = await prisma.robot.findMany({
        where: { user: { username: { in: result.usernames } } },
        orderBy: { id: 'asc' },
        select: { id: true, userId: true },
      });
      const thirdRobotOf = new Map<number, number>();
      for (const robot of robots) thirdRobotOf.set(robot.userId, robot.id); // last (third) robot per stable
      const standings = await prisma.standing.findMany({
        where: { entityType: 'robot', entityId: { in: robots.map((r) => r.id) } },
      });
      expect(standings.map((s) => s.mode)).toEqual(['grand_melee', 'grand_melee', 'grand_melee']);
      expect(standings.map((s) => s.entityId).sort()).toEqual([...thirdRobotOf.values()].sort());
    });

    it('makes every team and robot eligible for its tournament', async () => {
      const result = await createGeneratedStables(3);
      const userIds = (await prisma.user.findMany({ where: { username: { in: result.usernames } }, select: { id: true } })).map((u) => u.id);
      const teams = await prisma.teamBattle.findMany({ where: { stableId: { in: userIds } } });
      const robots = await prisma.robot.findMany({ where: { userId: { in: userIds } }, select: { id: true } });

      const eligible3 = new Set((await getEligibleTeamsForTournament(3)).map((p) => p.id));
      const eligible2 = new Set((await getEligibleTeamsForTournament(2)).map((p) => p.id));
      const eligible1 = new Set((await getEligibleRobotsForTournament()).map((r) => r.id));
      for (const team of teams) {
        expect((team.teamSize === 3 ? eligible3 : eligible2).has(team.id)).toBe(true);
      }
      for (const robot of robots) expect(eligible1.has(robot.id)).toBe(true);
    });

    it('property: names encode tier, loadout and weapon and stay unique', async () => {
      const titles = Object.values(LOADOUT_TITLES);
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 2, max: 4 }), async (count) => {
          await cleanupAutoUsers();
          const result = await createGeneratedStables(count);
          const robots = await prisma.robot.findMany({
            where: { user: { username: { in: result.usernames } } },
            include: { user: true, mainWeapon: { include: { weapon: true } } },
          });
          expect(robots).toHaveLength(count * FILLER_ROBOTS_PER_STABLE);
          expect(new Set(robots.map((r) => r.name)).size).toBe(robots.length);
          for (const robot of robots) {
            const parts = robot.name.split(' ');
            expect(parts[0]).toBe(tierOf(robot.user.username).name);
            expect(titles).toContain(parts[1]);
            const codename = WEAPON_CODENAMES[robot.mainWeapon!.weapon.name];
            if (codename) expect(robot.name).toContain(` ${codename} `);
            expect(parseInt(parts[parts.length - 1], 10)).toBeGreaterThan(0);
            expect(['balanced', 'offensive', 'defensive']).toContain(robot.stance);
            expect(['single', 'weapon_shield', 'two_handed', 'dual_wield']).toContain(robot.loadoutType);
            expect(robot.yieldThreshold).toBeGreaterThanOrEqual(0);
            expect(robot.yieldThreshold).toBeLessThanOrEqual(20);
          }
        }),
        { numRuns: 3 },
      );
    }, 120000);
  });

  describe('topUpGeneratedStables', () => {
    it('creates only the missing stables, then nothing', async () => {
      process.env.GENERATED_STABLE_TARGET = '4';

      const first = await topUpGeneratedStables();
      expect(first).toMatchObject({ target: 4, existingBefore: 0, usersCreated: 4, robotsCreated: 12 });
      expect(first.tierBreakdown).toEqual({ wimpBot: 2, averageBot: 1, expertBot: 1 });

      const second = await topUpGeneratedStables();
      expect(second).toMatchObject({ target: 4, existingBefore: 4, usersCreated: 0 });
      expect(await countGeneratedStables()).toBe(4);
    }, 60000);

    it('creates the difference when the target is raised, and nothing when it is lowered or 0', async () => {
      process.env.GENERATED_STABLE_TARGET = '2';
      await topUpGeneratedStables();

      process.env.GENERATED_STABLE_TARGET = '5';
      expect(await topUpGeneratedStables()).toMatchObject({ existingBefore: 2, usersCreated: 3 });

      for (const target of ['1', '0']) {
        process.env.GENERATED_STABLE_TARGET = target;
        expect(await topUpGeneratedStables()).toMatchObject({ existingBefore: 5, usersCreated: 0 });
      }
      expect(await countGeneratedStables()).toBe(5);
    }, 60000);
  });
});
