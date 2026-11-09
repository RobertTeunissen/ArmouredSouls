/**
 * Spec #55 task 1.6 (R1.8, decision 38) — achievement rarity counts humans only.
 *
 * Real database. An Automaton or generated stable holding an achievement
 * changes neither that achievement's holder count nor the active-player count
 * used for rarity percentages; a human holding it still changes both, whatever
 * its username looks like. Non-human stables still earn (hold) the achievement.
 */
import prisma from '../../src/lib/prisma';
import { refreshRarityCache } from '../../src/services/achievement/achievementQueries';
import type { AchievementRarityCache } from '../../src/services/achievement/achievementTypes';

const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
// achievement_id is VARCHAR(10); a synthetic id keeps the counts isolated from real data.
const ACHIEVEMENT_ID = `Z${Math.floor(Math.random() * 1e8)}`.slice(0, 10);

type StableKind = 'human' | 'automaton' | 'generated';

function emptyCache(): AchievementRarityCache {
  return { counts: new Map(), totalActivePlayers: 0, refreshedAt: new Date(0) };
}

async function createActiveStableWithAchievement(username: string, stableType: StableKind): Promise<number> {
  const user = await prisma.user.create({
    data: { username, passwordHash: 'x', stableType, isGenerated: stableType === 'generated' },
  });
  await prisma.robot.create({
    data: {
      userId: user.id,
      name: `${username}_bot`.slice(0, 50),
      currentHP: 10,
      maxHP: 10,
      currentShield: 2,
      maxShield: 2,
      totalBattles: 3,
    },
  });
  await prisma.userAchievement.create({ data: { userId: user.id, achievementId: ACHIEVEMENT_ID } });
  return user.id;
}

describe('Achievement rarity counts Human_Stables only (Spec #55 R1.8)', () => {
  const userIds: number[] = [];

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  it('ignores Automaton and generated holders and counts a human holder', async () => {
    const baseline = await refreshRarityCache(emptyCache());
    expect(baseline.counts.get(ACHIEVEMENT_ID) ?? 0).toBe(0);

    userIds.push(await createActiveStableWithAchievement(`rar_auto_${suffix}`, 'automaton'));
    // A generated stable whose name does not follow the auto_/test_user_ pattern.
    userIds.push(await createActiveStableWithAchievement(`rar_gen_${suffix}`, 'generated'));
    const afterNonHuman = await refreshRarityCache(emptyCache());
    expect(afterNonHuman.counts.get(ACHIEVEMENT_ID) ?? 0).toBe(0);
    expect(afterNonHuman.totalActivePlayers).toBe(baseline.totalActivePlayers);

    // They still hold the achievement; only the percentage ignores them.
    expect(await prisma.userAchievement.count({ where: { achievementId: ACHIEVEMENT_ID } })).toBe(2);

    // A human whose username happens to start with `auto_` is still a player.
    userIds.push(await createActiveStableWithAchievement(`auto_${suffix}`.slice(0, 50), 'human'));
    const afterHuman = await refreshRarityCache(emptyCache());
    expect(afterHuman.counts.get(ACHIEVEMENT_ID)).toBe(1);
    expect(afterHuman.totalActivePlayers).toBe(baseline.totalActivePlayers + 1);
  });
});
