/**
 * Spec #55 task 1.6 (R1.8, decision 38) — achievement rarity counts humans only.
 *
 * Real database. An Automaton holding an achievement changes neither that
 * achievement's holder count nor the active-player count used for rarity
 * percentages; a human holding it still changes both. Automatons still earn
 * (hold) the achievement.
 */
import prisma from '../../src/lib/prisma';
import { refreshRarityCache } from '../../src/services/achievement/achievementQueries';
import type { AchievementRarityCache } from '../../src/services/achievement/achievementTypes';

const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
// achievement_id is VARCHAR(10); a synthetic id keeps the counts isolated from real data.
const ACHIEVEMENT_ID = `Z${Math.floor(Math.random() * 1e8)}`.slice(0, 10);

function emptyCache(): AchievementRarityCache {
  return { counts: new Map(), totalActivePlayers: 0, refreshedAt: new Date(0) };
}

async function createActiveStableWithAchievement(username: string, stableType: 'human' | 'automaton'): Promise<number> {
  const user = await prisma.user.create({
    data: { username, passwordHash: 'x', stableType, isGenerated: false },
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

describe('Achievement rarity excludes Automaton_Stables (Spec #55 R1.8)', () => {
  const userIds: number[] = [];

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  it('ignores an Automaton holder and counts a human holder', async () => {
    const baseline = await refreshRarityCache(emptyCache());
    expect(baseline.counts.get(ACHIEVEMENT_ID) ?? 0).toBe(0);

    userIds.push(await createActiveStableWithAchievement(`rar_auto_${suffix}`, 'automaton'));
    const afterAutomaton = await refreshRarityCache(emptyCache());
    expect(afterAutomaton.counts.get(ACHIEVEMENT_ID) ?? 0).toBe(0);
    expect(afterAutomaton.totalActivePlayers).toBe(baseline.totalActivePlayers);

    // The Automaton still holds the achievement; only the percentage ignores it.
    expect(await prisma.userAchievement.count({ where: { achievementId: ACHIEVEMENT_ID } })).toBe(1);

    userIds.push(await createActiveStableWithAchievement(`rar_human_${suffix}`, 'human'));
    const afterHuman = await refreshRarityCache(emptyCache());
    expect(afterHuman.counts.get(ACHIEVEMENT_ID)).toBe(1);
    expect(afterHuman.totalActivePlayers).toBe(baseline.totalActivePlayers + 1);
  });
});
